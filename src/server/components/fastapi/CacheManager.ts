import { SecureCacheAdapter } from "../../../cache";
import { CacheUtils, createOptimalCache } from "../../../cache/CacheFactory";
import { CacheManagerOptions } from "../../../types/components/CacheManager.type";
import { CacheConfig } from "../../../types/types";
import { ServerOptions } from "../../../types/types";
import { logger } from "../../../shared/logger/Logger";

/**
 * CacheManager - Handles all cache-related operations for FastApi.ts
 * Manages cache creation, configuration, warming, and key generation
 */
export class CacheManager {
    protected readonly options: CacheManagerOptions;
    private cache: SecureCacheAdapter;

    constructor(options: CacheManagerOptions) {
        this.options = options;
        this.cache = this.createCache();
    }

    /**
     * Get the cache instance
     */
    public getCache(): SecureCacheAdapter {
        return this.cache;
    }

    /**
     * Create cache instance with optimal configuration
     */
    private createCache(): SecureCacheAdapter {
        const cacheStrategy = this.detectCacheStrategy();

        const cacheConfig: CacheConfig = {
            type: cacheStrategy,
            memory: this.options.cache?.memory,
            redis: this.options.cache?.redis,
            performance: {
                batchSize: this.options.performance?.batchSize,
                connectionPooling: this.options.performance?.connectionPooling,
            },
            security: {
                encryption: true, // Default security settings
                accessMonitoring: true,
                sanitization: true,
                auditLogging: false,
            },
            monitoring: {
                enabled: true,
                detailed: false,
                alertThresholds: undefined,
            },
        };

        return createOptimalCache(cacheConfig);
    }

    /**
     * Auto-detect optimal cache strategy
     */
    private detectCacheStrategy(): "memory" | "redis" | "hybrid" {
        if (
            this.options.cache?.strategy &&
            this.options.cache.strategy !== "auto"
        ) {
            return this.options.cache.strategy as "memory" | "redis" | "hybrid";
        }

        const hasRedis =
            this.options.cache?.redis?.host ||
            process.env.XYPRISS_REDIS_URL ||
            process.env.XYPRISS_REDIS_HOST;

        const memoryLimit = this.options.cache?.memory?.maxSize || 100;
        const isMemoryConstrained = memoryLimit < 50;

        if (hasRedis && !isMemoryConstrained) {
            return "hybrid";
        } else if (hasRedis) {
            return "redis";
        } else {
            return "memory";
        }
    }

    /**
     * Initialize cache connection
     */
    public async initializeCache(): Promise<void> {
        try {
            await this.cache.connect();
        } catch (error) {
            logger.error("cache", "Cache initialization failed:", error);
            throw error;
        }
    }

    /**
     * HIGH-PERFORMANCE CACHE WARMING - Pre-populate cache with instant responses
     */
    public async warmUpHighPerformanceCache(): Promise<void> {
        try {
            // Get system info from configuration for library-agnostic responses
            const systemInfo = {
                serviceName:
                    this.options.server?.serviceName || "FastApi.ts Service",
                version: this.options.server?.version || "1.0.0",
                environment:
                    this.options.env || process.env.NODE_ENV || "development",
            };

            // Pre-populate high-performance responses with configurable data
            const optimizedResponses = [
                {
                    key: "ultra:GET:/health",
                    value: {
                        status: "ok",
                        timestamp: Date.now(),
                        service: systemInfo.serviceName,
                        version: systemInfo.version,
                        environment: systemInfo.environment,
                        uptime: process.uptime(),
                        cached: true,
                        responseTime: "<1ms",
                    },
                    ttl: 3600000, // 1 hour
                },
                {
                    key: "ultra:GET:/ping",
                    value: {
                        pong: true,
                        timestamp: Date.now(),
                        service: systemInfo.serviceName,
                        cached: true,
                    },
                    ttl: 3600000,
                },
                {
                    key: "ultra:GET:/status",
                    value: {
                        status: "healthy",
                        timestamp: Date.now(),
                        service: systemInfo.serviceName,
                        version: systemInfo.version,
                        cached: true,
                    },
                    ttl: 3600000,
                },
            ];

            // Warm up cache asynchronously
            const warmupPromises = optimizedResponses.map(async (item) => {
                try {
                    await this.cache.set(item.key, item.value, {
                        ttl: item.ttl,
                    });
                } catch (error: any) {
                    logger.warn(
                        "cache",
                        `Failed to warm up ${item.key}:`,
                        error.message,
                    );
                }
            });

            await Promise.all(warmupPromises);
        } catch (error: any) {
            logger.warn("cache", "Cache warmup failed:", error.message);
        }
    }

    /**
     * Generate high-performance cache key with minimal overhead
     */
    public generateHighPerformanceCacheKey(req: any): string {
        return `ultra:${req.method}:${req.path}`;
    }

    /**
     * Generate standard cache key for request
     */
    public generateCacheKey(
        req: any,
        customKey?: string | ((req: any) => string),
    ): string {
        if (typeof customKey === "function") {
            return customKey(req);
        }

        if (typeof customKey === "string") {
            return customKey;
        }

        // Auto-generate key based on route and params
        const baseKey = `${req.method}:${req.route?.path || req.path}`;
        const params =
            Object.keys(req.params || {}).length > 0
                ? `:${JSON.stringify(req.params)}`
                : "";
        const query =
            Object.keys(req.query || {}).length > 0
                ? `:${JSON.stringify(req.query)}`
                : "";

        return `${baseKey}${params}${query}`;
    }

    /**
     * Get cache TTL based on execution path
     */
    public getCacheTTLForPath(pathType: string): number {
        switch (pathType) {
            case "high-performance":
                return 3600000; // 1 hour for high-performance responses
            case "fast":
                return 1800000; // 30 minutes for fast responses
            case "standard":
                return 300000; // 5 minutes for standard responses
            default:
                return 300000;
        }
    }

    /**
     * Warm up cache with provided data
     */
    public async warmUpCache(
        data: Array<{ key: string; value: any; ttl?: number }>,
    ): Promise<void> {
        await CacheUtils.warmUp(this.cache, data);
    }

    /**
     * Get cache statistics
     */
    public async getCacheStats(): Promise<any> {
        return await this.cache.getStats();
    }

    /**
     * Get cache health status
     */
    public getCacheHealth(): any {
        return this.cache.getHealth();
    }

    /**
     * Invalidate cache by pattern/tags
     */
    public async invalidateCache(pattern: string): Promise<void> {
        await this.cache.invalidateByTags([pattern]);
    }
}

