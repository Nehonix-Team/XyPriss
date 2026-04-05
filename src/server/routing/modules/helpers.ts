import { BUILTIN_PARAM_PATTERNS } from "./constants";
import {
    RouteCondition,
    BuiltInGuards,
    RouteGuard,
    XyPrisRequest,
    XyPrisResponse,
} from "./types";
import { MiddlewareFunction } from "../../../types/httpServer.type";
import { XyGuard } from "./XyGuard";

/**
 * Builds a regex pattern and constraint name for a typed parameter.
 */
export function buildParamPattern(typeExpr: string | undefined): {
    pattern: string;
    constraint: string;
} {
    if (!typeExpr) return { pattern: "[^/]+", constraint: "string" };

    const lower = typeExpr.trim().toLowerCase();

    if (BUILTIN_PARAM_PATTERNS[lower]) {
        return { pattern: BUILTIN_PARAM_PATTERNS[lower], constraint: lower };
    }

    // string(min,max)
    const strRange = lower.match(/^string\((\d+),(\d+)\)$/);
    if (strRange) {
        return {
            pattern: `[^/]{${strRange[1]},${strRange[2]}}`,
            constraint: lower,
        };
    }

    // number(min,max)
    const numRange = lower.match(
        /^number\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)$/,
    );
    if (numRange) {
        return {
            pattern: "-?\\d+(?:\\.\\d+)?",
            constraint: lower,
        };
    }

    // enum(a,b,c)
    const enumMatch = lower.match(/^enum\((.+)\)$/);
    if (enumMatch) {
        const values = enumMatch[1]
            .split(",")
            .map((v) => v.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
        return { pattern: `(?:${values})`, constraint: lower };
    }

    // Fallback — treat as raw regex pattern
    return { pattern: typeExpr, constraint: typeExpr };
}

/**
 * Resolves a route condition (env or feature flag).
 */
export function resolveCondition(
    cond: RouteCondition | undefined,
    featureResolver: ((flag: string) => boolean) | null,
): boolean {
    if (cond === undefined) return true;
    if (typeof cond === "boolean") return cond;
    if (typeof cond === "function") return cond();
    if (typeof cond === "object") {
        if (cond.env) {
            const envs = Array.isArray(cond.env) ? cond.env : [cond.env];
            const current = process.env.NODE_ENV ?? "development";
            return envs.includes(current);
        }
        if (cond.feature) {
            return featureResolver?.(cond.feature) ?? true;
        }
    }
    return true;
}

/**
 * Generates a unique route ID.
 */
let _routeIdCounter = 0;
export function nextRouteId(): string {
    return `route_${(++_routeIdCounter).toString(36)}`;
}

/**
 * Creates a middleware that executes all guards (built-in and custom).
 */
export function createGuardMiddleware(
    guards: BuiltInGuards | RouteGuard[],
    logger: any,
): MiddlewareFunction {
    return async (req: XyPrisRequest, res: XyPrisResponse, next: any) => {
        const isBuiltIn = !Array.isArray(guards);
        const customGuards = Array.isArray(guards)
            ? guards
            : (guards as BuiltInGuards).custom || [];

        // 1. Built-in Guards via XyGuard resolvers
        if (isBuiltIn) {
            const b = guards as BuiltInGuards;

            // Check Authentication
            if (b.authenticated) {
                const resolver = XyGuard.get("authenticated");
                if (resolver) {
                    const result = await resolver(req);
                    if (result === false) {
                        return res.status(401).json({
                            success: false,
                            error: "Unauthorized: Authentication required",
                        });
                    }
                    if (typeof result === "string") {
                        return res
                            .status(401)
                            .json({ success: false, error: result });
                    }
                }
            }

            // Check Roles
            if (b.roles && b.roles.length > 0) {
                const resolver = XyGuard.get("roles");
                if (resolver) {
                    const result = await resolver(req, b.roles);
                    if (result === false) {
                        return res.status(403).json({
                            success: false,
                            error: "Forbidden: Insufficient roles",
                        });
                    }
                    if (typeof result === "string") {
                        return res
                            .status(403)
                            .json({ success: false, error: result });
                    }
                }
            }

            // Check Permissions
            if (b.permissions && b.permissions.length > 0) {
                const resolver = XyGuard.get("permissions");
                if (resolver) {
                    const result = await resolver(req, b.permissions);
                    if (result === false) {
                        return res.status(403).json({
                            success: false,
                            error: "Forbidden: Insufficient permissions",
                        });
                    }
                    if (typeof result === "string") {
                        return res
                            .status(403)
                            .json({ success: false, error: result });
                    }
                }
            }
        }

        // 2. Custom Guard functions
        for (const guard of customGuards) {
            try {
                const result = await guard(req, res);
                if (result === false) {
                    return res.status(403).json({
                        success: false,
                        error: "Forbidden: Guard rejection",
                    });
                }
                if (typeof result === "string") {
                    return res
                        .status(401)
                        .json({ success: false, error: result });
                }
            } catch (err) {
                logger.error("router", `Guard execution error: ${err}`);
                return res.status(500).json({
                    success: false,
                    error: "Internal Server Error during guard check",
                });
            }
        }

        next?.();
    };
}

