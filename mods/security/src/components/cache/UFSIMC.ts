/**
 * Ultra-Fast Secure In-Memory Cache System (UFSIMC)
 * Enhanced version with extreme performance optimizations, advanced security, and user-friendly features
 */
import * as crypto from "crypto";
import { promisify } from "util";
import zlib from "zlib";
import { EventEmitter } from "events";
import { SecureRandom } from "../../core/random";
import {
    CachedData,
    CacheOptions,
    CacheStats,
    MemoryCacheEntry,
} from "./types/cache.type";
import { CONFIG } from "./config/cache.config";
import { FastLRU } from "./FastLRU";
import type {
    UltraStats,
    UltraCacheOptions,
    UltraMemoryCacheEntry,
} from "./types/UFSIMC.type";

// Simple logger interface for UFSIMC
interface SimpleLogger {
    warn(component: string, message: string, ...args: any[]): void;
    securityWarning(message: string, ...args: any[]): void;
}

/**
 * Ultra-Fast Secure In-Memory Cache (UFSIMC)
 * Extends SIMC with extreme performance optimizations and advanced features
 */
class UFSIMC extends EventEmitter {
    private lru: FastLRU;
    private keyHashMap = new Map<string, string>(); // Original key -> hashed key mapping
    private tagIndex = new Map<string, Set<string>>(); // Tag -> keys mapping
    private priorityQueues = new Array(11)
        .fill(null)
        .map(() => new Set<string>());
    private hotnessDecayTimer?: NodeJS.Timeout;

