/**
 * XyprissApp - Express-free UltraFastApp implementation
 *
 * This module provides a complete UltraFastApp implementation that doesn't
 * depend on Express, using our XyPrisHttpServer for maximum performance.
 */

import { Logger } from "../../../shared/logger/Logger";
import {
    UltraFastApp,
    RouteOptions,
    RequestHandler,
    ServerOptions,
} from "../../types/types";
import { SecureCacheAdapter } from "../../cache";
import { XyPrissHttpServer } from "./HttpServer";
import {
    MiddlewareFunction,
    RouteHandler,
    XyPrisRequest,
    XyPrisResponse,
} from "../../types/httpServer.type";
import { XyPrissMiddleware } from "../../middleware/XyPrissMiddlewareAPI";
import {
    MiddlewareConfiguration,
    XyPrissMiddlewareAPI,
} from "../../types/middleware-api.types";
import { XyPrissRouter } from "../routing/Router";

import { XyRoutingManager } from "./XyRoutingManager";
import { XyAppModuleManager } from "./XyModuleManager";

/**
 * UltraFastApp implementation without Express dependency
 */
export class XyprissApp implements UltraFastApp {
    private httpServer: XyPrissHttpServer;
    private logger: Logger;
    private moduleManager: XyAppModuleManager;
    private routingManager: XyRoutingManager;
    public cache?: SecureCacheAdapter;
    private isStarted: boolean = false;
    private middlewareAPI: XyPrissMiddleware;

    // App properties
    public locals: Record<string, any> = {};
    public mountpath: string = "/";
    public settings: Record<string, any> = {};

    // Configuration
    public configs?: ServerOptions;

    // File upload methods (required by UltraFastApp interface)
    public uploadSingle!: (fieldname: string) => RequestHandler;
    public uploadArray!: (
        fieldname: string,
        maxCount?: number
    ) => RequestHandler;
    public uploadFields!: (fields: any[]) => RequestHandler;
    public uploadAny!: () => RequestHandler;

    // Server lifecycle methods (will be added by ServerLifecycleManager)
    public start!: (port?: number, callback?: () => void) => Promise<any>;
    public waitForReady!: () => Promise<void>;
    public getPort!: () => number;
    public forceClosePort!: (port: number) => Promise<any>;

    // Redirect management methods
    public redirectFromPort!: (
        fromPort: number,
        toPort: number,
        options?: any
    ) => any;
    public getRedirectInstance!: (fromPort: number) => any;
    public getAllRedirectInstances!: () => any;
    public disconnectRedirect!: (fromPort: number) => Promise<boolean>;
    public disconnectAllRedirects!: () => Promise<boolean>;
    public getRedirectStats!: (fromPort: number) => any;

    constructor(logger: Logger, options?: ServerOptions) {
        this.logger = logger;
        this.configs = options;
        this.httpServer = new XyPrissHttpServer(logger);
        this.httpServer.setApp(this);
        this.middlewareAPI = new XyPrissMiddleware(this);

        // Initialize Module Managers to handle robust feature implementations
        this.moduleManager = new XyAppModuleManager(this, logger);
        this.moduleManager.initialize();

        this.routingManager = new XyRoutingManager(this, logger);

        this.setupDefaultSettings();
        this.logger.debug(
            "routing",
            "XyprissApp created with new XyPrisHttpServer and ModuleManagers"
        );
    }

    /**
     * Setup default Express-like settings
     */
    private setupDefaultSettings(): void {
        this.settings = {
            "x-powered-by": false,
            etag: "weak",
            env: process.env.NODE_ENV || "development",
            "subdomain offset": 2,
            "trust proxy": false,
            "view cache": true,
            "view engine": false,
            views: process.cwd() + "/views",
        };
    }

    // ===== HTTP METHOD IMPLEMENTATIONS =====

    public get(path: string, ...handlers: RequestHandler[]): void {
        this.logger.debug("server", `Registering GET route: ${path}`);
        this.httpServer.get(path, ...this.convertHandlers(handlers));
    }

