import { CachedData, CacheOptions, CacheStats, MemoryCacheEntry } from "./cache.type";

// Enhanced cache entry with performance optimizations
export interface UltraMemoryCacheEntry extends MemoryCacheEntry {
    hotness: number; // Access frequency score
    priority: number; // User-defined priority
    tags: Set<string>; // For tag-based operations
    metadata: Record<string, any>; // User metadata
    checksum: string; // Data integrity check
}

// Advanced cache options
export interface UltraCacheOptions extends CacheOptions {
    priority?: number; // 1-10, higher = more important
    tags?: string[]; // Tags for grouping/batch operations
    metadata?: Record<string, any>; // User-defined metadata
    skipEncryption?: boolean; // For performance-critical data
    skipCompression?: boolean; // Skip compression for small data
    onEvict?: (key: string, value: CachedData) => void; // Eviction callback
}

// Performance metrics
export interface UltraStats extends CacheStats {
    averageAccessTime: number;
    compressionRatio: number;
    encryptionOverhead: number;
    hotKeys: string[];
    coldKeys: string[];
    tagStats: Map<string, number>;
}



// Enhanced cache configuration interface
export interface FastLRUConfig {
    capacity: number;
    ttl?: number; // Time to live in milliseconds
    enableStats?: boolean;
    onEvict?: (
        key: string,
        entry: MemoryCacheEntry | UltraMemoryCacheEntry
    ) => void;
}