    private stats: UltraStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalSize: 0,
        entryCount: 0,
        hitRate: 0,
        memoryUsage: {
            used: 0,
            limit: CONFIG.MAX_CACHE_SIZE_MB * 1024 * 1024,
            percentage: 0,
        },
        totalAccesses: 0,
        size: 0,
        capacity: CONFIG.MAX_ENTRIES,
        averageAccessTime: 0,
        compressionRatio: 0,
        encryptionOverhead: 0,
        hotKeys: [],
        coldKeys: [],
        tagStats: new Map(),
    };

    private encryptionKey: Buffer = Buffer.alloc(0);
    private keyRotationTimer?: NodeJS.Timeout;
    private cleanupTimer?: NodeJS.Timeout;
    private securityTimer?: NodeJS.Timeout;
    private performanceTimer?: NodeJS.Timeout;

    // Performance optimizations
    private encryptionPool: crypto.Cipher[] = [];
    private accessTimes: number[] = [];

    // Security enhancements
    private accessPatterns = new Map<string, number[]>();
    private rateLimiter = new Map<
        string,
        { count: number; resetTime: number }
    >();
    private integrityCheck = true;
    private anomalyThreshold = 1000;

    // Logger instance
    private logger?: SimpleLogger;

    constructor(
        maxEntries: number = CONFIG.MAX_ENTRIES,
        logger?: SimpleLogger
    ) {
        super();
        this.logger = logger;
        this.lru = new FastLRU(maxEntries);
        this.initializeEncryption();
        this.startMaintenanceTasks();
        this.warmUpPools();
        this.startPerformanceMonitoring();
    }

    /**
     * Warm up cipher pools for better performance
     */
    private warmUpPools(): void {
        // Pre-create cipher instances
        for (let i = 0; i < 10; i++) {
            try {
                const iv = crypto.randomBytes(16);
                this.encryptionPool.push(
                    crypto.createCipheriv(
                        CONFIG.ALGORITHM,
                        this.encryptionKey,
                        iv
                    )
                );
            } catch (error) {
                // Pool will be created on-demand
            }
        }
    }

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        this.performanceTimer = setInterval(() => {
            this.updatePerformanceMetrics();
            this.optimizeHotness();
        }, 5000); // Every 5 seconds

        this.hotnessDecayTimer = setInterval(() => {
            this.decayHotness();
        }, 60000); // Every minute
    }

    /**
     * Enhanced encryption initialization with key derivation
     */
    private initializeEncryption(): void {
        try {
            if (process.env.ENC_SECRET_KEY) {
                this.encryptionKey = Buffer.from(
                    process.env.ENC_SECRET_KEY,
                    CONFIG.ENCODING
                );
            } else if (
                process.env.ENC_SECRET_SEED &&
                process.env.ENC_SECRET_SALT
            ) {
                this.encryptionKey = crypto.pbkdf2Sync(
                    process.env.ENC_SECRET_SEED,
                    process.env.ENC_SECRET_SALT,
                    CONFIG.KEY_ITERATIONS,
                    CONFIG.KEY_LENGTH,
                    "sha256"
                );
            } else {
                const warningMsg =
                    "UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY or (ENC_SECRET_SEED and ENC_SECRET_SALT)";
                if (this.logger) {
                    this.logger.securityWarning(warningMsg);
                } else {
                    console.warn(warningMsg);
                }
                this.encryptionKey = SecureRandom.getRandomBytes(
                    CONFIG.KEY_LENGTH
                ).getBuffer();
            }

            this.emit("key_rotation", {
                timestamp: Date.now(),
                reason: "initialization",
            });
        } catch (error) {
            console.error("Failed to initialize encryption:", error);
            throw new Error("Cache initialization failed");
        }
    }

    /**
     * Ultra-fast key validation and hashing
     */
    private validateAndHashKey(key: string): string {
        if (!key || typeof key !== "string") {
            throw new Error("Cache key must be a non-empty string");
        }

        if (key.length > CONFIG.MAX_KEY_LENGTH) {
            throw new Error(
                `Cache key too long (max ${CONFIG.MAX_KEY_LENGTH} chars)`
            );
        }

        // Use cached hash if available
        let hashedKey = this.keyHashMap.get(key);
        if (!hashedKey) {
            const salt = process.env.ENC_SECRET_SALT || "default-salt";
            hashedKey = crypto
                .pbkdf2Sync(key, salt, 1000, 32, "sha256")
                .toString(CONFIG.ENCODING);
            this.keyHashMap.set(key, hashedKey);
        }

        return hashedKey;
    }

    /**
     * High-performance compression with adaptive algorithms
     */
    private async smartCompress(
        data: string
    ): Promise<{ data: string; compressed: boolean; ratio: number }> {
        if (data.length < CONFIG.COMPRESSION_THRESHOLD_BYTES) {
            return { data, compressed: false, ratio: 1 };
        }

        try {
            const originalSize = data.length;

            // Try different compression based on data characteristics
            let compressed: Buffer;
            if (data.includes("{") || data.includes("[")) {
                // JSON-like data - use deflate
                compressed = await promisify(zlib.deflate)(
                    Buffer.from(data, "utf8")
                );
            } else {
                // Text data - use gzip
                compressed = await promisify(zlib.gzip)(
                    Buffer.from(data, "utf8")
                );
            }

            const compressedString = compressed.toString(CONFIG.ENCODING);
            const ratio = originalSize / compressedString.length;

            if (ratio > 1.1) {
                // At least 10% compression
                return { data: compressedString, compressed: true, ratio };
            }
        } catch (error) {
            if (this.logger) {
                this.logger.warn("cache", "Compression failed:", error);
            } else {
                console.warn("Compression failed:", error);
            }
        }

        return { data, compressed: false, ratio: 1 };
    }

    /**
     * Smart decompression
     */
    private async smartDecompress(
        data: string,
        compressed: boolean
    ): Promise<string> {
        if (!compressed) return data;

        try {
            const buffer = Buffer.from(data, CONFIG.ENCODING);

            // Try gzip first, then deflate
            try {
                const decompressed = await promisify(zlib.gunzip)(buffer);
                return decompressed.toString("utf8");
            } catch {
                const decompressed = await promisify(zlib.inflate)(buffer);
                return decompressed.toString("utf8");
            }
        } catch (error) {
            console.error("Decompression failed:", error);
            throw new Error("Data decompression failed");
        }
    }

    /**
     * High-performance encryption with pooling
     */
    private fastEncrypt(data: string): {
        encrypted: string;
        iv: string;
        authTag: string;
    } {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(
                CONFIG.ALGORITHM,
                this.encryptionKey,
                iv
            );

            let encrypted = cipher.update(data, "utf8", CONFIG.ENCODING);
            encrypted += cipher.final(CONFIG.ENCODING);

            const authTag = cipher.getAuthTag().toString(CONFIG.ENCODING);

            return {
                encrypted,
                iv: iv.toString(CONFIG.ENCODING),
                authTag,
            };
        } catch (error: any) {
            this.emit("encryption_failure", {
                error: error.message,
                timestamp: Date.now(),
            });
            throw new Error("Encryption failed");
        }
    }

    /**
     * High-performance decryption
     */
    private fastDecrypt(
        encrypted: string,
        iv: string,
        authTag: string
    ): string {
        try {
            const ivBuffer = Buffer.from(iv, CONFIG.ENCODING);
            const authTagBuffer = Buffer.from(authTag, CONFIG.ENCODING);

            const decipher = crypto.createDecipheriv(
                CONFIG.ALGORITHM,
                this.encryptionKey,
                ivBuffer
            );
            decipher.setAuthTag(authTagBuffer);

            let decrypted = decipher.update(encrypted, CONFIG.ENCODING, "utf8");
            decrypted += decipher.final("utf8");

            return decrypted;
        } catch (error) {
            throw new Error("Decryption failed - data may be corrupted");
        }
    }

    /**
     * Calculate data checksum for integrity
     */
    private calculateChecksum(data: string): string {
        return crypto
            .createHash("sha256")
            .update(data)
            .digest("hex")
            .substring(0, 16);
    }

    /**
     * Rate limiting check
     */
    private checkRateLimit(key: string): boolean {
        const now = Date.now();
        const limit = this.rateLimiter.get(key);

        if (!limit || now > limit.resetTime) {
            this.rateLimiter.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
            return true;
        }

        if (limit.count >= 10000) {
            // 10k requests per minute max
            return false;
        }

        limit.count++;
        return true;
    }

    /**
     * Ultra-fast SET operation with advanced features
     */
    public async set(
        key: string,
        value: CachedData,
        options: UltraCacheOptions = {}
    ): Promise<boolean> {
        const startTime = process.hrtime.bigint();

        try {
            // Rate limiting
            if (!this.checkRateLimit(key)) {
                throw new Error("Rate limit exceeded");
            }

            const hashedKey = this.validateAndHashKey(key);
            const serialized = JSON.stringify(value);

            // Size validation
            if (serialized.length > CONFIG.MAX_VALUE_SIZE_MB * 1024 * 1024) {
                throw new Error(
                    `Value too large (max ${CONFIG.MAX_VALUE_SIZE_MB}MB)`
                );
            }

            // Smart compression
            const { data: processedData, compressed } = options.skipCompression
                ? { data: serialized, compressed: false }
                : await this.smartCompress(serialized);

            // Conditional encryption
            let encrypted: string,
                iv: string,
                authTag: string,
                checksum: string;

            if (options.skipEncryption) {
                encrypted = processedData;
                iv = "";
                authTag = "";
            } else {
                const encResult = this.fastEncrypt(processedData);
                encrypted = encResult.encrypted;
                iv = encResult.iv;
                authTag = encResult.authTag;
            }

            checksum = this.integrityCheck
                ? this.calculateChecksum(serialized)
                : "";

            const now = Date.now();
            const ttl = options.ttl || CONFIG.CACHE_EXPIRY_MS;
            const priority = Math.max(1, Math.min(10, options.priority || 5));

            const entry: UltraMemoryCacheEntry = {
                data: encrypted,
                iv,
                authTag,
                timestamp: now,
                expiresAt: now + ttl,
                accessCount: 0,
                lastAccessed: now,
                compressed,
                size: encrypted.length + iv.length + authTag.length + 200,
                version: 1,
                hotness: 0,
                priority,
                tags: new Set(options.tags || []),
                metadata: options.metadata || {},
                checksum,
            };

            // Handle eviction with callback
            const evictedEntry = this.lru.put(hashedKey, entry);
            if (evictedEntry && options.onEvict) {
                try {
                    const evictedData = await this.decryptAndDecompress(
                        evictedEntry as UltraMemoryCacheEntry
                    );
                    // Find the original key for the evicted entry
                    const originalKey = this.findOriginalKey(hashedKey);
                    if (originalKey) {
                        options.onEvict(originalKey, JSON.parse(evictedData));
                    }
                } catch (error) {
                    if (this.logger) {
                        this.logger.warn(
                            "cache",
                            "Eviction callback failed:",
                            error
                        );
                    } else {
                        console.warn("Eviction callback failed:", error);
                    }
                }
            }

            // Update indexes - ensure priority is within valid range
            if (priority >= 0 && priority < this.priorityQueues.length) {
                this.priorityQueues[priority].add(hashedKey);
            }
            if (options.tags) {
                options.tags.forEach((tag) => {
                    if (!this.tagIndex.has(tag)) {
                        this.tagIndex.set(tag, new Set());
                    }
                    this.tagIndex.get(tag)!.add(hashedKey);
                });
            }

            // Update stats
            this.updateStatsAfterSet(entry.size, evictedEntry ? 1 : 0);
            this.recordAccessTime(startTime);

            return true;
        } catch (error) {
            console.error("Ultra cache set error:", error);
            return false;
        }
    }

    /**
     * Ultra-fast GET operation with hotness tracking
     */
    public async get(key: string): Promise<CachedData | null> {
        const startTime = process.hrtime.bigint();

        try {
            const hashedKey = this.validateAndHashKey(key);
            const node = this.lru.getNode(hashedKey);

            if (!node?.entry) {
                this.stats.misses++;
                this.recordAccessTime(startTime);
                return null;
            }

            const entry = node.entry as UltraMemoryCacheEntry;
            const now = Date.now();

            // Check expiration
            if (now > entry.expiresAt) {
                this.lru.delete(hashedKey);
                this.cleanupIndexes(hashedKey, entry);
                this.stats.misses++;
                this.stats.entryCount--;
                this.recordAccessTime(startTime);
                return null;
            }

            // Update access patterns and hotness
            entry.accessCount++;
            entry.lastAccessed = now;
            entry.hotness = Math.min(100, entry.hotness + 1);

            // Security monitoring
            this.trackAccess(hashedKey);

            // Decrypt and decompress
            const decryptedData = await this.decryptAndDecompress(entry);

            // Integrity check - compare against original serialized data
            if (this.integrityCheck && entry.checksum) {
                const currentChecksum = this.calculateChecksum(decryptedData);
                if (currentChecksum !== entry.checksum) {
                    this.emit("integrity_violation", { key, timestamp: now });
                    throw new Error("Data integrity check failed");
                }
            }

            this.stats.hits++;
            this.recordAccessTime(startTime);

            return JSON.parse(decryptedData);
        } catch (error) {
            console.error("Ultra cache get error:", error);
            this.stats.misses++;
            this.recordAccessTime(startTime);
            return null;
        }
    }

    /**
     * Helper method for decryption and decompression
     */
    private async decryptAndDecompress(
        entry: MemoryCacheEntry | UltraMemoryCacheEntry
    ): Promise<string> {
        let decrypted: string;

        if (entry.iv && entry.authTag) {
            decrypted = this.fastDecrypt(entry.data, entry.iv, entry.authTag);
        } else {
            decrypted = entry.data; // Unencrypted data
        }

        return await this.smartDecompress(decrypted, entry.compressed);
    }

    /**
     * Batch GET operation for multiple keys
     */
    public async getMultiple(
        keys: string[]
    ): Promise<Map<string, CachedData | null>> {
        const results = new Map<string, CachedData | null>();

        // Process in parallel batches
        const batchSize = 50;
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);
            const promises = batch.map(async (key) => {
                const value = await this.get(key);
                return { key, value };
            });

            const batchResults = await Promise.all(promises);
            batchResults.forEach(({ key, value }) => {
                results.set(key, value);
            });
        }

        return results;
    }

    /**
     * Set multiple key-value pairs
     */
    public async setMultiple(
        entries: Array<{
            key: string;
            value: CachedData;
            options?: UltraCacheOptions;
        }>
    ): Promise<boolean[]> {
        const promises = entries.map(({ key, value, options }) =>
            this.set(key, value, options)
        );
        return Promise.all(promises);
    }

    /**
     * Delete by tag
     */
    public async deleteByTag(tag: string): Promise<number> {
        const keys = this.tagIndex.get(tag);
        if (!keys) return 0;

        let deleted = 0;
        for (const hashedKey of keys) {
            if (this.lru.delete(hashedKey)) {
                deleted++;
            }
        }

        this.tagIndex.delete(tag);
        this.stats.entryCount -= deleted;
        return deleted;
    }

    /**
     * Get keys by tag
     */
    public getKeysByTag(tag: string): string[] {
        const hashedKeys = this.tagIndex.get(tag);
        if (!hashedKeys) return [];

        const originalKeys: string[] = [];
        for (const [originalKey, hashedKey] of this.keyHashMap.entries()) {
            if (hashedKeys.has(hashedKey)) {
                originalKeys.push(originalKey);
            }
        }
        return originalKeys;
    }

    /**
     * Advanced cache statistics
     */
    public get getUltraStats(): UltraStats {
        this.updatePerformanceMetrics();
        return { ...this.stats };
    }

    /**
     * Export cache data for backup
     */
    public async exportData(): Promise<any> {
        const data: any = {};
        const keys = this.lru.getKeys();

        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (node?.entry) {
                try {
                    const decrypted = await this.decryptAndDecompress(
                        node.entry as UltraMemoryCacheEntry
                    );
                    const originalKey = this.findOriginalKey(hashedKey);
                    if (originalKey) {
                        data[originalKey] = {
                            value: JSON.parse(decrypted),
                            metadata: (node.entry as UltraMemoryCacheEntry)
                                .metadata,
                            tags: Array.from(
                                (node.entry as UltraMemoryCacheEntry).tags
                            ),
                            expiresAt: (node.entry as UltraMemoryCacheEntry)
                                .expiresAt,
                        };
                    }
                } catch (error) {
                    if (this.logger) {
                        this.logger.warn(
                            "cache",
                            `Failed to export key ${hashedKey}:`,
                            error
                        );
                    } else {
                        console.warn(
                            `Failed to export key ${hashedKey}:`,
                            error
                        );
                    }
                }
            }
        }

        return data;
    }

    /**
     * Import cache data from backup
     */
    public async importData(data: any): Promise<boolean> {
        try {
            for (const [key, info] of Object.entries(data)) {
                const { value, metadata, tags, expiresAt } = info as any;
                const ttl = Math.max(0, expiresAt - Date.now());

                if (ttl > 0) {
                    await this.set(key, value, {
                        ttl,
                        metadata,
                        tags,
                    });
                }
            }
            return true;
        } catch (error) {
            console.error("Import failed:", error);
            return false;
        }
    }

    /**
     * Performance and maintenance methods
     */
    private updatePerformanceMetrics(): void {
        // Calculate average access time
        if (this.accessTimes.length > 0) {
            this.stats.averageAccessTime =
                this.accessTimes.reduce((a, b) => a + b, 0) /
                this.accessTimes.length;
            this.accessTimes = this.accessTimes.slice(-1000); // Keep last 1000 measurements
        }

        // Update memory stats
        this.stats.entryCount = this.lru.getSize();
        this.stats.memoryUsage.used = this.stats.totalSize;
        this.stats.memoryUsage.percentage =
            (this.stats.totalSize / this.stats.memoryUsage.limit) * 100;
        this.stats.hitRate =
            this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses);

        // Update hot/cold keys
        this.updateHotColdKeys();
    }

    private updateHotColdKeys(): void {
        const keys = this.lru.getKeys();
        const keyHotness: Array<{ key: string; hotness: number }> = [];

        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (node?.entry) {
                const entry = node.entry as UltraMemoryCacheEntry;
                const originalKey = this.findOriginalKey(hashedKey);
                if (originalKey) {
                    keyHotness.push({
                        key: originalKey,
                        hotness: entry.hotness,
                    });
                }
            }
        }

        keyHotness.sort((a, b) => b.hotness - a.hotness);
        this.stats.hotKeys = keyHotness.slice(0, 10).map((k) => k.key);
        this.stats.coldKeys = keyHotness.slice(-10).map((k) => k.key);
    }

    private optimizeHotness(): void {
        // Move hot items to higher priority
        const keys = this.lru.getKeys();
        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (node?.entry) {
                const entry = node.entry as UltraMemoryCacheEntry;
                if (entry.hotness > 50 && entry.priority < 8) {
                    entry.priority = Math.min(10, entry.priority + 1);
                }
            }
        }
    }

    private decayHotness(): void {
        // Gradually reduce hotness to identify truly hot vs temporarily hot items
        const keys = this.lru.getKeys();
        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (node?.entry) {
                const entry = node.entry as UltraMemoryCacheEntry;
                entry.hotness = Math.max(0, entry.hotness * 0.9);
            }
        }
    }

    private recordAccessTime(startTime: bigint): void {
        const endTime = process.hrtime.bigint();
        const durationNs = Number(endTime - startTime);
        const durationMs = durationNs / 1_000_000;
        this.accessTimes.push(durationMs);
    }

    private updateStatsAfterSet(size: number, evictions: number): void {
        this.stats.totalSize += size;
        this.stats.entryCount++;
        this.stats.evictions += evictions;
    }

    private trackAccess(key: string): void {
        const now = Date.now();
        if (!this.accessPatterns.has(key)) {
            this.accessPatterns.set(key, []);
        }

        const accesses = this.accessPatterns.get(key)!;
        accesses.push(now);

        // Keep only recent accesses
        const oneHourAgo = now - 60 * 60 * 1000;
        const recentAccesses = accesses.filter((time) => time > oneHourAgo);
        this.accessPatterns.set(key, recentAccesses);

        // Detect anomalies
        if (recentAccesses.length > this.anomalyThreshold) {
            this.emit("suspicious_access", {
                key,
                count: recentAccesses.length,
                timestamp: now,
            });
        }
    }

    private cleanupIndexes(
        hashedKey: string,
        entry: UltraMemoryCacheEntry
    ): void {
        // Remove from priority queues - ensure priority is within valid range
        if (
            entry.priority >= 0 &&
            entry.priority < this.priorityQueues.length
        ) {
            this.priorityQueues[entry.priority].delete(hashedKey);
        }

        // Remove from tag indexes
        for (const tag of entry.tags) {
            const tagKeys = this.tagIndex.get(tag);
            if (tagKeys) {
                tagKeys.delete(hashedKey);
                if (tagKeys.size === 0) {
                    this.tagIndex.delete(tag);
                }
            }
        }
    }

    private findOriginalKey(hashedKey: string): string | undefined {
        for (const [originalKey, hash] of this.keyHashMap.entries()) {
            if (hash === hashedKey) {
                return originalKey;
            }
        }
        return undefined;
    }

    private startMaintenanceTasks(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, CONFIG.CLEANUP_INTERVAL_MS);

        this.keyRotationTimer = setInterval(() => {
            this.rotateEncryptionKey();
        }, CONFIG.KEY_ROTATION_MS);

        this.securityTimer = setInterval(() => {
            this.performSecurityChecks();
        }, CONFIG.SECURITY_CHECK_INTERVAL_MS);
    }

    private cleanup(): void {
        const now = Date.now();
        const keys = this.lru.getKeys();
        let cleaned = 0;

        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (
                node?.entry &&
                now > (node.entry as UltraMemoryCacheEntry).expiresAt
            ) {
                const entry = node.entry as UltraMemoryCacheEntry;
                this.lru.delete(hashedKey);
                this.cleanupIndexes(hashedKey, entry);
                this.stats.totalSize -= entry.size;
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.stats.entryCount -= cleaned;
            this.emit("cleanup_completed", { cleaned, timestamp: now });
        }
    }

    private async rotateEncryptionKey(): Promise<void> {
        try {
            const newKey = crypto.randomBytes(CONFIG.KEY_LENGTH);
            const oldKey = this.encryptionKey;
            const keys = this.lru.getKeys();
            let processed = 0;

            for (const hashedKey of keys) {
                const node = this.lru.getNode(hashedKey);
                if (!node?.entry) continue;

                const entry = node.entry as UltraMemoryCacheEntry;

                // Skip unencrypted entries
                if (!entry.iv || !entry.authTag) continue;

                try {
                    // Decrypt with old key
                    this.encryptionKey = oldKey;
                    const decrypted = this.fastDecrypt(
                        entry.data,
                        entry.iv,
                        entry.authTag
                    );

                    // Re-encrypt with new key
                    this.encryptionKey = newKey;
                    const { encrypted, iv, authTag } =
                        this.fastEncrypt(decrypted);

                    // Update entry
                    entry.data = encrypted;
                    entry.iv = iv;
                    entry.authTag = authTag;
                    processed++;
                } catch (error) {
                    console.error(
                        `Failed to re-encrypt entry ${hashedKey}:`,
                        error
                    );
                    // Remove corrupted entry
                    this.lru.delete(hashedKey);
                    this.cleanupIndexes(hashedKey, entry);
                    this.stats.totalSize -= entry.size;
                    this.stats.entryCount--;
                }
            }

            this.encryptionKey = newKey;
            this.emit("key_rotation", {
                timestamp: Date.now(),
                reason: "scheduled",
                entriesProcessed: processed,
            });
        } catch (error) {
            console.error("Key rotation failed:", error);
        }
    }

    private performSecurityChecks(): void {
        // Memory pressure check
        if (this.stats.memoryUsage.percentage > 90) {
            this.emit("memory_pressure", {
                usage: this.stats.memoryUsage,
                timestamp: Date.now(),
            });
            // Emergency cleanup
            this.emergencyCleanup();
        }

        // Check for potential DoS attacks
        if (this.lru.getSize() > CONFIG.MAX_ENTRIES * 0.95) {
            this.emit("cache_overflow", {
                entries: this.lru.getSize(),
                limit: CONFIG.MAX_ENTRIES,
                timestamp: Date.now(),
            });
        }

        // Analyze access patterns for anomalies
        this.detectAnomalies();
    }

    private emergencyCleanup(): void {
        const targetSize = this.stats.memoryUsage.limit * 0.6; // Clear to 60%
        const keys = this.lru.getKeys();
        let cleaned = 0;

        // Remove expired entries first
        this.cleanup();

        // If still over limit, remove coldest entries
        if (this.stats.totalSize > targetSize) {
            for (const hashedKey of keys) {
                if (this.stats.totalSize <= targetSize) break;

                const node = this.lru.getNode(hashedKey);
                if (node?.entry) {
                    const entry = node.entry as UltraMemoryCacheEntry;
                    if (entry.hotness < 10) {
                        // Remove cold entries
                        this.lru.delete(hashedKey);
                        this.cleanupIndexes(hashedKey, entry);
                        this.stats.totalSize -= entry.size;
                        cleaned++;
                    }
                }
            }
        }

        this.stats.entryCount -= cleaned;
        this.stats.evictions += cleaned;
        this.emit("emergency_cleanup", { cleaned, timestamp: Date.now() });
    }

    private detectAnomalies(): void {
        const now = Date.now();
        const suspiciousPatterns: string[] = [];

        for (const [key, accesses] of this.accessPatterns.entries()) {
            if (accesses.length > this.anomalyThreshold) {
                suspiciousPatterns.push(key);
            }
        }

        if (suspiciousPatterns.length > 0) {
            this.emit("anomaly_detected", {
                patterns: suspiciousPatterns,
                timestamp: now,
            });
        }
    }

    // ==================Advanced methods (usefull in some case)

    /**
     * Get cache health report
     */
    public getHealthReport(): {
        status: "healthy" | "warning" | "critical";
        issues: string[];
        recommendations: string[];
        metrics: UltraStats;
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        let status: "healthy" | "warning" | "critical" = "healthy";

        const stats = this.getUltraStats;

        // Check hit rate
        if (stats.hitRate < 0.5) {
            issues.push("Low hit rate (< 50%)");
            recommendations.push(
                "Consider increasing cache size or TTL values"
            );
            status = "warning";
        }

        // Check memory usage
        if (stats.memoryUsage.percentage > 90) {
            issues.push("High memory usage (> 90%)");
            recommendations.push(
                "Increase cache size limit or reduce entry count"
            );
            status = "critical";
        }

        // Check access time
        if (stats.averageAccessTime > 10) {
            issues.push("Slow access times (> 10ms)");
            recommendations.push(
                "Consider optimizing data size or disabling encryption for performance-critical data"
            );
            if (status === "healthy") status = "warning";
        }

        // Check eviction rate
        const evictionRate = stats.evictions / Math.max(1, stats.entryCount);
        if (evictionRate > 0.1) {
            issues.push("High eviction rate (> 10%)");
            recommendations.push("Increase cache size or adjust TTL values");
            if (status === "healthy") status = "warning";
        }

        return { status, issues, recommendations, metrics: stats };
    }

    /**
     * Optimize cache configuration automatically
     */
    public autoOptimize(): void {
        const stats = this.getUltraStats;

        // Adjust anomaly threshold based on usage patterns
        const avgAccesses =
            Array.from(this.accessPatterns.values()).reduce(
                (sum, accesses) => sum + accesses.length,
                0
            ) / Math.max(1, this.accessPatterns.size);

        this.anomalyThreshold = Math.max(1000, avgAccesses * 10);

        // Adjust cleanup frequency based on expiration patterns
        if (stats.memoryUsage.percentage > 70) {
            // More frequent cleanup
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = setInterval(
                    () => this.cleanup(),
                    CONFIG.CLEANUP_INTERVAL_MS / 2
                );
            }
        }

        this.emit("auto_optimization", {
            anomalyThreshold: this.anomalyThreshold,
            timestamp: Date.now(),
        });
    }

    /**
     * Prefetch data based on access patterns
     */
    public async prefetch(
        predictor: (key: string, metadata: any) => Promise<CachedData | null>
    ): Promise<number> {
        let prefetched = 0;
        const keys = this.lru.getKeys();

        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (!node?.entry) continue;

            const entry = node.entry as UltraMemoryCacheEntry;
            const originalKey = this.findOriginalKey(hashedKey);

            if (originalKey && entry.hotness > 20) {
                try {
                    const predictedData = await predictor(
                        originalKey,
                        entry.metadata
                    );
                    if (predictedData) {
                        const prefetchKey = `${originalKey}_prefetch_${Date.now()}`;
                        await this.set(prefetchKey, predictedData, {
                            ttl: entry.expiresAt - Date.now(),
                            priority: Math.min(10, entry.priority + 1),
                        });
                        prefetched++;
                    }
                } catch (error) {
                    if (this.logger) {
                        this.logger.warn(
                            "cache",
                            `Prefetch failed for ${originalKey}:`,
                            error
                        );
                    } else {
                        console.warn(
                            `Prefetch failed for ${originalKey}:`,
                            error
                        );
                    }
                }
            }
        }

        return prefetched;
    }

    /**
     * Create a cache snapshot for debugging
     */
    public createSnapshot(): any {
        const snapshot = {
            timestamp: Date.now(),
            stats: this.getUltraStats,
            entries: [] as any[],
            hotKeys: this.stats.hotKeys,
            coldKeys: this.stats.coldKeys,
            tagStats: Object.fromEntries(this.stats.tagStats),
        };

        const keys = this.lru.getKeys().slice(0, 100); // Sample first 100 entries

        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (node?.entry) {
                const entry = node.entry as UltraMemoryCacheEntry;
                const originalKey = this.findOriginalKey(hashedKey);

                snapshot.entries.push({
                    key: originalKey,
                    size: entry.size,
                    accessCount: entry.accessCount,
                    hotness: entry.hotness,
                    priority: entry.priority,
                    tags: Array.from(entry.tags),
                    compressed: entry.compressed,
                    encrypted: !!(entry.iv && entry.authTag),
                    expiresIn: Math.max(0, entry.expiresAt - Date.now()),
                });
            }
        }

        return snapshot;
    }

    /**
     * Validate cache integrity
     */
    public async validateIntegrity(): Promise<{
        valid: number;
        invalid: number;
        errors: string[];
    }> {
        const result = { valid: 0, invalid: 0, errors: [] as string[] };
        const keys = this.lru.getKeys();

        for (const hashedKey of keys) {
            const node = this.lru.getNode(hashedKey);
            if (!node?.entry) continue;

            const entry = node.entry as UltraMemoryCacheEntry;
            const originalKey = this.findOriginalKey(hashedKey);

            try {
                // Try to decrypt and decompress
                await this.decryptAndDecompress(entry);
                result.valid++;
            } catch (error) {
                result.invalid++;
                result.errors.push(`${originalKey}: ${error}`);

                // Remove corrupted entry
                this.lru.delete(hashedKey);
                this.cleanupIndexes(hashedKey, entry);
                this.stats.totalSize -= entry.size;
                this.stats.entryCount--;
            }
        }

        return result;
    }

    /**
     * Enhanced delete with pattern matching
     */
    public delete(key: string): boolean {
        try {
            const hashedKey = this.validateAndHashKey(key);
            const node = this.lru.getNode(hashedKey);

            if (node?.entry) {
                const entry = node.entry as UltraMemoryCacheEntry;
                this.lru.delete(hashedKey);
                this.cleanupIndexes(hashedKey, entry);
                this.stats.totalSize -= entry.size;
                this.stats.entryCount--;
                this.keyHashMap.delete(key);
                return true;
            }

            return false;
        } catch (error) {
            console.error("Delete error:", error);
            return false;
        }
    }

    /**
     * Delete with pattern (supports wildcards)
     */
    public deletePattern(pattern: string): number {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        let deleted = 0;

        for (const [originalKey] of this.keyHashMap.entries()) {
            if (regex.test(originalKey)) {
                if (this.delete(originalKey)) {
                    deleted++;
                }
            }
        }

        return deleted;
    }

    /**
     * Check if key exists
     */
    public has(key: string): boolean {
        try {
            const hashedKey = this.validateAndHashKey(key);
            const node = this.lru.getNode(hashedKey);

            if (!node?.entry) return false;

            if (Date.now() > (node.entry as UltraMemoryCacheEntry).expiresAt) {
                this.delete(key);
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all entries
     */
    public clear(): void {
        this.lru.clear();
        this.keyHashMap.clear();
        this.tagIndex.clear();
        this.accessPatterns.clear();
        this.rateLimiter.clear();
        this.priorityQueues.forEach((queue) => queue.clear());

        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalSize: 0,
            entryCount: 0,
            hitRate: 0,
            memoryUsage: {
                used: 0,
                limit: CONFIG.MAX_CACHE_SIZE_MB * 1024 * 1024,
                percentage: 0,
            },
            totalAccesses: 0,
            size: 0,
            capacity: CONFIG.MAX_ENTRIES,
            averageAccessTime: 0,
            compressionRatio: 0,
            encryptionOverhead: 0,
            hotKeys: [],
            coldKeys: [],
            tagStats: new Map(),
        };
    }

    /**
     * Get cache size
     */
    public get size(): { entries: number; bytes: number } {
        return {
            entries: this.lru.getSize(),
            bytes: this.stats.totalSize,
        };
    }

    /**
     * Graceful shutdown
     */
    public async shutdown(): Promise<void> {
        // Clear all timers
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        if (this.keyRotationTimer) clearInterval(this.keyRotationTimer);
        if (this.securityTimer) clearInterval(this.securityTimer);
        if (this.performanceTimer) clearInterval(this.performanceTimer);
        if (this.hotnessDecayTimer) clearInterval(this.hotnessDecayTimer);

        // Final cleanup
        this.cleanup();

        // Export data if needed (for persistence)
        this.emit("shutdown", {
            timestamp: Date.now(),
            finalStats: this.getUltraStats,
        });

        // Clear all data
        this.clear();
        this.removeAllListeners();
    }
}

export {
    UFSIMC as UltraFastSecureInMemoryCache,
    UltraCacheOptions,
    UltraStats,
};

export default UFSIMC;
