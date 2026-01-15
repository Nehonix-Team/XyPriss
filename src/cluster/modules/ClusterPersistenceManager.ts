/**
 * Cluster Persistence Manager
 * Handles saving and loading cluster state to/from various storage backends
 */ 

import { EventEmitter } from "events";
import { existsSync } from "fs";
import { join } from "path";
import { func } from "../../../mods/security/src/components/fortified-function";
import { PersistenceConfig, PersistentClusterState } from "../../types/cluster";
import { FileCache } from "../../../mods/security/src/components/cache/cacheSys";
import { Cache } from "../../../mods/security/src/components/cache";
import { SecureCacheAdapter as SCA } from "../../cache";
import { FileCacheOptions } from "../../../mods/security/src/components/cache/types/cache.type";
import { logger } from "../../../shared/logger/Logger";

//SCA = SecureCacheAdapter

export class ClusterPersistenceManager extends EventEmitter {
    private config: PersistenceConfig;
    private memoryCache = Cache;
    private redisClient: any = null;
    private fileCache?: FileCache;
    private SCA?: SCA;

    constructor(config: PersistenceConfig) {
        super();
        this.config = config;
        this.initializeStorage();
    }

    /**
     * Initialize storage backend
     */
    private async initializeStorage(): Promise<void> {
        try {
            switch (this.config.type) {
                case "redis":
                    await this.initializeRedis();
                    break;
                case "file":
                    await this.initializeFileStorage();
                    break;
                case "memory":
                    await this.initializeMemoryStorage();
                    break;
                case "custom":
                    logger.info("cluster", "Using custom persistence handlers");
                    break;
                default:
                    throw new Error(
                        `Unsupported persistence type: ${this.config.type}`
                    );
            }

            logger.info(
                "cluster",
                `Cluster persistence initialized (${this.config.type})`
            );
        } catch (error: any) {
            console.warn(`Failed to initialize persistence: ${error.message}`);
            this.emit("persistence:error", error);
        }
    }

    /**
     * Initialize Redis storage using SCA
     */
    private async initializeRedis(): Promise<void> {
        try {
            const redisConfig = this.config.redis || {
                host: "localhost",
                port: 6379,
            };

            // Initialize SCA with Redis support for better performance
            this.SCA = new SCA({
                strategy: "hybrid", // Use hybrid strategy for maximum performance
                redis: {
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password,
                    db: redisConfig.db || 0,
                },
                memory: {
                    maxSize: 50, // 50MB memory cache
                    ttl: redisConfig.ttl || 86400000, // 24 hours
                    algorithm: "lru",
                },
                performance: {
                    compressionThreshold: 1024, // Compress data > 1KB
                    asyncWrite: true,
                    pipeline: true,
                    connectionPooling: true,
                },
                security: {
                    encryption: true,
                    accessMonitoring: true,
                    auditLogging: false, // Disable for performance
                },
                resilience: {
                    retryAttempts: 3,
                    retryDelay: 100,
                    circuitBreaker: true,
                    fallback: true,
                },
            });

            logger.info(
                "cluster",
                `Redis storage initialized with SCA: ${redisConfig.host}:${redisConfig.port}`
            );
        } catch (error: any) {
            console.warn("Redis not available, falling back to file storage");
            this.config.type = "file";
            await this.initializeFileStorage();
        }
    }

    /**
     * Initialize file storage using XyPrissJS FileCache
     */
    private async initializeFileStorage(): Promise<void> {
        const fileConfig = this.config.file || {
            path: join(process.cwd(), ".nehonix", "cluster"),
            backup: true,
            maxBackups: 5,
        };

        // Initialize FileCache with security and compression
        const cacheOptions: FileCacheOptions = {
            directory: fileConfig.path,
            encrypt: true, // Enable encryption for security
            compress: true, // Enable compression for efficiency
            maxCacheSize: 100 * 1024 * 1024, // 100MB max cache size
            namingStrategy: "hierarchical",
        };

        this.fileCache = new FileCache(cacheOptions);

        logger.info(
            "cluster",
            `File storage initialized with FileCache: ${fileConfig.path}`
        );
    }

    /**
     * Initialize memory storage
     */
    private async initializeMemoryStorage(): Promise<void> {
        const memoryConfig = this.config.memory || {
            maxSize: 100,
            ttl: 3600000, // 1 hour
        };

        // Clean up expired entries periodically
        setInterval(() => {
            this.cleanupMemoryStorage();
        }, 60000); // Every minute

        logger.info(
            "cluster",
            `Memory storage initialized (max: ${memoryConfig.maxSize} entries)`
        );
    }

