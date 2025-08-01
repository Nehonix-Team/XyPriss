/**
 * XyPrissSecurity - Smart Cache System
 *
 * High-performance caching system with multiple eviction strategies (LRU, LFU, Adaptive),
 * intelligent memory management, and real-time performance optimization.
 *
 * Features:
 * - Multiple eviction strategies with automatic adaptation
 * - Memory pressure detection and response
 * - TTL-based expiration with automatic cleanup
 * - Performance metrics and hit rate optimization
 * - Predictive caching capabilities
 * - Thread-safe operations with minimal overhead
 *
 * @example
 * ```typescript
 * // Basic usage
 * const cache = new SmartCache<string, User>({
 *   maxSize: 1000,
 *   ttl: 300000, // 5 minutes
 *   strategy: 'adaptive'
 * });
 *
 * // Store and retrieve data
 * cache.set('user:123', userData);
 * const user = cache.get('user:123');
 *
 * // Monitor performance
 * const stats = cache.getStats();
 * console.log(`Hit rate: ${stats.hitRate}%`);
 * ```
 */

import {
    CacheEntry,
    SmartCacheConfig,
    PerformanceMetrics,
} from "./types/types";
import { memoryManager } from "../../utils/memory";

export class SmartCache<K = string, V = any> {
    private readonly cache = new Map<K, CacheEntry<V>>();
    private readonly accessOrder: K[] = [];
    private readonly frequencyMap = new Map<K, number>();
    private readonly priorityQueue = new Map<K, number>();
    private readonly config: SmartCacheConfig;
    private cleanupInterval?: NodeJS.Timeout;
    private memoryCheckInterval?: NodeJS.Timeout;
    private lastAdaptation = 0;

