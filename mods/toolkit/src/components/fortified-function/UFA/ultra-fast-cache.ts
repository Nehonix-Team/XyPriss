/**
 * XyPrissSecurity - Ultra-Fast Predictive Cache
 * Caching system with machine learning-based prediction
 * Optimized for real-world applications
 */

import { AccessPattern, UltraFastCacheEntry, CacheStats } from "../types/types";

export class UltraFastCache<K, V> {
    private readonly cache = new Map<K, UltraFastCacheEntry<V>>();
    private readonly maxSize: number;
    private readonly maxMemory: number;
    private currentMemory = 0;

    // **PREDICTION ENGINE**
    private readonly accessPatterns = new Map<K, AccessPattern>();
    private readonly hotKeys = new Set<K>();
    private readonly coldKeys = new Set<K>();

    // **PERFORMANCE COUNTERS**
    private readonly stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        predictions: 0,
        correctPredictions: 0,
        compressions: 0,
        decompressions: 0,
        totalOperations: 0,
        avgAccessTime: 0,
    };

    // **OPTIMIZATION**
    private optimizationTimer?: NodeJS.Timeout;
    private readonly compressionThreshold: number;

    constructor(
        maxSize: number = 10000,
        maxMemory: number = 100 * 1024 * 1024,
        compressionThreshold: number = 1024
    ) {
        this.maxSize = maxSize;
        this.maxMemory = maxMemory;
        this.compressionThreshold = compressionThreshold;

        // Start background optimization
        this.startOptimizationLoop();
    }

    /**
     * **PERFORMANCE: Ultra-fast get with prediction**
     */
    public get(key: K): V | null {
        const startTime = Date.now();
        this.stats.totalOperations++;

        const entry = this.cache.get(key);

        if (entry) {
            // Check TTL
            if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
                this.cache.delete(key);
                this.currentMemory -= entry.size;
                this.stats.misses++;
                this.updateStats(startTime);
                return null;
            }

            // Cache hit - update access pattern
            this.updateAccessPattern(key, entry);
            this.stats.hits++;

            // Move to hot keys if frequently accessed
            if (entry.accessCount > 5) {
                // Reduced threshold
                this.hotKeys.add(key);
                this.coldKeys.delete(key);
            }

            this.updateStats(startTime);

            // Decompress if needed
            let value = entry.value;
            if (entry.compressed) {
                value = this.decompress(value);
                this.stats.decompressions++;
            }

            return value;
        }

        // Cache miss
        this.stats.misses++;
        this.coldKeys.add(key);
        this.updateStats(startTime);
        return null;
    }

    /**
     * **PERFORMANCE: Ultra-fast set with intelligent eviction**
     */
    public set(key: K, value: V, ttl?: number): void {
        const startTime = Date.now();
        this.stats.totalOperations++;

        const size = this.estimateSize(value);

        // Check if we need to evict entries
        if (
            this.cache.size >= this.maxSize ||
            this.currentMemory + size > this.maxMemory
        ) {
            this.intelligentEviction(size);
        }

        // Compress large values
        let finalValue = value;
        let compressed = false;
        if (size > this.compressionThreshold) {
            const compressedValue = this.compress(value);
            const compressedSize = this.estimateSize(compressedValue);

            // Only use compression if it saves significant space
            if (compressedSize < size * 0.8) {
                finalValue = compressedValue;
                compressed = true;
                this.stats.compressions++;
            }
        }

        const now = Date.now();
        const entry: UltraFastCacheEntry<V> = {
            value: finalValue,
            timestamp: now,
            accessCount: 1,
            lastAccessed: now,
            accessPattern: [now],
            predictedNextAccess: now + (ttl || 300000), // Default 5 minutes
            priority: this.calculatePriority(key),
            size: this.estimateSize(finalValue),
            compressed,
            ttl,
        };

        // Remove old entry if it exists
        const oldEntry = this.cache.get(key);
        if (oldEntry) {
            this.currentMemory -= oldEntry.size;
        }

        this.cache.set(key, entry);
        this.currentMemory += entry.size;

        // Initialize access pattern
        this.initializeAccessPattern(key);

        this.updateStats(startTime);
    }

    /**
     * **UTILITY: Check if key exists**
     */
    public has(key: K): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        // Check TTL
        if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
            this.cache.delete(key);
            this.currentMemory -= entry.size;
            return false;
        }

        return true;
    }

    /**
     * **UTILITY: Delete entry**
     */
    public delete(key: K): boolean {
        const entry = this.cache.get(key);
        if (entry) {
            this.cache.delete(key);
            this.currentMemory -= entry.size;
            this.hotKeys.delete(key);
            this.coldKeys.delete(key);
            this.accessPatterns.delete(key);
            return true;
        }
        return false;
    }

    /**
     * **PREDICTION ENGINE: Predict which keys will be accessed next**
     */
    public predictNextAccess(count: number = 10): K[] {
        const predictions: Array<{ key: K; probability: number }> = [];

        for (const [key, pattern] of this.accessPatterns.entries()) {
            if (this.cache.has(key)) {
                // Only predict for existing keys
                const probability = this.calculateAccessProbability(pattern);
                predictions.push({ key, probability });
            }
        }

        // Sort by probability and return top predictions
        return predictions
            .sort((a, b) => b.probability - a.probability)
            .slice(0, count)
            .map((p) => p.key);
    }

    /**
     * **PREDICTION ENGINE: Warm cache with predicted entries**
     */
    public async warmCache(dataLoader: (key: K) => Promise<V>): Promise<void> {
        const predictions = this.predictNextAccess(10); // Reduced from 20
        this.stats.predictions += predictions.length;

        const warmingPromises = predictions.map(async (key) => {
            if (!this.cache.has(key)) {
                try {
                    const value = await dataLoader(key);
                    this.set(key, value);
                    this.stats.correctPredictions++;
                } catch (error) {
                    // Silently handle errors to avoid noise
                }
            }
        });

        await Promise.all(warmingPromises);
    }

    /**
     * **INTELLIGENT EVICTION: Smart eviction based on access patterns**
     */
    private intelligentEviction(requiredSpace: number): void {
        const candidates: Array<{ key: K; score: number }> = [];

        for (const [key, entry] of this.cache.entries()) {
            const score = this.calculateEvictionScore(entry);
            candidates.push({ key, score });
        }

        // Sort by eviction score (lower = more likely to evict)
        candidates.sort((a, b) => a.score - b.score);

        let freedSpace = 0;
        let evicted = 0;
        const maxEvictions = Math.min(
            candidates.length,
            Math.ceil(this.cache.size * 0.1)
        ); // Max 10% eviction

        for (const candidate of candidates) {
            if (freedSpace >= requiredSpace || evicted >= maxEvictions) break;

            const entry = this.cache.get(candidate.key);
            if (entry) {
                this.cache.delete(candidate.key);
                this.currentMemory -= entry.size;
                freedSpace += entry.size;
                evicted++;
                this.stats.evictions++;

                // Clean up related data
                this.hotKeys.delete(candidate.key);
                this.coldKeys.delete(candidate.key);
                this.accessPatterns.delete(candidate.key);
            }
        }
    }

    /**
     * **PATTERN ANALYSIS: Calculate access probability**
     */
    private calculateAccessProbability(pattern: AccessPattern): number {
        const now = Date.now();

        // Base probability on frequency (normalized)
        let probability = Math.min(pattern.frequency / 10, 1.0);

        // Adjust for trend
        switch (pattern.trend) {
            case "increasing":
                probability *= 1.3;
                break;
            case "decreasing":
                probability *= 0.7;
                break;
        }

        // Apply confidence factor
        probability *= pattern.confidence;

        return Math.min(probability, 1.0);
    }

    /**
     * **PATTERN ANALYSIS: Update access pattern for key**
     */
    private updateAccessPattern(key: K, entry: UltraFastCacheEntry<V>): void {
        const now = Date.now();
        entry.accessCount++;
        entry.lastAccessed = now;

        // Update access pattern (keep last 5 accesses)
        entry.accessPattern.push(now);
        if (entry.accessPattern.length > 5) {
            entry.accessPattern.shift();
        }

        // Update prediction model
        this.updatePredictionModel(key, entry);

        // Predict next access time
        entry.predictedNextAccess = this.predictNextAccessTime(
            entry.accessPattern
        );
    }

    /**
     * **PATTERN ANALYSIS: Initialize access pattern for new key**
     */
    private initializeAccessPattern(key: K): void {
        this.accessPatterns.set(key, {
            key: String(key),
            frequency: 1,
            periodicity: 0,
            trend: "stable",
            confidence: 0.5,
        });
    }

    /**
     * **MACHINE LEARNING: Update prediction model**
     */
    private updatePredictionModel(key: K, entry: UltraFastCacheEntry<V>): void {
        const pattern = this.accessPatterns.get(key);
        if (!pattern) return;

        // Calculate frequency (accesses per minute)
        const timeSpan =
            entry.accessPattern.length > 1
                ? entry.accessPattern[entry.accessPattern.length - 1] -
                  entry.accessPattern[0]
                : 60000; // Default 1 minute

        pattern.frequency = (entry.accessPattern.length / timeSpan) * 60000;

        // Determine trend (simplified)
        if (entry.accessPattern.length >= 3) {
            const recent = entry.accessPattern.slice(-2);
            const older = entry.accessPattern.slice(0, 2);

            if (recent.length === 2 && older.length === 2) {
                const recentInterval = recent[1] - recent[0];
                const olderInterval = older[1] - older[0];

                if (recentInterval < olderInterval * 0.8) {
                    pattern.trend = "increasing";
                    pattern.confidence = Math.min(
                        pattern.confidence + 0.1,
                        1.0
                    );
                } else if (recentInterval > olderInterval * 1.2) {
                    pattern.trend = "decreasing";
                    pattern.confidence = Math.max(
                        pattern.confidence - 0.05,
                        0.1
                    );
                } else {
                    pattern.trend = "stable";
                }
            }
        }
    }

    /**
     * **PREDICTION: Predict next access time**
     */
    private predictNextAccessTime(accessPattern: number[]): number {
        if (accessPattern.length < 2) {
            return Date.now() + 300000; // Default 5 minutes
        }

        // Calculate average interval
        const intervals = [];
        for (let i = 1; i < accessPattern.length; i++) {
            intervals.push(accessPattern[i] - accessPattern[i - 1]);
        }

        const avgInterval =
            intervals.reduce((a, b) => a + b, 0) / intervals.length;
        return accessPattern[accessPattern.length - 1] + avgInterval;
    }

    /**
     * **OPTIMIZATION: Calculate priority for cache entry**
     */
    private calculatePriority(key: K): number {
        let priority = 1.0;

        // Boost priority for hot keys
        if (this.hotKeys.has(key)) {
            priority *= 1.3;
        }

        return priority;
    }

    /**
     * **OPTIMIZATION: Calculate eviction score**
     */
    private calculateEvictionScore(entry: UltraFastCacheEntry<V>): number {
        const now = Date.now();
        const age = now - entry.timestamp;
        const timeSinceAccess = now - entry.lastAccessed;

        // Lower score = more likely to evict
        let score = entry.priority;

        // Penalize old entries
        score -= age / 3600000; // Age in hours

        // Penalize recently unused entries
        score -= timeSinceAccess / 1800000; // Time since access in 30-min units

        // Boost score for frequently accessed entries
        score += Math.log(entry.accessCount + 1);

        // Penalize large entries
        score -= entry.size / 10240; // Every 10KB

        return Math.max(score, 0);
    }

    /**
     * **COMPRESSION: Simple string compression using built-in methods**
     */
    private compress<T>(value: T): T {
        try {
            if (
                typeof value === "string" &&
                value.length > this.compressionThreshold
            ) {
                // Simple compression using JSON + base64 (placeholder for real compression)
                const compressed = btoa(encodeURIComponent(value));
                if (compressed.length < value.length * 0.9) {
                    return compressed as unknown as T;
                }
            } else if (typeof value === "object" && value !== null) {
                const serialized = JSON.stringify(value);
                if (serialized.length > this.compressionThreshold) {
                    const compressed = btoa(encodeURIComponent(serialized));
                    if (compressed.length < serialized.length * 0.9) {
                        return { __compressed: compressed } as unknown as T;
                    }
                }
            }
        } catch (error) {
            // Compression failed, return original value
        }

        return value;
    }

    /**
     * **DECOMPRESSION: Simple decompression**
     */
    private decompress<T>(value: T): T {
        try {
            if (
                typeof value === "object" &&
                value !== null &&
                "__compressed" in value
            ) {
                const compressedData = (value as any).__compressed;
                const decompressed = decodeURIComponent(atob(compressedData));
                return JSON.parse(decompressed) as T;
            } else if (typeof value === "string") {
                try {
                    const decompressed = decodeURIComponent(atob(value));
                    return decompressed as unknown as T;
                } catch {
                    return value;
                }
            }
        } catch (error) {
            // Decompression failed, return as-is
        }

        return value;
    }

    /**
     * **UTILITY: Estimate memory size of value**
     */
    private estimateSize<T>(value: T): number {
        if (typeof value === "string") {
            return value.length * 2; // UTF-16
        }
        if (typeof value === "number") {
            return 8;
        }
        if (typeof value === "boolean") {
            return 1;
        }
        if (value instanceof ArrayBuffer) {
            return value.byteLength;
        }

        // Estimate for objects
        try {
            return JSON.stringify(value).length * 2;
        } catch {
            return 1024; // Default estimate
        }
    }

    /**
     * **BACKGROUND OPTIMIZATION: Start optimization loop**
     */
    private startOptimizationLoop(): void {
        this.optimizationTimer = setInterval(() => {
            this.optimizeCache();
        }, 60000); // Every minute (reduced frequency)
    }

    /**
     * **BACKGROUND OPTIMIZATION: Optimize cache performance**
     */
    private optimizeCache(): void {
        const now = Date.now();
        let cleaned = 0;

        // Remove expired entries
        for (const [key, entry] of this.cache.entries()) {
            // Remove expired TTL entries
            if (entry.ttl && now > entry.timestamp + entry.ttl) {
                this.cache.delete(key);
                this.currentMemory -= entry.size;
                this.hotKeys.delete(key);
                this.coldKeys.delete(key);
                this.accessPatterns.delete(key);
                this.stats.evictions++;
                cleaned++;
            }
            // Remove very old predictions
            else if (entry.predictedNextAccess < now - 600000) {
                // 10 minutes past prediction
                const timeSinceAccess = now - entry.lastAccessed;
                if (timeSinceAccess > 1800000) {
                    // 30 minutes since last access
                    this.cache.delete(key);
                    this.currentMemory -= entry.size;
                    this.hotKeys.delete(key);
                    this.coldKeys.delete(key);
                    this.accessPatterns.delete(key);
                    this.stats.evictions++;
                    cleaned++;
                }
            }
        }
    }

    /**
     * **PERFORMANCE: Update statistics**
     */
    private updateStats(startTime: number): void {
        const operationTime = Date.now() - startTime;
        this.stats.avgAccessTime =
            (this.stats.avgAccessTime * (this.stats.totalOperations - 1) +
                operationTime) /
            this.stats.totalOperations;
    }

    /**
     * **MONITORING: Get comprehensive statistics**
     */
    public getStats(): CacheStats {
        const hitRate =
            this.stats.hits + this.stats.misses > 0
                ? (this.stats.hits / (this.stats.hits + this.stats.misses)) *
                  100
                : 0;

        const predictionAccuracy =
            this.stats.predictions > 0
                ? (this.stats.correctPredictions / this.stats.predictions) * 100
                : 0;

        return {
            ...this.stats,
            hitRate: hitRate.toFixed(1) + "%",
            predictionAccuracy: predictionAccuracy.toFixed(1) + "%",
            cacheSize: this.cache.size,
            memoryUsage: this.currentMemory,
            memoryUtilization:
                ((this.currentMemory / this.maxMemory) * 100).toFixed(1) + "%",
            hotKeys: this.hotKeys.size,
            coldKeys: this.coldKeys.size,
            patterns: this.accessPatterns.size,
        };
    }

    /**
     * **UTILITY: Get all keys**
     */
    public keys(): K[] {
        return Array.from(this.cache.keys());
    }

    /**
     * **UTILITY: Get cache size**
     */
    public size(): number {
        return this.cache.size;
    }

    /**
     * **CLEANUP: Clear cache and free resources**
     */
    public clear(): void {
        this.cache.clear();
        this.accessPatterns.clear();
        this.hotKeys.clear();
        this.coldKeys.clear();
        this.currentMemory = 0;
    }

    /**
     * **CLEANUP: Destroy cache and free all resources**
     */
    public destroy(): void {
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
            this.optimizationTimer = undefined;
        }
        this.clear();
    }
}

