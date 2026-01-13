/**
 * ServerLifecycleManager - Modular server lifecycle management
 *
 * This module handles server initialization, startup, and lifecycle management
 * in a modular way, extracted from the main FastServer class for better
 * separation of concerns and maintainability.
 */

import { Logger } from "../../../../shared/logger/Logger";
import { PortManager, PortSwitchResult } from "../../utils/PortManager";
import { ServerOptions, UltraFastApp } from "../../../types/types";

// Component imports
import { CacheManager } from "../fastapi/CacheManager";
import { RequestProcessor } from "../fastapi/RequestProcessor";
import { RouteManager } from "../fastapi/RouteManager";
import { PerformanceManager } from "../fastapi/PerformanceManager";
import { MonitoringManager } from "../fastapi/MonitoringManager";
import { PluginManager } from "../fastapi/PluginManager";
import { ClusterManagerComponent } from "../fastapi/ClusterManagerComponent";
import { FileWatcherManager } from "../fastapi/FileWatcherManager";
import { RedirectManager } from "../fastapi/RedirectManager";
import { ConsoleInterceptor } from "../fastapi/console/ConsoleInterceptor";
import { WorkerPoolComponent } from "../fastapi/WorkerPoolComponent";
import { FileUploadManager } from "../fastapi/FileUploadManager";
import { createNotFoundHandler } from "../../handlers/NotFoundHandler";
import { DEFAULT_HOST, DEFAULT_PORT } from "../../const/default";
import { XHSCBridge } from "../../core/XHSCBridge";

/**
 * Dependencies required by the ServerLifecycleManager
 */
export interface ServerLifecycleDependencies {
    app: UltraFastApp;
    options: ServerOptions;
    logger: Logger;

    // Component managers (will be initialized by this manager)
    cacheManager?: CacheManager;
    requestProcessor?: RequestProcessor;
    routeManager?: RouteManager;
    performanceManager?: PerformanceManager;
    monitoringManager?: MonitoringManager;
    pluginManager?: PluginManager;
    clusterManager?: ClusterManagerComponent;
    fileWatcherManager?: FileWatcherManager;
    redirectManager?: RedirectManager;
    consoleInterceptor?: ConsoleInterceptor;
    workerPoolComponent?: WorkerPoolComponent;
    fileUploadManager?: FileUploadManager;
    middlewareManager?: any; // Add middlewareManager property
    notFoundHandler?: any;
    xhscBridge?: XHSCBridge;
}

/**
 * Server lifecycle state interface
 */
export interface ServerLifecycleState {
    ready: boolean;
    currentPort: number;
    httpServer?: any;
    initPromise: Promise<void>;
    xhscBridge?: XHSCBridge;
}

/**
 * ServerLifecycleManager - Handles server initialization and startup lifecycle
 */
export class ServerLifecycleManager {
    public dependencies: ServerLifecycleDependencies;
    private state: ServerLifecycleState;

    constructor(dependencies: ServerLifecycleDependencies) {
        this.dependencies = dependencies;
        this.state = {
            ready: false,
            currentPort: 0,
            initPromise: Promise.resolve(),
        };
    }

    /**
     * Initialize all dependent components
     */
    public async initializeDependentComponents(): Promise<void> {
        const { app, options, logger } = this.dependencies;

        // Ensure required components are available
        if (
            !this.dependencies.cacheManager ||
            !this.dependencies.performanceManager ||
            !this.dependencies.pluginManager
        ) {
            throw new Error(
                "Required components (cacheManager, performanceManager, pluginManager) must be initialized before dependent components"
            );
        }

        logger.debug("lifecycle", "Initializing dependent components...");

        // Initialize components that depend on others
        this.dependencies.requestProcessor = new RequestProcessor({
            performanceProfiler:
                this.dependencies.performanceManager.getPerformanceProfiler(),
            executionPredictor:
                this.dependencies.performanceManager.getExecutionPredictor(),
            requestPreCompiler:
                this.dependencies.performanceManager.getRequestPreCompiler(),
            pluginEngine: this.dependencies.pluginManager.getPluginEngine(),
            cacheManager: this.dependencies.cacheManager,
        });

        this.dependencies.routeManager = new RouteManager({
            app,
            cacheManager: this.dependencies.cacheManager,
            middlewareManager: this.dependencies.middlewareManager,
            ultraFastOptimizer:
                this.dependencies.performanceManager.getUltraFastOptimizer(),
        });

        this.dependencies.monitoringManager = new MonitoringManager(
            {
                monitoring: options.monitoring,
            },
            {
                app,
                cacheManager: this.dependencies.cacheManager,
                performanceManager: this.dependencies.performanceManager,
            }
        );

        // Initialize other components
        this.dependencies.redirectManager = new RedirectManager(logger);
        this.dependencies.consoleInterceptor = new ConsoleInterceptor(
            logger,
            options.logging
        );
        this.dependencies.notFoundHandler = createNotFoundHandler(options);

        if (options.logging?.consoleInterception?.enabled) {
            this.dependencies.consoleInterceptor.start();
            logger.info("console", "Console interception system activated");
        }

        logger.debug(
            "lifecycle",
            "Dependent components initialized successfully"
        );
    }