    public post(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.post(path, ...this.convertHandlers(handlers));
    }

    public put(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.put(path, ...this.convertHandlers(handlers));
    }

    public delete(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.delete(path, ...this.convertHandlers(handlers));
    }

    public patch(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.patch(path, ...this.convertHandlers(handlers));
    }

    public options(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.options(path, ...this.convertHandlers(handlers));
    }

    public head(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.head(path, ...this.convertHandlers(handlers));
    }

    public connect(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.connect(path, ...this.convertHandlers(handlers));
    }

    public trace(path: string, ...handlers: RequestHandler[]): void {
        this.httpServer.trace(path, ...this.convertHandlers(handlers));
    }

    public static(path: string, filePath: string): void {
        this.httpServer.addStaticRoute(path, filePath);
    }

    public all(path: string, ...handlers: RequestHandler[]): void {
        // Implement all HTTP methods
        const convertedHandlers = this.convertHandlers(handlers);
        this.httpServer.get(path, ...convertedHandlers);
        this.httpServer.post(path, ...convertedHandlers);
        this.httpServer.put(path, ...convertedHandlers);
        this.httpServer.delete(path, ...convertedHandlers);
        this.httpServer.patch(path, ...convertedHandlers);
        this.httpServer.options(path, ...convertedHandlers);
        this.httpServer.head(path, ...convertedHandlers);
        this.httpServer.connect(path, ...convertedHandlers);
        this.httpServer.trace(path, ...convertedHandlers);
    }

    // ===== MIDDLEWARE METHODS =====

    public use(
        pathOrRouter: string | XyPrissRouter | MiddlewareFunction,
        router?: XyPrissRouter
    ): UltraFastApp {
        if (
            typeof pathOrRouter === "string" &&
            router instanceof XyPrissRouter
        ) {
            // app.use('/api', router)
            this.routingManager.mountRouter(pathOrRouter, router);
        } else if (pathOrRouter instanceof XyPrissRouter) {
            // app.use(router)
            this.routingManager.mountRouter("/", pathOrRouter);
        } else if (typeof pathOrRouter === "function") {
            // app.use(middleware)
            this.httpServer.use(pathOrRouter as any);
        } else if (
            typeof pathOrRouter === "string" &&
            typeof router === "function"
        ) {
            // app.use(path, middleware)
            this.httpServer.use(pathOrRouter, router as any);
        }
        return this;
    }

    /**
     * Internal access to the routing manager
     */
    public getRoutingManager(): XyRoutingManager {
        return this.routingManager;
    }

    // ===== UTILITY METHODS =====

    public set(setting: string, val: any): void {
        this.settings[setting] = val;
    }

    public getSetting(setting: string): any {
        return this.settings[setting];
    }

    public enabled(setting: string): boolean {
        return Boolean(this.settings[setting]);
    }

    public disabled(setting: string): boolean {
        return !this.settings[setting];
    }

    public enable(setting: string): void {
        this.settings[setting] = true;
    }

    public disable(setting: string): void {
        this.settings[setting] = false;
    }

    /**
     * Configure trust proxy settings
     */
    public setTrustProxy(
        config: import("../../types/trustProxy").TrustProxyValue
    ): void {
        this.settings["trust proxy"] = config;
        this.httpServer.setTrustProxy(config);
        this.logger.debug(
            "server",
            `Trust proxy configured via app.setTrustProxy()`
        );
    }

    public engine(
        ext: string,
        fn: (
            path: string,
            options: object,
            callback: (e: any, rendered?: string) => void
        ) => void
    ): UltraFastApp {
        // Template engine support - basic implementation
        this.settings[`engine:${ext}`] = fn;
        return this;
    }

    public param(
        name: string,
        handler: (
            req: any,
            res: any,
            next: any,
            value: any,
            name: string
        ) => void
    ): void {
        // Parameter preprocessing - basic implementation
        this.settings[`param:${name}`] = handler;
    }

    public path(): string {
        return this.mountpath;
    }

