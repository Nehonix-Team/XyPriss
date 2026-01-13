/**
 * XyPrisHttpServer - Express-free HTTP server implementation
 *
 * This module provides a XyPris HTTP server that replaces Express with
 * direct Node.js HTTP handling for maximum performance and control.
 * It maintains API compatibility while removing Express overhead.
 */

import {
    IncomingMessage,
    ServerResponse,
    createServer as createHttpServer,
    Server,
} from "http";
import { parse as parseUrl } from "url";
import { parse as parseQuery } from "querystring";
import { Logger } from "../../../shared/logger/Logger";
import { TrustProxy, TrustProxyValue } from "../utils/trustProxy";
import { MiddlewareManager } from "../middleware/MiddlewareManager";
import { NotFoundHandler } from "../handlers/NotFoundHandler";
import { XyPrisRequestApp } from "./RequestApp";
import { ResponseEnhancer } from "./ResponseEnhancer";
import { RequestEnhancer } from "./RequestEnhancer";
import {
    MiddlewareFunction,
    Route,
    XyPrisRequest,
    NextFunction,
    RouteHandler,
    XyPrisResponse,
} from "../../types/httpServer.type";
import { ServerOptions } from "../../types/types";
import { NotFoundConfig } from "../../types/NotFoundConfig";

/**
 * XyPrissHttpServer - XPris HTTP server implementation
 */
export class XyPrissHttpServer {
    private server: Server;
    private routes: Route[] = [];
    private middlewareManager: MiddlewareManager;
    private logger: Logger;
    private notFoundHandler: NotFoundHandler;
    private trustProxy: TrustProxy;
    private responseEnhancer: ResponseEnhancer;
    private requestEnhancer: RequestEnhancer;
    private responseControl?: ServerOptions["responseControl"];
    private errorHandler?: (
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: NextFunction
    ) => void;
    private app?: any;

    constructor(logger: Logger) {
        this.logger = logger;
        this.middlewareManager = new MiddlewareManager(logger);
        this.notFoundHandler = new NotFoundHandler();
        this.trustProxy = new TrustProxy(false); // Default: don't trust proxies
        this.responseEnhancer = new ResponseEnhancer(logger);
        this.requestEnhancer = new RequestEnhancer(logger, this.trustProxy);
        this.server = createHttpServer(this.handleRequest.bind(this));
        this.setupDefaultErrorHandler();
        this.logger.debug(
            "server",
            "[XyPrissHttpServer] Created new HTTP server with middleware manager"
        );
    }

    /**
     * Set the app instance
     */
    public setApp(app: any): void {
        this.logger.debug("server", "[HttpServer] setApp called");
        this.app = app;
    }

    /**
     * Add middleware to the server
     */
    public use(middleware: MiddlewareFunction): void;
    public use(path: string, middleware: MiddlewareFunction): void;
    public use(
        pathOrMiddleware: string | MiddlewareFunction,
        middleware?: MiddlewareFunction
    ): void {
        if (typeof pathOrMiddleware === "function") {
            this.middlewareManager.use(pathOrMiddleware);
        } else if (middleware) {
            // Path-specific middleware - wrap it to check path
            const pathMiddleware: MiddlewareFunction = (req, res, next) => {
                if (req.path.startsWith(pathOrMiddleware)) {
                    return middleware(req, res, next);
                }
                next?.();
            };
            this.middlewareManager.use(pathMiddleware, {
                name: `path_middleware_${pathOrMiddleware}`,
                description: `Path-specific middleware for ${pathOrMiddleware}`,
            });
        }
    }

    /**
     * Add HTTP method routes
     */
    public get(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("GET", path, handlers);
    }

    public post(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("POST", path, handlers);
    }

    public put(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("PUT", path, handlers);
    }

    public delete(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("DELETE", path, handlers);
    }

    public patch(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("PATCH", path, handlers);
    }

    public options(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("OPTIONS", path, handlers);
    }

    public head(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("HEAD", path, handlers);
    }

    /**
     * Add a route with middleware and handler
     */
    private addRoute(
        method: string,
        path: string | RegExp,
        handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;

        this.routes.push({
            method,
            path,
            handler,
            middleware,
        });

        // Debug logging
        this.logger.debug(
            "server",
            `Route registered: ${method} ${path} (Total routes: ${this.routes.length})`
        );
    }

    /**
     * Add a route with parameter names (for RegExp routes from router)
     */
    public addRouteWithParams(
        method: string,
        path: RegExp,
        paramNames: string[],
        handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;

        this.routes.push({
            method,
            path,
            handler,
            middleware,
            paramNames,
        });

        // Debug logging
        this.logger.debug(
            "server",
            `Route registered with params: ${method} ${path} (params: ${paramNames.join(
                ", "
            )}) (Total routes: ${this.routes.length})`
        );
    }

