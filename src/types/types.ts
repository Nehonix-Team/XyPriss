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
 * import { ServerOptions, UltraFastApp } from './types';
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

// Trust proxy types
import { TrustProxyValue } from "./trustProxy";

// RequestHandler type for compatibility
export type RequestHandler = (
    req: Request,
    res: Response,
    next?: NextFunction
) => void | Promise<void>;
import { SecureCacheAdapter } from "../cache";
import { Server as HttpServer } from "http";
import { ClusterConfig } from "./cluster";
import type { RequestPreCompiler } from "../server/optimization/RequestPreCompiler";
import { OptimizedRoute } from "./UFOptimizer.type";
import { ConsoleInterceptionConfig } from "../server/components/fastapi/console/types";
import {
    ComponentLogConfig,
    LogComponent,
    LogLevel,
} from "../../shared/types/logger.type";
import { SecurityConfig } from "./mod/security";
import { PerformanceConfig } from "./mod/performance";
import { CacheConfig } from "./mod/cache";
import { MultiServerInstance } from "../server/components/multi-server/MultiServerManager";

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

// Import specific types needed for ServerOptions and UltraFastApp interfaces
import type { DeepPartial } from "./mod/core";

import type { RouteOptions } from "./mod/routing";
import type { MemoryConfig } from "./mod/cache";
import {
    MiddlewareConfiguration,
    XyPrissMiddlewareAPI,
} from "./middleware-api.types";
import { FileUploadConfig } from "../server/components/fastapi/FileUploadManager";
import { NotFoundConfig } from "./NotFoundConfig";

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
export interface MultiServerConfig {
    /** Unique identifier for this server instance */
    id: string;

    /** Port number for this server */
    port: number;

    /** Host for this server (optional, defaults to main config) */
    host?: string;

    /** Route prefix that this server should handle */
    routePrefix?: string;

    /** Array of allowed route patterns for this server */
    allowedRoutes?: string[];

    /** Server-specific overrides */
    server?: {
        host?: string;
        trustProxy?: TrustProxyValue;
        jsonLimit?: string;
        urlEncodedLimit?: string;
        enableMiddleware?: boolean;
        autoParseJson?: boolean;
    };

    /** Security overrides for this server */
    security?: SecurityConfig;

    /** Performance overrides for this server */
    performance?: PerformanceConfig;

    /** Cache overrides for this server */
    cache?: CacheConfig;

    /** File upload overrides for this server */
    fileUpload?: FileUploadConfig;

    /** Middleware configuration specific to this server */
    middleware?: MiddlewareConfiguration;

    /** Logging configuration specific to this server */
    logging?: ComponentLogConfig;

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

/**
 * @fileoverview Comprehensive server options interface for XyPriss integration
 *
 * This interface provides complete configuration options for creating UF,
 * secure servers with advanced features including caching, clustering,
 * performance optimization, and Go integration.
 *
 * @interface ServerOptions
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * import { createServer, ServerOptions } from 'xypriss';
 *
 * const serverOptions: ServerOptions = {
 *   env: 'production',
 *   cache: {
 *     strategy: 'hybrid',
 *     maxSize: 1024 * 1024 * 100, // 100MB
 *     ttl: 3600,
 *     enabled: true,
 *     enableCompression: true
 *   },
 *   security: {
 *     encryption: true,
 *     cors: true,
 *     helmet: true
 *   },
 *   performance: {
 *     optimizationEnabled: true,
 *     aggressiveCaching: true,
 *     parallelProcessing: true
 *   },
 *   server: {
 *     port: 3000,
 *     host: '0.0.0.0',
 *     autoPortSwitch: {
 *       enabled: true,
 *       maxAttempts: 5
 *     }
 *   }
 * };
 *
 * const app = createServer(serverOptions);
 * ```
 */
export interface ServerOptions {
    notFound?: NotFoundConfig;

    /**
     * Environment mode for the server.
     *
     * Determines the runtime environment and enables environment-specific
     * optimizations and configurations.
     *
     * @default 'development'
     *
     * @example
     * ```typescript
     * env: 'production' // Enables production optimizations
     * ```
     */
    env?: "development" | "production" | "test";

    /**
     * Cache configuration for ultra-fast data access.
     *
     * Comprehensive caching system supporting multiple backends,
     * compression, and intelligent strategies.
     *
     * @example
     * ```typescript
     * cache: {
     *   strategy: 'hybrid', // Memory + Redis
     *   maxSize: 1024 * 1024 * 100, // 100MB
     *   ttl: 3600, // 1 hour
     *   enabled: true,
     *   enableCompression: true,
     *   compressionLevel: 6,
     *   redis: {
     *     host: 'localhost',
     *     port: 6379,
     *     cluster: true,
     *     nodes: [
     *       { host: 'redis-1', port: 6379 },
     *       { host: 'redis-2', port: 6379 }
     *     ]
     *   },
     *   memory: {
     *     heapSize: 1024 * 1024 * 50, // 50MB
     *     cleanupInterval: 60000 // 1 minute
     *   }
     * }
     * ```
     */
    cache?: {
        /** Maximum cache size in bytes */
        maxSize?: number;

        /** Cache strategy selection */
        strategy?: "auto" | "memory" | "redis" | "hybrid" | "distributed";

        /** Default TTL in seconds */
        ttl?: number;

        /** Redis configuration */
        redis?: {
            /** Redis server hostname */
            host?: string;

            /** Redis server port */
            port?: number;

            /** Redis authentication password */
            password?: string;

            /** Enable Redis cluster mode */
            cluster?: boolean;

            /** Cluster node configurations */
            nodes?: Array<{
                host: string;
                port: number;
            }>;
        };

        /** Memory cache configuration */
        memory?: MemoryConfig;

        /** Enable caching system */
        enabled?: boolean;

        /** Enable cache compression */
        enableCompression?: boolean;

        /** Compression level (0-9) */
        compressionLevel?: number;
    };

