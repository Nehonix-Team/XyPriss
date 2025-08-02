/***************************************************************************
 * XyPrissSecurity - Secure Array Types
 *
 * This file contains type definitions for the SecureArray modular architecture
 *
 * @author Nehonix
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

import path from "path";

// XyPrissSecurity Core imports
import { Hash } from "../../core";

// Type definitions
import type {
    CachedData,
    CacheStats,
    CacheOptions,
    FileCacheOptions,
    FileCacheStats,
    FileCacheMetadata,
    FileCacheCleanupOptions,
    FileCacheStrategy,
} from "./types/cache.type";

// UFSIMC type definitions
import {
    UltraStats,
    UltraCacheOptions,
    UltraMemoryCacheEntry,
} from "./types/UFSIMC.type";

// Cache implementation
import { SecureInMemoryCache } from "./useCache";
import { UltraFastSecureInMemoryCache } from "./UFSIMC";

// Configuration
import { DEFAULT_FILE_CACHE_CONFIG } from "./config/cache.config";
export {
    CONFIG as DEFAULT_CACHE_CONFIG,
    DEFAULT_FILE_CACHE_CONFIG,
} from "./config/cache.config";
import { FileCache } from "./cacheSys";
import { SecureCacheClient } from "./SCC";

// SecureCacheAdapter type will be imported dynamically when needed

/**
 * @fileoverview XyPrissSecurity Unified Cache System - Enterprise-Grade Caching Solution
 *
 * A comprehensive,  caching solution combining multiple strategies
 * with military-grade security and ultra-fast performance optimization.
 *
 * ## Cache Strategies
 * - **Memory Cache**: Ultra-fast in-process storage with LRU eviction
 * - **File Cache**: Persistent cross-process storage with real disk monitoring
 * - **Hybrid Cache**: Automatic optimization between memory and file storage
 * - **Redis Cache**: Distributed scalable storage (via integrations)
 *
 * ## Security Features
 * - AES-256-GCM encryption for all cached data
 * - PBKDF2 key derivation with automatic key rotation
 * - Tamper-evident storage with integrity verification
 * - Secure key management and access pattern monitoring
 * - Memory-safe operations with automatic cleanup
 *
 * ## Performance Features
 * - Zlib compression for large values (configurable threshold)
 * - LRU eviction with intelligent memory pressure management
 * - Real-time disk space monitoring and automatic cleanup
 * - Atomic file operations for data consistency
 * - Sub-millisecond cache hits with object pooling
 * - Configurable TTL with background expiration cleanup
 *
 * ## Production Features
 * - Comprehensive error handling with graceful degradation
 * - Real-time performance metrics and health monitoring
 * - Configurable naming strategies (flat, hierarchical, dated, direct)
 * - Cross-platform compatibility (Windows, macOS, Linux)
 * - Zero-dependency core with optional integrations
 * - TypeScript support with complete type definitions
 *
 * @example
 * ```typescript
 * // Quick start with default memory cache
 * import { Cache } from "xypriss-security";
 *
 * await Cache.set('user:123', { name: 'John', role: 'admin' }, { ttl: 3600000 });
 * const user = await Cache.get('user:123');
 *
 * // File-based persistent cache
 * import { FileCache } from "xypriss-security";
 *
 * const fileCache = new FileCache({
 *   directory: './cache',
 *   encrypt: true,
 *   compress: true,
 *   maxCacheSize: 1024 * 1024 * 100 // 100MB
 * });
 *
 * await fileCache.set('session:abc', sessionData, { ttl: 86400000 });
 *
 * // Hybrid cache for optimal performance
 * import { createOptimalCache } from "xypriss-security";
 *
 * const hybridCache = createOptimalCache({
 *   type: 'hybrid',
 *   config: { encrypt: true, compress: true }
 * });
 * ```
 *
 * @version 4.2.3
 * @author NEHONIX
 * @since 2024-12-19
 * @license MIT
 */

// ========================================
// MAIN CACHE EXPORTS
// ========================================

