/**
 * XyPrissJS Express Powerhouse
 * Express utility with Redis caching, smart optimization, and military-grade security
 *
 * @author Nehonix team
 * @description Zero-configuration, ultra-fast, secure Express server factory
 */

export * from "./server/ServerFactory";
export * from "./server/components/fastapi/smart-routes";
export { createOptimalCache } from "./cache/CacheFactory";
export { SecurityMiddleware } from "./middleware/security-middleware";
export { PerformanceMonitor } from "./server/optimization/performance-monitor";

// Cluster management system
export * from "./cluster";

// Types
export type {
    ServerConfig,
    RouteConfig,
    CacheConfig,
    SecurityConfig,
    PerformanceConfig,
} from "./types/types";

// Quick start exports for immediate use
export * from "./quick-start";

