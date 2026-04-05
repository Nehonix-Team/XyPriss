import {
    XyPrisRequest,
    XyPrisResponse,
    RoutRateLimit,
    RouteCache,
    RouteLifecycle,
    MiddlewareFunction,
} from "./types";

/**
 * Creates a rate limiting middleware for a specific route.
 */
export function createRateLimitMiddleware(
    options: RoutRateLimit,
): MiddlewareFunction {
    const hits = new Map<string, { count: number; reset: number }>();
    const windowMs =
        (options as any).windowMs ||
        (options.window ? parseDuration(options.window) : 60000); // Default 1m

    return (req: XyPrisRequest, res: XyPrisResponse, next: any) => {
        const key =
            typeof options.keyBy === "function"
                ? options.keyBy(req)
                : (options.keyBy === "user" ? (req as any).user?.id : req.ip) ||
                  "anonymous";

        const now = Date.now();
        const hit = hits.get(key) || { count: 0, reset: now + windowMs };

        if (now > hit.reset) {
            hit.count = 0;
            hit.reset = now + windowMs;
        }

        hit.count++;
        hits.set(key, hit);

        if (hit.count > options.max) {
            return res.status(429).json({
                success: false,
                error:
                    options.message ||
                    "Too many requests, please try again later.",
                retryAfter: Math.ceil((hit.reset - now) / 1000),
            });
        }

        next();
    };
}

/**
 * Creates a caching middleware for a specific route.
 */
export function createCacheMiddleware(options: RouteCache): MiddlewareFunction {
    const ttl =
        typeof options === "string"
            ? parseDuration(options) / 1000
            : options.ttl;

    return async (req: XyPrisRequest, res: XyPrisResponse, next: any) => {
        if (req.method !== "GET") return next();

        const cache = (req as any).app?.getCache?.();
        if (!cache) return next();

        const key =
            typeof options === "object" && options.key
                ? options.key(req)
                : `route_cache:${req.path}:${JSON.stringify(req.query)}`;

        try {
            const cached = await cache.get(key);
            if (cached) {
                return res.json(cached);
            }

            // Intercept res.json to cache the response
            const originalJson = res.json;
            res.json = (data: any) => {
                cache.set(key, data, { ttl }).catch(() => {});
                return originalJson.call(res, data);
            };
        } catch (err) {
            // Ignore cache errors and proceed
        }

        next();
    };
}

/**
 * Injects lifecycle hooks into the request-response cycle.
 */
export function wrapWithLifecycle(
    handler: Function,
    lifecycle: RouteLifecycle,
): MiddlewareFunction {
    return async (req: XyPrisRequest, res: XyPrisResponse, nextArg?: any) => {
        const next = typeof nextArg === "function" ? nextArg : () => {};
        const start = Date.now();
        let errorCaught = false;

        try {
            // 1. beforeEnter
            if (lifecycle.beforeEnter) {
                let proceed = false;
                await lifecycle.beforeEnter(req, res, () => {
                    proceed = true;
                });
                // If the hook ended the response or explicitly didn't call next (if we want to be strict)
                // but for hooks, we usually continue unless res is ended.
                if (res.writableEnded) return;
            }

            // 2. Main Handler
            await handler(req, res, next);

            // 3. afterLeave (Normal flow)
            // Note: If res.json is called, it might close the response before we reach here.
            // But we still want to trigger the hook if it hasn't crashed.
        } catch (err) {
            errorCaught = true;
            if (lifecycle.onError) {
                try {
                    return await lifecycle.onError(err, req, res, next);
                } catch (innerErr) {
                    console.error(
                        "Critical error in lifecycle.onError:",
                        innerErr,
                    );
                }
            }
            throw err;
        } finally {
            if (lifecycle.afterLeave) {
                const duration = Date.now() - start;
                try {
                    await lifecycle.afterLeave(req, res, duration);
                } catch (err) {
                    console.error("[LIFECYCLE] Error in afterLeave hook:", err);
                }
            }
        }
    };
}

/**
 * Internal duration parser (s, m, h, d)
 */
function parseDuration(val: string | undefined): number {
    if (!val) return 0;
    const match = val.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
    const num = parseInt(match[1]);
    const unit = match[2];
    const map: Record<string, number> = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
    };
    return num * map[unit || "s"];
}

/**
 * Scans the handler function's source code for res.status() calls.
 */
export function detectStatusCodes(
    handler: Function,
): Record<string, { description: string }> {
    const originalHandler = (handler as any).__original || handler;
    const code = originalHandler.toString();

    const codes: Record<string, { description: string }> = {};

    // Find res.status(XXX)
    const statusMatches = code.matchAll(/res\.status\((\d+)\)/g);
    for (const match of statusMatches) {
        const statusCode = match[1];
        codes[statusCode] = { description: getStatusDescription(statusCode) };
    }

    // Find res.redirect(...) -> usually 302
    if (code.includes("res.redirect(")) {
        codes["302"] = { description: "Found (Redirect)" };
    }

    // Find res.success(...) -> 200
    if (code.includes("res.success(")) {
        codes["200"] = { description: "Successful response" };
    }

    // Fallback: if it looks like there's a response but no status was found
    if (
        Object.keys(codes).length === 0 &&
        (code.includes("res.json") ||
            code.includes("res.send") ||
            code.includes("res.html") ||
            code.includes("res.xJson"))
    ) {
        codes["200"] = { description: "Successful response" };
    }

    return codes;
}

function getStatusDescription(code: string): string {
    const map: Record<string, string> = {
        "200": "OK",
        "201": "Created",
        "204": "No Content",
        "301": "Moved Permanently",
        "302": "Found",
        "400": "Bad Request",
        "401": "Unauthorized",
        "403": "Forbidden",
        "404": "Not Found",
        "409": "Conflict",
        "422": "Unprocessable Entity",
        "429": "Too Many Requests",
        "500": "Internal Server Error",
    };
    return map[code] || `Response status ${code}`;
}

