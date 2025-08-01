/**
 * XyPrissJS Cache Engine
 * Intelligent caching system with Redis and Memory backends
 */

import { CacheConfig, RedisConfig, MemoryConfig } from "../types/types";
import { Hash } from "../../mods/security/src/core/hash";
import { XyPrissSecurity as XyPrissJS } from "../../mods/security/src/core/crypto";
import { SecureString } from "../../mods/security/src/components/secure-string";

import { SecureRandom } from "../../mods/security/src/core/random";
import { Validators } from "../../mods/security/src/core/validators";
import { EncryptionService } from "../encryption";
import Redis from "ioredis";
import * as zlib from "zlib";
import { promisify } from "util";

/**
 * Abstract base cache class
 */
export abstract class BaseCache {
    protected config: CacheConfig & { encryption?: boolean };
    protected encryptionKey: string;
    protected stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        totalMemory: 0,
        operations: 0,
    };

    constructor(config: CacheConfig = {}) {
        this.config = {
            ttl: 300,
            maxSize: 1000,
            compression: false,
            serialization: "json",
            encryption: true, // Enable encryption by default
            ...config,
        };

        // Generate a secure encryption key using XyPrissJS
        this.encryptionKey = XyPrissJS.generateSecureToken({
            length: 32,
            entropy: "high",
        });
    }

    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract get(key: string): Promise<any>;
    abstract set(key: string, value: any, ttl?: number): Promise<void>;
    abstract del(key: string): Promise<void>;
    abstract clear(): Promise<void>;
    abstract keys(pattern?: string): Promise<string[]>;
    abstract exists(key: string): Promise<boolean>;
    abstract ttl(key: string): Promise<number>;
    abstract tag(key: string, tags: string[]): Promise<void>;
    abstract invalidateTags(tags: string[]): Promise<void>;

    /**
     * Serialize data for storage with  encryption and compression
     */
    protected async serialize(data: any): Promise<string> {
        try {
            // First, serialize to JSON
            let serialized = JSON.stringify(data);
            //FIXME: sometimes, when data is really big (example: express; axios responses or something like this)
            // so we need a solution to gracefully handle this case.

            // Apply encryption using EncryptionService
            if (this.config.encryption !== false) {
                serialized = await EncryptionService.encrypt(
                    serialized,
                    this.encryptionKey,
                    {
                        algorithm: "aes-256-gcm",
                        quantumSafe: false,
                    }
                );
            }

            // Apply  compression using zlib
            if (this.config.compression) {
                const gzipAsync = promisify(zlib.gzip);
                const compressed = await gzipAsync(Buffer.from(serialized));
                return compressed.toString("base64");
            }

            return serialized;
        } catch (error) {
            this.stats.errors++;
            throw new Error(
                `Serialization failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Deserialize data from storage with  decryption and decompression
     */
    protected async deserialize(data: string): Promise<any> {
        try {
            let decompressed = data;

            // Apply decompression using zlib
            if (this.config.compression) {
                const gunzipAsync = promisify(zlib.gunzip);
                const compressedBuffer = Buffer.from(data, "base64");
                const decompressedBuffer = await gunzipAsync(compressedBuffer);
                decompressed = decompressedBuffer.toString();
            }

            // Apply decryption using EncryptionService
            if (this.config.encryption !== false) {
                try {
                    decompressed = await EncryptionService.decrypt(
                        decompressed,
                        this.encryptionKey
                    );
                } catch (decryptError) {
                    // If decryption fails, try to parse as unencrypted (backward compatibility)
                    console.warn(
                        "Cache decryption failed, treating as unencrypted data"
                    );
                }
            }

            return JSON.parse(decompressed);
        } catch (error) {
            this.stats.errors++;
            throw new Error(
                `Deserialization failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Generate cache key with namespace
     */
    protected generateKey(key: string): string {
        const namespace = "XyPriss";
        const hash = Hash.create(key, {
            algorithm: "sha256",
            outputFormat: "hex",
        }) as string;
        return `${namespace}:${hash.substring(0, 8)}:${key}`;
    }

    /**
     * Get cache statistics
     */
    public getStats(): any {
        return {
            ...this.stats,
            hitRate:
                this.stats.operations > 0
                    ? this.stats.hits / this.stats.operations
                    : 0,
            missRate:
                this.stats.operations > 0
                    ? this.stats.misses / this.stats.operations
                    : 0,
            errorRate:
                this.stats.operations > 0
                    ? this.stats.errors / this.stats.operations
                    : 0,
        };
    }

    /**
     * Reset statistics
     */
    public resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            totalMemory: 0,
            operations: 0,
        };
    }
}

