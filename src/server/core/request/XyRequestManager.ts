import { Logger } from "../../../../shared/logger/Logger";
import { ServerOptions } from "../../../types/types";
import { XyprissApp } from "../XyprissApp";
import { XyPrisResponse } from "../../../types/httpServer.type";

/**
 * XyRequestManager - Dedicated module for handling request lifecycle,
 * timeouts, concurrency, and advanced queuing.
 *
 * Performance Note: Heavy enforcement (Limits/Queuing) is delegated to Rust (XHSC)
 * while business logic callbacks and middleware orchestration remain in TypeScript.
 */
export class XyRequestManager {
    private logger: Logger;
    private options: ServerOptions["requestManagement"];
    private activeRequestsByIP = new Map<string, number>();
    private totalActiveRequests = 0;

    constructor(
        private app: XyprissApp,
        options: ServerOptions["requestManagement"]
    ) {
        this.logger = (app as any).logger;
        this.options = options;
    }

    /**
     * Initialize the request management stack
     */
    public initialize(): void {
        if (!this.options) return;

        this.logger.info("server", "Initializing Request Management System...");

        // 1. Setup Timeout Middleware
        this.setupTimeoutMiddleware();

        // 2. Setup Concurrency & Queuing Middleware
        this.setupConcurrencyMiddleware();
    }

    /**
     * Handle application-level timeouts with support for route-specific overrides
     * and custom handlers.
     */
    private setupTimeoutMiddleware(): void {
        if (!this.options?.timeout?.enabled) return;

        this.logger.debug("middleware", "Request timeout middleware activated");

        this.app.use((req: any, res: XyPrisResponse, next: any) => {
            const route = req.route?.path || req.path;
            const config = this.options!.timeout!;

            const timeout =
                config.routes?.[route] || config.defaultTimeout || 30000;

            const timeoutId = setTimeout(() => {
                if (!res.headersSent) {
                    if (config.onTimeout) {
                        config.onTimeout(req, res);
                    } else {
                        res.status(408).xJson({
                            error: "Request timeout (middleware)",
                            timeout: timeout,
                            message: config.errorMessage,
                            path: req.path,
                            ...(config.includeStackTrace && {
                                stack: new Error().stack,
                            }),
                        });
                    }
                }
            }, timeout);

            // Cleanup
            res.on("finish", () => clearTimeout(timeoutId));
            res.on("close", () => clearTimeout(timeoutId));

            next();
        });
    }

    /**
     * Handle concurrency limits and basic queuing at the application level.
     * Note: High-performance enforcement is handled by Rust before reaching here.
     */
    private setupConcurrencyMiddleware(): void {
        const config = this.options?.concurrency;
        if (!config || (!config.maxConcurrentRequests && !config.maxPerIP))
            return;

        this.logger.debug(
            "middleware",
            "Concurrency control middleware activated"
        );

        this.app.use((req: any, res: any, next: any) => {
            const clientIP = req.ip || req.connection.remoteAddress;
            const maxTotal = config.maxConcurrentRequests || Infinity;
            const maxPerIP = config.maxPerIP || Infinity;

            const currentPerIP = this.activeRequestsByIP.get(clientIP) || 0;

            // Check limits (Safety Net - Rust normally blocks this first)
            if (
                this.totalActiveRequests >= maxTotal ||
                currentPerIP >= maxPerIP
            ) {
                if (config.onQueueOverflow) {
                    return config.onQueueOverflow(req, res);
                } else {
                    return res.status(429).xJson({
                        error: "Too many concurrent requests",
                        totalActive: this.totalActiveRequests,
                        limit: maxTotal,
                        perIP: currentPerIP,
                        perIPLimit: maxPerIP,
                    });
                }
            }

            // Track request start
            this.totalActiveRequests++;
            this.activeRequestsByIP.set(clientIP, currentPerIP + 1);

            // Track request completion
            const cleanup = () => {
                this.totalActiveRequests--;
                const count = this.activeRequestsByIP.get(clientIP) || 1;
                if (count <= 1) {
                    this.activeRequestsByIP.delete(clientIP);
                } else {
                    this.activeRequestsByIP.set(clientIP, count - 1);
                }
                res.removeListener("finish", cleanup);
                res.removeListener("close", cleanup);
            };

            res.on("finish", cleanup);
            res.on("close", cleanup);

            next();
        });
    }

    /**
     * Get current live statistics of request management
     */
    public getStats() {
        return {
            totalActive: this.totalActiveRequests,
            uniqueIPs: this.activeRequestsByIP.size,
            timeoutEnabled: this.options?.timeout?.enabled || false,
            concurrencyEnabled: !!this.options?.concurrency,
        };
    }
}

