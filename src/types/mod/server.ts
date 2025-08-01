/**
 * @fileoverview Server-related type definitions for XyPrissJS Express integration
 *
 * This module contains all server-related types including configuration,
 * options, logging, and file watching.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

import { DeepPartial } from "./core";
import { CacheConfig } from "./cache";
import { SecurityConfig } from "./security";
import {
    PerformanceConfig,
    PerformanceOptimizationConfig,
    PerformanceMonitoringConfig,
} from "./performance";
import { MiddlewareConfiguration } from "./middleware";
import { ClusterConfig } from "../cluster";
import { ConsoleInterceptionConfig } from "../../server/components/fastapi/console/types";
import { LogComponent, LogLevel } from "../../../shared/types/logger.type";

/**
 * Auto port switching configuration interface.
 *
 * Configuration for automatic port switching when the
 * primary port is unavailable.
 *
 * @interface AutoPortSwitchConfig
 *
 * @example
 * ```typescript
 * const autoPortConfig: AutoPortSwitchConfig = {
 *   enabled: true,
 *   maxAttempts: 10,
 *   startPort: 3000,
 *   portRange: [3000, 3100],
 *   strategy: 'increment',
 *   predefinedPorts: [3000, 3001, 8080, 8081],
 *   onPortSwitch: (original, newPort) => {
 *     console.log(`Switched from port ${original} to ${newPort}`);
 *   }
 * };
 * ```
 */
export interface AutoPortSwitchConfig {
    /** Enable auto port switching */
    enabled?: boolean;

    /** Maximum number of ports to try */
    maxAttempts?: number;

    /** Starting port for auto-switching */
    startPort?: number;

    /** Port range to search within [min, max] */
    portRange?: [number, number];

    /** Port selection strategy */
    strategy?: "increment" | "random" | "predefined";

    /** List of predefined ports to try */
    predefinedPorts?: number[];

    /** Callback when port is switched */
    onPortSwitch?: (originalPort: number, newPort: number) => void;
}

/**
 * Main server configuration interface.
 *
 * Comprehensive server configuration including basic settings,
 * security, caching, monitoring, and advanced features.
 *
 * @interface ServerConfig
 *
 * @example
 * ```typescript
 * const serverConfig: ServerConfig = {
 *   port: 3000,
 *   host: 'localhost',
 *   environment: 'development',
 *   autoPortSwitch: {
 *     enabled: true,
 *     maxAttempts: 5,
 *     strategy: 'increment'
 *   },
 *   security: {
 *     level: 'enhanced',
 *     helmet: true,
 *     cors: true
 *   },
 *   cache: {
 *     type: 'hybrid',
 *     ttl: 3600
 *   },
 *   monitoring: {
 *     enabled: true,
 *     metrics: ['response_time', 'memory_usage']
 *   }
 * };
 * ```
 */
export interface ServerConfig {
    /** Server port */
    port?: number;

    /** Server host */
    host?: string;

    /** Environment mode */
    environment?: "development" | "production" | "test";

    /** Auto port switching configuration */
    autoPortSwitch?: AutoPortSwitchConfig;

    /** Security configuration */
    security?: SecurityConfig;

    /** Cache configuration */
    cache?: CacheConfig;

    /** Performance monitoring configuration */
    monitoring?: PerformanceConfig;

    /** Custom middleware configuration */
    middleware?: MiddlewareConfiguration[];

    /** SSL/TLS configuration */
    ssl?: SSLConfig;

    /** CORS configuration */
    cors?: CORSConfig;

    /** Rate limiting configuration */
    rateLimit?: RateLimitConfig;

    /** Compression configuration */
    compression?: CompressionConfig;

    /** Logging configuration */
    logging?: LoggingConfig;

    /** Cluster configuration */
    cluster?: {
        enabled?: boolean;
        config?: ClusterConfig;
    };
}