/**
 * Default secure in-memory cache instance
 *
 * Pre-configured singleton instance with optimal security settings for immediate use.
 * Features AES-256-GCM encryption, LRU eviction, and automatic memory management.
 *
 * @example
 * ```typescript
 * import { Cache } from "xypriss-security";
 *
 * // Store user session with 1-hour TTL
 * await Cache.set('session:user123', {
 *   userId: 123,
 *   permissions: ['read', 'write'],
 *   loginTime: Date.now()
 * }, { ttl: 3600000 });
 *
 * // Retrieve cached data
 * const session = await Cache.get('session:user123');
 *
 * // Check cache statistics
 * const stats = Cache.getStats();
 * console.log(`Hit rate: ${stats.hitRate}%`);
 * ```
 *
 * @since 4.2.2
 */
export const Cache = new SecureInMemoryCache();
/**
 * SecureInMemoryCache class for creating custom cache instances
 *
 * Advanced in-memory cache with military-grade encryption and intelligent
 * memory management. Ideal for high-performance applications requiring
 * secure temporary storage.
 *
 * @example
 * ```typescript
 * import { SecureInMemoryCache } from "xypriss-security";
 *
 * const customCache = new SecureInMemoryCache({
 *   maxSize: 1000,
 *   defaultTTL: 300000, // 5 minutes
 *   encryptionKey: 'your-secret-key',
 *   compressionThreshold: 1024
 * });
 *
 * await customCache.set('api:response', largeDataObject);
 * ```
 *
 * @since 4.2.2
 */
export { SecureInMemoryCache };

/**
 * UltraFastSecureInMemoryCache class for ultra-high performance caching
 *
 * Advanced ultra-fast cache with military-grade encryption, intelligent
 * memory management, and performance optimizations. Ideal for high-throughput
 * applications requiring maximum performance with security.
 *
 * @example
 * ```typescript
 * import { UltraFastSecureInMemoryCache } from "xypriss-security";
 *
 * const ultraCache = new UltraFastSecureInMemoryCache(10000);
 * await ultraCache.set('high-freq-data', data, { priority: 10 });
 * const stats = ultraCache.getUltraStats;
 * ```
 *
 * @since 4.2.3
 */
export { UltraFastSecureInMemoryCache };

/**
 * FileCache class for persistent storage
 *
 * Enterprise-grade file-based cache with real disk space monitoring,
 * atomic operations, and configurable storage strategies.
 *
 * @example
 * ```typescript
 * import { FileCache } from "xypriss-security";
 *
 * const fileCache = new FileCache({
 *   directory: './app-cache',
 *   encrypt: true,
 *   compress: true,
 *   namingStrategy: 'hierarchical',
 *   maxCacheSize: 500 * 1024 * 1024 // 500MB
 * });
 *
 * // Get real-time cache statistics including disk usage
 * const stats = await fileCache.getStats();
 * console.log(`Disk usage: ${stats.diskUsage.percentage}%`);
 * ```
 *
 * @since 4.2.0
 */
export { FileCache };

/**
 * TypeScript type definitions for cache operations
 *
 * Complete type definitions for all cache interfaces, ensuring
 * type safety and excellent developer experience.
 *
 * @since 4.2.2
 */
export type {
    CachedData,
    CacheStats,
    CacheOptions,
    FileCacheOptions,
    FileCacheStats,
    FileCacheMetadata,
    FileCacheCleanupOptions,
    FileCacheStrategy,
    UltraStats,
    UltraCacheOptions,
    UltraMemoryCacheEntry,
};

// ========================================
// FILE CACHE UTILITIES
// ========================================

/**
 * Generate a secure file path for cache storage
 *
 * Creates secure, collision-resistant file paths using configurable naming strategies.
 * All keys are hashed using SHA-256 to prevent directory traversal attacks and
 * ensure consistent path generation across platforms.
 *
 * @param key - The cache key to generate a path for
 * @param options - Optional configuration for path generation
 * @returns Secure file path for the given key
 *
 * @example
 * ```typescript
 * import { generateFilePath } from "xypriss-security";
 *
 * // Hierarchical structure (recommended for large caches)
 * const path1 = generateFilePath('user:123', {
 *   namingStrategy: 'hierarchical',
 *   directory: './cache'
 * });
 * // Result: ./cache/a1/b2/a1b2c3d4...cache
 *
 * // Date-based organization (good for time-series data)
 * const path2 = generateFilePath('daily-report', {
 *   namingStrategy: 'dated',
 *   directory: './reports'
 * });
 * // Result: ./reports/2024/12/19/hash...cache
 *
 * // Direct naming (human-readable, limited special chars)
 * const path3 = generateFilePath('config-settings', {
 *   namingStrategy: 'direct',
 *   directory: './config'
 * });
 * // Result: ./config/config-settings.cache
 * ```
 *
 * @since 4.2.2
 */
