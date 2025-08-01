/**
 * XyPrissJS - Fast and Secure Express Server
 * Main server class for XyPrissJS
 */

import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

// Import types
import type {
    ServerOptions,
    UltraFastApp,
    UltraFastMiddlewareHandler,
} from "../types/types";
import type { PluginType } from "../plugins/modules/types/PluginTypes";

// Import plugin classes
import { PluginManager } from "./components/fastapi/PluginManager";
import { PluginManager as ServerPluginManager } from "../plugins/plugin-manager";
import {
    CompressionPlugin,
    ConnectionPlugin,
    ProxyPlugin,
    RateLimitPlugin,
} from "../plugins/modules";

// Import utils
import { Logger, initializeLogger } from "../../shared/logger/Logger";
import { PortManager, PortSwitchResult } from "./utils/PortManager";
import { Port } from "./utils/forceClosePort";
import { ConfigLoader } from "./utils/ConfigLoader";
import { DEFAULT_OPTIONS } from "./const/default";

// Import component classes
import { CacheManager } from "./components/fastapi/CacheManager";
import { MiddlewareMethodsManager } from "./components/fastapi/middlewares/MiddlewareMethodsManager";
import { RequestProcessor } from "./components/fastapi/RequestProcessor";
import { RouteManager } from "./components/fastapi/RouteManager";
import { PerformanceManager } from "./components/fastapi/PerformanceManager";
import { MonitoringManager } from "./components/fastapi/MonitoringManager";
import { ClusterManagerComponent } from "./components/fastapi/ClusterManagerComponent";
import { FileWatcherManager } from "./components/fastapi/FileWatcherManager";
import { MiddlewareManager } from "./components/fastapi/middlewares/middlewareManager";
import { RedirectManager } from "./components/fastapi/RedirectManager";
import { ConsoleInterceptor } from "./components/fastapi/console/ConsoleInterceptor";
import { UltraFastRequestProcessor } from "./components/fastapi/UltraFastRequestProcessor"; // UFRP
import { createSafeJsonMiddleware } from "../middleware/safe-json-middleware";
import { RateLimitConfig } from "../types/mod/security";
import { netConfig } from "./conf/networkConnectionConf";
import { rateLimitConfig } from "./conf/rateLimitConfig";
import { proxyConfig } from "./conf/proxyConfig";
import { createNotFoundHandler } from "./handlers/NotFoundHandler";

/**
 * Ultra-Fast Express Server with Advanced Performance Optimization
 */
export class XyPrissServer {
    // UFS Core
    private app: UltraFastApp;
    private options: ServerOptions;
    private ready = false;
    private initPromise: Promise<void> = Promise.resolve();
    private httpServer?: any;
    private logger: Logger;
    private currentPort: number = 0; // Track the actual running port

    // Component instances
    private cacheManager!: CacheManager;
    private middlewareManager!: MiddlewareManager;
    private middlewareMethodsManager!: MiddlewareMethodsManager;
    private requestProcessor!: RequestProcessor;
    private routeManager!: RouteManager;
    private performanceManager!: PerformanceManager;
    private monitoringManager!: MonitoringManager;
    private pluginManager!: PluginManager;
    private clusterManager!: ClusterManagerComponent;
    private fileWatcherManager!: FileWatcherManager;
    private redirectManager!: RedirectManager;
    private consoleInterceptor!: ConsoleInterceptor;
    private notFoundHandler: any;
    private ultraFastProcessor!: UltraFastRequestProcessor;
    private serverPluginManager!: ServerPluginManager;

