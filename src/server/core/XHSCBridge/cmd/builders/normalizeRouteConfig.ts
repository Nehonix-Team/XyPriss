import type { globMRConf } from "../../../../../types/mod/security";

export function normalizeRouteConfig(
    routes: globMRConf[] | undefined,
): any[] | undefined {
    if (!routes || !Array.isArray(routes)) return undefined;
    return routes
        .map((r: any) => {
            if (typeof r === "string") return { path: r };
            if (r instanceof RegExp) return { path: r.source, isRegex: true };
            if (r && r.path) {
                if (r.path instanceof RegExp) {
                    return {
                        path: r.path.source,
                        isRegex: true,
                        methods: r.methods,
                    };
                }
                return { path: r.path, methods: r.methods };
            }
            return r;
        })
        .filter(Boolean);
}
