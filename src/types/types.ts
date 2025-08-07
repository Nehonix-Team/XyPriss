/**
 * XyPrissJS Express Types - Main Export File
 *
 * This file serves as the main entry point for all Express integration types.
 * Types are now organized into MOD files for better maintainability.
 *
 * @fileoverview Main type export file for Express integration
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

// Legacy imports for backward compatibility
import {
    type Express,
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from "express";
import { SecureCacheAdapter } from "../cache";
import { Server as HttpServer } from "http";
import { ClusterConfig } from "./cluster";
import type { RequestPreCompiler } from "../server/optimization/RequestPreCompiler";
import { OptimizedRoute } from "./UFOptimizer.type";
import { ConsoleInterceptionConfig } from "../server/components/fastapi/console/types";
import { LogComponent, LogLevel } from "../../shared/types/logger.type";

// Import and re-export MiddlewareManager
export { MiddlewareManager } from "../server/components/fastapi/middlewares/middlewareManager";

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

// Middleware types - explicit exports to avoid conflicts
export {
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

// Server types - primary exports (these take precedence)
export {
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
import type {
    MiddlewareConfiguration,
    MiddlewareAPIInterface,
    MiddlewareInfo,
    MiddlewareStats,
    SecurityMiddlewareOptions,
    CompressionMiddlewareOptions,
    RateLimitMiddlewareOptions,
    CorsMiddlewareOptions,
} from "./mod/middleware";
import type { RouteOptions } from "./mod/routing";
import type { MemoryConfig } from "./mod/cache";

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
 * @fileoverview Comprehensive server options interface for XyPrissJS Express integration
 *
 * This interface provides complete configuration options for creating ultra-fast,
 * secure Express servers with advanced features including caching, clustering,
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
     * Security configuration for comprehensive protection.
     *
     * Enables various security features including encryption,
     * monitoring, and standard security headers.
     *
     * @example
     * ```typescript
     * security: {
     *   encryption: true, // Enable data encryption
     *   accessMonitoring: true, // Monitor access patterns
     *   sanitization: true, // Sanitize inputs
     *   auditLogging: true, // Log security events
     *   cors: true, // Enable CORS protection
     *   helmet: true // Enable Helmet.js security headers
     * }
     * ```
     */
    security?: {
        /** Enable data encryption */
        encryption?: boolean;

        /** Enable access pattern monitoring */
        accessMonitoring?: boolean;

        /** Enable input sanitization */
        sanitization?: boolean;

        /** Enable security audit logging */
        auditLogging?: boolean;

        /** Enable CORS protection */
        cors?: boolean;

        /** Enable Helmet.js security headers */
        helmet?: boolean;
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
        trustProxy?: boolean;
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
    cluster?: {
        enabled?: boolean;
        config?: Omit<ClusterConfig, "enabled">;
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

    // Middleware configuration
    middleware?: MiddlewareConfiguration;

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

        /** Custom plugins */
        customPlugins?: Array<{
            name: string;
            plugin: any;
            config?: any;
        }>;
    };

    // Logging configuration
    logging?: {
        enabled?: boolean; // Master switch for all logging (default: true)
        level?: "silent" | "error" | "warn" | "info" | "debug" | "verbose"; // Log level (default: "info")

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
        };

        // Specific log type controls
        types?: {
            startup?: boolean; // Component initialization logs
            warnings?: boolean; // Warning messages (like UFSIMC warnings)
            errors?: boolean; // Error messages (always shown unless silent)
            performance?: boolean; // Performance measurements
            debug?: boolean; // Debug information
            hotReload?: boolean; // Hot reload notifications
            portSwitching?: boolean; // Auto port switching logs
        };

        // Output formatting
        format?: {
            timestamps?: boolean; // Show timestamps (default: false)
            colors?: boolean; // Use colors in output (default: true)
            prefix?: boolean; // Show component prefixes (default: true)
            compact?: boolean; // Use compact format (default: false)
        };

        // Console interception configuration
        consoleInterception?: DeepPartial<ConsoleInterceptionConfig>;

        // Custom logger function
        customLogger?: (
            level: LogLevel,
            component: LogComponent,
            message: string,
            ...args: any[]
        ) => void;
    };

    // 🚀 High-Performance Router Configuration
    router?: {
        enabled?: boolean; // Enable high-performance routing (default: true)
        precompileCommonRoutes?: boolean; // Pre-compile common routes (default: true)
        enableSecurity?: boolean; // Enable security validation (default: true)
        enableCaching?: boolean; // Enable route caching (default: true)
        warmUpOnStart?: boolean; // Warm up routes on startup (default: true)
        performance?: {
            targetResponseTime?: number; // Target response time for simple routes in ms (default: 1)
            complexRouteTarget?: number; // Target response time for complex routes in ms (default: 5)
            enableProfiling?: boolean; // Enable performance profiling (default: true)
            enableOptimizations?: boolean; // Enable all optimizations (default: true)
        };
        security?: {
            enableValidation?: boolean; // Enable input validation (default: true)
            enableSanitization?: boolean; // Enable input sanitization (default: true)
            enableRateLimit?: boolean; // Enable rate limiting (default: true)
            defaultRateLimit?: number; // Default rate limit per minute (default: 1000)
        };
        cache?: {
            enabled?: boolean; // Enable route caching (default: true)
            defaultTTL?: number; // Default cache TTL in ms (default: 60000)
            maxCacheSize?: number; // Maximum cached responses (default: 1000)
        };
    };

    /**
     * Custom 404 error page configuration.
     *
     * Allows customization of the 404 Not Found page with beautiful XyPriss branding
     * while maintaining the "Powered by Nehonix" attribution.
     *
     * @example
     * ```typescript
     * notFound: {
     *   enabled: true,
     *   title: "Page Not Found",
     *   message: "The page you're looking for doesn't exist.",
     *   showSuggestions: true,
     *   customCSS: "body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }",
     *   redirectAfter: 5000, // Redirect to home after 5 seconds
     *   redirectTo: "/",
     *   showBackButton: true,
     *   theme: "dark" // "light" | "dark" | "auto"
     * }
     * ```
     */
    notFound?: {
        /** Enable custom 404 page (default: true) */
        enabled?: boolean;

        /** Custom page title (default: "Page Not Found - XyPriss") */
        title?: string;

        /** Custom message to display (default: "The page you're looking for doesn't exist.") */
        message?: string;

        /** Show helpful suggestions (readonly) */
        showSuggestions?: boolean;

        /** Custom CSS to inject into the page */
        customCSS?: string;

        /** Auto-redirect after specified milliseconds (disabled by default) */
        redirectAfter?: number;

        /** URL to redirect to (default: "/") */
        redirectTo?: string;

        /** Show back button (readonly) */
        showBackButton?: boolean;

        /** Theme preference (default: "auto") */
        theme?: "light" | "dark" | "auto";

        /** Custom logo URL (optional) */
        logoUrl?: string;

        /** Additional custom HTML content */
        customContent?: string;

        /** Contact information to display */
        contact?: {
            email?: string;
            website?: string;
            support?: string;
        };
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
 * Ultra-fast Express application interface with advanced features.
 *
 * Extends the standard Express application with ultra-fast caching,
 * performance optimization, security features, clustering, and
 * comprehensive monitoring capabilities.
 *
 * @interface UltraFastApp
 * @extends Express
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
export interface UltraFastApp extends Omit<Express, "engine" | "listen"> {
    // Express methods are inherited from Express interface
    // Omit 'engine' to avoid the return type conflict and redeclare it
    engine(
        ext: string,
        fn: (
            path: string,
            options: object,
            callback: (e: any, rendered?: string) => void
        ) => void
    ): UltraFastApp;

    /**
     * Secure cache adapter for ultra-fast data access.
     *
     * Provides access to the underlying cache system with
     * encryption, compression, and intelligent strategies.
     */
    cache: SecureCacheAdapter;

    /**
     * GET route with integrated caching and security.
     *
     * @param path - Route path pattern
     * @param options - Route options including cache, security, and performance settings
     * @param handler - Route handler function
     *
     * @example
     * ```typescript
     * app.getWithCache('/api/products/:id', {
     *   cache: { ttl: 600, tags: ['products'] },
     *   security: { auth: true, sanitization: true }
     * }, async (req, res) => {
     *   const product = await getProductById(req.params.id);
     *   res.success(product);
     * });
     * ```
     */
    getWithCache: (
        path: string,
        options: RouteOptions,
        handler: RequestHandler
    ) => void;

    /**
     * POST route with integrated caching and security.
     *
     * @param path - Route path pattern
     * @param options - Route options including cache, security, and performance settings
     * @param handler - Route handler function
     */
    postWithCache: (
        path: string,
        options: RouteOptions,
        handler: RequestHandler
    ) => void;

    /**
     * PUT route with integrated caching and security.
     *
     * @param path - Route path pattern
     * @param options - Route options including cache, security, and performance settings
     * @param handler - Route handler function
     */
    putWithCache: (
        path: string,
        options: RouteOptions,
        handler: RequestHandler
    ) => void;

    /**
     * DELETE route with integrated caching and security.
     *
     * @param path - Route path pattern
     * @param options - Route options including cache, security, and performance settings
     * @param handler - Route handler function
     */
    deleteWithCache: (
        path: string,
        options: RouteOptions,
        handler: RequestHandler
    ) => void;

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
     * Start the ultra-fast server.
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
    ) => Promise<HttpServer> | HttpServer;

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

    // High-Performance Router methods
    ultraGet?: (path: string, options: any, handler: Function) => any;
    ultraPost?: (path: string, options: any, handler: Function) => any;
    ultraPut?: (path: string, options: any, handler: Function) => any;
    ultraDelete?: (path: string, options: any, handler: Function) => any;
    ultraRoutes?: (
        routes: Array<{
            method: string;
            path: string;
            options: any;
            handler: Function;
        }>
    ) => any;
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
    middleware: (config?: MiddlewareConfiguration) => MiddlewareAPIInterface;

    /**
     * Use middleware with enhanced security features.
     *
     * @param middleware - Middleware function(s) to apply with security enhancements
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.useSecure(authMiddleware)
     *    .useSecure([validationMiddleware, sanitizationMiddleware]);
     * ```
     */
    useSecure: (middleware: RequestHandler | RequestHandler[]) => UltraFastApp;

    /**
     * Use middleware with performance optimizations.
     *
     * @param middleware - Middleware function(s) to apply with performance enhancements
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.usePerformance(compressionMiddleware)
     *    .usePerformance([cachingMiddleware, optimizationMiddleware]);
     * ```
     */
    usePerformance: (
        middleware: RequestHandler | RequestHandler[]
    ) => UltraFastApp;

    /**
     * Use middleware with intelligent caching.
     *
     * @param middleware - Middleware function(s) to apply with caching
     * @param ttl - Cache TTL in seconds (optional)
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.useCached(expensiveMiddleware, 300) // Cache for 5 minutes
     *    .useCached(dataMiddleware, 60);      // Cache for 1 minute
     * ```
     */
    useCached: (
        middleware: RequestHandler | RequestHandler[],
        ttl?: number
    ) => UltraFastApp;

    /**
     * Get middleware information.
     *
     * @param name - Optional middleware name to get specific info
     * @returns Middleware info object or array of all middleware info
     *
     * @example
     * ```typescript
     * // Get specific middleware info
     * const authInfo = app.getMiddleware('auth-middleware');
     *
     * // Get all middleware info
     * const allMiddleware = app.getMiddleware();
     * ```
     */
    getMiddleware: (name?: string) => MiddlewareInfo | MiddlewareInfo[];

    /**
     * Remove middleware by name.
     *
     * @param name - Name of middleware to remove
     * @returns True if middleware was removed successfully
     *
     * @example
     * ```typescript
     * const removed = app.removeMiddleware('old-middleware');
     * if (removed) {
     *   console.log('Middleware removed successfully');
     * }
     * ```
     */
    removeMiddleware: (name: string) => boolean;

    /**
     * Enable security middleware with options.
     *
     * @param options - Security middleware configuration options
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.enableSecurity({
     *   helmet: true,
     *   cors: { origin: ['https://example.com'] },
     *   rateLimit: { max: 100, windowMs: 900000 }
     * });
     * ```
     */
    enableSecurity: (options?: SecurityMiddlewareOptions) => UltraFastApp;

    /**
     * Enable compression middleware with options.
     *
     * @param options - Compression middleware configuration options
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.enableCompression({
     *   level: 6,
     *   threshold: 1024
     * });
     * ```
     */
    enableCompression: (options?: CompressionMiddlewareOptions) => UltraFastApp;

    /**
     * Enable rate limiting middleware with options.
     *
     * @param options - Rate limiting middleware configuration options
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.enableRateLimit({
     *   max: 100,
     *   windowMs: 900000, // 15 minutes
     *   message: 'Too many requests'
     * });
     * ```
     */
    enableRateLimit: (options?: RateLimitMiddlewareOptions) => UltraFastApp;

    /**
     * Enable CORS middleware with options.
     *
     * @param options - CORS middleware configuration options
     * @returns UltraFastApp instance for method chaining
     *
     * @example
     * ```typescript
     * app.enableCors({
     *   origin: ['https://example.com', 'https://app.example.com'],
     *   credentials: true,
     *   methods: ['GET', 'POST', 'PUT', 'DELETE']
     * });
     * ```
     */
    enableCors: (options?: CorsMiddlewareOptions) => UltraFastApp;

    /**
     * Get comprehensive middleware statistics.
     *
     * @returns Middleware statistics including performance and usage metrics
     *
     * @example
     * ```typescript
     * const stats = app.getMiddlewareStats();
     * console.log(`Total middleware: ${stats.totalMiddleware}`);
     * console.log(`Average execution time: ${stats.averageExecutionTime}ms`);
     * ```
     */
    getMiddlewareStats: () => MiddlewareStats;

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
     * @param req - Express request object
     * @param res - Express response object
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

// Re-export Express types for convenience
export type { Request, Response, NextFunction, RequestHandler };

