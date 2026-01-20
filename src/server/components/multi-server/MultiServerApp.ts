import { Logger } from "../../../../shared/logger/Logger";
import {
    UltraFastApp,
    RequestHandler,
    MultiServerConfig,
    ServerOptions,
} from "../../../types/types";
import { MultiServerManager, MultiServerInstance } from "./MultiServerManager";

/**
 * MultiServerApp provides an UltraFastApp compatible interface
 * that manages multiple underlying server instances.
 */
export class MultiServerApp implements UltraFastApp {
    private manager: MultiServerManager;
    private serverConfigs: MultiServerConfig[];
    private logger: Logger;
    private globalRoutes: Array<{
        method: string;
        path: string;
        handlers: RequestHandler[];
    }> = [];
    private globalMiddleware: Array<{
        path?: string;
        handler: RequestHandler;
    }> = [];
    private globalPlugins: any[] = [];
    public settings: Record<string, any> = {};
    public locals: Record<string, any> = {};
    public mountpath: string = "";
    public cache?: any;
    public configs?: ServerOptions;
    private engineConfigs: Record<string, any> = {};
    private paramHandlers: Record<string, any> = {};

    constructor(
        manager: MultiServerManager,
        serverConfigs: MultiServerConfig[],
        logger: Logger,
    ) {
        this.manager = manager;
        this.serverConfigs = serverConfigs;
        this.logger = logger;
    }

    // --- Route Registration Methods ---

