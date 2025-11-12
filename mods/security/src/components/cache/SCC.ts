import { CacheHealth, CacheSetOptions, SecureCacheStats, CacheConfig } from ".";
import { SecureCacheAdapter } from "../../../../../src/cache";

/**
 * SecureCacheClient - Secure caching solution
 *
 * A high-performance, secure cache client that supports multiple backend strategies
 * including memory-only, Redis-only, and hybrid (memory + Redis) configurations.
 * Features military-grade AES-256-GCM encryption, intelligent compression, and
 * comprehensive monitoring capabilities.
 *
 * ## Features
 * - **Multi-Strategy Support**: Memory, Redis, or Hybrid caching
 * - **Military-Grade Security**: AES-256-GCM encryption with key rotation
 * - **High Availability**: Redis Cluster and Sentinel support
 * - **Performance Optimized**: Intelligent compression and hot data promotion
 * - **Production Ready**: Comprehensive monitoring and health checks
 * - **Type Safe**: Full TypeScript support with detailed interfaces
 *
 * ## Supported Cache Strategies
 * - `memory`: Ultra-fast in-memory caching with LRU eviction
 * - `redis`: Distributed Redis caching with clustering support
 * - `hybrid`: Memory-first with Redis backup for optimal performance
 *
 * ## Security Features
 * - AES-256-GCM encryption for all cached data
 * - Automatic key rotation and tamper detection
 * - Secure serialization with integrity verification
 * - Access pattern monitoring and anomaly detection
 *
 * @example Basic Redis Configuration
 * ```typescript
 * import { SecureCacheClient } from "xypriss-security";
 *
 * const cache = new SecureCacheClient({
 *   strategy: "redis",
 *   redis: {
 *     host: "localhost",
 *     port: 6379,
 *     password: "your-secure-password"
 *   }
 * });
 *
 * await cache.connect();
 * await cache.set("user:123", { name: "John", role: "admin" }, { ttl: 3600 });
 * const user = await cache.get("user:123");
 * ```
 *
 * @example Hybrid Strategy with Encryption
 * ```typescript
 * const cache = new SecureCacheClient({
 *   strategy: "hybrid",
 *   memory: {
 *     maxSize: 100, // 100MB
 *     maxEntries: 10000
 *   },
 *   redis: {
 *     host: "redis-cluster.example.com",
 *     port: 6379,
 *     cluster: {
 *       enabled: true,
 *       nodes: [
 *         { host: "redis-1", port: 6379 },
 *         { host: "redis-2", port: 6379 }
 *       ]
 *     }
 *   },
 *   security: {
 *     encryption: true,
 *     keyRotation: true
 *   }
 * });
 * ```
 *
 * @example Advanced Usage with Tags and Monitoring
 * ```typescript
 * // Store data with tags for bulk invalidation
 * await cache.set("product:123", productData, {
 *   ttl: 1800,
 *   tags: ["products", "category:electronics"]
 * });
 *
 * // Batch operations for better performance
 * await cache.mset({
 *   "user:1": userData1,
 *   "user:2": userData2
 * }, { ttl: 3600 });
 *
 * // Invalidate by tags
 * await cache.invalidateByTags(["products"]);
 *
 * // Monitor cache health
 * const health = cache.getHealth();
 * if (health.status !== "healthy") {
 *   console.warn("Cache issues:", health.details);
 * }
 *
 * // Get performance statistics
 * const stats = await cache.getStats();
 * console.log(`Hit rate: ${stats.memory.hitRate * 100}%`);
 * ```
 *
 * @since 4.2.3
 * @version 4.2.3
 * @author NEHONIX
 * @see {@link ICacheAdapter} for the complete interface definition
 * @see {@link https://lab.nehonix.space/nehonix_viewer/_doc/Nehonix%20XyPrissSecurity} for detailed documentation
 */
export class SecureCacheClient {
    private adapter: SecureCacheAdapter | null = null;
    private config: CacheConfig;

