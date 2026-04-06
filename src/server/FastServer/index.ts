import { XyprissApp } from "../core/XyprissApp";
import { Logger, initializeLogger } from "../../shared/logger/Logger";
import { Configs } from "../../config";
import { ServerOptions, XyPrissApp } from "../../types/types";
import { PluginType } from "../../plugins/types/PluginTypes";
import { XyPluginManager as PluginManager } from "../../plugins/core/XPluginManager";
import { ServerPluginManager } from "../../plugins/ServerPluginManager";
import { XyLifecycleManager } from "../core/XyLifecycleManager";
import { XyRequestManager } from "../core/request/XyRequestManager";
import { Port } from "../utils/forceClosePort";
import { CacheManager } from "../components/fastapi/CacheManager";

import { MonitoringManager } from "../components/fastapi/MonitoringManager";
import { RouteManager } from "../components/fastapi/RouteManager";
import { WorkerPoolComponent } from "../components/fastapi/WorkerPoolComponent";
import { FileUploadManager } from "../components/fastapi/upload/FileUploadManager";
import { ConsoleInterceptor } from "../components/fastapi/console/ConsoleInterceptor";
import { SecurityMiddleware } from "../../middleware/security-middleware";
import { xemsSession } from "../../middleware/XemsSessionMiddleware";
import { DEFAULT_OPTIONS } from "../const/default";

import { MiddlewareManager } from "./MiddlewareManager";
import { ShutdownManager } from "./ShutdownManager";
import { LogTracingMethods } from "./LogTracingMethods";
import { ComponentManager } from "./ComponentManager";
import { UploadManager } from "./UploadManager";

export class XyPrissServer {
    private app: XyPrissApp;
    private options: ServerOptions;
    private ready = false;
    private initPromise: Promise<void> = Promise.resolve();
    private logger: Logger;

    // Components (managed through refs)
    private cacheManager!: CacheManager;
    private routeManager!: RouteManager;
    private monitoringManager!: MonitoringManager;
    private pluginManager!: PluginManager;

    private consoleInterceptor!: ConsoleInterceptor;
    private workerPoolComponent!: WorkerPoolComponent;
    private fileUploadManager!: FileUploadManager;
    private serverPluginManager?: ServerPluginManager;
    private securityMiddleware?: SecurityMiddleware;
    private requestManager!: XyRequestManager;
    private lifecycleManager!: XyLifecycleManager;

    // Sub-module instances
    private middlewareManager: MiddlewareManager;
    private shutdownManager: ShutdownManager;
    private logTracingMethods!: LogTracingMethods;
    private componentManager: ComponentManager;
    private uploadManager: UploadManager;

    constructor() {
        this.options = Configs.getAll();
        this.logger = initializeLogger(this.options.logging);
        if (!(this.options as any).isAuxiliary) {
            this.logger.startup("server", "Creating XyPriss Server...");
        }

        if (this.options.logging?.consoleInterception?.enabled) {
            this.consoleInterceptor = new ConsoleInterceptor(
                this.logger,
                this.options.logging,
            );
            this.consoleInterceptor.start();
            this.logger.debug(
                "server",
                "Console interceptor started synchronously",
            );
        }

        this.app = new XyprissApp(
            this.logger,
            this.options,
        ) as unknown as XyPrissApp;
        (this.app as any).logger = this.logger;
        (this.app as any).server = this;

        this.lifecycleManager = (this.app as any).lifecycleManager;
        this.requestManager = new XyRequestManager(
            this.app as any,
            this.options.requestManagement,
        );

        const refs = {
            cacheManager: this.cacheManager,
            pluginManager: this.pluginManager,

            workerPoolComponent: this.workerPoolComponent,
            fileUploadManager: this.fileUploadManager,
            routeManager: this.routeManager,
            monitoringManager: this.monitoringManager,
            consoleInterceptor: this.consoleInterceptor,
            initPromise: this.initPromise,
        };

        const serverPluginManagerRef = {
            instance: undefined as ServerPluginManager | undefined,
        };

        this.middlewareManager = new MiddlewareManager(
            this.app,
            this.logger,
            this.options,
            this.requestManager,
        );
        this.shutdownManager = new ShutdownManager(
            this.app,
            this.logger,
            this.lifecycleManager,
            serverPluginManagerRef,
        );

        this.componentManager = new ComponentManager(
            this.app,
            this.logger,
            this.options,
            this.lifecycleManager,
            refs as any,
        );
        this.uploadManager = new UploadManager(
            this.app,
            this.options,
            refs as any,
        );

        this.uploadManager.initializeFileUploadMethodsSync();

        if (this.options.server?.autoParseJson !== false) {
            this.middlewareManager.addBodyParsingMiddleware();
        }
        this.middlewareManager.addResponseManipulationMiddleware();
        this.middlewareManager.addSafeJsonMiddleware();
        this.middlewareManager.addXJsonMiddleware();
        this.middlewareManager.configureTrustProxy();

        this.shutdownManager.setupGracefulShutdown(() => this.stop());

        this.initPromise = this.componentManager
            .initializeComponentsAsync()
            .then(async () => {
                // Re-map refs after async init
                this.cacheManager = (
                    this.componentManager as any
                ).refs.cacheManager;
                this.pluginManager = (
                    this.componentManager as any
                ).refs.pluginManager;

                this.workerPoolComponent = (
                    this.componentManager as any
                ).refs.workerPoolComponent;
                this.fileUploadManager = (
                    this.componentManager as any
                ).refs.fileUploadManager;
                this.routeManager = (
                    this.componentManager as any
                ).refs.routeManager;
                this.monitoringManager = (
                    this.componentManager as any
                ).refs.monitoringManager;
                this.consoleInterceptor = (
                    this.componentManager as any
                ).refs.consoleInterceptor;

                this.logTracingMethods = new LogTracingMethods(
                    this.app,
                    this.consoleInterceptor,
                );
                this.logTracingMethods.addConsoleInterceptionMethods();

                await this.initializeSecurity();
                this.middlewareManager.initializeRequestManagement();
                this.initializeServerPlugins();

                this.lifecycleManager.markReady();
                this.ready = true;
                this.logger.debug("server", "Server ready");
            });

        // Ensure refs are updated in uploadManager too
        (this.uploadManager as any).refs = (this.componentManager as any).refs;
        (this.uploadManager as any).refs.initPromise = this.initPromise;

        this.logger.debug(
            "server",
            "XyPriss server created with optimized request processing",
        );
    }