    public get(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "GET", path, handlers });
    }

    public post(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "POST", path, handlers });
    }

    public put(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "PUT", path, handlers });
    }

    public delete(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "DELETE", path, handlers });
    }

    public patch(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "PATCH", path, handlers });
    }

    public options(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "OPTIONS", path, handlers });
    }

    public head(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "HEAD", path, handlers });
    }

    public connect(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "CONNECT", path, handlers });
    }

    public trace(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "TRACE", path, handlers });
    }

    public all(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "ALL", path, handlers });
    }

    public use(...args: any[]): void {
        const isRouter = (obj: any) =>
            obj &&
            typeof obj.getRoutes === "function" &&
            typeof obj.getMiddleware === "function";

        // Handle router middleware distribution
        if (
            (args.length === 2 &&
                typeof args[0] === "string" &&
                isRouter(args[1])) ||
            (args.length === 1 && isRouter(args[0]))
        ) {
            const basePath = args.length === 2 ? args[0] : "/";
            const router = args.length === 2 ? args[1] : args[0];
            const routerRoutes = router.getRoutes();

            routerRoutes.forEach((route: any) => {
                // Use robust path normalization to avoid double/triple slashes
                const rawPath =
                    basePath + (route.path === "/" ? "" : route.path);
                const fullPath =
                    rawPath.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";

                this.globalRoutes.push({
                    method: route.method,
                    path: fullPath,
                    handlers: [...(route.middleware || []), route.handler],
                });
            });

            this.logger.debug(
                "server",
                `Router registered at ${basePath} with ${routerRoutes.length} routes`,
            );
        } else {
            // Handle global middleware distribution
            if (args.length === 1 && typeof args[0] === "function") {
                this.globalMiddleware.push({ handler: args[0] });
            } else if (
                args.length === 2 &&
                typeof args[0] === "string" &&
                typeof args[1] === "function"
            ) {
                this.globalMiddleware.push({ path: args[0], handler: args[1] });
            }

            this.logger.debug(
                "server",
                "Global middleware registered (distributed on start)",
            );
        }
    }

    // --- Lifecycle Methods ---

    public async start(port?: number, callback?: () => void): Promise<void> {
        this.logger.info("server", "Starting multi-server configuration...");

        // 1. Create instances via manager
        const instances = await this.manager.createServers(this.serverConfigs);

        // 2. Distribute gathered configurations to instances
        this.distributeConfigurations(instances);

        // 3. Start all instances
        await this.manager.startAllServers();

        this.logger.info(
            "server",
            `Multi-server configuration active with ${instances.length} servers`,
        );
        if (callback) callback();
    }

    public async stop(): Promise<void> {
        this.logger.info("server", "Stopping multi-server configuration...");
        await this.manager.stopAllServers();
        this.logger.info("server", "Multi-server configuration stopped");
    }

    public async waitForReady(): Promise<void> {
        // Multi-server is ready when manager says so (already happens during createServers)
        return Promise.resolve();
    }

    // --- Helper Methods ---

    private distributeConfigurations(instances: MultiServerInstance[]): void {
        for (const instance of instances) {
            const app = instance.app as any;

            // 1. Distribute Settings
            Object.entries(this.settings).forEach(([key, val]) => {
                if (typeof app.set === "function") app.set(key, val);
            });

            // 2. Distribute Engines
            Object.entries(this.engineConfigs).forEach(([ext, fn]) => {
                if (typeof app.engine === "function") app.engine(ext, fn);
            });

            // 3. Distribute Params
            Object.entries(this.paramHandlers).forEach(([name, handler]) => {
                if (typeof app.param === "function") app.param(name, handler);
            });

            // 3.5 Distribute Global Middleware
            for (const m of this.globalMiddleware) {
                if (m.path) {
                    app.use(m.path, m.handler);
                } else {
                    app.use(m.handler);
                }
            }

            // 3.8 Distribute Global Plugins
            for (const plugin of this.globalPlugins) {
                if (typeof app.registerPlugin === "function") {
                    app.registerPlugin(plugin);
                }
            }

            // 4. Distribute Routes
            for (const route of this.globalRoutes) {
                if (
                    this.shouldRegisterRouteOnServer(
                        route.path,
                        instance.config,
                    )
                ) {
                    try {
                        const method = route.method.toLowerCase();
                        if (method === "all") {
                            app.all(route.path, ...route.handlers);
                        } else if (typeof app[method] === "function") {
                            app[method](route.path, ...route.handlers);
                        }
                    } catch (error) {
                        this.logger.error(
                            "server",
                            `Failed to distribute route ${route.method} ${route.path} to instance ${instance.id}`,
                            error,
                        );
                    }
                }
            }
        }
    }

    private shouldRegisterRouteOnServer(
        path: string,
        config: MultiServerConfig,
    ): boolean {
        // Simple logic: if instance has routePrefix, it must match.
        // If it has allowedRoutes, it must be in the list.
        if (config.routePrefix && !path.startsWith(config.routePrefix))
            return false;

        if (config.allowedRoutes) {
            return config.allowedRoutes.some((pattern) => {
                if (pattern.endsWith("/*")) {
                    return path.startsWith(pattern.slice(0, -2));
                }
                return path === pattern;
            });
        }

        return true;
    }

    // --- Stats & Management ---

    public getServers(): MultiServerInstance[] {
        return this.manager.getAllServers();
    }

    public getServer(id: string): MultiServerInstance | undefined {
        return this.manager.getServer(id);
    }

    public getStats(): any {
        return this.manager.getStats();
    }

    public middleware(): any {
        return {
            security: (config: any) => {
                const servers = this.manager.getAllServers();
                servers.forEach((instance) => {
                    const app = instance.app as any;
                    if (app && app.middleware) {
                        const m = app.middleware();
                        if (m && typeof m.security === "function") {
                            m.security(config);
                        }
                    }
                });
                return {};
            },
            enable: (id: string) => {
                const servers = this.manager.getAllServers();
                servers.forEach((instance) => {
                    const app = instance.app as any;
                    if (app && app.middleware) {
                        const m = app.middleware();
                        if (m && typeof m.enable === "function") {
                            m.enable(id);
                        }
                    }
                });
                return {};
            },
        };
    }

    // Proxied stubs for interface completeness
    public set(setting: string, val: any): void {
        this.settings[setting] = val;
        this.manager.getAllServers().forEach((instance) => {
            if (typeof instance.app.set === "function") {
                instance.app.set(setting, val);
            }
        });
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
        this.set(setting, true);
    }

    public disable(setting: string): void {
        this.set(setting, false);
    }

    public engine(ext: string, fn: any): any {
        this.engineConfigs[ext] = fn;
        this.manager.getAllServers().forEach((instance) => {
            if (typeof instance.app.engine === "function") {
                instance.app.engine(ext, fn);
            }
        });
        return this;
    }

    public param(name: string, handler: any): void {
        this.paramHandlers[name] = handler;
        this.manager.getAllServers().forEach((instance) => {
            if (typeof instance.app.param === "function") {
                instance.app.param(name, handler);
            }
        });
    }

    public path(): string {
        return "";
    }

    public render(view: string, options?: any, callback?: any): void {
        // Find first server that can render
        const servers = this.manager.getAllServers();
        if (servers.length > 0 && typeof servers[0].app.render === "function") {
            servers[0].app.render(view, options, callback);
        } else if (callback) {
            callback(new Error("No server available for rendering"));
        }
    }

    public route(path: string): any {
        return {
            get: (handler: RequestHandler) => this.get(path, handler),
            post: (handler: RequestHandler) => this.post(path, handler),
            put: (handler: RequestHandler) => this.put(path, handler),
            delete: (handler: RequestHandler) => this.delete(path, handler),
            patch: (handler: RequestHandler) => this.patch(path, handler),
            options: (handler: RequestHandler) => this.options(path, handler),
        };
    }

    public getPort(): number {
        const servers = this.manager.getAllServers();
        return servers.length > 0 ? servers[0].port : 0;
    }

    public async forceClosePort(port: number): Promise<boolean> {
        return this.manager.stopServer(port);
    }

    public async invalidateCache(pattern: string): Promise<void> {
        await Promise.all(
            this.manager.getAllServers().map((instance) => {
                if (typeof instance.app.invalidateCache === "function") {
                    return instance.app.invalidateCache(pattern);
                }
                return Promise.resolve();
            }),
        );
    }

    public async getCacheStats(): Promise<any> {
        const stats = await Promise.all(
            this.manager.getAllServers().map((instance) => {
                if (typeof instance.app.getCacheStats === "function") {
                    return instance.app.getCacheStats();
                }
                return Promise.resolve({});
            }),
        );
        return { servers: stats };
    }

    public async warmUpCache(
        data: Array<{ key: string; value: any; ttl?: number }>,
    ): Promise<void> {
        await Promise.all(
            this.manager.getAllServers().map((instance) => {
                if (typeof instance.app.warmUpCache === "function") {
                    return instance.app.warmUpCache(data);
                }
                return Promise.resolve();
            }),
        );
    }

    // Redirect management
    public redirectFromPort(options: any): Promise<boolean> {
        return Promise.resolve(false);
    }
    public getRedirectInstance(): any {
        return null;
    }
    public getAllRedirectInstances(): any[] {
        return [];
    }
    public disconnectRedirect(): Promise<boolean> {
        return Promise.resolve(false);
    }
    public disconnectAllRedirects(): Promise<boolean> {
        return Promise.resolve(false);
    }
    public getRedirectStats(): any {
        return null;
    }

    // Optimization
    public getRequestPreCompiler(): any {
        return {};
    }

    // Console interception
    public getConsoleInterceptor(): any {
        return {};
    }
    public enableConsoleInterception(): void {}
    public disableConsoleInterception(): void {}
    public getConsoleStats(): any {
        return {};
    }
    public resetConsoleStats(): void {}

    // File watcher
    public getFileWatcherStatus(): any {
        return {};
    }
    public getFileWatcherStats(): any {
        return {};
    }
    public async stopFileWatcher(): Promise<void> {}
    public getFileWatcherManager(): any {
        return {};
    }

    // TypeScript
    public async checkTypeScript(): Promise<any[]> {
        return [];
    }
    public getTypeScriptStatus(): any {
        return {};
    }
    public enableTypeScriptChecking(): void {}
    public disableTypeScriptChecking(): void {}

    // Encryption
    public enableConsoleEncryption(): void {}
    public disableConsoleEncryption(): void {}
    public encrypt(): void {}
    public setConsoleEncryptionKey(): void {}
    public setConsoleEncryptionDisplayMode(): void {}
    public getEncryptedLogs(): any[] {
        return [];
    }
    public async restoreConsoleFromEncrypted(): Promise<any[]> {
        return [];
    }
    public isConsoleEncryptionEnabled(): boolean {
        return false;
    }
    public getConsoleEncryptionStatus(): any {
        return { enabled: false, hasKey: false };
    }

    // Router stats
    public getRouterStats(): any {
        return {};
    }
    public getRouterInfo(): any {
        return {};
    }
    public async warmUpRoutes(): Promise<void> {}
    public resetRouterStats(): void {}

    // Additional missing methods
    public getHttpServer(): any {
        const servers = this.manager.getAllServers();
        return servers.length > 0
            ? (servers[0].app as any).getHttpServer?.()
            : null;
    }

    public enableConsoleTracing(): void {}
    public disableConsoleTracing(): void {}
    public onConsoleTrace(): void {}
    public getConsoleTraceBuffer(): any[] {
        return [];
    }
    public resetConsoleTraceBuffer(): void {}
    public clearConsoleTraceBuffer(): void {}
    public getConsoleTracingStatus(): any {
        return { enabled: false };
    }

    // Upload
    public upload: any = null;
    public uploadSingle(): any {
        return () => {};
    }
    public uploadArray(): any {
        return () => {};
    }
    public uploadFields(): any {
        return () => {};
    }
    public uploadAny(): any {
        return () => {};
    }

    // Clustering & Scaling
    public async scaleUp(): Promise<void> {}
    public async scaleDown(): Promise<void> {}
    public async autoScale(): Promise<void> {}
    public async getClusterMetrics(): Promise<any> {
        return {};
    }
    public async getClusterHealth(): Promise<any> {
        return {};
    }
    public getAllWorkers(): any[] {
        return [];
    }
    public async getOptimalWorkerCount(): Promise<number> {
        return 1;
    }
    public async restartCluster(): Promise<void> {}
    public async stopCluster(): Promise<void> {}
    public async broadcastToWorkers(): Promise<void> {}
    public async sendToRandomWorker(): Promise<void> {}

    // Plugins
    public serverPluginManager: any = null;
    public async registerPlugin(plugin: any): Promise<void> {
        this.globalPlugins.push(plugin);
        // If servers are already running, we should ideally register them now
        // But for consistency with other distribution, we mostly expect them
        // to be registered before start() or they'll be distributed on restart.
        this.manager.getAllServers().forEach((instance) => {
            if (typeof instance.app.registerPlugin === "function") {
                instance.app.registerPlugin(plugin);
            }
        });
    }
    public async unregisterPlugin(pluginId: string): Promise<void> {
        this.globalPlugins = this.globalPlugins.filter(
            (p) => (p.id || p.name) !== pluginId,
        );
        this.manager.getAllServers().forEach((instance) => {
            if (typeof instance.app.unregisterPlugin === "function") {
                instance.app.unregisterPlugin(pluginId);
            }
        });
    }
    public getPlugin(id: string): any {
        return this.globalPlugins.find((p) => (p.id || p.name) === id);
    }
    public getAllPlugins(): any[] {
        return [...this.globalPlugins];
    }
    public getPluginsByType(type: any): any[] {
        return this.globalPlugins.filter((p) => p.type === type);
    }
    public getPluginStats(): any {
        return {};
    }
    public getPluginRegistryStats(): any {
        return {};
    }
    public getPluginEngineStats(): any {
        return {};
    }
    public async initializeBuiltinPlugins(): Promise<void> {}
    public getServerPluginManager(): any {
        return null;
    }

    // Route templates & optimization
    public registerRouteTemplate(): void {}
    public unregisterRouteTemplate(): void {}
    public registerOptimizationPattern(): void {}
    public getOptimizerStats(): any {
        return {};
    }
}