export const generateFilePath = (
    key: string,
    options: Partial<FileCacheOptions> = {}
): string => {
    const config = { ...DEFAULT_FILE_CACHE_CONFIG, ...options };
    const sanitized = Hash.create(key, { outputFormat: "hex" }) as string;

    let filePath: string;

    switch (config.namingStrategy) {
        case "hierarchical":
            const dir = sanitized.substring(0, 2);
            const subdir = sanitized.substring(2, 4);
            filePath = path.resolve(
                config.directory,
                dir,
                subdir,
                `${sanitized}${config.extension}`
            );
            break;

        case "dated":
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            filePath = path.resolve(
                config.directory,
                String(year),
                month,
                day,
                `${sanitized}${config.extension}`
            );
            break;

        case "direct":
            const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
            filePath = path.resolve(
                config.directory,
                `${safeKey}${config.extension}`
            );
            break;

        case "flat":
        default:
            filePath = path.resolve(
                config.directory,
                `${sanitized}${config.extension}`
            );
            break;
    }

    return filePath;
};

// ========================================
// FILE CACHE EXPORTS
// ========================================

/**
 * Default FileCache instance with lazy initialization
 *
 * Pre-configured file cache instance optimized for general use cases.
 * Features encryption, compression, and real disk space monitoring.
 * Uses lazy initialization to avoid circular dependency issues.
 *
 * @example
 * ```typescript
 * import { defaultFileCache } from "xypriss-security";
 *
 * // Store large dataset with compression
 * await defaultFileCache.set('analytics:daily', bigDataSet, {
 *   ttl: 86400000, // 24 hours
 *   compress: true
 * });
 *
 * // Check cache health
 * const info = await defaultFileCache.getCacheInfo();
 * if (!info.health.healthy) {
 *   console.warn('Cache issues:', info.health.issues);
 * }
 * ```
 *
 * @since 4.2.0
 */
let _defaultFileCache: FileCache | null = null;
export const defaultFileCache = new Proxy({} as FileCache, {
    get(target, prop) {
        if (!_defaultFileCache) {
            _defaultFileCache = new FileCache();
        }
        const value = (_defaultFileCache as any)[prop];
        return typeof value === "function"
            ? value.bind(_defaultFileCache)
            : value;
    },
});

/**
 * Write data to file cache with automatic optimization
 *
 * Stores data in the file cache with intelligent compression and encryption.
 * Automatically handles large objects and provides atomic write operations.
 *
 * @param key - Unique identifier for the cached data
 * @param data - Data to cache (any serializable type)
 * @param options - Optional cache configuration
 * @returns Promise resolving to true if successful
 *
 * @example
 * ```typescript
 * import { writeFileCache } from "xypriss-security";
 *
 * // Cache user profile with encryption
 * const success = await writeFileCache('profile:user123', {
 *   name: 'John Doe',
 *   preferences: { theme: 'dark', lang: 'en' }
 * }, {
 *   encrypt: true,
 *   ttl: 3600000 // 1 hour
 * });
 * ```
 *
 * @since 4.2.2
 */
export const writeFileCache = async (
    key: string,
    data: CachedData,
    options?: Partial<FileCacheOptions>
): Promise<boolean> => {
    return defaultFileCache.set(key, data, options);
};

/**
 * Read data from file cache with automatic decryption
 *
 * Retrieves and automatically decrypts/decompresses cached data.
 * Returns null for expired or non-existent entries.
 *
 * @param key - Unique identifier for the cached data
 * @returns Promise resolving to cached data or null
 *
 * @example
 * ```typescript
 * import { readFileCache } from "xypriss-security";
 *
 * const userData = await readFileCache('profile:user123');
 * if (userData) {
 *   console.log('Welcome back,', userData.name);
 * } else {
 *   console.log('Cache miss - loading from database');
 * }
 * ```
 *
 * @since 4.2.2
 */
