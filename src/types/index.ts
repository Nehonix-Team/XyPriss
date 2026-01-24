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
export * as Performance from "./mod/performance";
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

// Bun-specific types and imports
import { XyPrissSys } from "../sys";
import { Configs } from "../config";
import { XyPrissConst } from "../const";

declare global {
    /**
     * **XyPriss System Variables Manager (`__sys__`)**
     *
     * Provides centralized access to system-level variables, environment detection, and dynamic
     * configuration management. This global instance serves as a type-safe wrapper around
     * application metadata and environment utilities.
     *
     * @global
     * @type {XyPrissSys}
     *
     * @example
     * ```typescript
     * // Environment Detection
     * if (__sys__.$isProduction()) {
     *   console.log("Running in production mode");
     * }
     *
     * // Dynamic Variable Management
     * __sys__.$add("appName", "MyXyPrissApp");
     * const version = __sys__.$get("version", "1.0.0");
     *
     * // Bulk Update
     * __sys__.$update({
     *   author: "Nehonix",
     *   debug: true
     * });
     * ```
     *
     * @see {@link https://xypriss.nehonix.com/docs/features/sys-globals?kw=the%20__sys__}
     */
    var __sys__: XyPrissSys;

    /**
     * **XyPriss Configuration Manager (`__cfg__`)**
     *
     * A singleton interface for managing the core XyPriss server configuration.
     * It handles deep merging of options, default values, and provides a single source
     * of truth for all server components (security, performance, routing, etc.).
     *
     * @global
     * @type {typeof Configs}
     *
     * @example
     * ```typescript
     * // Accessing Configuration
     * const serverPort = __cfg__.get("server")?.port;
     * const isSecurityEnabled = __cfg__.get("security")?.enabled;
     *
     * // Updating Configuration (Deep Merge)
     * __cfg__.update("performance", {
     *   slowRequestThreshold: 1000
     * });
     *
     * // Check Initialization State
     * if (__cfg__.isInitialized()) {
     *   console.log("Server configuration is ready");
     * }
     * ```
     *
     * @see {@link https://github.com/Nehonix-Team/XyPriss/blob/master/docs/CFG_API.md}
     */
    var __cfg__: typeof Configs;

    /**
     * **XyPriss Immutable Constants (`__const__`)**
     *
     * A global registry for immutable application constants. Once a value is set
     * via `__const__.$set()`, it cannot be modified or redefined, ensuring
     * data integrity across the entire application lifecycle.
     *
     * @global
     * @type {XyPrissConst}
     * @version 3.0.0
     *
     * @example
     * ```typescript
     * // Defining a constant (only once)
     * __const__.$set('SERVER_PORT', 8080);
     *
     * // Attempting to redefine will throw an error
     * try {
     *   __const__.$set('SERVER_PORT', 9000);
     * } catch (e) {
     *   console.error(e.message); // Cannot redefine constant "SERVER_PORT"
     * }
     *
     * // Accessing a constant
     * const port = __const__.$get('SERVER_PORT');
     *
     * // Making an object deeply immutable
     * const config = __const__.$make({ port: 8080 });
     * config.port = 9000; // Throws error!
     * ```
     *@see {@link https://github.com/Nehonix-Team/XyPriss/blob/master/docs/CONST_API.md}
     * @see {@link https://github.com/Nehonix-Team/XyPriss/blob/master/docs/GLOBAL_APIS.md}
     */
    var __const__: XyPrissConst;
}

export { XyPrissSys, XyPrissConst };

type BunSubprocess = {
    exited: Promise<number | null>;
    kill: (signal?: string) => void;
    killed: boolean;
    pid: number;
    stdout?: ReadableStream<Uint8Array>;
    stderr?: ReadableStream<Uint8Array>;
    stdin?: WritableStream<Uint8Array>;
};

export interface BunWorker {
    id: string;
    subprocess: BunSubprocess;
    port: number;
    status: "starting" | "running" | "stopping" | "stopped" | "error";
    startTime: number;
    restarts: number;
    lastPing: number;
    health: {
        status: "healthy" | "unhealthy" | "unknown";
        consecutiveFailures: number;
        lastError?: string;
    };
}

export interface BunClusterMetrics {
    totalWorkers: number;
    activeWorkers: number;
    totalRequests: number;
    averageResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    errorRate: number;
    restartCount: number;
}



