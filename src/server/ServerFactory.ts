/***************************************************************************
 * XyPrissJS - Advanced JavaScript Security Library
 *
 * @author Nehonix
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

/**
 * Ultra-Fast Express (UFE) Server Factory
 *  Express applications with intelligent caching integration
 * Zero-async initialization for immediate use
 */

// Express-free imports
import { SecureCacheAdapter } from "../cache/SecureCacheAdapter";
import {
    RouteOptions,
    ServerOptions,
    UltraFastApp,
    RequestHandler,
    NextFunction,
    MultiServerConfig,
} from "../types/types";
import { DEFAULT_HOST } from "./const/default";
import { XyPrissServer } from "./FastServer";
import { MultiServerManager, MultiServerInstance } from "./components/multi-server/MultiServerManager";
import { Logger, initializeLogger } from "../../shared/logger/Logger";

// Re-export safe JSON utilities
export {
    createSafeJsonMiddleware,
    setupSafeJson,
    safeJsonStringify,
    sendSafeJson,
    createCircularRefDebugger,
} from "../middleware/safe-json-middleware";

export {
    expressStringify,
    safeStringify,
    fastStringify,
} from "../../mods/security/src/components/fortified-function/serializer/safe-serializer";

/**
 * Create ultra-fast Express server (zero-async)
 * Returns app instance ready to use immediately
 * If multi-server mode is enabled, returns an UltraFastApp with multi-server methods
 */
export function createServer(options: ServerOptions = {}): UltraFastApp {
    if (options.env) {
        process.env["NODE_ENV"] = options.env;
    }

    // Check if multi-server mode is enabled
    if (options.multiServer?.enabled && options.multiServer.servers) {
        // Handle worker mode automatically and transparently
        const finalOptions = handleWorkerMode(options);

        // Create multi-server manager
        const logger = initializeLogger(finalOptions.logging);
        const multiServerManager = new MultiServerManager(finalOptions, logger);

        // Create and return multi-server app interface
        return createMultiServerApp(multiServerManager, options.multiServer.servers, logger);
    }

    // Handle worker mode automatically and transparently
    const finalOptions = handleWorkerMode(options);

    // The XyPrissServer already creates a XyprissApp with router support
    // So we can just return the original app
    const server = new XyPrissServer(finalOptions);
    return server.getApp();
}

/**
 * Handle worker mode configuration automatically
 * This function makes clustering transparent to developers
 */
function handleWorkerMode(options: ServerOptions): ServerOptions {
    // Check if running in worker mode
    if (process.env.CLUSTER_MODE !== "true") {
        return options; // Not a worker, return original options
    }

    // Worker mode detected - merge configuration from environment
    let finalOptions = options;

    if (process.env.XYPRISS_SERVER_CONFIG) {
        try {
            const workerConfig = JSON.parse(process.env.XYPRISS_SERVER_CONFIG);

            // Merge worker configuration with provided options
            // Worker-specific overrides take precedence
            finalOptions = {
                ...workerConfig,
                ...options,
                server: {
                    ...workerConfig.server,
                    ...options.server,
                    // Use worker-specific port if provided
                    port: process.env.WORKER_PORT
                        ? parseInt(process.env.WORKER_PORT)
                        : options.server?.port || workerConfig.server?.port,
                },
                // Disable clustering in worker processes to prevent recursive clustering
                cluster: {
                    ...workerConfig.cluster,
                    enabled: false,
                },
            };

            // Debug logging for development
            if (process.env.NODE_ENV === "development") {
                console.log(
                    `[CLUSTER] Worker ${process.env.WORKER_ID} initialized with port ${finalOptions.server?.port}`
                );
            }
        } catch (error) {
            console.error(
                "[CLUSTER] Failed to parse worker configuration:",
                error
            );
            // Fall back to original options but disable clustering
            finalOptions = {
                ...options,
                cluster: { ...options.cluster, enabled: false },
            };
        }
    } else {
        // No worker config found, disable clustering to prevent issues
        finalOptions = {
            ...options,
            cluster: { ...options.cluster, enabled: false },
        };
    }

    return finalOptions;
}

/**
 * Create ultra-fast Express server class instance
 */
export function createServerInstance(
    options: ServerOptions = {}
): XyPrissServer {
    // Use the same worker mode handling as createServer
    const finalOptions = handleWorkerMode(options);
    return new XyPrissServer(finalOptions);
}