    public render(
        _view: string,
        _options?: object,
        callback?: (err: Error | null, html?: string) => void
    ): void {
        // Template rendering - basic implementation
        if (callback) {
            callback(new Error("Template rendering not implemented"));
        }
    }

    public route(path: string): any {
        // Route creation - basic implementation
        return {
            get: (handler: RequestHandler) => this.get(path, handler),
            post: (handler: RequestHandler) => this.post(path, handler),
            put: (handler: RequestHandler) => this.put(path, handler),
            delete: (handler: RequestHandler) => this.delete(path, handler),
            patch: (handler: RequestHandler) => this.patch(path, handler),
            options: (handler: RequestHandler) => this.options(path, handler),
            head: (handler: RequestHandler) => this.head(path, handler),
            connect: (handler: RequestHandler) => this.connect(path, handler),
            trace: (handler: RequestHandler) => this.trace(path, handler),
            all: (handler: RequestHandler) => this.all(path, handler),
        };
    }

    // ===== CACHE METHODS =====

    public setCache(cache: SecureCacheAdapter): void {
        this.cache = cache;
    }

    public getCache(): SecureCacheAdapter | undefined {
        return this.cache;
    }

    // Implementation methods now handled by ModuleManager
    public invalidateCache!: (pattern: string) => Promise<void>;
    public getCacheStats!: () => Promise<any>;
    public warmUpCache!: (
        data: Array<{ key: string; value: any; ttl?: number }>
    ) => Promise<void>;
    public getRequestPreCompiler!: () => any;
    public getConsoleInterceptor!: () => any;
    public enableConsoleInterception: () => void = () => {};
    public disableConsoleInterception: () => void = () => {};
    public getConsoleStats: () => any = () => null;
    public resetConsoleStats: () => void = () => {};
    public getFileWatcherStatus!: () => any;
    public getFileWatcherStats: () => any = () => null;
    public stopFileWatcher: () => Promise<void> = async () => {};
    public getFileWatcherManager: () => any = () => null;
    public checkTypeScript!: (files?: string[]) => Promise<any>;
    public getTypeScriptStatus!: () => any;
    public enableTypeScriptChecking: () => void = () => {};
    public disableTypeScriptChecking: () => void = () => {};

    public ultraGet = (path: string, options: any, handler: Function): any => {
        return this.get(path, handler as RequestHandler);
    };
    public ultraPost = (path: string, options: any, handler: Function): any => {
        return this.post(path, handler as RequestHandler);
    };
    public ultraPut = (path: string, options: any, handler: Function): any => {
        return this.put(path, handler as RequestHandler);
    };
    public ultraDelete = (
        path: string,
        options: any,
        handler: Function
    ): any => {
        return this.delete(path, handler as RequestHandler);
    };
    public ultraRoutes = (
        routes: Array<{
            method: string;
            path: string;
            options: any;
            handler: Function;
        }>
    ): any => {
        if (!routes || !Array.isArray(routes)) {
            this.logger.warn(
                "server",
                "Invalid routes array provided to ultraRoutes"
            );
            return this;
        }

        try {
            this.logger.debug(
                "server",
                `Bulk registering ${routes.length} routes`
            );

            let successCount = 0;
            let errorCount = 0;

            routes.forEach((route, index) => {
                try {
                    const { method, path, handler } = route;

                    if (!method || !path || !handler) {
                        throw new Error(
                            `Invalid route at index ${index}: missing method, path, or handler`
                        );
                    }

                    // Register route based on method
                    switch (method.toUpperCase()) {
                        case "GET":
                            this.get(path, handler as RequestHandler);
                            break;
                        case "POST":
                            this.post(path, handler as RequestHandler);
                            break;
                        case "PUT":
                            this.put(path, handler as RequestHandler);
                            break;
                        case "DELETE":
                            this.delete(path, handler as RequestHandler);
                            break;
                        case "PATCH":
                            this.patch(path, handler as RequestHandler);
                            break;
                        case "OPTIONS":
                            this.options(path, handler as RequestHandler);
                            break;
                        case "HEAD":
                            this.head(path, handler as RequestHandler);
                            break;
                        case "CONNECT":
                            this.connect(path, handler as RequestHandler);
                            break;
                        case "TRACE":
                            this.trace(path, handler as RequestHandler);
                            break;
                        default:
                            throw new Error(
                                `Unsupported HTTP method: ${method}`
                            );
                    }

                    successCount++;
                } catch (error) {
                    errorCount++;
                    this.logger.error(
                        "server",
                        `Failed to register route at index ${index}: ${error}`
                    );
                }
            });

            this.logger.debug(
                "server",
                `Bulk route registration completed: ${successCount} successful, ${errorCount} failed`
            );
            return this;
        } catch (error) {
            this.logger.error(
                "server",
                `Bulk route registration failed: ${error}`
            );
            return this;
        }
    };
    public getRouterStats = (): any => null;
    public getRouterInfo = (): any => null;
    public warmUpRoutes = async (): Promise<void> => {};
    public resetRouterStats = (): void => {};

