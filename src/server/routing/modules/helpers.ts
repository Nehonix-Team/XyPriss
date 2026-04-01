import { BUILTIN_PARAM_PATTERNS } from "./constants";
import { RouteCondition } from "./types";

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