export const readFileCache = async (
    key: string
): Promise<CachedData | null> => {
    return defaultFileCache.get(key);
};

/**
 * Remove specific entry from file cache
 *
 * Permanently deletes a cache entry and updates disk usage statistics.
 * Safe to call on non-existent keys.
 *
 * @param key - Unique identifier for the cached data
 * @returns Promise resolving to true if entry was deleted
 *
 * @example
 * ```typescript
 * import { removeFileCache } from "xypriss-security";
 *
 * // Remove expired session
 * const removed = await removeFileCache('session:expired123');
 * console.log(removed ? 'Session cleared' : 'Session not found');
 * ```
 *
 * @since 4.2.2
 */
export const removeFileCache = async (key: string): Promise<boolean> => {
    return defaultFileCache.delete(key);
};

/**
 * Check if file cache entry exists and is valid
 *
 * Verifies cache entry existence without loading the data.
 * Automatically removes expired entries during check.
 *
 * @param key - Unique identifier for the cached data
 * @returns Promise resolving to true if entry exists and is valid
 *
 * @example
 * ```typescript
 * import { hasFileCache } from "xypriss-security";
 *
 * if (await hasFileCache('config:app-settings')) {
 *   const config = await readFileCache('config:app-settings');
 * } else {
 *   // Load from default configuration
 * }
 * ```
 *
 * @since 4.2.2
 */
export const hasFileCache = async (key: string): Promise<boolean> => {
    return defaultFileCache.has(key);
};

/**
 * Clear all file cache entries
 *
 * Removes all cached files and resets statistics.
 * Use with caution in production environments.
 *
 * @example
 * ```typescript
 * import { clearFileCache } from "xypriss-security";
 *
 * // Clear cache during maintenance
 * await clearFileCache();
 * console.log('Cache cleared successfully');
 * ```
 *
 * @since 4.2.2
 */
export const clearFileCache = async (): Promise<void> => {
    return defaultFileCache.clear();
};

/**
 * Get comprehensive file cache statistics
 *
 * Returns real-time statistics including disk usage, hit rates,
 * and performance metrics with health assessment.
 *
 * @returns Promise resolving to detailed cache statistics
 *
 * @example
 * ```typescript
 * import { getFileCacheStats } from "xypriss-security";
 *
 * const stats = await getFileCacheStats();
 * console.log(`Cache efficiency: ${stats.hitRate}%`);
 * console.log(`Disk usage: ${stats.diskUsage.percentage}%`);
 * console.log(`Average response time: ${stats.avgResponseTime}ms`);
 * ```
 *
 * @since 4.2.2
 */
export const getFileCacheStats = async (): Promise<FileCacheStats> => {
    return defaultFileCache.getStats();
};

/**
 * Clean up expired file cache entries
 *
 * Removes expired entries and optimizes disk usage.
 * Automatically runs in background but can be triggered manually.
 *
 * @param options - Optional cleanup configuration
 * @returns Promise resolving to cleanup results
 *
 * @example
 * ```typescript
 * import { cleanupFileCache } from "xypriss-security";
 *
 * const result = await cleanupFileCache();
 * console.log(`Cleaned ${result.cleaned} files, freed ${result.totalSize} bytes`);
 * ```
 *
 * @since 4.2.2
 */
export const cleanupFileCache = async (
    options?: Partial<FileCacheCleanupOptions>
) => {
    return defaultFileCache.cleanup(options);
};

// ========================================
// MEMORY CACHE API
// ========================================

/**
 * Read data from memory cache with fallback
 *
 * Retrieves data from the default memory cache instance.
 * Returns empty object if key is not found (legacy behavior).
 *
 * @param args - Arguments passed to Cache.get()
 * @returns Promise resolving to cached data or empty object
 *
 * @example
 * ```typescript
 * import { readCache } from "xypriss-security";
 *
 * const sessionData = await readCache('session:user123');
 * console.log('User ID:', sessionData.userId || 'Not found');
 * ```
 *
 * @since 4.2.2
 */
export const readCache = async (...args: Parameters<typeof Cache.get>) => {
    const result = await Cache.get(...args);
    return result || {};
};

