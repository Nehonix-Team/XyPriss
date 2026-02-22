/**
 * XyPrissJS Cache Factory
 *@version 4.1.8
 * Factory for creating optimized cache instances based on configuration.
 * Automatically selects the best strategy for ultra-fast performance.
 */

import { SecureCacheAdapter } from "./SecureCacheAdapter";
import {
    CacheConfig,
    CacheBackendStrategy,
    CacheMetrics,
} from "../types/types";
import { SecureCacheConfig } from "./type";

/**
 *  cache factory with intelligent strategy selection
 */
export class CacheFactory {
    private static instances: Map<string, SecureCacheAdapter> = new Map();
    private static defaultConfig: Partial<CacheConfig> = {};

    /**
     * Set global default configuration
     */
    public static setDefaults(config: Partial<CacheConfig>): void {
        this.defaultConfig = { ...this.defaultConfig, ...config };
    }

    /**
     * Create cache instance based on configuration
     */
    public static create(config: CacheConfig = {}): SecureCacheAdapter {
        const mergedConfig = { ...this.defaultConfig, ...config };

        // Create cache instance ID for singleton pattern
        const instanceId = this.generateInstanceId(mergedConfig);

        // Return existing instance if available
        if (
            mergedConfig.singleton !== false &&
            this.instances.has(instanceId)
        ) {
            return this.instances.get(instanceId)!;
        }

        // Convert legacy config to new secure config format
        const secureConfig: SecureCacheConfig =
            this.buildSecureConfig(mergedConfig);

        const instance = new SecureCacheAdapter(secureConfig);

        // Store instance if singleton mode enabled
        if (mergedConfig.singleton !== false) {
            this.instances.set(instanceId, instance);
        }

        return instance;
    }

    /**
     * Build secure config from legacy config
     */
    private static buildSecureConfig(config: CacheConfig): SecureCacheConfig {
        return {
            strategy: this.determineStrategy(config),

            memory: {
                maxSize: config.maxSize || 100, // MB
                maxEntries: config.maxEntries || 10000,
                ttl: (config.ttl || 300) * 1000, // Convert seconds to milliseconds
                algorithm: config.memory?.algorithm || "lru",
                evictionPolicy: config.memory?.evictionPolicy || "lru",
                preallocation: config.memory?.preallocation || false,
            },

            redis: this.buildRedisConfig(config),

            performance: {
                batchSize: config.performance?.batchSize || 100,
                compressionThreshold: config.compression ? 1024 : Infinity,
                hotDataThreshold: config.performance?.hotDataThreshold || 10,
                prefetchEnabled: config.performance?.prefetchEnabled !== false,
                asyncWrite: config.performance?.asyncWrite !== false,
                pipeline: config.performance?.pipeline !== false,
                connectionPooling:
                    config.performance?.connectionPooling !== false,
            },

            security: {
                encryption: config.encryption !== false,
                keyRotation: config.security?.keyRotation !== false,
                accessMonitoring: config.security?.accessMonitoring !== false,
                sanitization: config.security?.sanitization !== false,
                auditLogging: config.security?.auditLogging || false,
            },

            monitoring: {
                enabled: config.monitoring?.enabled !== false,
                metricsInterval: config.monitoring?.metricsInterval || 60000,
                alertThresholds: {
                    memoryUsage:
                        config.monitoring?.alertThresholds?.memoryUsage || 90,
                    hitRate: config.monitoring?.alertThresholds?.hitRate || 80,
                    errorRate:
                        config.monitoring?.alertThresholds?.errorRate || 5,
                    latency: config.monitoring?.alertThresholds?.latency || 100,
                },
                detailed: config.monitoring?.detailed || false,
            },

            resilience: {
                retryAttempts: config.resilience?.retryAttempts || 3,
                retryDelay: config.resilience?.retryDelay || 1000,
                circuitBreaker: config.resilience?.circuitBreaker !== false,
                fallback: config.resilience?.fallback !== false,
                healthCheck: config.resilience?.healthCheck !== false,
            },
        };
    }