    public useCached = (middleware: any, ttl?: number): any => {
        if (!this.cache) {
            this.logger.warn(
                "server",
                "Cache not available, using middleware without caching"
            );
            return this.use(middleware);
        }

        // Create a caching wrapper for the middleware
        const cachedMiddleware = async (req: any, res: any, next: any) => {
            try {
                // Generate cache key based on request
                const cacheKey = `middleware:${req.method}:${
                    req.path
                }:${JSON.stringify(req.query)}`;

                // Check if response is cached
                const cachedResponse = await this.cache!.get(cacheKey);
                if (cachedResponse) {
                    this.logger.debug(
                        "server",
                        `Serving cached middleware response for ${cacheKey}`
                    );
                    res.json(cachedResponse);
                    return;
                }

                // Intercept response to cache it
                const originalJson = res.json;
                const self = this;
                res.json = function (data: any) {
                    // Cache the response
                    if (ttl && self.cache) {
                        self.cache
                            .set(cacheKey, data, { ttl })
                            .catch((error: any) => {
                                self.logger.warn(
                                    "server",
                                    `Failed to cache middleware response: ${error}`
                                );
                            });
                    }
                    return originalJson.call(this, data);
                };

                // Execute original middleware
                middleware(req, res, next);
            } catch (error) {
                this.logger.error(
                    "server",
                    `Cached middleware error: ${error}`
                );
                middleware(req, res, next);
            }
        };

        return this.use(cachedMiddleware);
    };

    public removeMiddleware = (name: string): boolean => {
        try {
            // Middleware removal is complex in the current architecture
            // This would require tracking middleware by name and rebuilding the middleware stack
            this.logger.warn(
                "server",
                `Middleware removal not fully implemented for: ${name}`
            );

            // For now, we can only disable middleware through the middleware API
            if (this.middlewareAPI) {
                const disabled = this.middlewareAPI.disable(name);
                if (disabled) {
                    this.logger.debug("server", `Disabled middleware: ${name}`);
                    return true;
                }
            }

            return false;
        } catch (error) {
            this.logger.error(
                "server",
                `Failed to remove middleware ${name}: ${error}`
            );
            return false;
        }
    };

    public enableSecurity = (options?: any): any => {
        try {
            this.logger.debug("server", "Enabling security middleware");

            if (this.middlewareAPI) {
                // Enable all security middleware
                const securityMiddleware = [
                    "helmet",
                    "cors",
                    "rateLimit",
                    "csrf",
                    "compression",
                    "hpp",
                    "mongoSanitize",
                    "xss",
                ];

                securityMiddleware.forEach((middleware) => {
                    try {
                        this.middlewareAPI.enable(middleware);
                        this.logger.debug(
                            "server",
                            `Enabled security middleware: ${middleware}`
                        );
                    } catch (error) {
                        this.logger.warn(
                            "server",
                            `Failed to enable ${middleware}: ${error}`
                        );
                    }
                });

                // Apply custom security options if provided
                if (options) {
                    if (options.helmet) {
                        this.middlewareAPI.helmet(options.helmet);
                    }
                    if (options.cors) {
                        this.middlewareAPI.cors(options.cors);
                    }
                    if (options.rateLimit) {
                        this.middlewareAPI.rateLimit(options.rateLimit);
                    }
                }

                this.logger.debug(
                    "server",
                    "Security middleware enabled successfully"
                );
            } else {
                this.logger.warn(
                    "server",
                    "Middleware API not available, cannot enable security"
                );
            }

            return this;
        } catch (error) {
            this.logger.error(
                "server",
                `Failed to enable security middleware: ${error}`
            );
            return this;
        }
    };

