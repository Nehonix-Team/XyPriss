/**
 * XyPrissJS Secure Cache Adapter
 * Ultra-fast hybrid cache system combining security cache with Redis clustering
 *
 * Features:
 * - Memory-first hybrid architecture for maximum speed
 * - Redis Cluster support with automatic failover
 * - Connection pooling and health monitoring
 * - Advanced tagging and invalidation
 * - Real-time performance metrics
 * - Military-grade security from XyPrissJS security cache
 */

import { EventEmitter } from "events";
import Redis, { Cluster } from "ioredis";
import { SecureInMemoryCache } from "xypriss-security";
import type { CachedData } from "xypriss-security";
import { EncryptionService } from "../encryption";

import { XyPrissSecurity as XyPrissJS } from "xypriss-security";
import * as CacheTypes from "./type";
import { initializeLogger, Logger } from "../../shared/logger/Logger";

/**
 * UF secure cache adapter
 */
export class SecureCacheAdapter extends EventEmitter {
    private config: CacheTypes.SecureCacheConfig;
    private memoryCache!: SecureInMemoryCache;
    private redisClient?: Redis | Cluster;
    private connectionPool: Map<string, Redis> = new Map();
    private metadata: Map<string, CacheTypes.CacheEntryMetadata> = new Map();
    private stats!: CacheTypes.EnhancedCacheStats;
    private healthMonitor?: NodeJS.Timeout;
    private metricsCollector?: NodeJS.Timeout;
    private masterEncryptionKey!: string; // Consistent encryption key for all operations
    private logger: Logger;

    constructor(config: CacheTypes.SecureCacheConfig = {}) {
        super();
        this.logger = initializeLogger();

        this.config = {
            strategy: "hybrid",
            memory: {
                maxSize: 100, // 100MB
                maxEntries: 10000,
                ttl: 10 * 60 * 1000, // 10 minutes
                ...config.memory,
            },
            redis: {
                host: "localhost",
                port: 6379,
                pool: {
                    min: 2,
                    max: 10,
                    acquireTimeoutMillis: 30000,
                },
                ...config.redis,
            },
            performance: {
                batchSize: 100,
                compressionThreshold: 1024,
                hotDataThreshold: 10,
                prefetchEnabled: true,
                ...config.performance,
            },
            security: {
                encryption: true,
                keyRotation: true,
                accessMonitoring: true,
                ...config.security,
            },
            monitoring: {
                enabled: true,
                metricsInterval: 60000, // 1 minute
                alertThresholds: {
                    memoryUsage: 90,
                    hitRate: 80,
                    errorRate: 5,
                },
                ...config.monitoring,
            },
            ...config,
        };

        this.initializeStats();
        this.initializeMasterKey();
        this.initializeMemoryCache();
    }

    /**
     * Initialize statistics
     */
    private initializeStats(): void {
        this.stats = {
            memory: {
                hits: 0,
                misses: 0,
                evictions: 0,
                totalSize: 0,
                entryCount: 0,
                hitRate: 0,
                totalAccesses: 0,
                size: 0,
                capacity: this.config.memory?.maxEntries || 10000,
                memoryUsage: {
                    used: 0,
                    limit: (this.config.memory?.maxSize || 100) * 1024 * 1024,
                    percentage: 0,
                },
            },
            redis:
                this.config.strategy === "redis" ||
                this.config.strategy === "hybrid"
                    ? {
                          connected: false,
                          commandsProcessed: 0,
                          operations: 0,
                          memoryUsage: {
                              used: 0,
                              peak: 0,
                              percentage: 0,
                          },
                          keyspaceHits: 0,
                          keyspaceMisses: 0,
                          hits: 0,
                          misses: 0,
                          hitRate: 0,
                          connectedClients: 0,
                          connections: 0,
                          keys: 0,
                          uptime: 0,
                          lastUpdate: 0,
                      }
                    : undefined,
            performance: {
                totalOperations: 0,
                averageResponseTime: 0,
                hotDataHitRate: 0,
                compressionRatio: 0,
                networkLatency: 0,
            },
            security: {
                encryptedEntries: 0,
                keyRotations: 0,
                suspiciousAccess: 0,
                securityEvents: 0,
            },
        };
    }

    /**
     * Initialize master encryption key for consistent encryption
     */
    private initializeMasterKey(): void {
        // Generate a consistent master key for all cache operations
        this.masterEncryptionKey = XyPrissJS.generateSecureToken({
            length: 32,
            entropy: "high",
        });
    }