    /**
     * Creates a new SecureCacheClient instance
     *
     * @param config - Cache configuration object
     * @param config.strategy - Cache strategy: "memory", "redis", or "hybrid"
     * @param config.redis - Redis configuration (required for "redis" and "hybrid" strategies)
     * @param config.redis.host - Redis server hostname
     * @param config.redis.port - Redis server port
     * @param config.redis.password - Redis authentication password
     * @param config.redis.cluster - Redis cluster configuration
     * @param config.memory - Memory cache configuration (for "memory" and "hybrid" strategies)
     * @param config.memory.maxSize - Maximum memory cache size in MB
     * @param config.memory.maxEntries - Maximum number of cache entries
     * @param config.security - Security configuration
     * @param config.security.encryption - Enable AES-256-GCM encryption
     * @param config.security.keyRotation - Enable automatic key rotation
     * @param config.monitoring - Monitoring and health check configuration
     *
     * @example
     * ```typescript
     * const cache = new SecureCacheClient({
     *   strategy: "hybrid",
     *   redis: { host: "localhost", port: 6379 },
     *   memory: { maxSize: 100, maxEntries: 10000 },
     *   security: { encryption: true }
     * });
     * ```
     */
    constructor(config: CacheConfig) {
        this.config = config;
        // Adapter will be created lazily on first use
        this.adapter = new SecureCacheAdapter(this.config);
    }

    /**
     * Ensures the cache adapter is initialized
     * @private
     * @returns Promise resolving to the initialized adapter
     */
    private async ensureAdapter(): Promise<any> {
        if (!this.adapter) {
            // Use dynamic import for production compatibility
            const { SecureCacheAdapter } = await import(
                "../../../../../src/cache"
            );
            this.adapter = new SecureCacheAdapter(this.config);
            throw new Error(
                "SecureCacheAdapter integration not available in this context"
            );
        }
        return this.adapter!; // Non-null assertion since we just created it
    }

    /**
     * Retrieves a value from the cache
     *
     * @param key - The cache key to retrieve
     * @returns Promise resolving to the cached value, or null if not found
     *
     * @example
     * ```typescript
     * const user = await cache.read<User>("user:123");
     * if (user) {
     *   console.log("Found user:", user.name);
     * }
     * ```
     */
    async read<T = any>(key: string): Promise<T | null> {
        const adapter = await this.ensureAdapter();
        return adapter.get(key);
    }

    /**
     * Retrieves a value from the cache (alias for get method)
     *
     * @param key - The cache key to retrieve
     * @returns Promise resolving to the cached value, or null if not found
     *
     * @example
     * ```typescript
     * const user = await cache.read<User>("user:123");
     * if (user) {
     *   console.log("Found user:", user.name);
     * }
     * ```
     */

    /**
     * Stores a value in the cache with optional TTL and tags
     *
     * @param key - The cache key to store the value under
     * @param value - The value to cache (will be automatically serialized)
     * @param options - Optional caching options
     * @param options.ttl - Time to live in seconds (default: configured TTL)
     * @param options.tags - Array of tags for bulk invalidation
     * @returns Promise resolving to true if successful, false otherwise
     *
     * @example
     * ```typescript
     * // Basic usage
     * await cache.write("user:123", { name: "John", role: "admin" });
     *
     * // With TTL (1 hour)
     * await cache.write("session:abc", sessionData, { ttl: 3600 });
     *
     * // With tags for bulk invalidation
     * await cache.write("product:456", productData, {
     *   ttl: 1800,
     *   tags: ["products", "category:electronics"]
     * });
     * ```
     */
    async write<T = any>(
        key: string,
        value: T,
        options?: CacheSetOptions
    ): Promise<boolean> {
        const adapter = await this.ensureAdapter();
        return adapter.set(key, value, options);
    }

    /**
     * Stores a value in the cache (alias for set method)
     *
     * @param key - The cache key to store the value under
     * @param value - The value to cache (will be automatically serialized)
     * @param options - Optional caching options
     * @param options.ttl - Time to live in seconds (default: configured TTL)
     * @param options.tags - Array of tags for bulk invalidation
     * @returns Promise resolving to true if successful, false otherwise
     *
     * @example
     * ```typescript
     * // Basic usage
     * await cache.write("user:123", { name: "John", role: "admin" });
     *
     * // With TTL (1 hour)
     * await cache.write("session:abc", sessionData, { ttl: 3600 });
     *
     * // With tags for bulk invalidation
     * await cache.write("product:456", productData, {
     *   ttl: 1800,
     *   tags: ["products", "category:electronics"]
     * });
     * ```
     */

