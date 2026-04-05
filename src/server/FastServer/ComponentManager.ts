import { Logger } from "../../shared/logger/Logger";
import { Configs } from "../../config";
import { XyPrissApp, ServerOptions } from "../../types/types";
import { CacheManager } from "../components/fastapi/CacheManager";
import { XyPluginManager as PluginManager } from "../../plugins/core/XPluginManager";

import { WorkerPoolComponent } from "../components/fastapi/WorkerPoolComponent";
import { FileUploadManager } from "../components/fastapi/upload/FileUploadManager";
import { XyLifecycleManager } from "../core/XyLifecycleManager";
import { RouteManager } from "../components/fastapi/RouteManager";
import { MonitoringManager } from "../components/fastapi/MonitoringManager";
import { ConsoleInterceptor } from "../components/fastapi/console/ConsoleInterceptor";
import { initializeFileUpload } from "../../FiUp";

export class ComponentManager {
    constructor(
        private app: XyPrissApp,
        private logger: Logger,
        private options: ServerOptions,
        private lifecycleManager: XyLifecycleManager,
        private refs: {
            cacheManager: CacheManager;
            pluginManager: PluginManager;

            workerPoolComponent: WorkerPoolComponent;
            fileUploadManager: FileUploadManager;
            routeManager: RouteManager;
            monitoringManager: MonitoringManager;
            consoleInterceptor: ConsoleInterceptor;
        },
    ) {}

    public async initializeComponentsAsync(): Promise<void> {
        this.logger.debug("server", "Initializing components...");
        await Promise.all([
            this.initializeCache(),
            this.initializePlugins(),

            this.initializeWorkerPool(),
        ]);
        this.logger.debug("server", "Components initialized");

        await this.initializeDependentComponents();
        this.logger.debug("server", "Dependent components initialized");

        this.refs.routeManager.addMethods();
        this.refs.monitoringManager.addMonitoringEndpoints();
    }

    private async initializeCache(): Promise<void> {
        this.refs.cacheManager = new CacheManager({
            cache: this.options.cache,
            performance: this.options.performance,
            server: this.options.server,
            env: this.options.env,
        });
        this.app.cache = this.refs.cacheManager.getCache();
        await this.refs.cacheManager.initializeCache();
    }

    private async initializePlugins(): Promise<void> {
        // Unified manager retrieval happens in initializeDependentComponents
    }

    private async initializeWorkerPool(): Promise<void> {
        const isWorker = !!process.env.XYPRISS_WORKER_ID;
        if (this.options.workerPool?.enabled) {
            this.refs.workerPoolComponent = new WorkerPoolComponent(
                { workerPool: this.options.workerPool },
                { app: this.app, serverOptions: this.options },
            );
            if (isWorker || this.options.server?.xhsc !== false) {
                this.logger.warn(
                    "server",
                    "WorkerPool delegation to XHSC initialized",
                );
            }
        }
    }

    private async initializeDependentComponents(): Promise<void> {
        if (!this.refs.pluginManager) {
            this.refs.pluginManager = (this.app as any).xyPluginManager;
        }

        this.logger.debug("server", "Initializing FileUploadManager...");
        this.refs.fileUploadManager = new FileUploadManager(
            this.logger,
            this.options.fileUpload,
        );

        try {
            await this.refs.fileUploadManager.initialize();
            this.logger.debug(
                "server",
                `FileUploadManager initialized, enabled: ${this.refs.fileUploadManager.isEnabled()}`,
            );

            if (this.refs.fileUploadManager.isEnabled()) {
                // const { initializeFileUpload } =
                //     await import("../components/fastapi/upload/file-upload");
                initializeFileUpload(Configs, this.logger);
                this.logger.debug(
                    "server",
                    "Global file upload API initialized",
                );
            }
        } catch (error: any) {
            this.logger.debug(
                "server",
                "Failed to initialize FileUploadManager:",
                error.message,
            );
            throw error;
        }

        this.lifecycleManager.setDependencies({
            cacheManager: this.refs.cacheManager,
            pluginManager: this.refs.pluginManager,

            workerPoolComponent: this.refs.workerPoolComponent,
            fileUploadManager: this.refs.fileUploadManager,
        });

        await this.lifecycleManager.initializeDependentComponents();

        this.refs.routeManager =
            this.lifecycleManager.dependencies.routeManager!;
        this.refs.monitoringManager =
            this.lifecycleManager.dependencies.monitoringManager!;
        this.refs.consoleInterceptor =
            this.lifecycleManager.dependencies.consoleInterceptor!;

        if (this.refs.consoleInterceptor && this.refs.pluginManager) {
            this.refs.consoleInterceptor.setPluginEngine(
                (this.refs.pluginManager as any).getPluginEngine(),
            );
        }
    }
}

