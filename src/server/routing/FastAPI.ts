/**
 * FastAPI - Simplified API for FastRouteEngine
 * 
 * Provides a clean, declarative interface for ultra-fast route registration
 * 
 * @example
 * ```typescript
 * const api = new FastAPI();
 * 
 * // Single route
 * api.get("/users/:id<uuid>", async (req, res, ctx) => {
 *   res.json({ id: ctx.params.id });
 * });
 * 
 * // Batch routes
 * api.routes([
 *   { method: "GET", path: "/api/health", handler: healthCheck },
 *   { method: "POST", path: "/api/users", handler: createUser },
 *   { method: "GET", path: "/api/users/:id", handler: getUser }
 * ]);
 * 
 * // Route groups
 * api.group("/api/v1", (group) => {
 *   group.get("/users", listUsers);
 *   group.post("/users", createUser);
 * });
 * ```
 */

import { FastRouteEngine } from "./FastRouteEngine";
import type {
    FastRouteConfig,
    FastRouteHandler,
    FastRouteEngineOptions,
    RouteExecutionStats,
    FastAPIInterface,
    RouteGroupBuilder,
} from "../../types/FastRouteEngine.type";
import type { XyPrisRequest, XyPrisResponse } from "../../types/httpServer.type";

/**
 * Route group builder
 */
class RouteGroup implements RouteGroupBuilder {
    private prefix: string;
    private routes: FastRouteConfig[] = [];
    private groupMiddleware: FastRouteHandler[] = [];

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    /**
     * Add middleware to all routes in this group
     */
    use(...middleware: FastRouteHandler[]): this {
        this.groupMiddleware.push(...middleware);
        return this;
    }

    /**
     * Register GET route
     */
    get(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("GET", path, handlers);
    }

    /**
     * Register POST route
     */
    post(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("POST", path, handlers);
    }

    /**
     * Register PUT route
     */
    put(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("PUT", path, handlers);
    }

    /**
     * Register DELETE route
     */
    delete(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("DELETE", path, handlers);
    }

    /**
     * Register PATCH route
     */
    patch(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("PATCH", path, handlers);
    }

    /**
     * Register route for all methods
     */
    all(path: string, ...handlers: FastRouteHandler[]): this {
        const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
        for (const method of methods) {
            this.addRoute(method, path, handlers);
        }
        return this;
    }

    /**
     * Add a route to the group
     */
    private addRoute(method: string, path: string, handlers: FastRouteHandler[]): this {
        const fullPath = this.joinPaths(this.prefix, path);
        const handler = handlers[handlers.length - 1];
        const middleware = [
            ...this.groupMiddleware,
            ...handlers.slice(0, -1),
        ];

        this.routes.push({
            method,
            path: fullPath,
            handler,
            middleware,
        });

        return this;
    }

    /**
     * Join paths correctly
     */
    private joinPaths(base: string, path: string): string {
        const normalizedBase = base.replace(/\/+$/, "");
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return normalizedBase + normalizedPath;
    }

    /**
     * Get all routes in this group
     */
    getRoutes(): FastRouteConfig[] {
        return this.routes;
    }
}

/**
 * FastAPI - Simplified interface for FastRouteEngine
 */
export class FastAPI implements FastAPIInterface {
    private engine: FastRouteEngine;
    private globalMiddleware: FastRouteHandler[] = [];

    constructor(options?: FastRouteEngineOptions) {
        this.engine = new FastRouteEngine(options);
    }

    /**
     * Add global middleware
     */
    use(...middleware: FastRouteHandler[]): this {
        this.globalMiddleware.push(...middleware);
        return this;
    }

    /**
     * Register GET route
     */
    get(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("GET", path, handlers);
    }

    /**
     * Register POST route
     */
    post(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("POST", path, handlers);
    }

    /**
     * Register PUT route
     */
    put(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("PUT", path, handlers);
    }

    /**
     * Register DELETE route
     */
    delete(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("DELETE", path, handlers);
    }

    /**
     * Register PATCH route
     */
    patch(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("PATCH", path, handlers);
    }

    /**
     * Register OPTIONS route
     */
    options(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("OPTIONS", path, handlers);
    }

    /**
     * Register HEAD route
     */
    head(path: string, ...handlers: FastRouteHandler[]): this {
        return this.addRoute("HEAD", path, handlers);
    }

    /**
     * Register route for all methods
     */
    all(path: string, ...handlers: FastRouteHandler[]): this {
        const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
        for (const method of methods) {
            this.addRoute(method, path, handlers);
        }
        return this;
    }

    /**
     * Register multiple routes at once
     */
    routes(configs: FastRouteConfig[]): this {
        this.engine.batch({ routes: configs, optimize: true });
        return this;
    }

    /**
     * Create a route group with prefix
     */
    group(prefix: string, builder: (group: RouteGroup) => void): this {
        const group = new RouteGroup(prefix);
        builder(group);
        
        const routes = group.getRoutes();
        this.engine.batch({ routes, optimize: true });
        
        return this;
    }

    /**
     * Register single route with full configuration
     */
    route(config: FastRouteConfig): this {
        this.engine.route(config);
        return this;
    }

    /**
     * Add a single route
     */
    private addRoute(method: string, path: string, handlers: FastRouteHandler[]): this {
        const handler = handlers[handlers.length - 1];
        const middleware = [
            ...this.globalMiddleware,
            ...handlers.slice(0, -1),
        ];

        this.engine.route({
            method,
            path,
            handler,
            middleware,
        });

        return this;
    }

    /**
     * Execute a route
     */
    async execute(
        method: string,
        path: string,
        req: XyPrisRequest,
        res: XyPrisResponse
    ): Promise<boolean> {
        return this.engine.execute(method, path, req, res);
    }

    /**
     * Optimize routes based on access patterns
     */
    optimize(): this {
        this.engine.optimize();
        return this;
    }

    /**
     * Get execution statistics
     */
    getStats(): RouteExecutionStats {
        return this.engine.getStats();
    }

    /**
     * Clear all routes
     */
    clear(): this {
        this.engine.clear();
        return this;
    }

    /**
     * Get the underlying engine
     */
    getEngine(): FastRouteEngine {
        return this.engine;
    }
}
