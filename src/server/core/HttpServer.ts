/**
 * XyPrisHttpServer - Express-free HTTP server implementation
 *
 * This module provides a XyPris HTTP server that replaces Express with
 * direct Node.js HTTP handling for maximum performance and control.
 * It maintains API compatibility while removing Express overhead.
 */

import type { Server } from "http";
import { EventEmitter } from "events";
import { Logger } from "../../../shared/logger/Logger";
import { TrustProxy, TrustProxyValue } from "../utils/trustProxy";
import { MiddlewareManager } from "../middleware/MiddlewareManager";
import { NotFoundHandler } from "../handlers/NotFoundHandler";
import { XyPrisRequestApp } from "./RequestApp";
import { ResponseEnhancer } from "./ResponseEnhancer";
import { RequestEnhancer } from "./RequestEnhancer";
import { XHSCBridge } from "./XHSCBridge";
import { XyprissApp } from "./XyprissApp";
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
import { XVS as VirtualServer } from "./VirtualServer";

/**
 * XyPrissHttpServer - XPris HTTP server implementation
 */
export class XyPrissHttpServer {
    private server: any;
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
    private xhscBridge?: XHSCBridge;

    constructor(logger: Logger) {
        this.logger = logger;
        this.middlewareManager = new MiddlewareManager(logger);
        this.notFoundHandler = new NotFoundHandler();
        this.trustProxy = new TrustProxy(false);
        this.responseEnhancer = new ResponseEnhancer(logger);
        this.requestEnhancer = new RequestEnhancer(logger, this.trustProxy);
        this.server = new VirtualServer();
        this.setupDefaultErrorHandler();
        this.logger.debug(
            "server",
            "[XyPrissHttpServer] Created new HTTP server with middleware manager"
        );
    }

    public setApp(app: any): void {
        this.logger.debug("server", "[HttpServer] setApp called");
        this.app = app;
    }

