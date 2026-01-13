/**
 * XyPrissJS - Fast and Secure Express Server
 * Main server class for XyPrissJS
 * src/server/components/fastapi/modules/UFRP
 */

import {
    NextFunction,
    XyPrisRequest as Request,
    XyPrisResponse as Response,
} from "./../types/httpServer.type";
import { XyprissApp } from "./core/XyprissApp";

// Import types
import type { PluginType } from "../plugins/modules/types/PluginTypes";
import type { ServerOptions, UltraFastApp } from "../types/types";

// Import plugin classes
import { ConnectionPlugin, ProxyPlugin } from "../plugins/modules";
import { PluginManager as ServerPluginManager } from "../plugins/plugin-manager";
import { PluginManager } from "./components/fastapi/PluginManager";

// Import utils
import { Logger, initializeLogger } from "../../shared/logger/Logger";
import { DEFAULT_HOST, DEFAULT_OPTIONS } from "./const/default";
import { Port } from "./utils/forceClosePort";
import { Configs } from "../config";

// Import component classes
import { createSafeJsonMiddleware } from "../middleware/safe-json-middleware";
import { XJsonResponseHandler } from "../middleware/XJsonResponseHandler";
import { CacheManager } from "./components/fastapi/CacheManager";
import { ClusterManagerComponent } from "./components/fastapi/ClusterManagerComponent";
import { FileUploadManager } from "./components/fastapi/FileUploadManager";
import { FileWatcherManager } from "./components/fastapi/FileWatcherManager";
import { MonitoringManager } from "./components/fastapi/MonitoringManager";
import { PerformanceManager } from "./components/fastapi/PerformanceManager";
import { RouteManager } from "./components/fastapi/RouteManager";
import { WorkerPoolComponent } from "./components/fastapi/WorkerPoolComponent";
import { ConsoleInterceptor } from "./components/fastapi/console/ConsoleInterceptor";
import { netConfig } from "./conf/networkConnectionConf";
import { proxyConfig } from "./conf/proxyConfig";

