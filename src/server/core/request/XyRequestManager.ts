import { Logger } from "../../../../shared/logger/Logger";
import { ServerOptions } from "../../../types/types";
import { XyprissApp } from "../XyprissApp";
import { XyPrisResponse } from "../../../types/httpServer.type";
import { Configs } from "../../../config";

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

        // 3. Setup Payload Middleware (Custom Validators, URL Length)
        this.setupPayloadMiddleware();

        // 4. Setup Lifecycle Middleware (Monitoring, Timing)
        this.setupLifecycleMiddleware();
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
     * Handle payload validation and restrictions
     */
    private setupPayloadMiddleware(): void {
        const config = this.options?.payload;
        if (!config) return;

        this.logger.debug(
            "middleware",
            "Payload validation middleware activated"
        );

        this.app.use(async (req: any, res: any, next: any) => {
            // 1. Max URL Length (JS Backup - Rust handles this efficiently too)
            if (config.maxUrlLength && req.url.length > config.maxUrlLength) {
                return res.status(414).xJson({
                    error: "URI Too Long",
                    maxLength: config.maxUrlLength,
                    currentLength: req.url.length,
                });
            }

            // 2. Custom Validator
            if (config.customValidator) {
                try {
                    const isValid = await config.customValidator(req);
                    if (!isValid) {
                        return res.status(400).xJson({
                            error: "Invalid Request (Custom Validator Failed)",
                        });
                    }
                } catch (e: any) {
                    this.logger.error(
                        "middleware",
                        `Custom validator error: ${e.message}`
                    );
                    return res.status(500).xJson({
                        error: "Internal Server Error (Validator)",
                    });
                }
            }

            next(); 
        });
    }

    /**
     * Monitor request lifecycle and timing
     */
    private setupLifecycleMiddleware(): void {
        const config = this.options?.lifecycle;
        // Check strict enabled flag if present, otherwise default to enabled if config exists
        if (!config || config.enabled === false) return;

        this.logger.debug(
            "middleware",
            "Lifecycle monitoring middleware activated"
        );

        this.app.use((req: any, res: any, next: any) => {
            const start = Date.now();

            if (config.trackStartTime) {
                req._startTime = start;
                req.headers["x-request-start"] = start.toString();
            }

            if (config.onLifecycleEvent) {
                config.onLifecycleEvent("start", req, { start });
            }

            const cleanup = () => {
                const duration = Date.now() - start;

                if (config.warnAfter && duration > config.warnAfter) {
                    this.logger.warn(
                        "server",
                        `Slow Request: ${req.method} ${req.url} took ${duration}ms (Threshold: ${config.warnAfter}ms)`
                    );
                }

                if (config.onLifecycleEvent) {
                    config.onLifecycleEvent("end", req, { duration });
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
    public async getStats() {
        const jsStats = {
            totalActive: this.totalActiveRequests,
            uniqueIPs: this.activeRequestsByIP.size,
            timeoutEnabled: this.options?.timeout?.enabled || false,
            concurrencyEnabled: !!this.options?.concurrency,
        };

        try {
            // Fetch native stats from XHSC
            const rustStats = await this.fetchRustStats();
            return {
                ...jsStats,
                native: rustStats,
            };
        } catch (e: any) {
            return {
                ...jsStats,
                nativeError: e.message,
            };
        }
    }

    private async fetchRustStats() {
        // Assuming XHSC is running on the configured port
        const port = this.app.getPort();
        const response = await fetch(
            `http://${
                Configs.get("server")?.host || "127.0.0.1"
            }:${port}/_xypriss/b/status`
        );
        const data = await response.json();
        return (data as any).concurrency;
    }
}

