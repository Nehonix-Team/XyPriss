import { Logger } from "../../../shared/logger/Logger";
import {
    Route,
    XyPrisRequest,
    MiddlewareFunction,
    RouteHandler,
} from "../../../types/httpServer.type";

/**
 * RouteManager - Handles route registration and matching.
 */
export class RouteManager {
    private routes: Route[] = [];
    private logger: Logger;

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

        this.routes.push({ method, path: normalizedPath, handler, middleware });
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
        this.routes.push({ method, path, handler, middleware, paramNames });
    }


    public findRoute(
        method: string,
        path: string,
        req: XyPrisRequest,
    ): Route | null {
        for (const route of this.routes) {
            if (route.method !== method) continue;

            // 1. RegExp matching (highest precision, supports constraints/wildcards)
            if (route.path instanceof RegExp) {
                const match = route.path.exec(path);
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
            // 2. String matching (fallback for simple static or basic parameterized paths)
            else if (typeof route.path === "string") {
                // If path contains complex markers, it MUST be matched via RegExp (handled above)
                // If it reached here as a string, it might be a simple path or a legacy fallback
                if (
                    route.path.includes("(") ||
                    route.path.includes("<") ||
                    route.path.includes("**")
                ) {
                    continue; // Skip naive matching for complex routes
                }

                const params = this.matchPath(route.path, path);
                if (params !== null) {
                    req.params = { ...req.params, ...params };
                    return route;
                }
            }
        }
        return null;
    }

    private matchPath(
        routePath: string,
        requestPath: string,
    ): Record<string, string> | null {
        if (routePath === requestPath) return {};

        // Final sanity check: if it has complex markers, matchPath is NOT safe
        if (
            routePath.includes("(") ||
            routePath.includes("<") ||
            routePath.includes("**")
        ) {
            return null;
        }

        const routeParts = routePath.split("/");
        const requestParts = requestPath.split("/");
        if (routeParts.length !== requestParts.length) return null;

        const params: Record<string, string> = {};
        for (let i = 0; i < routeParts.length; i++) {
            const rp = routeParts[i];
            const qp = requestParts[i];

            if (rp.startsWith(":")) {
                const paramName = rp.substring(1);
                // Ensure paramName doesn't contain type metadata (double protection)
                if (paramName.includes("<") || paramName.includes("(")) {
                    return null;
                }
                params[paramName] = qp;
            } else if (rp !== qp) {
                return null;
            }
        }
        return params;
    }

    public getRoutes(): Route[] {
        return [...this.routes];
    }
}

