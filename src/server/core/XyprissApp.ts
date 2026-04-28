/**
 * XyprissApp - Express-free XyPrissApp implementation
 *
 * This module provides a complete XyPrissApp implementation that doesn't
 * depend on Express, using our XyPrisHttpServer for maximum performance.
 */

import { Logger } from "../../shared/logger/Logger";
import {
    XyPrissApp,
    RouteOptions,
    RequestHandler,
    MultiServerConfig,
} from "../../types/types";
import {
    InternalServerOptions,
    XServerOptions as ServerOptions,
} from "../../types/ServerOptions";
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
import { detectStatusCodes } from "../routing/modules/middleware";

import { XyRoutingManager } from "./XyRoutingManager";
import { XyAppModuleManager } from "./XyModuleManager";

/**
 * XyPrissApp implementation without Express dependency
 */
export class XyprissApp implements XyPrissApp {
    private httpServer: XyPrissHttpServer;
    public logger: Logger;
    private moduleManager: XyAppModuleManager;
    private routingManager: XyRoutingManager;
    public cache?: SecureCacheAdapter;
    private isStarted: boolean = false;
    private middlewareAPI: XyPrissMiddleware;
    public pluginManager?: any;
    public xyPluginManager?: any;

    // App properties
    public locals: Record<string, any> = {};
    public mountpath: string = "/";
    public settings: Record<string, any> = {};

    // Configuration
    public configs?: InternalServerOptions;

    // File upload methods (required by XyPrissApp interface)
    public uploadSingle!: (fieldname: string) => RequestHandler;
    public uploadArray!: (
        fieldname: string,
        maxCount?: number,
    ) => RequestHandler;
    public uploadFields!: (fields: any[]) => RequestHandler;
    public uploadAny!: () => RequestHandler;
    public registerPlugin!: (plugin: any) => Promise<void>;
    public unregisterPlugin!: (pluginId: string) => Promise<void>;
    public getPlugin!: (pluginId: string) => any;

    // Server lifecycle methods (configured by XyLifecycleManager)
    public start!: (callback?: () => void) => Promise<any>;
    public waitForReady!: () => Promise<void>;
    public getPort!: () => number;
    public forceClosePort!: (port: number) => Promise<any>;

    // Redirect management methods
    public redirectFromPort!: (
        fromPort: number,
        toPort: number,
        options?: any,
    ) => any;
    public getRedirectInstance!: (fromPort: number) => any;
    public getAllRedirectInstances!: () => any;
    public disconnectRedirect!: (fromPort: number) => Promise<boolean>;
    public disconnectAllRedirects!: () => Promise<boolean>;
    public getRedirectStats!: (fromPort: number) => any;

    constructor(logger: Logger, options?: InternalServerOptions) {
        this.logger = logger;
        this.configs = options;
        this.httpServer = new XyPrissHttpServer(logger);
        this.httpServer.setApp(this);
        this.middlewareAPI = new XyPrissMiddleware(this);

        // Initialize Module Managers to handle robust feature implementations
        this.moduleManager = new XyAppModuleManager(this, logger);
        this.moduleManager.initialize().catch((error) => {
            this.logger.error("server", "Failed to initialize XM2:", error); // XM2 = Xypriss Module Management
        });

        this.routingManager = new XyRoutingManager(this, logger);

        this.setupDefaultSettings();
        this.logger.debug(
            "routing",
            "XyprissApp created with new XyPrisHttpServer and ModuleManagers",
        );
    }

    /**
     * Setup default settings
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

    public get(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.logger.debug("server", `Registering GET route: ${path}`);
        this.httpServer.get(path, ...this.convertHandlers(handlers));
    }

    public post(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.post(path, ...this.convertHandlers(handlers));
    }

    public put(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.put(path, ...this.convertHandlers(handlers));
    }

    public delete(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.delete(path, ...this.convertHandlers(handlers));
    }

    public patch(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.patch(path, ...this.convertHandlers(handlers));
    }

    public options(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.options(path, ...this.convertHandlers(handlers));
    }

    public head(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.head(path, ...this.convertHandlers(handlers));
    }

    public connect(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.connect(path, ...this.convertHandlers(handlers));
    }

    public trace(path: string | RegExp, ...handlers: RequestHandler[]): void {
        this.httpServer.trace(path, ...this.convertHandlers(handlers));
    }
    // ** DEPRECATED ** use XStatic instead
    // public static(path: string, filePath: string): void {
    //     this.httpServer.addStaticRoute(path, filePath);
    // }

    /**
     * Register a route-level redirect from one path to another path or external URL.
     * @param from - Source path (e.g. "/old")
     * @param to - Destination path or full URL(e.g. "/new" or "https://example.com")
     * @param statusCode - HTTP status code (default: 301)
     */
    public redirect(
        from: string,
        to: string,
        statusCode: 301 | 302 = 301,
    ): void {
        this.logger.debug(
            "server",
            `Registering redirect: ${from} → ${to} (${statusCode})`,
        );
        this.get(from, (_req: any, res: any) => {
            res.redirect(statusCode, to);
        });
    }