    /**
     * Determine optimal cache strategy
     */
    private static determineStrategy(
        config: CacheConfig,
    ): CacheBackendStrategy {
        if (config.type === "redis") return "redis";
        if (config.type === "memory") return "memory";
        if (config.type === "hybrid") return "hybrid";

        // Auto-detection logic
        const hasRedis =
            config.redis ||
            process.env.XYPRISS_REDIS_URL ||
            process.env.XYPRISS_REDIS_HOST;
        const memoryLimit = config.maxSize || 100;
        const isMemoryConstrained = memoryLimit < 50;

        if (hasRedis && !isMemoryConstrained) return "hybrid";
        if (hasRedis) return "redis";
        return "memory";
    }

    /**
     * Build Redis configuration
     */
    private static buildRedisConfig(config: CacheConfig) {
        if (
            !config.redis &&
            !process.env.XYPRISS_REDIS_URL &&
            !process.env.XYPRISS_REDIS_HOST
        ) {
            return undefined;
        }

        const redisConfig = config.redis || {};

        return {
            host:
                redisConfig.host ||
                process.env.XYPRISS_REDIS_HOST ||
                "localhost",
            port:
                redisConfig.port ||
                parseInt(process.env.XYPRISS_REDIS_PORT || "6379"),
            password:
                redisConfig.password || process.env.XYPRISS_REDIS_PASSWORD,
            db: redisConfig.db || parseInt(process.env.XYPRISS_REDIS_DB || "0"),

            cluster: redisConfig.cluster
                ? {
                      enabled: redisConfig.cluster,
                      nodes: redisConfig.nodes || [
                          {
                              host:
                                  redisConfig.host ||
                                  process.env.XYPRISS_REDIS_HOST ||
                                  "localhost",
                              port: parseInt(
                                  process.env.XYPRISS_REDIS_PORT || "6379",
                              ),
                          },
                      ],
                  }
                : undefined,

            pool: {
                min: redisConfig.pool?.min || 2,
                max: redisConfig.pool?.max || 10,
                acquireTimeoutMillis:
                    redisConfig.pool?.acquireTimeoutMillis || 30000,
                idleTimeoutMillis: redisConfig.pool?.idleTimeoutMillis || 30000,
            },

            sentinel: redisConfig.sentinel
                ? {
                      enabled: true,
                      masters: redisConfig.sentinel.masters || ["mymaster"],
                      sentinels: redisConfig.sentinel.sentinels || [
                          { host: "localhost", port: 26379 },
                      ],
                  }
                : undefined,
        };
    }

    /**
     * Generate unique instance ID for singleton pattern
     */
    private static generateInstanceId(config: CacheConfig): string {
        const key = JSON.stringify({
            type: config.type,
            redis: config.redis,
            maxSize: config.maxSize,
            ttl: config.ttl,
        });

        return Buffer.from(key).toString("base64");
    }

    /**
     * Create memory-only cache for maximum speed
     */
    public static createMemoryCache(
        config: Partial<CacheConfig> = {},
    ): SecureCacheAdapter {
        return this.create({
            type: "memory",
            maxSize: config.maxSize || 100,
            maxEntries: config.maxEntries || 10000,
            ttl: config.ttl || 300,
            compression: config.compression || false,
            encryption: config.encryption !== false,
            memory: {
                algorithm: config.memory?.algorithm || "lru",
                preallocation: config.memory?.preallocation || false,
                ...config.memory,
            },
        });
    }

    /**
     * Create Redis-only cache for persistence
     */
    public static createRedisCache(
        config: Partial<CacheConfig> = {},
    ): SecureCacheAdapter {
        return this.create({
            type: "redis",
            redis: config.redis || {
                host: "localhost",
                port: 6379,
            },
            ttl: config.ttl || 300,
            compression: config.compression !== false,
            encryption: config.encryption !== false,
        });
    }

