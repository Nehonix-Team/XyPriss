/**
 * XyPrissJS Smart Routes
 * Intelligent route handlers with automatic optimization, caching, and security
 */

import { Request, Response, NextFunction } from "express";
import { RouteConfig, RouteHandler, MiddlewareFunction } from "./types/types";
import { SecureCacheAdapter } from "./cache/SecureCacheAdapter";
import { func } from "../mods/toolkit/src/components/fortified-function";
import { XyPrissSecurity as XyPrissJS } from "../mods/toolkit/src/core/crypto";
import { Validators } from "../mods/toolkit/src/core/validators";
import { Hash } from "../mods/toolkit/src/core/hash";

/**
 * Smart route configuration for intelligent caching
 */
export interface SmartRouteConfig {
    ttl?: number;
    tags?: string[];
    strategy?: "always" | "conditional" | "smart" | "never";
    conditions?: {
        methods?: string[];
        statusCodes?: number[];
        headers?: Record<string, string>;
        queryParams?: string[];
    };
    smart?: {
        minHits?: number;
        hitWindow?: number;
        adaptiveTTL?: boolean;
    };
    invalidation?: {
        onMethods?: string[];
        onRoutes?: string[];
        onTags?: string[];
    };
}

/**
 * Create a smart route with automatic optimization
 */
function smartRoute(config: RouteConfig): MiddlewareFunction {
    const {
        path,
        method = "GET",
        handler,
        middleware = [],
        cache,
        security,
        rateLimit,
        validation,
    } = config;

    // Create optimized handler with XyPrissJS func
    const optimizedHandler = func(handler, {
        smartCaching: !!cache?.enabled,
        autoEncrypt: !!security?.encryption,
        performanceTracking: true,
        auditLog: true,
        timeout: 30000,
        retries: method === "GET" ? 2 : 0,
    });

    // Build middleware stack
    const middlewareStack: MiddlewareFunction[] = [];

    // Add validation middleware
    if (validation) {
        middlewareStack.push(createValidationMiddleware(validation));
    }

    // Add security middleware
    if (security) {
        middlewareStack.push(createSecurityMiddleware(security));
    }

    // Add rate limiting middleware
    if (rateLimit) {
        middlewareStack.push(createRateLimitMiddleware(rateLimit));
    }

    // Add caching middleware
    if (cache?.enabled) {
        middlewareStack.push(createCacheMiddleware(cache));
    }

    // Add custom middleware
    middlewareStack.push(...middleware);

    // Add the main handler
    middlewareStack.push(async (req: any, res: any, next: any) => {
        try {
            req.performance?.start();
            req.performance?.mark("handler-start");

            await optimizedHandler(req, res, next);

            req.performance?.mark("handler-end");
            const duration = req.performance?.measure(
                "handler-duration",
                "handler-start",
                "handler-end"
            );

            if (duration) {
                res.set("X-Response-Time", `${duration.toFixed(2)}ms`);
            }
        } catch (error) {
            next(error);
        }
    });

    return (req: any, res: any, next: any) => {
        if (matchesRoute(req, path, method)) {
            executeMiddlewareStack(middlewareStack, req, res, next);
        } else {
            next();
        }
    };
}

/**
 * Create a secure route with maximum protection
 */
export function Route(
    config: Omit<RouteConfig, "security"> & {
        security?: Partial<RouteConfig["security"]>;
    }
): MiddlewareFunction {
    const secureConfig: RouteConfig = {
        ...config,
        security: {
            auth: true,
            encryption: true,
            sanitization: true,
            validation: true,
            ...config.security,
        },
    };

    return smartRoute(secureConfig);
}

Route({ handler: (req, res) => {}, path: "" });
/**
 * Create validation middleware
 */