import { SecurityMiddleware } from "../middleware/security-middleware";
import { SecureInMemoryCache } from "xypriss-security";
import { ServerLifecycleDependencies } from "./components/lifecycle/slcm.type";
import { XyLifecycleManager } from "./core/XyLifecycleManager";

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
    private fileUploadManager!: FileUploadManager;
    private serverPluginManager!: ServerPluginManager;
    private securityMiddleware?: SecurityMiddleware;

    // Server lifecycle manager
    private lifecycleManager!: XyLifecycleManager;

    constructor() {
        // Read configuration from Configs (single source of truth)
        // Configs already has defaults merged with user options from ServerFactory
        this.options = Configs.getAll();

        // Initialize logger with configuration from Configs
        this.logger = initializeLogger(this.options.logging);

        this.logger.startup("server", "Creating XyPriss UFa Server...");

        // Initialize console interceptor SYNCHRONOUSLY if enabled
        // This must happen BEFORE any user code executes to intercept console.log
        if (this.options.logging?.consoleInterception?.enabled) {
            this.consoleInterceptor = new ConsoleInterceptor(
                this.logger,
                this.options.logging
            );
            this.consoleInterceptor.start();
            this.logger.debug(
                "server",
                "Console interceptor started synchronously"
            );
        }

        // Create custom HTTP server app (Express-free)
        this.app = new XyprissApp(
            this.logger,
            this.options
        ) as unknown as UltraFastApp;

        // Expose logger on app object for debugging
        (this.app as any).logger = this.logger;

        // Initialize file upload methods synchronously (before async initialization)
        this.initializeFileUploadMethodsSync();

        // Initialize lifecycle manager
        this.initializeLifecycleManager();

        // Add automatic JSON and URL-encoded body parsing (unless disabled)
        if (this.options.server?.autoParseJson !== false) {
            this.addBodyParsingMiddleware();
        }

        // Add safe JSON middleware to handle circular references
        this.addSafeJsonMiddleware();

        // Add XJson middleware for handling large data responses
        this.addXJsonMiddleware();

        // Configure trust proxy settings
        this.configureTrustProxy();

        // Setup graceful shutdown handlers for process signals
        this.setupGracefulShutdown();

        // Initialize other components asynchronously
        this.initPromise = this.initializeComponentsAsync();

        this.logger.debug(
            "server",
            "XyPriss server created with optimized request processing"
        );
    }

    /**
     * Initialize file upload methods synchronously for immediate availability
     */
    private initializeFileUploadMethodsSync(): void {
        // Create a temporary FileUploadManager for synchronous access

        // Add upload methods to app immediately (they will be replaced with real ones after async init)
        this.app.uploadSingle = (fieldname: string) => {
            // Return a middleware that will be replaced after initialization
            return async (req: any, res: any, next: any) => {
                // If FileUploadManager is initialized and enabled, use it
                if (
                    this.fileUploadManager &&
                    this.fileUploadManager.isEnabled()
                ) {
                    return this.fileUploadManager.single(fieldname)(
                        req,
                        res,
                        next
                    );
                }
                // If file upload is configured but not ready yet, wait for initialization
                if (this.options.fileUpload?.enabled) {
                    // Wait for initialization to complete
                    await this.initPromise;
                    if (this.fileUploadManager?.isEnabled()) {
                        return this.fileUploadManager.single(fieldname)(
                            req,
                            res,
                            next
                        );
                    }
                }
                // File upload not enabled or failed to initialize
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options."
                    )
                );
            };
        };

        this.app.uploadArray = (fieldname: string, maxCount?: number) => {
            return async (req: any, res: any, next: any) => {
                if (
                    this.fileUploadManager &&
                    this.fileUploadManager.isEnabled()
                ) {
                    return this.fileUploadManager.array(fieldname, maxCount)(
                        req,
                        res,
                        next
                    );
                }
                if (this.options.fileUpload?.enabled) {
                    await this.initPromise;
                    if (this.fileUploadManager?.isEnabled()) {
                        return this.fileUploadManager.array(
                            fieldname,
                            maxCount
                        )(req, res, next);
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options."
                    )
                );
            };
        };

        this.app.uploadFields = (fields: any[]) => {
            return async (req: any, res: any, next: any) => {
                if (
                    this.fileUploadManager &&
                    this.fileUploadManager.isEnabled()
                ) {
                    return this.fileUploadManager.fields(fields)(
                        req,
                        res,
                        next
                    );
                }
                if (this.options.fileUpload?.enabled) {
                    await this.initPromise;
                    if (this.fileUploadManager?.isEnabled()) {
                        return this.fileUploadManager.fields(fields)(
                            req,
                            res,
                            next
                        );
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options."
                    )
                );
            };
        };

        this.app.uploadAny = () => {
            return async (req: any, res: any, next: any) => {
                if (
                    this.fileUploadManager &&
                    this.fileUploadManager.isEnabled()
                ) {
                    return this.fileUploadManager.any()(req, res, next);
                }
                if (this.options.fileUpload?.enabled) {
                    await this.initPromise;
                    if (this.fileUploadManager?.isEnabled()) {
                        return this.fileUploadManager.any()(req, res, next);
                    }
                }
                next(
                    new Error(
                        "File upload not enabled. Set fileUpload.enabled to true in server options."
                    )
                );
            };
        };

        (this.app as any).upload = null; // Will be set after async initialization
    }

    /**
     * Initialize the Lifecycle Manager from the app
     */
    private initializeLifecycleManager(): void {
        this.lifecycleManager = (this.app as any).lifecycleManager;

        if (!this.lifecycleManager) {
            this.logger.error(
                "server",
                "Fatal: XyLifecycleManager not found on app instance"
            );
            throw new Error("Lifecycle manager initialization failed");
        }
    }

    private async initializeComponentsAsync(): Promise<void> {
        this.logger.debug("server", "Initializing components...");
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
        this.logger.debug("server", "Components initialized");

        // Initialize components that depend on others
        await this.initializeDependentComponents();
        this.logger.debug("server", "Dependent components initialized");

        // Add routes and monitoring endpoints
        this.routeManager.addMethods();
        this.monitoringManager.addMonitoringEndpoints();
        this.addConsoleInterceptionMethods();
        this.logger.debug("server", "Routes and monitoring endpoints added");

        // Note: 404 handler is now handled properly in HttpServer.handleRequest()
        // after route matching fails, not as middleware

        // Mark lifecycle manager as ready
        this.lifecycleManager.markReady();
        this.ready = true;
        this.logger.debug("server", "Server ready");
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
            options: this.options,
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
        // Initialize file upload manager
        this.logger.debug("server", "Initializing FileUploadManager...");
        this.fileUploadManager = new FileUploadManager(this.logger);

        try {
            await this.fileUploadManager.initialize();
            this.logger.debug(
                "server",
                `FileUploadManager initialized, enabled: ${this.fileUploadManager.isEnabled()}`
            );

            // Initialize the global file upload API
            if (this.fileUploadManager.isEnabled()) {
                const { initializeFileUpload } = await import("../file-upload");
                const { Configs } = await import("../config");
                initializeFileUpload(Configs, this.logger);
                this.logger.debug(
                    "server",
                    "Global file upload API initialized"
                );
            } else {
                this.logger.debug(
                    "server",
                    "ℹ️ File upload not enabled, skipping API initialization"
                );
            }
        } catch (error: any) {
            this.logger.debug(
                "server",
                "Failed to initialize FileUploadManager:",
                error.message
            );
            throw error;
        }

        // Add file upload methods to app if enabled
        if (this.fileUploadManager.isEnabled()) {
            this.logger.debug("server", "Adding file upload methods to app");
            (this.app as any).upload = this.fileUploadManager.getUpload();
            this.app.uploadSingle = (fieldname: string) =>
                this.fileUploadManager.single(fieldname);
            this.app.uploadArray = (fieldname: string, maxCount?: number) =>
                this.fileUploadManager.array(fieldname, maxCount);
            this.app.uploadFields = (fields: any[]) =>
                this.fileUploadManager.fields(fields);
            this.app.uploadAny = () => this.fileUploadManager.any();
            this.logger.debug("server", "File upload methods added to app");
        } else {
            this.logger.debug(
                "server",
                "File upload not enabled, skipping method addition"
            );
        }

        this.lifecycleManager.setDependencies({
            cacheManager: this.cacheManager,
            performanceManager: this.performanceManager,
            pluginManager: this.pluginManager,
            clusterManager: this.clusterManager,
            fileWatcherManager: this.fileWatcherManager,
            workerPoolComponent: this.workerPoolComponent,
            fileUploadManager: this.fileUploadManager,
        });

        // Use lifecycle manager to initialize dependent components
        await this.lifecycleManager.initializeDependentComponents();

        // Get the initialized components from lifecycle manager
        this.routeManager = this.lifecycleManager.dependencies.routeManager!;

        this.monitoringManager =
            this.lifecycleManager.dependencies.monitoringManager!;

        this.consoleInterceptor =
            this.lifecycleManager.dependencies.consoleInterceptor!;

        // Connect console interceptor with plugin engine for hooks
        if (this.consoleInterceptor && this.pluginManager) {
            this.consoleInterceptor.setPluginEngine(
                this.pluginManager.getPluginEngine()
            );
        }

        // this.notFoundHandler =
        //     this.lifecycleManager.dependencies.notFoundHandler;

        // FastRouteHandler is now available through lifecycle manager
        // Access it via: this.lifecycleManager.dependencies.fastRouteHandler
        // Process any configs queued before middlewareManager was ready
        const appAny = this.app as any;
        if (
            appAny._immediateMiddlewareConfigs &&
            Array.isArray(appAny._immediateMiddlewareConfigs)
        ) {
            appAny._immediateMiddlewareConfigs.forEach(() => {
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
     * This method is called automatically by the lifecycle manager
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

        // Auto-initialize Upload API if fileUpload is enabled
        if (Configs.get("fileUpload")?.enabled) {
            try {
                const { Upload } = await import("../file-upload");
                await Upload.initialize(Configs);
                this.logger.debug("server", "Upload API auto-initialized");
            } catch (error: any) {
                this.logger.error(
                    "server",
                    "Failed to auto-initialize Upload API:",
                    error.message
                );
            }
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
     * Add XJson middleware for handling large data responses
     */
    private addXJsonMiddleware(): void {
        // Add XJson middleware to handle .xJson routes and large data
        this.app.use(
            XJsonResponseHandler.createMiddleware({
                maxDepth: 20,
                truncateStrings: 10000,
                enableStreaming: true,
                chunkSize: 1024 * 64, // 64KB chunks
            })
        );

        this.logger.debug(
            "middleware",
            "XJson middleware added for large data handling"
        );
    }

    /**
     * Configure trust proxy settings based on server options
     */
    private configureTrustProxy(): void {
        const trustProxyConfig = this.options.server?.trustProxy;

        if (trustProxyConfig !== undefined) {
            (this.app as any).setTrustProxy(trustProxyConfig);
            this.logger.debug(
                "server",
                `Trust proxy configured: ${
                    typeof trustProxyConfig === "function"
                        ? "custom function"
                        : JSON.stringify(trustProxyConfig)
                }`
            );
        } else {
            // Use default from configuration
            (this.app as any).setTrustProxy(false);
            this.logger.debug("server", "Trust proxy set to default (false)");
        }
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

            // Note: Compression and Rate Limiting are now handled by Security Middleware
            // This eliminates duplicate middleware and centralizes configuration in security config
            // For advanced network features, use the network.compression and network.rateLimit configs

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

        // 🔍 Console log tracing methods
        this.app.enableConsoleTracing = (maxBufferSize?: number) => {
            this.consoleInterceptor.enableTracing(maxBufferSize);
        };

        this.app.disableConsoleTracing = () => {
            this.consoleInterceptor.disableTracing();
        };

        this.app.onConsoleTrace = (hook: (log: any) => void) => {
            this.consoleInterceptor.onTrace(hook);
        };

        this.app.getConsoleTraceBuffer = () => {
            return this.consoleInterceptor.getTraceBuffer();
        };

        this.app.clearConsoleTraceBuffer = () => {
            this.consoleInterceptor.clearTraceBuffer();
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

    /**
     * Setup graceful shutdown handlers for process signals
     */
    private setupGracefulShutdown(): void {
        const gracefulShutdown = async (signal: string) => {
            this.logger.debug(
                "server",
                `Shutting down XyPrissSecurity CS gracefully... (Signal: ${signal})`
            );

            try {
                this.logger.debug("server", "Calling this.stop()...");
                await this.stop();
                this.logger.debug(
                    "server",
                    "this.stop() completed successfully"
                );
                process.exit(0);
            } catch (error) {
                this.logger.error(
                    "server",
                    "Error during graceful shutdown:",
                    error
                );
                process.exit(1);
            }
        };

        // Handle termination signals
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

        // Handle uncaught exceptions
        process.on("uncaughtException", (error) => {
            this.logger.error("server", "Uncaught exception:", error);
            gracefulShutdown("UNCAUGHT_EXCEPTION");
        });

        // Handle unhandled promise rejections
        process.on("unhandledRejection", (reason, promise) => {
            this.logger.error("server", "Unhandled promise rejection:", reason);
        });
    }

    /**
     * Stop the server gracefully
     */
    public async stop(): Promise<void> {
        this.logger.debug("server", "Starting server shutdown...");

        try {
            // Call onServerStop hooks for all plugins (Core PluginManager)
            this.logger.debug("server", "Calling plugin shutdown hooks...");
            const pluginManager = (this.app as any).pluginManager;
            if (pluginManager && typeof pluginManager.shutdown === "function") {
                await pluginManager.shutdown();
                this.logger.debug("server", "Plugin shutdown hooks executed");
            } else {
                this.logger.debug(
                    "server",
                    "No plugin manager found or shutdown method not available"
                );
            }

            // Destroy server plugin manager (internal plugins)
            this.logger.debug("server", "Destroying server plugin manager...");
            if (
                this.serverPluginManager &&
                typeof this.serverPluginManager.destroy === "function"
            ) {
                this.serverPluginManager.destroy();
                this.logger.debug("server", "Server plugin manager destroyed");
            }

            // Stop HTTP server (get it from lifecycleManager)
            this.logger.debug("server", "Closing HTTP server...");
            const httpServer = this.lifecycleManager?.getHttpServer();
            if (httpServer) {
                await new Promise<void>((resolve) => {
                    httpServer.close(() => {
                        this.logger.debug("server", "HTTP server closed");
                        resolve();
                    });
                });
            } else {
                this.logger.debug("server", "No HTTP server found to close");
            }

            const cs = new SecureInMemoryCache();
            this.logger.debug("server", "Closing SecureInMemoryCache...");
            await cs.shutdown();
            console.info("SIMC closed");

            this.logger.info("server", "Server stopped successfully");
        } catch (error) {
            this.logger.error("server", "Error stopping server:", error);
            throw error;
        }
    }
}