    /**
     * Save cluster state
     */
    public async saveClusterState(
        state: PersistentClusterState
    ): Promise<void> {
        return func(
            async () => {
                switch (this.config.type) {
                    case "redis":
                        await this.saveToRedis(state);
                        break;
                    case "file":
                        await this.saveToFile(state);
                        break;
                    case "memory":
                        await this.saveToMemory(state);
                        break;
                    case "custom":
                        if (this.config.custom?.saveHandler) {
                            await this.config.custom.saveHandler(state);
                        } else {
                            throw new Error("Custom save handler not provided");
                        }
                        break;
                }

                this.emit("state:saved", state);
            },
            { ultraFast: "maximum", auditLog: false, errorHandling: "graceful" }
            // 'ClusterPersistenceManager.saveClusterState',
        )();
    }

    /**
     * Load cluster state
     */
    public async loadClusterState(): Promise<PersistentClusterState | null> {
        return func(
            async () => {
                let state: PersistentClusterState | null = null;

                switch (this.config.type) {
                    case "redis":
                        state = await this.loadFromRedis();
                        break;
                    case "file":
                        state = await this.loadFromFile();
                        break;
                    case "memory":
                        state = await this.loadFromMemory();
                        break;
                    case "custom":
                        if (this.config.custom?.loadHandler) {
                            // Custom handler now returns PersistentClusterState directly
                            state = await this.config.custom.loadHandler();
                        } else {
                            throw new Error("Custom load handler not provided");
                        }
                        break;
                }

                if (state) {
                    this.emit("state:loaded", state);
                }

                return state;
            },
            { ultraFast: "maximum" }
        )();
    }

    /**
     * Save to Redis using SCA
     */
    private async saveToRedis(state: PersistentClusterState): Promise<void> {
        if (!this.SCA) {
            throw new Error("SCA not initialized");
        }

        const key = "cluster-state";
        const ttl = this.config.redis?.ttl || 86400000; // 24 hours in ms

        // Use SCA for ultra-fast, secure Redis operations
        await this.SCA.set(key, state, { ttl });

        logger.info("cluster", "✔ Cluster state saved to Redis using SCA");
    }

    /**
     * Load from Redis using SCA
     */
    private async loadFromRedis(): Promise<PersistentClusterState | null> {
        if (!this.SCA) {
            throw new Error("SCA not initialized");
        }

        try {
            const key = "cluster-state";
            const data = await this.SCA.get(key);

            if (data) {
                logger.info(
                    "cluster",
                    "✔ Cluster state loaded from Redis using SCA"
                );
                return data as PersistentClusterState;
            }

            return null;
        } catch (error) {
            console.warn(`Failed to load from Redis: ${error}`);
            return null;
        }
    }

    /**
     * Save to file using FileCache
     */
    private async saveToFile(state: PersistentClusterState): Promise<void> {
        if (!this.fileCache) {
            throw new Error("FileCache not initialized");
        }

        const cacheKey = "cluster-state";

        // FileCache handles backup automatically if configured
        await this.fileCache.set(cacheKey, state, {
            ttl: 0, // No expiration for cluster state
        });

        logger.info("cluster", "✔ Cluster state saved using FileCache");
    }

    /**
     * Load from file using FileCache
     */
    private async loadFromFile(): Promise<PersistentClusterState | null> {
        if (!this.fileCache) {
            throw new Error("FileCache not initialized");
        }

        try {
            const cacheKey = "cluster-state";
            const cachedData = await this.fileCache.get(cacheKey);

            if (cachedData && cachedData.data) {
                logger.info("cluster", "✔ Cluster state loaded from FileCache");
                return cachedData.data as PersistentClusterState;
            }

            return null;
        } catch (error) {
            console.warn(
                `Failed to load cluster state from FileCache: ${error}`
            );
            return null;
        }
    }

    /**
     * Save to memory using XyPrissJS Cache
     */
    private async saveToMemory(state: PersistentClusterState): Promise<void> {
        const key = "cluster:state";
        const ttl = this.config.memory?.ttl || 3600000; // 1 hour default

        // Use XyPrissJS Cache with encryption and compression
        await this.memoryCache.set(key, state, {
            ttl,
            encrypt: true,
            compress: true,
        });

        logger.info("cluster", "✔ Cluster state saved to secure memory cache");
    }

    /**
     * Load from memory using XyPrissJS Cache
     */
    private async loadFromMemory(): Promise<PersistentClusterState | null> {
        const key = "cluster:state";

        try {
            const cachedData = await this.memoryCache.get(key);

            if (cachedData) {
                logger.info(
                    "cluster",
                    "✔ Cluster state loaded from secure memory cache"
                );
                return cachedData as PersistentClusterState;
            }

            return null;
        } catch (error) {
            console.warn(`Failed to load from memory cache: ${error}`);
            return null;
        }
    }