    // More missing methods
    public enableConsoleEncryption = (): void => {};
    public disableConsoleEncryption = (): void => {};
    public encrypt = (data: any): any => data;
    public setConsoleEncryptionKey = (key: string): void => {};
    public enableCors = (options?: any): any => this;
    public enableCompression = (options?: any): any => this;
    public enableRateLimit = (options?: any): any => this;
    /**
     * Access the middleware management API
     */
    public middleware(config?: MiddlewareConfiguration): any {
        return this.middlewareAPI;
    }
    public getWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.get(path, handler as RequestHandler);
    public postWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.post(path, handler as RequestHandler);
    public putWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.put(path, handler as RequestHandler);
    public deleteWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.delete(path, handler as RequestHandler);
    public patchWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.patch(path, handler as RequestHandler);
    public optionsWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.options(path, handler as RequestHandler);
    public headWithCache = (
        path: string,
        options: any,
        handler: Function
    ): any => this.head(path, handler as RequestHandler);

    // Final missing methods
    public setConsoleEncryptionDisplayMode = (_mode: string): void => {};
    public getEncryptedLogs = (): any => [];
    public restoreConsoleFromEncrypted = async (
        _encryptedData: string[],
        _key: string
    ): Promise<string[]> => [];
    public isConsoleEncryptionEnabled = (): boolean => false;
    public getConsoleEncryptionKey = (): string => "";
    public clearEncryptedLogs = (): void => {};
    public exportEncryptedLogs = (_format?: string): any => null;
    public importEncryptedLogs = (_data: any): void => {};
    public getConsoleEncryptionStats = (): any => null;
    public getConsoleEncryptionStatus = (): any => null;
    public useSecure = (_options?: any): any => this;
    public usePerformance = (_options?: any): any => this;
    public getMiddleware = (): any => null;
    public getMiddlewareStats = (): any => null;

    // Console tracing stubs
    public enableConsoleTracing = (_maxBufferSize?: number): void => {};
    public disableConsoleTracing = (): void => {};
    public onConsoleTrace = (_handler: (trace: any) => void): void => {};
    public getConsoleTraceBuffer = (): any[] => [];
    public clearConsoleTraceBuffer = (): void => {};

    // ===== HELPER METHODS =====

    /**
     * Convert Express RequestHandler to XyPrisHttpServer handler
     */
    private convertHandler(handler: RequestHandler): MiddlewareFunction {
        return (req: XyPrisRequest, res: XyPrisResponse, next) => {
            // Type assertion to make it compatible
            return handler(req as any, res as any, next);
        };
    }

    /**
     * Convert array of Express RequestHandlers to XyPrisHttpServer handlers
     */
    private convertHandlers(
        handlers: RequestHandler[]
    ): (MiddlewareFunction | RouteHandler)[] {
        return handlers.map((handler) => this.convertHandler(handler));
    }

    /**
     * Get the underlying HTTP server
     */
    public getHttpServer(): XyPrissHttpServer {
        return this.httpServer;
    }

    /**
     * Close the server
     */
    public close(callback?: (err?: Error) => void): void {
        this.httpServer.close(callback);
    }

    /**
     * Get server address
     */
    public address(): any {
        return this.httpServer.address();
    }
}

/**
 * Factory function to create a new XyPriss app
 */
export function createApp(): XyprissApp {
    const logger = new Logger({
        components: {
            server: true,
            routing: true,
            middleware: true,
        },
    });
    return new XyprissApp(logger);
}

