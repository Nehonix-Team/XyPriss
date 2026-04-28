import { PluginConfig } from "../plugins/types/PluginTypes";
import { ConsoleInterceptionConfig } from "../server/components/fastapi/console/types";
import { XRequest as Request, XResponse as Response } from "../server/routing";
import { ComponentLogConfig, LogComponent, LogLevel } from "../shared/types";
import { FileUploadConfig } from "./FiUp.type";
import { NotFoundConfig } from "./NotFoundConfig";
import {
    DeepPartial,
    MemoryConfig,
    MultiServerConfig,
    ResponseManipulationConfig,
    SecurityConfig,
} from "./types";
import { XemsTypes } from "./xems.type";

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
/**
 * Internal server options including flags not intended for public use.
 */
export interface InternalServerOptions extends XServerOptions {
    /** If true, this server will bypass plugin auto-loading to prevent recursion */
    isAuxiliary?: boolean;
}

export interface XServerOptions {
    /** If true, this server will bypass plugin auto-loading to prevent recursion */
    isAuxiliary?: boolean;

    notFound?: NotFoundConfig;

    /** Response manipulation configuration */
    responseManipulation?: ResponseManipulationConfig;

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
     * Static file serving configuration (XHSC optimized).
     */
    static?: {
        /** Active sendfile() system call for zero-copy transfers (default: true) */
        zeroCopy?: boolean;
        /** Limit of goroutines for I/O operations (default: 1024) */
        ConcurrencyPool?: number;
        /** Size of LRU cache for path metadata/validity (anti-DDoS) (default: 5000) */
        lruCacheSize?: number;
        /** Dotfile serving policy: "deny", "allow", "ignore" (default: "deny") */
        dotfiles?: "deny" | "allow" | "ignore";
        /** Default Cache-Control max-age (e.g., "1d", "1h") (default: "1d") */
        maxAge?: string;
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

    // Logging configuration
    logging?: {
        enabled?: boolean; // Master switch for all logging (default: true)
        level?: LogLevel; // Log level (default: "info")
        instanceName?: string; // Optional name of the server instance (e.g. "main", "admin")

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

// Alias
// export { XyPrissServerOptions as XServerOptions };

