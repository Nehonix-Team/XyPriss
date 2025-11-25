/**
 * Default configuration for XyPriss server.
 * This configuration is used when no custom configuration is provided.
 *
 */

import { ServerOptions } from "../ServerFactory";
import { DEFAULT_FW_CONFIG } from "./FileWatcher.config";
import { DEFAULT_CONSOLE_CONFIG } from "../components/fastapi/console/types";
import { DEFAULT_CLUSTER_CONFIGS } from "./Cluster.config";

export const DEFAULT_HOST = process.env.HOST || "localhost";
export const DEFAULT_PORT = (process.env.PORT || 8085) as number;

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
        trustProxy: false,
        jsonLimit: "10mb",
        urlEncodedLimit: "10mb",
        host: DEFAULT_HOST,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
            strategy: "random",
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
        theme: "auto",
        enabled: true,
        showBackButton: false,
        showSuggestions: false,
    },
    cluster: {
        enabled: false, // Disabled by default for single-process mode
        config: DEFAULT_CLUSTER_CONFIGS,
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
        rateLimit: {
            max: 100,
            windowMs: 60 * 60 * 1000,
            message:
                "Too many requests from this IP, please try again later (this is a default message, you can customize it in the config).",
        },
        deviceAccess: {
            terminalOnly: {
                allowedTools: ["curl", "wget", "Postman", "cURL"],
            },
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
    fileUpload: {
        enabled: false, // Disabled by default for security
        maxFileSize: 1024 * 1024 * 6, // 6MB default
        maxFiles: 1,
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
        ],
        createParentPath: true,
        preservePath: false,
        limits: {
            fieldNameSize: 100,
            fieldSize: 1024 * 1024, // 1MB
            fields: 10,
            headerPairs: 20,
        },
    },
};