/**
 * Generate cache key for request
 */
function generateCacheKey(
    req: any,
    customKey?: string | ((req: any) => string)
): string {
    if (typeof customKey === "function") {
        return customKey(req);
    }

    if (typeof customKey === "string") {
        return customKey;
    }

    // Auto-generate key based on route and params
    const baseKey = `${req.method}:${req.route?.path || req.path}`;
    const params =
        Object.keys(req.params).length > 0
            ? `:${JSON.stringify(req.params)}`
            : "";
    const query =
        Object.keys(req.query).length > 0
            ? `:${JSON.stringify(req.query)}`
            : "";

    return `${baseKey}${params}${query}`;
}

/**
 * Create cache middleware for routes
 */
export function createCacheMiddleware(
    cache: SecureCacheAdapter,
    options: RouteOptions = {}
): RequestHandler {
    return async (req: any, res: any, next?: NextFunction) => {
        // Skip caching if disabled
        if (options.cache?.enabled === false) {
            return next?.();
        }
        // Only cache GET requests by default
        if (req.method !== "GET") {
            return next?.();
        }

        try {
            const cacheKey = generateCacheKey(req as any, options.cache?.key);
            const startTime = Date.now();

            // Try to get from cache
            const cachedData = await cache.get(cacheKey);

            if (cachedData) {
                const cacheTime = Date.now() - startTime;

                // Log ultra-fast cache hits
                if (cacheTime < 5) {
                    console.log(` CACHE HIT (${cacheTime}ms): ${cacheKey}`);
                } else {
                    console.log(` CACHE HIT (${cacheTime}ms): ${cacheKey}`);
                }

                // Set cache headers
                res.set("X-Cache", "HIT");
                res.set("X-Cache-Time", `${cacheTime}ms`);

                return res.json(cachedData);
            }

            // Cache miss - continue to handler
            res.set("X-Cache", "MISS");

            // Override res.json to cache the response
            const originalJson = res.json.bind(res);
            res.json = function (data: any) {
                // Cache the response asynchronously
                setImmediate(async () => {
                    try {
                        const ttl = options.cache?.ttl || 300000; // 5 minutes default
                        await cache.set(cacheKey, data, {
                            ttl,
                            tags: options.cache?.tags,
                        });

                        console.log(` CACHED: ${cacheKey} (TTL: ${ttl}ms)`);
                    } catch (error: any) {
                        console.error("Cache set error:", error);
                    }
                });

                return originalJson(data);
            };

            next?.();
        } catch (error: any) {
            console.error("Cache middleware error:", error);
            next?.(); // Continue without caching on error
        }
    };
}

// Express-free exports
export type {
    ServerOptions,
    RouteOptions,
    UltraFastApp,
    Request,
    Response,
    NextFunction,
    RequestHandler,
    MultiServerConfig,
} from "../types/types";

/**
 * Multi-Server App interface for managing multiple server instances
 * Extends UltraFastApp to maintain API compatibility
 */
export interface MultiServerApp extends Omit<UltraFastApp, 'start'> {
    /**
     * Start all server instances (simple API - hides complexity)
     */
    start(): Promise<void>;

    /**
     * Start all servers (alias for start - more explicit)
     */
    startAllServers(): Promise<void>;

    /**
     * Stop all server instances
     */
    stop(): Promise<void>;

    /**
     * Stop all servers (alias for stop - more explicit)
     */
    stopAllServers(): Promise<void>;

    /**
     * Get all server instances
     */
    getServers(): MultiServerInstance[];

    /**
     * Get a specific server instance by ID
     */
    getServer(id: string): MultiServerInstance | undefined;

    /**
     * Get multi-server statistics
     */
    getStats(): any;
}

/**
 * Create a MultiServerApp instance
 */
