/***************************************************************************
 * XyPrissJS - Advanced JavaScript Security Library
 *
 * @author Nehonix
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

/**
 * Ultra-Fast Express (UFE) Server Factory
 *  Express applications with intelligent caching integration
 * Zero-async initialization for immediate use
 */

// Express-free imports
import { SecureCacheAdapter } from "../cache/SecureCacheAdapter";
import {
    RouteOptions,
    ServerOptions,
    UltraFastApp,
    RequestHandler,
    NextFunction,
} from "../types/types";
import { XyPrissServer } from "./FastServer";

// Re-export safe JSON utilities
export {
    createSafeJsonMiddleware,
    setupSafeJson,
    safeJsonStringify,
    sendSafeJson,
    createCircularRefDebugger,
} from "../middleware/safe-json-middleware";

export {
    expressStringify,
    safeStringify,
    fastStringify,
} from "../../mods/security/src/components/fortified-function/serializer/safe-serializer";

/**
 * Create ultra-fast Express server (zero-async)
 * Returns app instance ready to use immediately
 */
export function createServer(options: ServerOptions = {}): UltraFastApp {
    if (options.env) {
        process.env["NODE_ENV"] = options.env;
    }

    // The XyPrissServer already creates a XyprissApp with router support
    // So we can just return the original app
    const server = new XyPrissServer(options);
    return server.getApp();
}

/**
 * Create ultra-fast Express server class instance
 */
export function createServerInstance(
    options: ServerOptions = {}
): XyPrissServer {
    return new XyPrissServer(options);
}

/**
 * Generate cache key for request
 */
function generateCacheKey(
    req: any,
    customKey?: string | ((req: any) => string)
): string {
    if (typeof customKey === "function") {
        return customKey(req);
    }

    if (typeof customKey === "string") {
        return customKey;
    }

    // Auto-generate key based on route and params
    const baseKey = `${req.method}:${req.route?.path || req.path}`;
    const params =
        Object.keys(req.params).length > 0
            ? `:${JSON.stringify(req.params)}`
            : "";
    const query =
        Object.keys(req.query).length > 0
            ? `:${JSON.stringify(req.query)}`
            : "";

    return `${baseKey}${params}${query}`;
}

/**
 * Create cache middleware for routes
 */
export function createCacheMiddleware(
    cache: SecureCacheAdapter,
    options: RouteOptions = {}
): RequestHandler {
    return async (req: any, res: any, next?: NextFunction) => {
        // Skip caching if disabled
        if (options.cache?.enabled === false) {
            return next?.();
        }
        // Only cache GET requests by default
        if (req.method !== "GET") {
            return next?.();
        }

        try {
            const cacheKey = generateCacheKey(req as any, options.cache?.key);
            const startTime = Date.now();

            // Try to get from cache
            const cachedData = await cache.get(cacheKey);

            if (cachedData) {
                const cacheTime = Date.now() - startTime;

                // Log ultra-fast cache hits
                if (cacheTime < 5) {
                    console.log(` CACHE HIT (${cacheTime}ms): ${cacheKey}`);
                } else {
                    console.log(` CACHE HIT (${cacheTime}ms): ${cacheKey}`);
                }

                // Set cache headers
                res.set("X-Cache", "HIT");
                res.set("X-Cache-Time", `${cacheTime}ms`);

                return res.json(cachedData);
            }

            // Cache miss - continue to handler
            res.set("X-Cache", "MISS");

            // Override res.json to cache the response
            const originalJson = res.json.bind(res);
            res.json = function (data: any) {
                // Cache the response asynchronously
                setImmediate(async () => {
                    try {
                        const ttl = options.cache?.ttl || 300000; // 5 minutes default
                        await cache.set(cacheKey, data, {
                            ttl,
                            tags: options.cache?.tags,
                        });

                        console.log(` CACHED: ${cacheKey} (TTL: ${ttl}ms)`);
                    } catch (error: any) {
                        console.error("Cache set error:", error);
                    }
                });

                return originalJson(data);
            };

            next?.();
        } catch (error: any) {
            console.error("Cache middleware error:", error);
            next?.(); // Continue without caching on error
        }
    };
}

// Express-free exports
export type {
    ServerOptions,
    RouteOptions,
    UltraFastApp,
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from "../types/types";

