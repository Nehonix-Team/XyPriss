import { Logger } from "../../../../shared/logger/Logger";
import {
    ServerOptions,
    MultiServerConfig,
    UltraFastApp,
    RequestHandler,
} from "../../../types/types";
import { Configs } from "../../../config";
import { XyServerCreator } from "../../core/XyServerCreator";
import { Interface } from "reliant-type";

export interface MultiServerInstance {
    id: string;
    app: UltraFastApp;
    config: MultiServerConfig;
    port: number;
    host: string;
}

export class MultiServerManager {
    private logger: Logger;
    private baseConfig: ServerOptions;
    private mainApp: any; // Reference to the main app with registered routes
    private servers: Map<string, MultiServerInstance> = new Map();

    constructor(baseConfig: ServerOptions, logger: Logger, mainApp?: any) {
        this.baseConfig = baseConfig;
        this.logger = logger;
        this.mainApp = mainApp;
    }

    /**
     * Create multiple server instances based on configuration
     */
    public async createServers(
        serverConfigs: MultiServerConfig[],
    ): Promise<MultiServerInstance[]> {
        const instances: MultiServerInstance[] = [];

        for (const serverConfig of serverConfigs) {
            try {
                const instance = await this.createServerInstance(serverConfig);
                instances.push(instance);
                this.servers.set(serverConfig.id, instance);

                this.logger.debug(
                    "server",
                    `Created server instance: ${serverConfig.id} on port ${serverConfig.port}`,
                );
            } catch (error: any) {
                this.logger.error(
                    "server",
                    `Failed to create server ${serverConfig.id}:`,
                    error.message,
                );
                throw error;
            }
        }

        return instances;
    }

    /**
     * Create a single server instance with merged configuration
     * Uses the centralized Configs class for proper configuration management
     */
    private async createServerInstance(
        config: MultiServerConfig,
    ): Promise<MultiServerInstance> {
        // Save original global config to restore it later
        const originalConfig = Configs.getAll();

        try {
            // 1. Start with the base configuration (Global Config)
            // This ensures we inherit all default system settings
            Configs.set(this.baseConfig);

            // 2. Prepare the overrides from MultiServerConfig
            // We want to merge the config object itself, which now extends ServerOptions
            const overrides: Partial<ServerOptions> = { ...config };

            // 3. Handle port and host explicitly to ensure they are in the right place
            // MultiServerConfig has top-level port/host for convenience,
            // but ServerOptions expects them in the 'server' object.
            overrides.server = {
                ...(overrides.server || {}),
                ...(config.port ? { port: config.port } : {}),
                ...(config.host ? { host: config.host } : {}),
            };

            // 4. Remove MultiServer-specific properties that don't belong in ServerOptions
            const multiServerProps = [
                "id",
                "port",
                "host",
                "routePrefix",
                "allowedRoutes",
                "responseControl",
            ];
            multiServerProps.forEach((prop) => {
                delete (overrides as any)[prop];
            });

            // 5. Deep merge the overrides into the current Configs
            // This will use our intelligent mergeWithDefaults logic
            Configs.merge(overrides);

            // 6. Get the final merged configuration
            const mergedConfig = Configs.getAll();

            // 7. Safety overrides for multi-server instances
            // Disable clustering by default for instances unless explicitly requested
            if (mergedConfig.cluster && !config.cluster?.enabled) {
                mergedConfig.cluster.enabled = false;
            }

            // Remove multiServer configuration from individual instance to prevent recursion
            delete (mergedConfig as any).multiServer;

            // 8. Create server instance using the unified XyServerCreator
            // It will use the configuration we just set in the Configs singleton
            const app = XyServerCreator.create(mergedConfig);

            // Wait for server to be ready (plugins initialized, etc.)
            await app.waitForReady();

            // 9. Apply server-specific response control if configured
            if (config.responseControl) {
                const httpServer = app.getHttpServer?.();
                if (
                    httpServer &&
                    typeof httpServer.setResponseControl === "function"
                ) {
                    httpServer.setResponseControl(config.responseControl);
                }
            }

            // 10. Apply route filtering if specified
            if (config.allowedRoutes || config.routePrefix) {
                this.applyRouteFilteringFromMainApp(app, config);
            }

            return {
                id: config.id,
                app,
                config,
                port: mergedConfig.server?.port || config.port,
                host: mergedConfig.server?.host || config.host || "localhost",
            };
        } finally {
            // Restore the original global config so other parts of the app aren't affected
            Configs.set(originalConfig);
        }
    }