function createMultiServerApp(
    manager: MultiServerManager,
    serverConfigs: MultiServerConfig[],
    logger: Logger
): UltraFastApp {
    // Store routes registered before servers start
    const globalRoutes: Array<{
        method: string;
        path: string;
        handlers: RequestHandler[];
    }> = [];

    // Route registration methods
    const routeMethods = {
        get(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'GET', path, handlers });
        },
        post(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'POST', path, handlers });
        },
        put(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'PUT', path, handlers });
        },
        delete(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'DELETE', path, handlers });
        },
        patch(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'PATCH', path, handlers });
        },
        options(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'OPTIONS', path, handlers });
        },
        head(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'HEAD', path, handlers });
        },
        all(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: 'ALL', path, handlers });
        },
        use(...args: any[]) {
            // Handle router middleware: app.use('/api', router)
            if (args.length === 2 && typeof args[0] === 'string' && args[1] && typeof args[1].getRoutes === 'function') {
                const basePath = args[0];
                const router = args[1];

                // Extract routes from router and add them to globalRoutes with prefixed paths
                const routerRoutes = router.getRoutes();
                routerRoutes.forEach((route: any) => {
                    const fullPath = basePath + (route.path === '/' ? '' : route.path);
                    globalRoutes.push({
                        method: route.method,
                        path: fullPath,
                        handlers: [...(route.middleware || []), route.handler]
                    });
                });

                logger.debug("server", `Router middleware registered at ${basePath} with ${routerRoutes.length} routes`);
            } else {
                // Other middleware registration - for now, just log
                logger.debug("server", "Middleware registered (not yet distributed to servers)");
            }
        },

        // UltraFastApp compatibility methods
        set(setting: string, val: any) { /* no-op */ },
        getSetting(setting: string) { return undefined; },
        enabled(setting: string) { return false; },
        disabled(setting: string) { return true; },
        enable(setting: string) { /* no-op */ },
        disable(setting: string) { /* no-op */ },
        engine(ext: string, fn: any) { return undefined as any; },
        param(name: string, handler: any) { /* no-op */ },
        path() { return ''; },
        render(view: string, options?: any, callback?: any) { /* no-op */ },
        route(path: string) { return {}; },
        locals: {},
        mountpath: '',
        settings: {},
        cache: undefined,
        invalidateCache: () => Promise.resolve(),
        getCacheStats: () => Promise.resolve({}),
        warmUpCache: () => Promise.resolve(),
        waitForReady: () => Promise.resolve(),
        getPort: () => 0,
        forceClosePort: () => Promise.resolve(false),
        redirectFromPort: () => Promise.resolve(false as any),
        getRedirectInstance: () => null,
        getAllRedirectInstances: () => [],
        disconnectRedirect: () => Promise.resolve(false),
        disconnectAllRedirects: () => Promise.resolve(false),
        getRedirectStats: () => null,
        getRequestPreCompiler: () => ({} as any),
        getConsoleInterceptor: () => ({}),
        enableConsoleInterception: () => {},
        disableConsoleInterception: () => {},
        getConsoleStats: () => ({}),
        resetConsoleStats: () => {},
        getFileWatcherStatus: () => ({}),
        getFileWatcherStats: () => ({}),
        stopFileWatcher: () => Promise.resolve(),
        getFileWatcherManager: () => ({}),
        checkTypeScript: () => Promise.resolve([]),
        getTypeScriptStatus: () => ({}),
        enableTypeScriptChecking: () => {},
        disableTypeScriptChecking: () => {},
        enableConsoleEncryption: () => {},
        disableConsoleEncryption: () => {},
        encrypt: () => {},
        setConsoleEncryptionKey: () => {},
        setConsoleEncryptionDisplayMode: () => {},
        getEncryptedLogs: () => [],
        restoreConsoleFromEncrypted: () => Promise.resolve([]),
        isConsoleEncryptionEnabled: () => false,
        getConsoleEncryptionStatus: () => ({ enabled: false, hasKey: false }),
        getRouterStats: () => ({}),
        getRouterInfo: () => ({}),
        warmUpRoutes: () => Promise.resolve(),
        resetRouterStats: () => {},
        middleware: () => ({
            security: (config: any) => {
                // Apply security middleware to all existing servers
                const servers = manager.getAllServers();
                servers.forEach((instance) => {
                    const serverApp = instance.server.getApp();
                    if (serverApp && serverApp.middleware) {
                        const serverMiddleware = serverApp.middleware();
                        if (serverMiddleware && typeof serverMiddleware.security === 'function') {
                            serverMiddleware.security(config);
                        }
                    }
                });

                // Store security config for future servers
                (global as any).multiServerSecurityConfig = config;

                logger.debug("server", `Applied security middleware to ${servers.length} servers`);
                return {};
            },
            enable: (id: string) => {
                // Apply enable to all existing servers
                const servers = manager.getAllServers();
                servers.forEach((instance) => {
                    const serverApp = instance.server.getApp();
                    if (serverApp && serverApp.middleware) {
                        const serverMiddleware = serverApp.middleware();
                        if (serverMiddleware && typeof serverMiddleware.enable === 'function') {
                            serverMiddleware.enable(id);
                        }
                    }
                });
                logger.debug("server", `Enabled middleware ${id} on ${servers.length} servers`);
                return {};
            }
        } as any),
        upload: undefined,
        uploadSingle: () => ({}),
        uploadArray: () => ({}),
        uploadFields: () => ({}),
        uploadAny: () => ({}),
        scaleUp: () => Promise.resolve(),
        scaleDown: () => Promise.resolve(),
        autoScale: () => Promise.resolve(),
        getClusterMetrics: () => Promise.resolve({}),
        getClusterHealth: () => Promise.resolve({}),
        getAllWorkers: () => [],
        getOptimalWorkerCount: () => Promise.resolve(1),
        restartCluster: () => Promise.resolve(),
        stopCluster: () => Promise.resolve(),
        broadcastToWorkers: () => Promise.resolve(),
        sendToRandomWorker: () => Promise.resolve(),
        registerPlugin: () => Promise.resolve(),
        unregisterPlugin: () => Promise.resolve(),
        getPlugin: () => ({}),
        getAllPlugins: () => [],
        getPluginsByType: () => [],
        getPluginStats: () => ({}),
        getPluginRegistryStats: () => ({}),
        getPluginEngineStats: () => ({}),
        initializeBuiltinPlugins: () => Promise.resolve(),
        getServerPluginManager: () => ({}),
        serverPluginManager: undefined,
        registerRouteTemplate: () => {},
        unregisterRouteTemplate: () => {},
        registerOptimizationPattern: () => {},
        getOptimizerStats: () => ({}),
    };

    return {
        ...routeMethods,

        async start(): Promise<void> {
            return this.startAllServers?.();
        },

        async startAllServers(): Promise<void> {
            logger.info("server", "Starting multi-server configuration...");

            // Create server instances
            const instances = await manager.createServers(serverConfigs);

            // Distribute routes to appropriate servers
            for (const route of globalRoutes) {
                for (const instance of instances) {
                    const serverApp = instance.server.getApp();

                    // Check if this route should be registered on this server
                    if (shouldRegisterRouteOnServer(route.path, instance.config)) {
                        try {
                            const method = route.method.toLowerCase();
                            if (method === 'all') {
                                serverApp.all(route.path, ...route.handlers);
                            } else if (typeof (serverApp as any)[method] === 'function') {
                                (serverApp as any)[method](route.path, ...route.handlers);
                            }
                        } catch (error) {
                            logger.error("server", `Failed to register route ${route.method} ${route.path} on server ${instance.id}:`, error);
                        }
                    }
                }
            }

            // Start all servers
            await manager.startAllServers();
            logger.info("server", `Multi-server configuration started with ${instances.length} servers`);
        },

        async stop(): Promise<void> {
            return this?.stopAllServers?.();
        },

        async stopAllServers(): Promise<void> {
            logger.info("server", "Stopping multi-server configuration...");
            await manager.stopAllServers();
            logger.info("server", "Multi-server configuration stopped");
        },

        getServers(): MultiServerInstance[] {
            return manager.getAllServers();
        },

        getServer(id: string): MultiServerInstance | undefined {
            return manager.getServer(id);
        },

        getStats(): any {
            return manager.getStats();
        }
    };
}





/**
 * Check if a route should be registered on a specific server
 */
function shouldRegisterRouteOnServer(routePath: string, serverConfig: MultiServerConfig): boolean {
    // If no route filtering is configured, allow all routes
    if (!serverConfig.allowedRoutes && !serverConfig.routePrefix) {
        return true;
    }

    // Check route prefix
    if (serverConfig.routePrefix && routePath.startsWith(serverConfig.routePrefix)) {
        return true;
    }

    // Check allowed routes patterns
    if (serverConfig.allowedRoutes) {
        return serverConfig.allowedRoutes.some(pattern => {
            if (pattern.endsWith('/*')) {
                // Wildcard pattern
                const prefix = pattern.slice(0, -2);
                return routePath.startsWith(prefix);
            } else {
                // Exact match
                return routePath === pattern;
            }
        });
    }

    return false;
}


export type {MultiServerApp as XyPMS}