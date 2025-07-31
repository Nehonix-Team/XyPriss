/**
 * @fileoverview Middleware-related type definitions for XyPrissJS Express integration
 *
 * This module contains all middleware-related types including configuration,
 * management, statistics, and execution contexts.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

import { Request, Response, RequestHandler } from "express";

/**
 * Middleware priority levels.
 *
 * Defines the execution priority of middleware:
 * - critical: Highest priority (security, authentication)
 * - high: High priority (logging, monitoring)
 * - normal: Standard priority (business logic)
 * - low: Lowest priority (cleanup, finalization)
 */
export type MiddlewarePriority = "critical" | "high" | "normal" | "low";

/**
 * Main middleware configuration interface.
 *
 * Comprehensive configuration for all middleware types
 * including built-in and custom middleware.
 *
 * @interface MiddlewareConfiguration
 *
 * @example
 * ```typescript
 * const middlewareConfig: MiddlewareConfiguration = {
 *   rateLimit: {
 *     enabled: true,
 *     windowMs: 900000, // 15 minutes
 *     max: 100
 *   },
 *   cors: {
 *     enabled: true,
 *     origin: ['https://example.com'],
 *     credentials: true
 *   },
 *   compression: {
 *     enabled: true,
 *     level: 6,
 *     threshold: 1024
 *   },
 *   enableOptimization: true,
 *   enableCaching: true,
 *   enablePerformanceTracking: true
 * };
 * ```
 */
export interface MiddlewareConfiguration {
    /** Rate limiting middleware configuration */
    rateLimit?: boolean | RateLimitMiddlewareOptions;

    /** CORS middleware configuration */
    cors?: boolean | CorsMiddlewareOptions;

    /** Compression middleware configuration */
    compression?: boolean | CompressionMiddlewareOptions;

    /** Security middleware configuration */
    security?: boolean | SecurityMiddlewareOptions;

    /** Enable Helmet.js security headers */
    helmet?: boolean;

    /** Custom headers to add to all responses */
    customHeaders?: Record<string, string>;

    /** Enable middleware optimization */
    enableOptimization?: boolean;

    /** Enable middleware caching */
    enableCaching?: boolean;

    /** Enable performance tracking for middleware */
    enablePerformanceTracking?: boolean;
}

/**
 * Security middleware options interface.
 *
 * Configuration for security-related middleware including
 * Helmet, CORS, rate limiting, and custom security headers.
 *
 * @interface SecurityMiddlewareOptions
 *
 * @example
 * ```typescript
 * const securityOptions: SecurityMiddlewareOptions = {
 *   helmet: true,
 *   cors: {
 *     enabled: true,
 *     origin: ['https://trusted-domain.com']
 *   },
 *   rateLimit: {
 *     enabled: true,
 *     max: 100,
 *     windowMs: 900000
 *   },
 *   customHeaders: {
 *     'X-Custom-Security': 'enabled'
 *   },
 *   csrfProtection: true,
 *   contentSecurityPolicy: true,
 *   hsts: true
 * };
 * ```
 */
export interface SecurityMiddlewareOptions {
    /** Helmet.js configuration */
    helmet?: boolean | any;

    /** CORS configuration */
    cors?: boolean | CorsMiddlewareOptions;

    /** Rate limiting configuration */
    rateLimit?: boolean | RateLimitMiddlewareOptions;

    /** Custom security headers */
    customHeaders?: Record<string, string>;

    /** Enable CSRF protection */
    csrfProtection?: boolean;

    /** Content Security Policy configuration */
    contentSecurityPolicy?: boolean | any;

    /** HTTP Strict Transport Security configuration */
    hsts?: boolean | any;
}

/**
 * Compression middleware options interface.
 *
 * Configuration for response compression including
 * compression levels, thresholds, and filters.
 *
 * @interface CompressionMiddlewareOptions
 *
 * @example
 * ```typescript
 * const compressionOptions: CompressionMiddlewareOptions = {
 *   enabled: true,
 *   level: 6, // Balanced compression
 *   threshold: 1024, // Only compress responses > 1KB
 *   filter: (req, res) => {
 *     // Custom filter logic
 *     return req.headers['x-no-compression'] ? false : true;
 *   },
 *   chunkSize: 16384,
 *   windowBits: 15,
 *   memLevel: 8,
 *   strategy: 0
 * };
 * ```
 */
export interface CompressionMiddlewareOptions {
    /** Enable compression */
    enabled?: boolean;

    /** Compression level (0-9, higher = better compression) */
    level?: number;

    /** Minimum response size to compress (bytes) */
    threshold?: number;

    /** Custom filter function for compression */
    filter?: (req: Request, res: Response) => boolean;

    /** Chunk size for compression */
    chunkSize?: number;

    /** Window bits for compression algorithm */
    windowBits?: number;

    /** Memory level for compression */
    memLevel?: number;

    /** Compression strategy */
    strategy?: number;
}

