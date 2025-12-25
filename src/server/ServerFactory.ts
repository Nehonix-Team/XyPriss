/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
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
import {
    MultiServerManager,
    MultiServerInstance,
} from "./components/multi-server/MultiServerManager";
import { Logger, initializeLogger } from "../../shared/logger/Logger";
import { Configs } from "../config";
import { shouldRegisterRouteOnServer } from "./utils/shouldRegisterRouteOnServer";
import { PluginManager } from "../plugins/core/PluginManager";
import { setGlobalPluginManager } from "../plugins/api/PluginAPI";
import { configLoader } from "./utils/ConfigLoader";

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
 * Create UF XyPriss server (zero-async)
 * Returns app instance ready to use immediately
 * If multi-server mode is enabled, returns an UltraFastApp with multi-server methods
 */
export function createServer(options: ServerOptions = {}): UltraFastApp {
    // Load and apply system configuration from xypriss.config.json
    configLoader.loadAndApplySysConfig();

    if (options.env) {
        process.env["NODE_ENV"] = options.env;
        if (typeof globalThis !== "undefined" && (globalThis as any).__sys__) {
            (globalThis as any).__sys__.$update({ __env__: options.env });
        }
    }

    // Update __sys__ with port if provided
    if (
        options.server?.port &&
        typeof globalThis !== "undefined" &&
        (globalThis as any).__sys__
    ) {
        (globalThis as any).__sys__.$update({ __port__: options.server.port });
    }

    // Merge user options with default configs (Configs already has defaults)
    // This makes Configs the SINGLE SOURCE OF TRUTH
    Configs.merge(options);

    // Check if multi-server mode is enabled
    if (options.multiServer?.enabled && options.multiServer.servers) {
        // Handle worker mode automatically and transparently
        const workerOptions = handleWorkerMode(options);

        // Update Configs with worker mode adjustments
        Configs.merge(workerOptions);

        // Create multi-server manager (reads from Configs)
        const logger = initializeLogger(Configs.get("logging"));
        const multiServerManager = new MultiServerManager(
            Configs.getAll(),
            logger
        );

        // Create and return multi-server app interface
        return createMultiServerApp(
            multiServerManager,
            options.multiServer.servers,
            logger
        );
    }

    // Handle worker mode automatically and transparently
    const workerOptions = handleWorkerMode(options);

    // Update Configs with worker mode adjustments
    Configs.merge(workerOptions);

    // Create server - XyPrissServer will read from Configs instead of receiving options
    const server = new XyPrissServer();
    const app = server.getApp();

    // ALWAYS initialize XyPrissPlugin system to support imperative API (Plugin.exec())
    // Even if no plugins in config, we need PluginManager for plugins registered via Plugin.exec()
    const pluginManager = new PluginManager({ app });

    // Set global plugin manager for imperative API (Plugin.register, Plugin.get, etc.)
    // This will transfer any pending plugins registered before server creation
    setGlobalPluginManager(pluginManager);

    // Register plugins from config (if any)
    const pluginsConfig = Configs.get("plugins");
    if (pluginsConfig?.register && pluginsConfig.register.length > 0) {
        for (const plugin of pluginsConfig.register) {
            pluginManager.register(plugin);
        }
    }

    // Initialize plugins (resolve dependencies, call onServerStart)
    // Store the promise so it can be awaited in app.start()
    const pluginInitPromise = pluginManager.initialize().catch((error: any) => {
        const logger = Logger.getInstance();
        logger.error("plugins", "Failed to initialize plugins:", error);
    });

    // Store plugin manager and init promise for later use
    (app as any).pluginManager = pluginManager;
    (app as any).pluginInitPromise = pluginInitPromise;

    // Apply plugin error handlers BEFORE routes (wraps route methods)
    pluginManager.applyErrorHandlers(app);

    // Register plugin routes (will be wrapped by error handlers)
    pluginManager.registerRoutes(app);

    // Apply plugin middleware
    pluginManager.applyMiddleware(app);

    // Apply hooks integrator middleware for request timing
    const hooksIntegrator = pluginManager.getHooksIntegrator();
    if (hooksIntegrator) {
        app.use(hooksIntegrator.createTimingMiddleware());
        app.use(hooksIntegrator.createErrorHandlerMiddleware());
    }

    return app;
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
                const logger = Logger.getInstance();
                logger.info(
                    "cluster",
                    `Worker ${process.env.WORKER_ID} initialized with port ${finalOptions.server?.port}`
                );
            }
        } catch (error) {
            const logger = Logger.getInstance();
            logger.error(
                "cluster",
                "Failed to parse worker configuration",
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
    // Merge options with Configs
    Configs.merge(options);

    // Use the same worker mode handling as createServer
    const workerOptions = handleWorkerMode(options);
    Configs.merge(workerOptions);

    return new XyPrissServer();
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
                const logger = Logger.getInstance();
                if (cacheTime < 5) {
                    logger.debug(
                        "cache",
                        `CACHE HIT (${cacheTime}ms): ${cacheKey}`
                    );
                } else {
                    logger.debug(
                        "cache",
                        `CACHE HIT (${cacheTime}ms): ${cacheKey}`
                    );
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

                        const logger = Logger.getInstance();
                        logger.debug(
                            "cache",
                            `CACHED: ${cacheKey} (TTL: ${ttl}ms)`
                        );
                    } catch (error: any) {
                        const logger = Logger.getInstance();
                        logger.error("cache", "Cache set error", error);
                    }
                });

                return originalJson(data);
            };

            next?.();
        } catch (error: any) {
            const logger = Logger.getInstance();
            logger.error("cache", "Cache middleware error", error);
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
export interface MultiServerApp extends Omit<UltraFastApp, "start"> {
    /**
     * Start all server instances (simple API - hides complexity)
     * @param port - Port parameter (ignored in multi-server mode)
     * @param callback - Callback function called when all servers are started
     */
    start(port?: number, callback?: () => void): Promise<void>;

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
            globalRoutes.push({ method: "GET", path, handlers });
        },
        post(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "POST", path, handlers });
        },
        put(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "PUT", path, handlers });
        },
        delete(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "DELETE", path, handlers });
        },
        patch(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "PATCH", path, handlers });
        },
        options(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "OPTIONS", path, handlers });
        },
        head(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "HEAD", path, handlers });
        },
        all(path: string, ...handlers: RequestHandler[]) {
            globalRoutes.push({ method: "ALL", path, handlers });
        },
        use(...args: any[]) {
            // Handle router middleware: app.use('/api', router)
            if (
                args.length === 2 &&
                typeof args[0] === "string" &&
                args[1] &&
                typeof args[1].getRoutes === "function"
            ) {
                const basePath = args[0];
                const router = args[1];

                // Extract routes from router and add them to globalRoutes with prefixed paths
                const routerRoutes = router.getRoutes();
                routerRoutes.forEach((route: any) => {
                    const fullPath =
                        basePath + (route.path === "/" ? "" : route.path);
                    globalRoutes.push({
                        method: route.method,
                        path: fullPath,
                        handlers: [...(route.middleware || []), route.handler],
                    });
                });

                logger.debug(
                    "server",
                    `Router middleware registered at ${basePath} with ${routerRoutes.length} routes`
                );
            } else {
                // Other middleware registration - for now, just log
                logger.debug(
                    "server",
                    "Middleware registered (not yet distributed to servers)"
                );
            }
        },

        // UltraFastApp compatibility methods
        set(setting: string, val: any) {
            /* no-op */
        },
        getSetting(setting: string) {
            return undefined;
        },
        enabled(setting: string) {
            return false;
        },
        disabled(setting: string) {
            return true;
        },
        enable(setting: string) {
            /* no-op */
        },
        disable(setting: string) {
            /* no-op */
        },
        engine(ext: string, fn: any) {
            return undefined as any;
        },
        param(name: string, handler: any) {
            /* no-op */
        },
        path() {
            return "";
        },
        render(view: string, options?: any, callback?: any) {
            /* no-op */
        },
        route(path: string) {
            return {};
        },
        locals: {},
        mountpath: "",
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
        middleware: () =>
            ({
                security: (config: any) => {
                    // Apply security middleware to all existing servers
                    const servers = manager.getAllServers();
                    servers.forEach((instance) => {
                        const serverApp = instance.server.getApp();
                        if (serverApp && serverApp.middleware) {
                            const serverMiddleware = serverApp.middleware();
                            if (
                                serverMiddleware &&
                                typeof serverMiddleware.security === "function"
                            ) {
                                serverMiddleware.security(config);
                            }
                        }
                    });

                    // Store security config for future servers
                    (global as any).multiServerSecurityConfig = config;

                    logger.debug(
                        "server",
                        `Applied security middleware to ${servers.length} servers`
                    );
                    return {};
                },
                enable: (id: string) => {
                    // Apply enable to all existing servers
                    const servers = manager.getAllServers();
                    servers.forEach((instance) => {
                        const serverApp = instance.server.getApp();
                        if (serverApp && serverApp.middleware) {
                            const serverMiddleware = serverApp.middleware();
                            if (
                                serverMiddleware &&
                                typeof serverMiddleware.enable === "function"
                            ) {
                                serverMiddleware.enable(id);
                            }
                        }
                    });
                    logger.debug(
                        "server",
                        `Enabled middleware ${id} on ${servers.length} servers`
                    );
                    return {};
                },
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

        async start(port?: number, callback?: () => void): Promise<void> {
            await this.startAllServers?.();
            if (callback) {
                callback();
            }
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
                    if (
                        shouldRegisterRouteOnServer(route.path, instance.config)
                    ) {
                        try {
                            const method = route.method.toLowerCase();
                            if (method === "all") {
                                serverApp.all(route.path, ...route.handlers);
                            } else if (
                                typeof (serverApp as any)[method] === "function"
                            ) {
                                (serverApp as any)[method](
                                    route.path,
                                    ...route.handlers
                                );
                            }
                        } catch (error) {
                            logger.error(
                                "server",
                                `Failed to register route ${route.method} ${route.path} on server ${instance.id}:`,
                                error
                            );
                        }
                    }
                }
            }

            // Start all servers
            await manager.startAllServers();
            logger.info(
                "server",
                `Multi-server configuration started with ${instances.length} servers`
            );
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
        },
    };
}

export type { MultiServerApp as XyPMS };

