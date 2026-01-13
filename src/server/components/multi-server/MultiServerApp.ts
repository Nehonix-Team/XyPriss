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
export class MultiServerApp implements Partial<UltraFastApp> {
    private manager: MultiServerManager;
    private serverConfigs: MultiServerConfig[];
    private logger: Logger;
    private globalRoutes: Array<{
        method: string;
        path: string;
        handlers: RequestHandler[];
    }> = [];

    constructor(
        manager: MultiServerManager,
        serverConfigs: MultiServerConfig[],
        logger: Logger
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

    public all(path: string, ...handlers: RequestHandler[]): void {
        this.globalRoutes.push({ method: "ALL", path, handlers });
    }

    public use(...args: any[]): void {
        // Handle router middleware distribution
        if (
            args.length === 2 &&
            typeof args[0] === "string" &&
            args[1] &&
            typeof args[1].getRoutes === "function"
        ) {
            const basePath = args[0];
            const router = args[1];
            const routerRoutes = router.getRoutes();

            routerRoutes.forEach((route: any) => {
                const fullPath =
                    basePath + (route.path === "/" ? "" : route.path);
                this.globalRoutes.push({
                    method: route.method,
                    path: fullPath,
                    handlers: [...(route.middleware || []), route.handler],
                });
            });

            this.logger.debug(
                "server",
                `Router registered at ${basePath} with ${routerRoutes.length} routes`
            );
        } else {
            this.logger.debug(
                "server",
                "Global middleware registered (distributed on start)"
            );
        }
    }

    // --- Lifecycle Methods ---

    public async start(port?: number, callback?: () => void): Promise<void> {
        this.logger.info("server", "Starting multi-server configuration...");

        // 1. Create instances via manager
        const instances = await this.manager.createServers(this.serverConfigs);

        // 2. Distribute gathered routes to instances
        this.distributeRoutes(instances);

        // 3. Start all instances
        await this.manager.startAllServers();

        this.logger.info(
            "server",
            `Multi-server configuration active with ${instances.length} servers`
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

    private distributeRoutes(instances: MultiServerInstance[]): void {
        for (const route of this.globalRoutes) {
            for (const instance of instances) {
                if (
                    this.shouldRegisterRouteOnServer(
                        route.path,
                        instance.config
                    )
                ) {
                    try {
                        const method = route.method.toLowerCase();
                        const app = instance.app as any;
                        if (method === "all") {
                            app.all(route.path, ...route.handlers);
                        } else if (typeof app[method] === "function") {
                            app[method](route.path, ...route.handlers);
                        }
                    } catch (error) {
                        this.logger.error(
                            "server",
                            `Failed to distribute route ${route.method} ${route.path} to instance ${instance.id}`,
                            error
                        );
                    }
                }
            }
        }
    }

    private shouldRegisterRouteOnServer(
        path: string,
        config: MultiServerConfig
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

    // No-op stubs for interface completeness
    public set(setting: string, val: any): void {}
    public getSetting(setting: string): any {
        return undefined;
    }
    public enabled(setting: string): boolean {
        return false;
    }
    public disabled(setting: string): boolean {
        return true;
    }
    public enable(setting: string): void {}
    public disable(setting: string): void {}
    public engine(ext: string, fn: any): any {
        return undefined;
    }
    public param(name: string, handler: any): void {}
    public path(): string {
        return "";
    }
    public render(view: string, options?: any, callback?: any): void {}
    public route(path: string): any {
        return {};
    }
    public getPort(): number {
        return 0;
    }
    public forceClosePort(port: number): Promise<boolean> {
        return Promise.resolve(false);
    }

    // Many other UltraFastApp methods could be proxied or left as no-op
    // To match the interface perfectly, we might need a Proxy or implement stubs.
}

