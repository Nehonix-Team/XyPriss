/**
 * XyPrisHttpServer - Express-free HTTP server implementation
 *
 * This module provides a XyPris HTTP server that replaces Express with
 * direct Node.js HTTP handling for maximum performance and control.
 * It maintains API compatibility while removing Express overhead.
 */

import type { Server } from "http";
import { Logger } from "../../shared/logger/Logger";
import { MiddlewareManager } from "../middleware/MiddlewareManager";
import { NotFoundHandler } from "../handlers/NotFoundHandler";
import { XyPrisRequestApp } from "./RequestApp";
import { ResponseEnhancer } from "./ResponseEnhancer";
import { RequestEnhancer } from "./RequestEnhancer";
import { XHSCBridge } from "./XHSCBridge";
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

// New Modules
import { RouteManager } from "./http/RouteManager";
import { BodyParser } from "./http/BodyParser";
import { RequestForwarder } from "./http/RequestForwarder";
import { HttpErrorHandler } from "./http/HttpErrorHandler";

/**
 * XyPrissHttpServer - XPris HTTP server implementation
 */
export class XyPrissHttpServer {
    private server: any;
    private middlewareManager: MiddlewareManager;
    private logger: Logger;
    private notFoundHandler: NotFoundHandler;
    private responseEnhancer: ResponseEnhancer;
    private requestEnhancer: RequestEnhancer;
    private routeManager: RouteManager;
    private requestForwarder: RequestForwarder;
    private httpErrorHandler: HttpErrorHandler;
    private responseControl?: ServerOptions["responseControl"];
    private errorHandler?: (
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: NextFunction,
    ) => void;
    private app?: any;
    private xhscBridge?: XHSCBridge;

    constructor(logger: Logger) {
        this.logger = logger;
        this.middlewareManager = new MiddlewareManager(logger);
        this.notFoundHandler = new NotFoundHandler();
        this.responseEnhancer = new ResponseEnhancer(logger);
        this.requestEnhancer = new RequestEnhancer(logger);

        // Initialize modular components
        this.routeManager = new RouteManager(logger);
        this.requestForwarder = new RequestForwarder(logger);
        this.httpErrorHandler = new HttpErrorHandler(
            logger,
            this.notFoundHandler,
        );

        this.server = new VirtualServer();
        this.httpErrorHandler.setupDefaultErrorHandler(this.server);

        this.logger.debug(
            "server",
            "[XyPrissHttpServer] Created new HTTP server with modularized components",
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
        middleware?: MiddlewareFunction,
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
        this.routeManager.addRoute("GET", path, handlers);
    }

    public post(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("POST", path, handlers);
    }

    public put(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("PUT", path, handlers);
    }

    public delete(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("DELETE", path, handlers);
    }

    public patch(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("PATCH", path, handlers);
    }

    public options(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("OPTIONS", path, handlers);
    }

    public head(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("HEAD", path, handlers);
    }

    public connect(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("CONNECT", path, handlers);
    }

    public trace(
        path: string | RegExp,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): void {
        this.routeManager.addRoute("TRACE", path, handlers);
    }

    public addStaticRoute(path: string, filePath: string): void {
        this.routeManager.addStaticRoute(path, filePath);
    }

    public addRouteWithParams(
        method: string,
        path: RegExp,
        paramNames: string[],
        handlers: (MiddlewareFunction | RouteHandler)[],
    ): void {
        this.routeManager.addRouteWithParams(
            method,
            path,
            paramNames,
            handlers,
        );
    }

    public setTrustProxy(config: string[]): void {
        this.logger.debug(
            "server",
            "Trust proxy is evaluated globally by XHSC.",
        );
    }

    public listen(port: number, host: string, callback?: () => void): Server {
        this.logger.debug(
            "server",
            `listen() called: ${host}:${port} (Standard Mode)`,
        );
        this.server.listen(port, host, callback);
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

        // Attach req.redirect — delegates to res.redirect
        XyPrisReq.redirect = ((statusOrUrl: number | string, url?: string) => {
            if (typeof statusOrUrl === "number" && url) {
                XyPrisRes.redirect(statusOrUrl, url);
            } else {
                XyPrisRes.redirect(statusOrUrl as string);
            }
        }) as any;

        // Attach req.forward — delegates to RequestForwarder
        XyPrisReq.forward = async (url: string, options: any = {}) => {
            return this.requestForwarder.forward(req, XyPrisReq, url, options);
        };

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
                    XyPrisRes,
                );
            }
            return originalEnd(chunk, encoding, cb);
        };

        try {
            const hasPayload =
                ["POST", "PUT", "PATCH", "DELETE"].includes(XyPrisReq.method) ||
                (XyPrisReq.headers["content-length"] &&
                    parseInt(XyPrisReq.headers["content-length"] as string) >
                        0) ||
                XyPrisReq.headers["transfer-encoding"];

            if (hasPayload) {
                const contentType = XyPrisReq.headers["content-type"] || "";
                if (!contentType.includes("multipart/form-data")) {
                    await BodyParser.parse(XyPrisReq);
                }
            }

            const middlewareChainCompleted =
                await this.middlewareManager.execute(XyPrisReq, XyPrisRes);
            if (!middlewareChainCompleted) return;

            const route = this.routeManager.findRoute(
                XyPrisReq.method,
                XyPrisReq.path,
                XyPrisReq,
            );

            if (route) {
                for (const middleware of route.middleware) {
                    await this.executeMiddlewareFunction(
                        middleware,
                        XyPrisReq,
                        XyPrisRes,
                    );
                }
                if (!XyPrisRes.writableEnded) {
                    await route.handler(XyPrisReq, XyPrisRes);
                }
            } else {
                if (!XyPrisRes.writableEnded) {
                    await this.httpErrorHandler.send404(
                        XyPrisReq,
                        XyPrisRes,
                        this.responseControl,
                    );
                }
            }
        } catch (error) {
            this.httpErrorHandler.handleError(
                error,
                XyPrisReq,
                XyPrisRes,
                this.app,
                this.errorHandler,
            );
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

    private async executeMiddlewareFunction(
        middleware: MiddlewareFunction,
        req: XyPrisRequest,
        res: XyPrisResponse,
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
        return this.routeManager.getRoutes();
    }

    public setNotFoundHandler(config: NotFoundConfig): void {
        this.notFoundHandler.updateConfig(config);
    }

    public setResponseControl(config: ServerOptions["responseControl"]): void {
        this.responseControl = config;
    }

    public setErrorHandler(
        handler: (
            error: any,
            req: XyPrisRequest,
            res: XyPrisResponse,
            next: NextFunction,
        ) => void,
    ): void {
        this.errorHandler = handler;
    }
}

