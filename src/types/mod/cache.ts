/**
 * @fileoverview Cache-related type definitions for XyPrissJS Express integration
 *
 * This module contains all cache-related types including configuration,
 * strategies, metrics, and backend implementations.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06 
 */

import { Request } from "../types";

 
/**
 * Cache backend strategy types.
 *
 * Defines the available cache backend implementations:
 * - memory: In-memory caching (fastest, not persistent)
 * - redis: Redis-based caching (persistent, distributed)
 * - hybrid: Combination of memory and Redis
 * - distributed: Multi-node distributed caching
 *
 * @example
 * ```typescript
 * const strategy: CacheBackendStrategy = 'hybrid';
 * ```
 */
export type CacheBackendStrategy =
    | "memory"
    | "redis"
    | "hybrid"
    | "distributed";

/**
 * Main cache configuration interface.
 *
 * Comprehensive configuration for the caching system including
 * backend selection, performance tuning, security, and monitoring.
 *
 * @interface CacheConfig
 *
 * @example
 * ```typescript
 * const cacheConfig: CacheConfig = {
 *   type: 'hybrid',
 *   ttl: 3600,
 *   maxSize: 1024 * 1024 * 100, // 100MB
 *   compression: true,
 *   encryption: true,
 *   strategies: [
 *     {
 *       name: 'api-cache',
 *       condition: (req) => req.path.startsWith('/api/'),
 *       ttl: 300,
 *       tags: ['api']
 *     }
 *   ]
 * };
 * ```
 */
export interface CacheConfig {
    /** Cache backend type */
    type?: CacheBackendStrategy;

    /** Redis configuration (when using Redis backend) */
    redis?: RedisConfig;

    /** Memory cache configuration */
    memory?: MemoryConfig;

    /** Default TTL in seconds */
    ttl?: number;

    /** Maximum cache size in bytes */
    maxSize?: number;

    /** Maximum number of cache entries */
    maxEntries?: number;

    /** Enable compression for cached data */
    compression?: boolean;

    /** Enable encryption for cached data */
    encryption?: boolean;

    /** Serialization format for cached data */
    serialization?: "json" | "msgpack" | "protobuf";

    /** Cache strategies for different scenarios */
    strategies?: CacheStrategy[];

    /** Enable singleton pattern for cache instances */
    singleton?: boolean;

    /** Performance optimization settings */
    performance?: CachePerformanceConfig;

    /** Security settings for cache */
    security?: CacheSecurityConfig;

    /** Monitoring and metrics configuration */
    monitoring?: CacheMonitoringConfig;

    /** Resilience and fault tolerance settings */
    resilience?: CacheResilienceConfig;
}

/**
 * Redis cache configuration.
 *
 * Comprehensive Redis configuration including clustering,
 * connection pooling, and high availability options.
 *
 * @interface RedisConfig
 *
 * @example
 * ```typescript
 * const redisConfig: RedisConfig = {
 *   host: 'localhost',
 *   port: 6379,
 *   password: 'secure-password',
 *   cluster: true,
 *   nodes: [
 *     { host: 'redis-1', port: 6379 },
 *     { host: 'redis-2', port: 6379 }
 *   ],
 *   pool: {
 *     min: 5,
 *     max: 20,
 *     acquireTimeoutMillis: 5000
 *   }
 * };
 * ```
 */
export interface RedisConfig {
    /** Redis server hostname */
    host?: string;

    /** Redis server port */
    port?: number;

    /** Redis authentication password */
    password?: string;

    /** Redis database number */
    db?: number;

    /** Enable Redis cluster mode */
    cluster?: boolean;

    /** Cluster nodes configuration */
    nodes?: Array<{ host: string; port: number }>;

    /** Sharded Redis configuration with weights */
    shards?: Array<{ host: string; port: number; weight?: number }>;

