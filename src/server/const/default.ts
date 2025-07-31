import { ServerOptions } from "../../ServerFactory";
import { DEFAULT_FW_CONFIG } from "./FileWatcher.config";
import { DEFAULT_CONSOLE_CONFIG } from "../components/fastapi/console/types";

// Default configuration
export const DEFAULT_OPTIONS: ServerOptions = {
    cache: {
        strategy: "memory", // Use memory-only by default to avoid Redis dependency
        ttl: 300000, // 5 minutes
        enabled: true,
        memory: {
            maxSize: 100,
            algorithm: "lru",
        },
    },
    security: {
        encryption: true,
        accessMonitoring: true,
        sanitization: true,
        auditLogging: false,
        cors: true,
        helmet: true,
    },
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
        port: 8085, // Default port for a UF Server
        host: "localhost",
        trustProxy: false,
        jsonLimit: "10mb",
        urlEncodedLimit: "10mb",
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
};