    /**
     * Start server with error handling and port switching
     */
    public async startServerWithPortHandling(
        port: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { app, options, logger } = this.dependencies;

        try {
            // Check port availability first when auto port switch is enabled
            if (options.server?.autoPortSwitch?.enabled) {
                const portManager = new PortManager(
                    port,
                    options.server?.autoPortSwitch
                );
                const result = await portManager.findAvailablePort(host);

                if (!result.success) {
                    throw new Error(
                        `Failed to find an available port after ${
                            options.server?.autoPortSwitch?.maxAttempts || 10
                        } attempts`
                    );
                }

                if (result.switched) {
                    logger.portSwitching(
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
                logger.debug(
                    "server",
                    `ServerLifecycleManager: Starting server on ${host}:${port} using httpServer.listen()`
                );
                const server = (app as any)
                    .getHttpServer()
                    .getServer()
                    .listen(port, host, () => {
                        this.state.currentPort = port; // Track the actual running port
                        logger.info(
                            "server",
                            `Server running on ${host}:${port}`
                        );
                        logger.debug(
                            "server",
                            `State: ${
                                this.state.ready ? "Ready" : "Initializing..."
                            }`
                        );
                        if (callback) callback();
                        resolve(server);
                    });

                server.on("error", async (error: any) => {
                    logger.debug(
                        "server",
                        `Server error on port ${port}: ${error.code} - ${error.message}`
                    );

                    if (error.code === "EADDRINUSE") {
                        // Port is in use, try auto-switching if enabled
                        if (options.server?.autoPortSwitch?.enabled) {
                            logger.info(
                                "server",
                                `🔄 Port ${port} is in use, attempting auto port switch...`
                            );
                            try {
                                const result = await this.handlePortSwitching(
                                    port,
                                    host
                                );
                                logger.info(
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
                                logger.error(
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
     * Handle automatic port switching when port is in use
     */
    private async handlePortSwitching(
        requestedPort: number,
        host: string = DEFAULT_HOST
    ): Promise<PortSwitchResult> {
        const { options, logger } = this.dependencies;

        const portManager = new PortManager(
            requestedPort,
            options.server?.autoPortSwitch
        );
        const result = await portManager.findAvailablePort(host);

        if (result.switched) {
            logger.portSwitching(
                "server",
                `🔄 Port ${requestedPort} was in use, switched to port ${result.port}`
            );
            logger.portSwitching(
                "server",
                `   Attempts: ${result.attempts}, Strategy: ${
                    portManager.getConfig()?.strategy || "increment"
                }`
            );
        }

        if (!result.success) {
            const maxAttempts =
                options.server?.autoPortSwitch?.maxAttempts || 10;
            throw new Error(
                `Failed to find an available port after ${maxAttempts} attempts. ` +
                    `Original port: ${requestedPort}, Last attempted: ${result.port}`
            );
        }

        return result;
    }

    /**
     * Get the current server state
     */
    public getState(): ServerLifecycleState {
        return { ...this.state };
    }

    /**
     * Update the server state
     */
    public updateState(updates: Partial<ServerLifecycleState>): void {
        this.state = { ...this.state, ...updates };
    }

    /**
     * Get the current running port
     */
    public getCurrentPort(): number {
        return this.state.currentPort;
    }

    /**
     * Set the HTTP server instance
     */
    public setHttpServer(server: any): void {
        this.state.httpServer = server;
    }

    /**
     * Get the HTTP server instance
     */
    public getHttpServer(): any {
        return this.state.httpServer;
    }

    /**
     * Mark the server as ready
     */
    public markReady(): void {
        this.state.ready = true;
    }

    /**
     * Check if the server is ready
     */
    public isReady(): boolean {
        return this.state.ready;
    }

    /**
     * Add start method to app with cluster support
     */
    public addStartMethod(waitForReady: () => Promise<void>): void {
        const { app, options, logger } = this.dependencies;

        const start = async (port?: number, callback?: () => void) => {
            // CRITICAL: Wait for plugin initialization FIRST (onServerStart hooks)
            // This ensures plugins like Prydam can complete initialization before server starts
            if ((app as any).pluginInitPromise) {
                logger.debug(
                    "plugins",
                    "Waiting for plugin initialization (onServerStart hooks)..."
                );
                await (app as any).pluginInitPromise;
                logger.debug("plugins", "Plugin initialization complete");
            }

            // Wait for server to be ready before starting
            if (!this.state.ready) {
                logger.debug(
                    "server",
                    "Waiting for initialization to complete..."
                );
                await waitForReady();
                logger.info(
                    "server",
                    "Initialization complete, starting server..."
                );
            }

            const serverPort = port || options.server?.port || DEFAULT_PORT;
            const host = options.server?.host || DEFAULT_HOST;

            // Handle different startup modes (hot reload, cluster, single process)
            return await this.handleServerStartup(serverPort, host, callback);
        };

        // Add the start method to the app
        app.start = start;
        app.waitForReady = waitForReady;

        // Add port management methods
        app.getPort = () => this.getCurrentPort();
        app.forceClosePort = async (port: number) => {
            const { Port } = await import("../../utils/forceClosePort");
            return await new Port(port).forceClosePort();
        };

        // Add redirect management methods if redirectManager is available
        if (this.dependencies.redirectManager) {
            app.redirectFromPort = (
                fromPort: number,
                toPort: number,
                options?: any
            ) =>
                this.dependencies.redirectManager!.redirectFromPort(
                    fromPort,
                    toPort,
                    options
                );
            app.getRedirectInstance = (fromPort: number) =>
                this.dependencies.redirectManager!.getRedirectInstance(
                    fromPort
                );
            app.getAllRedirectInstances = () =>
                this.dependencies.redirectManager!.getAllRedirectInstances();
            app.disconnectRedirect = (fromPort: number) =>
                this.dependencies.redirectManager!.disconnectRedirect(fromPort);
            app.disconnectAllRedirects = () =>
                this.dependencies.redirectManager!.disconnectAllRedirects();
            app.getRedirectStats = (fromPort: number) =>
                this.dependencies.redirectManager!.getRedirectStats(fromPort);
        }
    }

    /**
     * Handle different server startup modes
     */
    private async handleServerStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { logger } = this.dependencies;

        // Check for hot reload mode
        if (
            this.dependencies.fileWatcherManager?.isInMainProcess() &&
            this.dependencies.fileWatcherManager?.getHotReloader()
        ) {
            return await this.handleHotReloadStartup(
                serverPort,
                host,
                callback
            );
        }

        // Check for cluster mode
        if (this.dependencies.clusterManager?.isClusterEnabled()) {
            return await this.handleClusterStartup(serverPort, host, callback);
        }

        // Default single process mode
        logger.debug("server", "Taking single process mode path");
        return await this.handleSingleProcessStartup(
            serverPort,
            host,
            callback
        );
    }

    /**
     * Handle hot reload startup
     */
    private async handleHotReloadStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { logger } = this.dependencies;

        logger.debug("server", "Taking hot reload mode path");
        logger.startup("fileWatcher", "Starting with hot reload support...");

        try {
            // Start the hot reloader (which will spawn child process)
            await this.dependencies
                .fileWatcherManager!.getHotReloader()!
                .start();

            // Start file watcher in main process to monitor changes
            if (this.dependencies.fileWatcherManager!.getFileWatcher()) {
                await this.dependencies.fileWatcherManager!.startFileWatcherWithHotReload();
            }

            // Start the actual HTTP server in the main process too
            this.state.httpServer = await this.startServerWithPortHandling(
                serverPort,
                host,
                async () => {
                    this.dependencies.fileWatcherManager!.setHttpServer(
                        this.state.httpServer
                    );
                    if (callback) callback();
                }
            );

            return this.state.httpServer;
        } catch (error: any) {
            logger.error(
                "fileWatcher",
                "Hot reload startup failed:",
                error.message
            );
            // Fall through to regular startup
            return await this.handleSingleProcessStartup(
                serverPort,
                host,
                callback
            );
        }
    }

    /**
     * Handle cluster startup
     */
    private async handleClusterStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { logger } = this.dependencies;

        logger.debug("server", "Taking cluster mode path");

        try {
            // Start cluster manager
            await this.dependencies.clusterManager!.startCluster();

            // Check if we're in master or worker process
            // Use cluster.isMaster/isPrimary to detect master vs worker
            const clusterModule = require("cluster");
            if (clusterModule.isMaster || clusterModule.isPrimary) {
                return await this.handleClusterMasterStartup(
                    serverPort,
                    host,
                    callback
                );
            } else {
                return await this.handleClusterWorkerStartup(
                    serverPort,
                    host,
                    callback
                );
            }
        } catch (error: any) {
            const clusterModule = require("cluster");

            // Only master process should fall back to single-process mode
            if (clusterModule.isMaster || clusterModule.isPrimary) {
                logger.error(
                    "cluster",
                    "Failed to start cluster:",
                    error.message
                );
                logger.info("cluster", "Falling back to single process mode");
                return await this.handleSingleProcessStartup(
                    serverPort,
                    host,
                    callback
                );
            } else {
                // Worker processes should fail fast and let cluster manager restart them
                logger.error(
                    "cluster",
                    `Worker ${process.pid} failed to start:`,
                    error.message
                );
                logger.info(
                    "cluster",
                    "Worker will be restarted by cluster manager"
                );
                throw error; // Let the worker process exit and be restarted
            }
        }
    }

    /**
     * Handle cluster master startup
     */
    private async handleClusterMasterStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { logger } = this.dependencies;

        logger.startup("cluster", "Starting as cluster master process");

        // Setup cluster event handlers
        this.dependencies.clusterManager!.setupClusterEventHandlers();

        // Start load balancer proxy on the main port
        const proxyServer = await this.startLoadBalancerProxy(serverPort, host);

        logger.info(
            "cluster",
            `Master process started load balancer on ${host}:${serverPort} - distributing requests to worker processes`
        );

        const clusterStats =
            await this.dependencies.clusterManager!.getClusterStats();
        logger.debug(
            "cluster",
            `Cluster master started with ${
                clusterStats.workers?.total || 0
            } workers`
        );

        // Start file watcher if enabled
        if (this.dependencies.fileWatcherManager!.getFileWatcher()) {
            if (this.dependencies.fileWatcherManager!.isInMainProcess()) {
                await this.dependencies.fileWatcherManager!.startFileWatcherWithHotReload();
            } else {
                await this.dependencies.fileWatcherManager!.startFileWatcher();
            }
        }

        if (callback) callback();
        return proxyServer;
    }

    /**
     * Start load balancer proxy server on master process
     */
    private async startLoadBalancerProxy(
        port: number,
        host: string
    ): Promise<any> {
        const { logger, clusterManager } = this.dependencies;
        const http = require("http");

        // Create HTTP server for load balancing
        const server = http.createServer(async (req: any, res: any) => {
            try {
                // Get available workers from the actual cluster manager
                let allWorkers: any[] = [];

                // Check if we have a Bun cluster manager
                const bunCluster = clusterManager!.getBunCluster();
                if (bunCluster) {
                    allWorkers = bunCluster.getAllWorkers();
                } else {
                    // Check if we have a Node.js cluster manager
                    const nodeCluster = clusterManager!.getCluster();
                    if (nodeCluster) {
                        allWorkers = nodeCluster.getAllWorkers();
                    }
                }

                const workers = allWorkers.filter(
                    (w) => w.status === "running"
                );

                if (workers.length === 0) {
                    res.writeHead(503, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            error: "Service Unavailable",
                            message: "No workers available",
                        })
                    );
                    return;
                }

                // Simple round-robin load balancing for now
                const selectedWorkerIndex = Math.floor(
                    Math.random() * workers.length
                );
                const selectedWorker = workers[selectedWorkerIndex];

                if (!selectedWorker || !selectedWorker.port) {
                    res.writeHead(503, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            error: "Service Unavailable",
                            message: "Selected worker not available",
                        })
                    );
                    return;
                }

                // Forward request to selected worker
                const target = `http://${host}:${selectedWorker.port}`;

                logger.debug(
                    "cluster",
                    `Proxying ${req.method} ${req.url} to worker ${selectedWorker.id} on port ${selectedWorker.port}`
                );

                // Simple HTTP proxy implementation
                await this.forwardRequest(req, res, target, selectedWorker.id);
            } catch (error) {
                logger.error("cluster", "Load balancer error:", error);
                if (!res.headersSent) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            error: "Internal Server Error",
                            message: "Load balancer error",
                        })
                    );
                }
            }
        });

        // Start server
        return new Promise((resolve, reject) => {
            server.listen(port, host, () => {
                logger.info(
                    "cluster",
                    `Load balancer proxy started on ${host}:${port}`
                );
                resolve(server);
            });

            server.on("error", (error: any) => {
                logger.error("cluster", `Load balancer proxy error:`, error);
                reject(error);
            });
        });
    }

