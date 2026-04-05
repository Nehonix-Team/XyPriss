/**
 * XyPrissJS Types - Main Export File
 *
 * This file serves as the main entry point for all XyPriss integration types.
 * Types are now organized into MOD files for better maintainability.
 *
 * @fileoverview Main type export file for XyPriss integration
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * import { ServerOptions, XyPrissApp } from './types';
 * // or import specific modules
 * import { CacheConfig } from './types/cache';
 * import { SecurityConfig } from './types/security';
 * ```
 */

// ===== MOD TYPE EXPORTS =====
// All types are now exported explicitly below to avoid naming conflicts
// This replaces the previous wildcard exports that caused AlertConfig conflicts

// Custom HTTP server types
import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
    NextFunction,
} from "../types/httpServer.type";

// RequestHandler type for compatibility
export type RequestHandler = (
    req: Request,
    res: Response,
    next?: NextFunction,
) => void | Promise<void>;
// import { ClusterConfig } from "./cluster";
import { ConsoleInterceptionConfig } from "../server/components/fastapi/console/types";
import {
    ComponentLogConfig,
    LogComponent,
    LogLevel,
} from "../shared/types/logger.type";
import { SecurityConfig } from "./mod/security";
import { PluginConfig } from "../plugins/types/PluginTypes";

// ===== LEGACY TYPES - MOVED TO MOD FILES =====
// These types have been moved to their respective modules for better organization.
// Import them from the specific modules instead of using these legacy exports.

// Re-export all MOD types for backward compatibility
// Using explicit exports to avoid naming conflicts

// Core types - explicit exports to avoid AlertConfig conflict
export {
    DeepPartial,
    ValidationResult,
    UserContext,
    SessionData,
    PaginationInfo,
    EnhancedRequest,
    EnhancedResponse,
    RouteHandler,
    MiddlewareFunction,
    ResponseManipulationConfig,
} from "./mod/core";

// Core AlertConfig with alias to avoid conflicts
export { AlertConfig as CoreAlertConfig } from "./mod/core";