    public all(path: string | RegExp, ...handlers: RequestHandler[]): void {
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

    /**
     * Specialized registration for routes with parameters and patterns.
     */
    public addRouteWithParams(
        method: string,
        path: RegExp,
        paramNames: string[],
        handlers: RequestHandler[],
    ): void {
        this.httpServer.addRouteWithParams(
            method,
            path,
            paramNames,
            this.convertHandlers(handlers) as any,
        );
    }

    // ===== MIDDLEWARE METHODS =====

    public use(
        pathOrRouter: string | XyPrissRouter | MiddlewareFunction,
        router?: XyPrissRouter,
    ): XyPrissApp {
        const isRouter = (obj: any) =>
            obj instanceof XyPrissRouter ||
            (obj &&
                typeof obj.getRoutes === "function" &&
                typeof obj.getMiddleware === "function");

        if (typeof pathOrRouter === "string" && isRouter(router)) {
            // app.use('/api', router)
            this.routingManager.mountRouter(
                pathOrRouter,
                router as XyPrissRouter,
            );
        } else if (isRouter(pathOrRouter)) {
            // app.use(router)
            this.routingManager.mountRouter("/", pathOrRouter as XyPrissRouter);
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

    /**
     * Returns the global route registry for all mounted routers.
     */
    public getRouteRegistry(): any[] {
        const routers = this.routingManager.getRouters();
        const allRoutes: any[] = [];

        // 1. Collect routes from mounted routers (Rich routes)
        routers.forEach((router, prefix) => {
            const registry = router.toRegistry().map((entry) => ({
                ...entry,
                path:
                    prefix === "/"
                        ? entry.path
                        : (prefix + entry.path).replace(/\/+/g, "/"),
            }));
            allRoutes.push(...registry);
        });

        // 2. Collect direct app routes from httpServer (Basic routes)
        const httpServerRoutes = this.httpServer.getRoutes();
        httpServerRoutes.forEach((route) => {
            const path =
                typeof route.path === "string" ? route.path : route.path.source;
            const method = route.method.toUpperCase();

            // Check if this route is already covered by a router
            const isDuplicate = allRoutes.some(
                (r) =>
                    (r.path === path || r.path === path + "/") &&
                    r.method.toUpperCase() === method,
            );

            if (!isDuplicate) {
                allRoutes.push({
                    id: `direct-${method}-${path.replace(/\//g, "-")}`,
                    method: method,
                    path: path,
                    version: "1.0.0",
                    meta: { summary: "Direct app route", tags: ["direct"] },
                    hasGuards: false,
                    hasRateLimit: false,
                    hasCache: false,
                    paramNames: route.paramNames || [],
                    responses: detectStatusCodes(route.handler),
                });
            }
        });

        return allRoutes;
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
    public setTrustProxy(config: string[]): void {
        this.settings["trust proxy"] = config;
        this.httpServer.setTrustProxy(config);
        this.logger.debug(
            "server",
            `Trust proxy configured via app.setTrustProxy()`,
        );
    }

    public engine(
        ext: string,
        fn: (
            path: string,
            options: object,
            callback: (e: any, rendered?: string) => void,
        ) => void,
    ): XyPrissApp {
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
            name: string,
        ) => void,
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
        callback?: (err: Error | null, html?: string) => void,
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
        data: Array<{ key: string; value: any; ttl?: number }>,
    ) => Promise<void>;
    public getConsoleInterceptor!: () => any;
    public enableConsoleInterception: () => Promise<void> = async () => {};
    public disableConsoleInterception: () => Promise<void> = async () => {};
    public getConsoleStats: () => any = () => null;
    public updateConsoleConfig: (config: any) => Promise<void> = async () => {};
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
        handler: Function,
    ): any => {
        return this.delete(path, handler as RequestHandler);
    };
    public ultraRoutes = (
        routes: Array<{
            method: string;
            path: string;
            options: any;
            handler: Function;
        }>,
    ): any => {
        if (!routes || !Array.isArray(routes)) {
            this.logger.warn(
                "server",
                "Invalid routes array provided to ultraRoutes",
            );
            return this;
        }

        try {
            this.logger.debug(
                "server",
                `Bulk registering ${routes.length} routes`,
            );

            let successCount = 0;
            let errorCount = 0;

            routes.forEach((route, index) => {
                try {
                    const { method, path, handler } = route;

                    if (!method || !path || !handler) {
                        throw new Error(
                            `Invalid route at index ${index}: missing method, path, or handler`,
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
                                `Unsupported HTTP method: ${method}`,
                            );
                    }

                    successCount++;
                } catch (error) {
                    errorCount++;
                    this.logger.error(
                        "server",
                        `Failed to register route at index ${index}: ${error}`,
                    );
                }
            });

            this.logger.debug(
                "server",
                `Bulk route registration completed: ${successCount} successful, ${errorCount} failed`,
            );
            return this;
        } catch (error) {
            this.logger.error(
                "server",
                `Bulk route registration failed: ${error}`,
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
                "Cache not available, using middleware without caching",
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
                        `Serving cached middleware response for ${cacheKey}`,
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
                                    `Failed to cache middleware response: ${error}`,
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
                    `Cached middleware error: ${error}`,
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
                `Middleware removal not fully implemented for: ${name}`,
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
                `Failed to remove middleware ${name}: ${error}`,
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
                            `Enabled security middleware: ${middleware}`,
                        );
                    } catch (error) {
                        this.logger.warn(
                            "server",
                            `Failed to enable ${middleware}: ${error}`,
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
                    "Security middleware enabled successfully",
                );
            } else {
                this.logger.warn(
                    "server",
                    "Middleware API not available, cannot enable security",
                );
            }

            return this;
        } catch (error) {
            this.logger.error(
                "server",
                `Failed to enable security middleware: ${error}`,
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
    /**
     * Access the middleware management API
     */
    public middleware(config?: MiddlewareConfiguration): any {
        return this.middlewareAPI;
    }
    public getWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.get(path, handler as RequestHandler);
    public postWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.post(path, handler as RequestHandler);
    public putWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.put(path, handler as RequestHandler);
    public deleteWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.delete(path, handler as RequestHandler);
    public patchWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.patch(path, handler as RequestHandler);
    public optionsWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.options(path, handler as RequestHandler);
    public headWithCache = (
        path: string,
        options: any,
        handler: Function,
    ): any => this.head(path, handler as RequestHandler);

    // Final missing methods
    public setConsoleEncryptionDisplayMode = (_mode: string): void => {};
    public getEncryptedLogs = (): any => [];
    public restoreConsoleFromEncrypted = async (
        _encryptedData: string[],
        _key: string,
    ): Promise<string[]> => [];
    public isConsoleEncryptionEnabled = (): boolean => false;
    public getConsoleEncryptionKey = (): string => "";
    public clearEncryptedLogs = (): void => {};
    public exportEncryptedLogs = (_format?: string): any => null;
    public importEncryptedLogs = (_data: any): void => {};
    public getConsoleEncryptionStats = (): any => null;
    public getConsoleEncryptionStatus = (): any => null;
    public useSecure = (options?: any): any => {
        this.enableSecurity(options);
        return this;
    };
    public usePerformance = (options?: any): any => {
        // Delegated to engine via config
        return this;
    };
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
     * Convert HTTP RequestHandler to XyPrisHttpServer handler
     */
    private convertHandler(handler: RequestHandler): MiddlewareFunction {
        const wrapper: any = (
            req: XyPrisRequest,
            res: XyPrisResponse,
            next: any,
        ) => {
            // Type assertion to make it compatible
            return handler(req as any, res as any, next);
        };
        wrapper.__original = handler;
        return wrapper;
    }

    /**
     * Convert array of HTTP RequestHandlers to XyPrisHttpServer handlers
     */
    private convertHandlers(
        handlers: RequestHandler[],
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
    /**
     * Locks the application instance to prevent further modifications.
     * After lockdown, any attempt to set properties on the app will throw an error.
     *
     * @returns A proxied version of the app that enforces immutability
     */
    public lockdown(): XyPrissApp {
        this.logger.debug("server", "Locking down app instance for safety");
        const self = this;

        return new Proxy(this, {
            set(target, prop, value) {
                const errorMsg = `[XyPriss Security] Mutation Attempt Detected: Application instance is immutable after creation. Property '${String(
                    prop,
                )}' cannot be changed.`;

                self.logger.error("security", errorMsg);
                throw new Error(errorMsg);
            },
            defineProperty(target, prop, descriptor) {
                const errorMsg = `[XyPriss Security] Mutation Attempt Detected: Cannot define new property '${String(
                    prop,
                )}' on locked app instance.`;
                self.logger.error("security", errorMsg);
                throw new Error(errorMsg);
            },
            deleteProperty(target, prop) {
                const errorMsg = `[XyPriss Security] Mutation Attempt Detected: Cannot delete property '${String(
                    prop,
                )}' from locked app instance.`;
                self.logger.error("security", errorMsg);
                throw new Error(errorMsg);
            },
        }) as unknown as XyPrissApp;
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

