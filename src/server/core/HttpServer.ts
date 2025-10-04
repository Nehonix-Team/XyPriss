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
import { MiddlewareManager } from "../middleware/MiddlewareManager";
import { NotFoundHandler } from "../handlers/NotFoundHandler";
import {
    MiddlewareFunction,
    Route,
    XyPrisRequest,
    NextFunction,
    RouteHandler,
    XyPrisResponse,
} from "../../types/httpServer.type";

/**
 * XyPrissHttpServer - XPris HTTP server implementation
 */
export class XyPrissHttpServer {
    private server: Server;
    private routes: Route[] = [];
    private middlewareManager: MiddlewareManager;
    private logger: Logger;
    private notFoundHandler: NotFoundHandler;
    private errorHandler?: (
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: NextFunction
    ) => void;

    constructor(logger: Logger) {
        this.logger = logger;
        this.middlewareManager = new MiddlewareManager(logger);
        this.notFoundHandler = new NotFoundHandler();
        this.server = createHttpServer(this.handleRequest.bind(this));
        this.setupDefaultErrorHandler();
        this.logger.debug(
            "server",
            "[XyPrissHttpServer] Created new HTTP server with middleware manager"
        );
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
     * Start the server
     */
    public listen(port: number, host: string, callback?: () => void): Server {
        this.logger.debug("server", `listen() called: ${host}:${port}`);
        return this.server.listen(port, host, callback);
    }

    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(
        req: IncomingMessage,
        res: ServerResponse
    ): Promise<void> {
        this.logger.debug("server", 
            `===== HANDLING REQUEST: ${req.method} ${req.url} =====`
        );
        const XyPrisReq = this.enhanceRequest(req);
        const XyPrisRes = this.enhanceResponse(res);

        try {
            // Parse request body for POST/PUT/PATCH requests
            if (["POST", "PUT", "PATCH"].includes(XyPrisReq.method)) {
                await this.parseBody(XyPrisReq);
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

            this.logger.debug("server", `Middleware chain completed, looking for routes...`);

            // Find and execute matching route
            const route = this.findRoute(
                XyPrisReq.method,
                XyPrisReq.path,
                XyPrisReq
            );
            this.logger.debug("server", 
                `Route found:`,
                route ? `${route.method} ${route.path}` : "null"
            );
            if (route) {
                // Execute route-specific middleware
                for (const middleware of route.middleware) {
                    await this.executeMiddlewareFunction(
                        middleware,
                        XyPrisReq,
                        XyPrisRes
                    );
                }

                // Execute route handler
                await route.handler(XyPrisReq, XyPrisRes);
            } else {
                // No route found - 404
                this.send404(XyPrisReq, XyPrisRes);
            }
        } catch (error) {
            this.handleError(error, XyPrisReq, XyPrisRes);
        }
    }

    /**
     * Enhance the request object with Express-like properties
     */
    private enhanceRequest(req: IncomingMessage): XyPrisRequest {
        const parsedUrl = parseUrl(req.url || "", true);

        const XyPrisReq = req as XyPrisRequest;
        XyPrisReq.params = {};
        XyPrisReq.query = parsedUrl.query || {};
        XyPrisReq.body = {};
        XyPrisReq.path = parsedUrl.pathname || "/";
        XyPrisReq.originalUrl = req.url || "";
        XyPrisReq.baseUrl = "";
        XyPrisReq.method = req.method || "GET";

        // Express compatibility properties
        XyPrisReq.ip = this.getClientIP(req);
        XyPrisReq.ips = [XyPrisReq.ip];
        XyPrisReq.cookies = this.parseCookies(req.headers.cookie || "");
        XyPrisReq.app = {
            get: (key: string) => {
                // Simple app settings storage
                const settings: Record<string, any> = {
                    "trust proxy": false,
                    "x-powered-by": false,
                };
                return settings[key];
            },
            set: (key: string, value: any) => {
                // Simple app settings storage (could be enhanced)
                this.logger.debug("server", `App setting: ${key} = ${value}`);
            },
        };

        // Additional Express-like properties
        XyPrisReq.protocol =
            (req.headers["x-forwarded-proto"] as string) || "http";
        XyPrisReq.secure = XyPrisReq.protocol === "https";
        XyPrisReq.hostname = req.headers.host?.split(":")[0] || "localhost";
        XyPrisReq.subdomains = XyPrisReq.hostname.split(".").slice(0, -2);
        XyPrisReq.fresh = false; // Could be implemented based on cache headers
        XyPrisReq.stale = true;
        XyPrisReq.xhr = req.headers["x-requested-with"] === "XMLHttpRequest";

        return XyPrisReq;
    }

    /**
     * Get client IP address from request
     */
    private getClientIP(req: IncomingMessage): string {
        // Check for forwarded headers first
        const forwarded = req.headers["x-forwarded-for"] as string;
        if (forwarded) {
            return forwarded.split(",")[0].trim();
        }

        const realIP = req.headers["x-real-ip"] as string;
        if (realIP) {
            return realIP;
        }

        // Fallback to socket remote address
        return req.socket.remoteAddress || "127.0.0.1";
    }

    /**
     * Parse cookies from cookie header
     */
    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};

        if (!cookieHeader) {
            return cookies;
        }

        cookieHeader.split(";").forEach((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            if (name && rest.length > 0) {
                cookies[name] = rest.join("=");
            }
        });

        return cookies;
    }

