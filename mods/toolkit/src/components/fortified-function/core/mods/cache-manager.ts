/**
 * Cache Manager for Fortified Function Core
 * Handles memoization and cache lifecycle management
 */

import { EventEmitter } from "events";
import { FortifiedFunctionOptions } from "../../types/types";

interface CacheEntry<R> {
    result: R;
    timestamp: number;
}
import { SecurityManager } from "./security-manager";
import { FortifiedUtils } from "../../utils/utils";

export class CacheManager<R> extends EventEmitter {
    private readonly memoCache = new Map<string, CacheEntry<R>>();
    private readonly options: Required<FortifiedFunctionOptions>;
    private readonly securityManager: SecurityManager;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(
        options: Required<FortifiedFunctionOptions>,
        securityManager: SecurityManager
    ) {
        super();
        this.options = options;
        this.securityManager = securityManager;

        if (this.options.autoCleanup) {
            this.setupAutoCleanup();
        }
    }

    /**
     * Check if result is cached and return it
     */
    async getCachedResult<T extends any[]>(
        args: T,
        executionId: string
    ): Promise<R | null> {
        if (!this.options.memoize) {
            return null;
        }

        const cacheKey = await this.securityManager.generateCacheKey(args);
        const cached = this.memoCache.get(cacheKey);

        if (cached) {
            this.emit("cache_hit", { executionId, cacheKey });
            return cached.result;
        }

        this.emit("cache_miss", { executionId, cacheKey });
        return null;
    }

    /**
     * Cache execution result
     */
    async cacheResult<T extends any[]>(
        args: T,
        result: R,
        executionId: string
    ): Promise<void> {
        if (!this.options.memoize) {
            return;
        }

        const cacheKey = await this.securityManager.generateCacheKey(args);
        this.memoCache.set(cacheKey, {
            result,
            timestamp: Date.now(),
        });

        this.emit("result_cached", { executionId, cacheKey });
    }

    /**
     * Clear all cached results
     */
    clearCache(): void {
        this.memoCache.clear();
        this.emit("cache_cleared");
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        entries: Array<{ key: string; timestamp: number }>;
    } {
        const entries = Array.from(this.memoCache.entries()).map(
            ([key, entry]) => ({
                key,
                timestamp: entry.timestamp,
            })
        );

        return {
            size: this.memoCache.size,
            entries,
        };
    }

    /**
     * Remove expired cache entries
     */
    cleanupExpiredEntries(maxAge: number = 300000): number {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, entry] of this.memoCache.entries()) {
            if (FortifiedUtils.isCacheEntryExpired(entry.timestamp, maxAge)) {
                this.memoCache.delete(key);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            this.emit("cache_cleanup", { removedCount });
        }

        return removedCount;
    }

    /**
     * Set up automatic cleanup of old cache entries
     */
    private setupAutoCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredEntries(300000); // 5 minutes
        }, 60000); // Check every minute
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clearCache();
        this.removeAllListeners();
    }
}

