import { Logger } from "../../../shared/logger/Logger";
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
        this.logger = logger;
        this.logger.debug("middleware", "Created new middleware manager");
    }

    /**
     * Register middleware
     */
    public use(
        handler: MiddlewareFunction,
        config: Partial<MiddlewareConfig> = {}
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
            `Registered middleware: ${middlewareConfig.name} (priority: ${middlewareConfig.priority})`
        );
    }

    /**
     * Execute all middleware in order
     * @returns true if all middleware completed successfully, false if chain was stopped
     */
    public async execute(req: Request, res: Response): Promise<boolean> {
        this.logger.debug(
            "middleware",
            `Executing ${this.middleware.length} middleware functions`
        );

        for (let i = 0; i < this.middleware.length; i++) {
            const entry = this.middleware[i];

            if (!entry.config.enabled) {
                this.logger.debug(
                    "middleware",
                    `Skipping disabled middleware: ${entry.config.name}`
                );
                continue;
            }

            this.logger.debug(
                "middleware",
                `Executing middleware: ${entry.config.name} (${i + 1}/${
                    this.middleware.length
                })`
            );

            try {
                let nextCalled = false;
                let middlewareCompleted = false;

                const next: NextFunction = () => {
                    nextCalled = true;
                };

                // Execute middleware and wait for completion
                const middlewarePromise = new Promise<void>(
                    (resolve, reject) => {
                        try {
                            const result = entry.handler(
                                req,
                                res,
                                (error?: any) => {
                                    nextCalled = true;
                                    if (error) {
                                        reject(error);
                                    } else {
                                        resolve();
                                    }
                                }
                            );

                            // Handle async middleware that returns a promise
                            if (result instanceof Promise) {
                                result
                                    .then(() => {
                                        // If middleware returns a promise but doesn't call next(),
                                        // we consider it completed successfully
                                        if (
                                            !nextCalled &&
                                            !this.isMiddlewareWithNext(
                                                entry.handler
                                            )
                                        ) {
                                            resolve();
                                        }
                                    })
                                    .catch(reject);
                            } else {
                                // For sync middleware that doesn't call next()
                                if (!this.isMiddlewareWithNext(entry.handler)) {
                                    resolve();
                                }
                            }
                        } catch (error) {
                            reject(error);
                        }
                    }
                );

                // Wait for middleware to complete with timeout
                const timeoutPromise = new Promise<void>((_, reject) => {
                    setTimeout(() => {
                        if (!nextCalled && !middlewareCompleted) {
                            reject(
                                new Error(
                                    `Middleware ${entry.config.name} timed out`
                                )
                            );
                        }
                    }, 5000); // 5 second timeout
                });

                try {
                    await Promise.race([middlewarePromise, timeoutPromise]);
                    middlewareCompleted = true;
                } catch (timeoutError) {
                    // Check if middleware expects next parameter
                    const expectsNext = this.isMiddlewareWithNext(
                        entry.handler
                    );

                    this.logger.debug(
                        "middleware",
                        `Middleware ${entry.config.name} analysis: expectsNext=${expectsNext}, nextCalled=${nextCalled}, paramCount=${entry.handler.length}`
                    );

                    // Only stop the chain if middleware expects next() but didn't call it
                    if (expectsNext && !nextCalled) {
                        this.logger.debug(
                            "middleware",
                            `Middleware ${entry.config.name} expects next() but did not call it - stopping chain`
                        );
                        return false; // Return false to indicate chain was stopped
                    }
                }

                this.logger.debug(
                    "middleware",
                    `Middleware ${entry.config.name} completed successfully`
                );

                this.logger.debug(
                    "middleware",
                    `Middleware ${entry.config.name} completed`
                );
            } catch (error) {
                this.logger.error(
                    "middleware",
                    `Error in middleware ${entry.config.name}:`,
                    error
                );
                // Continue with next middleware on error
            }
        }

        this.logger.debug("middleware", `All middleware completed`);
        return true; // Return true to indicate all middleware completed successfully
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
                `${enabled ? "Enabled" : "Disabled"} middleware: ${name}`
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
            `Cleared ${count} middleware functions`
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
}