    /**
     * Performance optimization configuration.
     *
     * Advanced performance features for ultra-fast execution,
     * intelligent caching, and request optimization.
     *
     * @example
     * ```typescript
     * performance: {
     *   optimizationEnabled: true,
     *   aggressiveCaching: true,
     *   parallelProcessing: true,
     *   preCompilerEnabled: true,
     *   learningPeriod: 300000, // 5 minutes
     *   optimizationThreshold: 1000, // requests
     *   workers: {
     *     cpu: 4,
     *     io: 8
     *   },
     *   ultraFastRulesEnabled: true,
     *   staticRouteOptimization: true,
     *   patternRecognitionEnabled: true
     * }
     * ```
     */
    performance?: {
        /** Enable response compression */
        compression?: boolean;

        /** Batch size for bulk operations */
        batchSize?: number;

        /** Enable connection pooling */
        connectionPooling?: boolean;

        /** Enable asynchronous write operations */
        asyncWrite?: boolean;

        /** Enable data prefetching */
        prefetch?: boolean;

        /** Worker configuration */
        workers?: {
            /** Number of CPU workers */
            cpu?: number;

            /** Number of I/O workers */
            io?: number;
        };

        /** Enable general optimization */
        optimizationEnabled?: boolean;

        /** Enable request classification */
        requestClassification?: boolean;

        /** Enable predictive preloading */
        predictivePreloading?: boolean;

        /** Enable aggressive caching */
        aggressiveCaching?: boolean;

        /** Enable parallel processing */
        parallelProcessing?: boolean;

        /** Enable request pre-compiler */
        preCompilerEnabled?: boolean;

        /** Learning period for optimization in milliseconds */
        learningPeriod?: number;

        /** Number of requests before optimization kicks in */
        optimizationThreshold?: number;

        /** Enable aggressive optimization mode */
        aggressiveOptimization?: boolean;

        /** Maximum number of compiled routes */
        maxCompiledRoutes?: number;

        /** Enable ultra-fast rules */
        ultraFastRulesEnabled?: boolean;

        /** Enable static route optimization */
        staticRouteOptimization?: boolean;

        /** Enable pattern recognition */
        patternRecognitionEnabled?: boolean;

        /** Enable cache warmup */
        cacheWarmupEnabled?: boolean;

        /** Warmup cache on startup */
        warmupOnStartup?: boolean;

        /** Precompute common responses */
        precomputeCommonResponses?: boolean;

        /** Custom health data provider */
        customHealthData?: () => any | Promise<any>;

        /** Custom status data provider */
        customStatusData?: () => any | Promise<any>;
    };

    // Monitoring configuration
    monitoring?: {
        enabled?: boolean;
        healthChecks?: boolean;
        metrics?: boolean;
        detailed?: boolean;
        alertThresholds?: {
            memoryUsage?: number;
            hitRate?: number;
            errorRate?: number;
            latency?: number;
        };
    };

    // Server configuration
    server?: {
        port?: number;
        host?: string;
        trustProxy?: TrustProxyValue;
        jsonLimit?: string;
        urlEncodedLimit?: string;
        enableMiddleware?: boolean;
        autoParseJson?: boolean; // Enable/disable automatic JSON parsing (default: true)
        logPerfomances?: boolean;
        // Service identification for optimization system
        serviceName?: string;
        version?: string;
        // cluster?: boolean;

        // Auto port switching configuration
        autoPortSwitch?: {
            enabled?: boolean;
            maxAttempts?: number; // Maximum number of ports to try (default: 10)
            startPort?: number; // Starting port for auto-switching (defaults to main port)
            portRange?: [number, number]; // Port range to search within [min, max]
            strategy?: "increment" | "random" | "predefined"; // Port selection strategy
            predefinedPorts?: number[]; // List of predefined ports to try
            onPortSwitch?: (originalPort: number, newPort: number) => void; // Callback when port is switched
        };

        /** Enable XHSC (XyPriss Hybrid Server Core) - Rust performance engine */
        xhsc?: boolean;
    };

    /**
     * Multi-server configuration for creating multiple server instances
     *
     * Allows running multiple server instances with different configurations,
     * ports, and route scopes from a single configuration.
     *
     * @example
     * ```typescript
     * multiServer: {
     *   enabled: true,
     *   servers: [
     *     {
     *       id: "api-server",
     *       port: 3001,
     *       routePrefix: "/api/v1",
     *       allowedRoutes: ["/api/v1/*"],
     *       server: {
     *         host: "localhost"
     *       }
     *     },
     *     {
     *       id: "admin-server",
     *       port: 3002,
     *       routePrefix: "/admin",
     *       allowedRoutes: ["/admin/*"],
     *       security: {
     *         level: "maximum"
     *       }
     *     }
     *   ]
     * }
     * ```
     */
    multiServer?: {
        /** Enable multi-server mode */
        enabled?: boolean;

        /** Array of server configurations */
        servers?: MultiServerConfig[];
    };