/**
 * SSL/TLS configuration interface.
 *
 * Configuration for SSL/TLS encryption including
 * certificates and security options.
 *
 * @interface SSLConfig
 *
 * @example
 * ```typescript
 * const sslConfig: SSLConfig = {
 *   key: fs.readFileSync('path/to/private-key.pem', 'utf8'),
 *   cert: fs.readFileSync('path/to/certificate.pem', 'utf8'),
 *   ca: fs.readFileSync('path/to/ca-certificate.pem', 'utf8'),
 *   passphrase: 'your-passphrase'
 * };
 * ```
 */
export interface SSLConfig {
    /** Private key for SSL certificate */
    key: string;

    /** SSL certificate */
    cert: string;

    /** Certificate Authority certificate */
    ca?: string;

    /** Passphrase for private key */
    passphrase?: string;
}

/**
 * CORS configuration interface.
 *
 * Configuration for Cross-Origin Resource Sharing.
 *
 * @interface CORSConfig
 *
 * @example
 * ```typescript
 * const corsConfig: CORSConfig = {
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization'],
 *   credentials: true
 * };
 * ```
 */
export interface CORSConfig {
    /** Allowed origins */
    origin?: string | string[] | boolean;

    /** Allowed HTTP methods */
    methods?: string[];

    /** Allowed headers */
    allowedHeaders?: string[];

    /** Allow credentials in CORS requests */
    credentials?: boolean;
}

/**
 * Rate limiting configuration interface.
 *
 * Configuration for request rate limiting.
 *
 * @interface RateLimitConfig
 *
 * @example
 * ```typescript
 * const rateLimitConfig: RateLimitConfig = {
 *   windowMs: 900000, // 15 minutes
 *   max: 100,
 *   message: 'Too many requests, please try again later',
 *   standardHeaders: true,
 *   legacyHeaders: false
 * };
 * ```
 */
export interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs?: number;

    /** Maximum requests per window */
    max?: number;

    /** Message when limit is exceeded */
    message?: string;

    /** Include standard rate limit headers */
    standardHeaders?: boolean;

    /** Include legacy rate limit headers */
    legacyHeaders?: boolean;
}

/**
 * Compression configuration interface.
 *
 * Configuration for response compression.
 *
 * @interface CompressionConfig
 *
 * @example
 * ```typescript
 * const compressionConfig: CompressionConfig = {
 *   enabled: true,
 *   level: 6,
 *   threshold: 1024,
 *   filter: (req, res) => {
 *     return req.headers['x-no-compression'] ? false : true;
 *   }
 * };
 * ```
 */
export interface CompressionConfig {
    /** Enable compression */
    enabled?: boolean;

    /** Compression level (0-9) */
    level?: number;

    /** Minimum response size to compress */
    threshold?: number;

    /** Custom filter function */
    filter?: (req: any, res: any) => boolean;
}

/**
 * Logging configuration interface.
 *
 * Configuration for application logging including
 * levels, formats, and destinations.
 *
 * @interface LoggingConfig
 *
 * @example
 * ```typescript
 * const loggingConfig: LoggingConfig = {
 *   level: 'info',
 *   format: 'json',
 *   destination: 'both',
 *   requests: true,
 *   errors: true,
 *   file: {
 *     path: './logs/app.log',
 *     maxSize: '10m',
 *     maxFiles: 5
 *   }
 * };
 * ```
 */
export interface LoggingConfig {
    /** Log level */
    level?: "error" | "warn" | "info" | "debug";

    /** Log format */
    format?: "json" | "combined" | "common" | "dev";

    /** Log destination */
    destination?: "console" | "file" | "both";

    /** Log HTTP requests */
    requests?: boolean;

    /** Log errors */
    errors?: boolean;

    /** File logging configuration */
    file?: {
        /** Log file path */
        path: string;

        /** Maximum file size */
        maxSize?: string;

        /** Maximum number of files */
        maxFiles?: number;
    };
}