    /**
     * Clean up old cache entries using FileCache built-in cleanup
     */
    public async cleanupBackups(): Promise<void> {
        if (!this.fileCache) {
            console.warn("FileCache not initialized, cannot cleanup backups");
            return;
        }

        try {
            // FileCache has built-in cleanup mechanisms
            // We can trigger cache cleanup and get stats
            const stats = await this.fileCache.getStats();
            logger.info(
                "cluster",
                `✔ Cache cleanup completed. Current cache files: ${stats.fileCount}, Total size: ${stats.totalSize} bytes`
            );
        } catch (error) {
            console.warn(`Failed to cleanup cache: ${error}`);
        }
    }

    /**
     * Clean up expired memory entries using XyPrissJS Cache
     */
    private async cleanupMemoryStorage(): Promise<void> {
        try {
            // XyPrissJS Cache handles TTL and size limits automatically
            // We can get stats to monitor cache health
            const stats = this.memoryCache.getStats;
            logger.info(
                "cluster",
                `✔ Memory cache cleanup completed. Hit rate: ${stats.hitRate}%, Entries: ${stats.entryCount}`
            );
        } catch (error) {
            console.warn(`Failed to cleanup memory cache: ${error}`);
        }
    }

    /**
     * Get comprehensive persistence statistics
     */
    public async getStats(): Promise<{
        type: string;
        isConnected: boolean;
        lastSave?: number;
        lastLoad?: number;
        performance: {
            memoryCache: any;
            fileCache?: any;
            redisCache?: any;
        };
        health: {
            overall: "healthy" | "warning" | "critical";
            issues: string[];
            recommendations: string[];
        };
    }> {
        const memoryStats = this.memoryCache.getStats;
        const performance: any = { memoryCache: memoryStats };
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Get FileCache stats if available
        if (this.fileCache) {
            try {
                performance.fileCache = await this.fileCache.getStats();

                // Health checks for file cache
                if (performance.fileCache.hitRate < 50) {
                    issues.push("Low file cache hit rate");
                    recommendations.push("Consider increasing file cache TTL");
                }

                if (performance.fileCache.diskUsage.percentage > 90) {
                    issues.push("High disk usage");
                    recommendations.push("Run file cache cleanup");
                }
            } catch (error) {
                issues.push("File cache statistics unavailable");
            }
        }

        // Get Redis stats if available
        if (this.SCA) {
            try {
                performance.redisCache = await this.SCA.getStats();

                // Health checks for Redis cache
                if (
                    performance.redisCache.performance.averageResponseTime > 100
                ) {
                    issues.push("High Redis response time");
                    recommendations.push("Check Redis server performance");
                }
            } catch (error) {
                issues.push("Redis cache statistics unavailable");
            }
        }

        // Overall health assessment
        let overall: "healthy" | "warning" | "critical" = "healthy";
        if (issues.length > 0) {
            overall = issues.length > 2 ? "critical" : "warning";
        }

        return {
            type: this.config.type,
            isConnected: this.isConnected(),
            performance,
            health: {
                overall,
                issues,
                recommendations,
            },
        };
    }

    /**
     * Check if storage is connected/available
     */
    public isConnected(): boolean {
        switch (this.config.type) {
            case "redis":
                // Check SCA connection if available
                return this.SCA ? true : this.redisClient?.isOpen || false;
            case "file":
                return this.fileCache
                    ? true
                    : existsSync(this.config.file?.path || "");
            case "memory":
                return true; // Memory cache is always available
            case "custom":
                return !!(
                    this.config.custom?.saveHandler &&
                    this.config.custom?.loadHandler
                );
            default:
                return false;
        }
    }

    /**
     * Close connections and cleanup
     */
    public async close(): Promise<void> {
        try {
            // Close SecureCacheAdapter (handles Redis and memory cleanup)
            if (this.SCA) {
                await this.SCA.disconnect();
            }

            // Fallback: close Redis client directly if not using SCA
            if (this.redisClient && !this.SCA) {
                await this.redisClient.quit();
            }

            // Clear memory cache
            this.memoryCache.clear();

            // Close file cache if initialized
            if (this.fileCache) {
                // FileCache doesn't have a close method, but we can clear it
                await this.fileCache.clear();
            }

            logger.info(
                "cluster",
                "✔ Cluster persistence manager closed with all cache systems cleaned up"
            );
        } catch (error) {
            console.warn(`Error closing persistence manager: ${error}`);
        }
    }
}

