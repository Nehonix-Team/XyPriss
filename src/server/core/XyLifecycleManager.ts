/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

import { Logger } from "../../../shared/logger/Logger";
import type { XyprissApp } from "./XyprissApp";
import { Port as PortUtility } from "../utils/forceClosePort";
import { XHSCBridge } from "./XHSCBridge";
import { RedirectManager } from "../components/fastapi/RedirectManager";
import { StartupProcessor } from "./StartupProcessor";
import {
    ServerLifecycleDependencies,
    ServerLifecycleState,
} from "../components/lifecycle/slcm.type";
import { DEFAULT_HOST, DEFAULT_PORT } from "../const/default";
import { RequestProcessor } from "../components/fastapi/RequestProcessor";
import { RouteManager } from "../components/fastapi/RouteManager";
import { MonitoringManager } from "../components/fastapi/MonitoringManager";
import { ConsoleInterceptor } from "../components/fastapi/console/ConsoleInterceptor";
import { createNotFoundHandler } from "../handlers/NotFoundHandler";

/**
 * XyLifecycleManager - Unified server lifecycle management.
 * Consolidates standard and enterprise (FastServer) startup logic.
 */
export class XyLifecycleManager {
    private app: XyprissApp;
    private logger: Logger;
    public state: ServerLifecycleState;
    public dependencies: ServerLifecycleDependencies;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
        this.state = {
            ready: false,
            currentPort: 0,
            initPromise: Promise.resolve(),
        };
        this.dependencies = {
            app,
            options: (app as any).configs || {},
            logger,
            redirectManager: new RedirectManager(logger),
        };
    }

    /**
     * Set dependencies for the lifecycle manager.
     */
    public setDependencies(deps: Partial<ServerLifecycleDependencies>): void {
        this.dependencies = { ...this.dependencies, ...deps };
    }

    /**
     * Mark the server as ready.
     */
    public markReady(): void {
        this.state.ready = true;
    }

    /**
     * Initialize high-level dependent components (FastServer mode)
     */
    public async initializeDependentComponents(): Promise<void> {
        const { app, options, logger } = this.dependencies;

        if (
            !this.dependencies.cacheManager ||
            !this.dependencies.performanceManager ||
            !this.dependencies.pluginManager
        ) {
            // If these are missing, we might be in simple mode - skip complex init
            return;
        }

        logger.debug("lifecycle", "Initializing dependent components...");

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
            { monitoring: options.monitoring },
            {
                app,
                cacheManager: this.dependencies.cacheManager,
                performanceManager: this.dependencies.performanceManager,
            }
        );

        this.dependencies.consoleInterceptor = new ConsoleInterceptor(
            logger,
            options.logging
        );
        this.dependencies.notFoundHandler = createNotFoundHandler(options);

        if (options.logging?.consoleInterception?.enabled) {
            this.dependencies.consoleInterceptor.start();
            logger.info("console", "Console interception system activated");
        }
    }

    /**
     * Initialize lifecycle methods and inject them into the app.
     */
    public initialize(): void {
        this.logger.info("server", "Initializing XyLifecycleManager");

        const self = this;

        // The Unified Start Method
        this.app.start = async (port?: number, callback?: () => void) => {
            const options = self.app.configs || {};

            // 1. Wait for plugin initialization (onServerStart hooks)
            if ((self.app as any).pluginInitPromise) {
                await (self.app as any).pluginInitPromise;
            }

            // 2. Wait for server to be ready if in complex mode
            if (!self.state.ready && (self.app as any).waitForReady) {
                await self.app.waitForReady();
            }

            const serverPort = port || options.server?.port || DEFAULT_PORT;
            const host = options.server?.host || DEFAULT_HOST;

            self.logger.info(
                "server",
                `Starting XyPriss server on ${host}:${serverPort}...`
            );

            return await self.handleServerStartup(serverPort, host, callback);
        };

        this.app.waitForReady = async () => {
            if ((this.app as any).pluginInitPromise) {
                await (this.app as any).pluginInitPromise;
            }
            return Promise.resolve();
        };

        this.app.getPort = () => this.state.currentPort;

        this.app.forceClosePort = async (port: number) => {
            this.logger.warn("server", `Force closing port ${port}...`);
            return await new PortUtility(port).forceClosePort();
        };

        this.injectRedirectMethods();

        const originalClose = this.app.close.bind(this.app);
        this.app.close = (callback?: (err?: Error) => void) => {
            this.logger.info("server", "Stopping XyPriss server...");

            const pluginManager = (this.app as any).pluginManager;
            if (pluginManager && typeof pluginManager.shutdown === "function") {
                pluginManager.shutdown();
            }

            if (this.state.xhscBridge) {
                this.state.xhscBridge.stop();
                if (callback) callback();
            } else {
                originalClose(callback);
            }
        };

        (this.app as any).lifecycleManager = this;
    }

    /**
     * Get the current running port.
     */
    public getCurrentPort(): number {
        return this.state.currentPort;
    }

    /**
     * Get the underlying HTTP server instance.
     */
    public getHttpServer(): any {
        return this.state.httpServer;
    }

    private async handleServerStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
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

        if (this.dependencies.clusterManager?.isClusterEnabled()) {
            return await this.handleClusterStartup(serverPort, host, callback);
        }

        return await this.handleSingleProcessStartup(
            serverPort,
            host,
            callback
        );
    }

    private async handleSingleProcessStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        const result = await StartupProcessor.start(
            {
                port: serverPort,
                host,
                options: this.app.configs || {},
                app: this.app,
                logger: this.logger,
            },
            async (bootResult) => {
                if (
                    !bootResult.xhscBridge &&
                    this.dependencies.fileWatcherManager
                ) {
                    this.dependencies.fileWatcherManager.setHttpServer(
                        bootResult.serverInstance
                    );
                    if (this.dependencies.fileWatcherManager.getFileWatcher()) {
                        await this.dependencies.fileWatcherManager.startFileWatcher();
                    }
                }

                const pluginManager = (this.app as any).pluginManager;
                if (pluginManager) {
                    await pluginManager.executeHook("onServerReady", {
                        port: bootResult.port,
                        host,
                        instance: bootResult.serverInstance,
                    });
                }

                if (callback) callback();
            }
        );

        this.state.currentPort = result.port;
        this.state.xhscBridge = result.xhscBridge || undefined;
        this.state.httpServer = result.xhscBridge
            ? null
            : result.serverInstance;
        this.state.ready = true;

        this.logger.info(
            "server",
            `XyPriss (${
                result.xhscBridge ? "XHSC" : "Standard"
            }) running on ${host}:${this.state.currentPort}`
        );
        return result.serverInstance;
    }

    private async handleClusterStartup(
        serverPort: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        this.logger.debug("server", "Starting in cluster mode");
        await this.dependencies.clusterManager!.startCluster();

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
    }

    private async handleClusterMasterStartup(
        port: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        this.logger.info("cluster", "Master process started");
        this.dependencies.clusterManager!.setupClusterEventHandlers();

        const proxyServer = await this.startLoadBalancerProxy(port, host);

        if (this.dependencies.fileWatcherManager?.getFileWatcher()) {
            await this.dependencies.fileWatcherManager.startFileWatcher();
        }

        if (callback) callback();
        return proxyServer;
    }

    private async handleClusterWorkerStartup(
        port: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        this.logger.info(
            "cluster",
            `Worker ${process.pid} starting on port ${port}`
        );
        return await this.handleSingleProcessStartup(port, host, callback);
    }

    private async handleHotReloadStartup(
        port: number,
        host: string,
        callback?: () => void
    ): Promise<any> {
        this.logger.info("server", "Starting with hot reload support");
        await this.dependencies.fileWatcherManager!.getHotReloader()!.start();
        return await this.handleSingleProcessStartup(port, host, callback);
    }

    private async startLoadBalancerProxy(
        port: number,
        host: string
    ): Promise<any> {
        const http = require("http");
        const server = http.createServer(async (req: any, res: any) => {
            try {
                const clusterManager = this.dependencies.clusterManager;
                let allWorkers: any[] = [];
                const bunCluster = clusterManager!.getBunCluster();
                if (bunCluster) {
                    allWorkers = bunCluster.getAllWorkers();
                } else {
                    const nodeCluster = clusterManager!.getCluster();
                    if (nodeCluster) allWorkers = nodeCluster.getAllWorkers();
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

                // Random load balancing
                const selectedWorker =
                    workers[Math.floor(Math.random() * workers.length)];
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

                const target = `http://${host}:${selectedWorker.port}`;
                await this.forwardRequest(req, res, target, selectedWorker.id);
            } catch (error) {
                this.logger.error("cluster", "Load balancer error:", error);
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

        return new Promise((resolve, reject) => {
            server.listen(port, host, () => {
                this.logger.info(
                    "cluster",
                    `Load balancer proxy started on ${host}:${port}`
                );
                resolve(server);
            });

            server.on("error", (error: any) => {
                this.logger.error(
                    "cluster",
                    `Load balancer proxy error:`,
                    error
                );
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
        const http = require("http");
        const targetUrl = new URL(target);

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                "x-forwarded-for": req.socket.remoteAddress,
                "x-forwarded-proto": "http",
                "x-worker-id": workerId,
            },
        };

        const proxyReq = http.request(options, (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on("error", (error: any) => {
            this.logger.error(
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

        req.pipe(proxyReq);
    }

    private injectRedirectMethods(): void {
        const rm = this.dependencies.redirectManager;
        if (!rm) return;
        this.app.redirectFromPort = (f, t, o) => rm.redirectFromPort(f, t, o);
        this.app.getRedirectInstance = (p) => rm.getRedirectInstance(p);
        this.app.getAllRedirectInstances = () => rm.getAllRedirectInstances();
        this.app.disconnectRedirect = (p) => rm.disconnectRedirect(p);
        this.app.disconnectAllRedirects = () => rm.disconnectAllRedirects();
        this.app.getRedirectStats = (p) => rm.getRedirectStats(p);
    }

    public stop(): void {
        if (this.state.xhscBridge) this.state.xhscBridge.stop();
    }
}

