import { RouteOptions } from "../../../types/types";
import { RouteManagerDependencies } from "../../../types/components/RouteM.type";
import { logger } from "../../../shared/logger/Logger";

/**
 * RouteManager - Handles all route-related operations for FastApi.ts
 * Manages HTTP methods with caching, route templates, and optimization
 */
export class RouteManager {
    protected readonly dependencies: RouteManagerDependencies;

    constructor(dependencies: RouteManagerDependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Add all HTTP methods with caching support to the XyPriss app
     */
    public addMethods(): void {
        logger.debug("routes", "Adding HTTP methods with caching support...");
        this.addCacheManagementMethods();

        // logger.debug( "routes","HTTP methods added successfully");
    }

    /**
     * Add cache management methods to the app
     */
    private addCacheManagementMethods(): void {
        // Cache invalidation method
        this.dependencies.app.invalidateCache = async (pattern: string) => {
            await this.dependencies.cacheManager.invalidateCache(pattern);
        };

        // Cache statistics method
        this.dependencies.app.getCacheStats = async () => {
            return await this.dependencies.cacheManager.getCacheStats();
        };

        // Cache warm-up method
        this.dependencies.app.warmUpCache = async (
            data: Array<{ key: string; value: any; ttl?: number }>,
        ) => {
            await this.dependencies.cacheManager.warmUpCache(data);
        };
    }

    /**
     * Setup default optimized routes for common endpoints
     */
    public setupDefaultOptimizedRoutes(): void {
        // No-op - delegated to engine
    }

    /**
     * Register custom route templates from configuration
     */
    public registerCustomRouteTemplates(routeTemplates: any[]): void {
        // No-op - delegated to engine
    }

    /**
     * Get route statistics and information
     */
    public getRouteStats() {
        return {
            totalRoutes:
                (this.dependencies.app as any)._router?.stack?.length || 0,
            cacheEnabled: true,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Validate route configuration
     */
    public validateRouteConfig(path: string, options: RouteOptions): boolean {
        try {
            // Basic path validation
            if (!path || typeof path !== "string") {
                console.warn(`Invalid route path: ${path}`);
                return false;
            }

            // Cache configuration validation
            if (options.cache) {
                if (
                    options.cache.ttl &&
                    (typeof options.cache.ttl !== "number" ||
                        options.cache.ttl < 0)
                ) {
                    console.warn(
                        `Invalid cache TTL for route ${path}: ${options.cache.ttl}`,
                    );
                    return false;
                }

                if (options.cache.tags && !Array.isArray(options.cache.tags)) {
                    console.warn(
                        `Invalid cache tags for route ${path}: must be an array`,
                    );
                    return false;
                }
            }

            // Security configuration validation
            if (options.security) {
                if (
                    options.security.roles &&
                    !Array.isArray(options.security.roles)
                ) {
                    console.warn(
                        `Invalid security roles for route ${path}: must be an array`,
                    );
                    return false;
                }
            }

            return true;
        } catch (error: any) {
            console.warn(`Route validation failed for ${path}:`, error.message);
            return false;
        }
    }

    /**
     * Get route middleware chain information
     */
    public getRouteMiddleware(path: string): any[] {
        try {
            const router = (this.dependencies.app as any)._router;
            if (!router || !router.stack) return [];

            const middlewareStack = router.stack
                .filter((layer: any) => layer.route?.path === path)
                .map((layer: any) => ({
                    name: layer.name || "anonymous",
                    path: layer.route?.path,
                    methods: layer.route?.methods,
                }));

            return middlewareStack;
        } catch (error: any) {
            console.warn(
                `Failed to get middleware for route ${path}:`,
                error.message,
            );
            return [];
        }
    }
}