    /** Redis connection options */
    options?: {
        /** Retry delay on failover in milliseconds */
        retryDelayOnFailover?: number;

        /** Maximum retries per request */
        maxRetriesPerRequest?: number;

        /** Enable lazy connection */
        lazyConnect?: boolean;
    };

    /** Connection pool configuration */
    pool?: {
        /** Minimum connections in pool */
        min?: number;

        /** Maximum connections in pool */
        max?: number;

        /** Timeout for acquiring connection in milliseconds */
        acquireTimeoutMillis?: number;

        /** Idle timeout for connections in milliseconds */
        idleTimeoutMillis?: number;
    };

    /** Redis Sentinel configuration for high availability */
    sentinel?: {
        /** Enable Sentinel mode */
        enabled?: boolean;

        /** Master names to monitor */
        masters?: string[];

        /** Sentinel server configurations */
        sentinels?: Array<{ host: string; port: number }>;
    };
}

/**
 * Memory cache configuration.
 *
 * Configuration for in-memory caching including eviction
 * policies and memory management.
 *
 * @interface MemoryConfig
 *
 * @example
 * ```typescript
 * const memoryConfig: MemoryConfig = {
 *   maxSize: 1024 * 1024 * 50, // 50MB
 *   algorithm: 'lru',
 *   evictionPolicy: 'lru',
 *   checkPeriod: 60000, // 1 minute
 *   preallocation: true
 * };
 * ```
 */
export interface MemoryConfig {
    /** Maximum memory size in bytes */
    maxSize?: number;

    /** Heap size allocation in bytes (alias for maxSize) */
    heapSize?: number;

    /** Cleanup interval in milliseconds (alias for checkPeriod) */
    cleanupInterval?: number;

    /** Cache algorithm */
    algorithm?: "lru" | "lfu" | "fifo";

    /** Eviction policy when cache is full */
    evictionPolicy?: "lru" | "lfu" | "fifo" | "ttl";

    /** Check period for expired entries in milliseconds */
    checkPeriod?: number;

    /** Enable memory preallocation for better performance */
    preallocation?: boolean;
}

/**
 * Cache performance optimization configuration.
 *
 * Settings for optimizing cache performance including
 * batching, compression, and connection management.
 *
 * @interface CachePerformanceConfig
 *
 * @example
 * ```typescript
 * const perfConfig: CachePerformanceConfig = {
 *   batchSize: 100,
 *   compressionThreshold: 1024,
 *   hotDataThreshold: 0.8,
 *   prefetchEnabled: true,
 *   asyncWrite: true,
 *   pipeline: true
 * };
 * ```
 */
export interface CachePerformanceConfig {
    /** Batch size for bulk operations */
    batchSize?: number;

    /** Minimum size threshold for compression in bytes */
    compressionThreshold?: number;

    /** Threshold for identifying hot data (0-1) */
    hotDataThreshold?: number;

    /** Enable prefetching of related data */
    prefetchEnabled?: boolean;

    /** Enable asynchronous write operations */
    asyncWrite?: boolean;

    /** Enable Redis pipelining for better performance */
    pipeline?: boolean;

    /** Enable connection pooling */
    connectionPooling?: boolean;
}

/**
 * Cache security configuration.
 *
 * Security settings for cache including encryption,
 * access monitoring, and audit logging.
 *
 * @interface CacheSecurityConfig
 *
 * @example
 * ```typescript
 * const securityConfig: CacheSecurityConfig = {
 *   encryption: true,
 *   keyRotation: true,
 *   accessMonitoring: true,
 *   sanitization: true,
 *   auditLogging: true
 * };
 * ```
 */
export interface CacheSecurityConfig {
    /** Enable data encryption */
    encryption?: boolean;

    /** Enable automatic key rotation */
    keyRotation?: boolean;

    /** Enable access monitoring and logging */
    accessMonitoring?: boolean;

    /** Enable data sanitization */
    sanitization?: boolean;

    /** Enable audit logging */
    auditLogging?: boolean;
}

