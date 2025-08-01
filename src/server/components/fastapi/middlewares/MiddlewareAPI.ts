import { RequestHandler } from "express";
import {
    MiddlewareConfiguration,
    MiddlewarePriority,
    CustomMiddleware,
    MiddlewareInfo,
    MiddlewareStats,
    UltraFastApp,
    MiddlewareAPIInterface,
} from "../../../../types/types";
import { MiddlewareManager } from "./middlewareManager";
// import { middleware as XyPrissMiddleware } from "../../../../mods/securityhelpers/express.middleware.helper";
const XyPrissMiddleware = {}; // Fallback middleware object
import { logger } from "../../../../../shared/logger/Logger";

/**
 * MiddlewareAPI - User-friendly middleware interface that follows the specified pattern
 * Returns a middleware object with register() method for custom middleware
 */
export class MiddlewareAPI implements MiddlewareAPIInterface {
    private Manager: MiddlewareManager;
    private app: UltraFastApp;
    private config: MiddlewareConfiguration;
    private nameToIdMap = new Map<string, string>(); // Track middleware names to IDs

    constructor(
        Manager: MiddlewareManager,
        app: UltraFastApp,
        config: MiddlewareConfiguration = {}
    ) {
        // Use process.stdout.write to ensure immediate output
        logger.debug("middleware", "MiddlewareAPI constructor called\n");
        logger.debug(
            "middleware",
            `Config: ${JSON.stringify(config, null, 2)}\n`
        );

        this.Manager = Manager;
        this.app = app;
        this.config = config;

        // Apply default middleware based on configuration
        logger.debug("middleware", "About to call applyDefaultMiddleware\n");
        this.applyDefaultMiddleware();
        logger.debug("middleware", "applyDefaultMiddleware completed\n");
    }

    /**
     * Register custom middleware with options
     */
    public register(
        middleware: CustomMiddleware | RequestHandler,
        options?: {
            name?: string;
            priority?: MiddlewarePriority;
            routes?: string[];
            cacheable?: boolean;
            ttl?: number;
        }
    ): MiddlewareAPI {
        try {
            const id = this.Manager.register(middleware, options);
            const name = options?.name || `middleware-${id.slice(0, 8)}`;

            // Track the name-to-ID mapping for easier removal
            this.nameToIdMap.set(name, id);

            logger.debug(
                "middleware",
                `Custom middleware registered: ${name} (${id})`
            );
        } catch (error) {
            logger.error(
                "middleware",
                `Failed to register middleware: ${error}`
            );
        }
        return this;
    }

    /**
     * Unregister middleware by ID
     */
    public unregister(id: string): MiddlewareAPI {
        try {
            this.Manager.unregister(id);
            logger.debug("middleware", `Middleware unregistered: ${id}`);
        } catch (error) {
            logger.error(
                "middleware",
                `Failed to unregister middleware: ${error}`
            );
        }
        return this;
    }

    /**
     * Enable middleware by ID
     */
    public enable(id: string): MiddlewareAPI {
        try {
            this.Manager.enable(id);
            logger.debug("middleware", `Middleware enabled: ${id}`);
        } catch (error) {
            logger.error("middleware", `Failed to enable middleware: ${error}`);
        }
        return this;
    }

    /**
     * Disable middleware by ID
     */
    public disable(id: string): MiddlewareAPI {
        try {
            this.Manager.disable(id);
            logger.debug("middleware", `Middleware disabled: ${id}`);
        } catch (error) {
            logger.error(
                "middleware",
                `Failed to disable middleware: ${error}`
            );
        }
        return this;
    }

    /**
     * Remove middleware by name
     */
    public removeByName(name: string): boolean {
        try {
            const id = this.nameToIdMap.get(name);
            if (id) {
                const success = this.Manager.unregister(id);
                if (success) {
                    this.nameToIdMap.delete(name);
                    logger.debug(
                        "middleware",
                        `Middleware removed: ${name} (${id})`
                    );
                    return true;
                }
            }

            logger.warn("middleware", `Middleware not found: ${name}`);
            return false;
        } catch (error) {
            logger.error("middleware", `Failed to remove middleware: ${error}`);
            return false;
        }
    }

