/**
 * @fileoverview Routing-related type definitions for XyPrissJS Express integration
 *
 * This module contains all routing-related types including route configuration,
 * caching, security, validation, and optimization.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

import { Request } from "express";
import { RouteHandler, MiddlewareFunction } from "./core";
import { RouteSecurityConfig } from "./security";

/**
 * HTTP methods supported by the routing system.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";

/**
 * Route configuration interface.
 *
 * Comprehensive configuration for individual routes including
 * handlers, middleware, caching, security, and validation.
 *
 * @interface RouteConfig
 *
 * @example
 * ```typescript
 * const routeConfig: RouteConfig = {
 *   path: '/api/users/:id',
 *   method: 'GET',
 *   handler: async (req, res, next) => {
 *     const user = await getUserById(req.params.id);
 *     res.success(user);
 *   },
 *   middleware: [authMiddleware, validationMiddleware],
 *   cache: {
 *     enabled: true,
 *     ttl: 300,
 *     key: (req) => `user:${req.params.id}`,
 *     tags: ['users']
 *   },
 *   security: {
 *     auth: true,
 *     roles: ['user', 'admin'],
 *     sanitization: true
 *   },
 *   rateLimit: {
 *     max: 100,
 *     windowMs: 900000
 *   },
 *   validation: {
 *     params: { id: 'string' },
 *     required: ['id']
 *   }
 * };
 * ```
 */
export interface RouteConfig {
    /** Route path pattern */
    path: string;

    /** HTTP method */
    method?: HttpMethod;

    /** Route handler function */
    handler: RouteHandler;

    /** Middleware functions to apply */
    middleware?: MiddlewareFunction[];

    /** Route-specific cache configuration */
    cache?: RouteCacheConfig;

    /** Route-specific security configuration */
    security?: RouteSecurityConfig;

    /** Route-specific rate limiting */
    rateLimit?: RouteRateLimitConfig;

    /** Request validation configuration */
    validation?: RouteValidationConfig;
}

/**
 * Route cache configuration interface.
 *
 * Configuration for route-specific caching including
 * TTL, cache keys, tags, and invalidation rules.
 *
 * @interface RouteCacheConfig
 *
 * @example
 * ```typescript
 * const routeCacheConfig: RouteCacheConfig = {
 *   enabled: true,
 *   ttl: 300, // 5 minutes
 *   key: (req) => `api:users:${req.params.id}:${req.query.include}`,
 *   tags: ['users', 'api'],
 *   invalidateOn: ['user:updated', 'user:deleted'],
 *   compression: true
 * };
 * ```
 */
export interface RouteCacheConfig {
    /** Enable caching for this route */
    enabled?: boolean;

    /** Cache TTL in seconds */
    ttl?: number;

    /** Cache key generator */
    key?: string | ((req: Request) => string);

    /** Cache tags for invalidation */
    tags?: string[];

    /** Events that should invalidate this cache */
    invalidateOn?: string[];

    /** Enable compression for cached responses */
    compression?: boolean;
}

/**
 * Route rate limiting configuration interface.
 *
 * Configuration for route-specific rate limiting extending
 * the base rate limit configuration.
 *
 * @interface RouteRateLimitConfig
 *
 * @example
 * ```typescript
 * const routeRateLimitConfig: RouteRateLimitConfig = {
 *   windowMs: 900000, // 15 minutes
 *   max: 50, // 50 requests per window
 *   message: 'Too many requests to this endpoint',
 *   keyGenerator: (req) => `${req.ip}:${req.path}`,
 *   skip: (req) => req.user?.role === 'admin'
 * };
 * ```
 */
export interface RouteRateLimitConfig {
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

    /** Custom key generator for rate limiting */
    keyGenerator?: (req: Request) => string;

    /** Function to skip rate limiting for certain requests */
    skip?: (req: Request) => boolean;
}

/**
 * Route validation configuration interface.
 *
 * Configuration for request validation including
 * body, query, and parameter validation.
 *
 * @interface RouteValidationConfig
 *
 * @example
 * ```typescript
 * const routeValidationConfig: RouteValidationConfig = {
 *   body: {
 *     name: { type: 'string', minLength: 2, maxLength: 50 },
 *     email: { type: 'email' },
 *     age: { type: 'number', min: 18, max: 120 }
 *   },
 *   query: {
 *     page: { type: 'number', min: 1, default: 1 },
 *     limit: { type: 'number', min: 1, max: 100, default: 20 }
 *   },
 *   params: {
 *     id: { type: 'string', pattern: /^[0-9a-f]{24}$/ }
 *   },
 *   required: ['name', 'email']
 * };
 * ```
 */
export interface RouteValidationConfig {
    /** Request body validation schema */
    body?: any;

    /** Query parameters validation schema */
    query?: any;

    /** Route parameters validation schema */
    params?: any;

    /** Required fields */
    required?: string[];
}

