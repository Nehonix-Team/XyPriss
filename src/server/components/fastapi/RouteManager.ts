import { RequestHandler } from "express";
import { RouteOptions } from "../../../types/types";
import { OptimizedRoute } from "../../../types/UFOptimizer.type";
import { RouteManagerDependencies } from "../../../types/components/RouteM.type";
import { logger } from "../../../../shared/logger/Logger";

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
     * Add all HTTP methods with caching support to the Express app
     */
    public addMethods(): void {
        logger.debug("routes", "Adding HTTP methods with caching support...");
        this.addCacheManagementMethods();
        this.addPerformanceOptimizationMethods();
        this.addUltraFastOptimizerMethods();

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
            data: Array<{ key: string; value: any; ttl?: number }>
        ) => {
            await this.dependencies.cacheManager.warmUpCache(data);
        };
    }

    /**
     * Add performance optimization methods to the app
     */
    private addPerformanceOptimizationMethods(): void {
        // Performance optimization methods will be added by PerformanceManager
        // This is a placeholder for future expansion
    }

    /**
     * Add UltraFastOptimizer methods to the app
     */
    private addUltraFastOptimizerMethods(): void {
        // Route template registration
        this.dependencies.app.registerRouteTemplate = (
            template: OptimizedRoute
        ) => {
            this.dependencies.ultraFastOptimizer?.registerRoute(template);
        };

        // Route template unregistration
        this.dependencies.app.unregisterRouteTemplate = (
            route: string | RegExp,
            method?: string
        ) => {
            if (this.dependencies.ultraFastOptimizer) {
                const pattern = route instanceof RegExp ? route : route;
                this.dependencies.ultraFastOptimizer.unregisterRoute(pattern);
            }
        };

        // Optimization pattern registration
        this.dependencies.app.registerOptimizationPattern = (
            pattern: OptimizedRoute
        ) => {
            this.dependencies.ultraFastOptimizer?.registerRoute(pattern);
        };

        // Optimizer statistics
        this.dependencies.app.getOptimizerStats = () => {
            return this.dependencies.ultraFastOptimizer?.getStats() || null;
        };
    }

    /**
     * Setup default optimized routes for common endpoints
     */
    public setupDefaultOptimizedRoutes(): void {
        if (!this.dependencies.ultraFastOptimizer) return;

        logger.debug("routes", "Setting up default optimized routes...");

        // Import QuickRoutes for default route templates
        try {
            const {
                QuickRoutes,
            } = require("../../optimization/UltraFastOptimizer");

            // Register common health/status routes
            this.dependencies.ultraFastOptimizer.registerRoute(
                QuickRoutes.healthCheck
            );
            this.dependencies.ultraFastOptimizer.registerRoute(
                QuickRoutes.apiStatus
            );

            logger.debug("routes", "Default optimized routes configured");
        } catch (error: any) {
            console.warn(
                "Failed to setup default optimized routes:",
                error.message
            );
        }
    }

    /**
     * Register custom route templates from configuration
     */
    public registerCustomRouteTemplates(routeTemplates: any[]): void {
        if (!this.dependencies.ultraFastOptimizer || !routeTemplates) return;

        logger.debug("routes", "Registering custom route templates...");

        try {
            // Convert RouteTemplate to OptimizedRoute format
            for (const template of routeTemplates) {
                const optimizedRoute: OptimizedRoute = {
                    pattern: template.route,
                    methods: template.method ? [template.method] : undefined,
                    handler: template.generator,
                    schema: template.schema,
                    cacheTTL: template.cacheTTL,
                    priority: template.priority,
                };
                this.dependencies.ultraFastOptimizer.registerRoute(
                    optimizedRoute
                );
            }

            logger.debug(
                "routes",
                `Registered ${routeTemplates.length} custom route templates`
            );
        } catch (error: any) {
            console.warn(
                "Failed to register custom route templates:",
                error.message
            );
        }
    }

    /**
     * Get route statistics and information
     */
    public getRouteStats() {
        return {
            totalRoutes:
                (this.dependencies.app as any)._router?.stack?.length || 0,
            summary: this.dependencies.ultraFastOptimizer?.getStats(),
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
                        `Invalid cache TTL for route ${path}: ${options.cache.ttl}`
                    );
                    return false;
                }

                if (options.cache.tags && !Array.isArray(options.cache.tags)) {
                    console.warn(
                        `Invalid cache tags for route ${path}: must be an array`
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
                        `Invalid security roles for route ${path}: must be an array`
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
                error.message
            );
            return [];
        }
    }
}

