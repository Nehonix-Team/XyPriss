/**
 * @fileoverview Main export file for XyPrissJS Express integration types
 *
 * This file provides a centralized export point for all Express integration
 * types, organized into modular categories for better maintainability.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * // Import all types
 * import * as XyPrissTypes from './types';
 *
 * // Import specific categories
 * import { CacheConfig, SecurityConfig } from './types';
 *
 * // Import from specific modules
 * import { PerformanceMetrics } from './types/performance';
 * import { RouteConfig } from './types/routing';
 * ```
 */

// Export all types from the main types file (includes legacy compatibility)
export * from "./types";

// Export modular type categories for direct access
export * as Core from "./mod/core";
export * as Cache from "./mod/cache";
export * as Security from "./mod/security";
export * as Middleware from "./mod/middleware";
export * as Performance from "./mod/performance";
export * as Server from "./mod/server";
export * as Routing from "./mod/routing";
export * as Monitoring from "./mod/monitoring";

// Re-export commonly used interfaces for convenience
export type {
    // Core types
    DeepPartial,
    EnhancedRequest,
    EnhancedResponse,
    RouteHandler,
    MiddlewareFunction,
    ValidationResult,
    UserContext,
    SessionData,
    PaginationInfo,
} from "./mod/core";

// Core AlertConfig with alias to avoid conflicts
export type { AlertConfig as CoreAlertConfig } from "./mod/core";

export type {
    // Cache types
    CacheConfig,
    CacheBackendStrategy,
    RedisConfig,
    MemoryConfig,
    CacheMetrics,
    CacheStrategy,
    CachePerformanceConfig,
    CacheSecurityConfig,
    CacheMonitoringConfig,
    CacheResilienceConfig,
} from "./mod/cache";

export type {
    // Security types - primary exports
    SecurityConfig,
    SecurityLevel,
    EncryptionConfig,
    AuthenticationConfig,
    JWTConfig,
    SessionConfig,
    SessionCookieConfig,
    RouteSecurityConfig,
} from "./mod/security";

// Security types with aliases to avoid conflicts
export type {
    SSLConfig as SecuritySSLConfig,
    CORSConfig as SecurityCORSConfig,
    RateLimitConfig as SecurityRateLimitConfig,
} from "./mod/security";

export type {
    // Middleware types
    MiddlewareConfiguration,
    MiddlewarePriority,
    SecurityMiddlewareOptions,
    CompressionMiddlewareOptions,
    RateLimitMiddlewareOptions,
    CorsMiddlewareOptions,
    MiddlewareInfo,
    MiddlewareStats,
    CustomMiddleware,
    MiddlewareExecutionContext,
    MiddlewareAPIInterface,
} from "./mod/middleware";

export type {
    // Performance types
    PerformanceConfig,
    PerformanceOptimizationConfig,
    PerformanceMetrics,
    PerformanceMonitoringConfig,
    PerformanceProfilerConfig,
    PerformanceBenchmark,
} from "./mod/performance";

// Performance types with aliases to avoid conflicts
export type { AlertConfig as PerformanceAlertConfig } from "./mod/performance";

export type {
    // Server types - these take precedence for main exports
    ServerConfig,
    AutoPortSwitchConfig,
    CompressionConfig,
    LoggingConfig,
    FileWatcherConfig,
    TypeScriptTypeCheckConfig,
    TypeScriptExecutionConfig,
    SSLConfig,
    CORSConfig,
    RateLimitConfig,
} from "./mod/server";

export type {
    // Routing types
    HttpMethod,
    RouteConfig,
    RouteCacheConfig,
    RouteValidationConfig,
    RouteOptions,
    RouterConfig,
    RouteStats,
} from "./mod/routing";

// Routing types with aliases to avoid conflicts
export type { RouteRateLimitConfig as RoutingRateLimitConfig } from "./mod/routing";

export type {
    // Monitoring types
    MonitoringConfig,
    HealthCheckConfig,
    HealthCheck,
    HealthCheckResult,
    SystemMetrics,
    AlertCondition,
    AlertAction,
    ObservabilityConfig,
} from "./mod/monitoring";

// Monitoring types with aliases to avoid conflicts
export type { AlertConfig as MonitoringAlertConfig } from "./mod/monitoring";

// Main application interfaces
export type {
    ServerOptions,
    UltraFastApp,
    UltraFastMiddlewareHandler,
} from "./types";

