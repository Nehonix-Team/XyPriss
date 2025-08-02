/**
 * XyPrissJS Express Cache Module
 *
 * Ultra-fast, secure cache system combining:
 * - XyPrissJS Security Cache (memory-based with encryption)
 * - Redis Cluster support with failover
 * - Hybrid strategy for maximum performance
 * - Advanced monitoring and health checks
 */

export { SecureCacheAdapter } from "./SecureCacheAdapter";
export type { SecureCacheConfig, EnhancedCacheStats } from "./type";

// Legacy compatibility exports
export {
    SecureInMemoryCache,
    Cache,
    readCache,
    writeCache,
    getCacheStats,
    expireCache,
    clearAllCache,
} from "xypriss-security";

export type {
    CacheStats,
    CacheOptions,
} from "../../mods/security/src/components/cache/types/cache.type";