    private async initializeSecurity(): Promise<void> {
        if (this.options.security?.enabled) {
            this.securityMiddleware = new SecurityMiddleware(
                this.options.security,
                this.logger,
            );
            this.app.use(this.securityMiddleware.getMiddleware());
            if (this.options.server?.xems?.enable) {
                this.app.use(
                    xemsSession(
                        this.options.server?.xems ||
                            DEFAULT_OPTIONS?.server?.xems!,
                    ),
                );
            }
        }
    }

    private initializeServerPlugins(): void {
        if (!this.options.plugins) return;
        this.serverPluginManager = new ServerPluginManager(
            this.options.plugins,
        );
        this.serverPluginManager.initialize(this.app, this.logger);
        (this.app as any).serverPluginManager = this.serverPluginManager;
        (this.app as any).getServerPluginManager = () =>
            this.serverPluginManager;
        this.serverPluginManager.on("route_optimized", (data) =>
            this.logger.info("plugins", `Route optimized: ${data.routeKey}`),
        );
        this.serverPluginManager.on("maintenance_issue", (issue) =>
            this.logger.warn("plugins", `Maintenance issue: ${issue.message}`),
        );
        this.serverPluginManager.on("critical_issue", (issue) =>
            this.logger.error(
                "plugins",
                `Critical issue detected: ${issue.message}`,
            ),
        );
        if (!(this.options as any).isAuxiliary) {
            this.logger.info("server", "Server plugins initialized");
        }

        // Update the reference for ShutdownManager
        const shutdownRef = (this.shutdownManager as any)
            .serverPluginManagerRef;
        if (shutdownRef) {
            shutdownRef.instance = this.serverPluginManager;
        }
    }

    public getApp(): XyPrissApp {
        return this.app;
    }
    public getSecurityMiddleware(): SecurityMiddleware | undefined {
        return this.securityMiddleware;
    }
    public getServerPluginManager(): ServerPluginManager | undefined {
        return this.serverPluginManager;
    }

    public async waitForReady(): Promise<void> {
        await this.initPromise;
        if (
            this.options.logging?.consoleInterception?.enabled &&
            this.consoleInterceptor
        ) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        if (Configs.get("fileUpload")?.enabled) {
            try {
                const { Upload } =
                    await import("../components/fastapi/upload/file-upload");
                await Upload.initialize(Configs);
                this.logger.debug("server", "Upload API auto-initialized");
            } catch (error: any) {
                this.logger.error(
                    "server",
                    "Failed to auto-initialize Upload API:",
                    error.message,
                );
            }
        }
        this.ready = true;
    }

    public getPort(): number {
        return this.lifecycleManager.getCurrentPort();
    }
    public async forceClosePort(port: number): Promise<boolean> {
        return await new Port(port).forceClosePort();
    }
    public getConsoleInterceptor() {
        return this.consoleInterceptor;
    }

    public async registerPlugin(plugin: any): Promise<void> {
        await this.pluginManager.registerPlugin(plugin);
    }
    public async unregisterPlugin(pluginId: string): Promise<void> {
        await this.pluginManager.unregisterPlugin(pluginId);
    }
    public getPlugin(pluginId: string): any {
        return this.pluginManager.getPlugin(pluginId);
    }
    public getAllPlugins(): any[] {
        return this.pluginManager.getAllPlugins();
    }
    public getPluginsByType(type: PluginType): any[] {
        return this.pluginManager.getPluginsByType(type);
    }
    public getPluginStats(pluginId?: string): any {
        return this.pluginManager.getPluginStats(pluginId);
    }
    public getPluginRegistryStats(): any {
        return this.pluginManager.getPluginRegistryStats();
    }
    public getPluginEngineStats(): any {
        return this.pluginManager.getPluginEngineStats();
    }

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
            cluster: { enabled: this.options.cluster?.enabled || false },
        };
    }

    public async stop(): Promise<void> {
        // Ensure ShutdownManager has the latest serverPluginManager
        (this.shutdownManager as any).serverPluginManagerRef.instance =
            this.serverPluginManager;
        await this.shutdownManager.stop();
    }
}