/**
 * Rate limiting middleware options interface.
 *
 * Configuration for rate limiting including time windows,
 * limits, and custom logic.
 *
 * @interface RateLimitMiddlewareOptions
 *
 * @example
 * ```typescript
 * const rateLimitOptions: RateLimitMiddlewareOptions = {
 *   enabled: true,
 *   windowMs: 900000, // 15 minutes
 *   max: 100, // 100 requests per window
 *   message: 'Too many requests from this IP',
 *   standardHeaders: true,
 *   legacyHeaders: false,
 *   keyGenerator: (req) => req.ip,
 *   skip: (req) => req.ip === '127.0.0.1',
 *   onLimitReached: (req, res) => {
 *     console.log(`Rate limit exceeded for ${req.ip}`);
 *   }
 * };
 * ```
 */
export interface RateLimitMiddlewareOptions {
    /** Enable rate limiting */
    enabled?: boolean;

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

    /** Custom key generator function */
    keyGenerator?: (req: Request) => string;

    /** Function to skip rate limiting for certain requests */
    skip?: (req: Request) => boolean;

    /** Callback when rate limit is reached */
    onLimitReached?: (req: Request, res: Response) => void;
}

/**
 * CORS middleware options interface.
 *
 * Configuration for Cross-Origin Resource Sharing including
 * origins, methods, headers, and credentials.
 *
 * @interface CorsMiddlewareOptions
 *
 * @example
 * ```typescript
 * const corsOptions: CorsMiddlewareOptions = {
 *   enabled: true,
 *   origin: (origin, callback) => {
 *     const allowedOrigins = ['https://example.com', 'https://app.example.com'];
 *     if (!origin || allowedOrigins.includes(origin)) {
 *       callback(null, true);
 *     } else {
 *       callback(new Error('Not allowed by CORS'));
 *     }
 *   },
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization'],
 *   exposedHeaders: ['X-Total-Count'],
 *   credentials: true,
 *   maxAge: 86400, // 24 hours
 *   preflightContinue: false,
 *   optionsSuccessStatus: 204
 * };
 * ```
 */
export interface CorsMiddlewareOptions {
    /** Enable CORS */
    enabled?: boolean;

    /** Allowed origins */
    origin?:
        | string
        | string[]
        | boolean
        | ((
              origin: string,
              callback: (err: Error | null, allow?: boolean) => void
          ) => void);

    /** Allowed HTTP methods */
    methods?: string[];

    /** Allowed request headers */
    allowedHeaders?: string[];

    /** Headers exposed to the client */
    exposedHeaders?: string[];

    /** Allow credentials in CORS requests */
    credentials?: boolean;

    /** Cache duration for preflight requests in seconds */
    maxAge?: number;

    /** Pass control to next handler for preflight requests */
    preflightContinue?: boolean;

    /** Status code for successful OPTIONS requests */
    optionsSuccessStatus?: number;
}

/**
 * Middleware information interface.
 *
 * Runtime information about registered middleware including
 * performance metrics and configuration.
 *
 * @interface MiddlewareInfo
 *
 * @example
 * ```typescript
 * const middlewareInfo: MiddlewareInfo = {
 *   name: 'auth-middleware',
 *   priority: 'critical',
 *   enabled: true,
 *   order: 1,
 *   routes: ['/api/*'],
 *   executionCount: 1500,
 *   averageExecutionTime: 2.5,
 *   lastExecuted: new Date(),
 *   cacheEnabled: true,
 *   optimized: true
 * };
 * ```
 */
export interface MiddlewareInfo {
    /** Middleware name */
    name: string;

    /** Execution priority */
    priority: MiddlewarePriority;

    /** Whether middleware is enabled */
    enabled: boolean;

    /** Execution order */
    order: number;

    /** Routes this middleware applies to */
    routes?: string[];

    /** Number of times middleware has been executed */
    executionCount: number;

    /** Average execution time in milliseconds */
    averageExecutionTime: number;

    /** Last execution timestamp */
    lastExecuted?: Date;

    /** Whether caching is enabled for this middleware */
    cacheEnabled?: boolean;

    /** Whether middleware has been optimized */
    optimized?: boolean;
}

/**
 * Middleware statistics interface.
 *
 * Comprehensive statistics about the middleware system
 * including performance and usage metrics.
 *
 * @interface MiddlewareStats
 *
 * @example
 * ```typescript
 * const stats: MiddlewareStats = {
 *   totalMiddleware: 8,
 *   enabledMiddleware: 7,
 *   totalExecutions: 15000,
 *   averageExecutionTime: 3.2,
 *   cacheHitRate: 0.85,
 *   optimizationRate: 0.75,
 *   byPriority: {
 *     critical: 2,
 *     high: 3,
 *     normal: 2,
 *     low: 1
 *   },
 *   byType: {
 *     'auth-middleware': middlewareInfo,
 *     'cors-middleware': middlewareInfo2
 *   },
 *   performance: {
 *     fastestMiddleware: 'cache-middleware',
 *     slowestMiddleware: 'auth-middleware',
 *     mostUsedMiddleware: 'cors-middleware',
 *     cacheEfficiency: 0.92
 *   }
 * };
 * ```
 */