    /**
     * Apply route filtering by copying and filtering routes from main app
     */
    private applyRouteFilteringFromMainApp(
        app: any,
        config: MultiServerConfig,
    ): void {
        // Get routes from main app's HTTP server
        const mainAppRoutes =
            this.mainApp?.getHttpServer?.()?.getRoutes?.() || [];

        // Route filtering function
        const shouldAllowRoute = (path: string): boolean => {
            // Check route prefix
            if (config.routePrefix && !path.startsWith(config.routePrefix)) {
                return false;
            }

            // Check allowed routes patterns
            if (config.allowedRoutes) {
                return config.allowedRoutes.some((pattern) => {
                    if (pattern.endsWith("/*")) {
                        // Wildcard pattern
                        const prefix = pattern.slice(0, -2);
                        return path.startsWith(prefix);
                    } else {
                        // Exact match
                        return path === pattern;
                    }
                });
            }

            return true;
        };

        // Copy and filter routes from main app to this server app
        if (mainAppRoutes && mainAppRoutes.length > 0) {
            this.logger.debug(
                "server",
                `Server ${config.id} copying ${mainAppRoutes.length} routes from main app`,
            );

            mainAppRoutes.forEach((route: any) => {
                if (shouldAllowRoute(route.path)) {
                    this.logger.debug(
                        "server",
                        `Server ${config.id} registering route: ${route.method} ${route.path}`,
                    );

                    // Register the route on this server
                    const handlers = [
                        ...(route.middleware || []),
                        route.handler,
                    ];
                    switch (route.method?.toUpperCase()) {
                        case "GET":
                            app.get(route.path, ...handlers);
                            break;
                        case "POST":
                            app.post(route.path, ...handlers);
                            break;
                        case "PUT":
                            app.put(route.path, ...handlers);
                            break;
                        case "DELETE":
                            app.delete(route.path, ...handlers);
                            break;
                        case "PATCH":
                            app.patch(route.path, ...handlers);
                            break;
                        case "OPTIONS":
                            app.options(route.path, ...handlers);
                            break;
                        case "HEAD":
                            app.head(route.path, ...handlers);
                            break;
                        default:
                            this.logger.warn(
                                "server",
                                `Server ${config.id} unsupported method: ${route.method} for ${route.path}`,
                            );
                    }
                } else {
                    this.logger.debug(
                        "server",
                        `Server ${config.id} filtering out route: ${route.method} ${route.path}`,
                    );
                }
            });
        }

        // Handle router middleware from main app
        this.copyRouterMiddlewareFromMainApp(app, config, shouldAllowRoute);
    }

    /**
     * Copy and filter router middleware from main app
     */
    private copyRouterMiddlewareFromMainApp(
        app: any,
        config: MultiServerConfig,
        shouldAllowRoute: (path: string) => boolean,
    ): void {
        // Access main app's HTTP server to get middleware
        const mainHttpServer = this.mainApp?.getHttpServer?.();
        if (!mainHttpServer) {
            return;
        }

        // Access middleware manager (private property, need casting)
        const mainMiddlewareManager = (mainHttpServer as any).middlewareManager;
        if (!mainMiddlewareManager) {
            return;
        }

        // Get all middleware entries
        const allMiddleware = mainMiddlewareManager.getAllMiddleware();

        if (allMiddleware.length === 0) {
            return;
        }

        this.logger.debug(
            "server",
            `Server ${config.id}: Copying ${allMiddleware.length} middleware from main app`,
        );

        // Access target app's HTTP server and middleware manager
        const targetHttpServer = app.getHttpServer?.();
        const targetMiddlewareManager = (targetHttpServer as any)
            ?.middlewareManager;

        if (!targetMiddlewareManager) {
            this.logger.warn(
                "server",
                `Server ${config.id}: Target middleware manager not found, falling back to app.use`,
            );
        }

        // Register middleware on the new app
        allMiddleware.forEach((entry: any) => {
            // We register the handler with its original config (priority, name, etc.)
            // Path-specific middleware is already wrapped in the handler, so we don't need to check paths here
            // unless we wanted to strictly filter middleware by allowed routes (which is complex due to path matching)

            if (targetMiddlewareManager) {
                targetMiddlewareManager.use(entry.handler, entry.config);
            } else {
                app.use(entry.handler);
            }
        });
    }