    /**
     * Create hybrid cache for best of both worlds
     */
    public static createHybridCache(
        config: Partial<CacheConfig> = {},
    ): SecureCacheAdapter {
        return this.create({
            type: "hybrid",
            memory: {
                maxSize: config.maxSize || 100,
                algorithm: config.memory?.algorithm || "lru",
                ...config.memory,
            },
            redis: config.redis || {
                host: "localhost",
                port: 6379,
            },
            compression: config.compression !== false,
            encryption: config.encryption !== false,
        });
    }

    /**
     * Create Redis Cluster cache for high availability
     */
    public static createClusterCache(
        nodes: Array<{ host: string; port: number }>,
        config: Partial<CacheConfig> = {},
    ): SecureCacheAdapter {
        return this.create({
            type: "redis",
            redis: {
                ...config.redis,
                cluster: true,
                nodes,
            },
            ttl: config.ttl || 300,
            compression: config.compression !== false,
            encryption: config.encryption !== false,
        });
    }

    /**
     * Create Redis Sentinel cache for high availability
     */
    public static createSentinelCache(
        masters: string[],
        sentinels: Array<{ host: string; port: number }>,
        config: Partial<CacheConfig> = {},
    ): SecureCacheAdapter {
        return this.create({
            type: "redis",
            redis: {
                ...config.redis,
                sentinel: {
                    enabled: true,
                    masters,
                    sentinels,
                },
            },
            ttl: config.ttl || 300,
            compression: config.compression !== false,
            encryption: config.encryption !== false,
        });
    }

    /**
     * Create distributed cache with sharding
     */
    public static createDistributedCache(
        shards: Array<{ host: string; port: number; weight?: number }>,
        config: Partial<CacheConfig> = {},
    ): SecureCacheAdapter {
        return this.create({
            type: "distributed",
            redis: {
                ...config.redis,
                shards,
            },
            ttl: config.ttl || 300,
            compression: config.compression !== false,
            encryption: config.encryption !== false,
        });
    }

    /**
     * Clear all cached instances
     */
    public static clearInstances(): void {
        this.instances.forEach((instance) => {
            instance.disconnect().catch(console.error);
        });
        this.instances.clear();
    }

    /**
     * Get cache instance by ID
     */
    public static getInstance(config: CacheConfig): SecureCacheAdapter | null {
        const instanceId = this.generateInstanceId(config);
        return this.instances.get(instanceId) || null;
    }
}

/**
 *  legacy cache interface adapter
 */