    /**
     * Forward HTTP request to worker
     */
    private async forwardRequest(
        req: any,
        res: any,
        target: string,
        workerId: string
    ): Promise<void> {
        const { logger } = this.dependencies;
        const http = require("http");
        const url = require("url");

        const targetUrl = new URL(target);

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                "x-forwarded-for":
                    req.connection?.remoteAddress || req.socket?.remoteAddress,
                "x-forwarded-proto": "http",
                "x-worker-id": workerId,
            },
        };

        const proxyReq = http.request(options, (proxyRes: any) => {
            // Forward response headers
            res.writeHead(proxyRes.statusCode, proxyRes.headers);

            // Forward response body
            proxyRes.pipe(res);
        });

        proxyReq.on("error", (error: any) => {
            logger.error(
                "cluster",
                `Proxy request error for worker ${workerId}:`,
                error
            );
            if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        error: "Bad Gateway",
                        message: "Worker unavailable",
                    })
                );
            }
        });

        // Forward request body
        req.pipe(proxyReq);
    }

    /**
     * Handle cluster worker startup
     */
    private async handleClusterWorkerStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { logger } = this.dependencies;

        logger.startup("cluster", `Worker ${process.pid} started`);

        // In cluster mode, workers DO start HTTP servers on the same port
        // The Node.js cluster module handles load balancing automatically
        logger.info(
            "cluster",
            `Worker ${process.pid} starting HTTP server on shared port ${serverPort}`
        );

        // Start the HTTP server for this worker
        const httpServer = await this.startServerWithPortHandling(
            serverPort,
            host,
            () => {
                logger.info(
                    "cluster",
                    `Worker ${process.pid} listening on ${host}:${serverPort}`
                );
                if (callback) callback();
            }
        );

        return httpServer;
    }

    /**
     * Handle single process startup
     */
    private async handleSingleProcessStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const { app, logger } = this.dependencies;

        // If XHSC is enabled (which is now our primary objective)
        if (this.dependencies.options.server?.xhsc !== false) {
            logger.info(
                "server",
                "🚀 Using XHSC (Rust Hybrid Server Core) as primary HTTP engine"
            );

            // Initialize XHSC Bridge
            this.state.xhscBridge = new XHSCBridge(app as any, logger);

            // Start the bridge (which starts Rust and IPC)
            await this.state.xhscBridge.start(serverPort, host);

            // Set port and ready state
            this.state.currentPort = serverPort;
            this.state.ready = true;

            // Mark app as ready
            if (callback) callback();

            return this.state.xhscBridge;
        }

        // Fallback for non-XHSC (legacy mode)
        logger.warn(
            "server",
            "⚠️ Using legacy Node.js HTTP engine. Performance will be limited."
        );

        this.state.httpServer = await this.startServerWithPortHandling(
            serverPort,
            host,
            async () => {
                // Set HTTP server reference for file watcher restarts
                if (this.dependencies.fileWatcherManager) {
                    this.dependencies.fileWatcherManager.setHttpServer(
                        this.state.httpServer
                    );

                    // Start file watcher if enabled
                    if (this.dependencies.fileWatcherManager.getFileWatcher()) {
                        if (
                            this.dependencies.fileWatcherManager.isInMainProcess()
                        ) {
                            await this.dependencies.fileWatcherManager.startFileWatcherWithHotReload();
                        } else {
                            await this.dependencies.fileWatcherManager.startFileWatcher();
                        }
                    }
                }

                // Call onServerReady hook for plugins
                const pluginManager = (this.dependencies.app as any)
                    .pluginManager;
                if (pluginManager) {
                    await pluginManager.executeHook("onServerReady", {
                        app: this.dependencies.app,
                    });
                }

                if (callback) callback();
            }
        );

        return this.state.httpServer;
    }
}