    /**
     * Start all server instances
     */
    public async startAllServers(): Promise<void> {
        const startPromises = Array.from(this.servers.values()).map(
            async (instance) => {
                const xms_basic_schm = Interface({
                    id: "string",
                    // @fortify-ignore
                    port: "string(/^[0-9]{1,5}$/)",
                });

                const _result = xms_basic_schm.safeParse({
                    id: instance.id,
                    port: String(instance.port),
                });

                if (!_result.success) {
                    const errorMessage = _result.errors[0].message.includes(
                        "does not match",
                    )
                        ? "XMS configuration error: server port must be a numeric value between 0 and 65535."
                        : _result.errors[0].message;

                    this.logger.error(
                        "server",
                        `Failed to start server "${instance.id}":`,
                        errorMessage,
                    );

                    throw new Error(errorMessage);
                }

                try {
                    await instance.app.start(instance.port);
                    this.logger.info(
                        "server",
                        `Server "${instance.id}" started on ${instance.host}:${instance.port}`,
                    );
                } catch (error: any) {
                    this.logger.error(
                        "server",
                        `Failed to start server ${instance.id}:`,
                        error.message,
                    );
                    throw error;
                }
            },
        );

        await Promise.all(startPromises);
    }

    /**
     * Stop all server instances
     */
    public async stopAllServers(): Promise<void> {
        const stopPromises = Array.from(this.servers.values()).map(
            async (instance) => {
                try {
                    if (typeof (instance.app as any).close === "function") {
                        (instance.app as any).close();
                    } else if (instance.app.stop) {
                        await instance.app.stop();
                    }
                    this.logger.info("server", `Server ${instance.id} stopped`);
                } catch (error: any) {
                    this.logger.error(
                        "server",
                        `Failed to stop server ${instance.id}:`,
                        error.message,
                    );
                }
            },
        );

        await Promise.all(stopPromises);
    }

    /**
     * Get all server instances
     */
    public getAllServers(): MultiServerInstance[] {
        return Array.from(this.servers.values());
    }

    /**
     * Get a specific server instance by ID
     */
    public getServer(id: string): MultiServerInstance | undefined {
        return this.servers.get(id);
    }

    /**
     * Stop a specific server instance by port
     */
    public async stopServer(port: number): Promise<boolean> {
        const instance = Array.from(this.servers.values()).find(
            (s) => s.port === port,
        );
        if (!instance) return false;

        try {
            if (typeof (instance.app as any).close === "function") {
                (instance.app as any).close();
            } else if (instance.app.stop) {
                await instance.app.stop();
            }
            this.logger.info(
                "server",
                `Server ${instance.id} on port ${port} stopped`,
            );
            return true;
        } catch (error: any) {
            this.logger.error(
                "server",
                `Failed to stop server on port ${port}:`,
                error.message,
            );
            return false;
        }
    }

    /**
     * Get server statistics
     */
    public getStats(): any {
        const serverStats = Array.from(this.servers.entries()).map(
            ([id, instance]) => ({
                id,
                port: instance.port,
                host: instance.host,
                // Add more stats as needed
            }),
        );

        return {
            totalServers: this.servers.size,
            servers: serverStats,
        };
    }
}