/**
 * Write data to memory cache
 *
 * Stores data in the default memory cache instance with encryption
 * and automatic compression for large values.
 *
 * @param args - Arguments passed to Cache.set()
 * @returns Promise resolving to true if successful
 *
 * @example
 * ```typescript
 * import { writeCache } from "xypriss-security";
 *
 * await writeCache('user:profile', userData, { ttl: 1800000 }); // 30 min
 * ```
 *
 * @since 4.2.2
 */
export const writeCache = async (...args: Parameters<typeof Cache.set>) => {
    return Cache.set(...args);
};

/**
 * Get memory cache performance statistics
 *
 * Returns comprehensive statistics including hit rates, memory usage,
 * and performance metrics for the default cache instance.
 *
 * @returns Current cache statistics
 *
 * @example
 * ```typescript
 * import { getCacheStats } from "xypriss-security";
 *
 * const stats = getCacheStats();
 * console.log(`Hit rate: ${stats.hitRate}%`);
 * console.log(`Memory usage: ${stats.memoryUsage} bytes`);
 * ```
 *
 * @since 4.2.2
 */
export const getCacheStats = (): CacheStats => {
    return Cache.getStats;
};

/**
 * Remove entry from memory cache
 *
 * Immediately removes a cache entry and frees associated memory.
 * Safe to call on non-existent keys.
 *
 * @param key - Cache key to remove
 * @returns Promise that resolves when deletion is complete
 *
 * @example
 * ```typescript
 * import { expireCache } from "xypriss-security";
 *
 * await expireCache('session:expired123');
 * console.log('Session removed from cache');
 * ```
 *
 * @since 4.2.2
 */
export const expireCache = (key: string): Promise<void> => {
    Cache.delete(key);
    return Promise.resolve();
};

/**
 * Clear all memory cache entries
 *
 * Removes all cached data and resets statistics.
 * Use with caution in production environments.
 *
 * @returns Promise that resolves when cache is cleared
 *
 * @example
 * ```typescript
 * import { clearAllCache } from "xypriss-security";
 *
 * await clearAllCache();
 * console.log('Memory cache cleared');
 * ```
 *
 * @since 4.2.2
 */
export const clearAllCache = (): Promise<void> => {
    Cache.clear();
    return Promise.resolve();
};

/**
 * Legacy filepath function
 * @deprecated use generateFilePath instead
 */
