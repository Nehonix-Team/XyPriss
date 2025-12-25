/**
 * Hooks Integrator
 * Integrates plugin hooks into the request/response lifecycle
 */

import type {
    SecurityThreat,
    RequestTiming,
    RouteErrorInfo,
} from "../types/PluginTypes";
import type { Request, Response, NextFunction } from "../../types/types";
import type { PluginManager } from "./PluginManager";
import { Logger } from "../../../shared/logger/Logger";

export class HooksIntegrator {
    private pluginManager: PluginManager;
    private logger: Logger;

    constructor(pluginManager: PluginManager, logger?: Logger) {
        this.pluginManager = pluginManager;
        this.logger =
            logger ||
            new Logger({
                enabled: true,
                level: "debug",
                components: { plugins: true },
                types: { debug: true },
            });
    }

    /**
     * Create middleware that measures request timing and triggers hooks
     */
    createTimingMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();

            // Store start time on request object
            (req as any).__startTime = startTime;

            // Listen for response finish event
            res.on("finish", async () => {
                const endTime = Date.now();
                const duration = endTime - startTime;

                const timing: RequestTiming = {
                    path: req.path || req.url || "/",
                    method: req.method || "GET",
                    startTime,
                    endTime,
                    duration,
                    statusCode: res.statusCode || 200,
                    ip:
                        (req as any).ip ||
                        req.socket?.remoteAddress ||
                        "unknown",
                    userAgent: req.headers?.["user-agent"],
                    timestamp: new Date(),
                };

                // Trigger the hook
                try {
                    await this.pluginManager.triggerRequestTiming(
                        timing,
                        req,
                        res
                    );
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        "Error triggering onRequestTiming hook:",
                        error
                    );
                }
            });

            next();
        };
    }

    /**
     * Create error handler middleware that triggers onRouteError hook
     */
    createErrorHandlerMiddleware() {
        return async (
            error: Error,
            req: Request,
            res: Response,
            next: NextFunction
        ) => {
            const errorInfo: RouteErrorInfo = {
                path: req.path || req.url || "/",
                method: req.method || "GET",
                statusCode: res.statusCode >= 400 ? res.statusCode : 500,
                error,
                stack: error.stack,
                ip: (req as any).ip || req.socket?.remoteAddress || "unknown",
                userAgent: req.headers?.["user-agent"],
                timestamp: new Date(),
                requestBody: (req as any).body,
                requestQuery: (req as any).query,
                requestParams: (req as any).params,
            };

            // Trigger the hook
            try {
                await this.pluginManager.triggerRouteError(errorInfo, req, res);
            } catch (hookError) {
                this.logger.error(
                    "plugins",
                    "Error triggering onRouteError hook:",
                    hookError
                );
            }

            // Pass error to next error handler
            next(error);
        };
    }

    /**
     * Trigger security threat hook
     */
    async triggerSecurityThreat(
        threat: SecurityThreat,
        req: Request,
        res: Response
    ): Promise<void> {
        try {
            await this.pluginManager.triggerSecurityThreat(threat, req, res);
        } catch (error) {
            this.logger.error(
                "plugins",
                "Error triggering onSecurityThreat hook:",
                error
            );
        }
    }

    /**
     * Wrap a route handler to catch errors and trigger hooks
     */
    wrapRouteHandler(handler: Function) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = handler(req, res, next);
                if (result && typeof result.catch === "function") {
                    await result;
                }
            } catch (error: any) {
                const errorInfo: RouteErrorInfo = {
                    path: req.path || req.url || "/",
                    method: req.method || "GET",
                    statusCode: 500,
                    error,
                    stack: error.stack,
                    ip:
                        (req as any).ip ||
                        req.socket?.remoteAddress ||
                        "unknown",
                    userAgent: req.headers?.["user-agent"],
                    timestamp: new Date(),
                    requestBody: (req as any).body,
                    requestQuery: (req as any).query,
                    requestParams: (req as any).params,
                };

                // Trigger the hook
                try {
                    await this.pluginManager.triggerRouteError(
                        errorInfo,
                        req,
                        res
                    );
                } catch (hookError) {
                    this.logger.error(
                        "plugins",
                        "Error triggering onRouteError hook:",
                        hookError
                    );
                }

                // Send error response if not already sent
                if (!res.headersSent) {
                    res.status(500).json({
                        error: "Internal Server Error",
                        message: error.message,
                    });
                }
            }
        };
    }
}

