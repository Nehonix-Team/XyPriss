/**
 * XyPrissJS - Fast and Secure Express Server
 * Main server class for XyPrissJS
 */

import { XyprissApp } from "./core/XyprissApp";
import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
    NextFunction,
} from "./../types/httpServer.type";

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
import { DEFAULT_HOST, DEFAULT_OPTIONS } from "./const/default";

// Import component classes
import { CacheManager } from "./components/fastapi/CacheManager";
import { RouteManager } from "./components/fastapi/RouteManager";
import { PerformanceManager } from "./components/fastapi/PerformanceManager";
import { MonitoringManager } from "./components/fastapi/MonitoringManager";
import { ClusterManagerComponent } from "./components/fastapi/ClusterManagerComponent";
import { FileWatcherManager } from "./components/fastapi/FileWatcherManager";
import { ConsoleInterceptor } from "./components/fastapi/console/ConsoleInterceptor";
import { WorkerPoolComponent } from "./components/fastapi/WorkerPoolComponent";
import { createSafeJsonMiddleware } from "../middleware/safe-json-middleware";
import { RateLimitConfig } from "../types/mod/security";
import { netConfig } from "./conf/networkConnectionConf";
import { rateLimitConfig } from "./conf/rateLimitConfig";
import { proxyConfig } from "./conf/proxyConfig";

