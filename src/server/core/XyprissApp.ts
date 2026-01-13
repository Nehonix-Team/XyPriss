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

/**
 * UltraFastApp implementation without Express dependency
 */
export class XyprissApp implements UltraFastApp {
    private httpServer: XyPrissHttpServer;
    private logger: Logger;
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
        this.setupDefaultSettings();
        this.logger.debug(
            "routing",
            "XyprissApp created with new XyPrisHttpServer"
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
            this.mountRouter(pathOrRouter, router);
        } else if (pathOrRouter instanceof XyPrissRouter) {
            // app.use(router)
            this.mountRouter("/", pathOrRouter);
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

    // ===== UTILITY METHODS =====

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

    // ===== MISSING ULTRAFASTAPP METHODS (STUB IMPLEMENTATIONS) =====

    public invalidateCache = async (pattern: string): Promise<void> => {
        if (this.cache) {
            try {
                let invalidatedCount = 0;

                if (pattern.includes("*") || pattern.includes("?")) {
                    // Use keys() to find matching keys for granular invalidation
                    const keys = await this.cache.keys(pattern);

                    if (keys.length > 0) {
                        for (const key of keys) {
                            const deleted = await this.cache.delete(key);
                            if (deleted) invalidatedCount++;
                        }
                    }
                } else {
                    // Direct key deletion
                    const deleted = await this.cache.delete(pattern);
                    invalidatedCount = deleted ? 1 : 0;
                }

                this.logger.debug(
                    "server",
                    `Cache invalidation completed for pattern: ${pattern}, invalidated: ${invalidatedCount} entries`
                );
            } catch (error) {
                this.logger.error(
                    "server",
                    `Cache invalidation failed for pattern ${pattern}: ${error}`
                );
                throw error;
            }
        }
    };

    public getCacheStats = async (): Promise<any> => {
        if (this.cache) {
            try {
                const stats = await this.cache.getStats();

                // Transform cache stats to a more user-friendly format
                return {
                    memory: {
                        hitRate: stats.memory.hitRate || 0,
                        missRate: 1 - (stats.memory.hitRate || 0),
                        size: stats.memory.size || 0,
                        hits: stats.memory.hits || 0,
                        misses: stats.memory.misses || 0,
                        totalOperations:
                            (stats.memory.hits || 0) +
                            (stats.memory.misses || 0),
                        memoryUsage: stats.memory.memoryUsage || 0,
                        evictions: stats.memory.evictions || 0,
                    },
                    redis: stats.redis
                        ? {
                              connected: stats.redis.connected,
                              hitRate: stats.redis.hitRate || 0,
                              hits: stats.redis.hits || 0,
                              misses: stats.redis.misses || 0,
                              keys: stats.redis.keys || 0,
                              memoryUsage: stats.redis.memoryUsage,
                              uptime: stats.redis.uptime || 0,
                          }
                        : null,
                    performance: stats.performance
                        ? {
                              totalOperations:
                                  stats.performance.totalOperations || 0,
                              averageResponseTime:
                                  stats.performance.averageResponseTime || 0,
                              compressionRatio:
                                  stats.performance.compressionRatio || 0,
                          }
                        : null,
                    security: stats.security
                        ? {
                              encryptedEntries:
                                  stats.security.encryptedEntries || 0,
                              keyRotations: stats.security.keyRotations || 0,
                          }
                        : null,
                    timestamp: Date.now(),
                };
            } catch (error) {
                this.logger.error(
                    "server",
                    `Failed to get cache stats: ${error}`
                );
                return { error: "Failed to retrieve cache statistics" };
            }
        }
        return null;
    };

    public warmUpCache = async (
        data: Array<{ key: string; value: any; ttl?: number }>
    ): Promise<void> => {
        if (this.cache && data && data.length > 0) {
            try {
                this.logger.debug(
                    "server",
                    `Starting cache warmup for ${data.length} entries`
                );

                let successCount = 0;
                let errorCount = 0;
                const batchSize = 10; // Process in batches to avoid overwhelming the cache

                // Process entries in batches
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    const batchPromises = batch.map(async (entry) => {
                        try {
                            const options = entry.ttl
                                ? { ttl: entry.ttl }
                                : undefined;
                            await this.cache!.set(
                                entry.key,
                                entry.value,
                                options
                            );
                            successCount++;
                        } catch (error) {
                            errorCount++;
                            this.logger.warn(
                                "server",
                                `Failed to warm up cache entry ${entry.key}: ${error}`
                            );
                        }
                    });

                    // Wait for batch to complete
                    await Promise.allSettled(batchPromises);

                    // Small delay between batches to prevent overwhelming the system
                    if (i + batchSize < data.length) {
                        await new Promise((resolve) => setTimeout(resolve, 10));
                    }
                }

                this.logger.debug(
                    "server",
                    `Cache warmup completed: ${successCount} successful, ${errorCount} failed`
                );
            } catch (error) {
                this.logger.error("server", `Cache warmup failed: ${error}`);
                throw error;
            }
        }
    };

