import {
    CacheStats as SecurityCacheStats,
    CachedData,
    CacheOptions,
} from "../../mods/toolkit/src/components/cache/types/cache.type";

/**
 * Enhanced cache configuration
 */
export interface SecureCacheConfig {
    // Cache strategy
    strategy?: "memory" | "redis" | "hybrid" | "distributed";

    // Memory cache settings
    memory?: {
        maxSize?: number; // MB
        maxEntries?: number;
        ttl?: number; // milliseconds
        algorithm?: "lru" | "lfu" | "fifo";
        evictionPolicy?: "lru" | "lfu" | "fifo" | "ttl";
        preallocation?: boolean;
    };

    // Redis settings
    redis?: {
        host?: string;
        port?: number;
        password?: string;
        db?: number;
        cluster?: {
            enabled?: boolean;
            nodes?: Array<{ host: string; port: number }>;
            options?: any;
        };
        pool?: {
            min?: number;
            max?: number;
            acquireTimeoutMillis?: number;
        };
        sentinel?: {
            enabled?: boolean;
            sentinels?: Array<{ host: string; port: number }>;
            name?: string;
        };
    };

    // Performance settings
    performance?: {
        batchSize?: number;
        compressionThreshold?: number;
        hotDataThreshold?: number; // Access count for hot data
        prefetchEnabled?: boolean;
        asyncWrite?: boolean;
        pipeline?: boolean;
        connectionPooling?: boolean;
    };

    // Security settings
    security?: {
        encryption?: boolean;
        keyRotation?: boolean;
        accessMonitoring?: boolean;
        sanitization?: boolean;
        auditLogging?: boolean;
    };

    // Monitoring
    monitoring?: {
        enabled?: boolean;
        metricsInterval?: number;
        alertThresholds?: {
            memoryUsage?: number;
            hitRate?: number;
            errorRate?: number;
            latency?: number;
        };
        detailed?: boolean;
    };

    // Resilience settings
    resilience?: {
        retryAttempts?: number;
        retryDelay?: number;
        circuitBreaker?: boolean;
        fallback?: boolean;
        healthCheck?: boolean;
    };
}

/**
 * Enhanced cache statistics
 */
export interface EnhancedCacheStats {
    memory: SecurityCacheStats;
    redis?: {
        connected: boolean;
        commandsProcessed: number;
        operations: number;
        memoryUsage: {
            used: number;
            peak: number;
            percentage: number;
        };
        keyspaceHits: number;
        keyspaceMisses: number;
        hits: number;
        misses: number;
        hitRate: number;
        connectedClients: number;
        connections: number;
        keys: number;
        uptime: number;
        lastUpdate: number;
    };
    performance: {
        totalOperations: number;
        averageResponseTime: number;
        hotDataHitRate: number;
        compressionRatio: number;
        networkLatency: number;
    };
    security: {
        encryptedEntries: number;
        keyRotations: number;
        suspiciousAccess: number;
        securityEvents: number;
    };
}

/**
 * Cache entry metadata for hybrid strategy
 */
export interface CacheEntryMetadata {
    accessCount: number;
    lastAccessed: number;
    size: number;
    isHot: boolean;
    location: "memory" | "redis" | "both";
    tags: string[];
}