/**
 * TypeScript type checking configuration interface.
 *
 * Configuration for TypeScript type checking during
 * file watching and development.
 *
 * @interface TypeScriptTypeCheckConfig
 *
 * @example
 * ```typescript
 * const typeCheckConfig: TypeScriptTypeCheckConfig = {
 *   enabled: true,
 *   configFile: './tsconfig.json',
 *   checkOnSave: true,
 *   checkBeforeRestart: true,
 *   showWarnings: true,
 *   showInfos: false,
 *   maxErrors: 50,
 *   failOnError: false,
 *   excludePatterns: ['**\/*.test.ts'],
 *   includePatterns: ['src/**\/*.ts'],
 *   verbose: false
 * };
 * ```
 */
export interface TypeScriptTypeCheckConfig {
    /** Enable TypeScript type checking */
    enabled?: boolean;

    /** Path to tsconfig.json */
    configFile?: string;

    /** Check types when files are saved */
    checkOnSave?: boolean;

    /** Check types before restarting server */
    checkBeforeRestart?: boolean;

    /** Show TypeScript warnings */
    showWarnings?: boolean;

    /** Show TypeScript info messages */
    showInfos?: boolean;

    /** Maximum errors to display */
    maxErrors?: number;

    /** Prevent restart if type errors found */
    failOnError?: boolean;

    /** Additional patterns to exclude from type checking */
    excludePatterns?: string[];

    /** Specific patterns to include for type checking */
    includePatterns?: string[];

    /** Verbose type checking output */
    verbose?: boolean;
}

/**
 * TypeScript execution configuration interface.
 *
 * Configuration for TypeScript execution during
 * development and file watching.
 *
 * @interface TypeScriptExecutionConfig
 *
 * @example
 * ```typescript
 * const tsExecutionConfig: TypeScriptExecutionConfig = {
 *   enabled: true,
 *   runner: 'tsx',
 *   runnerArgs: ['--experimental-loader', 'tsx/esm'],
 *   fallbackToNode: true,
 *   autoDetectRunner: true
 * };
 * ```
 */
export interface TypeScriptExecutionConfig {
    /** Auto-detect TypeScript files and use appropriate runner */
    enabled?: boolean;

    /** TypeScript runner to use */
    runner?: "auto" | "tsx" | "ts-node" | "bun" | "node" | string;

    /** Additional arguments for the TypeScript runner */
    runnerArgs?: string[];

    /** Fallback to node if TypeScript runner fails */
    fallbackToNode?: boolean;

    /** Auto-detect available TypeScript runner */
    autoDetectRunner?: boolean;
}

/**
 * File watcher configuration interface.
 *
 * Configuration for file watching and auto-reload functionality.
 *
 * @interface FileWatcherConfig
 *
 * @example
 * ```typescript
 * const fileWatcherConfig: FileWatcherConfig = {
 *   enabled: true,
 *   watchPaths: ['./src', './config'],
 *   ignorePaths: ['./node_modules', './dist'],
 *   extensions: ['.js', '.ts', '.json'],
 *   debounceMs: 1000,
 *   restartDelay: 2000,
 *   maxRestarts: 10,
 *   gracefulShutdown: true,
 *   verbose: false,
 *   typeCheck: {
 *     enabled: true,
 *     checkOnSave: true,
 *     checkBeforeRestart: true,
 *     failOnError: false
 *   },
 *   typescript: {
 *     enabled: true,
 *     runner: 'auto',
 *     fallbackToNode: true
 *   }
 * };
 * ```
 */
export interface FileWatcherConfig {
    /** Enable file watching */
    enabled?: boolean;

    /** Paths to watch */
    watchPaths?: string[];

    /** Paths to ignore */
    ignorePaths?: string[];

    /** File extensions to watch */
    extensions?: string[];

    /** Debounce delay in milliseconds */
    debounceMs?: number;

    /** Restart delay in milliseconds */
    restartDelay?: number;

    /** Maximum number of restarts */
    maxRestarts?: number;

    /** Enable graceful shutdown */
    gracefulShutdown?: boolean;

    /** Enable verbose logging */
    verbose?: boolean;

    /** TypeScript type checking configuration */
    typeCheck?: TypeScriptTypeCheckConfig;

    /** TypeScript execution configuration */
    typescript?: TypeScriptExecutionConfig;
}