    public getRequestPreCompiler = (): any => {
        // RequestPreCompiler is not implemented in the current architecture
        // This would be a component for pre-compiling request handlers for performance
        this.logger.debug("server", "RequestPreCompiler not implemented");
        return {
            compile: (routes: any[]) => {
                this.logger.debug(
                    "server",
                    `Pre-compiling ${routes.length} routes`
                );
                return routes; // Pass-through for now
            },
            isEnabled: () => false,
            getStats: () => ({ compiledRoutes: 0, compilationTime: 0 }),
        };
    };

    public getConsoleInterceptor = (): any => null;
    public enableConsoleInterception = (): void => {};
    public disableConsoleInterception = (): void => {};
    public getConsoleStats = (): any => null;
    public resetConsoleStats = (): void => {};

    public getFileWatcherStatus = (): any => null;
    public getFileWatcherStats = (): any => null;
    public stopFileWatcher = async (): Promise<void> => {};
    public getFileWatcherManager = (): any => null;

    public checkTypeScript = async (files?: string[]): Promise<any> => null;
    public getTypeScriptStatus = (): any => null;
    public enableTypeScriptChecking = (): void => {};
    public disableTypeScriptChecking = (): void => {};

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

    /**
     * Mount a router at a specific path
     */
    private mountRouter(basePath: string, router: XyPrissRouter): void {
        const routes = router.getRoutes();
        const middleware = router.getMiddleware();

        this.logger.debug(
            "server",
            `🔧 Mounting router at ${basePath} with ${routes.length} routes`
        );
        routes.forEach((route) => {
            this.logger.debug(
                "server",
                `🔧 Router route: ${route.method} ${
                    route.path
                } (has pattern: ${!!route.pattern})`
            );
        });

        // Register router middleware first
        middleware.forEach((mw) => {
            this.httpServer.use(mw);
        });

        // Register all routes from the router
        routes.forEach((route) => {
            const fullPath = this.joinPaths(basePath, route.path);

            // If the route has a compiled pattern, we need to create a new pattern
            // that includes the base path
            let routePath: string | RegExp = fullPath;

            if (route.pattern && basePath !== "/") {
                // Create a new pattern that includes the base path
                const originalPattern = route.pattern.source;
                const flags = route.pattern.flags;

                // Remove the ^ and $ anchors from the original pattern
                const cleanPattern = originalPattern
                    .replace(/^\^/, "")
                    .replace(/\$$/, "");

                // Create new pattern with base path
                const basePathEscaped = basePath.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );
                const newPatternSource = `^${basePathEscaped}${cleanPattern}$`;

                routePath = new RegExp(newPatternSource, flags);

                this.logger.debug(
                    "server",
                    `🔧 Registering route: ${route.method} ${fullPath} (compiled pattern with base path)`
                );
            } else if (route.pattern) {
                // Use the original pattern if no base path
                routePath = route.pattern;

                this.logger.debug(
                    "server",
                    `🔧 Registering route: ${route.method} ${fullPath} (original compiled pattern)`
                );
            } else {
                this.logger.debug(
                    "server",
                    `🔧 Registering route: ${route.method} ${fullPath} (string path)`
                );
            }

            // Register the route using the appropriate HTTP method
            const allHandlers = [...route.middleware, route.handler];

            // For RegExp routes, we need to manually add the route with parameter names
            if (routePath instanceof RegExp && route.paramNames) {
                // Manually add route to HTTP server with parameter names
                this.httpServer.addRouteWithParams(
                    route.method.toUpperCase(),
                    routePath,
                    route.paramNames,
                    allHandlers
                );
            } else {
                // Use standard HTTP method registration
                switch (route.method.toUpperCase()) {
                    case "GET":
                        this.httpServer.get(routePath, ...allHandlers);
                        break;
                    case "POST":
                        this.httpServer.post(routePath, ...allHandlers);
                        break;
                    case "PUT":
                        this.httpServer.put(routePath, ...allHandlers);
                        break;
                    case "DELETE":
                        this.httpServer.delete(routePath, ...allHandlers);
                        break;
                    case "PATCH":
                        this.httpServer.patch(routePath, ...allHandlers);
                        break;
                    case "OPTIONS":
                        this.httpServer.options(routePath, ...allHandlers);
                        break;
                    case "HEAD":
                        this.httpServer.head(routePath, ...allHandlers);
                        break;
                    default:
                        this.logger.warn(
                            "server",
                            `Unsupported HTTP method: ${route.method}`
                        );
                        break;
                }
            }
            this.logger.debug(
                "server",
                `Mounted route: ${route.method} ${fullPath}`
            );

            // For root routes, also register the base path without trailing slash to match Express behavior
            if (route.path === "/") {
                const altPath = basePath.replace(/\/$/, ""); // remove trailing slash if present
                let altRoutePath: string | RegExp = altPath;

                if (routePath instanceof RegExp && route.pattern) {
                    // For RegExp routes, create alternative
                    const flags = route.pattern.flags;
                    const basePathEscaped = altPath.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    );
                    const newPatternSource = `^${basePathEscaped}/?$`;
                    altRoutePath = new RegExp(newPatternSource, flags);
                } else {
                    // For string routes, use the alt path
                    altRoutePath = altPath;
                }

                // Register the alternative route
                const allHandlersAlt = [...route.middleware, route.handler];
                switch (route.method.toUpperCase()) {
                    case "GET":
                        this.httpServer.get(altRoutePath, ...allHandlersAlt);
                        break;
                    case "POST":
                        this.httpServer.post(altRoutePath, ...allHandlersAlt);
                        break;
                    case "PUT":
                        this.httpServer.put(altRoutePath, ...allHandlersAlt);
                        break;
                    case "DELETE":
                        this.httpServer.delete(altRoutePath, ...allHandlersAlt);
                        break;
                    case "PATCH":
                        this.httpServer.patch(altRoutePath, ...allHandlersAlt);
                        break;
                    case "OPTIONS":
                        this.httpServer.options(
                            altRoutePath,
                            ...allHandlersAlt
                        );
                        break;
                    case "HEAD":
                        this.httpServer.head(altRoutePath, ...allHandlersAlt);
                        break;
                    default:
                        this.logger.warn(
                            "server",
                            `Unsupported HTTP method for alt route: ${route.method}`
                        );
                        break;
                }
                this.logger.debug(
                    "server",
                    `Mounted alt route: ${route.method} ${altPath}`
                );
            }
        });

        this.logger.debug(
            "server",
            `Mounted router at ${basePath} with ${routes.length} routes`
        );
    }

    /**
     * Join two paths correctly (matches Router._joinPaths)
     */
    private joinPaths(basePath: string, subPath: string): string {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedSub = this.normalizePath(subPath);

        if (normalizedSub === "/") {
            return normalizedBase;
        }

        if (normalizedBase === "/") {
            return normalizedSub;
        }

        return normalizedBase + normalizedSub;
    }

    /**
     * Normalize path (matches Router.normalizePath)
     */
    private normalizePath(path: string): string {
        if (!path || typeof path !== "string") {
            throw new Error("Path must be a non-empty string");
        }

        let normalized = path.trim();

        // Ensure path starts with /
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }

        // Remove trailing slashes except for root
        if (normalized.length > 1) {
            normalized = normalized.replace(/\/+$/, "");
        }

        // Normalize multiple consecutive slashes to single slash
        normalized = normalized.replace(/\/+/g, "/");

        return normalized || "/";
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

