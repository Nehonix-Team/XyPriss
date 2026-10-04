import { Logger } from "../../../shared/logger/Logger";
import {
    Route,
    XyPrisRequest,
    MiddlewareFunction,
    RouteHandler,
} from "../../../types/httpServer.type";

interface ParamSegment {
    paramName: string;
}

interface PrecompiledRoute {
    route: Route;
    segments: (string | ParamSegment)[];
    segmentCount: number;
}

/**
 * RouteManager - High-performance route registration and O(1)/indexed matching engine.
 */
export class RouteManager {
    private routes: Route[] = [];
    private logger: Logger;

    // Fast-path index structures
    private staticRoutes = new Map<string, Route>();
    private paramRoutesByLength = new Map<string, PrecompiledRoute[]>();
    private regexRoutes: Route[] = [];

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public addRoute(
        method: string,
        path: string | RegExp,
        handlers: (MiddlewareFunction | RouteHandler)[],
    ): void {
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;

        let normalizedPath = path;
        if (
            typeof normalizedPath === "string" &&
            normalizedPath.length > 1 &&
            normalizedPath.endsWith("/")
        ) {
            normalizedPath = normalizedPath.slice(0, -1);
        }

        const route: Route = { method, path: normalizedPath, handler, middleware };
        this.routes.push(route);

        // Pre-compile into fast indexing structures
        if (typeof normalizedPath === "string") {
            const isParametric = normalizedPath.includes(":");
            const isComplex =
                normalizedPath.includes("(") ||
                normalizedPath.includes("<") ||
                normalizedPath.includes("**") ||
                normalizedPath.includes("*");

            if (!isParametric && !isComplex) {
                // Static O(1) Fast Path
                this.staticRoutes.set(`${method}:${normalizedPath}`, route);
            } else if (isParametric && !isComplex) {
                // Parametric indexed path
                const parts = normalizedPath.split("/").filter(Boolean);
                const segments: (string | ParamSegment)[] = new Array(parts.length);
                for (let i = 0; i < parts.length; i++) {
                    const p = parts[i];
                    if (p.charCodeAt(0) === 58 /* ':' */) {
                        segments[i] = { paramName: p.substring(1) };
                    } else {
                        segments[i] = p;
                    }
                }
                const key = `${method}:${parts.length}`;
                const list = this.paramRoutesByLength.get(key) || [];
                list.push({
                    route,
                    segments,
                    segmentCount: parts.length,
                });
                this.paramRoutesByLength.set(key, list);
            }
        } else if (normalizedPath instanceof RegExp) {
            this.regexRoutes.push(route);
        }

        this.logger.debug(
            "server",
            `Route registered: ${method} ${normalizedPath}`,
        );
    }

    public addRouteWithParams(
        method: string,
        path: RegExp,
        paramNames: string[],
        handlers: (MiddlewareFunction | RouteHandler)[],
    ): void {
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;
        const route: Route = { method, path, handler, middleware, paramNames };
        this.routes.push(route);
        this.regexRoutes.push(route);
    }

    public findRoute(
        method: string,
        path: string,
        req: XyPrisRequest,
    ): Route | null {
        // 1. Exact Match Fast Path (O(1) Map Lookup — 0 allocations)
        const staticKey = `${method}:${path}`;
        const exact = this.staticRoutes.get(staticKey);
        if (exact) {
            return exact;
        }

        // 2. Tokenized Parametric Matching (Indexed by Segment Count)
        const len = path.length;
        if (len > 0) {
            // Extract segments in single pass
            const reqSegments: string[] = [];
            let start = path.charCodeAt(0) === 47 /* '/' */ ? 1 : 0;
            for (let i = start; i <= len; i++) {
                if (i === len || path.charCodeAt(i) === 47) {
                    if (i > start) {
                        reqSegments.push(path.substring(start, i));
                    }
                    start = i + 1;
                }
            }

            const candidates = this.paramRoutesByLength.get(`${method}:${reqSegments.length}`);
            if (candidates) {
                const segCount = reqSegments.length;
                for (let c = 0; c < candidates.length; c++) {
                    const item = candidates[c];
                    const segs = item.segments;
                    let match = true;
                    let params: Record<string, string> | null = null;

                    for (let s = 0; s < segCount; s++) {
                        const expected = segs[s];
                        const actual = reqSegments[s];
                        if (typeof expected === "string") {
                            if (expected !== actual) {
                                match = false;
                                break;
                            }
                        } else {
                            if (!params) params = {};
                            params[expected.paramName] = actual;
                        }
                    }

                    if (match) {
                        if (params) {
                            req.params = { ...req.params, ...params };
                        }
                        return item.route;
                    }
                }
            }
        }

        // 3. Regular Expression Fallback
        for (let r = 0; r < this.regexRoutes.length; r++) {
            const route = this.regexRoutes[r];
            if (route.method !== method) continue;

            const match = (route.path as RegExp).exec(path);
            if (match) {
                const params: Record<string, string> = {};
                if (match.length > 1 && route.paramNames) {
                    for (let i = 1; i < match.length; i++) {
                        if (
                            match[i] !== undefined &&
                            route.paramNames[i - 1]
                        ) {
                            params[route.paramNames[i - 1]] = match[i];
                        }
                    }
                } else if (match.length > 1 && match[1] !== undefined) {
                    params["*"] = match[1];
                }
                req.params = { ...req.params, ...params };
                return route;
            }
        }

        return null;
    }

    public getRoutes(): Route[] {
        return [...this.routes];
    }
}
