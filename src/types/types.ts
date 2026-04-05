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

/**
 * @fileoverview Comprehensive server options interface for XyPriss integration
 *
 * This interface provides complete configuration options for creating high-performance,
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

    /** Response manipulation configuration */
    responseManipulation?: ResponseManipulationConfig;

    /** If true, this server will bypass plugin auto-loading to prevent recursion */
    isAuxiliary?: boolean;

    /** Plugin configuration */
    plugins?: PluginConfig;

    /**
     * Managed Cluster configuration (XHSC managed).
     *
     * When enabled, XHSC will act as an IPC server and manage a pool of
     * Node.js worker processes via clustering logic implemented in Rust.
     */
    cluster?: {
        /** Enable/Disable Rust-managed clustering (default: false) */
        enabled?: boolean;
        /** Number of workers to spawn, or "auto" for CPU core count (default: "auto") */
        workers?: number | "auto";
        /** Enable automatic worker respawn if a process crashes (default: true) */
        autoRespawn?: boolean;
        /** Path to the Node.js entry point script for workers */
        entryPoint?: string;
        /**
         * Load balancing strategy
         * - round-robin: Cyclic distribution
         * - least-connections: Send to worker with fewest active requests
         * - least-response-time: Send to worker with fastest historical response
         * - ip-hash: Sticky sessions based on client IP
         */
        strategy?:
            | "round-robin"
            | "least-connections"
            | "least-response-time"
            | "ip-hash"
            | "weighted-round-robin"
            | "weighted-least-connections";
        /** Resource limits for each worker */
        resources?: {
            /** Max memory per worker in MB (e.g. 512) or string (e.g. "1GB") */
            maxMemory?: number | string;
            /** Max CPU usage percentage (0-100) */
            maxCpu?: number;
            /** Process priority level (maps to nice values) */
            priority?: "low" | "normal" | "high" | "critical" | number;
            /** Maximum number of open file descriptors */
            fileDescriptorLimit?: number;
            /** Optimize for garbage collection (expose-gc) */
            gcHint?: boolean;
            /** Memory management settings */
            memoryManagement?: {
                /** Interval in ms to check worker resource usage */
                checkInterval?: number;
            };
            /** Enforcement settings */
            enforcement?: {
                /** Kill worker if limits are exceeded (default: true) */
                hardLimits?: boolean;
            };
            /** Intelligence settings for resource management and recovery */
            intelligence?: {
                /** Enable smart resource management (default: false) */
                enabled?: boolean;
                /** Pre-allocate resources at startup to prevent competition (default: false) */
                preAllocate?: boolean;
                /** Fast rescue mode if all workers die (reboots in ms) (default: true) */
                rescueMode?: boolean;
            };
        };
    };

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
     * Cache configuration for high-performance data access.
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
     * Performance and Engine Optimization settings.
     *
     * These settings are delegated directly to the XHSC engine
     * for maximum efficiency and ultra-low latency execution.
     *
     * @example
     * ```typescript
     * performance: {
     *   enabled: true,
     *   batchSize: 100,
     *   connectionPooling: true,
     *   intelligence: true,
     *   preAllocate: true
     * }
     * ```
     */
    performance?: {
        /** Enable engine-level optimizations (default: true) */
        enabled?: boolean;

        /**
         * Execution batch size for bulk operations.
         * Higher values improve throughput but may increase latency.
         * @default 100
         */
        batchSize?: number;

        /**
         * Enable high-performance connection pooling.
         * DRAMATICALLY improves performance for high-concurrency workloads.
         * @default true
         */
        connectionPooling?: boolean;

        /**
         * Enable Engine Intelligence (Pattern Recognition).
         * Enables smart resource management, GC hints, and predictive optimizations.
         * @default false
         */
        intelligence?: boolean;

        /**
         * Pre-allocate system resources at startup.
         * Prevents resource contention during peak loads.
         * @default false
         */
        preAllocate?: boolean;
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
        trustProxy?: string[];
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

        /**
         * Automatically kill any process already using the required port.
         * Useful for resolving "Address already in use" (EADDRINUSE) errors automatically.
         * @default true
         */
        autoKillConflict?: boolean;

        /** Enable XHSC (XyPriss Hyper-System Core) - Rust performance engine */
        xhsc?: boolean;

        /**
         * XEMS automated session security.
         * Enables auto-rotating secure sessions in memory via Rust.
         */
        xems?: XemsTypes;
    };

    /**
     * Multi-server configuration for creating multiple server instances
     *
     * Allows running multiple server instances with different configurations,
     * ports, and route scopes from a single configuration.
     *
     *
     * @see {@link https://xypriss.nehonix.com/docs/multi-server?kw=multiple%20server%20instances}
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

            /** Custom timeout error message */
            errorMessage?: string;
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

            /** Maximum number of requests allowed in the queue (Rust layer) */
            maxQueueSize?: number;
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

            // /** Maximum file upload size */
            // maxFileSize?: number;

            // /** Allowed MIME types for uploads */
            // allowedMimeTypes?: string[];

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
            xems?: boolean; // XEMS plugin logs
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
            palette?: Partial<Record<string, string>>; // Custom ANSI color palette overrides
            componentColors?: Partial<Record<LogComponent, string>>; // Custom identity colors per component
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
         * Firewall management plugin configuration.
         *
         * Provides automated port management and IP-based access control
         * via native system firewall managers (ufw, iptables).
         */
        firewall?: {
            /** Enable firewall management plugin */
            enabled?: boolean;

            /** Automatically open required ports (80, 443, and server port) */
            autoOpen?: boolean;

            /** List of explicitly allowed IPs or CIDR blocks */
            allowedIPs?: string[];
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
            algorithms?: ("gzip" | "br" | "deflate" | "zstd")[];

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