/**
 * Cache monitoring configuration.
 *
 * Settings for monitoring cache performance and health
 * including metrics collection and alerting.
 *
 * @interface CacheMonitoringConfig
 *
 * @example
 * ```typescript
 * const monitoringConfig: CacheMonitoringConfig = {
 *   enabled: true,
 *   metricsInterval: 30000, // 30 seconds
 *   alertThresholds: {
 *     memoryUsage: 0.85,
 *     hitRate: 0.7,
 *     errorRate: 0.05,
 *     latency: 100
 *   },
 *   detailed: true
 * };
 * ```
 */
export interface CacheMonitoringConfig {
    /** Enable monitoring */
    enabled?: boolean;

    /** Metrics collection interval in milliseconds */
    metricsInterval?: number;

    /** Alert thresholds for various metrics */
    alertThresholds?: {
        /** Memory usage threshold (0-1) */
        memoryUsage?: number;

        /** Cache hit rate threshold (0-1) */
        hitRate?: number;

        /** Error rate threshold (0-1) */
        errorRate?: number;

        /** Latency threshold in milliseconds */
        latency?: number;
    };

    /** Enable detailed metrics collection */
    detailed?: boolean;
}

/**
 * Cache resilience configuration.
 *
 * Settings for fault tolerance including retry logic,
 * circuit breakers, and fallback mechanisms.
 *
 * @interface CacheResilienceConfig
 *
 * @example
 * ```typescript
 * const resilienceConfig: CacheResilienceConfig = {
 *   retryAttempts: 3,
 *   retryDelay: 1000,
 *   circuitBreaker: true,
 *   fallback: true,
 *   healthCheck: true
 * };
 * ```
 */
export interface CacheResilienceConfig {
    /** Number of retry attempts for failed operations */
    retryAttempts?: number;

    /** Delay between retry attempts in milliseconds */
    retryDelay?: number;

    /** Enable circuit breaker pattern */
    circuitBreaker?: boolean;

    /** Enable fallback to alternative cache */
    fallback?: boolean;

    /** Enable health check monitoring */
    healthCheck?: boolean;
}

/**
 * Cache metrics interface.
 *
 * Real-time metrics for cache performance monitoring
 * and optimization.
 *
 * @interface CacheMetrics
 *
 * @example
 * ```typescript
 * const metrics: CacheMetrics = {
 *   hits: 1500,
 *   misses: 300,
 *   sets: 800,
 *   deletes: 50,
 *   errors: 2,
 *   operations: 2650,
 *   hitRate: 0.83,
 *   missRate: 0.17,
 *   errorRate: 0.0008,
 *   totalMemory: 52428800 // 50MB
 * };
 * ```
 */
export interface CacheMetrics {
    /** Number of cache hits */
    hits: number;

    /** Number of cache misses */
    misses: number;

    /** Number of set operations */
    sets: number;

    /** Number of delete operations */
    deletes: number;

    /** Number of errors */
    errors: number;

    /** Total number of operations */
    operations: number;

    /** Cache hit rate (calculated) */
    hitRate?: number;

    /** Cache miss rate (calculated) */
    missRate?: number;

    /** Error rate (calculated) */
    errorRate?: number;

    /** Total memory usage in bytes */
    totalMemory?: number;
}

/**
 * Cache strategy configuration.
 *
 * Defines conditional caching strategies based on
 * request characteristics and business logic.
 *
 * @interface CacheStrategy
 *
 * @example
 * ```typescript
 * const apiStrategy: CacheStrategy = {
 *   name: 'api-endpoints',
 *   condition: (req) => req.path.startsWith('/api/') && req.method === 'GET',
 *   ttl: 300, // 5 minutes
 *   tags: ['api', 'public']
 * };
 * ```
 */
export interface CacheStrategy {
    /** Strategy name for identification */
    name: string;

    /** Condition function to determine if strategy applies */
    condition: (req: Request) => boolean;

    /** TTL for this strategy in seconds */
    ttl: number;

    /** Tags for cache invalidation */
    tags?: string[];
}

