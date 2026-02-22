/**
 * Default configuration for XyPriss server.
 * This configuration is used when no custom configuration is provided.
 *
 */

import { ServerOptions } from "../ServerFactory";
import { DEFAULT_FW_CONFIG } from "./FileWatcher.config";
import { DEFAULT_CONSOLE_CONFIG } from "../components/fastapi/console/types";
import path from "node:path";

export const DEFAULT_HOST = process.env.XYPRISS_HOST || "localhost";
export const DEFAULT_PORT = (process.env.XYPRISS_PORT || 8085) as number;

// Default configuration
export const DEFAULT_OPTIONS: ServerOptions = {
    performance: {
        compression: true,
        batchSize: 100,
        connectionPooling: true,
        asyncWrite: true,
        prefetch: true,
        // Ultra-performance optimization settings (optimized for ≤7ms targets)
        optimizationEnabled: true,
        requestClassification: true,
        predictivePreloading: true,
        aggressiveCaching: true,
        parallelProcessing: true,
        // RequestPreCompiler optimal settings from testing
        preCompilerEnabled: true,
        learningPeriod: 60000, // 1 minute for faster learning
        optimizationThreshold: 1, // Optimize after just 1 request
        aggressiveOptimization: true, // Always use aggressive optimization
        maxCompiledRoutes: 1000,
        // ExecutionPredictor aggressive settings
        ultraFastRulesEnabled: true,
        staticRouteOptimization: true,
        patternRecognitionEnabled: true,
        // Cache warming settings
        cacheWarmupEnabled: true,
        warmupOnStartup: true,
        precomputeCommonResponses: true,
    },
    monitoring: {
        enabled: true,
        healthChecks: true,
        metrics: true,
        detailed: false,
        alertThresholds: {
            memoryUsage: 85,
            hitRate: 0.8,
            errorRate: 0.02,
            latency: 50,
        },
    },
    server: {
        enableMiddleware: true,
        port: DEFAULT_PORT, // Default port for a UF Server
        jsonLimit: "10mb",
        urlEncodedLimit: "10mb",
        autoParseJson: false,
        host: DEFAULT_HOST,
        xhsc: true,
        // Trust Proxy is disabled by default for security reasons.
        // Enable this ONLY if you are behind a reverse proxy (e.g. Nginx, Cloudflare)
        // to correctly identify the client's IP address.
        // trustProxy: true, // or 'loopback', 'linklocal', 'uniquelocal'
        trustProxy: false,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
            strategy: "random",
        },
        autoKillConflict: true,

        xems: {
            enable: true,
            autoRotation: true,
            ttl: "3d",
            attachTo: "session",
            sandbox: "xems.internal-session",
            cookieOptions: {
                httpOnly: true,
                sameSite: "strict",
                secure: true,
            },
            gracePeriod: 10000, // 10 seconds
            persistence: {
                enabled: false,
                secret: "", // Default placeholder //CHANGE_ME_TO_A_SECURE_32_CHAR_KEY
                path: path.resolve(process.cwd(), ".private/xvault.xems"),
            },
        },
    },

    fileWatcher: {
        ...DEFAULT_FW_CONFIG,
        enabled: false, // Disable file watcher by default to avoid hanging
    },

    logging: {
        level: "info",
        components: {
            server: true,
            cache: false, // Disable cache logs
            cluster: true,
            performance: false, // Disable performance logs
            fileWatcher: true,
            plugins: false, // Disable plugin logs
            security: false, // Disable security warnings
            monitoring: false,
            routes: false,
            middleware: false,
            userApp: true, // Enable user application console output
            console: false, // Disable console interception system logs
        },
        types: {
            startup: true,
            warnings: true,
            errors: true,
            performance: true,
            debug: true,
            hotReload: true,
            portSwitching: true,
        },
        format: {
            prefix: true,
            colors: true,
            compact: false,
            timestamps: false,
        },
        // Console Interception with Encryption Support
        consoleInterception: {
            ...DEFAULT_CONSOLE_CONFIG,
            enabled: false, // Disabled by default (user can enable when needed)
            preserveOriginal: true,
        },
    },
    notFound: {
        themeClass: "auto",
        enabled: true,
        title: "Page Not Found - XyPriss",
        redirectTo: "/",
    },
    cluster: {
        enabled: false, // Disabled by default for single-process mode
        workers: "auto",
        autoRespawn: true,
        resources: {
            intelligence: {
                enabled: true,
                preAllocate: true,
                rescueMode: true,
            },
        },
    },
    cache: {
        strategy: "memory", // Use memory-only cache
        maxSize: 500 * 1024 * 1024, // 500MB memory cache
        ttl: 300000, // 5 minutes TTL
        enabled: true,
        memory: {
            maxSize: 100, // Max entries
            algorithm: "lru", // Least Recently Used
        },
    },
    security: {
        enabled: true,
        level: "enhanced",
        csrf: true,
        helmet: true,
        sqlInjection: true,
        bruteForce: false,
        commandInjection: true,
        pathTraversal: false,
        xss: true,
        compression: true,
        ldapInjection: false,
        xxe: true,
        cors: {
            origin: "*", // Allow all by default
            credentials: true,
            methods: [
                "GET",
                "HEAD",
                "PUT",
                "PATCH",
                "POST",
                "DELETE",
                "OPTIONS",
            ],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "Accept",
                "Origin",
                "Access-Control-Request-Method",
                "Access-Control-Request-Headers",
                "X-CSRF-Token",
                "X-Mobile-App",
                "X-App-Platform",
                "Expo-Version",
                "React-Native-Version",
            ],
        },
        rateLimit: {
            max: 100,
            windowMs: 60 * 60 * 1000,
            message:
                "Too many requests from this IP, please try again later (this is a default message, you can customize it in the config).",
            excludePaths: ["/health", "/ping", "/static/", "/assets/"],
        },

        morgan: false,
        hpp: true,
        mongoSanitize: true,
        slowDown: true,
        encryption: {
            algorithm: "AES-256-GCM",
            keySize: 32,
        },
    },
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 30000,
            includeStackTrace: false,
            errorMessage:
                "The request has timed out. (configure this message in your server config at 'requestManagement.timeout.errorMessage')",
        },
        payload: {
            maxBodySize: 10485760, // 10MB
        },
    },
    fileUpload: {
        enabled: false, // Disabled by default for security
        maxFileSize: 50 * 1024 * 1024, // 50MB for production use
        maxFiles: 5,
        storage: "memory", // Memory storage by default (safer)
        allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/plain",
            "text/csv",
            "video/mp4",
            "video/avi",
            "video/mov",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        allowedExtensions: [
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".pdf",
            ".txt",
            ".csv",
            ".mp4",
            ".avi",
            ".mov",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
        ],
        createParentPath: true,
        preservePath: false,
        limits: {
            fieldNameSize: 100,
            fieldSize: 50 * 1024 * 1024, // 50MB
            fields: 20,
            headerPairs: 50,
        },
    },
    workerPool: {
        enabled: true, // Delegated to Go (XHSC) by default
        config: {
            maxConcurrentTasks: 1,
            io: {
                min: 10,
                max: 30,
            },
            cpu: {
                min: 10,
                max: 30,
            },
        },
    },

    network: {
        // Connection management - optimized for modern web applications
        connection: {
            enabled: true,
            http2: {
                enabled: false, // Disabled by default for compatibility
                maxConcurrentStreams: 100,
                initialWindowSize: 65535,
                serverPush: false,
            },
            keepAlive: {
                enabled: true,
                timeout: 65000, // 65 seconds (slightly longer than default 60s)
                maxRequests: 100, // Reuse connections for up to 100 requests
            },
            connectionPool: {
                maxConnections: 1000,
                timeout: 30000, // 30 seconds
                idleTimeout: 60000, // 60 seconds
            },
        },

        // Compression - balanced between speed and compression ratio
        compression: {
            enabled: true,
            algorithms: ["gzip", "br"], // Support all major algorithms
            level: 6, // Balanced compression level (1-9)
            threshold: 1024, // Only compress responses > 1KB
            contentTypes: [
                "text/html",
                "text/css",
                "text/javascript",
                "application/javascript",
                "application/json",
                "application/xml",
                "text/xml",
                "text/plain",
                "image/svg+xml",
            ],
            memLevel: 8, // Default memory level
            windowBits: 15, // Default window size
        },

        // Rate limiting - reasonable defaults to prevent abuse
        rateLimit: {
            enabled: false, // Disabled by default (user can enable)
            strategy: "sliding-window", // Most accurate strategy
            global: {
                requests: 10000, // 10k requests globally
                window: "1h", // Per hour
            },
            perIP: {
                requests: 100, // 100 requests per IP
                window: "1m", // Per minute
            },
            headers: {
                enabled: true, // Include rate limit headers
                prefix: "X-RateLimit", // Standard prefix
            },
        },

        // Proxy - disabled by default, ready for configuration
        proxy: {
            enabled: false,
            upstreams: [],
            loadBalancing: "round-robin",
            healthCheck: {
                enabled: true,
                interval: 30000, // Check every 30 seconds
                timeout: 5000, // 5 second timeout
                path: "/health",
                unhealthyThreshold: 3, // Mark unhealthy after 3 failures
                healthyThreshold: 2, // Mark healthy after 2 successes
            },
            timeout: 30000, // 30 second proxy timeout
            logging: false, // Disable proxy logging by default
        },
    },

    plugins: {
        routeOptimization: {
            enabled: false, // Disabled by default for performance
            analysisInterval: 300000, // 5 minutes
            optimizationThreshold: 100, // Minimum hits before optimization
            popularityWindow: 3600000, // 1 hour
            maxTrackedRoutes: 1000,
            autoOptimization: false,
            customRules: [],
        },
        serverMaintenance: {
            enabled: true,
            checkInterval: 300000, // 5 minutes
            errorThreshold: 5, // 5% error rate
            memoryThreshold: 80, // 80% memory usage
            responseTimeThreshold: 5000, // 5 seconds
            logRetentionDays: 7,
            maxLogFileSize: 10485760, // 10MB
            autoCleanup: false,
            autoRestart: false,
        },
        register: [], // Empty array for custom plugins
    },
};

