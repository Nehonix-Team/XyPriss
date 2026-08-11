import { XStringify } from "xypriss-security";
import { normalizeXtrsRules } from "../../../../../utils/xtrsParser";

export function buildRateLimitArgs(securityConf: any, args: string[], app?: any): void {
    const rl = securityConf?.rateLimit;
    const hasGlobalRl = !!rl;

    const getRoutesFn =
        typeof app?.getRouteRegistry === "function"
            ? app.getRouteRegistry.bind(app)
            : typeof app?.getRoutes === "function"
            ? app.getRoutes.bind(app)
            : null;
    const routes = getRoutesFn ? getRoutesFn() : [];
    const routeRules: any[] = [];

    if (Array.isArray(routes)) {
        const addedGroupWildcards = new Set<string>();

        // Pass 1: Add group wildcard rate limits (e.g. /stream/*)
        routes.forEach((r: any) => {
            if (r.groupRateLimit && r.groupPrefix && r.groupPrefix !== "/") {
                let wildcardPath = r.groupPrefix;
                if (!wildcardPath.endsWith("*")) {
                    wildcardPath = wildcardPath.endsWith("/")
                        ? wildcardPath + "*"
                        : wildcardPath + "/*";
                }
                if (!addedGroupWildcards.has(wildcardPath)) {
                    addedGroupWildcards.add(wildcardPath);
                    const parsed = normalizeXtrsRules(r.groupRateLimit);
                    if (parsed.length > 0) {
                        routeRules.push({
                            path: wildcardPath,
                            methods: [],
                            rules: parsed.map((rule) => ({
                                max: rule.max,
                                windowMs: rule.windowMs,
                                message:
                                    typeof rule.message === "string"
                                        ? rule.message
                                        : rule.message
                                        ? XStringify(rule.message)
                                        : undefined,
                                statusCode: rule.statusCode || 429,
                                blockDurationMs: rule.blockDurationMs || rule.windowMs,
                            })),
                            message:
                                typeof r.groupRateLimit === "object"
                                    ? typeof r.groupRateLimit.message === "string"
                                        ? r.groupRateLimit.message
                                        : r.groupRateLimit.message
                                        ? XStringify(r.groupRateLimit.message)
                                        : undefined
                                    : undefined,
                            statusCode:
                                typeof r.groupRateLimit === "object"
                                    ? r.groupRateLimit.statusCode
                                    : undefined,
                        });
                    }
                }
            }
        });

        // Pass 2: Add individual route rate limits override
        routes.forEach((r: any) => {
            if (r.rateLimit && r.rateLimit !== r.groupRateLimit) {
                const parsed = normalizeXtrsRules(r.rateLimit);
                if (parsed.length > 0) {
                    routeRules.push({
                        path: r.path,
                        methods: r.method ? [r.method] : [],
                        rules: parsed.map((rule) => ({
                            max: rule.max,
                            windowMs: rule.windowMs,
                            message:
                                typeof rule.message === "string"
                                    ? rule.message
                                    : rule.message
                                    ? XStringify(rule.message)
                                    : undefined,
                            statusCode: rule.statusCode || 429,
                            blockDurationMs: rule.blockDurationMs || rule.windowMs,
                        })),
                        message:
                            typeof r.rateLimit === "object"
                                ? typeof r.rateLimit.message === "string"
                                    ? r.rateLimit.message
                                    : r.rateLimit.message
                                    ? XStringify(r.rateLimit.message)
                                    : undefined
                                : undefined,
                        statusCode:
                            typeof r.rateLimit === "object"
                                ? r.rateLimit.statusCode
                                : undefined,
                    });
                }
            }
        });
    }

    if (hasGlobalRl || routeRules.length > 0) {
        if (!args.includes("--rate-limit")) {
            args.push("--rate-limit");
        }

        if (hasGlobalRl && typeof rl === "object") {
            const xtrsRules = normalizeXtrsRules(rl);
            if (xtrsRules.length > 0) {
                const primaryRule = xtrsRules[0];
                const effectiveWindowMs =
                    primaryRule.blockDurationMs ?? primaryRule.windowMs;
                args.push("--rate-limit-max", primaryRule.max.toString());
                args.push("--rate-limit-window", effectiveWindowMs.toString());
            } else {
                if (rl.max !== undefined)
                    args.push("--rate-limit-max", rl.max.toString());
                if (rl.windowMs !== undefined)
                    args.push("--rate-limit-window", rl.windowMs.toString());
            }

            const primaryRule = xtrsRules.length > 0 ? xtrsRules[0] : undefined;
            const effectiveMessage =
                primaryRule?.message ??
                (typeof rl.xtrs === "object" ? rl.xtrs?.message : undefined) ??
                rl.message;
            if (effectiveMessage)
                args.push(
                    "--rate-limit-message",
                    typeof effectiveMessage === "string"
                        ? effectiveMessage
                        : XStringify(effectiveMessage),
                );
            if (rl.standardHeaders) args.push("--rate-limit-headers");
            if (rl.legacyHeaders) args.push("--rate-limit-legacy-headers");
            if (Array.isArray(rl.excludePaths) && rl.excludePaths.length > 0) {
                const strExcludes = rl.excludePaths
                    .map((p: any) =>
                        p instanceof RegExp ? `RE:${p.source}` : p,
                    )
                    .join(",");
                if (strExcludes) args.push("--rate-limit-exclude", strExcludes);
            }
        }

        if (routeRules.length > 0) {
            const configObj = {
                enabled: true,
                standardHeaders: rl?.standardHeaders !== false,
                legacyHeaders: !!rl?.legacyHeaders,
                routes: routeRules,
            };
            const jsonStr = JSON.stringify(configObj);
            const b64 = Buffer.from(jsonStr).toString("base64");
            args.push("--rate-limit-config", b64);
        }
    }
}
