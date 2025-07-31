/**
 * XyPrissJS - Cache Types
 * Type definitions for cache management
 */

export interface CacheConfig {
    maxSize: number;
    enableCompression: boolean;
    compressionThreshold: number;
    defaultTTL: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number;
    entryCount: number;
    hitRate: number;
    memoryUsage: {
        used: number;
        limit: number;
        percentage: number;
    };
    totalAccesses: number;
    size: number;
    capacity: number;
}