export const filepath = (origin: string): string => {
    return generateFilePath(origin, { namingStrategy: "hierarchical" });
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Create optimal cache instance based on performance requirements
 *
 * Factory function that creates the most suitable cache instance for your use case.
 * Automatically configures security settings and performance optimizations.
 *
 * @param options - Cache configuration options
 * @param options.type - Cache strategy: 'memory' (fastest), 'file' (persistent), 'hybrid' (balanced)
 * @param options.config - Optional file cache configuration (ignored for memory-only)
 * @returns Configured cache instance optimized for the specified requirements
 *
 * @example
 * ```typescript
 * import { createOptimalCache } from "xypriss-security";
 *
 * // Ultra-fast memory cache for session data
 * const sessionCache = createOptimalCache({ type: 'memory' });
 *
 * // Persistent file cache for application data
 * const appCache = createOptimalCache({
 *   type: 'file',
 *   config: {
 *     directory: './app-cache',
 *     encrypt: true,
 *     maxCacheSize: 100 * 1024 * 1024 // 100MB
 *   }
 * });
 *
 * // Hybrid cache for optimal performance and persistence
 * const hybridCache = createOptimalCache({
 *   type: 'hybrid',
 *   config: { encrypt: true, compress: true }
 * });
 *
 * // Use hybrid cache (memory-first with file backup)
 * await hybridCache.set('user:123', userData);
 * const user = await hybridCache.get('user:123'); // Served from memory
 * ```
 *
 * @since 4.2.2
 */
export const createOptimalCache = (options: {
    type: "memory" | "file" | "hybrid";
    config?: Partial<FileCacheOptions>;
}) => {
    switch (options.type) {
        case "memory":
            return new SecureInMemoryCache();
        case "file":
            return new FileCache(options.config);
        case "hybrid":
            // Return both memory cache and file cache in a wrapper
            return {
                memory: new SecureInMemoryCache(),
                file: new FileCache(options.config),
                async get(key: string) {
                    // Try memory first, then file
                    let result = await this.memory.get(key);
                    if (!result) {
                        result = await this.file.get(key);
                        if (result) {
                            // Cache in memory for faster access
                            await this.memory.set(key, result);
                        }
                    }
                    return result;
                },
                async set(key: string, value: CachedData, options?: any) {
                    // Set in both caches
                    const memoryResult = await this.memory.set(
                        key,
                        value,
                        options
                    );
                    const fileResult = await this.file.set(key, value, options);
                    return memoryResult && fileResult;
                },
            };
        default:
            return new SecureInMemoryCache();
    }
};

// ========================================
// ADDITIONAL EXPORTS
// ========================================

/**
 * Legacy file cache function names for backward compatibility
 * @deprecated Use the new function names for better clarity
 */
export const deleteFileCache = removeFileCache;

// ========================================
// GRACEFUL SHUTDOWN HANDLING
// ========================================

/**
 * Graceful shutdown handler for cache system
 *
 * Automatically registered to handle SIGTERM and SIGINT signals.
 * Ensures all cache operations complete before process termination.
 *
 * @internal
 * @since 4.2.2
 */
const handleGracefulShutdown = () => {
    console.log("Shutting down XyPrissSecurity CS gracefully...");
    try {
        Cache.shutdown();
    } catch (error) {
        console.error("Error during cache shutdown:", error);
    }
};

// Register shutdown handlers
process.on("SIGTERM", handleGracefulShutdown);
process.on("SIGINT", handleGracefulShutdown);

// ========================================
// MODULE METADATA
// ========================================

/**
 * Cache module version and metadata
 * @since 4.2.0
 */
export const CACHE_VERSION = "4.2.3";
export const CACHE_BUILD_DATE = "2025-04-06";

/**
 * Default export for convenience
 * @since 4.2.2
 */
export default {
    Cache,
    get FileCache() {
        return FileCache;
    },
    SecureInMemoryCache,
    createOptimalCache,
    generateFilePath,
    writeFileCache,
    readFileCache,
    removeFileCache,
    hasFileCache,
    clearFileCache,
    getFileCacheStats,
    cleanupFileCache,
    writeCache,
    readCache,
    getCacheStats,
    expireCache,
    clearAllCache,
    defaultFileCache,
    CACHE_VERSION,
    CACHE_BUILD_DATE,
};

/**
 * Redis configuration options
 */
export interface RedisConfig {
    /** Redis server hostname */
    host: string;
    /** Redis server port */
    port: number;
    /** Redis authentication password */
    password?: string;
    /** Redis database number */
    db?: number;
    /** Connection timeout in milliseconds */
    connectTimeout?: number;
    /** Command timeout in milliseconds */
    commandTimeout?: number;
    /** Redis Cluster configuration */
    cluster?: {
        enabled: boolean;
        nodes: Array<{ host: string; port: number }>;
    };
    /** Redis Sentinel configuration */
    sentinel?: {
        enabled: boolean;
        masters: string[];
        sentinels: Array<{ host: string; port: number }>;
    };
}

/**
 * Memory cache configuration options
 */
export interface MemoryConfig {
    /** Maximum memory cache size in MB */
    maxSize: number;
    /** Maximum number of cache entries */
    maxEntries: number;
    /** LRU eviction policy settings */
    evictionPolicy?: "lru" | "lfu" | "fifo";
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
    /** Enable AES-256-GCM encryption */
    encryption: boolean;
    /** Enable automatic key rotation */
    keyRotation?: boolean;
    /** Custom encryption key (base64 encoded) */
    customKey?: string;
}

/**
 * Monitoring and health check configuration
 */
export interface MonitoringConfig {
    /** Enable performance metrics collection */
    enabled: boolean;
    /** Metrics collection interval in milliseconds */
    interval?: number;
    /** Enable health checks */
    healthChecks?: boolean;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
    /** Cache strategy: memory, redis, or hybrid */
    strategy: "memory" | "redis" | "hybrid";
    /** Default TTL in seconds */
    ttl?: number;
    /** Redis configuration (required for redis and hybrid strategies) */
    redis?: RedisConfig;
    /** Memory configuration (required for memory and hybrid strategies) */
    memory?: MemoryConfig;
    /** Security configuration */
    security?: SecurityConfig;
    /** Monitoring configuration */
    monitoring?: MonitoringConfig;
    /** Enable compression */
    compression?: boolean;
}

/**
 * Cache options for set operations
 */
export interface CacheSetOptions {
    /** Time to live in seconds */
    ttl?: number;
    /** Array of tags for bulk invalidation */
    tags?: string[];
}

/**
 * Secure cache statistics interface
 */
export interface SecureCacheStats {
    memory: {
        hitRate: number;
        missRate: number;
        size: number;
        entries: number;
        maxSize: number;
        maxEntries: number;
    };
    redis?: {
        hitRate: number;
        missRate: number;
        connected: boolean;
        memoryUsage: number;
        keyCount: number;
    };
    operations: {
        total: number;
        gets: number;
        sets: number;
        deletes: number;
        errors: number;
    };
    performance: {
        avgResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
    };
}

/**
 * Cache health status interface
 */
export interface CacheHealth {
    status: "healthy" | "degraded" | "unhealthy";
    details: {
        redis?: {
            connected: boolean;
            latency?: number;
            error?: string;
        };
        memory?: {
            usage: number;
            available: number;
        };
        errors?: string[];
        lastCheck: Date;
    };
}

/**
 * Fortified function interface for public API to avoid TypeScript issues with private members
 */
export interface IFortifiedFunction<T extends any[], R> {
    (...args: T): R;
    getStats(): any;
    getAnalyticsData(): any;
    getOptimizationSuggestions(): any[];
    getPerformanceTrends(): any;
    detectAnomalies(): any[];
    getDetailedMetrics(): any;
    clearCache(): void;
    getCacheStats(): { hits: number; misses: number; size: number };
    warmCache(args: T[]): Promise<void>;
    handleMemoryPressure(level: "low" | "medium" | "high"): void;
    optimizePerformance(): void;
    updateOptions(newOptions: any): void;
    getConfiguration(): any;
}

/**
 * Cache interface for public API to avoid TypeScript issues with private members
 */
export interface ICacheAdapter {
    get<T = any>(key: string): Promise<T | null>;
    set<T = any>(
        key: string,
        value: T,
        options?: CacheSetOptions
    ): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    clear(): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getStats(): Promise<SecureCacheStats>;
    mget<T = any>(keys: string[]): Promise<Record<string, T>>;
    mset<T = any>(
        entries: Record<string, T> | Array<[string, T]>,
        options?: CacheSetOptions
    ): Promise<boolean>;
    invalidateByTags(tags: string[]): Promise<number>;
    getTTL(key: string): Promise<number>;
    expire(key: string, ttl: number): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
    getHealth(): CacheHealth;
    memoize<TArgs extends any[], TResult>(
        keyGenerator: (...args: TArgs) => string,
        computeFunction: (...args: TArgs) => TResult | Promise<TResult>,
        options?: CacheSetOptions
    ): (...args: TArgs) => Promise<TResult>;
}

/**
 * Creates a type-safe fortified function wrapper
 *
 * This function wraps the `func` utility to provide proper TypeScript types
 * for export scenarios, avoiding the "cannot be named" error.
 *
 * @param fn - The function to xypriss
 * @param options - Optional fortification options
 * @returns A type-safe fortified function
 *
 * @example
 * ```typescript
 * import { createTypedFortifiedFunction } from "xypriss-security";
 *
 * const somme = createTypedFortifiedFunction((a: number, b: number): number => {
 *   return a + b;
 * });
 *
 * export const mathOps = { somme }; // ✅ No TypeScript errors
 * ```
 */
export function createTypedFortifiedFunction<T extends any[], R>(
    fn: (...args: T) => R,
    options?: any
): IFortifiedFunction<T, R> {
    // Import func dynamically to avoid circular dependencies
    const { func } = require("../fortified-function");
    return func(fn, options) as IFortifiedFunction<T, R>;
}

/**
 * Short alias for SecureCacheClient for convenience
 *
 * @example
 * ```typescript
 * import { SCC } from "xypriss-security";
 *
 * const cache = new SCC({
 *   strategy: "redis",
 *   redis: { host: "localhost", port: 6379 }
 * });
 * ```
 */
export { SecureCacheClient as SCC };