// Import the new ServerLifecycleManager
import {
    ServerLifecycleManager,
    ServerLifecycleDependencies,
} from "./components/lifecycle/ServerLifecycleManager";
import { SecurityMiddleware } from "../middleware/security-middleware";

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

    // Component instances
    private cacheManager!: CacheManager;
    private routeManager!: RouteManager;
    private performanceManager!: PerformanceManager;
    private monitoringManager!: MonitoringManager;
    private pluginManager!: PluginManager;
    private clusterManager!: ClusterManagerComponent;
    private fileWatcherManager!: FileWatcherManager;
    private consoleInterceptor!: ConsoleInterceptor;
    private workerPoolComponent!: WorkerPoolComponent;
    private notFoundHandler: any;
    private serverPluginManager!: ServerPluginManager;
    private securityMiddleware?: SecurityMiddleware;

    // Server lifecycle manager
    private lifecycleManager!: ServerLifecycleManager;

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

        // Create custom HTTP server app (Express-free)
        this.app = new XyprissApp(this.logger) as unknown as UltraFastApp;

        // Expose logger on app object for debugging
        (this.app as any).logger = this.logger;

        // Initialize lifecycle manager
        this.initializeLifecycleManager();

        // Add automatic JSON and URL-encoded body parsing (unless disabled)
        if (this.options.server?.autoParseJson !== false) {
            this.addBodyParsingMiddleware();
        }

        // Add safe JSON middleware to handle circular references
        this.addSafeJsonMiddleware();

        // Initialize other components asynchronously
        this.initPromise = this.initializeComponentsAsync();

        this.logger.debug(
            "server",
            "XyPriss server created with optimized request processing"
        );
    }

    /**
     * Initialize the ServerLifecycleManager
     */
    private initializeLifecycleManager(): void {
        const dependencies: ServerLifecycleDependencies = {
            app: this.app,
            options: this.options,
            logger: this.logger,
        };

        this.lifecycleManager = new ServerLifecycleManager(dependencies);

        // Add start method immediately so it's available right away
        this.lifecycleManager.addStartMethod(() => this.waitForReady());
    }

    private async initializeComponentsAsync(): Promise<void> {
        // Initialize components in parallel for faster startup
        await Promise.all([
            this.initializeCache(),
            this.initializePerformance(),
            this.initializePlugins(),
            this.initializeCluster(),
            this.initializeFileWatcher(),
            this.initializeWorkerPool(),
            this.initializeSecurity(),
        ]);

        // Initialize components that depend on others
        await this.initializeDependentComponents();

        // Add routes and monitoring endpoints
        this.routeManager.addMethods();
        this.monitoringManager.addMonitoringEndpoints();
        this.addConsoleInterceptionMethods();

        // Note: 404 handler is now handled properly in HttpServer.handleRequest()
        // after route matching fails, not as middleware

        // Mark lifecycle manager as ready
        this.lifecycleManager.markReady();
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
        // Prevent workers from initializing clusters (fix recursive clustering)
        if (
            process.env.CLUSTER_MODE === "true" ||
            process.env.NODE_ENV === "worker"
        ) {
            this.logger.debug(
                "server",
                "Running in worker mode - skipping cluster initialization"
            );
            return;
        }

        // Only initialize cluster if it's explicitly configured and enabled
        if (this.options.cluster?.enabled) {
            this.clusterManager = new ClusterManagerComponent(
                {
                    cluster: this.options.cluster,
                },
                {
                    app: this.app,
                    serverOptions: this.options,
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

    private async initializeWorkerPool(): Promise<void> {
        // Only initialize worker pool if it's explicitly configured and enabled
        if (this.options.workerPool?.enabled) {
            this.workerPoolComponent = new WorkerPoolComponent(
                {
                    workerPool: this.options.workerPool,
                },
                {
                    app: this.app,
                    serverOptions: this.options,
                }
            );
        }
    }

    private async initializeSecurity(): Promise<void> {
        // Initialize security middleware if security is configured and enabled
        if (this.options.security?.enabled) {
            this.logger.debug("server", "Initializing security middleware...");

            // Create security middleware with the provided configuration
            // The SecurityMiddleware class implements all SecurityConfig options
            this.securityMiddleware = new SecurityMiddleware(
                this.options.security,
                this.logger
            );

            // Apply the comprehensive security middleware stack
            // This handles all security features based on configuration
            this.app.use(this.securityMiddleware.getMiddleware());

            this.logger.debug(
                "server",
                "Security middleware initialized successfully"
            );
            this.logger.debug(
                "server",
                `Security level: ${this.options.security.level || "enhanced"}`
            );
        } else {
            this.logger.debug(
                "server",
                "Security middleware disabled or not configured"
            );
        }
    }

    private async initializeDependentComponents(): Promise<void> {
        // Update lifecycle manager with initialized components
        this.lifecycleManager.dependencies.cacheManager = this.cacheManager;
        this.lifecycleManager.dependencies.performanceManager =
            this.performanceManager;
        this.lifecycleManager.dependencies.pluginManager = this.pluginManager;
        this.lifecycleManager.dependencies.clusterManager = this.clusterManager;
        this.lifecycleManager.dependencies.fileWatcherManager =
            this.fileWatcherManager;
        this.lifecycleManager.dependencies.workerPoolComponent =
            this.workerPoolComponent;

        // Use lifecycle manager to initialize dependent components
        await this.lifecycleManager.initializeDependentComponents();

        // Get the initialized components from lifecycle manager
        this.routeManager = this.lifecycleManager.dependencies.routeManager!;

        this.monitoringManager =
            this.lifecycleManager.dependencies.monitoringManager!;

        this.consoleInterceptor =
            this.lifecycleManager.dependencies.consoleInterceptor!;

        this.notFoundHandler =
            this.lifecycleManager.dependencies.notFoundHandler;

        // FastRouteHandler is now available through lifecycle manager
        // Access it via: this.lifecycleManager.dependencies.fastRouteHandler
        // Process any configs queued before middlewareManager was ready
        const appAny = this.app as any;
        if (
            appAny._immediateMiddlewareConfigs &&
            Array.isArray(appAny._immediateMiddlewareConfigs)
        ) {
            appAny._immediateMiddlewareConfigs.forEach((config: any) => {
                try {
                    // this.middlewareManager.applyImmediateMiddleware(config);
                } catch (error) {
                    this.logger.warn(
                        "middleware",
                        `Failed to apply queued middleware config: ${error}`
                    );
                }
            });
            appAny._immediateMiddlewareConfigs = [];
        }

        // Initialize request management middleware
        this.initializeRequestManagement();

        // Initialize server plugins
        this.initializeServerPlugins();

        // Initialize network plugins automatically
        await this.initializeNetworkPlugins();

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
     * Get the security middleware instance
     */
    public getSecurityMiddleware(): SecurityMiddleware | undefined {
        return this.securityMiddleware;
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
        host: string = DEFAULT_HOST
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
     * @deprecated - Now handled by ServerLifecycleManager
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
                // When auto port switch is disabled, check if port is available first
                const portManager = new PortManager(port, { enabled: false });
                const result = await portManager.findAvailablePort(host);

                if (!result.success) {
                    throw new Error(
                        `Failed to start server. Port ${port} is already in use. ` +
                            `Enable autoPortSwitch in server config to automatically find an available port.`
                    );
                }
            }

            // Try to start server on the requested port
            return new Promise((resolve, reject) => {
                const server = (this.app as any).listen(port, host, () => {
                    this.lifecycleManager.updateState({ currentPort: port }); // Track the actual running port
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
        // Custom JSON body parsing middleware (replaces express.json)
        this.app.use((_req: Request, _res: Response, next: NextFunction) => {
            // Body parsing is already handled in CustomHttpServer
            // This middleware is kept for compatibility
            next();
        });

        this.logger.debug(
            "middleware",
            "Custom body parsing middleware added (JSON and URL-encoded handled by CustomHttpServer)"
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
        return this.lifecycleManager.getCurrentPort();
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
        // Stop other components
        if (this.httpServer) {
            await new Promise<void>((resolve) => {
                this.httpServer.close(() => resolve());
            });
        }
    }
}

export { XyPrissServer as FastXyPrissServer };