    /**
     * Initialize memory cache with security features
     */
    private initializeMemoryCache(): void {
        this.memoryCache = new SecureInMemoryCache();

        // Listen to security events
        this.memoryCache.on("key_rotation", (event) => {
            this.stats.security.keyRotations++;
            this.emit("security_event", { type: "key_rotation", ...event });
        });

        this.memoryCache.on("suspicious_access", (event) => {
            this.stats.security.suspiciousAccess++;
            this.emit("security_event", {
                type: "suspicious_access",
                ...event,
            });
        });

        this.memoryCache.on("memory_pressure", (event) => {
            this.emit("performance_alert", {
                type: "memory_pressure",
                ...event,
            });
        });
    }

    /**
     * Connect to cache backends
     */
    public async connect(): Promise<void> {
        try {
            // Memory cache is always ready
            // console.log(" Secure memory cache initialized");

            // Initialize Redis if needed
            if (
                this.config.strategy === "redis" ||
                this.config.strategy === "hybrid"
            ) {
                await this.initializeRedis();
            }

            // Start monitoring
            if (this.config.monitoring?.enabled) {
                this.startMonitoring();
            }

            this.emit("connected");
        } catch (error) {
            this.emit("error", error);
            throw new Error(
                `Cache connection failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Initialize Redis with clustering and failover support
     */
    private async initializeRedis(): Promise<void> {
        const redisConfig = this.config.redis!;

        try {
            if (redisConfig.cluster?.enabled && redisConfig.cluster.nodes) {
                // Redis Cluster mode
                this.redisClient = new Cluster(redisConfig.cluster.nodes, {
                    redisOptions: {
                        password: redisConfig.password,
                        db: redisConfig.db || 0,
                        lazyConnect: true,
                    },
                    ...redisConfig.cluster.options,
                });

                this.logger.startup("server", " Redis Cluster initialized");
            } else if (redisConfig.sentinel?.enabled) {
                // Redis Sentinel mode
                this.redisClient = new Redis({
                    sentinels: redisConfig.sentinel.sentinels,
                    name: redisConfig.sentinel.name || "mymaster",
                    password: redisConfig.password,
                    db: redisConfig.db || 0,
                    lazyConnect: true,
                });

                this.logger.info("server", " Redis Sentinel initialized");
            } else {
                // Single Redis instance
                this.redisClient = new Redis({
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password,
                    db: redisConfig.db || 0,
                    lazyConnect: true,
                    connectTimeout: 5000, // 5 second timeout
                    commandTimeout: 5000, // 5 second command timeout
                    retryDelayOnFailover: 100, // This property exists in ioredis
                    maxRetriesPerRequest: 2,
                } as any); // Use type assertion to bypass strict typing

                this.logger.info(
                    "server",
                    " Redis single instance initialized"
                );
            }

            // Setup Redis event handlers
            this.setupRedisEventHandlers();

            // Connect to Redis with timeout
            await Promise.race([
                this.redisClient.connect(),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("Redis connection timeout")),
                        10000
                    )
                ),
            ]);
        } catch (error) {
            console.error(" Redis initialization failed:", error);
            throw error;
        }
    }

    /**
     * Setup Redis event handlers for monitoring and failover
     */
    private setupRedisEventHandlers(): void {
        if (!this.redisClient) return;

        this.redisClient.on("connect", () => {
            (" Redis connected");
            this.emit("redis_connected");
        });

        this.redisClient.on("ready", () => {
            this.logger.info("server", "Connected to Redis");
            this.emit("redis_ready");
        });

        this.redisClient.on("error", (error: Error) => {
            console.error(" Redis error:", error);
            this.emit("redis_error", error);
        });

        this.redisClient.on("close", () => {
            console.warn(" Redis connection closed");
            this.emit("redis_disconnected");
        });

        this.redisClient.on("reconnecting", () => {
            this.logger.warn("server", " Redis reconnecting...");
            this.emit("redis_reconnecting");
        });

        // Cluster-specific events
        if (this.redisClient instanceof Redis.Cluster) {
            this.redisClient.on("node error", (error, node) => {
                console.error(
                    ` Redis cluster node error (${node.options.host}:${node.options.port}):`,
                    error
                );
                this.emit("cluster_node_error", { error, node });
            });

            this.redisClient.on("+node", (node) => {
                this.logger.info(
                    "server",
                    ` Redis cluster node added: ${node.options.host}:${node.options.port}`
                );
                this.emit("cluster_node_added", node);
            });

            this.redisClient.on("-node", (node) => {
                this.logger.warn(
                    "server",
                    ` Redis cluster node removed: ${node.options.host}:${node.options.port}`
                );
                this.emit("cluster_node_removed", node);
            });
        }
    }

    /**
     * Start monitoring and health checks
     */
    private startMonitoring(): void {
        // Health monitoring
        this.healthMonitor = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Every 30 seconds

        // Metrics collection
        this.metricsCollector = setInterval(() => {
            this.collectMetrics();
        }, this.config.monitoring?.metricsInterval || 60000);
    }

    /**
     * Perform health check on all cache backends
     */
    private async performHealthCheck(): Promise<void> {
        try {
            // Check memory cache
            const memoryStats = this.memoryCache.getStats;

            // Check Redis if available
            if (this.redisClient) {
                const redisInfo = await this.redisClient.ping();
                if (redisInfo !== "PONG") {
                    this.emit("health_check_failed", {
                        backend: "redis",
                        reason: "ping_failed",
                    });
                }
            }

            // Check alert thresholds
            const thresholds = this.config.monitoring?.alertThresholds;
            if (thresholds) {
                if (
                    memoryStats.memoryUsage.percentage >
                    (thresholds.memoryUsage || 90)
                ) {
                    this.emit("performance_alert", {
                        type: "high_memory_usage",
                        value: memoryStats.memoryUsage.percentage,
                        threshold: thresholds.memoryUsage,
                    });
                }

                if (memoryStats.hitRate < (thresholds.hitRate || 80) / 100) {
                    this.emit("performance_alert", {
                        type: "low_hit_rate",
                        value: memoryStats.hitRate * 100,
                        threshold: thresholds.hitRate,
                    });
                }
            }
        } catch (error) {
            this.emit("health_check_failed", { error });
        }
    }

    /**
     * Collect performance metrics
     */
    private collectMetrics(): void {
        try {
            // Update memory stats
            this.stats.memory = this.memoryCache.getStats;

            // Calculate performance metrics
            this.updatePerformanceMetrics();

            // Emit metrics event
            this.emit("metrics_collected", this.stats);
        } catch (error) {
            console.error("Metrics collection failed:", error);
        }
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(): void {
        // Calculate hot data hit rate
        let hotDataHits = 0;
        let totalHotAccess = 0;

        for (const [, meta] of this.metadata.entries()) {
            if (meta.isHot) {
                totalHotAccess += meta.accessCount;
                if (meta.location === "memory") {
                    hotDataHits += meta.accessCount;
                }
            }
        }

        this.stats.performance.hotDataHitRate =
            totalHotAccess > 0 ? hotDataHits / totalHotAccess : 0;

        // Update security stats
        this.stats.security.encryptedEntries = this.metadata.size;
    }

    /**
     * Generate cache key with namespace and security
     */
    private generateKey(key: string): string {
        // Validate key
        if (!key || typeof key !== "string") {
            throw new Error("Cache key must be a non-empty string");
        }

        if (key.length > 512) {
            throw new Error("Cache key too long (max 512 characters)");
        }

        // Create deterministic hash of the key using crypto
        const crypto = require("crypto");
        const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

        return `XyPriss:v2:${hashedKey.substring(0, 16)}:${key}`;
    }

    /**
     * Determine if data should be considered "hot" (frequently accessed)
     */
    private isHotData(key: string): boolean {
        const meta = this.metadata.get(key);
        if (!meta) return false;

        const threshold = this.config.performance?.hotDataThreshold || 10;
        const timeWindow = 60 * 60 * 1000; // 1 hour
        const now = Date.now();

        return (
            meta.accessCount >= threshold &&
            now - meta.lastAccessed < timeWindow
        );
    }

    /**
     * Update access metadata for performance optimization
     */
    private updateAccessMetadata(key: string, size: number = 0): void {
        const now = Date.now();
        const meta = this.metadata.get(key) || {
            accessCount: 0,
            lastAccessed: now,
            size,
            isHot: false,
            location: "memory" as const,
            tags: [],
        };

        meta.accessCount++;
        meta.lastAccessed = now;
        meta.isHot = this.isHotData(key);

        this.metadata.set(key, meta);
        this.stats.performance.totalOperations++;
    }

    // ========================================
    // SERIALIZATION AND DATA HANDLING
    // ========================================

    /**
     * Convert any data to CachedData format for SecurityCache compatibility
     */
    private toCachedData(value: any): CachedData {
        if (typeof value === "object" && value !== null && "data" in value) {
            // Already in CachedData format
            return value as CachedData;
        }

        // Wrap raw data in CachedData format
        return {
            data: value,
            metadata: {
                timestamp: Date.now(),
                type: typeof value,
                size: JSON.stringify(value).length,
            },
        };
    }

    /**
     * Extract raw data from CachedData format
     */
    private fromCachedData(cachedData: CachedData | null): any {
        if (!cachedData) return null;

        // Return the actual data, not the wrapper
        return cachedData.data;
    }

    /**
     * Serialize data for Redis storage with proper encryption
     */
    private async serializeForRedis(value: any): Promise<string> {
        try {
            // First convert to JSON
            let serialized = JSON.stringify(value);

            // Apply encryption if enabled
            if (this.config.security?.encryption) {
                serialized = await EncryptionService.encrypt(
                    value,
                    this.masterEncryptionKey,
                    {
                        algorithm: "aes-256-gcm",
                        quantumSafe: false,
                    }
                );
            }

            return serialized;
        } catch (error) {
            throw new Error(
                `Serialization failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Deserialize data from Redis storage with proper decryption
     */
    private async deserializeFromRedis(serialized: string): Promise<any> {
        try {
            // Apply decryption if enabled
            if (this.config.security?.encryption) {
                return await EncryptionService.decrypt(
                    serialized,
                    this.masterEncryptionKey
                );
            }

            // Parse JSON if no encryption
            return JSON.parse(serialized);
        } catch (error) {
            throw new Error(
                `Deserialization failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    // ========================================
    // CORE CACHE OPERATIONS
    // ========================================

    /**
     * Get value from cache with ultra-fast hybrid strategy
     *
     * @param key - The cache key to retrieve
     * @returns Promise resolving to the cached value with proper typing, or null if not found
     *
     * @example
     * ```typescript
     * interface User { id: number; name: string; }
     * const user = await cache.get<User>("user:123");
     * if (user) {
     *   console.log(user.name); // TypeScript knows this is a string
     * }
     * ```
     */
    public async get<T = any>(key: string): Promise<T | null> {
        const startTime = Date.now();

        try {
            const cacheKey = this.generateKey(key);

            // Strategy 1: Try memory cache first (fastest)
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                const memoryResult = await this.memoryCache.get(cacheKey);
                if (memoryResult !== null) {
                    this.updateAccessMetadata(cacheKey);
                    this.recordResponseTime(Date.now() - startTime);
                    // Extract raw data from CachedData format
                    return this.fromCachedData(memoryResult);
                }
            }

            // Strategy 2: Try Redis if memory miss
            if (
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid") &&
                this.redisClient
            ) {
                const redisResult = await this.getFromRedis(cacheKey);
                if (redisResult !== null) {
                    // For hybrid strategy, promote hot data to memory
                    if (
                        this.config.strategy === "hybrid" &&
                        this.isHotData(cacheKey)
                    ) {
                        // Convert to CachedData format for memory cache
                        const cachedData = this.toCachedData(redisResult);
                        await this.memoryCache.set(cacheKey, cachedData, {
                            ttl: this.config.memory?.ttl,
                        });
                    }

                    this.updateAccessMetadata(cacheKey);
                    this.recordResponseTime(Date.now() - startTime);
                    return redisResult;
                }
            }

            // Cache miss
            this.recordResponseTime(Date.now() - startTime);
            return null;
        } catch (error) {
            this.emit("cache_error", { operation: "get", key, error });
            this.recordResponseTime(Date.now() - startTime);
            return null;
        }
    }

    /**
     * Set value in cache with intelligent placement
     *
     * @param key - The cache key to store the value under
     * @param value - The value to cache with proper typing
     * @param options - Optional caching options
     * @param options.ttl - Time to live in milliseconds
     * @param options.tags - Array of tags for bulk invalidation
     * @returns Promise resolving to true if successful, false otherwise
     *
     * @example
     * ```typescript
     * interface User { id: number; name: string; email: string; }
     *
     * const user: User = { id: 123, name: "John", email: "john@example.com" };
     * const success = await cache.set<User>("user:123", user, {
     *   ttl: 3600000, // 1 hour
     *   tags: ["users", "active"]
     * });
     * ```
     */
    public async set<T = any>(
        key: string,
        value: T,
        options: { ttl?: number; tags?: string[] } = {}
    ): Promise<boolean> {
        const startTime = Date.now();

        try {
            const cacheKey = this.generateKey(key);
            const ttl = options.ttl || this.config.memory?.ttl || 600000; // 10 minutes default

            // Determine storage strategy
            const shouldStoreInMemory =
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid";
            const shouldStoreInRedis =
                this.config.strategy === "redis" ||
                this.config.strategy === "hybrid";

            // Store in memory cache
            if (shouldStoreInMemory) {
                // Convert to CachedData format for memory cache
                const cachedData = this.toCachedData(value);
                await this.memoryCache.set(cacheKey, cachedData, { ttl });
            }

            // Store in Redis
            if (shouldStoreInRedis && this.redisClient) {
                await this.setInRedis(cacheKey, value, ttl, options.tags);
            }

            // Update metadata
            this.updateAccessMetadata(cacheKey, JSON.stringify(value).length);
            if (options.tags) {
                const meta = this.metadata.get(cacheKey);
                if (meta) {
                    meta.tags = options.tags;
                    this.metadata.set(cacheKey, meta);
                }
            }

            this.recordResponseTime(Date.now() - startTime);
            return true;
        } catch (error) {
            this.emit("cache_error", { operation: "set", key, error });
            this.recordResponseTime(Date.now() - startTime);
            return false;
        }
    }

    /**
     * Delete value from cache
     */
    public async delete(key: string): Promise<boolean> {
        const startTime = Date.now();

        try {
            const cacheKey = this.generateKey(key);
            let deleted = false;

            // Delete from memory cache
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                deleted = this.memoryCache.delete(cacheKey) || deleted;
            }

            // Delete from Redis
            if (
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid") &&
                this.redisClient
            ) {
                const redisDeleted = await this.redisClient.del(cacheKey);
                deleted = redisDeleted > 0 || deleted;
            }

            // Clean up metadata
            this.metadata.delete(cacheKey);

            this.recordResponseTime(Date.now() - startTime);
            return deleted;
        } catch (error) {
            this.emit("cache_error", { operation: "delete", key, error });
            this.recordResponseTime(Date.now() - startTime);
            return false;
        }
    }

    /**
     * Check if key exists in cache
     */
    public async exists(key: string): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key);

            // Check memory cache first
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                if (this.memoryCache.has(cacheKey)) {
                    return true;
                }
            }

            // Check Redis
            if (
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid") &&
                this.redisClient
            ) {
                const exists = await this.redisClient.exists(cacheKey);
                return exists > 0;
            }

            return false;
        } catch (error) {
            this.emit("cache_error", { operation: "exists", key, error });
            return false;
        }
    }

    /**
     * Clear all cache entries
     */
    public async clear(): Promise<void> {
        try {
            // Clear memory cache
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                this.memoryCache.clear();
            }

            // Clear Redis
            if (
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid") &&
                this.redisClient
            ) {
                await this.redisClient.flushdb();
            }

            // Clear metadata
            this.metadata.clear();

            this.emit("cache_cleared");
        } catch (error) {
            this.emit("cache_error", { operation: "clear", error });
            throw error;
        }
    }

    // ========================================
    // REDIS HELPER METHODS
    // ========================================

    /**
     * Get value from Redis with encryption support
     */
    private async getFromRedis(key: string): Promise<any> {
        if (!this.redisClient) return null;

        try {
            const serialized = await this.redisClient.get(key);
            if (!serialized) return null;

            // Use consistent deserialization
            return await this.deserializeFromRedis(serialized);
        } catch (error) {
            console.error("Redis get error:", error);
            return null;
        }
    }

    /**
     * Set value in Redis with encryption and TTL support
     */
    private async setInRedis(
        key: string,
        value: any,
        ttl: number,
        tags?: string[]
    ): Promise<void> {
        if (!this.redisClient) return;

        try {
            // Use consistent serialization
            const serialized = await this.serializeForRedis(value);

            // Set with TTL
            if (ttl > 0) {
                await this.redisClient.setex(
                    key,
                    Math.floor(ttl / 1000),
                    serialized
                );
            } else {
                await this.redisClient.set(key, serialized);
            }

            // Handle tags for cache invalidation
            if (tags && tags.length > 0) {
                await this.setTags(key, tags);
            }
        } catch (error) {
            console.error("Redis set error:", error);
            throw error;
        }
    }

    /**
     * Set tags for cache invalidation
     */
    private async setTags(key: string, tags: string[]): Promise<void> {
        if (!this.redisClient) return;

        try {
            const pipeline = this.redisClient.pipeline();

            for (const tag of tags) {
                const tagKey = `tag:${tag}`;
                pipeline.sadd(tagKey, key);
                pipeline.expire(tagKey, 86400); // 24 hours
            }

            await pipeline.exec();
        } catch (error) {
            console.error("Redis tag set error:", error);
        }
    }

    /**
     * Record response time for performance monitoring
     */
    private recordResponseTime(responseTime: number): void {
        // Update running average
        const currentAvg = this.stats.performance.averageResponseTime;
        const totalOps = this.stats.performance.totalOperations;

        this.stats.performance.averageResponseTime =
            (currentAvg * (totalOps - 1) + responseTime) / totalOps;
    }

    // ========================================
    // ADVANCED CACHE OPERATIONS
    // ========================================

    /**
     * Invalidate cache entries by tags
     */
    public async invalidateByTags(tags: string[]): Promise<number> {
        if (!this.redisClient) return 0;

        try {
            let invalidatedCount = 0;

            for (const tag of tags) {
                const tagKey = `tag:${tag}`;
                const keys = await this.redisClient.smembers(tagKey);

                if (keys.length > 0) {
                    // Delete all keys with this tag
                    await this.redisClient.del(...keys);

                    // Remove from memory cache too
                    for (const key of keys) {
                        this.memoryCache.delete(key);
                        this.metadata.delete(key);
                    }

                    invalidatedCount += keys.length;
                }

                // Clean up the tag set
                await this.redisClient.del(tagKey);
            }

            this.emit("cache_invalidated", { tags, count: invalidatedCount });
            return invalidatedCount;
        } catch (error) {
            this.emit("cache_error", {
                operation: "invalidateByTags",
                tags,
                error,
            });
            return 0;
        }
    }

    /**
     * Get multiple values at once (batch operation)
     *
     * @param keys - Array of cache keys to retrieve
     * @returns Promise resolving to an object with key-value pairs (missing keys are omitted)
     *
     * @example
     * ```typescript
     * interface User { id: number; name: string; }
     *
     * const users = await cache.mget<User>(["user:1", "user:2", "user:3"]);
     * // users is Record<string, User>
     *
     * for (const [key, user] of Object.entries(users)) {
     *   console.log(`${key}: ${user.name}`); // TypeScript knows user.name is string
     * }
     * ```
     */
    public async mget<T = any>(keys: string[]): Promise<Record<string, T>> {
        const results: Record<string, any> = {};

        try {
            // Use Promise.all for parallel execution
            const promises = keys.map(async (key) => {
                const value = await this.get(key);
                return { key, value };
            });

            const resolved = await Promise.all(promises);

            for (const { key, value } of resolved) {
                if (value !== null) {
                    results[key] = value;
                }
            }

            return results;
        } catch (error) {
            this.emit("cache_error", { operation: "mget", keys, error });
            return {};
        }
    }

    /**
     * Set multiple values at once (batch operation)
     *
     * @param entries - Object with key-value pairs or array of [key, value] tuples
     * @param options - Optional caching options applied to all entries
     * @param options.ttl - Time to live in milliseconds for all entries
     * @param options.tags - Array of tags applied to all entries
     * @returns Promise resolving to true if all operations successful, false otherwise
     *
     * @example
     * ```typescript
     * interface User { id: number; name: string; }
     *
     * // Using object notation
     * const success1 = await cache.mset<User>({
     *   "user:1": { id: 1, name: "Alice" },
     *   "user:2": { id: 2, name: "Bob" }
     * }, { ttl: 3600000, tags: ["users"] });
     *
     * // Using array notation
     * const success2 = await cache.mset<User>([
     *   ["user:3", { id: 3, name: "Charlie" }],
     *   ["user:4", { id: 4, name: "Diana" }]
     * ], { ttl: 3600000 });
     * ```
     */
    public async mset<T = any>(
        entries: Record<string, T> | Array<[string, T]>,
        options: { ttl?: number; tags?: string[] } = {}
    ): Promise<boolean> {
        try {
            // Convert array format to object format if needed
            const entriesObj = Array.isArray(entries)
                ? Object.fromEntries(entries)
                : entries;

            // Use Promise.all for parallel execution
            const promises = Object.entries(entriesObj).map(([key, value]) =>
                this.set(key, value, options)
            );

            const results = await Promise.all(promises);
            return results.every((result) => result === true);
        } catch (error) {
            this.emit("cache_error", {
                operation: "mset",
                entries: Object.keys(entries),
                error,
            });
            return false;
        }
    }

    // ========================================
    // TYPE-SAFE ALIAS METHODS
    // ========================================

    /**
     * Read value from cache (alias for get method)
     *
     * @param key - The cache key to retrieve
     * @returns Promise resolving to the cached value with proper typing, or null if not found
     *
     * @example
     * ```typescript
     * interface User { id: number; name: string; }
     * const user = await cache.read<User>("user:123");
     * if (user) {
     *   console.log(user.name); // TypeScript knows this is a string
     * }
     * ```
     */
    public async read<T = any>(key: string): Promise<T | null> {
        return this.get<T>(key);
    }

    /**
     * Write value to cache (alias for set method)
     *
     * @param key - The cache key to store the value under
     * @param value - The value to cache with proper typing
     * @param options - Optional caching options
     * @param options.ttl - Time to live in milliseconds
     * @param options.tags - Array of tags for bulk invalidation
     * @returns Promise resolving to true if successful, false otherwise
     *
     * @example
     * ```typescript
     * interface User { id: number; name: string; email: string; }
     *
     * const user: User = { id: 123, name: "John", email: "john@example.com" };
     * const success = await cache.write<User>("user:123", user, {
     *   ttl: 3600000, // 1 hour
     *   tags: ["users", "active"]
     * });
     * ```
     */
    public async write<T = any>(
        key: string,
        value: T,
        options: { ttl?: number; tags?: string[] } = {}
    ): Promise<boolean> {
        return this.set<T>(key, value, options);
    }

    // ========================================
    // ENHANCED CACHE METHODS
    // ========================================

    /**
     * Get TTL for a specific key
     */
    public async getTTL(key: string): Promise<number> {
        const cacheKey = this.generateKey(key);

        try {
            // Check memory cache first by checking if key exists
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                if (this.memoryCache.has(cacheKey)) {
                    // For memory cache, we can't get exact TTL, so return a default
                    return 300000; // 5 minutes default
                }
            }

            // Check Redis cache
            if (
                this.redisClient &&
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid")
            ) {
                const redisTTL = await this.redisClient.ttl(cacheKey);
                return redisTTL > 0 ? redisTTL * 1000 : -1; // Convert to milliseconds
            }

            return -1; // Key doesn't exist or no TTL
        } catch (error) {
            console.error("Get TTL error:", error);
            return -1;
        }
    }

    /**
     * Set expiration time for a key
     */
    public async expire(key: string, ttl: number): Promise<boolean> {
        const cacheKey = this.generateKey(key);

        try {
            let success = false;

            // Update memory cache TTL
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                const value = await this.memoryCache.get(cacheKey);
                if (value !== null) {
                    await this.memoryCache.set(cacheKey, value, { ttl });
                    success = true;
                }
            }

            // Update Redis cache TTL
            if (
                this.redisClient &&
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid")
            ) {
                const result = await this.redisClient.expire(
                    cacheKey,
                    Math.floor(ttl / 1000)
                );
                success = success || result === 1;
            }

            return success;
        } catch (error) {
            console.error("Expire error:", error);
            return false;
        }
    }

    /**
     * Get all keys matching a pattern
     */
    public async keys(pattern?: string): Promise<string[]> {
        try {
            const allKeys: Set<string> = new Set();

            // Get keys from memory cache using metadata
            if (
                this.config.strategy === "memory" ||
                this.config.strategy === "hybrid"
            ) {
                // Use metadata to get all keys
                for (const [cacheKey] of this.metadata.entries()) {
                    const originalKey = this.extractOriginalKey(cacheKey);
                    if (originalKey) {
                        allKeys.add(originalKey);
                    }
                }
            }

            // Get keys from Redis cache
            if (
                this.redisClient &&
                (this.config.strategy === "redis" ||
                    this.config.strategy === "hybrid")
            ) {
                const redisPattern = pattern
                    ? `XyPriss:v2:*:${pattern}`
                    : "XyPriss:v2:*";
                const redisKeys = await this.redisClient.keys(redisPattern);
                redisKeys.forEach((key: string) => {
                    const originalKey = this.extractOriginalKey(key);
                    if (originalKey) {
                        allKeys.add(originalKey);
                    }
                });
            }

            const keysArray = Array.from(allKeys);

            // Apply pattern filtering if specified
            if (pattern && !pattern.includes("*")) {
                return keysArray.filter((key) => key.includes(pattern));
            }

            return keysArray;
        } catch (error) {
            console.error("Keys error:", error);
            return [];
        }
    }

    /**
     * Extract original key from cache key
     */
    private extractOriginalKey(cacheKey: string): string | null {
        // Format: XyPriss:v2:hash:originalKey
        const parts = cacheKey.split(":");
        if (parts.length >= 4 && parts[0] === "XyPriss" && parts[1] === "v2") {
            return parts.slice(3).join(":");
        }
        return null;
    }

    // ========================================
    // MONITORING AND STATISTICS
    // ========================================

    /**
     * Get comprehensive cache statistics
     */
    public async getStats(): Promise<CacheTypes.EnhancedCacheStats> {
        // Update Redis stats if available
        if (this.redisClient && this.stats.redis) {
            await this.updateRedisStats();
        }

        return { ...this.stats };
    }

    /**
     * Update Redis statistics using Redis INFO command
     */
    private async updateRedisStats(): Promise<void> {
        if (!this.redisClient || !this.stats.redis) return;

        try {
            // Get Redis INFO command output
            const info = await this.redisClient.info();
            const infoLines = info.split("\r\n");
            const infoData: Record<string, string> = {};

            // Parse INFO command output
            for (const line of infoLines) {
                if (line.includes(":")) {
                    const [key, value] = line.split(":");
                    infoData[key] = value;
                }
            }

            // Update connection status
            this.stats.redis.connected = this.redisClient.status === "ready";

            // Update memory usage
            if (infoData.used_memory) {
                this.stats.redis.memoryUsage = {
                    used: parseInt(infoData.used_memory),
                    peak: parseInt(infoData.used_memory_peak || "0"),
                    percentage: this.calculateRedisMemoryPercentage(infoData),
                };
            }

            // Update performance metrics
            if (infoData.total_commands_processed) {
                this.stats.redis.operations = parseInt(
                    infoData.total_commands_processed
                );
            }

            if (infoData.keyspace_hits && infoData.keyspace_misses) {
                const hits = parseInt(infoData.keyspace_hits);
                const misses = parseInt(infoData.keyspace_misses);
                const total = hits + misses;
                this.stats.redis.hitRate = total > 0 ? hits / total : 0;
                this.stats.redis.hits = hits;
                this.stats.redis.misses = misses;
            }

            // Update connection info
            if (infoData.connected_clients) {
                this.stats.redis.connections = parseInt(
                    infoData.connected_clients
                );
            }

            // Update key count
            if (infoData.db0) {
                const dbInfo = infoData.db0.match(/keys=(\d+)/);
                if (dbInfo) {
                    this.stats.redis.keys = parseInt(dbInfo[1]);
                }
            }

            // Update uptime
            if (infoData.uptime_in_seconds) {
                this.stats.redis.uptime =
                    parseInt(infoData.uptime_in_seconds) * 1000; // Convert to ms
            }

            // Update last update timestamp
            this.stats.redis.lastUpdate = Date.now();
        } catch (error) {
            console.error("Failed to update Redis stats:", error);
            // Mark as disconnected if we can't get stats
            this.stats.redis.connected = false;
        }
    }

    /**
     * Calculate Redis memory usage percentage
     */
    private calculateRedisMemoryPercentage(
        infoData: Record<string, string>
    ): number {
        const usedMemory = parseInt(infoData.used_memory || "0");
        const maxMemory = parseInt(infoData.maxmemory || "0");

        if (maxMemory === 0) {
            // If no max memory is set, calculate based on system memory
            const totalSystemMemory = parseInt(
                infoData.total_system_memory || "0"
            );
            if (totalSystemMemory > 0) {
                return (usedMemory / totalSystemMemory) * 100;
            }
            return 0;
        }

        return (usedMemory / maxMemory) * 100;
    }

    /**
     * Get cache health status
     */
    public getHealth(): {
        status: "healthy" | "degraded" | "unhealthy";
        details: any;
    } {
        const memoryUsage = this.stats.memory.memoryUsage.percentage;
        const hitRate = this.stats.memory.hitRate * 100;
        const redisConnected = this.redisClient?.status === "ready";

        let status: "healthy" | "degraded" | "unhealthy" = "healthy";
        const issues: string[] = [];

        if (memoryUsage > 90) {
            status = "unhealthy";
            issues.push("High memory usage");
        } else if (memoryUsage > 75) {
            status = "degraded";
            issues.push("Elevated memory usage");
        }

        if (hitRate < 50) {
            status = "unhealthy";
            issues.push("Low hit rate");
        } else if (hitRate < 80) {
            status = "degraded";
            issues.push("Suboptimal hit rate");
        }

        if (this.config.strategy !== "memory" && !redisConnected) {
            status = "unhealthy";
            issues.push("Redis disconnected");
        }

        return {
            status,
            details: {
                memoryUsage,
                hitRate,
                redisConnected,
                issues,
                uptime: Date.now() - (this.stats.memory as any).startTime || 0,
            },
        };
    }

    /**
     * Disconnect from all cache backends
     */
    public async disconnect(): Promise<void> {
        try {
            // Stop monitoring
            if (this.healthMonitor) {
                clearInterval(this.healthMonitor);
            }

            if (this.metricsCollector) {
                clearInterval(this.metricsCollector);
            }

            // Disconnect Redis
            if (this.redisClient) {
                await this.redisClient.quit();
            }

            // Clear connection pool
            for (const [, connection] of this.connectionPool) {
                await connection.quit();
            }
            this.connectionPool.clear();

            this.emit("disconnected");
        } catch (error) {
            this.emit("error", error);
            throw error;
        }
    }
}