    /**
     * Request management configuration for handling timeouts, network quality, and request lifecycle
     *
     * @example
     * ```typescript
     * requestManagement: {
     *   timeout: {
     *     enabled: true,
     *     defaultTimeout: 30000, // 30 seconds
     *     routes: {
     *       "/api/upload": 300000, // 5 minutes for uploads
     *       "/api/quick": 5000     // 5 seconds for quick endpoints
     *     }
     *   },
     *   networkQuality: {
     *     enabled: true,
     *     rejectOnPoorConnection: true,
     *     minBandwidth: 1000, // 1KB/s minimum
     *     maxLatency: 2000    // 2 seconds max latency
     *   },
     *   concurrency: {
     *     maxConcurrentRequests: 1000,
     *     maxPerIP: 50,
     *     queueTimeout: 10000
     *   }
     * }
     * ```
     */
    requestManagement?: {
        /** Request timeout configuration */
        timeout?: {
            /** Enable request timeout management */
            enabled?: boolean;

            /** Default timeout for all requests in milliseconds */
            defaultTimeout?: number;

            /** Route-specific timeout overrides */
            routes?: Record<string, number>;

            /** Timeout for static file serving */
            staticTimeout?: number;

            /** Custom timeout handler */
            onTimeout?: (req: any, res: any) => void;

            /** Include stack trace in timeout errors */
            includeStackTrace?: boolean;
        };

        /** Network quality detection and management */
        networkQuality?: {
            /** Enable network quality monitoring */
            enabled?: boolean;

            /** Reject requests on poor network conditions */
            rejectOnPoorConnection?: boolean;

            /** Minimum bandwidth requirement in bytes/second */
            minBandwidth?: number;

            /** Maximum acceptable latency in milliseconds */
            maxLatency?: number;

            /** Network quality check interval in milliseconds */
            checkInterval?: number;

            /** Custom network quality handler */
            onPoorNetwork?: (req: any, res: any, metrics: any) => void;
        };

        /** Request concurrency management */
        concurrency?: {
            /** Maximum concurrent requests server-wide */
            maxConcurrentRequests?: number;

            /** Maximum concurrent requests per IP */
            maxPerIP?: number;

            /** Maximum time to wait in queue in milliseconds */
            queueTimeout?: number;

            /** Priority queue for different request types */
            priorityQueue?: {
                enabled?: boolean;
                priorities?: Record<string, number>; // route patterns to priority levels
            };

            /** Custom queue overflow handler */
            onQueueOverflow?: (req: any, res: any) => void;
        };

        /** Request lifecycle monitoring */
        lifecycle?: {
            /** Enable request lifecycle tracking */
            enabled?: boolean;

            /** Track request start time */
            trackStartTime?: boolean;

            /** Track request processing stages */
            trackStages?: boolean;

            /** Maximum request processing time before warning */
            warnAfter?: number;

            /** Custom lifecycle event handler */
            onLifecycleEvent?: (event: string, req: any, data: any) => void;
        };

        /** Request retry and circuit breaker */
        resilience?: {
            /** Enable request retry mechanism */
            retryEnabled?: boolean;

            /** Maximum retry attempts */
            maxRetries?: number;

            /** Retry delay in milliseconds */
            retryDelay?: number;

            /** Circuit breaker configuration */
            circuitBreaker?: {
                enabled?: boolean;
                failureThreshold?: number; // failures before opening circuit
                resetTimeout?: number; // time before attempting to close circuit
                monitoringPeriod?: number; // time window for failure counting
            };
        };

        /** Request size and payload management */
        payload?: {
            /** Maximum request body size in bytes */
            maxBodySize?: number;

            /** Maximum URL length */
            maxUrlLength?: number;

            /** Maximum number of form fields */
            maxFields?: number;

            /** Maximum file upload size */
            maxFileSize?: number;

            /** Allowed MIME types for uploads */
            allowedMimeTypes?: string[];

            /** Custom payload validation */
            customValidator?: (req: any) => boolean | Promise<boolean>;
        };
    };

    /**
     * File upload configuration for handling multipart/form-data requests.
     *
     * Comprehensive file upload settings including size limits, allowed types,
     * storage options, and security features for file handling.
     *
     * @example
     * ```typescript
     * fileUpload: {
     *   enabled: true,
     *   maxFileSize: 10 * 1024 * 1024, // 10MB
     *   maxFiles: 5,
     *   allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
     *   allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
     *   destination: './uploads',
     *   filename: (req, file, callback) => {
     *     callback(null, `${Date.now()}-${file.originalname}`);
     *   },
     *   limits: {
     *     fieldNameSize: 100,
     *     fieldSize: 1024,
     *     fields: 10,
     *     fileSize: 10 * 1024 * 1024,
     *     files: 5,
     *     headerPairs: 2000
     *   },
     *   preservePath: false,
     *   fileFilter: (req, file, callback) => {
     *     // Custom file validation logic
     *     callback(null, true);
     *   },
     *   storage: 'disk', // 'disk' | 'memory' | 'custom'
     *   createParentPath: true,
     *   abortOnLimit: false,
     *   responseOnLimit: 'File too large',
     *   useTempFiles: false,
     *   tempFileDir: '/tmp',
     *   parseNested: true,
     *   debug: false
     * }
     * ```
     */
    fileUpload?: FileUploadConfig;

    /**
     * Security configuration for the server.
     *
     * Comprehensive security settings including authentication, encryption,
     * CSRF protection, security headers, and various security features.
     *
     * @example
     * ```typescript
     * security: {
     *   enabled: true,
     *   level: 'enhanced',
     *   csrf: true,
     *   helmet: true,
     *   xss: true,
     *   bruteForce: true,
     *   authentication: {
     *     jwt: {
     *       secret: 'your-secret-key',
     *       expiresIn: '24h'
     *     }
     *   }
     * }
     * ```
     */
    security?: SecurityConfig & {
        /** Enable security middleware */
        enabled?: boolean;
    };

    cluster?: {
        enabled?: boolean;
        config?: Omit<ClusterConfig, "enabled">;
    };

    // Worker pool configuration for CPU and I/O intensive tasks
    workerPool?: {
        enabled?: boolean;
        config?: {
            cpu?: {
                min: number;
                max: number;
            };
            io?: {
                min: number;
                max: number;
            };
            maxConcurrentTasks?: number;
        };
    };

    // File watcher configuration for auto-reload
    fileWatcher?: {
        enabled?: boolean;
        watchPaths?: string[];
        ignorePaths?: string[];
        extensions?: string[];
        debounceMs?: number;
        restartDelay?: number;
        maxRestarts?: number;
        gracefulShutdown?: boolean;
        verbose?: boolean;

        // TypeScript type checking configuration
        typeCheck?: {
            enabled?: boolean; // Enable TypeScript type checking (default: false)
            configFile?: string; // Path to tsconfig.json (auto-detected if not provided)
            checkOnSave?: boolean; // Check types when files are saved (default: true)
            checkBeforeRestart?: boolean; // Check types before restarting server (default: true)
            showWarnings?: boolean; // Show TypeScript warnings (default: true)
            showInfos?: boolean; // Show TypeScript info messages (default: false)
            maxErrors?: number; // Maximum errors to display (default: 50)
            failOnError?: boolean; // Prevent restart if type errors found (default: false)
            excludePatterns?: string[]; // Additional patterns to exclude from type checking
            includePatterns?: string[]; // Specific patterns to include for type checking
            verbose?: boolean; // Verbose type checking output (default: false)
        };

        // TypeScript execution configuration
        typescript?: {
            enabled?: boolean; // Auto-detect TypeScript files and use appropriate runner (default: true)
            runner?: "auto" | "tsx" | "ts-node" | "bun" | "node" | string; // TypeScript runner to use (default: 'auto')
            runnerArgs?: string[]; // Additional arguments for the TypeScript runner (default: [])
            fallbackToNode?: boolean; // Fallback to node if TypeScript runner fails (default: true)
            autoDetectRunner?: boolean; // Auto-detect available TypeScript runner (default: true)
        };
    };