    /**
     * Deletes a value from the cache
     *
     * @param key - The cache key to delete
     * @returns Promise resolving to true if the key was deleted, false if not found
     *
     * @example
     * ```typescript
     * const deleted = await cache.delete("user:123");
     * if (deleted) {
     *   console.log("User cache cleared");
     * }
     * ```
     */
    async delete(key: string): Promise<boolean> {
        const adapter = await this.ensureAdapter();
        return adapter.delete(key);
    }

    /**
     * Checks if a key exists in the cache
     *
     * @param key - The cache key to check
     * @returns Promise resolving to true if the key exists, false otherwise
     *
     * @example
     * ```typescript
     * if (await cache.exists("user:123")) {
     *   console.log("User is cached");
     * }
     * ```
     */
    async exists(key: string): Promise<boolean> {
        const adapter = await this.ensureAdapter();
        return adapter.exists(key);
    }

    /**
     * Clears all cached data
     *
     * ⚠️ **Warning**: This operation is irreversible and will remove all cached data
     *
     * @returns Promise that resolves when the cache is cleared
     *
     * @example
     * ```typescript
     * await cache.clear();
     * console.log("All cache data cleared");
     * ```
     */
    async clear(): Promise<void> {
        const adapter = await this.ensureAdapter();
        return adapter.clear();
    }

    /**
     * Establishes connection to the cache backend
     *
     * Must be called before using the cache. For Redis strategies, this establishes
     * the connection to the Redis server(s). For memory-only strategy, this initializes
     * the in-memory cache.
     *
     * @returns Promise that resolves when the connection is established
     * @throws {Error} If connection fails
     *
     * @example
     * ```typescript
     * try {
     *   await cache.connect();
     *   console.log("Cache connected successfully");
     * } catch (error) {
     *   console.error("Failed to connect to cache:", error);
     * }
     * ```
     */
    async connect(): Promise<void> {
        const adapter = await this.ensureAdapter();
        return adapter.connect();
    }

    /**
     * Closes the connection to the cache backend
     *
     * Gracefully closes all connections and cleans up resources. Should be called
     * when shutting down the application.
     *
     * @returns Promise that resolves when the connection is closed
     *
     * @example
     * ```typescript
     * process.on('SIGTERM', async () => {
     *   await cache.disconnect();
     *   console.log("Cache disconnected");
     * });
     * ```
     */
    async disconnect(): Promise<void> {
        const adapter = await this.ensureAdapter();
        return adapter.disconnect();
    }

    /**
     * Retrieves comprehensive cache performance statistics
     *
     * @returns Promise resolving to detailed statistics including hit rates, memory usage, and performance metrics
     *
     * @example
     * ```typescript
     * const stats = await cache.getStats();
     * console.log(`Memory hit rate: ${stats.memory.hitRate * 100}%`);
     * console.log(`Redis hit rate: ${stats.redis?.hitRate * 100}%`);
     * console.log(`Total operations: ${stats.operations.total}`);
     * console.log(`Average response time: ${stats.performance.avgResponseTime}ms`);
     * ```
     */
    async getStats(): Promise<SecureCacheStats> {
        const adapter = await this.ensureAdapter();
        const stats: any = await adapter.getStats();

        // Transform the adapter stats to match our interface
        return {
            memory: {
                hitRate: stats.memory?.hitRate || 0,
                missRate: stats.memory?.missRate || 0,
                size: stats.memory?.size || 0,
                entries: stats.memory?.entries || 0,
                maxSize: stats.memory?.maxSize || 0,
                maxEntries: stats.memory?.maxEntries || 0,
            },
            redis: stats.redis
                ? {
                      hitRate: stats.redis.hitRate || 0,
                      missRate: stats.redis.missRate || 0,
                      connected: stats.redis.connected || false,
                      memoryUsage: stats.redis.memoryUsage || 0,
                      keyCount: stats.redis.keyCount || 0,
                  }
                : undefined,
            operations: {
                total: stats.operations?.total || stats.total || 0,
                gets: stats.operations?.gets || stats.gets || 0,
                sets: stats.operations?.sets || stats.sets || 0,
                deletes: stats.operations?.deletes || stats.deletes || 0,
                errors: stats.operations?.errors || stats.errors || 0,
            },
            performance: {
                avgResponseTime:
                    stats.performance?.avgResponseTime ||
                    stats.avgResponseTime ||
                    0,
                p95ResponseTime:
                    stats.performance?.p95ResponseTime ||
                    stats.p95ResponseTime ||
                    0,
                p99ResponseTime:
                    stats.performance?.p99ResponseTime ||
                    stats.p99ResponseTime ||
                    0,
            },
        };
    }

