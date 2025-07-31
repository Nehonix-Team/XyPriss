/**
 * Ultra-Fast Express Route Optimizer
 *
 * Handles both sync and async routes with intelligent caching and optimization
 * Users can register route patterns for automatic optimization
 */

import { Request, Response, NextFunction } from "express";
import stringify from "fast-json-stringify";
import { CacheEntry, OptimizedRoute, OptimizerConfig, RoutePattern } from "../../types/UFOptimizer.type";

export class UltraFastExpressOptimizer {
    private routes: OptimizedRoute[] = [];
    private cache = new Map<string, CacheEntry>();
    private stringifiers = new Map<string, any>();
    private config: Required<OptimizerConfig>;

    // Performance tracking
    private stats = {
        totalRequests: 0,
        cacheHits: 0,
        optimizedHits: 0,
        avgResponseTime: 0,
        routeMatches: 0,
        errors: 0,
        memoryUsage: 0,
    };

    private cleanupInterval?: NodeJS.Timeout;
    private monitoringInterval?: NodeJS.Timeout;

    constructor(config: OptimizerConfig = {}) {
        this.config = {
            cache: {
                enabled: true,
                defaultTTL: 300000, // 5 minutes
                maxSize: 10000,
                cleanupInterval: 60000, // 1 minute
                maxMemoryMB: 100,
                ...config.cache,
            },
            performance: {
                enablePrecompilation: true,
                asyncTimeout: 5000,
                maxConcurrentRequests: 1000,
                ...config.performance,
            },
            monitoring: {
                enabled: true,
                logInterval: 30000, // 30 seconds
                ...config.monitoring,
            },
        };

        this.startCleanupInterval();
        this.startMonitoring();
    }

    /**
     * Register a route pattern for optimization
     * Examples:
     * - "api/*"
     * - "/users/*"
    /*"
     * - /^\/api\/v\d+\/.*$/ (regex)
     */
    public registerRoute(route: OptimizedRoute): void {
        // Validate route
        if (!route.pattern) {
            throw new Error("Route pattern is required");
        }

        // Add to routes and sort by priority
        this.routes.push(route);
        this.routes.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        // Create fast stringifier if schema provided
        if (route.schema) {
            const key = this.getRouteKey(route.pattern);
            this.stringifiers.set(key, stringify(route.schema));
        }

        console.log(`Registered optimized route: ${route.pattern}`);
    }

    /**
     * Register multiple routes at once
     */
    public registerRoutes(routes: OptimizedRoute[]): void {
        routes.forEach((route) => this.registerRoute(route));
    }

    /**
     * Unregister a route pattern
     */
    public unregisterRoute(pattern: RoutePattern): void {
        const key = this.getRouteKey(pattern);
        this.routes = this.routes.filter(
            (r) => this.getRouteKey(r.pattern) !== key
        );
        this.stringifiers.delete(key);

        // Clear related cache entries
        for (const [cacheKey] of this.cache) {
            if (cacheKey.includes(key)) {
                this.cache.delete(cacheKey);
            }
        }
    }

    /**
     * Main middleware function - handles incoming requests
     */
    public middleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            const startTime = process.hrtime.bigint();
            this.stats.totalRequests++;