    /**
     * Plugin system configuration for automatic optimization and maintenance
     *
     * @example
     * ```typescript
     * plugins: {
     *   routeOptimization: {
     *     enabled: true,
     *     optimizationThreshold: 100,
     *     autoOptimization: true,
     *     customRules: [
     *       {
     *         pattern: "/api/*",
     *         minHits: 50,
     *         maxResponseTime: 500,
     *         cacheStrategy: "aggressive"
     *       }
     *     ]
     *   },
     *   serverMaintenance: {
     *     enabled: true,
     *     errorThreshold: 5,
     *     memoryThreshold: 80,
     *     autoCleanup: true,
     *     logRetentionDays: 7
     *   }
     * }
     * ```
     */
    plugins?: {
        /** Route optimization plugin configuration */
        routeOptimization?: {
            /** Enable route optimization plugin */
            enabled?: boolean;

            /** How often to analyze routes in milliseconds */
            analysisInterval?: number;

            /** Minimum hits before optimization */
            optimizationThreshold?: number;

            /** Time window for popularity calculation in milliseconds */
            popularityWindow?: number;

            /** Maximum routes to track */
            maxTrackedRoutes?: number;

            /** Enable automatic optimization */
            autoOptimization?: boolean;

            /** Custom optimization rules */
            customRules?: Array<{
                pattern: string;
                minHits: number;
                maxResponseTime: number;
                cacheStrategy: "aggressive" | "moderate" | "conservative";
                preloadEnabled?: boolean;
            }>;

            /** Callback when route is optimized */
            onOptimization?: (route: string, optimization: string) => void;

            /** Callback when analysis is complete */
            onAnalysis?: (stats: any[]) => void;
        };

        /** Server maintenance plugin configuration */
        serverMaintenance?: {
            /** Enable server maintenance plugin */
            enabled?: boolean;

            /** How often to check health in milliseconds */
            checkInterval?: number;

            /** Error rate threshold percentage */
            errorThreshold?: number;

            /** Memory usage threshold percentage */
            memoryThreshold?: number;

            /** Response time threshold in milliseconds */
            responseTimeThreshold?: number;

            /** Log retention period in days */
            logRetentionDays?: number;

            /** Maximum log file size in bytes */
            maxLogFileSize?: number;

            /** Enable automatic cleanup */
            autoCleanup?: boolean;

            /** Enable automatic restart on critical issues */
            autoRestart?: boolean;

            /** Callback when issue is detected */
            onIssueDetected?: (issue: any) => void;

            /** Callback when maintenance is complete */
            onMaintenanceComplete?: (actions: string[]) => void;
        };

        /** Register custom plugins (new plugin system) */
        register?: Array<
            | import("../plugins/types/PluginTypes").XyPrissPlugin
            | import("../plugins/types/PluginTypes").PluginCreator
        >;
    };

    /**
     * Plugin permissions configuration
     * Controls which hooks each plugin is allowed to use
     */
    pluginPermissions?: Array<{
        /** Name of the plugin */
        name: string;
        /** List of allowed hooks (e.g. "onRegister", "onServerStart") or "*" for all */
        allowedHooks?: string[] | "*";
        /** List of explicitly denied hooks that override allowedHooks */
        deniedHooks?: string[];
        /** Policy for unlisted hooks: "allow" (default) or "deny" */
        policy?: "allow" | "deny";
    }>;

    // Logging configuration
    logging?: {
        enabled?: boolean; // Master switch for all logging (default: true)
        level?: LogLevel; // Log level (default: "info")

        // Component-specific logging controls
        components?: {
            server?: boolean; // Server startup/shutdown logs
            cache?: boolean; // Cache initialization and operations
            cluster?: boolean; // Cluster management logs
            performance?: boolean; // Performance optimization logs
            fileWatcher?: boolean; // File watcher logs
            plugins?: boolean; // Plugin system logs
            security?: boolean; // Security warnings and logs
            monitoring?: boolean; // Monitoring and metrics logs
            routes?: boolean; // Route compilation and handling logs
            userApp?: boolean; // User application console output
            console?: boolean; // Console interception system logs
            other?: boolean;
            middleware?: boolean;
            router?: boolean;
            typescript?: boolean;
            acpes?: boolean;
            ipc?: boolean; // Inter-process communication logs
            memory?: boolean; // Memory monitoring and detection logs
            lifecycle?: boolean; // Server lifecycle management logs
            routing?: boolean; // Fast routing system logs
        };

        componentLevels?: Partial<
            Record<LogComponent, ComponentLogConfig | LogLevel>
        >;

        // Specific log type controls
        types?: {
            startup?: boolean; // Component initialization logs
            warnings?: boolean; // Warning messages (like UFSIMC warnings)
            errors?: boolean; // Error messages (always shown unless silent)
            performance?: boolean; // Performance measurements
            debug?: boolean; // Debug information
            hotReload?: boolean; // Hot reload notifications
            portSwitching?: boolean; // Auto port switching logs
            lifecycle?: boolean; // Server lifecycle management logs
        };

        // Console interception configuration
        consoleInterception?: DeepPartial<ConsoleInterceptionConfig>; // consoleInterception = CSLI

        // Custom logger function
        customLogger?: (
            level: LogLevel,
            component: LogComponent,
            message: string,
            ...args: any[]
        ) => void;

        // Output formatting
        format?: {
            timestamps?: boolean; // Show timestamps (default: false)
            colors?: boolean; // Use colors in output (default: true)
            prefix?: boolean; // Show component prefixes (default: true)
            compact?: boolean; // Use compact format (default: false)
            includeMemory?: boolean; // Include memory usage in logs (default: false)
            includeProcessId?: boolean; // Include process ID in logs (default: false)
            maxLineLength?: number; // Maximum line length, 0 for no limit (default: 0)
        };

        // Buffering configuration for high-performance scenarios
        buffer?: {
            enabled?: boolean; // Enable log buffering (default: false)
            maxSize?: number; // Maximum buffer size before flush (default: 1000)
            flushInterval?: number; // Auto-flush interval in milliseconds (default: 5000)
            autoFlush?: boolean; // Enable automatic flushing (default: true)
        };

        // Error handling and rate limiting
        errorHandling?: {
            maxErrorsPerMinute?: number; // Maximum errors per minute before suppression (default: 100)
            suppressRepeatedErrors?: boolean; // Suppress repeated errors from same component (default: true)
            suppressAfterCount?: number; // Suppress after this many repeated errors (default: 5)
            resetSuppressionAfter?: number; // Reset suppression after this time in ms (default: 300000)
        };

        // File output configuration (for future enhancement)
        file?: {
            enabled?: boolean;
            path?: string;
            maxSize?: number; // Maximum file size in bytes
            maxFiles?: number; // Maximum number of log files to keep
            rotateDaily?: boolean; // Rotate logs daily
        };

        // Remote logging configuration (for future enhancement)
        remote?: {
            enabled?: boolean;
            endpoint?: string;
            apiKey?: string;
            batchSize?: number;
            flushInterval?: number;
        };
    };