    /**
     * Retrieves multiple values from the cache in a single operation
     *
     * @param keys - Array of cache keys to retrieve
     * @returns Promise resolving to an object with key-value pairs (missing keys are omitted)
     *
     * @example
     * ```typescript
     * const users = await cache.mread<User>(["user:1", "user:2", "user:3"]);
     * console.log(users); // { "user:1": {...}, "user:2": {...} }
     * ```
     */
    async mread<T = any>(keys: string[]): Promise<Record<string, T>> {
        const adapter = await this.ensureAdapter();
        return adapter.mget(keys);
    }

    /**
     * Stores multiple key-value pairs in a single operation
     *
     * @param entries - Object with key-value pairs or array of [key, value] tuples
     * @param options - Optional caching options applied to all entries
     * @param options.ttl - Time to live in seconds for all entries
     * @param options.tags - Array of tags applied to all entries
     * @returns Promise resolving to true if successful, false otherwise
     *
     * @example
     * ```typescript
     * // Using object notation
     * await cache.mwrite({
     *   "user:1": { name: "Alice" },
     *   "user:2": { name: "Bob" }
     * }, { ttl: 3600 });
     *
     * // Using array notation
     * await cache.mwrite([
     *   ["session:abc", sessionData1],
     *   ["session:def", sessionData2]
     * ], { ttl: 1800, tags: ["sessions"] });
     * ```
     */
    async mwrite<T = any>(
        entries: Record<string, T> | Array<[string, T]>,
        options?: CacheSetOptions
    ): Promise<boolean> {
        const adapter = await this.ensureAdapter();
        return adapter.mset(entries, options);
    }

    /**
     * Invalidates all cache entries that have any of the specified tags
     *
     * @param tags - Array of tags to invalidate
     * @returns Promise resolving to the number of entries invalidated
     *
     * @example
     * ```typescript
     * // Invalidate all product-related cache entries
     * const count = await cache.invalidateByTags(["products", "inventory"]);
     * console.log(`Invalidated ${count} cache entries`);
     * ```
     */
    async invalidateByTags(tags: string[]): Promise<number> {
        const adapter = await this.ensureAdapter();
        return adapter.invalidateByTags(tags);
    }

    /**
     * Gets the remaining time-to-live for a cache key
     *
     * @param key - The cache key to check
     * @returns Promise resolving to TTL in seconds, or -1 if key doesn't exist, -2 if no TTL set
     *
     * @example
     * ```typescript
     * const ttl = await cache.getTTL("user:123");
     * if (ttl > 0) {
     *   console.log(`Key expires in ${ttl} seconds`);
     * }
     * ```
     */
    async getTTL(key: string): Promise<number> {
        const adapter = await this.ensureAdapter();
        return adapter.getTTL(key);
    }

    /**
     * Sets or updates the expiration time for a cache key
     *
     * @param key - The cache key to set expiration for
     * @param ttl - Time to live in seconds
     * @returns Promise resolving to true if successful, false if key doesn't exist
     *
     * @example
     * ```typescript
     * // Extend expiration to 1 hour
     * await cache.expire("user:123", 3600);
     *
     * // Set short expiration for temporary data
     * await cache.expire("temp:data", 60);
     * ```
     */
    async expire(key: string, ttl: number): Promise<boolean> {
        const adapter = await this.ensureAdapter();
        return adapter.expire(key, ttl);
    }