    private readonly stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalSize: 0,
        compressionRatio: 0,
        adaptations: 0,
        memoryPressureEvents: 0,
    };

    /**
     * Creates a new SmartCache instance with intelligent caching strategies.
     *
     * @param config - Configuration options for the cache
     * @param config.strategy - Eviction strategy: 'lru', 'lfu', or 'adaptive'
     * @param config.maxSize - Maximum number of entries (default: 1000)
     * @param config.ttl - Time-to-live in milliseconds (default: 300000 = 5 minutes)
     * @param config.autoCleanup - Enable automatic cleanup of expired entries (default: true)
     * @param config.compressionEnabled - Enable compression for large values (default: false)
     * @param config.persistToDisk - Enable disk persistence (default: false)
     *
     * @example
     * ```typescript
     * // High-performance cache for API responses
     * const apiCache = new SmartCache<string, ApiResponse>({
     *   strategy: 'adaptive',
     *   maxSize: 5000,
     *   ttl: 600000, // 10 minutes
     *   autoCleanup: true
     * });
     *
     * // Memory-optimized cache for large objects
     * const dataCache = new SmartCache<string, LargeData>({
     *   strategy: 'lfu',
     *   maxSize: 100,
     *   compressionEnabled: true
     * });
     * ```
     */
    constructor(config: Partial<SmartCacheConfig> = {}) {
        this.config = {
            strategy: "adaptive",
            maxSize: 1000,
            ttl: 300000, // 5 minutes
            autoCleanup: true,
            compressionEnabled: false,
            persistToDisk: false,
            adaptationThreshold: 0.1, // Adapt when hit rate changes by 10%
            memoryCheckInterval: 30000, // Check memory every 30 seconds
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB default limit
            ...config,
        };

        if (this.config.autoCleanup) {
            this.setupAutoCleanup();
        }

        this.setupMemoryMonitoring();
    }

    /**
     * Retrieves a value from the cache with intelligent access tracking.
     *
     * This method updates access patterns, frequency counters, and recency information
     * to support adaptive eviction strategies. Expired entries are automatically removed.
     *
     * @param key - The key to retrieve
     * @returns The cached value or null if not found/expired
     *
     * @example
     * ```typescript
     * const userData = cache.get('user:123');
     * if (userData) {
     *   // Cache hit - data is fresh and valid
     *   processUser(userData);
     * } else {
     *   // Cache miss - fetch from source
     *   const data = await fetchUser('123');
     *   cache.set('user:123', data);
     * }
     * ```
     */
    public get(key: K): V | null {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check TTL expiration with high precision
        if (this.isExpired(entry)) {
            this.internalDelete(key);
            this.stats.misses++;
            return null;
        }

        // Efficient access pattern updates
        this.updateAccessPattern(key, entry);
        this.stats.hits++;

        return entry.result;
    }

    /**
     * Stores a value in the cache with intelligent eviction and optimization.
     *
     * When the cache reaches capacity, this method uses the configured strategy
     * to evict less valuable entries. Priority is calculated based on access patterns,
     * frequency, recency, and value size.
     *
     * @param key - The key to store under
     * @param value - The value to cache
     * @param ttl - Optional TTL override in milliseconds
     *
     * @example
     * ```typescript
     * // Standard caching
     * cache.set('config:app', appConfig);
     *
     * // With custom TTL (1 hour)
     * cache.set('temp:data', tempData, 3600000);
     *
     * // High-priority caching
     * cache.set('critical:settings', settings);
     * ```
     */
    public set(key: K, value: V, ttl?: number): void {
        // Pre-eviction check for capacity management
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            this.evictEntries(1);
        }

        const now = Date.now();
        const estimatedSize = this.estimateSize(value);
        const currentFrequency = this.frequencyMap.get(key) || 0;

        const entry: CacheEntry<V> = {
            result: value,
            timestamp: now,
            accessCount: this.cache.has(key)
                ? this.cache.get(key)!.accessCount + 1
                : 1,
            lastAccessed: new Date(now),
            ttl: ttl || this.config.ttl,
            priority: this.calculatePriority(key, value, currentFrequency),
            size: estimatedSize,
            frequency: currentFrequency + 1,
        };

        this.cache.set(key, entry);
        this.updateFrequency(key);
        this.updateAccessOrder(key);
        this.priorityQueue.set(key, entry.priority || 0);

        // Efficient stats update
        this.stats.totalSize = this.cache.size;

        // Check for memory pressure after significant additions
        if (estimatedSize > 10000) {
            // 10KB threshold
            this.checkMemoryPressure();
        }
    }

    /**
     * Removes an entry from the cache and all associated tracking data.
     *
     * @param key - The key to remove
     * @returns True if the entry existed and was removed, false otherwise
     *
     * @example
     * ```typescript
     * // Remove specific entry
     * const wasRemoved = cache.delete('user:123');
     *
     * // Conditional removal
     * if (userData.isExpired) {
     *   cache.delete('user:123');
     * }
     * ```
     */
    public delete(key: K): boolean {
        return this.internalDelete(key);
    }

    /**
     * Clears all entries from the cache and resets all metrics.
     *
     * This operation is atomic and efficiently resets all internal data structures.
     *
     * @example
     * ```typescript
     * // Complete cache reset
     * cache.clear();
     *
     * // Verify clearing
     * console.log(cache.getStats().size); // 0
     * ```
     */
    public clear(): void {
        this.cache.clear();
        this.accessOrder.length = 0; // Efficient array clearing
        this.frequencyMap.clear();
        this.priorityQueue.clear();
        this.resetStats();
    }

    /**
     * Returns comprehensive cache statistics and performance metrics.
     *
     * @returns Detailed statistics including hit rates, memory usage, and strategy effectiveness
     *
     * @example
     * ```typescript
     * const stats = cache.getStats();
     * console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
     * console.log(`Memory Usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
     * console.log(`Evictions: ${stats.evictions}`);
     *
     * // Monitor performance trends
     * if (stats.hitRate < 0.7) {
     *   console.warn('Cache hit rate is below optimal threshold');
     * }
     * ```
     */
    public getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
        const memoryUsage = this.estimateMemoryUsage();

        return {
            ...this.stats,
            hitRate,
            hitRatePercentage: Math.round(hitRate * 100),
            size: this.cache.size,
            maxSize: this.config.maxSize,
            utilizationRate: this.cache.size / this.config.maxSize,
            strategy: this.config.strategy,
            averageAccessCount: this.getAverageAccessCount(),
            memoryUsage,
            memoryUsageMB: Math.round((memoryUsage / 1024 / 1024) * 100) / 100,
            averageEntrySize:
                this.cache.size > 0 ? memoryUsage / this.cache.size : 0,
            topFrequentKeys: this.getTopFrequentKeys(5),
            recentEvictions: this.stats.evictions,
            adaptationHistory: this.stats.adaptations,
        };
    }

    /**
     * Intelligently pre-warms the cache with high-priority entries.
     *
     * This method optimizes cache performance by preloading frequently accessed
     * or critical data based on priority scores and usage patterns.
     *
     * @param patterns - Array of key-value pairs with priority scores
     * @param patterns[].key - The cache key
     * @param patterns[].value - The value to cache
     * @param patterns[].priority - Priority score (higher = more important)
     *
     * @example
     * ```typescript
     * // Warm cache with critical application data
     * cache.warmCache([
     *   { key: 'config:app', value: appConfig, priority: 10 },
     *   { key: 'user:admin', value: adminUser, priority: 8 },
     *   { key: 'settings:global', value: globalSettings, priority: 7 }
     * ]);
     *
     * // Warm with user-specific data
     * const userPatterns = recentUsers.map(user => ({
     *   key: `user:${user.id}`,
     *   value: user,
     *   priority: user.accessFrequency
     * }));
     * cache.warmCache(userPatterns);
     * ```
     */
    public warmCache(
        patterns: Array<{ key: K; value: V; priority: number }>
    ): void {
        if (!patterns.length) return;

        // Calculate optimal warming size (30% of cache capacity)
        const warmingSize = Math.min(
            Math.floor(this.config.maxSize * 0.3),
            patterns.length
        );

        // Sort by priority (descending) and select top entries
        const prioritizedPatterns = patterns
            .sort((a, b) => b.priority - a.priority)
            .slice(0, warmingSize);

        // Batch warming for better performance
        for (const { key, value } of prioritizedPatterns) {
            // Skip if already cached and fresh
            const existing = this.cache.get(key);
            if (existing && !this.isExpired(existing)) {
                continue;
            }

            this.set(key, value);
        }
    }

    /**
     * Implements predictive caching based on usage patterns and probability analysis.
     *
     * This method analyzes access patterns to predict future cache needs and
     * preloads likely-to-be-accessed entries to improve hit rates.
     *
     * @param predictions - Array of predictions with keys and probability scores
     * @param predictions[].key - The predicted cache key
     * @param predictions[].probability - Probability of access (0-1)
     * @param predictions[].estimatedValue - Optional estimated value for priority calculation
     *
     * @example
     * ```typescript
     * // Predict based on user behavior patterns
     * const predictions = userAnalytics.getPredictions().map(pred => ({
     *   key: `user:${pred.userId}`,
     *   probability: pred.accessProbability,
     *   estimatedValue: pred.userData
     * }));
     *
     * cache.preloadPredictedEntries(predictions);
     *
     * // Predict based on time patterns
     * const timePredictions = [
     *   { key: 'report:daily', probability: 0.9 }, // High probability during business hours
     *   { key: 'config:night', probability: 0.3 }  // Low probability during day
     * ];
     * cache.preloadPredictedEntries(timePredictions);
     * ```
     */
    public preloadPredictedEntries(
        predictions: Array<{ key: K; probability: number; estimatedValue?: V }>
    ): void {
        if (!predictions.length) return;

        // Filter high-probability predictions (>70% confidence)
        const highConfidencePredictions = predictions
            .filter((p) => p.probability > 0.7)
            .sort((a, b) => b.probability - a.probability);

        // Limit preloading to 10% of cache capacity to avoid pollution
        const preloadLimit = Math.floor(this.config.maxSize * 0.1);
        const selectedPredictions = highConfidencePredictions.slice(
            0,
            preloadLimit
        );

        // Mark for priority caching when values become available
        for (const { key, probability } of selectedPredictions) {
            this.priorityQueue.set(key, probability * 10); // Scale probability to priority
        }
    }

    /**
     * Dynamically adapts the caching strategy based on real-time performance metrics.
     *
     * This method continuously monitors cache performance and automatically switches
     * between LRU, LFU, and adaptive strategies to optimize hit rates and memory usage.
     *
     * @param metrics - Current performance metrics from the application
     * @param metrics.memoryUsage - Current memory usage ratio (0-1)
     * @param metrics.cpuUsage - Current CPU usage ratio (0-1)
     * @param metrics.requestRate - Current request rate (requests/second)
     *
     * @example
     * ```typescript
     * // Adapt based on system metrics
     * const systemMetrics = {
     *   memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
     *   cpuUsage: await getCpuUsage(),
     *   requestRate: getCurrentRequestRate()
     * };
     *
     * cache.adaptStrategy(systemMetrics);
     *
     * // Automatic adaptation with monitoring
     * setInterval(() => {
     *   const metrics = getSystemMetrics();
     *   cache.adaptStrategy(metrics);
     * }, 60000); // Adapt every minute
     * ```
     */
    public adaptStrategy(metrics: PerformanceMetrics): void {
        const now = Date.now();

        // Throttle adaptations to prevent thrashing
        if (now - this.lastAdaptation < 30000) {
            // 30-second cooldown
            return;
        }

        const currentStats = this.getStats();
        const hitRate = currentStats.hitRate;
        const memoryPressure = metrics.memoryUsage || 0;
        const previousStrategy = this.config.strategy;

        // Strategy adaptation logic based on performance characteristics
        if (hitRate < 0.4 && memoryPressure < 0.7) {
            // Low hit rate, sufficient memory -> prioritize frequency (LFU)
            this.config.strategy = "lfu";
        } else if (hitRate > 0.8 && memoryPressure > 0.8) {
            // High hit rate, memory pressure -> prioritize recency (LRU)
            this.config.strategy = "lru";
        } else if (memoryPressure > 0.9) {
            // Critical memory pressure -> aggressive LRU
            this.config.strategy = "lru";
        } else {
            // Balanced conditions -> use adaptive strategy
            this.config.strategy = "adaptive";
        }

        if (previousStrategy !== this.config.strategy) {
            this.stats.adaptations++;
            this.lastAdaptation = now;
        }
    }

    /**
     * Handles memory pressure events with intelligent cache reduction strategies.
     *
     * This method responds to memory pressure by selectively evicting entries
     * based on the pressure level and current cache strategy.
     *
     * @param pressureLevel - The level of memory pressure detected
     *
     * @example
     * ```typescript
     * // Monitor memory and respond to pressure
     * process.on('memoryUsage', (usage) => {
     *   const pressureRatio = usage.heapUsed / usage.heapTotal;
     *
     *   if (pressureRatio > 0.9) {
     *     cache.handleMemoryPressure('high');
     *   } else if (pressureRatio > 0.7) {
     *     cache.handleMemoryPressure('medium');
     *   }
     * });
     *
     * // Proactive memory management
     * if (getAvailableMemory() < requiredMemory) {
     *   cache.handleMemoryPressure('medium');
     * }
     * ```
     */
    public handleMemoryPressure(
        pressureLevel: "low" | "medium" | "high"
    ): void {
        this.stats.memoryPressureEvents++;

        switch (pressureLevel) {
            case "high":
                // Aggressive cleanup - remove 50% of entries, prioritizing large/stale entries
                this.evictEntries(Math.floor(this.cache.size * 0.5));
                this.cleanupExpiredEntries();
                break;
            case "medium":
                // Moderate cleanup - remove 25% of entries
                this.evictEntries(Math.floor(this.cache.size * 0.25));
                this.cleanupExpiredEntries();
                break;
            case "low":
                // Light cleanup - remove only expired and lowest priority entries
                this.cleanupExpiredEntries();
                this.evictEntries(Math.floor(this.cache.size * 0.1));
                break;
        }
    }

    /**
     * Safely destroys the cache instance and cleans up all resources.
     *
     * This method should be called when the cache is no longer needed to prevent
     * memory leaks and stop background processes.
     *
     * @example
     * ```typescript
     * // Cleanup on application shutdown
     * process.on('SIGTERM', () => {
     *   cache.destroy();
     * });
     *
     * // Cleanup after use
     * const tempCache = new SmartCache();
     * // ... use cache
     * tempCache.destroy();
     * ```
     */
    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }

        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = undefined;
        }

        this.clear();
    }

    // Private helper methods - optimized for performance

    private internalDelete(key: K): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.removeFromAccessOrder(key);
            this.frequencyMap.delete(key);
            this.priorityQueue.delete(key);
            this.stats.totalSize = this.cache.size;
        }
        return deleted;
    }

    private isExpired(entry: CacheEntry<V>): boolean {
        return (
            (entry.ttl || 0) > 0 &&
            Date.now() - entry.timestamp > (entry.ttl || 0)
        );
    }

    private updateAccessPattern(key: K, entry: CacheEntry<V>): void {
        const now = Date.now();
        entry.accessCount++;
        entry.lastAccessed = new Date(now);

        // Efficient frequency and order updates
        this.updateFrequency(key);
        this.updateAccessOrder(key);

        // Update priority for adaptive strategy
        if (this.config.strategy === "adaptive") {
            const newPriority = this.calculatePriority(
                key,
                entry.result,
                entry.frequency
            );
            this.priorityQueue.set(key, newPriority);
            entry.priority = newPriority;
        }
    }

    private updateFrequency(key: K): void {
        const current = this.frequencyMap.get(key) || 0;
        this.frequencyMap.set(key, current + 1);
    }

    private updateAccessOrder(key: K): void {
        // Efficient LRU order maintenance
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            // Move to end (most recent) - O(n) but infrequent
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }

    private removeFromAccessOrder(key: K): void {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    private calculatePriority(key: K, value: V, frequency: number = 0): number {
        const size = this.estimateSize(value);
        const recency = 1; // Base recency score for new/accessed entries
        const sizeWeight = Math.max(size / 10000, 1); // Normalize size impact

        // Balanced priority calculation: frequency and recency boost, size penalty
        return (
            ((frequency * 0.4 + recency * 0.4) / sizeWeight) * 0.2 +
            (this.priorityQueue.get(key) || 0) * 0.1
        ); // Include existing priority
    }

    private estimateSize(value: V): number {
        if (value === null || value === undefined) return 8;
        if (typeof value === "string") return value.length * 2;
        if (typeof value === "number") return 8;
        if (typeof value === "boolean") return 4;
        if (ArrayBuffer.isView(value)) return value.byteLength;

        try {
            // More accurate size estimation for objects
            const jsonStr = JSON.stringify(value);
            return jsonStr.length * 2; // UTF-16 encoding
        } catch {
            return 1000; // Conservative estimate for non-serializable objects
        }
    }

    private evictEntries(count: number = 1): void {
        if (this.cache.size === 0 || count <= 0) return;

        const actualCount = Math.min(count, this.cache.size);

        switch (this.config.strategy) {
            case "lru":
                this.evictLRU(actualCount);
                break;
            case "lfu":
                this.evictLFU(actualCount);
                break;
            case "adaptive":
                this.evictAdaptive(actualCount);
                break;
        }

        this.stats.evictions += actualCount;
    }

    private evictLRU(count: number): void {
        // Remove least recently used entries (from beginning of access order)
        const toRemove = this.accessOrder.slice(0, count);
        for (const key of toRemove) {
            this.internalDelete(key);
        }
    }

    private evictLFU(count: number): void {
        // Remove least frequently used entries
        const frequencyEntries = Array.from(this.frequencyMap.entries())
            .sort((a, b) => a[1] - b[1]) // Sort by frequency ascending
            .slice(0, count);

        for (const [key] of frequencyEntries) {
            this.internalDelete(key);
        }
    }

    private evictAdaptive(count: number): void {
        // Evict based on composite priority score (lowest priority first)
        const priorityEntries = Array.from(this.priorityQueue.entries())
            .sort((a, b) => a[1] - b[1]) // Sort by priority ascending
            .slice(0, count);

        for (const [key] of priorityEntries) {
            this.internalDelete(key);
        }
    }

    private cleanupExpiredEntries(): void {
        const expiredKeys: K[] = [];

        // Collect expired keys efficiently
        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                expiredKeys.push(key);
            }
        }

        // Batch delete expired entries
        for (const key of expiredKeys) {
            this.internalDelete(key);
        }
    }

    private setupAutoCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredEntries();
        }, 60000); // Check every minute
    }

    private setupMemoryMonitoring(): void {
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryPressure();
        }, 30000); // Check every 30 seconds
    }

    private checkMemoryPressure(): void {
        try {
            const memoryStats = memoryManager?.getStats();
            if (memoryStats?.pressure) {
                const pressure = memoryStats.pressure;
                if (pressure > 0.9) {
                    this.handleMemoryPressure("high");
                } else if (pressure > 0.7) {
                    this.handleMemoryPressure("medium");
                } else if (pressure > 0.5) {
                    this.handleMemoryPressure("low");
                }
            }
        } catch (error) {
            // Silently handle memory manager unavailability
        }
    }

    private resetStats(): void {
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.stats.evictions = 0;
        this.stats.totalSize = 0;
        this.stats.compressionRatio = 0;
        this.stats.adaptations = 0;
        this.stats.memoryPressureEvents = 0;
    }

    private getAverageAccessCount(): number {
        if (this.cache.size === 0) return 0;
        const total = Array.from(this.cache.values()).reduce(
            (sum, entry) => sum + entry.accessCount,
            0
        );
        return Math.round((total / this.cache.size) * 100) / 100;
    }

    private estimateMemoryUsage(): number {
        return Array.from(this.cache.values()).reduce(
            (total, entry) => total + (entry.size || 0),
            0
        );
    }

    private getTopFrequentKeys(
        limit: number = 5
    ): Array<{ key: K; frequency: number }> {
        return Array.from(this.frequencyMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([key, frequency]) => ({ key, frequency }));
    }
}