    /**
     * Response control configuration for when routes don't match.
     *
     * Allows customization of the response sent when no routes match the request.
     * Useful for multi-server setups where different servers need different behaviors.
     *
     * @example
     * ```typescript
     * responseControl: {
     *   enabled: true,
     *   statusCode: 404,
     *   content: "Custom not found message",
     *   contentType: "text/plain",
     *   headers: { "X-Custom-Header": "value" },
     *   handler: (req, res) => {
     *     res.status(404).json({ error: "Not found", path: req.path });
     *   }
     * }
     * ```
     */
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

    /**
     * Network plugin configuration for enhanced networking capabilities.
     *
     * Provides comprehensive control over connection management, compression,
     * rate limiting, and proxy functionality features.
     *
     * @example
     * ```typescript
     * network: {
     *   connection: {
     *     http2: { enabled: true, maxConcurrentStreams: 100 },
     *     keepAlive: { enabled: true, timeout: 30000 },
     *     connectionPool: { maxConnections: 1000, timeout: 5000 }
     *   },
     *   compression: {
     *     enabled: true,
     *     algorithms: ["gzip", "deflate"],
     *     level: 6,
     *     threshold: 1024
     *   },
     *   rateLimit: {
     *     enabled: true,
     *     strategy: "sliding-window",
     *     global: { requests: 1000, window: "1h" },
     *     perIP: { requests: 100, window: "1m" }
     *   },
     *   proxy: {
     *     enabled: true,
     *     upstreams: [
     *       { host: "backend1.example.com", port: 8080, weight: 1 },
     *       { host: "backend2.example.com", port: 8080, weight: 2 }
     *     ],
     *     loadBalancing: "weighted-round-robin"
     *   }
     * }
     * ```
     */
    network?: {
        /**
         * Connection management plugin configuration.
         *
         * Handles HTTP/2 server push, keep-alive connections, and connection pooling
         * with intelligent resource detection and proper cache control.
         */
        connection?: {
            /** Enable connection plugin */
            enabled?: boolean;

            /** HTTP/2 configuration */
            http2?: {
                /** Enable HTTP/2 support */
                enabled?: boolean;

                /** Maximum concurrent streams per connection */
                maxConcurrentStreams?: number;

                /** Initial window size for flow control */
                initialWindowSize?: number;

                /** Enable server push */
                serverPush?: boolean;
            };

            /** Keep-alive configuration */
            keepAlive?: {
                /** Enable keep-alive connections */
                enabled?: boolean;

                /** Keep-alive timeout in milliseconds */
                timeout?: number;

                /** Maximum requests per connection */
                maxRequests?: number;
            };

            /** Connection pool configuration */
            connectionPool?: {
                /** Maximum number of connections */
                maxConnections?: number;

                /** Connection timeout in milliseconds */
                timeout?: number;

                /** Idle timeout in milliseconds */
                idleTimeout?: number;
            };
        };

        /**
         * Compression plugin configuration.
         *
         * Provides compression with multiple algorithms,
         * intelligent threshold detection, and proper content-type filtering.
         */
        compression?: {
            /** Enable compression plugin */
            enabled?: boolean;

            /** Supported compression algorithms */
            algorithms?: ("gzip" | "deflate" | "br")[];

            /** Compression level (1-9, higher = better compression, slower) */
            level?: number;

            /** Minimum response size to compress (bytes) */
            threshold?: number;

            /** Content types to compress */
            contentTypes?: string[];

            /** Memory level for compression (1-9) */
            memLevel?: number;

            /** Window size for compression */
            windowBits?: number;
        };

        /**
         * Rate limiting plugin configuration.
         *
         * Uses XyPriss cache system for distributed rate limiting with
         * secure key hashing and multiple limiting strategies.
         */
        rateLimit?: {
            /** Enable rate limiting plugin */
            enabled?: boolean;

            /** Rate limiting strategy */
            strategy?: "fixed-window" | "sliding-window" | "token-bucket";

            /** Global rate limits */
            global?: {
                /** Maximum requests per window */
                requests?: number;

                /** Time window (e.g., "1m", "1h", "1d") */
                window?: string;
            };

            /** Per-IP rate limits */
            perIP?: {
                /** Maximum requests per IP per window */
                requests?: number;

                /** Time window (e.g., "1m", "1h", "1d") */
                window?: string;
            };

            /** Per-user rate limits (requires authentication) */
            perUser?: {
                /** Maximum requests per user per window */
                requests?: number;

                /** Time window (e.g., "1m", "1h", "1d") */
                window?: string;
            };

            /** Custom rate limit headers */
            headers?: {
                /** Include rate limit headers in response */
                enabled?: boolean;

                /** Custom header prefix */
                prefix?: string;
            };

            /** Redis configuration for distributed rate limiting */
            redis?: {
                /** Redis host */
                host?: string;

                /** Redis port */
                port?: number;

                /** Redis password */
                password?: string;

                /** Redis database number */
                db?: number;

                /** Key prefix for rate limit data */
                keyPrefix?: string;
            };
        };

        /**
         * Proxy plugin configuration.
         *
         * Provides load balancing, health checks, and failover capabilities
         * with secure upstream selection and real HTTP health monitoring.
         */
        proxy?: {
            /** Enable proxy plugin */
            enabled?: boolean;

            /** Upstream servers configuration */
            upstreams?: Array<{
                /** Upstream server hostname */
                host: string;

                /** Upstream server port */
                port?: number;

                /** Server weight for load balancing */
                weight?: number;

                /** Maximum connections to this upstream */
                maxConnections?: number;

                /** Health check path */
                healthCheckPath?: string;
            }>;

            /** Load balancing strategy */
            loadBalancing?:
                | "round-robin"
                | "weighted-round-robin"
                | "ip-hash"
                | "least-connections";

            /** Health check configuration */
            healthCheck?: {
                /** Enable health checks */
                enabled?: boolean;

                /** Health check interval in milliseconds */
                interval?: number;

                /** Health check timeout in milliseconds */
                timeout?: number;

                /** Health check path */
                path?: string;

                /** Unhealthy threshold (failed checks before marking unhealthy) */
                unhealthyThreshold?: number;

                /** Healthy threshold (successful checks before marking healthy) */
                healthyThreshold?: number;
            };

            /** Proxy timeout configuration */
            timeout?: number;

            /** Enable request/response logging */
            logging?: boolean;

            /** Custom error handling */
            onError?: (error: any, req: any, res: any) => void;
        };
    };
}

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

/**
 * Ultra-fast application interface with advanced features.
 *
 * Extends the standard application with ultra-fast caching,
 * performance optimization, security features, clustering, and
 * comprehensive monitoring capabilities.
 *
 * @interface UltraFastApp
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * import { createServer } from 'xypriss';
 *
 * const app = createServer({
 *   cache: { strategy: 'hybrid' },
 *   performance: { optimizationEnabled: true }
 * });
 *
 * // Use enhanced route methods with caching
 * app.getWithCache('/api/users', {
 *   cache: { ttl: 300, tags: ['users'] },
 *   security: { auth: true }
 * }, async (req, res) => {
 *   const users = await getUsersFromDB();
 *   res.success(users);
 * });
 *
 * // Start the server
 * await app.start(3000);
 * ```
 */
export interface UltraFastApp {
    // Core HTTP methods
    get(path: string, ...handlers: RequestHandler[]): void;
    post(path: string, ...handlers: RequestHandler[]): void;
    put(path: string, ...handlers: RequestHandler[]): void;
    delete(path: string, ...handlers: RequestHandler[]): void;
    patch(path: string, ...handlers: RequestHandler[]): void;
    options(path: string, ...handlers: RequestHandler[]): void;
    head(path: string, ...handlers: RequestHandler[]): void;
    all(path: string, ...handlers: RequestHandler[]): void;

