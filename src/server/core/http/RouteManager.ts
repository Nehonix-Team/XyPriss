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

    public addStaticRoute(path: string, filePath: string): void {
        this.routes.push({
            method: "GET",
            path,
            handler: (_req, res) =>
                res.status(501).send("Static handled by Rust"),
            middleware: [],
            target: "static",
            filePath,
        });
    }

    public findRoute(
        method: string,
        path: string,
        req: XyPrisRequest,
    ): Route | null {
        for (const route of this.routes) {
            if (route.method !== method) continue;
            if (typeof route.path === "string") {
                const params = this.matchPath(route.path, path);
                if (params !== null) {
                    req.params = { ...req.params, ...params };
                    return route;
                }
            } else if (route.path instanceof RegExp) {
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
        }
        return null;
    }

    private matchPath(
        routePath: string,
        requestPath: string,
    ): Record<string, string> | null {
        if (routePath === requestPath) return {};
        const routeParts = routePath.split("/");
        const requestParts = requestPath.split("/");
        if (routeParts.length !== requestParts.length) return null;
        const params: Record<string, string> = {};
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(":")) {
                params[routeParts[i].substring(1)] = requestParts[i];
            } else if (routeParts[i] !== requestParts[i]) {
                return null;
            }
        }
        return params;
    }

    public getRoutes(): Route[] {
        return [...this.routes];
    }
}