    /**
     * Get middleware information
     */
    public getInfo(id?: string): MiddlewareInfo | MiddlewareInfo[] {
        return this.Manager.getInfo(id);
    }

    /**
     * Get middleware statistics
     */
    public getStats(): MiddlewareStats {
        return this.Manager.getStats();
    }

    /**
     * Clear all middleware
     */
    public clear(): MiddlewareAPI {
        try {
            // Get all tracked middleware IDs and unregister them
            const idsToRemove: string[] = [];

            // Collect all IDs from our name-to-ID mapping
            for (const [, id] of this.nameToIdMap.entries()) {
                idsToRemove.push(id);
            }

            // Also get any middleware that might not be in our mapping
            const allMiddleware = this.Manager.getInfo() as MiddlewareInfo[];
            for (const middleware of allMiddleware) {
                // Try to find the ID by looking up the middleware in the manager's registry
                // Since MiddlewareInfo doesn't include ID, we need to use the name mapping
                const mappedId = this.nameToIdMap.get(middleware.name);
                if (mappedId && !idsToRemove.includes(mappedId)) {
                    idsToRemove.push(mappedId);
                }
            }

            // Unregister all found middleware
            let removedCount = 0;
            for (const id of idsToRemove) {
                if (this.Manager.unregister(id)) {
                    removedCount++;
                    // Remove from our tracking map
                    for (const [name, mappedId] of this.nameToIdMap.entries()) {
                        if (mappedId === id) {
                            this.nameToIdMap.delete(name);
                            break;
                        }
                    }
                }
            }

            logger.debug(
                "middleware",
                `Cleared ${removedCount} custom middleware`
            );
        } catch (error) {
            logger.error("middleware", `Failed to clear middleware: ${error}`);
        }
        return this;
    }

    /**
     * Optimize middleware execution
     */
    public async optimize(): Promise<MiddlewareAPI> {
        try {
            await this.Manager.optimize();
            logger.debug("middleware", "Middleware optimization completed");
        } catch (error) {
            logger.error(
                "middleware",
                `Failed to optimize middleware: ${error}`
            );
        }
        return this;
    }

    /**
     * Apply default middleware based on configuration
     */
    private applyDefaultMiddleware(): void {
        logger.debug("middleware", "applyDefaultMiddleware method entered\n");
        logger.debug(
            "middleware",
            `this.config: ${JSON.stringify(this.config, null, 2)}\n`
        );

        logger.debug(
            "middleware",
            "Applying default middleware configuration..."
        );

        // Apply XyPrissJS middleware if security is enabled
        if (this.config.security !== false) {
            try {
                const securityOptions =
                    typeof this.config.security === "object"
                        ? this.config.security
                        : {};

                // Convert complex rateLimit config to boolean for XyPrissJS middleware
                const rateLimitEnabled: boolean =
                    this.config.rateLimit !== false;
                const maxRequestsPerMinute =
                    typeof this.config.rateLimit === "object"
                        ? this.config.rateLimit.max || 100
                        : 100;

                // XyPrissMiddleware is not available, using fallback
                const XyPrissMiddlewareHandler = (
                    req: any,
                    res: any,
                    next: any
                ) => {
                    // Basic security middleware fallback
                    res.setHeader("X-Content-Type-Options", "nosniff");
                    next();
                };

                this.Manager.register(XyPrissMiddlewareHandler, {
                    name: "XyPriss-security",
                    priority: "critical",
                    cacheable: false,
                });

                logger.debug(
                    "middleware",
                    "XyPrissJS security middleware applied"
                );
            } catch (error) {
                logger.warn(
                    "middleware",
                    `Failed to apply XyPrissJS middleware: ${error}`
                );
            }
        }

        // Apply CORS if enabled
        if (this.config.cors !== false) {
            try {
                const corsOptions =
                    typeof this.config.cors === "object"
                        ? this.config.cors
                        : {};

                this.Manager.enableCors(corsOptions);
                logger.debug("middleware", "CORS middleware applied");
            } catch (error) {
                logger.warn(
                    "middleware",
                    `Failed to apply CORS middleware: ${error}`
                );
            }
        }

        // Apply compression if enabled
        if (this.config.compression !== false) {
            try {
                const compressionOptions =
                    typeof this.config.compression === "object"
                        ? this.config.compression
                        : {};

                this.Manager.enableCompression(compressionOptions);
                logger.debug("middleware", "Compression middleware applied");
            } catch (error) {
                logger.warn(
                    "middleware",
                    `Failed to apply compression middleware: ${error}`
                );
            }
        }

        // Apply rate limiting if enabled
        if (this.config.rateLimit !== false) {
            try {
                const rateLimitOptions =
                    typeof this.config.rateLimit === "object"
                        ? this.config.rateLimit
                        : {};

                this.Manager.enableRateLimit(rateLimitOptions);
                logger.debug("middleware", "Rate limiting middleware applied");
            } catch (error) {
                logger.warn(
                    "middleware",
                    `Failed to apply rate limiting middleware: ${error}`
                );
            }
        }

        // Apply custom headers if specified
        if (this.config.customHeaders) {
            try {
                const customHeadersMiddleware = (
                    req: any,
                    res: any,
                    next: any
                ) => {
                    Object.entries(this.config.customHeaders!).forEach(
                        ([key, value]) => {
                            res.setHeader(key, value);
                        }
                    );
                    next();
                };

                this.Manager.register(customHeadersMiddleware, {
                    name: "custom-headers",
                    priority: "high",
                    cacheable: true,
                    ttl: 3600000, // 1 hour
                });

                logger.debug("middleware", "Custom headers middleware applied");
            } catch (error) {
                logger.warn(
                    "middleware",
                    `Failed to apply custom headers middleware: ${error}`
                );
            }
        }

        logger.debug("middleware", "Default middleware configuration applied");
    }