    // Middleware
    use(...args: any[]): void;

    // Settings
    set(setting: string, val: any): void;
    getSetting(setting: string): any;
    enabled(setting: string): boolean;
    disabled(setting: string): boolean;
    enable(setting: string): void;
    disable(setting: string): void;

    // Template engine
    engine(
        ext: string,
        fn: (
            path: string,
            options: object,
            callback: (e: any, rendered?: string) => void
        ) => void
    ): UltraFastApp;

    // Routing
    param(
        name: string,
        handler: (
            req: any,
            res: any,
            next: any,
            value: any,
            name: string
        ) => void
    ): void;
    path(): string;
    render(
        view: string,
        options?: object,
        callback?: (err: Error | null, html?: string) => void
    ): void;
    route(path: string): any;

    // Properties
    locals: Record<string, any>;
    mountpath: string;
    settings: Record<string, any>;

    /**
     * Secure cache adapter for ultra-fast data access.
     *
     * Provides access to the underlying cache system with
     * encryption, compression, and intelligent strategies.
     */
    cache?: SecureCacheAdapter;

    /**
     * Server configuration options.
     *
     * Provides access to the configuration options passed to createServer.
     */
    configs?: ServerOptions;

    /**
     * Invalidate cache entries by pattern.
     *
     * @param pattern - Cache key pattern to invalidate
     * @returns Promise that resolves when invalidation is complete
     *
     * @example
     * ```typescript
     * // Invalidate all user-related cache entries
     * await app.invalidateCache('users:*');
     * ```
     */
    invalidateCache: (pattern: string) => Promise<void>;

    /**
     * Get comprehensive cache statistics.
     *
     * @returns Promise that resolves to cache statistics
     *
     * @example
     * ```typescript
     * const stats = await app.getCacheStats();
     * console.log(`Hit rate: ${stats.hitRate * 100}%`);
     * ```
     */
    getCacheStats: () => Promise<any>;

    /**
     * Warm up cache with predefined data.
     *
     * @param data - Array of cache entries to preload
     * @returns Promise that resolves when warmup is complete
     *
     * @example
     * ```typescript
     * await app.warmUpCache([
     *   { key: 'config:app', value: appConfig, ttl: 3600 },
     *   { key: 'users:popular', value: popularUsers, ttl: 1800 }
     * ]);
     * ```
     */
    warmUpCache: (
        data: Array<{ key: string; value: any; ttl?: number }>
    ) => Promise<void>;

    /**
     * Start the UFa server.
     *
     * @param port - Port number to listen on (optional)
     * @param callback - Callback function called when server starts (optional)
     * @returns Promise that resolves to HTTP server instance or server instance directly
     *
     * @example
     * ```typescript
     * // Start with auto port detection
     * const server = await app.start();
     *
     * // Start on specific port with callback
     * app.start(3000, () => {
     *   console.log('Server started on port 3000');
     * });
     * ```
     */
    start: (
        port?: number,
        callback?: () => void
    ) => Promise<HttpServer> | HttpServer | Promise<void> | void;

    /**
     * Stop the ultra-fast server.
     *
     * @returns Promise that resolves when server is stopped
     *
     * @example
     * ```typescript
     * await app.stop();
     * console.log('Server stopped');
     * ```
     */
    stop?: () => Promise<void>;

    /**
     * Wait for server to be fully ready.
     *
     * @returns Promise that resolves when server is ready to accept requests
     *
     * @example
     * ```typescript
     * await app.start(3000);
     * await app.waitForReady();
     * console.log('Server is ready!');
     * ```
     */
    waitForReady: () => Promise<void>;

    /**
     * Get the current server port.
     *
     * @returns The port number the server is listening on
     *
     * @example
     * ```typescript
     * const currentPort = app.getPort();
     * console.log(`Server running on port ${currentPort}`);
     * ```
     */
    getPort: () => number;

    /**
     * Get the HTTP server instance.
     *
     * @returns The underlying HTTP server instance
     *
     * @example
     * ```typescript
     * const httpServer = app.getHttpServer();
     * console.log(`Server address: ${httpServer.address()}`);
     * ```
     */
    getHttpServer?: () => any;

    /**
     * Force close a specific port.
     *
     * @param port - Port number to force close
     * @returns Promise that resolves to true if port was closed successfully
     *
     * @example
     * ```typescript
     * const closed = await app.forceClosePort(3000);
     * if (closed) {
     *   console.log('Port 3000 closed successfully');
     * }
     * ```
     */
    forceClosePort: (port: number) => Promise<boolean>;

