import { Logger } from "../../shared/logger/Logger";
import { QuickLogger } from "../../shared/logger/quickLogger";
import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
    NextFunction,
    MiddlewareFunction,
} from "../../types/httpServer.type";
import {
    MiddlewareConfig,
    MiddlewareEntry,
} from "../../types/middlewareManager.types";

/**
 * Modular Middleware Manager
 * Handles middleware registration, execution, and management
 */
export class MiddlewareManager {
    private middleware: MiddlewareEntry[] = [];
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = QuickLogger.for("middleware") as anyy
        this.logger.debug("middleware", "Created new middleware manager");
    }

    /**
     * Register middleware
     */
    public use(
        handler: MiddlewareFunction,
        config: Partial<MiddlewareConfig> = {},
    ): void {
        const middlewareConfig: MiddlewareConfig = {
            name: config.name || `middleware_${this.middleware.length + 1}`,
            enabled: config.enabled !== false,
            priority: config.priority || 100,
            description: config.description || "Custom middleware",
        };

        const entry: MiddlewareEntry = {
            config: middlewareConfig,
            handler,
        };

        this.middleware.push(entry);

        // Sort by priority (lower numbers first)
        this.middleware.sort((a, b) => a.config.priority - b.config.priority);

        this.logger.debug(
            "middleware",
            `Registered middleware: ${middlewareConfig.name} (priority: ${middlewareConfig.priority})`,
        );
        const stack = new Error().stack?.split("\n")[2]?.trim();
        this.logger.debug(
            "middleware",
            `Registered middleware: ${middlewareConfig.name} (priority: ${middlewareConfig.priority}) - Handler: ${handler.name || "anonymous"} (args: ${handler.length}) - Source: ${stack}`,
        );
    }

    /**
     * Execute all middleware in order
     * @returns true if all middleware completed successfully, false if chain was stopped
     */
    public async execute(req: Request, res: Response): Promise<boolean> {
        this.logger.debug(
            "middleware",
            `Executing ${this.middleware.length} middleware functions`,
        );

        let error: any = null;

        for (let i = 0; i < this.middleware.length; i++) {
            const entry = this.middleware[i];

            // 1. Logic for Error Handlers (4 arguments: err, req, res, next)
            if (entry.handler.length === 4) {
                if (!error) {
                    this.logger.debug(
                        "middleware",
                        `Skipping error handler during normal flow: ${entry.config.name}`,
                    );
                    continue;
                }
            } else {
                // 2. Logic for Normal Middleware (2 or 3 arguments: req, res, next)
                if (error) {
                    this.logger.debug(
                        "middleware",
                        `Skipping normal middleware due to previous error: ${entry.config.name}`,
                    );
                    continue;
                }
            }

            if (!entry.config.enabled) {
                this.logger.debug(
                    "middleware",
                    `Skipping disabled middleware: ${entry.config.name}`,
                );
                continue;
            }

            this.logger.debug(
                "middleware",
                `Executing middleware: ${entry.config.name} (${i + 1}/${
                    this.middleware.length
                })`,
            );

            try {
                let nextCalled = false;
                let middlewareCompleted = false;

                const middlewarePromise = new Promise<void>(
                    (resolve, reject) => {
                        try {
                            const nextCallback = (mwError?: any) => {
                                nextCalled = true;
                                if (mwError) {
                                    reject(mwError);
                                } else {
                                    resolve();
                                }
                            };

                            if (entry.handler.length === 4) {
                                // Error handler: (err, req, res, next)
                                entry.handler(error, req, res, nextCallback);
                                // Reset error once an error handler is reached to allow recovery
                                // (Standard Express behavior: error handlers can resolve errors)
                                error = null;
                            } else {
                                // Normal middleware: (req, res, next)
                                entry.handler(req, res, nextCallback);
                            }
                        } catch (e) {
                            reject(e);
                        }
                    },
                );

                const timeoutPromise = new Promise<void>((_, reject) => {
                    setTimeout(() => {
                        if (!nextCalled && !res.writableEnded) {
                            reject(
                                new Error(
                                    `Middleware ${entry.config.name} timed out after 5s`,
                                ),
                            );
                        }
                    }, 5000); // 5 second timeout
                });

                try {
                    await Promise.race([middlewarePromise, timeoutPromise]);
                    middlewareCompleted = true;
                } catch (mwError: any) {
                    error = mwError;
                    this.logger.error(
                        "middleware",
                        `[TIMEOUT] Middleware "${entry.config.name}" (Handler: ${entry.handler.name || "anonymous"}) failed or timed out: ${mwError.message}`,
                    );
                    // Standard behavior: continue to find the next error handler
                    continue;
                }

                if (res.writableEnded) {
                    this.logger.debug(
                        "middleware",
                        `Middleware ${entry.config.name} ended response - stopping chain`,
                    );
                    return true;
                }
            } catch (err) {
                this.logger.error(
                    "middleware",
                    `Critical failure in middleware manager loop for ${entry.config.name}:`,
                    err,
                );
                error = err;
            }
        }

        if (error) {
            this.logger.error(
                "middleware",
                "Request failed with unhandled error:",
                error,
            );
            // If we still have an error after all middleware, the request failed
            return false;
        }

        this.logger.debug("middleware", `All middleware completed`);
        return true;
    }

    /**
     * Check if middleware function expects a next parameter
     */
    private isMiddlewareWithNext(handler: MiddlewareFunction): boolean {
        return handler.length >= 3; // req, res, next
    }

    /**
     * Get middleware statistics
     */
    public getStats(): {
        total: number;
        enabled: number;
        disabled: number;
        middleware: Array<{
            name: string;
            enabled: boolean;
            priority: number;
            description?: string;
        }>;
    } {
        const enabled = this.middleware.filter((m) => m.config.enabled);
        const disabled = this.middleware.filter((m) => !m.config.enabled);

        return {
            total: this.middleware.length,
            enabled: enabled.length,
            disabled: disabled.length,
            middleware: this.middleware.map((m) => ({
                name: m.config.name,
                enabled: m.config.enabled,
                priority: m.config.priority,
                description: m.config.description,
            })),
        };
    }

    /**
     * Enable/disable middleware by name
     */
    public setMiddlewareEnabled(name: string, enabled: boolean): boolean {
        const entry = this.middleware.find((m) => m.config.name === name);
        if (entry) {
            entry.config.enabled = enabled;
            this.logger.debug(
                "middleware",
                `${enabled ? "Enabled" : "Disabled"} middleware: ${name}`,
            );
            return true;
        }
        return false;
    }

    /**
     * Remove middleware by name
     */
    public removeMiddleware(name: string): boolean {
        const index = this.middleware.findIndex((m) => m.config.name === name);
        if (index !== -1) {
            this.middleware.splice(index, 1);
            this.logger.debug("middleware", `Removed middleware: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * Clear all middleware
     */
    public clear(): void {
        const count = this.middleware.length;
        this.middleware = [];
        this.logger.debug(
            "middleware",
            `Cleared ${count} middleware functions`,
        );
    }

    /**
     * Get middleware by name
     */
    public getMiddleware(name: string): MiddlewareEntry | undefined {
        return this.middleware.find((m) => m.config.name === name);
    }

    /**
     * List all middleware names
     */
    public listMiddleware(): string[] {
        return this.middleware.map((m) => m.config.name);
    }

    /**
     * Get all middleware entries
     */
    public getAllMiddleware(): MiddlewareEntry[] {
        return [...this.middleware];
    }
}