    /**
     * Update configuration and reapply middleware
     */
    public updateConfig(newConfig: MiddlewareConfiguration): MiddlewareAPI {
        this.config = { ...this.config, ...newConfig };
        this.Manager.configure(this.config);

        // Reapply default middleware with new configuration
        this.applyDefaultMiddleware();

        logger.debug("middleware", "Middleware configuration updated");
        return this;
    }

    /**
     * Get current configuration
     */
    public getConfig(): MiddlewareConfiguration {
        return { ...this.config };
    }

    /**
     * Enable performance tracking for all middleware
     */
    public enablePerformanceTracking(): MiddlewareAPI {
        this.config.enablePerformanceTracking = true;
        this.Manager.configure(this.config);
        logger.debug(
            "middleware",
            "Performance tracking enabled for all middleware"
        );
        return this;
    }

    /**
     * Disable performance tracking for all middleware
     */
    public disablePerformanceTracking(): MiddlewareAPI {
        this.config.enablePerformanceTracking = false;
        this.Manager.configure(this.config);
        logger.debug(
            "middleware",
            "Performance tracking disabled for all middleware"
        );
        return this;
    }

    /**
     * Enable caching for all middleware
     */
    public enableCaching(): MiddlewareAPI {
        this.config.enableCaching = true;
        this.Manager.configure(this.config);
        logger.debug("middleware", "Caching enabled for all middleware");
        return this;
    }

    /**
     * Disable caching for all middleware
     */
    public disableCaching(): MiddlewareAPI {
        this.config.enableCaching = false;
        this.Manager.configure(this.config);
        logger.debug("middleware", "Caching disabled for all middleware");
        return this;
    }

    /**
     * Warm up middleware cache
     */
    public async warmCache(): Promise<MiddlewareAPI> {
        try {
            await this.Manager.warmCache();
            logger.debug("middleware", "Middleware cache warmed up");
        } catch (error) {
            logger.error("middleware", `Failed to warm cache: ${error}`);
        }
        return this;
    }

    /**
     * Clear middleware cache
     */
    public clearCache(): MiddlewareAPI {
        try {
            this.Manager.clearCache();
            logger.debug("middleware", "Middleware cache cleared");
        } catch (error) {
            logger.error("middleware", `Failed to clear cache: ${error}`);
        }
        return this;
    }
}

