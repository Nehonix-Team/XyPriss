import { RequestHandler } from "express";
import {
    UltraFastApp,
    MiddlewareConfiguration,
    MiddlewareInfo,
    MiddlewareStats,
    SecurityMiddlewareOptions,
    CompressionMiddlewareOptions,
    RateLimitMiddlewareOptions,
    CorsMiddlewareOptions,
} from "../../../../types/types";
import { MiddlewareManager } from "./middlewareManager";
import { MiddlewareAPI } from "./MiddlewareAPI";
import { logger } from "../../../utils/Logger";

/**
 * Dependencies for MiddlewareMethodsManager
 */
export interface MiddlewareMethodsManagerDependencies {
    app: UltraFastApp;
    middlewareManager: MiddlewareManager;
}

/**
 * MiddlewareMethodsManager - Adds middleware methods to the UltraFastApp
 * Follows the same pattern as RouteManager for adding methods to the app
 */
export class MiddlewareMethodsManager {
    protected readonly dependencies: MiddlewareMethodsManagerDependencies;

    constructor(dependencies: MiddlewareMethodsManagerDependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Add all middleware methods to the Express app
     */
    public addMiddlewareMethods(): void {
        logger.debug(
            "middleware",
            "Adding middleware methods to UltraFastApp..."
        );

        this.addMiddlewareMethod();

        this.addSecureMiddlewareMethods();
        this.addPerformanceMiddlewareMethods();
        this.addCachedMiddlewareMethods();
        this.addMiddlewareManagementMethods();
        this.addConvenienceMethods();

        logger.debug("middleware", "Middleware methods added successfully");
        logger.debug(
            "middleware",
            "All middleware methods added successfully\n"
        );
    }

    /**
     * Add the main middleware() method that returns MiddlewareAPI
     */
    private addMiddlewareMethod(): void {
        this.dependencies.app.middleware = (
            config?: MiddlewareConfiguration
        ) => {
            const api = new MiddlewareAPI(
                this.dependencies.middlewareManager,
                this.dependencies.app,
                config || {}
            );

            return api;
        };

        // Add a marker to identify this is the real implementation
        (this.dependencies.app.middleware as any).__isRealImplementation = true;
    }

    /**
     * Add secure middleware methods
     */
    private addSecureMiddlewareMethods(): void {
        this.dependencies.app.useSecure = (
            middleware: RequestHandler | RequestHandler[]
        ): UltraFastApp => {
            const middlewareArray = Array.isArray(middleware)
                ? middleware
                : [middleware];

            middlewareArray.forEach((mw, index) => {
                this.dependencies.middlewareManager.register(mw, {
                    name: `secure-middleware-${index}`,
                    priority: "critical",
                    cacheable: false,
                });
            });

            logger.debug(
                "middleware",
                `Registered ${middlewareArray.length} secure middleware`
            );
            return this.dependencies.app;
        };
    }

    /**
     * Add performance middleware methods
     */
    private addPerformanceMiddlewareMethods(): void {
        this.dependencies.app.usePerformance = (
            middleware: RequestHandler | RequestHandler[]
        ): UltraFastApp => {
            const middlewareArray = Array.isArray(middleware)
                ? middleware
                : [middleware];

            middlewareArray.forEach((mw, index) => {
                this.dependencies.middlewareManager.register(mw, {
                    name: `performance-middleware-${index}`,
                    priority: "high",
                    cacheable: true,
                });
            });

            logger.debug(
                "middleware",
                `Registered ${middlewareArray.length} performance middleware`
            );
            return this.dependencies.app;
        };
    }

    /**
     * Add cached middleware methods
     */
    private addCachedMiddlewareMethods(): void {
        this.dependencies.app.useCached = (
            middleware: RequestHandler | RequestHandler[],
            ttl?: number
        ): UltraFastApp => {
            const middlewareArray = Array.isArray(middleware)
                ? middleware
                : [middleware];

            middlewareArray.forEach((mw, index) => {
                this.dependencies.middlewareManager.register(mw, {
                    name: `cached-middleware-${index}`,
                    priority: "normal",
                    cacheable: true,
                    ttl: ttl || 300000, // 5 minutes default
                });
            });

            logger.debug(
                "middleware",
                `Registered ${middlewareArray.length} cached middleware`
            );
            return this.dependencies.app;
        };
    }

    /**
     * Add middleware management methods
     */
    private addMiddlewareManagementMethods(): void {
        // Get middleware information
        this.dependencies.app.getMiddleware = (
            name?: string
        ): MiddlewareInfo | MiddlewareInfo[] => {
            return this.dependencies.middlewareManager.getInfo(name);
        };

        // Remove middleware
        this.dependencies.app.removeMiddleware = (name: string): boolean => {
            try {
                // Find middleware by name and get its ID from the manager's registry
                const middlewareId = this.findMiddlewareIdByName(name);

                if (middlewareId) {
                    const success =
                        this.dependencies.middlewareManager.unregister(
                            middlewareId
                        );
                    if (success) {
                        logger.debug(
                            "middleware",
                            `Middleware removed: ${name} (${middlewareId})`
                        );
                        return true;
                    }
                }

                logger.warn("middleware", `Middleware not found: ${name}`);
                return false;
            } catch (error) {
                logger.error(
                    "middleware",
                    `Failed to remove middleware: ${error}`
                );
                return false;
            }
        };

        // Get middleware statistics
        this.dependencies.app.getMiddlewareStats = (): MiddlewareStats => {
            return this.dependencies.middlewareManager.getStats();
        };
    }

    /**
     * Find middleware ID by name from the manager's registry
     * This method accesses the internal registry to get the ID
     */
    private findMiddlewareIdByName(name: string): string | null {
        try {
            // Access the middleware manager's internal registry
            // Since we need to access private members, we'll use a workaround
            const manager = this.dependencies.middlewareManager as any;

            if (
                manager.middlewareRegistry &&
                manager.middlewareRegistry instanceof Map
            ) {
                // Iterate through the registry to find middleware by name
                for (const [
                    id,
                    entry,
                ] of manager.middlewareRegistry.entries()) {
                    if (entry.name === name) {
                        return id;
                    }
                }
            }

            // Alternative approach: try to use reflection to access the registry
            const registryKeys = Object.getOwnPropertyNames(manager);
            for (const key of registryKeys) {
                if (key.includes("registry") || key.includes("Registry")) {
                    const registry = manager[key];
                    if (registry instanceof Map) {
                        for (const [id, entry] of registry.entries()) {
                            if (
                                entry &&
                                typeof entry === "object" &&
                                entry.name === name
                            ) {
                                return id;
                            }
                        }
                    }
                }
            }

            logger.warn(
                "middleware",
                `Could not find ID for middleware: ${name}`
            );
            return null;
        } catch (error) {
            logger.error("middleware", `Error finding middleware ID: ${error}`);
            return null;
        }
    }

    /**
     * Add convenience methods for common middleware types
     */
    private addConvenienceMethods(): void {
        // Enable security middleware
        this.dependencies.app.enableSecurity = (
            options?: SecurityMiddlewareOptions
        ): UltraFastApp => {
            this.dependencies.middlewareManager.enableSecurity(options);
            logger.debug(
                "middleware",
                "Security middleware enabled via convenience method"
            );
            return this.dependencies.app;
        };

        // Enable compression middleware
        this.dependencies.app.enableCompression = (
            options?: CompressionMiddlewareOptions
        ): UltraFastApp => {
            this.dependencies.middlewareManager.enableCompression(options);
            logger.debug(
                "middleware",
                "Compression middleware enabled via convenience method"
            );
            return this.dependencies.app;
        };

        // Enable rate limiting middleware
        this.dependencies.app.enableRateLimit = (
            options?: RateLimitMiddlewareOptions
        ): UltraFastApp => {
            this.dependencies.middlewareManager.enableRateLimit(options);
            logger.debug(
                "middleware",
                "Rate limiting middleware enabled via convenience method"
            );
            return this.dependencies.app;
        };

        // Enable CORS middleware
        this.dependencies.app.enableCors = (
            options?: CorsMiddlewareOptions
        ): UltraFastApp => {
            this.dependencies.middlewareManager.enableCors(options);
            logger.debug(
                "middleware",
                "CORS middleware enabled via convenience method"
            );
            return this.dependencies.app;
        };
    }
}