    /**
     * Configure trust proxy settings
     */
    public setTrustProxy(config: TrustProxyValue): void {
        this.trustProxy = new TrustProxy(config);
        this.logger.debug(
            "server",
            `Trust proxy configured: ${
                typeof config === "function"
                    ? "custom function"
                    : JSON.stringify(config)
            }`
        );
    }

    /**
     * Start the server
     */
    public listen(port: number, host: string, callback?: () => void): Server {
        this.logger.debug("server", `listen() called: ${host}:${port}`);
        return this.server.listen(port, host, callback);
    }

    /**
     * Handle incoming HTTP requests
     * Made public for XHSC IPC integration
     */
    public async handleRequest(
        req: IncomingMessage,
        res: ServerResponse
    ): Promise<void> {
        this.logger.debug(
            "server",
            `===== HANDLING REQUEST: ${req.method} ${req.url} =====`
        );

        // Track response time
        const startTime = process.hrtime();

        let XyPrisReq: XyPrisRequest;
        let XyPrisRes: XyPrisResponse;

        try {
            XyPrisReq = this.enhanceRequest(req);
            XyPrisRes = this.enhanceResponse(res, XyPrisReq);
        } catch (error) {
            this.logger.error("server", `Failed to enhance request: ${error}`);
            // Send error response and return early
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({
                    error: "Bad Request",
                    message: "Invalid URL format",
                })
            );
            return;
        }

        // Wrap res.end to calculate and report response time
        const originalEnd = res.end;
        res.end = (chunk?: any, encoding?: any, cb?: any) => {
            if (res.writableEnded) {
                this.logger.error(
                    "server",
                    `[HttpServer] Attempted to send response after it was already finished (${XyPrisReq.method} ${XyPrisReq.path}). ` +
                        "This usually happens when a plugin calls res.send() and then calls next()."
                );
                return res;
            }

            this.logger.debug("server", "[HttpServer] res.end called");
            const diff = process.hrtime(startTime);
            const responseTimeMs = (diff[0] * 1e9 + diff[1]) / 1e6;

            // Trigger response time hook
            const pluginManager = this.app?.pluginManager;
            if (
                pluginManager &&
                typeof pluginManager.triggerResponseTime === "function"
            ) {
                pluginManager.triggerResponseTime(
                    responseTimeMs,
                    XyPrisReq,
                    XyPrisRes
                );
            }

            return originalEnd.call(res, chunk, encoding, cb);
        };

