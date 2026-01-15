/**
 * High-performance cache for XyPriss system calls
 * Reduces process spawning overhead by caching frequently accessed system data
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

export class XyPrissCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL: number = 100; // 100ms default TTL

    /**
     * Get cached data or execute the fetcher function
     */
    public get<T>(
        key: string,
        fetcher: () => T,
        ttl: number = this.defaultTTL
    ): T {
        const now = Date.now();
        const cached = this.cache.get(key);

        // Return cached data if still valid
        if (cached && now - cached.timestamp < cached.ttl) {
            return cached.data as T;
        }

        // Fetch fresh data
        const data = fetcher();

        // Store in cache
        this.cache.set(key, {
            data,
            timestamp: now,
            ttl,
        });

        return data;
    }

    /**
     * Invalidate a specific cache entry
     */
    public invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache entries matching a pattern
     */
    public invalidatePattern(pattern: RegExp): void {
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache entries
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    public getStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                age: Date.now() - entry.timestamp,
                ttl: entry.ttl,
            })),
        };
    }
}