/**
 * Route options interface for enhanced route methods.
 *
 * Options that can be passed to enhanced route methods
 * like getWithCache, postWithCache, etc.
 *
 * @interface RouteOptions
 *
 * @example
 * ```typescript
 * const routeOptions: RouteOptions = {
 *   cache: {
 *     enabled: true,
 *     ttl: 600,
 *     strategy: 'hybrid',
 *     tags: ['products']
 *   },
 *   security: {
 *     auth: true,
 *     roles: ['user'],
 *     encryption: false,
 *     sanitization: true
 *   },
 *   performance: {
 *     compression: true,
 *     timeout: 30000
 *   }
 * };
 * ```
 */
export interface RouteOptions {
    /** Cache configuration */
    cache?: {
        /** Enable caching */
        enabled?: boolean;

        /** Cache TTL in seconds */
        ttl?: number;

        /** Cache key generator */
        key?: string | ((req: Request) => string);

        /** Cache tags */
        tags?: string[];

        /** Cache invalidation events */
        invalidateOn?: string[];

        /** Cache strategy */
        strategy?: "memory" | "redis" | "hybrid";
    };

    /** Security configuration */
    security?: {
        /** Require authentication */
        auth?: boolean;

        /** Required user roles */
        roles?: string[];

        /** Enable response encryption */
        encryption?: boolean;

        /** Enable input sanitization */
        sanitization?: boolean;
    };

    /** Performance configuration */
    performance?: {
        /** Enable response compression */
        compression?: boolean;

        /** Request timeout in milliseconds */
        timeout?: number;
    };
}

/**
 * Router configuration interface.
 *
 * Configuration for the high-performance router including
 * optimization, security, and caching settings.
 *
 * @interface RouterConfig
 *
 * @example
 * ```typescript
 * const routerConfig: RouterConfig = {
 *   enabled: true,
 *   precompileCommonRoutes: true,
 *   enableSecurity: true,
 *   enableCaching: true,
 *   warmUpOnStart: true,
 *   performance: {
 *     targetResponseTime: 1,
 *     complexRouteTarget: 5,
 *     enableProfiling: true,
 *     enableOptimizations: true
 *   },
 *   security: {
 *     enableValidation: true,
 *     enableSanitization: true,
 *     enableRateLimit: true,
 *     defaultRateLimit: 1000
 *   },
 *   cache: {
 *     enabled: true,
 *     defaultTTL: 60000,
 *     maxCacheSize: 1000
 *   }
 * };
 * ```
 */
export interface RouterConfig {
    /** Enable high-performance routing */
    enabled?: boolean;

    /** Pre-compile common routes */
    precompileCommonRoutes?: boolean;

    /** Enable security validation */
    enableSecurity?: boolean;

    /** Enable route caching */
    enableCaching?: boolean;

    /** Warm up routes on startup */
    warmUpOnStart?: boolean;

    /** Performance configuration */
    performance?: {
        /** Target response time for simple routes in ms */
        targetResponseTime?: number;

        /** Target response time for complex routes in ms */
        complexRouteTarget?: number;

        /** Enable performance profiling */
        enableProfiling?: boolean;

        /** Enable all optimizations */
        enableOptimizations?: boolean;
    };

    /** Security configuration */
    security?: {
        /** Enable input validation */
        enableValidation?: boolean;

        /** Enable input sanitization */
        enableSanitization?: boolean;

        /** Enable rate limiting */
        enableRateLimit?: boolean;

        /** Default rate limit per minute */
        defaultRateLimit?: number;
    };

    /** Cache configuration */
    cache?: {
        /** Enable route caching */
        enabled?: boolean;

        /** Default cache TTL in ms */
        defaultTTL?: number;

        /** Maximum cached responses */
        maxCacheSize?: number;
    };
}

/**
 * Route statistics interface.
 *
 * Statistics and metrics for individual routes including
 * performance, usage, and error metrics.
 *
 * @interface RouteStats
 *
 * @example
 * ```typescript
 * const routeStats: RouteStats = {
 *   path: '/api/users/:id',
 *   method: 'GET',
 *   requestCount: 15420,
 *   averageResponseTime: 45.2,
 *   minResponseTime: 12.1,
 *   maxResponseTime: 234.7,
 *   errorCount: 23,
 *   errorRate: 0.0015,
 *   cacheHitRate: 0.78,
 *   lastAccessed: new Date(),
 *   isOptimized: true,
 *   optimizationLevel: 'high'
 * };
 * ```
 */
export interface RouteStats {
    /** Route path */
    path: string;

    /** HTTP method */
    method: string;

    /** Total number of requests */
    requestCount: number;

    /** Average response time in milliseconds */
    averageResponseTime: number;

    /** Minimum response time in milliseconds */
    minResponseTime: number;

    /** Maximum response time in milliseconds */
    maxResponseTime: number;

    /** Total number of errors */
    errorCount: number;

    /** Error rate (0-1) */
    errorRate: number;

    /** Cache hit rate (0-1) */
    cacheHitRate: number;

    /** Last access timestamp */
    lastAccessed: Date;

    /** Whether route is optimized */
    isOptimized: boolean;

    /** Optimization level */
    optimizationLevel: "none" | "low" | "medium" | "high" | "ultra";
}