        try {
            // Parse request body for POST/PUT/PATCH requests (skip multipart/form-data)
            if (["POST", "PUT", "PATCH"].includes(XyPrisReq.method)) {
                const contentType = XyPrisReq.headers["content-type"] || "";
                if (!contentType.includes("multipart/form-data")) {
                    await this.parseBody(XyPrisReq);
                }
            }

            // Execute middleware chain using MiddlewareManager
            this.logger.debug("server", `Executing middleware chain...`);
            const middlewareChainCompleted =
                await this.middlewareManager.execute(XyPrisReq, XyPrisRes);

            if (!middlewareChainCompleted) {
                this.logger.debug(
                    "server",
                    `Middleware chain was stopped - not executing route handler`
                );
                return; // Stop processing if middleware chain was stopped
            }

            this.logger.debug(
                "server",
                `Middleware chain completed, looking for routes...`
            );

            // Find and execute matching route
            const route = this.findRoute(
                XyPrisReq.method,
                XyPrisReq.path,
                XyPrisReq
            );
            this.logger.debug(
                "server",
                `Route found:`,
                route ? `${route.method} ${route.path}` : "null"
            );
            if (route) {
                // Execute route-specific middleware
                for (const middleware of route.middleware) {
                    this.logger.debug(
                        "server",
                        `Executing middleware: ${middleware}`
                    );
                    await this.executeMiddlewareFunction(
                        middleware,
                        XyPrisReq,
                        XyPrisRes
                    );
                }

                // Execute route handler
                if (!XyPrisRes.writableEnded) {
                    await route.handler(XyPrisReq, XyPrisRes);
                } else {
                    this.logger.warn(
                        "server",
                        `Response already finalized by middleware or plugin for ${XyPrisReq.method} ${XyPrisReq.path}. Skipping further processing.`
                    );
                }
            } else {
                // No route found - 404
                if (!XyPrisRes.writableEnded) {
                    await this.send404(XyPrisReq, XyPrisRes);
                }
            }
        } catch (error) {
            this.handleError(error, XyPrisReq, XyPrisRes);
        }
    }

    /**
     * Enhance the request object with Express-like properties
     */
    private enhanceRequest(req: IncomingMessage): XyPrisRequest {
        return this.requestEnhancer.enhance(req, this.app);
    }

    /**
     * Enhance the response object with Express-like methods
     */
    private enhanceResponse(
        res: ServerResponse,
        req: XyPrisRequest
    ): XyPrisResponse {
        return this.responseEnhancer.enhance(res, req);
    }

    /**
     * Parse request body
     */
    private async parseBody(req: XyPrisRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const contentType = req.headers["content-type"] || "";

            // Skip parsing for multipart/form-data - let middleware handle it
            if (contentType.includes("multipart/form-data")) {
                resolve();
                return;
            }

            let body = "";
            req.on("data", (chunk) => {
                body += chunk.toString();
            });

            req.on("end", () => {
                try {
                    if (contentType.includes("application/json")) {
                        req.body = body ? JSON.parse(body) : {};
                    } else if (
                        contentType.includes(
                            "application/x-www-form-urlencoded"
                        )
                    ) {
                        req.body = parseQuery(body);
                    } else {
                        req.body = body;
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            req.on("error", reject);
        });
    }

    /**
     * Execute a single middleware function
     */
    private async executeMiddlewareFunction(
        middleware: MiddlewareFunction,
        req: XyPrisRequest,
        res: XyPrisResponse
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let nextCalled = false;

            const next: NextFunction = (error?: any) => {
                if (nextCalled) return;
                nextCalled = true;

                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            };

            try {
                const result = middleware(req, res, next);
                if (result instanceof Promise) {
                    result.catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Find matching route
     */
    private findRoute(
        method: string,
        path: string,
        req: XyPrisRequest
    ): Route | null {
        this.logger.debug(
            "server",
            `Looking for route: ${method} ${path} (${this.routes.length} routes available)`
        );

        for (const route of this.routes) {
            this.logger.debug(
                "server",
                `Checking route: ${route.method} ${
                    route.path
                } (type: ${typeof route.path})`
            );
            if (route.method !== method) continue;

            if (typeof route.path === "string") {
                const params = this.matchPath(route.path, path);
                if (params !== null) {
                    // Add extracted parameters to request
                    req.params = { ...req.params, ...params };
                    this.logger.debug(
                        "server",
                        `Route matched: ${method} ${route.path}`
                    );
                    return route;
                }
                this.logger.debug(
                    "server",
                    `Route did not match: ${method} ${route.path}`
                );
            } else if (route.path instanceof RegExp) {
                this.logger.debug(
                    "server",
                    `Testing RegExp: ${route.path} against ${path}`
                );
                const match = route.path.exec(path);
                this.logger.debug("server", `RegExp match result:`, match);
                if (match) {
                    // Extract parameters from regex groups using parameter names if available
                    const params: Record<string, string> = {};

                    // If there are capture groups, add them as parameters
                    if (match.length > 1 && route.paramNames) {
                        // Use parameter names from route definition
                        for (let i = 1; i < match.length; i++) {
                            if (
                                match[i] !== undefined &&
                                route.paramNames[i - 1]
                            ) {
                                const paramName = route.paramNames[i - 1];
                                params[paramName] = match[i];
                                this.logger.debug(
                                    "server",
                                    `Extracted param: ${paramName} = ${match[i]}`
                                );
                            }
                        }
                    } else if (match.length > 1) {
                        // Fallback to generic parameter names if no paramNames available
                        if (match[1] !== undefined) {
                            params["*"] = match[1];
                        }
                        // Add other captured groups as numbered parameters
                        for (let i = 2; i < match.length; i++) {
                            if (match[i] !== undefined) {
                                this.logger.debug(
                                    "server",
                                    `Extracted param: param${i - 1} = ${
                                        match[i]
                                    }`
                                );
                                params[`param${i - 1}`] = match[i];
                            }
                        }
                    }

                    // Add extracted parameters to request
                    req.params = { ...req.params, ...params };

                    this.logger.debug(
                        "routing",
                        `Route matched (regex): ${method} ${
                            route.path
                        } with params: ${JSON.stringify(params)}`
                    );
                    return route;
                }
            }
        }

        this.logger.debug("server", `No route found for: ${method} ${path}`);
        return null;
    }

    /**
     * Match path with parameters
     */
    private matchPath(
        routePath: string,
        requestPath: string
    ): Record<string, string> | null {
        // Simple path matching - exact match
        if (routePath === requestPath) return {};

        this.logger.debug(
            "server",
            "[HttpServer] matchPath:",
            routePath,
            requestPath
        );

        // Handle parameters (:param)
        const routeParts = routePath.split("/");
        const requestParts = requestPath.split("/");

        if (routeParts.length !== requestParts.length) return null;

        const params: Record<string, string> = {};

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];
            this.logger.debug(
                "server",
                `[HttpServer] matchPath: Comparing ${routePart} with ${requestPart}`
            );

            if (routePart.startsWith(":")) {
                this.logger.debug(
                    "server",
                    `[HttpServer] matchPath: Found parameter ${routePart} with value ${requestPart}`
                );
                // Parameter - extract value
                const paramName = routePart.substring(1);
                params[paramName] = requestPart;
            } else if (routePart !== requestPart) {
                return null;
            }
        }

        return params;
    }

    /**
     * Send 404 response using responseControl or NotFoundHandler
     */
    private async send404(
        req: XyPrisRequest,
        res: XyPrisResponse
    ): Promise<void> {
        // Check if custom response control is configured
        if (this.responseControl?.enabled) {
            try {
                this.logger.debug(
                    "server",
                    "[HttpServer] send404: Custom response control enabled"
                );
                // Set status code
                const statusCode = this.responseControl.statusCode || 404;
                res.statusCode = statusCode;

                // Set custom headers
                if (this.responseControl.headers) {
                    res.set(this.responseControl.headers);
                }

                // Set content type
                if (this.responseControl.contentType) {
                    this.logger.debug(
                        "server",
                        "[HttpServer] send404: Setting content type to " +
                            this.responseControl.contentType
                    );
                    res.setHeader(
                        "Content-Type",
                        this.responseControl.contentType
                    );
                }

                // Use custom handler if provided
                if (this.responseControl.handler) {
                    this.logger.debug(
                        "server",
                        "[HttpServer] send404: Using custom handler"
                    );
                    await this.responseControl.handler(req, res);
                    return;
                }

                // Send custom content
                if (this.responseControl.content !== undefined) {
                    if (typeof this.responseControl.content === "object") {
                        res.json(this.responseControl.content);
                    } else {
                        res.send(this.responseControl.content);
                    }
                    return;
                }

                // Default content if no custom content provided
                res.send(`Route not found: ${req.method} ${req.path}`);
            } catch (error) {
                this.logger.error(
                    "server",
                    `Error in custom response control: ${error}`
                );
                // Fall back to default 404
                this.notFoundHandler.handler(req as any, res as any);
            }
        } else {
            // Use the NotFoundHandler to send a beautiful 404 page
            this.notFoundHandler.handler(req as any, res as any);
        }
    }

    /**
     * Handle errors during request processing
     */
    private handleError(
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse
    ): void {
        this.logger.error("server", `Request error: ${error.message}`, error);

        // Trigger route error hook for 500 errors
        const pluginManager = this.app?.pluginManager;
        this.logger.debug(
            "server",
            `[HttpServer] handleError. PluginManager found: ${!!pluginManager}`
        );
        if (
            pluginManager &&
            typeof pluginManager.triggerRouteError === "function"
        ) {
            pluginManager.triggerRouteError(error, req, res);
        }

        if (this.errorHandler) {
            this.errorHandler(error, req, res, () => {
                if (!res.writableEnded) {
                    this.sendErrorResponse(res, 500, "Internal Server Error");
                }
            });
        } else {
            this.sendErrorResponse(res, 500, "Internal Server Error");
        }
    }

    /**
     * Sends an error response if headers have not already been sent.
     */
    private sendErrorResponse(
        res: XyPrisResponse,
        statusCode: number,
        message: string
    ): void {
        if (!res.headersSent) {
            res.status(statusCode).json({ error: message });
        }
    }

    /**
     * Set error handler
     */
    public setErrorHandler(
        handler: (
            error: any,
            req: XyPrisRequest,
            res: XyPrisResponse,
            next: NextFunction
        ) => void
    ): void {
        this.errorHandler = handler;
    }

    /**
     * Setup default error handler
     */
    private setupDefaultErrorHandler(): void {
        this.server.on("error", (error) => {
            this.logger.error("server", `Server error: ${error.message}`);
        });
    }

    /**
     * Get the underlying HTTP server
     */
    public getServer(): Server {
        return this.server;
    }

    /**
     * Close the server
     */
    public close(callback?: (err?: Error) => void): void {
        this.server.close(callback);
    }

    /**
     * Get server address
     */
    public address(): any {
        return this.server.address();
    }

    /**
     * Get all registered routes
     */
    public getRoutes(): Route[] {
        return [...this.routes];
    }

    /**
     * Set custom notFound handler
     */
    public setNotFoundHandler(config: NotFoundConfig): void {
        this.notFoundHandler.updateConfig(config);
    }

    /**
     * Set custom response control configuration
     */
    public setResponseControl(config: ServerOptions["responseControl"]): void {
        this.responseControl = config;
        this.logger.debug(
            "server",
            `Response control configured: ${
                config?.enabled ? "enabled" : "disabled"
            }`
        );
    }
}