/**
 * Redis Cache Implementation
 */
export class RedisCache extends BaseCache {
    private client!: Redis;
    private connected = false;
    private tagMap = new Map<string, Set<string>>(); // Tag to keys mapping

    constructor(config: CacheConfig = {}) {
        super(config);
        this.initializeRedisClient();
    }

    private initializeRedisClient(): void {
        const redisConfig = this.config.redis || {};

        // Always use single instance for now (cluster support can be added later)
        this.client = new Redis({
            host: redisConfig.host || "localhost",
            port: redisConfig.port || 6379,
            password: redisConfig.password,
            db: redisConfig.db || 0,
            retryDelayOnFailover:
                redisConfig.options?.retryDelayOnFailover || 100,
            maxRetriesPerRequest:
                redisConfig.options?.maxRetriesPerRequest || 3,
            lazyConnect: redisConfig.options?.lazyConnect || true,
            ...redisConfig.options,
        });

        this.client.on("error", (error) => {
            console.error("Redis connection error:", error);
            this.stats.errors++;
        });

        this.client.on("connect", () => {
            console.log(" Redis cache connected");
        });

        console.log(" Redis cache initialized");
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect();
            this.connected = true;
            console.log(" Redis cache connected");
        } catch (error) {
            this.stats.errors++;
            throw new Error(
                `Redis connection failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    async disconnect(): Promise<void> {
        try {
            this.client.disconnect();
            this.connected = false;
            console.log(" Redis cache disconnected");
        } catch (error) {
            this.stats.errors++;
            throw new Error(
                `Redis disconnection failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    async get(key: string): Promise<any> {
        try {
            this.stats.operations++;
            const cacheKey = this.generateKey(key);

            const data = await this.client.get(cacheKey);

            if (data !== null) {
                this.stats.hits++;
                return await this.deserialize(data);
            } else {
                this.stats.misses++;
                return null;
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        try {
            this.stats.sets++;
            const cacheKey = this.generateKey(key);
            const serialized = await this.serialize(value);

            const expiration = ttl || this.config.ttl;
            if (expiration) {
                await this.client.setex(cacheKey, expiration, serialized);
            } else {
                await this.client.set(cacheKey, serialized);
            }

            this.stats.totalMemory += serialized.length;
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async del(key: string): Promise<void> {
        try {
            this.stats.deletes++;
            const cacheKey = this.generateKey(key);
            await this.client.del(cacheKey);
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            await this.client.flushdb();
            this.tagMap.clear();
            this.resetStats();
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async keys(pattern = "*"): Promise<string[]> {
        try {
            const keys = await this.client.keys(pattern);
            return keys.filter(
                (key) => pattern === "*" || key.includes(pattern)
            );
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key);
            const result = await this.client.exists(cacheKey);
            return result === 1;
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async ttl(key: string): Promise<number> {
        try {
            const cacheKey = this.generateKey(key);
            return await this.client.ttl(cacheKey);
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async tag(key: string, tags: string[]): Promise<void> {
        try {
            const cacheKey = this.generateKey(key);

            for (const tag of tags) {
                if (!this.tagMap.has(tag)) {
                    this.tagMap.set(tag, new Set());
                }
                this.tagMap.get(tag)!.add(cacheKey);
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async invalidateTags(tags: string[]): Promise<void> {
        try {
            for (const tag of tags) {
                const keys = this.tagMap.get(tag);
                if (keys) {
                    for (const key of keys) {
                        await this.client.del(key);
                    }
                    this.tagMap.delete(tag);
                }
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }
}

/**
 * Memory Cache Implementation
 */
export class MemoryCache extends BaseCache {
    private cache = new Map<
        string,
        { value: any; expires: number; tags: string[] }
    >();
    private tagMap = new Map<string, Set<string>>();
    private cleanupInterval!: NodeJS.Timeout;

    constructor(config: CacheConfig = {}) {
        super(config);
        this.startCleanupInterval();
    }

    private startCleanupInterval(): void {
        // Clean expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 60000);
    }

    private cleanupExpired(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires > 0 && entry.expires < now) {
                this.cache.delete(key);
                this.removeFromTags(key, entry.tags);
            }
        }
    }

    private removeFromTags(key: string, tags: string[]): void {
        for (const tag of tags) {
            const keys = this.tagMap.get(tag);
            if (keys) {
                keys.delete(key);
                if (keys.size === 0) {
                    this.tagMap.delete(tag);
                }
            }
        }
    }

    async connect(): Promise<void> {
        console.log(" Memory cache connected");
    }

    async disconnect(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
        this.tagMap.clear();
        console.log(" Memory cache disconnected");
    }

    async get(key: string): Promise<any> {
        try {
            this.stats.operations++;
            const cacheKey = this.generateKey(key);
            const entry = this.cache.get(cacheKey);

            if (entry) {
                // Check if expired
                if (entry.expires > 0 && entry.expires < Date.now()) {
                    this.cache.delete(cacheKey);
                    this.removeFromTags(cacheKey, entry.tags);
                    this.stats.misses++;
                    return null;
                }

                this.stats.hits++;
                return entry.value;
            } else {
                this.stats.misses++;
                return null;
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        try {
            this.stats.sets++;
            const cacheKey = this.generateKey(key);
            const expires =
                ttl || this.config.ttl
                    ? Date.now() + (ttl || this.config.ttl!) * 1000
                    : 0;

            this.cache.set(cacheKey, {
                value,
                expires,
                tags: [],
            });

            // Enforce max size
            if (this.cache.size > this.config.maxSize!) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey) {
                    const entry = this.cache.get(firstKey);
                    this.cache.delete(firstKey);
                    if (entry) {
                        this.removeFromTags(firstKey, entry.tags);
                    }
                }
            }

            this.stats.totalMemory += JSON.stringify(value).length;
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async del(key: string): Promise<void> {
        try {
            this.stats.deletes++;
            const cacheKey = this.generateKey(key);
            const entry = this.cache.get(cacheKey);

            if (entry) {
                this.cache.delete(cacheKey);
                this.removeFromTags(cacheKey, entry.tags);
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    async clear(): Promise<void> {
        this.cache.clear();
        this.tagMap.clear();
        this.resetStats();
    }

    async keys(pattern = "*"): Promise<string[]> {
        return Array.from(this.cache.keys()).filter(
            (key) => pattern === "*" || key.includes(pattern)
        );
    }

    async exists(key: string): Promise<boolean> {
        const cacheKey = this.generateKey(key);
        return this.cache.has(cacheKey);
    }

    async ttl(key: string): Promise<number> {
        const cacheKey = this.generateKey(key);
        const entry = this.cache.get(cacheKey);

        if (entry && entry.expires > 0) {
            const remaining = Math.max(0, entry.expires - Date.now());
            return Math.floor(remaining / 1000);
        }

        return -1;
    }

    async tag(key: string, tags: string[]): Promise<void> {
        const cacheKey = this.generateKey(key);
        const entry = this.cache.get(cacheKey);

        if (entry) {
            entry.tags = [...new Set([...entry.tags, ...tags])];

            for (const tag of tags) {
                if (!this.tagMap.has(tag)) {
                    this.tagMap.set(tag, new Set());
                }
                this.tagMap.get(tag)!.add(cacheKey);
            }
        }
    }

    async invalidateTags(tags: string[]): Promise<void> {
        for (const tag of tags) {
            const keys = this.tagMap.get(tag);
            if (keys) {
                for (const key of keys) {
                    this.cache.delete(key);
                }
                this.tagMap.delete(tag);
            }
        }
    }
}