export class LegacyCacheAdapter {
    private cache: SecureCacheAdapter;
    private stats: CacheMetrics = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        operations: 0,
    };

    constructor(cache: SecureCacheAdapter) {
        this.cache = cache;
    }

    async connect(): Promise<void> {
        try {
            await this.cache.connect();
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await this.cache.disconnect();
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async get(key: string): Promise<any> {
        try {
            this.stats.operations++;
            const value = await this.cache.get(key);

            if (value !== null) {
                this.stats.hits++;
            } else {
                this.stats.misses++;
            }

            return value;
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        try {
            this.stats.operations++;
            this.stats.sets++;

            await this.cache.set(key, value, {
                ttl: ttl ? ttl * 1000 : undefined,
            });
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async del(key: string): Promise<void> {
        try {
            this.stats.operations++;
            this.stats.deletes++;

            await this.cache.delete(key);
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            this.stats.operations++;
            await this.cache.clear();
            this.resetStats();
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async keys(pattern?: string): Promise<string[]> {
        try {
            this.stats.operations++;

            //  pattern matching implementation
            const allKeys = await this.cache.keys();

            if (!pattern) {
                return allKeys;
            }

            // Convert glob pattern to regex
            const regex = this.globToRegex(pattern);
            return allKeys.filter((key) => regex.test(key));
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            this.stats.operations++;
            return await this.cache.exists(key);
        } catch (error) {
            this.stats.errors++;
            return false;
        }
    }

    async ttl(key: string): Promise<number> {
        try {
            this.stats.operations++;
            return await this.cache.getTTL(key);
        } catch (error) {
            this.stats.errors++;
            return -1;
        }
    }

    async expire(key: string, seconds: number): Promise<void> {
        try {
            this.stats.operations++;
            await this.cache.expire(key, seconds * 1000);
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async tag(key: string, tags: string[]): Promise<void> {
        try {
            this.stats.operations++;
            const value = await this.cache.get(key);

            if (value !== null) {
                await this.cache.set(key, value, { tags });
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async invalidateTags(tags: string[]): Promise<void> {
        try {
            this.stats.operations++;
            await this.cache.invalidateByTags(tags);
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async mget(keys: string[]): Promise<Array<any>> {
        try {
            this.stats.operations++;
            const results = await this.cache.mget(keys);
            // Convert Record<string, any> to Array<any> in key order
            return keys.map((key) => results[key] || null);
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async mset(
        keyValuePairs: Array<[string, any]>,
        ttl?: number,
    ): Promise<void> {
        try {
            this.stats.operations++;
            this.stats.sets += keyValuePairs.length;

            await this.cache.mset(keyValuePairs, {
                ttl: ttl ? ttl * 1000 : undefined,
            });
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async getStats(): Promise<any> {
        try {
            const cacheStats = await this.cache.getStats();

            return {
                hits: this.stats.hits,
                misses: this.stats.misses,
                sets: this.stats.sets,
                deletes: this.stats.deletes,
                errors: this.stats.errors,
                operations: this.stats.operations,
                hitRate:
                    this.stats.hits / (this.stats.hits + this.stats.misses) ||
                    0,
                missRate:
                    this.stats.misses / (this.stats.hits + this.stats.misses) ||
                    0,
                errorRate: this.stats.errors / this.stats.operations || 0,
                totalMemory: cacheStats.memory.totalSize,

                memory: {
                    ...cacheStats.memory,
                    hitRate: cacheStats.memory.hitRate,
                },

                redis: cacheStats.redis
                    ? {
                          connected: cacheStats.redis.connected,
                          operations: cacheStats.redis.operations,
                          memoryUsage: cacheStats.redis.memoryUsage,
                          hitRate: cacheStats.redis.hitRate,
                          keys: cacheStats.redis.keys,
                          uptime: cacheStats.redis.uptime,
                      }
                    : undefined,

                performance: cacheStats.performance,
            };
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            operations: 0,
        };
    }

    /**
     * Convert glob pattern to regex
     */
    private globToRegex(pattern: string): RegExp {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");

        return new RegExp(`^${escaped}$`);
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            const testKey = "__health_check__";
            const testValue = Date.now().toString();

            await this.set(testKey, testValue, 1);
            const retrieved = await this.get(testKey);
            await this.del(testKey);

            return retrieved === testValue;
        } catch (error) {
            return false;
        }
    }
}

/**
 * Create legacy-compatible cache instance
 */
export function createLegacyCache(
    config: CacheConfig = {},
): LegacyCacheAdapter {
    const secureCache = CacheFactory.create(config);
    return new LegacyCacheAdapter(secureCache);
}

/**
 * Auto-detect best cache strategy based on environment
 */
export function createOptimalCache(
    config: CacheConfig = {},
): SecureCacheAdapter {
    // Use the private method through a temporary instance
    // FIXME:  or we can implement logic here (I don know)
    const hasRedis =
        config.redis || process.env.XYPRISS_REDIS_URL || process.env.XYPRISS_REDIS_HOST;
    const memoryLimit = config.maxSize || 100;
    const isMemoryConstrained = memoryLimit < 50;

    let strategy: "memory" | "redis" | "hybrid";
    if (config.type === "redis") strategy = "redis";
    else if (config.type === "memory") strategy = "memory";
    else if (config.type === "hybrid") strategy = "hybrid";
    else if (hasRedis && !isMemoryConstrained) strategy = "hybrid";
    else if (hasRedis) strategy = "redis";
    else strategy = "memory";

    // console.log(`Auto-selected ${strategy.toUpperCase()} cache strategy`);

    switch (strategy) {
        case "hybrid":
            return CacheFactory.createHybridCache(config);
        case "redis":
            return CacheFactory.createRedisCache(config);
        case "memory":
        default:
            return CacheFactory.createMemoryCache(config);
    }
}

/**
 * Create cache with automatic failover
 */
export function createResilientCache(
    config: CacheConfig = {},
): SecureCacheAdapter {
    return CacheFactory.create({
        ...config,
        resilience: {
            retryAttempts: 3,
            retryDelay: 1000,
            circuitBreaker: true,
            fallback: true,
            healthCheck: true,
            ...config.resilience,
        },
    });
}

/**
 * Create cache with  monitoring
 */
export function createMonitoredCache(
    config: CacheConfig = {},
): SecureCacheAdapter {
    return CacheFactory.create({
        ...config,
        monitoring: {
            enabled: true,
            detailed: true,
            metricsInterval: 30000,
            alertThresholds: {
                memoryUsage: 85,
                hitRate: 75,
                errorRate: 2,
                latency: 50,
            },
            ...config.monitoring,
        },
    });
}

/**
 * Utility functions
 */
export const CacheUtils = {
    /**
     * Benchmark cache performance
     */
    async benchmark(
        cache: SecureCacheAdapter,
        operations: number = 1000,
    ): Promise<{
        writeTime: number;
        readTime: number;
        deleteTime: number;
        throughput: number;
    }> {
        const start = Date.now();

        // Write benchmark
        const writeStart = Date.now();
        for (let i = 0; i < operations; i++) {
            await cache.set(`bench:${i}`, {
                data: `value${i}`,
                timestamp: Date.now(),
            });
        }
        const writeTime = Date.now() - writeStart;

        // Read benchmark
        const readStart = Date.now();
        for (let i = 0; i < operations; i++) {
            await cache.get(`bench:${i}`);
        }
        const readTime = Date.now() - readStart;

        // Delete benchmark
        const deleteStart = Date.now();
        for (let i = 0; i < operations; i++) {
            await cache.delete(`bench:${i}`);
        }
        const deleteTime = Date.now() - deleteStart;

        const totalTime = Date.now() - start;
        const throughput = (operations * 3) / (totalTime / 1000); // ops per second

        return {
            writeTime,
            readTime,
            deleteTime,
            throughput,
        };
    },

    /**
     * Warm up cache with data
     */
    async warmUp(
        cache: SecureCacheAdapter,
        data: Array<{ key: string; value: any; ttl?: number }>,
    ): Promise<void> {
        const batches = [];
        const batchSize = 100;

        for (let i = 0; i < data.length; i += batchSize) {
            batches.push(data.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            await Promise.all(
                batch.map((item) =>
                    cache.set(item.key, item.value, { ttl: item.ttl }),
                ),
            );
        }
    },

    /**
     * Migration utility
     */
    async migrate(
        source: SecureCacheAdapter,
        target: SecureCacheAdapter,
        options: {
            batchSize?: number;
            preserveTTL?: boolean;
            keyFilter?: (key: string) => boolean;
        } = {},
    ): Promise<{ migrated: number; failed: number }> {
        const { batchSize = 100, preserveTTL = true, keyFilter } = options;

        const keys = await source.keys();
        const filteredKeys = keyFilter ? keys.filter(keyFilter) : keys;

        let migrated = 0;
        let failed = 0;

        for (let i = 0; i < filteredKeys.length; i += batchSize) {
            const batch = filteredKeys.slice(i, i + batchSize);

            for (const key of batch) {
                try {
                    const value = await source.get(key);
                    if (value !== null) {
                        const ttl = preserveTTL
                            ? await source.getTTL(key)
                            : undefined;
                        await target.set(key, value, { ttl });
                        migrated++;
                    }
                } catch (error) {
                    console.error(`Failed to migrate key ${key}:`, error);
                    failed++;
                }
            }
        }

        return { migrated, failed };
    },
};