    /**
     * Create a redirect from one port to another.
     *
     * @param fromPort - Source port to redirect from
     * @param toPort - Target port to redirect to
     * @param options - Redirect configuration options
     * @returns Promise that resolves to redirect instance or boolean
     *
     * @example
     * ```typescript
     * // Redirect HTTP to HTTPS
     * const redirect = await app.redirectFromPort(80, 443, {
     *   mode: 'redirect',
     *   redirectStatusCode: 301,
     *   enableLogging: true
     * });
     * ```
     */
    redirectFromPort: (
        fromPort: number,
        toPort: number,
        options?: RedirectOptions
    ) => Promise<RedirectServerInstance | boolean>;

    /**
     * Get a specific redirect instance.
     *
     * @param fromPort - Source port of the redirect
     * @returns Redirect instance or null if not found
     *
     * @example
     * ```typescript
     * const redirect = app.getRedirectInstance(80);
     * if (redirect) {
     *   console.log(`Redirecting from ${redirect.fromPort} to ${redirect.toPort}`);
     * }
     * ```
     */
    getRedirectInstance: (fromPort: number) => RedirectServerInstance | null;

    /**
     * Get the server plugin manager for route optimization and maintenance.
     *
     * @returns Server plugin manager instance or undefined if not initialized
     *
     * @example
     * ```typescript
     * const pluginManager = app.getServerPluginManager();
     * if (pluginManager) {
     *   const routeStats = pluginManager.getRouteOptimizationPlugin()?.getRouteStats();
     *   const healthMetrics = pluginManager.getServerMaintenancePlugin()?.getHealthMetrics();
     * }
     * ```
     */
    getServerPluginManager?: () => any;

    /**
     * Server plugin manager instance (for internal use).
     * Provides access to route optimization and server maintenance plugins.
     */
    serverPluginManager?: any;

    /**
     * Get all active redirect instances.
     *
     * @returns Array of all redirect instances
     *
     * @example
     * ```typescript
     * const redirects = app.getAllRedirectInstances();
     * redirects.forEach(redirect => {
     *   console.log(`${redirect.fromPort} -> ${redirect.toPort}`);
     * });
     * ```
     */
    getAllRedirectInstances: () => RedirectServerInstance[];

    /**
     * Disconnect a specific redirect.
     *
     * @param fromPort - Source port of the redirect to disconnect
     * @returns Promise that resolves to true if disconnected successfully
     *
     * @example
     * ```typescript
     * const disconnected = await app.disconnectRedirect(80);
     * if (disconnected) {
     *   console.log('Redirect from port 80 disconnected');
     * }
     * ```
     */
    disconnectRedirect: (fromPort: number) => Promise<boolean>;

    /**
     * Disconnect all active redirects.
     *
     * @returns Promise that resolves to true if all redirects were disconnected
     *
     * @example
     * ```typescript
     * const allDisconnected = await app.disconnectAllRedirects();
     * console.log(`All redirects disconnected: ${allDisconnected}`);
     * ```
     */
    disconnectAllRedirects: () => Promise<boolean>;

    /**
     * Get statistics for a specific redirect.
     *
     * @param fromPort - Source port of the redirect
     * @returns Redirect statistics or null if not found
     *
     * @example
     * ```typescript
     * const stats = app.getRedirectStats(80);
     * if (stats) {
     *   console.log(`Requests redirected: ${stats.totalRequests}`);
     * }
     * ```
     */
    getRedirectStats: (fromPort: number) => RedirectStats | null;

    // Performance optimization methods
    getRequestPreCompiler: () => RequestPreCompiler;

    // Console interception methods
    getConsoleInterceptor: () => any;
    enableConsoleInterception: () => void;
    disableConsoleInterception: () => void;
    getConsoleStats: () => any;
    resetConsoleStats: () => void;
    enableConsoleTracing: (maxBufferSize?: number) => void;
    disableConsoleTracing: () => void;
    onConsoleTrace: (hook: (log: any) => void) => void;
    getConsoleTraceBuffer: () => any[];
    clearConsoleTraceBuffer: () => void;

    // File watcher methods
    getFileWatcherStatus: () => any;
    getFileWatcherStats: () => any;
    stopFileWatcher: () => Promise<void>;
    getFileWatcherManager: () => any;

    // TypeScript checking methods
    checkTypeScript: (files?: string[]) => Promise<any>;
    getTypeScriptStatus: () => any;
    enableTypeScriptChecking: () => void;
    disableTypeScriptChecking: () => void;

    // Console encryption methods
    enableConsoleEncryption: (key?: string) => void;
    disableConsoleEncryption: () => void;
    encrypt: (key: string) => void; // Simple encrypt method
    setConsoleEncryptionKey: (key: string) => void;
    setConsoleEncryptionDisplayMode: (
        displayMode: "readable" | "encrypted" | "both",
        showEncryptionStatus?: boolean
    ) => void;
    getEncryptedLogs: () => string[];
    restoreConsoleFromEncrypted: (
        encryptedData: string[],
        key: string
    ) => Promise<string[]>;
    isConsoleEncryptionEnabled: () => boolean;
    getConsoleEncryptionStatus: () => {
        enabled: boolean;
        algorithm?: string;
        hasKey: boolean;
        externalLogging?: boolean;
    };
    getRouterStats?: () => any;
    getRouterInfo?: () => any;
    warmUpRoutes?: () => Promise<void>;
    resetRouterStats?: () => void;

    // Ultra-fast optimization methods
    registerRouteTemplate?: (template: OptimizedRoute) => void;
    unregisterRouteTemplate?: (route: string | RegExp, method?: string) => void;
    registerOptimizationPattern?: (pattern: OptimizedRoute) => void;
    getOptimizerStats?: () => any;

    /**
     * Access the middleware management API.
     *
     * @param config - Optional middleware configuration
     * @returns Middleware API interface for fluent middleware management
     *
     * @example
     * ```typescript
     * app.middleware()
     *   .register(authMiddleware, { priority: 'critical' })
     *   .register(loggingMiddleware, { priority: 'high' })
     *   .enable('auth-middleware')
     *   .optimize();
     * ```
     */
    middleware: () => XyPrissMiddlewareAPI; // (config?: MiddlewareConfiguration)

    /**
     * Multer instance for file uploads (available when fileUpload.enabled is true)
     */
    upload?: any;

    /**
     * Create single file upload middleware
     *
     * @param fieldname - Name of the form field
     * @returns Multer middleware for single file upload
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadSingle('file'), (req, res) => {
     *   console.log(req.file);
     *   res.send('File uploaded');
     * });
     * ```
     */
    uploadSingle: (fieldname: string) => any;