    /**
     * Retrieves all cache keys matching an optional pattern
     *
     * ⚠️ **Warning**: Use with caution in production as this can be expensive for large caches
     *
     * @param pattern - Optional glob-style pattern to filter keys (Redis syntax)
     * @returns Promise resolving to array of matching keys
     *
     * @example
     * ```typescript
     * // Get all keys
     * const allKeys = await cache.keys();
     *
     * // Get user-related keys
     * const userKeys = await cache.keys("user:*");
     *
     * // Get session keys with pattern
     * const sessionKeys = await cache.keys("session:*:active");
     * ```
     */
    async keys(pattern?: string): Promise<string[]> {
        const adapter = await this.ensureAdapter();
        return adapter.keys(pattern);
    }

    /**
     * Gets the current health status of the cache system
     *
     * @returns Health status object with overall status and detailed information
     *
     * @example
     * ```typescript
     * const health = cache.getHealth();
     *
     * switch (health.status) {
     *   case "healthy":
     *     console.log("Cache is operating normally");
     *     break;
     *   case "degraded":
     *     console.warn("Cache has issues but is functional:", health.details);
     *     break;
     *   case "unhealthy":
     *     console.error("Cache is not functional:", health.details);
     *     break;
     * }
     *
     * // Check specific metrics
     * if (health.details.redis?.connected === false) {
     *   console.error("Redis connection lost");
     * }
     * ```
     */
    getHealth(): CacheHealth {
        if (!this.adapter) {
            return {
                status: "unhealthy",
                details: {
                    errors: ["Cache adapter not initialized"],
                    lastCheck: new Date(),
                },
            };
        }
        return this.adapter.getHealth();
    }

    /**
     * Memoizes a function with intelligent caching
     *
     * This method implements memoization - caching function results based on their inputs.
     * It simplifies the common pattern of:
     * 1. Generate a cache key from function parameters
     * 2. Check if result exists in cache
     * 3. If not, execute the function and cache the result
     * 4. Return the cached or computed result
     *
     * @param keyGenerator - Function that generates a cache key from the parameters
     * @param computeFunction - Function to execute if cache miss occurs
     * @param options - Optional caching options
     * @returns A memoized version of the function
     *
     * @example
     * ```typescript
     * import { Hash } from "xypriss-security";
     *
     * // Simple memoization with automatic key generation
     * const memoizedSum = cache.memoize(
     *   (a: number, b: number) => Hash.create(String(a + b)).toString("hex"),
     *   (a: number, b: number) => a + b,
     *   { ttl: 3600 }
     * );
     *
     * const result = await memoizedSum(1, 2); // Computes and caches
     * const cached = await memoizedSum(1, 2); // Returns from cache
     *
     * // Advanced usage with async function
     * const fetchUser = cache.memoize(
     *   (userId: string) => `user:${userId}`,
     *   async (userId: string) => {
     *     const response = await fetch(`/api/users/${userId}`);
     *     return response.json();
     *   },
     *   { ttl: 1800, tags: ["users"] }
     * );
     *
     * const user = await fetchUser("123");
     * ```
     */
    memoize<TArgs extends any[], TResult>(
        keyGenerator: (...args: TArgs) => string,
        computeFunction: (...args: TArgs) => TResult | Promise<TResult>,
        options?: CacheSetOptions
    ) {
        return async (...args: TArgs): Promise<TResult> => {
            // Ensure cache is connected
            await this.ensureAdapter();

            // Generate cache key
            const cacheKey = keyGenerator(...args);

            // Try to get from cache first
            const cachedResult = await this.read<TResult>(cacheKey);

            if (cachedResult !== null && cachedResult !== undefined) {
                return cachedResult;
            }

            // Cache miss - compute the result
            const result = await computeFunction(...args);

            // Store in cache
            await this.write(cacheKey, result, options);

            return result;
        };
    }
}