    constructor(
        userOptions: ServerOptions = {
            server: {
                enableMiddleware: true,
            },
        }
    ) {
        // Load configuration from file system if available
        const fileConfig = ConfigLoader.loadConfig();

        // Merge configurations: defaults < file config < user options
        this.options = this.mergeWithDefaults(userOptions, fileConfig);

        // Initialize logger with user configuration
        this.logger = initializeLogger(this.options.logging);

        this.logger.startup("server", "Creating server...");

        // Create Express app immediately
        this.app = express() as unknown as UltraFastApp;

        // Expose logger on app object for debugging
        (this.app as any).logger = this.logger;

        // Add start method immediately so it's available right away
        this.addStartMethod();

        // Add basic middleware methods immediately for developer-friendly API
        this.addImmediateMiddlewareMethods();

        // Initialize ultra-fast processor first (using legacy config for backward compatibility)
        this.ultraFastProcessor = new UltraFastRequestProcessor({
            cpuWorkers: this.options.performance?.workers?.cpu || 4,
            ioWorkers: this.options.performance?.workers?.io || 2,
            maxCacheSize: this.options.cache?.maxSize || 1000,
            enablePrediction: true,
            enableCompression: true,
            maxConcurrentTasks: 100,
        });

        // Add automatic JSON and URL-encoded body parsing (unless disabled)
        if (this.options.server?.autoParseJson !== false) {
            this.addBodyParsingMiddleware();
        }

        // Add safe JSON middleware to handle circular references
        this.addSafeJsonMiddleware();

        // Add ultra-fast middleware with type coercion
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const handler =
                this.ultraFastProcessor.middleware() as UltraFastMiddlewareHandler;
            handler(req, res, next, "", {}).catch(next);
        });

        // Initialize other components asynchronously
        this.initPromise = this.initializeComponentsAsync();

        this.logger.debug(
            "server",
            "Ultra-fast Express server created with optimized request processing"
        );
    }

    private async initializeComponentsAsync(): Promise<void> {
        // Initialize components in parallel for faster startup
        await Promise.all([
            this.initializeCache(),
            this.initializePerformance(),
            this.initializePlugins(),
            this.initializeCluster(),
            this.initializeFileWatcher(),
        ]);

        // Initialize components that depend on others
        await this.initializeDependentComponents();

        // Add routes and monitoring endpoints
        this.routeManager.addMethods();
        this.monitoringManager.addMonitoringEndpoints();
        this.addConsoleInterceptionMethods();

        // Add custom 404 handler as the last middleware
        this.app.use(this.notFoundHandler.handler);

        this.ready = true;
    }

    private async initializeCache(): Promise<void> {
        this.cacheManager = new CacheManager({
            cache: this.options.cache,
            performance: this.options.performance,
            server: this.options.server,
            env: this.options.env,
        });

        this.app.cache = this.cacheManager.getCache();
        await this.cacheManager.initializeCache();
    }

    private async initializePerformance(): Promise<void> {
        this.performanceManager = new PerformanceManager(
            {
                performance: this.options.performance,
                server: this.options.server,
                env: this.options.env,
            },
            {
                app: this.app,
                cacheManager: this.cacheManager,
            }
        );
    }

    private async initializePlugins(): Promise<void> {
        this.pluginManager = new PluginManager({
            app: this.app,
            cacheManager: this.cacheManager,
        });
    }

    private async initializeCluster(): Promise<void> {
        // Only initialize cluster if it's explicitly configured and enabled
        if (this.options.cluster?.enabled) {
            this.clusterManager = new ClusterManagerComponent(
                {
                    cluster: this.options.cluster,
                },
                {
                    app: this.app,
                }
            );
        }
    }

    private async initializeFileWatcher(): Promise<void> {
        this.fileWatcherManager = new FileWatcherManager(
            {
                fileWatcher: this.options.fileWatcher,
            },
            {
                app: this.app,
                clusterManager: this.clusterManager,
            }
        );
    }

    private async initializeDependentComponents(): Promise<void> {
        // Initialize components that depend on others
        this.requestProcessor = new RequestProcessor({
            performanceProfiler:
                this.performanceManager.getPerformanceProfiler(),
            executionPredictor: this.performanceManager.getExecutionPredictor(),
            requestPreCompiler: this.performanceManager.getRequestPreCompiler(),
            pluginEngine: this.pluginManager.getPluginEngine(),
            cacheManager: this.cacheManager,
        });

        this.middlewareManager = new MiddlewareManager(
            {
                server: this.options.server,
                security: this.options.security,
                performance: this.options.performance,
                middleware: this.options.middleware,
            },
            {
                app: this.app,
                cache: this.cacheManager.getCache(),
                performanceProfiler:
                    this.performanceManager.getPerformanceProfiler(),
                executionPredictor:
                    this.performanceManager.getExecutionPredictor(),
                optimizationEnabled:
                    this.performanceManager.isOptimizationEnabled(),
                optimizationStats:
                    this.performanceManager.getOptimizationStats(),
                handleUltraFastPath: this.ultraFastProcessor
                    .middleware()
                    .bind(this.ultraFastProcessor),
                handleFastPath: this.requestProcessor.handleFastPath.bind(
                    this.requestProcessor
                ),
                handleStandardPath:
                    this.requestProcessor.handleStandardPath.bind(
                        this.requestProcessor
                    ),
            }
        );

        // Initialize remaining components
        this.middlewareMethodsManager = new MiddlewareMethodsManager({
            app: this.app,
            middlewareManager: this.middlewareManager,
        });

        // Add middleware methods to the app (this will upgrade the immediate methods)
        this.middlewareMethodsManager.addMiddlewareMethods();

        // Process any middleware that was queued during immediate usage
        this.processQueuedMiddleware();

        // Process any configs queued before middlewareManager was ready
        const appAny = this.app as any;
        if (
            appAny._immediateMiddlewareConfigs &&
            Array.isArray(appAny._immediateMiddlewareConfigs)
        ) {
            appAny._immediateMiddlewareConfigs.forEach((config: any) => {
                try {
                    this.middlewareManager.applyImmediateMiddleware(config);
                } catch (error) {
                    this.logger.warn(
                        "middleware",
                        `Failed to apply queued middleware config: ${error}`
                    );
                }
            });
            appAny._immediateMiddlewareConfigs = [];
        }

        this.routeManager = new RouteManager({
            app: this.app,
            cacheManager: this.cacheManager,
            middlewareManager: this.middlewareManager,
            ultraFastOptimizer: this.performanceManager.getUltraFastOptimizer(),
        });

        this.monitoringManager = new MonitoringManager(
            {
                monitoring: this.options.monitoring,
            },
            {
                app: this.app,
                cacheManager: this.cacheManager,
                performanceManager: this.performanceManager,
            }
        );

        // Initialize request management middleware
        this.initializeRequestManagement();

        // Initialize server plugins
        this.initializeServerPlugins();

        // Initialize network plugins automatically
        await this.initializeNetworkPlugins();

        this.redirectManager = new RedirectManager(this.logger);
        this.consoleInterceptor = new ConsoleInterceptor(
            this.logger,
            this.options.logging
        );

        // Initialize custom 404 handler
        this.notFoundHandler = createNotFoundHandler(this.options);

        if (this.options.logging?.consoleInterception?.enabled) {
            this.consoleInterceptor.start();
            this.logger.info(
                "console",
                "Console interception system activated"
            );
        }

        if (this.options.fileWatcher?.enabled) {
            this.fileWatcherManager.addFileWatcherMonitoringEndpoints(
                "/XyPriss"
            );
        }
    }

    /**
     * Get the Express app instance (ready to use immediately)
     */
    public getApp(): UltraFastApp {
        return this.app;
    }

    /**
     * Get the server plugin manager
     */
    public getServerPluginManager(): ServerPluginManager | undefined {
        return this.serverPluginManager;
    }

    /**
     * Wait for full initialization (cache, console interceptor, and all components)
     */
    public async waitForReady(): Promise<void> {
        // Wait for cache initialization
        await this.initPromise;

        // Wait for console interceptor to be ready if enabled
        if (
            this.options.logging?.consoleInterception?.enabled &&
            this.consoleInterceptor
        ) {
            // Give console interceptor a moment to fully initialize
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Mark as ready
        this.ready = true;

        this.logger.debug("server", "All components initialized and ready");
    }

    /**
     * Get the RequestPreCompiler instance for configuration
     */
    public getRequestPreCompiler() {
        return this.performanceManager.getRequestPreCompiler();
    }

    /**
     * Get the ConsoleInterceptor instance for configuration
     */
    public getConsoleInterceptor() {
        return this.consoleInterceptor;
    }

    /**
     * Merge user options with defaults and file config
     */
    private mergeWithDefaults(
        userOptions: ServerOptions,
        fileConfig: Partial<ServerOptions> | null = null
    ): ServerOptions {
        return {
            ...DEFAULT_OPTIONS,
            ...(fileConfig || {}),
            ...userOptions,
        };
    }

    /**
     * Handle automatic port switching when port is in use
     */
    private async handlePortSwitching(
        requestedPort: number,
        host: string = "localhost"
    ): Promise<PortSwitchResult> {
        const portManager = new PortManager(
            requestedPort,
            this.options.server?.autoPortSwitch
        );
        const result = await portManager.findAvailablePort(host);

        if (result.switched) {
            this.logger.portSwitching(
                "server",
                `🔄 Port ${requestedPort} was in use, switched to port ${result.port}`
            );
            this.logger.portSwitching(
                "server",
                `   Attempts: ${result.attempts}, Strategy: ${
                    portManager.getConfig()?.strategy || "increment"
                }`
            );
        }

        if (!result.success) {
            const maxAttempts =
                this.options.server?.autoPortSwitch?.maxAttempts || 10;
            throw new Error(
                `Failed to find an available port after ${maxAttempts} attempts. ` +
                    `Original port: ${requestedPort}, Last attempted: ${result.port}`
            );
        }

        return result;
    }

    /**
     * Start server with error handling and port switching
     */
    private async startServerWithPortHandling(
        port: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        try {
            // Check port availability first when auto port switch is enabled
            if (this.options.server?.autoPortSwitch?.enabled) {
                const portManager = new PortManager(
                    port,
                    this.options.server?.autoPortSwitch
                );
                const result = await portManager.findAvailablePort(host);

                if (!result.success) {
                    throw new Error(
                        `Failed to find an available port after ${
                            this.options.server?.autoPortSwitch?.maxAttempts ||
                            10
                        } attempts`
                    );
                }

                if (result.switched) {
                    this.logger.portSwitching(
                        "server",
                        `🔄 Port ${port} was in use, switched to port ${result.port}`
                    );
                    port = result.port; // Use the switched port
                }
            } else {
                // console.log(`🔧 [DEBUG] Port switching NOT enabled`);
            }

            // Try to start server on the requested port
            return new Promise((resolve, reject) => {
                const server = (this.app as any).listen(port, host, () => {
                    this.currentPort = port; // Track the actual running port
                    this.logger.info(
                        "server",
                        `Server running on ${host}:${port}`
                    );
                    this.logger.debug(
                        "server",
                        `State: ${this.ready ? "Ready" : "Initializing..."}`
                    );
                    if (callback) callback();
                    resolve(server);
                });

                server.on("error", async (error: any) => {
                    this.logger.debug(
                        "server",
                        `Server error on port ${port}: ${error.code} - ${error.message}`
                    );

                    if (error.code === "EADDRINUSE") {
                        // Port is in use, try auto-switching if enabled

                        if (this.options.server?.autoPortSwitch?.enabled) {
                            this.logger.info(
                                "server",
                                `🔄 Port ${port} is in use, attempting auto port switch...`
                            );
                            try {
                                const result = await this.handlePortSwitching(
                                    port,
                                    host
                                );
                                this.logger.info(
                                    "server",
                                    `✅ Found available port: ${result.port}`
                                );

                                // Recursively try with the new port
                                const newServer =
                                    await this.startServerWithPortHandling(
                                        result.port,
                                        host,
                                        callback
                                    );
                                resolve(newServer);
                            } catch (switchError) {
                                this.logger.error(
                                    "server",
                                    `❌ Port switching failed: ${switchError}`
                                );
                                reject(switchError);
                            }
                        } else {
                            reject(
                                new Error(
                                    `Failed to start server. Port ${port} is already in use. ` +
                                        `Enable autoPortSwitch in server config to automatically find an available port.`
                                )
                            );
                        }
                    } else {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Add automatic body parsing middleware for JSON and URL-encoded data
     */
    private addBodyParsingMiddleware(): void {
        // JSON body parsing
        this.app.use(
            express.json({
                limit: this.options.server?.jsonLimit || "10mb",
            })
        );

        // URL-encoded body parsing
        this.app.use(
            express.urlencoded({
                extended: true,
                limit: this.options.server?.urlEncodedLimit || "10mb",
            })
        );

        this.logger.debug(
            "middleware",
            "Automatic body parsing middleware added (JSON and URL-encoded)"
        );
    }

    /**
     * Add safe JSON middleware to handle circular references
     */
    private addSafeJsonMiddleware(): void {
        const safeJsonOptions = {
            enabled: true,
            maxDepth: 10,
            logCircularRefs: this.options.env === "development",
            truncateStrings: 1000,
        };

        this.app.use(createSafeJsonMiddleware(safeJsonOptions));

        this.logger.debug(
            "middleware",
            "Safe JSON middleware added for circular reference handling"
        );
    }

    /**
     * Apply middleware directly when MiddlewareManager is not available
     * Fallback method for immediate middleware application
     */
    private applyMiddlewareDirectly(config: any): void {
        // Apply rate limiting if configured
        if (config?.rateLimit && config.rateLimit !== true) {
            try {
                // const rateLimit = require("express-rate-limit");
                const rateLimitConfig = config.rateLimit as RateLimitConfig;
                const limiter = rateLimit({
                    windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000,
                    max: rateLimitConfig.max || 100,
                    message:
                        rateLimitConfig.message ||
                        "Too many requests from this IP, please try again later.",
                    standardHeaders: rateLimitConfig.standardHeaders || true,
                    legacyHeaders: rateLimitConfig.legacyHeaders || false,
                    handler: (rateLimitConfig as any).onLimitReached,
                });
                this.app.use(limiter);
            } catch (error) {}
        }

        // Apply CORS if configured
        if (config?.cors && config.cors !== true) {
            try {
                const cors = require("cors");
                const corsConfig = config.cors;
                const corsOptions = {
                    origin: corsConfig.origin || "*",
                    methods: corsConfig.methods || [
                        "GET",
                        "POST",
                        "PUT",
                        "DELETE",
                        "OPTIONS",
                    ],
                    allowedHeaders: corsConfig.allowedHeaders || [
                        "Origin",
                        "X-Requested-With",
                        "Content-Type",
                        "Accept",
                        "Authorization",
                    ],
                    credentials: corsConfig.credentials !== false,
                };
                this.app.use(cors(corsOptions));
            } catch (error) {}
        }

        // Apply security headers if configured
        if (config?.security && config.security !== true) {
            try {
                const helmet = require("helmet");
                this.app.use(helmet());
            } catch (error) {}
        }

        // Apply compression if configured
        if (config?.compression && config.compression !== true) {
            try {
                const compression = require("compression");
                this.app.use(compression());
            } catch (error) {
                this.logger.error(
                    "server",
                    "Failed to apply compression:",
                    error
                );
            }
        }
    }

    /**
     * Add immediate middleware methods for developer-friendly API
     * These work immediately without waiting for async initialization
     */
    private addImmediateMiddlewareMethods(): void {
        // Create a simple middleware queue for immediate use
        const middlewareQueue: Array<{
            handler: any;
            options?: any;
        }> = [];

        // Add immediate middleware() method that implements MiddlewareAPIInterface
        this.app.middleware = (config?: any): any => {
            // Always queue or apply middleware depending on initialization state
            if (config) {
                if (this.middlewareManager) {
                    // MiddlewareManager is ready, apply immediately
                    // console.log("using builtin class");
                    this.middlewareManager.applyImmediateMiddleware(config);
                } else {
                    // console.log("using dirrect msg");
                    // MiddlewareManager not ready, queue for later processing
                    this.logger.debug(
                        "server",
                        "MiddlewareManager not available, queuing for later processing"
                    );
                    // Store config for later application
                    if (!(this.app as any)._immediateMiddlewareConfigs) {
                        (this.app as any)._immediateMiddlewareConfigs = [];
                    }
                    (this.app as any)._immediateMiddlewareConfigs.push(config);
                    this.applyMiddlewareDirectly(config);
                }
            }

            return {
                register: (handler: any, options?: any) => {
                    // Store middleware for later registration
                    middlewareQueue.push({ handler, options });

                    // Also add it immediately to Express for basic functionality
                    this.app.use(handler);

                    return this; // Return for chaining
                },
                enable: (_id: string) => this,
                disable: (_id: string) => this,
                getInfo: () => [],
                getStats: () => ({}),
                unregister: (_id: string) => this,
                getConfig: () => config || {},
                clear: () => this,
                optimize: async () => this,
            };
        };

        // Store the queue for later processing
        (this.app as any)._middlewareQueue = middlewareQueue;

        // Add basic convenience methods
        this.app.enableSecurity = (_options?: any) => {
            // Basic security headers immediately
            this.app.use((_req: any, res: any, next: any) => {
                res.setHeader("X-Content-Type-Options", "nosniff");
                res.setHeader("X-Frame-Options", "DENY");
                res.setHeader("X-XSS-Protection", "1; mode=block");
                next();
            });
            return this.app;
        };

        this.app.enableCors = (_options?: any) => {
            // Basic CORS immediately
            this.app.use((_req: any, res: any, next: any) => {
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader(
                    "Access-Control-Allow-Methods",
                    "GET,POST,PUT,DELETE,OPTIONS"
                );
                res.setHeader(
                    "Access-Control-Allow-Headers",
                    "Content-Type,Authorization"
                );
                next();
            });
            return this.app;
        };

        this.app.enableCompression = (_options?: any) => {
            // Basic compression will be added when full middleware manager is ready
            return this.app;
        };

        this.app.enableRateLimit = (_options?: any) => {
            // Basic rate limiting will be added when full middleware manager is ready
            return this.app;
        };
    }

    /**
     * Initialize request management middleware for timeouts, network quality, and concurrency control
     */
    private initializeRequestManagement(): void {
        const requestConfig = this.options.requestManagement;
        if (!requestConfig) return;

        // Request timeout middleware
        if (requestConfig.timeout?.enabled) {
            this.app.use((req: any, res: any, next: any) => {
                const route = req.route?.path || req.path;
                const timeout =
                    requestConfig.timeout?.routes?.[route] ||
                    requestConfig.timeout?.defaultTimeout ||
                    30000;

                const timeoutId = setTimeout(() => {
                    if (!res.headersSent) {
                        if (requestConfig.timeout?.onTimeout) {
                            requestConfig.timeout.onTimeout(req, res);
                        } else {
                            res.status(408).json({
                                error: "Request timeout",
                                timeout: timeout,
                                path: req.path,
                                ...(requestConfig.timeout
                                    ?.includeStackTrace && {
                                    stack: new Error().stack,
                                }),
                            });
                        }
                    }
                }, timeout);

                // Clear timeout when response finishes
                res.on("finish", () => clearTimeout(timeoutId));
                res.on("close", () => clearTimeout(timeoutId));

                next();
            });
        }

        // Concurrency control middleware
        if (
            requestConfig.concurrency?.maxConcurrentRequests ||
            requestConfig.concurrency?.maxPerIP
        ) {
            const activeRequests = new Map<string, number>();
            let totalActiveRequests = 0;

            this.app.use((req: any, res: any, next: any) => {
                const clientIP = req.ip || req.connection.remoteAddress;
                const maxTotal =
                    requestConfig.concurrency?.maxConcurrentRequests ||
                    Infinity;
                const maxPerIP =
                    requestConfig.concurrency?.maxPerIP || Infinity;
                const currentPerIP = activeRequests.get(clientIP) || 0;

                // Check limits
                if (
                    totalActiveRequests >= maxTotal ||
                    currentPerIP >= maxPerIP
                ) {
                    if (requestConfig.concurrency?.onQueueOverflow) {
                        requestConfig.concurrency.onQueueOverflow(req, res);
                    } else {
                        res.status(429).json({
                            error: "Too many concurrent requests",
                            totalActive: totalActiveRequests,
                            maxTotal,
                            perIPActive: currentPerIP,
                            maxPerIP,
                        });
                    }
                    return;
                }

                // Track request
                totalActiveRequests++;
                activeRequests.set(clientIP, currentPerIP + 1);

                // Clean up when request finishes
                const cleanup = () => {
                    totalActiveRequests--;
                    const current = activeRequests.get(clientIP) || 0;
                    if (current <= 1) {
                        activeRequests.delete(clientIP);
                    } else {
                        activeRequests.set(clientIP, current - 1);
                    }
                };

                res.on("finish", cleanup);
                res.on("close", cleanup);

                next();
            });
        }

        this.logger.info("server", "Request management middleware initialized");
    }

    /**
     * Initialize server plugins for optimization and maintenance
     */
    private initializeServerPlugins(): void {
        if (!this.options.plugins) return;

        this.serverPluginManager = new ServerPluginManager(
            this.options.plugins
        );
        this.serverPluginManager.initialize(this.app, this.logger);

        // Expose plugin manager on app object
        (this.app as any).serverPluginManager = this.serverPluginManager;
        (this.app as any).getServerPluginManager = () =>
            this.serverPluginManager;

        // Setup plugin event handlers
        this.serverPluginManager.on("route_optimized", (data) => {
            this.logger.info("plugins", `Route optimized: ${data.routeKey}`);
        });

        this.serverPluginManager.on("maintenance_issue", (issue) => {
            this.logger.warn("plugins", `Maintenance issue: ${issue.message}`);
        });

        this.serverPluginManager.on("critical_issue", (issue) => {
            this.logger.error(
                "plugins",
                `Critical issue detected: ${issue.message}`
            );
        });

        this.logger.info("server", "Server plugins initialized");
    }

    /**
     * Initialize network plugins with user-configurable options
     */
    private async initializeNetworkPlugins(): Promise<void> {
        try {
            const networkConfig = this.options.network || {};

            // Initialize Connection Plugin
            if (networkConfig.connection?.enabled !== false) {
                await this.registerPlugin(
                    new ConnectionPlugin(netConfig(networkConfig))
                );
                this.logger.debug(
                    "server",
                    "Connection plugin initialized with user configuration"
                );
            }

            // Initialize Compression Plugin
            if (networkConfig.compression?.enabled !== false) {
                const compressionConfig = {
                    enabled: networkConfig.compression?.enabled ?? true,
                    algorithms: (networkConfig.compression?.algorithms?.filter(
                        (alg) => alg !== "br"
                    ) ?? ["gzip", "deflate"]) as ("gzip" | "deflate")[],
                    level: networkConfig.compression?.level ?? 6,
                    threshold: networkConfig.compression?.threshold ?? 1024,
                    contentTypes: networkConfig.compression?.contentTypes ?? [
                        "text/*",
                        "application/json",
                        "application/javascript",
                    ],
                };

                await this.registerPlugin(
                    new CompressionPlugin(compressionConfig)
                );
                this.logger.debug(
                    "server",
                    "Compression plugin initialized with user configuration"
                );
            }

            // Initialize Rate Limit Plugin
            if (networkConfig.rateLimit?.enabled !== false) {
                await this.registerPlugin(
                    new RateLimitPlugin(rateLimitConfig(networkConfig))
                );
                this.logger.debug(
                    "server",
                    "Rate limit plugin initialized with user configuration"
                );
            }

            // Initialize Proxy Plugin
            if (
                networkConfig.proxy?.enabled === true &&
                networkConfig.proxy?.upstreams?.length
            ) {
                await this.registerPlugin(
                    new ProxyPlugin(proxyConfig(networkConfig))
                );
                this.logger.debug(
                    "server",
                    "Proxy plugin initialized with user configuration"
                );
            } else if (networkConfig.proxy?.enabled !== false) {
                // Register proxy plugin in disabled state for potential runtime activation
                await this.registerPlugin(
                    new ProxyPlugin({
                        enabled: false,
                        upstreams: [],
                        loadBalancing: "round-robin",
                    })
                );
                this.logger.debug(
                    "server",
                    "Proxy plugin initialized in disabled state"
                );
            }

            this.logger.info(
                "server",
                "Network plugins initialized successfully with user configuration"
            );
        } catch (error: any) {
            this.logger.error(
                "server",
                "Failed to initialize network plugins:",
                error.message
            );
        }
    }

    /**
     * Process middleware that was queued during immediate usage
     */
    private processQueuedMiddleware(): void {
        const queue = (this.app as any)._middlewareQueue;
        if (queue && Array.isArray(queue)) {
            // Process each queued middleware with the full middleware manager
            queue.forEach(({ handler, options }) => {
                try {
                    this.middlewareManager.register(handler, options);
                } catch (error) {
                    this.logger.warn(
                        "middleware",
                        `Failed to register queued middleware: ${error}`
                    );
                }
            });

            // Clear the queue
            (this.app as any)._middlewareQueue = [];
        }
    }

    /**
     * Add start method to app with cluster support (full version)
     */
    private addStartMethod(): void {
        const start = async (port?: number, callback?: () => void) => {
            // **INTERNAL HANDLING**: Wait for server to be ready before starting
            // This ensures developers don't need to handle async initialization timing
            if (!this.ready) {
                this.logger.debug(
                    "server",
                    "Waiting for initialization to complete..."
                );
                await this.waitForReady();
                this.logger.info(
                    "server",
                    "Initialization complete, starting server..."
                );
            }

            const serverPort = port || this.options.server?.port || 3000;
            const host = this.options.server?.host || "localhost";

            // If we're in main process and hot reloader is enabled, start it first
            if (
                this.fileWatcherManager.isInMainProcess() &&
                this.fileWatcherManager.getHotReloader()
            ) {
                this.logger.debug("server", "Taking hot reload mode path");
                this.logger.startup(
                    "fileWatcher",
                    "Starting with hot reload support..."
                );

                try {
                    // Start the hot reloader (which will spawn child process)
                    await this.fileWatcherManager.getHotReloader()!.start();

                    // Start file watcher in main process to monitor changes
                    if (this.fileWatcherManager.getFileWatcher()) {
                        await this.fileWatcherManager.startFileWatcherWithHotReload();
                    }

                    // Start the actual HTTP server in the main process too
                    this.httpServer = await this.startServerWithPortHandling(
                        serverPort,
                        host,
                        async () => {
                            this.fileWatcherManager.setHttpServer(
                                this.httpServer
                            );
                            if (callback) callback();
                        }
                    );

                    return this.httpServer;
                } catch (error: any) {
                    this.logger.error(
                        "fileWatcher",
                        "Hot reload startup failed:",
                        error.message
                    );
                    // Fall through to regular startup
                }
            }

            // Regular startup (child process or hot reload disabled)

            // If cluster is enabled, use cluster manager
            if (this.clusterManager?.isClusterEnabled()) {
                this.logger.debug("server", "Taking cluster mode path");
                // console.log("Starting cluster...");

                try {
                    // Start cluster manager
                    await this.clusterManager.startCluster();

                    // Check if we're in master or worker process
                    if (process.env.NODE_ENV !== "worker") {
                        this.logger.startup(
                            "cluster",
                            "Starting as cluster master process"
                        );

                        // Setup cluster event handlers
                        this.clusterManager.setupClusterEventHandlers();

                        // Start HTTP server in master process
                        this.httpServer =
                            await this.startServerWithPortHandling(
                                serverPort,
                                host,
                                async () => {
                                    // Set HTTP server reference for file watcher restarts
                                    this.fileWatcherManager.setHttpServer(
                                        this.httpServer
                                    );
                                    const clusterStats =
                                        await this.clusterManager.getClusterStats();
                                    this.logger.debug(
                                        "cluster",
                                        `Cluster master started with ${
                                            clusterStats.workers?.total || 0
                                        } workers`
                                    );

                                    // Start file watcher if enabled
                                    if (
                                        this.fileWatcherManager.getFileWatcher()
                                    ) {
                                        if (
                                            this.fileWatcherManager.isInMainProcess()
                                        ) {
                                            // Main process: start with hot reload
                                            await this.fileWatcherManager.startFileWatcherWithHotReload();
                                        } else {
                                            // Child process: start regular file watcher
                                            await this.fileWatcherManager.startFileWatcher();
                                        }
                                    }

                                    if (callback) callback();
                                }
                            );

                        return this.httpServer;
                    } else {
                        // Worker process
                        this.logger.startup(
                            "cluster",
                            `Worker ${process.pid} started`
                        );

                        const httpServer =
                            await this.startServerWithPortHandling(
                                serverPort,
                                host,
                                () => {
                                    this.logger.info(
                                        "cluster",
                                        `Worker ${process.pid} listening on ${host}:${serverPort}`
                                    );
                                    if (callback) callback();
                                }
                            );

                        return httpServer;
                    }
                } catch (error: any) {
                    this.logger.error(
                        "cluster",
                        "Failed to start cluster:",
                        error.message
                    );
                    // Fallback to single process
                    this.logger.info(
                        "cluster",
                        "Falling back to single process mode"
                    );
                }
            }

            // Single process mode (default)
            this.logger.debug("server", "Taking single process mode path");
            this.httpServer = await this.startServerWithPortHandling(
                serverPort,
                host,
                async () => {
                    // Set HTTP server reference for file watcher restarts
                    this.fileWatcherManager.setHttpServer(this.httpServer);

                    // Start file watcher if enabled
                    if (this.fileWatcherManager.getFileWatcher()) {
                        if (this.fileWatcherManager.isInMainProcess()) {
                            // Main process: start with hot reload
                            await this.fileWatcherManager.startFileWatcherWithHotReload();
                        } else {
                            // Child process: start regular file watcher
                            await this.fileWatcherManager.startFileWatcher();
                        }
                    }

                    if (callback) callback();
                }
            );

            return this.httpServer;
        };

        this.app.start = start;
        this.app.waitForReady = () => this.waitForReady();

        // Add port management methods
        this.app.getPort = () => this.getPort();
        this.app.forceClosePort = (port: number) => this.forceClosePort(port);
        this.app.redirectFromPort = (
            fromPort: number,
            toPort: number,
            options?: any
        ) => this.redirectManager.redirectFromPort(fromPort, toPort, options);

        // Add advanced redirect management methods
        this.app.getRedirectInstance = (fromPort: number) =>
            this.redirectManager.getRedirectInstance(fromPort);
        this.app.getAllRedirectInstances = () =>
            this.redirectManager.getAllRedirectInstances();
        this.app.disconnectRedirect = (fromPort: number) =>
            this.redirectManager.disconnectRedirect(fromPort);
        this.app.disconnectAllRedirects = () =>
            this.redirectManager.disconnectAllRedirects();
        this.app.getRedirectStats = (fromPort: number) =>
            this.redirectManager.getRedirectStats(fromPort);

        // Cluster methods are already added in constructor if cluster is enabled
    }

    // File watcher functionality now handled by FileWatcherManager component

    /**
     * Stop file watcher
     */
    public async stopFileWatcher(): Promise<void> {
        await this.fileWatcherManager.stopFileWatcher();
    }

    /**
     * Get file watcher status
     */
    public getFileWatcherStatus(): any {
        return this.fileWatcherManager.getFileWatcherStatus();
    }

    /**
     * Get file watcher restart stats
     */
    public getFileWatcherStats(): any {
        return this.fileWatcherManager.getFileWatcherStats();
    }

    // ===== PLUGIN MANAGEMENT METHODS =====

    /**
     * Register a plugin with the server
     */
    public async registerPlugin(plugin: any): Promise<void> {
        await this.pluginManager.registerPlugin(plugin);
    }

    /**
     * Unregister a plugin from the server
     */
    public async unregisterPlugin(pluginId: string): Promise<void> {
        await this.pluginManager.unregisterPlugin(pluginId);
    }

    /**
     * Get plugin by ID
     */
    public getPlugin(pluginId: string): any {
        return this.pluginManager.getPlugin(pluginId);
    }

    /**
     * Get all registered plugins
     */
    public getAllPlugins(): any[] {
        return this.pluginManager.getAllPlugins();
    }

    /**
     * Get plugins by type
     */
    public getPluginsByType(type: PluginType): any[] {
        return this.pluginManager.getPluginsByType(type);
    }

    /**
     * Get plugin execution statistics
     */
    public getPluginStats(pluginId?: string): any {
        return this.pluginManager.getPluginStats(pluginId);
    }

    /**
     * Get plugin registry statistics
     */
    public getPluginRegistryStats(): any {
        return this.pluginManager.getPluginRegistryStats();
    }

    /**
     * Get plugin engine statistics
     */
    public getPluginEngineStats(): any {
        return this.pluginManager.getPluginEngineStats();
    }

    /**
     * Initialize built-in plugins including network plugins
     */
    public async initializeBuiltinPlugins(): Promise<void> {
        try {
            // Import and register built-in plugins
            const { JWTAuthPlugin } = await import(
                "../plugins/modules/builtin/JWTAuthPlugin"
            );
            const { ResponseTimePlugin } = await import(
                "../plugins/modules/builtin/ResponseTimePlugin"
            );
            const { SmartCachePlugin } = await import(
                "../plugins/modules/builtin/SmartCachePlugin"
            );

            // Register security plugins
            await this.registerPlugin(new JWTAuthPlugin());

            // Register performance plugins
            await this.registerPlugin(new ResponseTimePlugin());

            // Register cache plugins
            await this.registerPlugin(new SmartCachePlugin());

            this.logger.debug(
                "plugins",
                "Built-in plugins initialized successfully"
            );
        } catch (error: any) {
            this.logger.error(
                "plugins",
                "Failed to initialize built-in plugins:",
                error.message
            );
        }
    }

    /**
     * Get comprehensive server statistics including plugins
     */
    public async getServerStats(): Promise<any> {
        const cacheStats = await this.cacheManager.getCacheStats();
        const pluginRegistryStats = this.getPluginRegistryStats();
        const pluginEngineStats = this.getPluginEngineStats();

        return {
            server: {
                ready: this.ready,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
            },
            cache: cacheStats,
            plugins: {
                registry: pluginRegistryStats,
                engine: pluginEngineStats,
                totalPlugins: pluginRegistryStats.totalPlugins,
                averageExecutionTime: pluginRegistryStats.averageExecutionTime,
            },
            cluster: await this.clusterManager.getClusterStats(),
            fileWatcher: this.getFileWatcherStats(),
        };
    }

    // ===== CONSOLE INTERCEPTION METHODS =====

    /**
     * Add console interception methods to the Express app
     */
    private addConsoleInterceptionMethods(): void {
        // Get console interceptor instance
        this.app.getConsoleInterceptor = () => {
            return this.consoleInterceptor;
        };

        // Enable console interception
        this.app.enableConsoleInterception = () => {
            this.consoleInterceptor.start();
        };

        // Disable console interception
        this.app.disableConsoleInterception = () => {
            this.consoleInterceptor.stop();
        };

        // Get console interception statistics
        this.app.getConsoleStats = () => {
            return this.consoleInterceptor.getStats();
        };

        // Reset console interception statistics
        this.app.resetConsoleStats = () => {
            this.consoleInterceptor.resetStats();
        };

        // File watcher methods
        this.app.getFileWatcherStatus = () => {
            return this.getFileWatcherStatus();
        };

        this.app.getFileWatcherStats = () => {
            return this.getFileWatcherStats();
        };

        this.app.stopFileWatcher = async () => {
            return await this.stopFileWatcher();
        };

        // TypeScript checking methods
        this.app.checkTypeScript = async (files?: string[]) => {
            return await this.fileWatcherManager.checkTypeScript(files);
        };

        this.app.getTypeScriptStatus = () => {
            return this.fileWatcherManager.getTypeScriptStatus();
        };

        this.app.enableTypeScriptChecking = () => {
            this.fileWatcherManager.enableTypeScriptChecking();
        };

        this.app.disableTypeScriptChecking = () => {
            this.fileWatcherManager.disableTypeScriptChecking();
        };

        // Expose FileWatcherManager for debugging and advanced usage
        this.app.getFileWatcherManager = () => {
            return this.fileWatcherManager;
        };

        // 🔐 Console encryption methods
        this.app.enableConsoleEncryption = (key?: string) => {
            this.consoleInterceptor.enableEncryption(key);
        };

        this.app.disableConsoleEncryption = () => {
            this.consoleInterceptor.disableEncryption();
        };

        // Simple encrypt method
        this.app.encrypt = (key: string) => {
            this.consoleInterceptor.encrypt(key);
        };

        this.app.setConsoleEncryptionKey = (key: string) => {
            this.consoleInterceptor.setEncryptionKey(key);
        };

        this.app.setConsoleEncryptionDisplayMode = (
            displayMode: "readable" | "encrypted" | "both",
            showEncryptionStatus?: boolean
        ) => {
            this.consoleInterceptor.setEncryptionDisplayMode(
                displayMode,
                showEncryptionStatus
            );
        };

        this.app.getEncryptedLogs = () => {
            return this.consoleInterceptor.getEncryptedLogs();
        };

        this.app.restoreConsoleFromEncrypted = async (
            encryptedData: string[],
            key: string
        ) => {
            return await this.consoleInterceptor.restoreFromEncrypted(
                encryptedData,
                key
            );
        };

        this.app.isConsoleEncryptionEnabled = () => {
            return this.consoleInterceptor.isEncryptionEnabled();
        };

        this.app.getConsoleEncryptionStatus = () => {
            return this.consoleInterceptor.getEncryptionStatus();
        };
    }

    // ===== PORT MANAGEMENT METHODS =====

    /**
     * Get the actual running port number
     * @returns The current port the server is running on
     */
    public getPort(): number {
        return this.currentPort;
    }

    /**
     * Attempt to forcefully close/free up the specified port
     * @param port - The port number to force close
     * @returns Promise<boolean> - true if successful, false if failed
     */
    public async forceClosePort(port: number): Promise<boolean> {
        return await new Port(port).forceClosePort();
    }

    public async stop(): Promise<void> {
        // Cleanup ultra-fast processor
        this.ultraFastProcessor.destroy();

        // Stop other components
        if (this.httpServer) {
            await new Promise<void>((resolve) => {
                this.httpServer.close(() => resolve());
            });
        }
    }
}

export { XyPrissServer as FastXyPrissServer };