    /**
     * Create array file upload middleware
     *
     * @param fieldname - Name of the form field
     * @param maxCount - Maximum number of files (optional)
     * @returns Multer middleware for array file upload
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadArray('files', 5), (req, res) => {
     *   console.log(req.files);
     *   res.send('Files uploaded');
     * });
     * ```
     */
    uploadArray?: (fieldname: string, maxCount?: number) => any;

    /**
     * Create fields file upload middleware
     *
     * @param fields - Array of field configurations
     * @returns Multer middleware for multiple fields upload
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadFields([
     *   { name: 'avatar', maxCount: 1 },
     *   { name: 'gallery', maxCount: 8 }
     * ]), (req, res) => {
     *   console.log(req.files);
     *   res.send('Files uploaded');
     * });
     * ```
     */
    uploadFields?: (fields: any[]) => any;

    /**
     * Create any file upload middleware
     *
     * @returns Multer middleware that accepts any files
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadAny(), (req, res) => {
     *   console.log(req.files);
     *   res.send('Files uploaded');
     * });
     * ```
     */
    uploadAny?: () => any;

    /**
     * Scale up the cluster by adding workers.
     *
     * @param count - Number of workers to add (optional, defaults to optimal count)
     * @returns Promise that resolves when scaling is complete
     *
     * @example
     * ```typescript
     * // Add 2 workers
     * await app.scaleUp?.(2);
     *
     * // Add optimal number of workers
     * await app.scaleUp?.();
     * ```
     */
    scaleUp?: (count?: number) => Promise<void>;

    /**
     * Scale down the cluster by removing workers.
     *
     * @param count - Number of workers to remove (optional)
     * @returns Promise that resolves when scaling is complete
     *
     * @example
     * ```typescript
     * // Remove 1 worker
     * await app.scaleDown?.(1);
     * ```
     */
    scaleDown?: (count?: number) => Promise<void>;

    /**
     * Automatically scale the cluster based on current load.
     *
     * @returns Promise that resolves when auto-scaling is complete
     *
     * @example
     * ```typescript
     * await app.autoScale?.();
     * ```
     */
    autoScale?: () => Promise<void>;

    /**
     * Get comprehensive cluster metrics.
     *
     * @returns Promise that resolves to cluster metrics
     *
     * @example
     * ```typescript
     * const metrics = await app.getClusterMetrics?.();
     * console.log(`Active workers: ${metrics.activeWorkers}`);
     * ```
     */
    getClusterMetrics?: () => Promise<any>;

    /**
     * Get cluster health status.
     *
     * @returns Promise that resolves to cluster health information
     *
     * @example
     * ```typescript
     * const health = await app.getClusterHealth?.();
     * console.log(`Cluster status: ${health.status}`);
     * ```
     */
    getClusterHealth?: () => Promise<any>;

    /**
     * Get all worker processes.
     *
     * @returns Array of worker process information
     *
     * @example
     * ```typescript
     * const workers = app.getAllWorkers?.();
     * workers?.forEach(worker => {
     *   console.log(`Worker ${worker.id}: ${worker.status}`);
     * });
     * ```
     */
    getAllWorkers?: () => any[];

    /**
     * Get the optimal worker count for current system.
     *
     * @returns Promise that resolves to optimal worker count
     *
     * @example
     * ```typescript
     * const optimal = await app.getOptimalWorkerCount?.();
     * console.log(`Optimal worker count: ${optimal}`);
     * ```
     */
    getOptimalWorkerCount?: () => Promise<number>;

    /**
     * Restart the entire cluster.
     *
     * @returns Promise that resolves when cluster restart is complete
     *
     * @example
     * ```typescript
     * await app.restartCluster?.();
     * console.log('Cluster restarted successfully');
     * ```
     */
    restartCluster?: () => Promise<void>;

    /**
     * Stop the cluster.
     *
     * @param graceful - Whether to perform graceful shutdown
     * @returns Promise that resolves when cluster is stopped
     *
     * @example
     * ```typescript
     * // Graceful shutdown
     * await app.stopCluster?.(true);
     *
     * // Force shutdown
     * await app.stopCluster?.(false);
     * ```
     */
    stopCluster?: (graceful?: boolean) => Promise<void>;

    /**
     * Broadcast message to all workers.
     *
     * @param message - Message to broadcast
     * @returns Promise that resolves when message is sent
     *
     * @example
     * ```typescript
     * await app.broadcastToWorkers?.({
     *   type: 'config-update',
     *   data: newConfig
     * });
     * ```
     */
    broadcastToWorkers?: (message: any) => Promise<void>;

    /**
     * Send message to a random worker.
     *
     * @param message - Message to send
     * @returns Promise that resolves when message is sent
     *
     * @example
     * ```typescript
     * await app.sendToRandomWorker?.({
     *   type: 'task',
     *   data: taskData
     * });
     * ```
     */
    sendToRandomWorker?: (message: any) => Promise<void>;

    // Plugin management methods
    registerPlugin?: (plugin: any) => Promise<void>;
    unregisterPlugin?: (pluginId: string) => Promise<void>;
    getPlugin?: (pluginId: string) => any;
    getAllPlugins?: () => any[];
    getPluginsByType?: (type: any) => any[];
    getPluginStats?: (pluginId?: string) => any;
    getPluginRegistryStats?: () => any;
    getPluginEngineStats?: () => any;
    initializeBuiltinPlugins?: () => Promise<void>;
    getServerStats?: () => Promise<any>;

    // Multi-server methods (available when multiServer.enabled is true)
    startAllServers?: () => Promise<void>;
    stopAllServers?: () => Promise<void>;
    getServers?: () => MultiServerInstance[];
    getServer?: (id: string) => MultiServerInstance | undefined;
    getStats?: () => any;
}

/**
 * Ultra-fast middleware handler interface.
 *
 * Enhanced middleware handler with additional context including
 * request ID and classification for performance optimization.
 *
 * @interface UltraFastMiddlewareHandler
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * const ultraFastMiddleware: UltraFastMiddlewareHandler = async (
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
export interface UltraFastMiddlewareHandler {
    /**
     * Ultra-fast middleware handler function.
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
        classification: any
    ): Promise<void>;
}

// Re-export custom HTTP server types for convenience
export type { Request, Response, NextFunction };

