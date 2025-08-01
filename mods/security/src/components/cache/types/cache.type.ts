// Enhanced type definitions
export type CachedData = Record<string, any>;

export interface MemoryCacheEntry {
    data: string; // Encrypted and optionally compressed data
    iv: string;
    authTag: string;
    timestamp: number;
    expiresAt: number;
    accessCount: number;
    lastAccessed: number;
    compressed: boolean;
    size: number; // Size in bytes
    version: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number; // Total memory usage in bytes
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

export interface CacheOptions {
    ttl?: number; // Time to live in milliseconds
    compress?: boolean; // Force compression
    encrypt?: boolean; // Enable/disable encryption (default: true)
}

// Security event types
export type SecurityEvent =
    | "key_rotation"
    | "suspicious_access"
    | "memory_pressure"
    | "cache_overflow"
    | "encryption_failure";

// ========================================
// FILE-BASED CACHE TYPES
// ========================================

/**
 * Options for file-based cache operations
 */
export interface FileCacheOptions extends CacheOptions {
    maxCacheSize: number;
    /** Directory to store cache files (default: .data/cache) */
    directory?: string;
    /** File extension for cache files (default: .cache) */
    extension?: string;
    /** Enable atomic writes (write to temp file then rename) */
    atomic?: boolean;
    /** Enable file compression */
    compress?: boolean;
    /** Custom file naming strategy */
    namingStrategy?: "hash" | "direct" | "hierarchical" | "dated" | "flat";
    /** Maximum file size in bytes (default: 10MB) */
    maxFileSize?: number;
    /** Enable file metadata tracking */
    trackMetadata?: boolean;
}

/**
 * File cache entry metadata
 */
export interface FileCacheMetadata {
    /** Original cache key */
    key: string;
    /** File creation timestamp */
    createdAt: number;
    /** Last access timestamp */
    lastAccessed: number;
    /** Expiration timestamp */
    expiresAt: number;
    /** File size in bytes */
    size: number;
    /** Number of times accessed */
    accessCount: number;
    /** Whether data is compressed */
    compressed: boolean;
    /** Whether data is encrypted */
    encrypted: boolean;
    /** Data type information */
    dataType: string;
    /** File version for migration support */
    version: number;
}

/**
 * File cache statistics
 */
export interface FileCacheStats {
    /** Total number of cache files */
    fileCount: number;
    /** Total disk space used in bytes */
    totalSize: number;
    /** Number of cache hits */
    hits: number;
    /** Number of cache misses */
    misses: number;
    /** Number of expired files cleaned up */
    cleanups: number;
    /** Average file size in bytes */
    averageFileSize: number;
    /** Cache hit rate percentage */
    hitRate: number;
    /** Disk usage by directory */
    diskUsage: {
        used: number;
        available: number;
        percentage: number;
    };
    /** File age distribution */
    ageDistribution: {
        fresh: number; // < 1 hour
        recent: number; // 1-24 hours
        old: number; // > 24 hours
    };

    reads: number;
    writes: number;
    deletes: number;
    errors: number;
    totalFiles: number;
    avgResponseTime: number;
    lastCleanup: number;
}

/**
 * File cache cleanup options
 */
export interface FileCacheCleanupOptions {
    /** Remove expired files */
    removeExpired?: boolean;
    /** Remove files older than specified age in milliseconds */
    maxAge?: number;
    /** Maximum number of files to keep (LRU cleanup) */
    maxFiles?: number;
    /** Maximum total size in bytes (size-based cleanup) */
    maxTotalSize?: number;
    /** Dry run mode (don't actually delete files) */
    dryRun?: boolean;
}

/**
 * File cache directory structure
 */
export type FileCacheStrategy =
    | "flat" // All files in one directory
    | "hierarchical" // Nested directory structure based on hash
    | "dated" // Organized by date (YYYY/MM/DD)
    | "custom"; // User-defined structure