    public use(middleware: MiddlewareFunction): void;
    public use(path: string, middleware: MiddlewareFunction): void;
    public use(
        pathOrMiddleware: string | MiddlewareFunction,
        middleware?: MiddlewareFunction
    ): void {
        if (typeof pathOrMiddleware === "function") {
            this.middlewareManager.use(pathOrMiddleware);
        } else if (middleware) {
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

    public connect(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("CONNECT", path, handlers);
    }

    public trace(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.addRoute("TRACE", path, handlers);
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

    private addRoute(
        method: string,
        path: string | RegExp,
        handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;
        this.routes.push({ method, path, handler, middleware });
        this.logger.debug("server", `Route registered: ${method} ${path}`);
    }

    public addRouteWithParams(
        method: string,
        path: RegExp,
        paramNames: string[],
        handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;
        this.routes.push({ method, path, handler, middleware, paramNames });
    }

    public setTrustProxy(config: TrustProxyValue): void {
        this.trustProxy = new TrustProxy(config);
    }

    public listen(port: number, host: string, callback?: () => void): Server {
        this.logger.debug(
            "server",
            `listen() called: ${host}:${port} (XHSC Mode)`
        );
        this.server.listen(port, host, callback);

        if (!this.app) {
            throw new Error("Cannot start HttpServer without app instance");
        }

        if (!this.xhscBridge) {
            this.xhscBridge = new XHSCBridge(
                this.app as XyprissApp,
                this.logger
            );
        }

        this.xhscBridge
            .start(port, host)
            .then(() => {
                this.logger.info(
                    "server",
                    `XHSC Bridge connected on port ${port}`
                );
                this.server.emit("listening");
            })
            .catch((error) => {
                this.logger.error(
                    "server",
                    `Failed to start XHSC Bridge: ${error}`
                );
                this.server.emit("error", error);
            });

        return this.server;
    }

    public async handleRequest(req: any, res: any): Promise<void> {
        const startTime = process.hrtime();
        let XyPrisReq: XyPrisRequest;
        let XyPrisRes: XyPrisResponse;

        try {
            XyPrisReq = this.enhanceRequest(req);
            XyPrisRes = this.enhanceResponse(res, XyPrisReq);
        } catch (error) {
            this.logger.error("server", `Failed to enhance request: ${error}`);
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Bad Request" }));
            return;
        }

        const originalEnd = res.end.bind(res);
        res.end = (chunk?: any, encoding?: any, cb?: any) => {
            if (res.writableEnded) return res;
            const diff = process.hrtime(startTime);
            const responseTimeMs = (diff[0] * 1e9 + diff[1]) / 1e6;

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
            return originalEnd(chunk, encoding, cb);
        };

        try {
            if (["POST", "PUT", "PATCH"].includes(XyPrisReq.method)) {
                const contentType = XyPrisReq.headers["content-type"] || "";
                if (!contentType.includes("multipart/form-data")) {
                    await this.parseBody(XyPrisReq);
                }
            }

            const middlewareChainCompleted =
                await this.middlewareManager.execute(XyPrisReq, XyPrisRes);
            if (!middlewareChainCompleted) return;

            const route = this.findRoute(
                XyPrisReq.method,
                XyPrisReq.path,
                XyPrisReq
            );
            if (route) {
                for (const middleware of route.middleware) {
                    await this.executeMiddlewareFunction(
                        middleware,
                        XyPrisReq,
                        XyPrisRes
                    );
                }
                if (!XyPrisRes.writableEnded) {
                    await route.handler(XyPrisReq, XyPrisRes);
                }
            } else {
                if (!XyPrisRes.writableEnded) {
                    await this.send404(XyPrisReq, XyPrisRes);
                }
            }
        } catch (error) {
            this.handleError(error, XyPrisReq, XyPrisRes);
        }
    }

    private enhanceRequest(req: any): XyPrisRequest {
        if (req.originalUrl !== undefined && req.ip !== undefined) {
            req.app = new XyPrisRequestApp(this.app, this.logger) as any;
            return req;
        }
        return this.requestEnhancer.enhance(req, this.app);
    }

    private enhanceResponse(res: any, req: XyPrisRequest): XyPrisResponse {
        return this.responseEnhancer.enhance(res, req);
    }

    private async parseBody(req: XyPrisRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const contentType = req.headers["content-type"] || "";
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
                        const params = new URLSearchParams(body);
                        const bodyObj: Record<string, string> = {};
                        for (const [key, value] of params.entries()) {
                            bodyObj[key] = value;
                        }
                        req.body = bodyObj;
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
                if (error) reject(error);
                else resolve();
            };
            try {
                const result = middleware(req, res, next);
                if (result instanceof Promise) result.catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    private findRoute(
        method: string,
        path: string,
        req: XyPrisRequest
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
        requestPath: string
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

    private async send404(
        req: XyPrisRequest,
        res: XyPrisResponse
    ): Promise<void> {
        if (this.responseControl?.enabled) {
            try {
                res.statusCode = this.responseControl.statusCode || 404;
                if (this.responseControl.headers)
                    res.set(this.responseControl.headers);
                if (this.responseControl.contentType)
                    res.setHeader(
                        "Content-Type",
                        this.responseControl.contentType
                    );
                if (this.responseControl.handler) {
                    await this.responseControl.handler(req, res);
                    return;
                }
                if (this.responseControl.content !== undefined) {
                    if (typeof this.responseControl.content === "object")
                        res.json(this.responseControl.content);
                    else res.send(this.responseControl.content);
                    return;
                }
                res.send(`Route not found: ${req.method} ${req.path}`);
            } catch (error) {
                this.notFoundHandler.handler(req as any, res as any);
            }
        } else {
            this.notFoundHandler.handler(req as any, res as any);
        }
    }

    private handleError(
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse
    ): void {
        this.logger.error("server", `Request error: ${error.message}`, error);
        const pluginManager = this.app?.pluginManager;
        if (
            pluginManager &&
            typeof pluginManager.triggerRouteError === "function"
        ) {
            pluginManager.triggerRouteError(error, req, res);
        }
        if (this.errorHandler) {
            this.errorHandler(error, req, res, () => {
                if (!res.writableEnded)
                    this.sendErrorResponse(res, 500, "Internal Server Error");
            });
        } else {
            this.sendErrorResponse(res, 500, "Internal Server Error");
        }
    }

    private sendErrorResponse(
        res: XyPrisResponse,
        statusCode: number,
        message: string
    ): void {
        if (!res.headersSent) res.status(statusCode).json({ error: message });
    }

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

    private setupDefaultErrorHandler(): void {
        this.server.on("error", (error: any) => {
            this.logger.error("server", `Server error: ${error.message}`);
        });
    }

    public getServer(): Server {
        return this.server;
    }

    public close(callback?: (err?: Error) => void): void {
        if (this.xhscBridge) this.xhscBridge.stop();
        this.server.close(callback);
    }

    public address(): any {
        return this.server.address();
    }

    public getRoutes(): Route[] {
        return [...this.routes];
    }

    public setNotFoundHandler(config: NotFoundConfig): void {
        this.notFoundHandler.updateConfig(config);
    }

    public setResponseControl(config: ServerOptions["responseControl"]): void {
        this.responseControl = config;
    }
}