function createValidationMiddleware(validation: any): MiddlewareFunction {
    return async (req: any, res: any, next: any) => {
        try {
            const errors: string[] = [];

            if (validation.body && req.body) {
                const result = validateSchema(req.body, validation.body);
                if (!result.valid) {
                    errors.push(
                        ...result.errors.map((e: string) => `Body: ${e}`)
                    );
                }
            }

            if (validation.query && req.query) {
                const result = validateSchema(req.query, validation.query);
                if (!result.valid) {
                    errors.push(
                        ...result.errors.map((e: string) => `Query: ${e}`)
                    );
                }
            }

            if (validation.params && req.params) {
                const result = validateSchema(req.params, validation.params);
                if (!result.valid) {
                    errors.push(
                        ...result.errors.map((e: string) => `Params: ${e}`)
                    );
                }
            }

            if (errors.length > 0) {
                return res.error(
                    `Validation failed: ${errors.join(", ")}`,
                    400
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Create security middleware
 */
function createSecurityMiddleware(security: any): MiddlewareFunction {
    return async (req: any, res: any, next: any) => {
        try {
            if (security.auth) {
                const token = req.headers.authorization?.replace("Bearer ", "");
                if (!token) {
                    return res.error("Authentication required", 401);
                }

                try {
                    const decoded = verifyJWT(token);
                    req.user = decoded;
                } catch (error) {
                    return res.error("Invalid token", 401);
                }
            }

            if (security.roles && req.user) {
                const hasRole = security.roles.some((role: string) =>
                    req.user.roles?.includes(role)
                );
                if (!hasRole) {
                    return res.error("Insufficient permissions", 403);
                }
            }

            if (security.permissions && req.user) {
                const hasPermission = security.permissions.some(
                    (permission: string) =>
                        req.user.permissions?.includes(permission)
                );
                if (!hasPermission) {
                    return res.error("Insufficient permissions", 403);
                }
            }

            if (security.sanitization) {
                sanitizeRequest(req);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Create rate limiting middleware
 */
function createRateLimitMiddleware(rateLimit: any): MiddlewareFunction {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return async (req: any, res: any, next: any) => {
        try {
            const key = rateLimit.keyGenerator
                ? rateLimit.keyGenerator(req)
                : req.ip || "unknown";

            const now = Date.now();
            const windowMs = rateLimit.windowMs || 15 * 60 * 1000;
            const max = rateLimit.max || 100;

            let requestData = requests.get(key);

            if (!requestData || requestData.resetTime < now) {
                requestData = {
                    count: 0,
                    resetTime: now + windowMs,
                };
            }

            requestData.count++;
            requests.set(key, requestData);

            res.set("X-RateLimit-Limit", max.toString());
            res.set(
                "X-RateLimit-Remaining",
                Math.max(0, max - requestData.count).toString()
            );
            res.set(
                "X-RateLimit-Reset",
                new Date(requestData.resetTime).toISOString()
            );

            if (requestData.count > max) {
                return res.error("Rate limit exceeded", 429);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Create caching middleware
 */
function createCacheMiddleware(cache: any): MiddlewareFunction {
    return async (req: any, res: any, next: any) => {
        try {
            if (req.method !== "GET") {
                return next();
            }

            const cacheKey = cache.key
                ? typeof cache.key === "function"
                    ? cache.key(req)
                    : cache.key
                : `${req.method}:${req.path}:${JSON.stringify(req.query)}`;

            const cached = await req.cache?.get(cacheKey);
            if (cached) {
                res.set("X-Cache", "HIT");
                res.set("X-Cache-Key", cacheKey);
                return res.json(cached);
            }

            const originalJson = res.json;
            res.json = function (data: any) {
                req.cache?.set(cacheKey, data, cache.ttl);

                if (cache.tags) {
                    req.cache?.tags(cache.tags);
                }

                res.set("X-Cache", "MISS");
                res.set("X-Cache-Key", cacheKey);

                return originalJson.call(this, data);
            };

            next();
        } catch (error) {
            next(error);
        }
    };
}

// Helper functions
function executeMiddlewareStack(
    middlewareStack: MiddlewareFunction[],
    req: any,
    res: any,
    next: any
): void {
    let index = 0;

    function nextMiddleware(error?: any): void {
        if (error) {
            return next(error);
        }

        if (index >= middlewareStack.length) {
            return next();
        }

        const middleware = middlewareStack[index++];
        try {
            middleware(req, res, nextMiddleware);
        } catch (error) {
            nextMiddleware(error);
        }
    }

    nextMiddleware();
}

function matchesRoute(req: any, path: string, method: string): boolean {
    const pathMatches =
        req.path === path ||
        (path.includes(":") && matchesParameterizedPath(req.path, path));

    const methodMatches = method === "ALL" || req.method === method;

    return pathMatches && methodMatches;
}

function matchesParameterizedPath(
    requestPath: string,
    routePath: string
): boolean {
    const requestSegments = requestPath.split("/");
    const routeSegments = routePath.split("/");

    if (requestSegments.length !== routeSegments.length) {
        return false;
    }

    return routeSegments.every((segment, index) => {
        return segment.startsWith(":") || segment === requestSegments[index];
    });
}

function validateSchema(
    data: any,
    schema: any
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (schema.required) {
        for (const field of schema.required) {
            if (!(field in data)) {
                errors.push(`${field} is required`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

function verifyJWT(token: string): any {
    try {
        if (!token || typeof token !== "string") {
            throw new Error("Token must be a string");
        }

        const parts = token.split(".");
        if (parts.length !== 3) {
            throw new Error("Invalid JWT format - must have 3 parts");
        }

        const header = JSON.parse(Buffer.from(parts[0], "base64").toString());
        if (!header.alg || !header.typ) {
            throw new Error("Invalid JWT header");
        }

        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

        if (payload.exp) {
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
                throw new Error("Token expired");
            }
        }

        if (payload.iat) {
            const now = Math.floor(Date.now() / 1000);
            if (payload.iat > now + 60) {
                throw new Error("Token used before issued");
            }
        }

        if (payload.nbf) {
            const now = Math.floor(Date.now() / 1000);
            if (payload.nbf > now) {
                throw new Error("Token not yet valid");
            }
        }

        return payload;
    } catch (error) {
        throw new Error(
            `JWT verification failed: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}

function sanitizeRequest(req: any): void {
    // Basic sanitization implementation
    if (req.body && typeof req.body === "object") {
        sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === "object") {
        sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === "object") {
        sanitizeObject(req.params);
    }
}

function sanitizeObject(obj: any): void {
    for (const key in obj) {
        if (typeof obj[key] === "string") {
            obj[key] = obj[key].replace(
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                ""
            );
            obj[key] = obj[key].replace(/javascript:/gi, "");
            obj[key] = obj[key].replace(/on\w+\s*=/gi, "");
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
            sanitizeObject(obj[key]);
        }
    }
}