    /**
     * Enhance the response object with Express-like methods
     */
    private enhanceResponse(res: ServerResponse): XyPrisResponse {
        const XyPrisRes = res as XyPrisResponse;
        XyPrisRes.locals = {};

        // JSON response method
        XyPrisRes.json = (data: any) => {
            XyPrisRes.setHeader("Content-Type", "application/json");
            XyPrisRes.end(JSON.stringify(data));
        };

        // Send method
        XyPrisRes.send = (data: any) => {
            if (typeof data === "object") {
                XyPrisRes.json(data);
            } else {
                // XyPrisRes.setHeader("Content-Type", "text/plain");
                XyPrisRes.end(String(data));
            }
        };

        // Status method
        XyPrisRes.status = (code: number) => {
            XyPrisRes.statusCode = code;
            return XyPrisRes;
        };

        // Enhanced setHeader that returns this
        const originalSetHeader = XyPrisRes.setHeader.bind(XyPrisRes);
        XyPrisRes.setHeader = (
            name: string,
            value: string | number | readonly string[]
        ) => {
            originalSetHeader(name, value);
            return XyPrisRes;
        };

        // Set method (Express-compatible)
        XyPrisRes.set = (
            field: string | Record<string, any>,
            value?: string | number | readonly string[]
        ) => {
            if (typeof field === "string" && value !== undefined) {
                XyPrisRes.setHeader(field, value);
            } else if (typeof field === "object") {
                Object.entries(field).forEach(([key, val]) => {
                    XyPrisRes.setHeader(
                        key,
                        val as string | number | readonly string[]
                    );
                });
            }
            return XyPrisRes;
        };

        // Redirect method
        XyPrisRes.redirect = (statusOrUrl: number | string, url?: string) => {
            if (typeof statusOrUrl === "number" && url) {
                XyPrisRes.statusCode = statusOrUrl;
                XyPrisRes.setHeader("Location", url);
            } else {
                XyPrisRes.statusCode = 302;
                XyPrisRes.setHeader("Location", statusOrUrl as string);
            }
            XyPrisRes.end();
        };

        // Cookie methods (basic implementation)
        XyPrisRes.cookie = (name: string, value: string, options: any = {}) => {
            let cookieString = `${name}=${value}`;
            if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
            if (options.httpOnly) cookieString += "; HttpOnly";
            if (options.secure) cookieString += "; Secure";
            if (options.sameSite)
                cookieString += `; SameSite=${options.sameSite}`;

            const existingCookies =
                (XyPrisRes.getHeader("Set-Cookie") as string[]) || [];
            existingCookies.push(cookieString);
            XyPrisRes.setHeader("Set-Cookie", existingCookies);
        };

        XyPrisRes.clearCookie = (name: string, options: any = {}) => {
            XyPrisRes.cookie(name, "", { ...options, maxAge: 0 });
        };

        return XyPrisRes;
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
        this.logger.debug("server", 
            `Looking for route: ${method} ${path} (${this.routes.length} routes available)`
        );

        for (const route of this.routes) {
            this.logger.debug("server", 
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
            } else if (route.path instanceof RegExp) {
                this.logger.debug("server", `Testing RegExp: ${route.path} against ${path}`);
                const match = route.path.exec(path);
                this.logger.debug("server", `RegExp match result:`, match);
                if (match) {
                    // Extract parameters from regex groups using parameter names if available
                    const params: Record<string, string> = {};

                    // If there are capture groups, add them as parameters
                    if (match.length > 1 && route.paramNames) {
                        // Use parameter names from route definition
                        for (let i = 1; i < match.length; i++) {
                            if (match[i] !== undefined && route.paramNames[i - 1]) {
                                const paramName = route.paramNames[i - 1];
                                params[paramName] = match[i];
                                this.logger.debug("server", `Extracted param: ${paramName} = ${match[i]}`);
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

        this.logger.debug("server", "[HttpServer] matchPath:", routePath, requestPath);

        // Handle parameters (:param)
        const routeParts = routePath.split("/");
        const requestParts = requestPath.split("/");

        if (routeParts.length !== requestParts.length) return null;

        const params: Record<string, string> = {};

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];

            if (routePart.startsWith(":")) {
                this.logger.debug("server", 
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
     * Send 404 response using NotFoundHandler
     */
    private send404(req: XyPrisRequest, res: XyPrisResponse): void {
        // Use the NotFoundHandler to send a beautiful 404 page
        this.notFoundHandler.handler(req as any, res as any);
    }

    /**
     * Handle errors
     */
    private handleError(
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse
    ): void {
        this.logger.error("server", `Request error: ${error.message}`);

        if (this.errorHandler) {
            this.errorHandler(error, req, res, () => {});
        } else {
            if (!res.headersSent) {
                res.status(500).json({ error: "Internal Server Error" });
            }
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
}

