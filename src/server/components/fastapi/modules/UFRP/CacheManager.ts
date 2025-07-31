/**
 * XyPrissJS - Cache Manager
 * Manages caching operations using XyPrissJS cache utilities
 */

import { Request } from "express";
import { CacheConfig, CacheStats } from "./types/CacheTypes";
import {
    FileCache,
    FileCacheOptions,
    FileCacheStats,
} from "../../../../../../mods/toolkit/src/components/cache";

export class CacheManager {
    private cache: FileCache;
    private config: CacheConfig;
    private stats: CacheStats;

    constructor(config: CacheConfig) {
        this.config = config;
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalSize: 0,
            entryCount: 0,
            hitRate: 0,
            memoryUsage: {
                used: 0,
                limit: 0,
                percentage: 0,
            },
            totalAccesses: 0,
            size: 0,
            capacity: 0,
        };

        // Initialize cache with correct options
        this.cache = new FileCache({
            maxCacheSize: config.maxSize || 10000,
            compress: config.enableCompression,
            ttl: config.defaultTTL,
            maxFileSize: config.compressionThreshold,
            trackMetadata: true,
        });
    }

    async get(key: string): Promise<any> {
        try {
            const result = await this.cache.get(key);
            if (result) {
                this.stats.hits++;
                await this.updateStats();
                return result;
            }
            this.stats.misses++;
            await this.updateStats();
            return null;
        } catch (error) {
            console.error("Cache get error:", error);
            return null;
        }
    }

    async set(
        key: string,
        value: any,
        options?: Partial<FileCacheOptions>
    ): Promise<void> {
        try {
            await this.cache.set(key, value, {
                ttl: options?.ttl || this.config.defaultTTL,
                compress: options?.compress ?? this.config.enableCompression,
                maxFileSize: this.config.compressionThreshold,
            });
            await this.updateStats();
        } catch (error) {
            console.error("Cache set error:", error);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.cache.delete(key);
            await this.updateStats();
        } catch (error) {
            console.error("Cache delete error:", error);
        }
    }

    async clear(): Promise<void> {
        try {
            await this.cache.clear();
            await this.updateStats();
        } catch (error) {
            console.error("Cache clear error:", error);
        }
    }

    generateCacheKey(req: Request): string {
        const { method, path, query, body } = req;
        return `${method}:${path}:${JSON.stringify(query)}:${JSON.stringify(
            body
        )}`;
    }

    private async updateStats(): Promise<void> {
        const cacheStats = await this.cache.getStats();
        this.stats = {
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            evictions: cacheStats.cleanups,
            totalSize: cacheStats.totalSize,
            entryCount: cacheStats.fileCount,
            hitRate: cacheStats.hitRate,
            memoryUsage: {
                used: cacheStats.diskUsage.used,
                limit:
                    cacheStats.diskUsage.available + cacheStats.diskUsage.used,
                percentage: cacheStats.diskUsage.percentage,
            },
            totalAccesses: cacheStats.reads + cacheStats.writes,
            size: cacheStats.totalSize,
            capacity: this.config.maxSize || 10000,
        };
    }

    async getStats(): Promise<CacheStats> {
        await this.updateStats();
        return this.stats;
    }

    updateConfig(newConfig: Partial<CacheConfig>): void {
        this.config = { ...this.config, ...newConfig };
        // Create a new cache instance with updated config
        this.cache = new FileCache({
            maxCacheSize: this.config.maxSize,
            compress: this.config.enableCompression,
            ttl: this.config.defaultTTL,
            maxFileSize: this.config.compressionThreshold,
            trackMetadata: true,
        });
    }
}

