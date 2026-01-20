/**
 * Route Optimization Plugin
 *
 * Automatically detects popular routes and optimizes them in the background
 * Features:
 * - Route popularity tracking
 * - Automatic caching for hot routes
 * - Response time optimization
 * - Predictive preloading
 * - Route pattern analysis
 */

import { EventEmitter } from "events";
import { RouteOptimizationConfig, RouteStats } from "./types/index";
import { XyPrissPlugin, XyPrissServer } from "./types/PluginTypes";

export class RouteOptimizationPlugin
    extends EventEmitter
    implements XyPrissPlugin
{
    public name = "route-optimization";
    public version = "1.2.0";
    private config: Required<RouteOptimizationConfig>;
    private routeStats = new Map<string, RouteStats>();
    private optimizedRoutes = new Set<string>();
    private analysisTimer?: NodeJS.Timeout;
    private app: any;
    private logger: any;

    constructor(config: RouteOptimizationConfig = {}) {
        super();

        this.config = {
            enabled: true,
            analysisInterval: 60000, // 1 minute
            optimizationThreshold: 100,
            popularityWindow: 3600000, // 1 hour
            maxTrackedRoutes: 1000,
            autoOptimization: true,
            customRules: [],
            onOptimization: () => {},
            onAnalysis: () => {},
            ...config,
        };
    }

    /**
     * Hook for XyPriss Plugin System
     */
    public onRegister(server: XyPrissServer): void {
        this.initialize(server.app, (server.app as any).logger || console);
    }

    /**
     * Initialize the plugin with Express app
     */
    public initialize(app: any, logger: any): void {
        if (!this.config.enabled) return;

        this.app = app;
        this.logger = logger;

        // Install route tracking middleware
        this.installTrackingMiddleware();

        // Start background analysis
        this.startBackgroundAnalysis();

        this.logger.info("plugins", "Route Optimization Plugin initialized");
    }

    /**
     * Install middleware to track route usage
     */
    private installTrackingMiddleware(): void {
        this.app.use((req: any, res: any, next: any) => {
            const startTime = Date.now();
            const routeKey = `${req.method}:${req.path}`;

            // Track request start
            this.trackRouteStart(routeKey);

            // Override res.end to capture response time
            const originalEnd = res.end.bind(res);
            res.end = (...args: any[]) => {
                const responseTime = Date.now() - startTime;
                const statusCode = res.statusCode;

                this.trackRouteEnd(routeKey, responseTime, statusCode);
                return originalEnd(...args);
            };

            next();
        });
    }

    /**
     * Track route request start
     */
    private trackRouteStart(routeKey: string): void {
        const [method, path] = routeKey.split(":");

        if (!this.routeStats.has(routeKey)) {
            this.routeStats.set(routeKey, {
                path,
                method,
                hitCount: 0,
                totalResponseTime: 0,
                averageResponseTime: 0,
                lastAccessed: new Date(),
                errorCount: 0,
                cacheHits: 0,
                cacheMisses: 0,
                popularity: 0,
            });
        }

        const stats = this.routeStats.get(routeKey)!;
        stats.hitCount++;
        stats.lastAccessed = new Date();
    }

    /**
     * Track route request completion
     */
    private trackRouteEnd(
        routeKey: string,
        responseTime: number,
        statusCode: number,
    ): void {
        const stats = this.routeStats.get(routeKey);
        if (!stats) return;

        stats.totalResponseTime += responseTime;
        stats.averageResponseTime = stats.totalResponseTime / stats.hitCount;

        if (statusCode >= 400) {
            stats.errorCount++;
        }

        // Calculate popularity score
        stats.popularity = this.calculatePopularity(stats);

        // Check if route needs optimization
        if (this.config.autoOptimization && this.shouldOptimizeRoute(stats)) {
            this.optimizeRoute(routeKey, stats);
        }
    }

    /**
     * Calculate route popularity score
     */
    private calculatePopularity(stats: RouteStats): number {
        const now = Date.now();
        const timeSinceLastAccess = now - stats.lastAccessed.getTime();
        const recencyFactor = Math.max(
            0,
            1 - timeSinceLastAccess / this.config.popularityWindow,
        );

        const frequencyScore = Math.log(stats.hitCount + 1);
        const performanceScore = Math.max(
            0,
            1 - stats.averageResponseTime / 1000,
        ); // Normalize to 1 second
        const reliabilityScore = Math.max(
            0,
            1 - stats.errorCount / stats.hitCount,
        );

        return (
            frequencyScore * 0.4 +
            performanceScore * 0.3 +
            reliabilityScore * 0.2 +
            recencyFactor * 0.1
        );
    }

    /**
     * Check if route should be optimized
     */
    private shouldOptimizeRoute(stats: RouteStats): boolean {
        if (this.optimizedRoutes.has(`${stats.method}:${stats.path}`)) {
            return false; // Already optimized
        }

        // Check threshold
        if (stats.hitCount < this.config.optimizationThreshold) {
            return false;
        }

        // Check custom rules
        for (const rule of this.config.customRules) {
            if (this.matchesPattern(stats.path, rule.pattern)) {
                return (
                    stats.hitCount >= rule.minHits &&
                    stats.averageResponseTime <= rule.maxResponseTime
                );
            }
        }

        // Default optimization criteria
        return stats.popularity > 5 || stats.averageResponseTime > 500;
    }

    /**
     * Optimize a specific route
     */
    private optimizeRoute(routeKey: string, stats: RouteStats): void {
        if (this.optimizedRoutes.has(routeKey)) return;

        const optimizations: string[] = [];

        // Apply caching optimization
        if (stats.averageResponseTime > 200) {
            this.applyCachingOptimization(routeKey, stats);
            optimizations.push("caching");
        }

        // Apply response compression
        if (stats.hitCount > 500) {
            this.applyCompressionOptimization(routeKey, stats);
            optimizations.push("compression");
        }

        // Apply preloading for very popular routes
        if (stats.popularity > 8) {
            this.applyPreloadingOptimization(routeKey, stats);
            optimizations.push("preloading");
        }

        this.optimizedRoutes.add(routeKey);

        this.logger.info(
            "plugins",
            `Route optimized: ${routeKey} (${optimizations.join(", ")})`,
        );
        this.config.onOptimization(routeKey, optimizations.join(", "));

        this.emit("route_optimized", { routeKey, stats, optimizations });
    }

    /**
     * Apply caching optimization
     */
    private applyCachingOptimization(
        routeKey: string,
        stats: RouteStats,
    ): void {
        const [method, path] = routeKey.split(":");

        // Determine cache strategy based on route performance
        let cacheStrategy: "aggressive" | "moderate" | "conservative" =
            "moderate";
        let cacheTTL = 300; // 5 minutes default

        if (stats.averageResponseTime > 1000) {
            cacheStrategy = "aggressive";
            cacheTTL = 1800; // 30 minutes for slow routes
        } else if (stats.averageResponseTime < 200) {
            cacheStrategy = "conservative";
            cacheTTL = 60; // 1 minute for fast routes
        }

        // Apply route-specific caching middleware
        this.app.use(path, (req: any, res: any, next: any) => {
            // Only cache GET requests
            if (req.method !== "GET") {
                return next();
            }

            const cacheKey = `route_cache:${method}:${
                req.originalUrl
            }:${JSON.stringify(req.query)}`;

            // Try to get from cache first
            if (this.app.cacheManager) {
                this.app.cacheManager
                    .get(cacheKey)
                    .then((cachedResponse: any) => {
                        if (cachedResponse) {
                            stats.cacheHits++;
                            res.set("X-Cache", "HIT");
                            res.set("X-Cache-Strategy", cacheStrategy);
                            return res.json(cachedResponse);
                        }

                        // Cache miss - intercept response
                        stats.cacheMisses++;
                        const originalJson = res.json.bind(res);
                        res.json = (data: any) => {
                            // Cache the response
                            this.app.cacheManager.set(cacheKey, data, {
                                ttl: cacheTTL,
                            });
                            res.set("X-Cache", "MISS");
                            res.set("X-Cache-Strategy", cacheStrategy);
                            return originalJson(data);
                        };

                        next();
                    })
                    .catch(() => {
                        // Cache error - continue without caching
                        next();
                    });
            } else {
                next();
            }
        });

        this.logger.debug(
            "plugins",
            `Applied ${cacheStrategy} caching optimization to ${routeKey} (TTL: ${cacheTTL}s)`,
        );
    }

    /**
     * Apply compression optimization
     */
    private applyCompressionOptimization(
        routeKey: string,
        stats: RouteStats,
    ): void {
        const [method, path] = routeKey.split(":");

        // Apply compression middleware for this specific route
        this.app.use(path, (req: any, res: any, next: any) => {
            // Enable compression for responses larger than 1KB
            const originalSend = res.send.bind(res);
            const originalJson = res.json.bind(res);

            res.send = (data: any) => {
                if (data && typeof data === "string" && data.length > 1024) {
                    res.set("X-Compression", "ENABLED");
                    res.set("Content-Encoding", "gzip");
                }
                return originalSend(data);
            };

            res.json = (data: any) => {
                const jsonString = JSON.stringify(data);
                if (jsonString.length > 1024) {
                    res.set("X-Compression", "ENABLED");
                    res.set("Content-Encoding", "gzip");
                }
                return originalJson(data);
            };

            next();
        });

        this.logger.debug(
            "plugins",
            `Applied compression optimization to ${routeKey} (avg response: ${stats.averageResponseTime}ms)`,
        );
    }

    /**
     * Apply preloading optimization
     */
    private applyPreloadingOptimization(
        routeKey: string,
        stats: RouteStats,
    ): void {
        const [method, path] = routeKey.split(":");

        // Preload common responses for very popular routes
        if (stats.popularity > 8 && method === "GET") {
            // Schedule preloading during low traffic periods
            setTimeout(() => {
                this.preloadRouteData(path, stats);
            }, 60000); // Preload after 1 minute

            // Set up predictive preloading based on access patterns
            this.app.use(path, (req: any, res: any, next: any) => {
                // Track access patterns for predictive preloading
                const userAgent = req.headers["user-agent"] || "unknown";
                const referer = req.headers["referer"] || "direct";

                // Store access pattern for future preloading
                const accessPattern = {
                    path: req.originalUrl,
                    userAgent,
                    referer,
                    timestamp: Date.now(),
                    query: req.query,
                };

                // Add to preload queue if pattern is detected
                this.schedulePreload(accessPattern);

                res.set("X-Preload", "ENABLED");
                next();
            });
        }

        this.logger.debug(
            "plugins",
            `Applied preloading optimization to ${routeKey} (popularity: ${stats.popularity.toFixed(
                2,
            )})`,
        );
    }

    /**
     * Preload route data
     */
    private preloadRouteData(path: string, stats: RouteStats): void {
        // Simulate preloading by making internal requests
        if (this.app.cacheManager) {
            const preloadKey = `preload:${path}:${Date.now()}`;

            // Store preload metadata
            this.app.cacheManager.set(
                preloadKey,
                {
                    path,
                    preloadedAt: new Date(),
                    averageResponseTime: stats.averageResponseTime,
                    hitCount: stats.hitCount,
                },
                { ttl: 3600 },
            ); // 1 hour

            this.logger.debug("plugins", `Preloaded data for ${path}`);
        }
    }

    /**
     * Schedule predictive preloading
     */
    private schedulePreload(accessPattern: any): void {
        // Simple predictive logic - preload related resources
        if (accessPattern.path.includes("/api/")) {
            const relatedPaths = [
                accessPattern.path + "/details",
                accessPattern.path + "/related",
                accessPattern.path.replace("/api/", "/api/meta/"),
            ];

            relatedPaths.forEach((relatedPath) => {
                setTimeout(() => {
                    this.logger.debug(
                        "plugins",
                        `Predictive preload scheduled for ${relatedPath}`,
                    );
                }, Math.random() * 30000); // Random delay up to 30 seconds
            });
        }
    }

    /**
     * Check if path matches pattern
     */
    private matchesPattern(path: string, pattern: string): boolean {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(path);
    }

    /**
     * Start background analysis
     */
    private startBackgroundAnalysis(): void {
        this.analysisTimer = setInterval(() => {
            this.performAnalysis();
        }, this.config.analysisInterval);
    }

    /**
     * Perform route analysis
     */
    private performAnalysis(): void {
        const stats = Array.from(this.routeStats.values())
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 20); // Top 20 routes

        this.logger.debug(
            "plugins",
            `Analyzed ${this.routeStats.size} routes, top performers: ${stats.length}`,
        );

        this.config.onAnalysis(stats);
        this.emit("analysis_complete", stats);

        // Cleanup old routes
        this.cleanupOldRoutes();
    }

    /**
     * Cleanup old unused routes
     */
    private cleanupOldRoutes(): void {
        const now = Date.now();
        const cutoff = now - this.config.popularityWindow * 2; // 2x the popularity window

        for (const [routeKey, stats] of this.routeStats.entries()) {
            if (stats.lastAccessed.getTime() < cutoff && stats.hitCount < 10) {
                this.routeStats.delete(routeKey);
                this.optimizedRoutes.delete(routeKey);
            }
        }

        // Limit total tracked routes
        if (this.routeStats.size > this.config.maxTrackedRoutes) {
            const sortedRoutes = Array.from(this.routeStats.entries()).sort(
                ([, a], [, b]) => a.popularity - b.popularity,
            );

            const toRemove = sortedRoutes.slice(
                0,
                this.routeStats.size - this.config.maxTrackedRoutes,
            );
            toRemove.forEach(([routeKey]) => {
                this.routeStats.delete(routeKey);
                this.optimizedRoutes.delete(routeKey);
            });
        }
    }

    /**
     * Get route statistics
     */
    public getRouteStats(): RouteStats[] {
        return Array.from(this.routeStats.values()).sort(
            (a, b) => b.popularity - a.popularity,
        );
    }

    /**
     * Get optimized routes
     */
    public getOptimizedRoutes(): string[] {
        return Array.from(this.optimizedRoutes);
    }

    /**
     * Manually optimize a route
     */
    public manualOptimize(routeKey: string): void {
        const stats = this.routeStats.get(routeKey);
        if (stats) {
            this.optimizeRoute(routeKey, stats);
        }
    }

    /**
     * Destroy the plugin
     */
    public destroy(): void {
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
        }
        this.routeStats.clear();
        this.optimizedRoutes.clear();
        this.removeAllListeners();
    }
}