export interface MiddlewareStats {
    /** Total number of registered middleware */
    totalMiddleware: number;

    /** Number of enabled middleware */
    enabledMiddleware: number;

    /** Total middleware executions */
    totalExecutions: number;

    /** Average execution time across all middleware */
    averageExecutionTime: number;

    /** Cache hit rate for cached middleware */
    cacheHitRate: number;

    /** Percentage of optimized middleware */
    optimizationRate: number;

    /** Middleware count by priority */
    byPriority: Record<MiddlewarePriority, number>;

    /** Middleware information by type */
    byType: Record<string, MiddlewareInfo>;

    /** Performance metrics */
    performance: {
        /** Name of fastest middleware */
        fastestMiddleware: string;

        /** Name of slowest middleware */
        slowestMiddleware: string;

        /** Name of most frequently used middleware */
        mostUsedMiddleware: string;

        /** Cache efficiency rating */
        cacheEfficiency: number;
    };
}

/**
 * Custom middleware definition interface.
 *
 * Definition for custom middleware including handler,
 * configuration, and metadata.
 *
 * @interface CustomMiddleware
 *
 * @example
 * ```typescript
 * const customMiddleware: CustomMiddleware = {
 *   name: 'request-logger',
 *   handler: (req, res, next) => {
 *     console.log(`${req.method} ${req.path}`);
 *     next();
 *   },
 *   priority: 'high',
 *   routes: ['/api/*'],
 *   enabled: true,
 *   cacheable: false,
 *   metadata: {
 *     version: '1.0.0',
 *     author: 'XyPrissJS Team'
 *   }
 * };
 * ```
 */
export interface CustomMiddleware {
    /** Middleware name */
    name: string;

    /** Middleware handler function */
    handler: RequestHandler;

    /** Execution priority */
    priority?: MiddlewarePriority;

    /** Routes this middleware applies to */
    routes?: string[];

    /** Whether middleware is enabled */
    enabled?: boolean;

    /** Whether middleware results can be cached */
    cacheable?: boolean;

    /** Cache TTL in milliseconds */
    ttl?: number;

    /** Additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Middleware execution context interface.
 *
 * Context information for middleware execution including
 * performance tracking and optimization data.
 *
 * @interface MiddlewareExecutionContext
 *
 * @example
 * ```typescript
 * const context: MiddlewareExecutionContext = {
 *   requestId: 'req-123456',
 *   startTime: Date.now(),
 *   middleware: middlewareInfo,
 *   req: request,
 *   res: response,
 *   cached: false,
 *   optimized: true,
 *   executionPath: 'fast'
 * };
 * ```
 */
export interface MiddlewareExecutionContext {
    /** Unique request identifier */
    requestId: string;

    /** Execution start time */
    startTime: number;

    /** Middleware information */
    middleware: MiddlewareInfo;

    /** Express request object */
    req: Request;

    /** Express response object */
    res: Response;

    /** Whether result was served from cache */
    cached?: boolean;

    /** Whether middleware was optimized */
    optimized?: boolean;

    /** Execution path taken */
    executionPath: "critical" | "fast" | "standard";
}

/**
 * Middleware API interface for fluent middleware management.
 *
 * Provides a fluent API for managing middleware with method chaining
 * and comprehensive middleware operations.
 *
 * @interface MiddlewareAPIInterface
 *
 * @example
 * ```typescript
 * const middlewareAPI: MiddlewareAPIInterface = app.middleware()
 *   .register(authMiddleware, { priority: 'critical' })
 *   .register(loggingMiddleware, { priority: 'high' })
 *   .enable('auth-middleware')
 *   .optimize();
 * ```
 */
export interface MiddlewareAPIInterface {
    /** Register middleware with options */
    register: (
        middleware: CustomMiddleware | RequestHandler,
        options?: {
            name?: string;
            priority?: MiddlewarePriority;
            routes?: string[];
            cacheable?: boolean;
            ttl?: number;
        }
    ) => MiddlewareAPIInterface;

    /** Unregister middleware by ID */
    unregister: (id: string) => MiddlewareAPIInterface;

    /** Enable middleware by ID */
    enable: (id: string) => MiddlewareAPIInterface;

    /** Disable middleware by ID */
    disable: (id: string) => MiddlewareAPIInterface;

    /** Get middleware information */
    getInfo: (id?: string) => MiddlewareInfo | MiddlewareInfo[];

    /** Get middleware statistics */
    getStats: () => MiddlewareStats;

    /** Get middleware configuration */
    getConfig: () => MiddlewareConfiguration;

    /** Clear all middleware */
    clear: () => MiddlewareAPIInterface;

    /** Optimize middleware performance */
    optimize: () => Promise<MiddlewareAPIInterface>;
}