// Cache types - explicit exports to avoid conflicts
export {
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

// Security types - primary exports
export {
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
export {
    SSLConfig as SecuritySSLConfig,
    CORSConfig as SecurityCORSConfig,
    RateLimitConfig as SecurityRateLimitConfig,
} from "./mod/security";

// Performance types - primary exports
export {
    PerformanceConfig,
    PerformanceOptimizationConfig,
    PerformanceMetrics,
    PerformanceMonitoringConfig,
    PerformanceProfilerConfig,
    PerformanceBenchmark,
} from "./mod/performance";

// Performance types with aliases to avoid conflicts
export { AlertConfig as PerformanceAlertConfig } from "./mod/performance";

// Routing types - primary exports
export {
    HttpMethod,
    RouteConfig,
    RouteCacheConfig,
    RouteValidationConfig,
    RouteOptions,
    RouterConfig,
    RouteStats,
} from "./mod/routing";

// Routing types with aliases to avoid conflicts
export { RouteRateLimitConfig as RoutingRateLimitConfig } from "./mod/routing";

// Monitoring types - primary exports
export {
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
export { AlertConfig as MonitoringAlertConfig } from "./mod/monitoring";

// Import specific types needed for ServerOptions and XyPrissApp interfaces
import type { DeepPartial, ResponseManipulationConfig } from "./mod/core";

import type { MemoryConfig } from "./mod/cache";
import { FileUploadConfig } from "../server/components/fastapi/upload/FileUploadManager";
import { NotFoundConfig } from "./NotFoundConfig";
import { XemsTypes } from "./xems.type";
import { XyApp } from "./XyApp.type";
import { XServerOptions } from "./ServerOptions";

// ===== LEGACY TYPES MOVED TO MOD FILES =====
// The following types have been moved to their respective MOD files:
// - Cache types: ./mod/cache.ts
// - Route types: ./mod/routing.ts
// - Core types: ./mod/core.ts
// - Security types: ./mod/security.ts
// - Middleware types: ./mod/middleware.ts
// - Performance types: ./mod/performance.ts
// - Server types: ./mod/server.ts
// - Monitoring types: ./mod/monitoring.ts

// ===== LEGACY INTERFACES MOVED TO MOD FILES =====
// These interfaces have been moved to their respective MOD files:
// - EnhancedRequest, EnhancedResponse: ./mod/core.ts
// - CacheBackendStrategy, CacheStrategy: ./mod/cache.ts
// - AlertConfig, ValidationResult: ./mod/core.ts
// - UserContext, SessionData, PaginationInfo: ./mod/core.ts
// - MiddlewareConfig: ./mod/middleware.ts

// ===== LEGACY SSL, CORS, AND RATE LIMIT TYPES =====
// These types have been moved to their respective MOD files:
// - SSLConfig, CORSConfig: ./mod/security.ts
// - RateLimitConfig, RouteRateLimitConfig: ./mod/routing.ts

// ===== LEGACY MIDDLEWARE TYPES MOVED TO MOD FILES =====
// All middleware-related types have been moved to ./mod/middleware.ts
// All logging, JWT, and session types have been moved to ./mod/security.ts and ./mod/server.ts

/**
 * Configuration for individual servers in multi-server mode
 *
 * @interface MultiServerConfig
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */
export interface MultiServerConfig extends Omit<
    Partial<ServerOptions>,
    "server"
> {
    /** Unique identifier for this server instance */
    id: string;

    /** Port number for this server (replaces server.port) */
    port: number;

    /** Host for this server (replaces server.host) */
    host?: string;

    /** Server-specific configuration overrides (e.g. xems, etc.) */
    server?: Omit<NonNullable<ServerOptions["server"]>, "port" | "host">;

    /** Route prefix that this server should handle */
    routePrefix?: string;

    /**
     * Strategy for handling route prefixes:
     * - "auto-inject" (default): Automatically prepends the prefix to all routes if they don't have it.
     * - "strict-match": Legacy behavior. Only registers routes that explicitly start with the prefix.
     * - "both": Registers both the prefixed version and the original version of the route.
     */
    routePrefixStrategy?: "auto-inject" | "strict-match" | "both";

    /** Array of allowed route patterns for this server */
    allowedRoutes?: string[];

    /** Response control configuration for when routes don't match */
    responseControl?: {
        /** Enable custom response control (default: false) */
        enabled?: boolean;

        /** HTTP status code to send (default: 404) */
        statusCode?: number;

        /** Response content or message */
        content?: string | object;

        /** Content type header (default: "text/plain") */
        contentType?: string;

        /** Custom headers to set */
        headers?: Record<string, string>;

        /** Custom response handler function */
        handler?: (req: Request, res: Response) => void | Promise<void>;
    };
}

export type ServerOptions = XServerOptions;



// ===== LEGACY ROUTE OPTIONS MOVED TO MOD FILES =====
// RouteOptions interface has been moved to ./mod/routing.ts

// Port management types
export type RedirectMode = "transparent" | "message" | "redirect";

export interface RedirectStats {
    totalRequests: number;
    successfulRedirects: number;
    failedRedirects: number;
    averageResponseTime: number;
    lastRequestTime?: Date;
    startTime: Date;
    uptime: number;
    requestTimes: number[];
}

export interface RedirectOptions {
    /**
     * Redirect behavior mode
     * - transparent: Proxy requests seamlessly (default)
     * - message: Show custom message with new URL
     * - redirect: Send HTTP 301/302 redirect responses
     */
    mode?: RedirectMode;

    /**
     * Custom message to display when mode is 'message'
     */
    customMessage?: string;

    /**
     * HTTP status code for redirect mode (301 or 302)
     */
    redirectStatusCode?: 301 | 302;

    /**
     * Enable/disable redirect logging
     */
    enableLogging?: boolean;

    /**
     * Enable/disable usage statistics tracking
     */
    enableStats?: boolean;

    /**
     * Auto-disconnect after specified time (in milliseconds)
     */
    autoDisconnectAfter?: number;

    /**
     * Auto-disconnect after specified number of requests
     */
    autoDisconnectAfterRequests?: number;

    /**
     * Custom response headers to add to all responses
     */
    customHeaders?: Record<string, string>;

    /**
     * Custom HTML template for message mode
     */
    customHtmlTemplate?: string;

    /**
     * Timeout for proxy requests in milliseconds
     */
    proxyTimeout?: number;

    /**
     * Enable CORS headers for cross-origin requests
     */
    enableCors?: boolean;

    /**
     * Custom error message for failed redirects
     */
    customErrorMessage?: string;

    /**
     * Rate limiting for redirect requests
     */
    rateLimit?: {
        maxRequests: number;
        windowMs: number;
    };
}

export interface RedirectServerInstance {
    fromPort: number;
    toPort: number;
    options: RedirectOptions;
    server: any;
    stats: RedirectStats;
    disconnect: () => Promise<boolean>;
    getStats: () => RedirectStats;
    updateOptions: (newOptions: Partial<RedirectOptions>) => void;
}

export type XyPrissApp = XyApp;

/**
 * XyPriss middleware handler interface.
 *
 * Enhanced middleware handler with additional context including
 * request ID and classification for performance optimization.
 *
 * @interface XyPrissMiddlewareHandler
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * const xyPrissMiddleware: XyPrissMiddlewareHandler = async (
 *   req,
 *   res,
 *   next,
 *   requestId,
 *   classification
 * ) => {
 *   // Use request ID for tracking
 *   console.log(`Processing request ${requestId}`);
 *
 *   // Use classification for optimization
 *   if (classification.isStatic) {
 *     // Handle static requests differently
 *     res.setHeader('Cache-Control', 'public, max-age=3600');
 *   }
 *
 *   // Continue to next middleware
 *   next();
 * };
 * ```
 */
export interface XyPrissMiddlewareHandler {
    /**
     * XyPriss middleware handler function.
     *
     * @param req - XyPriss request object
     * @param res - XyPriss response object
     * @param next - Next function to call next middleware
     * @param requestId - Unique request identifier for tracking
     * @param classification - Request classification for optimization
     * @returns Promise that resolves when middleware processing is complete
     */
    (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any,
    ): Promise<void>;
}

// Re-export custom HTTP server types for convenience
export type { Request, Response, NextFunction };