            try {
                // Find matching route
                const matchedRoute = this.findMatchingRoute(req);

                if (!matchedRoute) {
                    // No optimization available, continue to next middleware
                    return next();
                }

                this.stats.routeMatches++;

                // Try cache first (if enabled)
                if (
                    this.config.cache.enabled &&
                    matchedRoute.enableCache !== false
                ) {
                    const cached = this.getCachedResponse(req, matchedRoute);
                    if (cached) {
                        this.sendCachedResponse(res, cached, startTime);
                        this.stats.cacheHits++;
                        return;
                    }
                }

                // Execute route handler
                if (matchedRoute.handler) {
                    await this.executeOptimizedHandler(
                        req,
                        res,
                        matchedRoute,
                        startTime
                    );
                    this.stats.optimizedHits++;
                } else {
                    // No handler, continue to next middleware
                    next();
                }
            } catch (error) {
                this.stats.errors++;
                console.error("Ultra-Fast Optimizer Error:", error);

                // Don't break the request, continue to next middleware
                next();
            }
        };
    }

    /**
     * Find the best matching route for the request
     */
    private findMatchingRoute(req: Request): OptimizedRoute | null {
        const path = req.path;
        const method = req.method;

        for (const route of this.routes) {
            // Check method match
            if (route.methods && route.methods.length > 0) {
                const methodMatch =
                    route.methods.includes("*") ||
                    route.methods.includes(method);
                if (!methodMatch) continue;
            }

            // Check pattern match
            if (this.matchesPattern(path, route.pattern)) {
                return route;
            }
        }

        return null;
    }

    /**
     * Check if path matches pattern (supports wildcards and regex)
     */
    private matchesPattern(path: string, pattern: RoutePattern): boolean {
        if (pattern instanceof RegExp) {
            return pattern.test(path);
        }

        // Convert wildcard pattern to regex
        const regexPattern = pattern
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".")
            .replace(/\//g, "\\/");

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(path);
    }

    /**
     * Execute optimized handler (handles both sync and async)
     */
    private async executeOptimizedHandler(
        req: Request,
        res: Response,
        route: OptimizedRoute,
        startTime: bigint
    ): Promise<void> {
        try {
            const handler = route.handler!;
            let result: any;

            // Handle both sync and async functions
            const handlerResult = handler(req, res);

            if (handlerResult instanceof Promise) {
                // Async handler with timeout
                result = await Promise.race([
                    handlerResult,
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Handler timeout")),
                            this.config.performance.asyncTimeout
                        )
                    ),
                ]);
            } else {
                // Sync handler
                result = handlerResult;
            }

            // If handler already sent response, don't interfere
            if (res.headersSent) {
                return;
            }

            // Send optimized response
            this.sendOptimizedResponse(res, result, route, req, startTime);
        } catch (error) {
            console.error("Handler execution error:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    error: "Internal server error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
        }
    }

    /**
     * Send optimized response with caching
     */
    private sendOptimizedResponse(
        res: Response,
        data: any,
        route: OptimizedRoute,
        req: Request,
        startTime: bigint
    ): void {
        const routeKey = this.getRouteKey(route.pattern);
        const stringifier = this.stringifiers.get(routeKey);

        // Stringify with fast-json-stringify if available, otherwise use JSON.stringify
        const jsonString = stringifier
            ? stringifier(data)
            : JSON.stringify(data);
        const buffer = Buffer.from(jsonString, "utf8");

        // Cache the response if caching is enabled
        if (this.config.cache.enabled && route.enableCache !== false) {
            const cacheKey = this.getCacheKey(req, route);
            const ttl =
                route.cacheTTL || this.config.cache.defaultTTL || 300000; // Default 5 minutes

            this.cache.set(cacheKey, {
                data: buffer,
                expires: Date.now() + ttl,
                hits: 0,
                lastAccessed: Date.now(),
            });
        }

        // Send response with performance headers
        const responseTime =
            Number(process.hrtime.bigint() - startTime) / 1000000;

        res.set({
            "Content-Type": "application/json",
            "Content-Length": buffer.length.toString(),
            "X-Response-Time": `${responseTime.toFixed(2)}ms`,
            "X-Cache": "OPTIMIZED",
            "X-Optimizer": "ultra-fast",
        });

        res.status(200).end(buffer);
    }

    /**
     * Get cached response if available and valid
     */
    private getCachedResponse(
        req: Request,
        route: OptimizedRoute
    ): CacheEntry | null {
        const cacheKey = this.getCacheKey(req, route);
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() < cached.expires) {
            cached.hits++;
            cached.lastAccessed = Date.now();
            return cached;
        }

        if (cached) {
            this.cache.delete(cacheKey);
        }

        return null;
    }

    /**
     * Send cached response
     */
    private sendCachedResponse(
        res: Response,
        cached: CacheEntry,
        startTime: bigint
    ): void {
        const responseTime =
            Number(process.hrtime.bigint() - startTime) / 1000000;

        res.set({
            "Content-Type": "application/json",
            "Content-Length": cached.data.length.toString(),
            "X-Response-Time": `${responseTime.toFixed(2)}ms`,
            "X-Cache": "HIT",
            "X-Cache-Hits": cached.hits.toString(),
            "X-Optimizer": "ultra-fast",
        });

        res.status(200).end(cached.data);
    }

    /**
     * Generate cache key for request
     */
    private getCacheKey(req: Request, route: OptimizedRoute): string {
        const routeKey = this.getRouteKey(route.pattern);
        const queryString = new URLSearchParams(req.query as any).toString();
        return `${routeKey}:${req.method}:${req.path}:${queryString}`;
    }

    /**
     * Generate route key for internal tracking
     */
    private getRouteKey(pattern: RoutePattern): string {
        return pattern instanceof RegExp ? pattern.source : pattern.toString();
    }

    /**
     * Start cache cleanup interval
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, this.config.cache.cleanupInterval);
    }

    /**
     * Clean up expired cache entries and manage memory
     */
    private cleanupCache(): void {
        const now = Date.now();
        let memoryUsed = 0;
        const entries = Array.from(this.cache.entries());

        // Remove expired entries
        for (const [key, entry] of entries) {
            if (now > entry.expires) {
                this.cache.delete(key);
            } else {
                memoryUsed += entry.data.length;
            }
        }

        // Memory management - remove least recently used entries if over limit
        const maxMemoryBytes =
            (this.config.cache.maxMemoryMB || 100) * 1024 * 1024;
        if (memoryUsed > maxMemoryBytes) {
            const sortedEntries = Array.from(this.cache.entries()).sort(
                ([, a], [, b]) => a.lastAccessed - b.lastAccessed
            );

            while (memoryUsed > maxMemoryBytes && sortedEntries.length > 0) {
                const [key, entry] = sortedEntries.shift()!;
                this.cache.delete(key);
                memoryUsed -= entry.data.length;
            }
        }

        this.stats.memoryUsage = memoryUsed;
    }

    /**
     * Start performance monitoring
     */
    private startMonitoring(): void {
        if (!this.config.monitoring.enabled) return;

        this.monitoringInterval = setInterval(() => {
            const stats = this.getStats();

            if (this.config.monitoring.onStats) {
                this.config.monitoring.onStats(stats);
            }
        }, this.config.monitoring.logInterval);

        /**
         *    console.log(`       Ultra-Fast Optimizer Stats:
        Requests: ${stats.totalRequests} (${stats.optimizedRate.toFixed(
                1
            )}% optimized)
        Cache: ${stats.cacheHitRate.toFixed(1)}% hit rate (${
                stats.cacheSize
            } entries)
        Routes: ${stats.routeMatches} matches
        Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB
       Avg Response: ${stats.avgResponseTime.toFixed(2)}ms`);
         */
    }

    /**
     * Get comprehensive performance statistics
     */
    public getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            routesRegistered: this.routes.length,
            cacheHitRate:
                this.stats.totalRequests > 0
                    ? (this.stats.cacheHits / this.stats.totalRequests) * 100
                    : 0,
            optimizedRate:
                this.stats.totalRequests > 0
                    ? (this.stats.optimizedHits / this.stats.totalRequests) *
                      100
                    : 0,
            errorRate:
                this.stats.totalRequests > 0
                    ? (this.stats.errors / this.stats.totalRequests) * 100
                    : 0,
        };
    }

    /**
     * Clear all caches and reset
     */
    public reset(): void {
        this.cache.clear();
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            optimizedHits: 0,
            avgResponseTime: 0,
            routeMatches: 0,
            errors: 0,
            memoryUsage: 0,
        };
    }

    /**
     * Cleanup and stop intervals
     */
    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.cache.clear();
    }
}

// Usage example and helper functions
export function createOptimizer(
    config?: OptimizerConfig
): UltraFastExpressOptimizer {
    return new UltraFastExpressOptimizer(config);
}

// Common route patterns
export const CommonPatterns = {
    API: "api/*",
    USERS: "/users/*",
    PRODUCTS: "*/product/*",
    ADMIN: "/admin/*",
    STATIC: "/static/*",
    V1_API: "/api/v1/*",
    V2_API: "/api/v2/*",
};

// Pre-configured optimized routes for common scenarios
export const QuickRoutes = {
    healthCheck: {
        pattern: "/health",
        methods: ["GET"],
        handler: () => ({ status: "ok", timestamp: Date.now() }),
        cacheTTL: 5000,
        schema: {
            type: "object",
            properties: {
                status: { type: "string" },
                timestamp: { type: "number" },
            },
        },
    },

    apiStatus: {
        pattern: "/api/status",
        methods: ["GET"],
        handler: () => ({
            api: "running",
            version: "1.0.0",
            uptime: process.uptime(),
        }),
        cacheTTL: 10000,
    },
};

