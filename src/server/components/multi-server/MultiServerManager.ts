/**
 * Multi-Server Manager for XyPriss
 * Handles creation and management of multiple server instances
 */

import { Logger } from "../../../../shared/logger/Logger";
import { ServerOptions, MultiServerConfig } from "../../../types/types";
import { XyPrissServer } from "../../FastServer";

export interface MultiServerInstance {
    id: string;
    server: XyPrissServer;
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
    public async createServers(serverConfigs: MultiServerConfig[]): Promise<MultiServerInstance[]> {
        const instances: MultiServerInstance[] = [];

        for (const serverConfig of serverConfigs) {
            try {
                const instance = await this.createServerInstance(serverConfig);
                instances.push(instance);
                this.servers.set(serverConfig.id, instance);

                this.logger.info("server", `Created server instance: ${serverConfig.id} on port ${serverConfig.port}`);
            } catch (error: any) {
                this.logger.error("server", `Failed to create server ${serverConfig.id}:`, error.message);
                throw error;
            }
        }

        return instances;
    }

    /**
     * Create a single server instance with merged configuration
     */
    private async createServerInstance(config: MultiServerConfig): Promise<MultiServerInstance> {
        // Merge base configuration with server-specific overrides
        const mergedConfig: ServerOptions = this.mergeServerConfig(config);

        // Create server instance
        const server = new XyPrissServer(mergedConfig);
        const app = server.getApp();

        // Apply route filtering if specified - filter routes from main app
        if (config.allowedRoutes || config.routePrefix) {
            this.applyRouteFilteringFromMainApp(app, config);
        }

        return {
            id: config.id,
            server,
            config,
            port: config.port,
            host: config.host || this.baseConfig.server?.host || "localhost"
        };
    }

    /**
     * Merge base configuration with server-specific overrides
     */
    private mergeServerConfig(serverConfig: MultiServerConfig): ServerOptions {
        const merged: ServerOptions = { ...this.baseConfig };

        // Override server-specific settings
        if (serverConfig.server) {
            merged.server = { ...merged.server, ...serverConfig.server };
        }

        // Set the specific port for this server
        merged.server = {
            ...merged.server,
            port: serverConfig.port,
            host: serverConfig.host || merged.server?.host
        };

        // Merge other overrides
        if (serverConfig.security) {
            merged.security = { ...merged.security, ...serverConfig.security };
        }

        if (serverConfig.performance) {
            merged.performance = { ...merged.performance, ...serverConfig.performance };
        }

        if (serverConfig.cache) {
            merged.cache = { ...merged.cache, ...serverConfig.cache };
        }

        if (serverConfig.fileUpload) {
            merged.fileUpload = { ...merged.fileUpload, ...serverConfig.fileUpload };
        }

        if (serverConfig.logging) {
            merged.logging = { ...merged.logging, ...serverConfig.logging };
        }

        return merged;
    }

    /**
     * Apply route filtering by copying and filtering routes from main app
     */
    private applyRouteFilteringFromMainApp(app: any, config: MultiServerConfig): void {
        // Get routes from main app's HTTP server
        const mainAppRoutes = this.mainApp?.getHttpServer?.()?.getRoutes?.() || [];

        // Route filtering function
        const shouldAllowRoute = (path: string): boolean => {
            // Check route prefix
            if (config.routePrefix && !path.startsWith(config.routePrefix)) {
                return false;
            }

            // Check allowed routes patterns
            if (config.allowedRoutes) {
                return config.allowedRoutes.some(pattern => {
                    if (pattern.endsWith('/*')) {
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
            this.logger.debug("server", `Server ${config.id} copying ${mainAppRoutes.length} routes from main app`);

            mainAppRoutes.forEach((route: any) => {
                if (shouldAllowRoute(route.path)) {
                    this.logger.debug("server", `Server ${config.id} registering route: ${route.method} ${route.path}`);

                    // Register the route on this server
                    const handlers = [...(route.middleware || []), route.handler];
                    switch (route.method?.toUpperCase()) {
                        case 'GET':
                            app.get(route.path, ...handlers);
                            break;
                        case 'POST':
                            app.post(route.path, ...handlers);
                            break;
                        case 'PUT':
                            app.put(route.path, ...handlers);
                            break;
                        case 'DELETE':
                            app.delete(route.path, ...handlers);
                            break;
                        case 'PATCH':
                            app.patch(route.path, ...handlers);
                            break;
                        case 'OPTIONS':
                            app.options(route.path, ...handlers);
                            break;
                        case 'HEAD':
                            app.head(route.path, ...handlers);
                            break;
                        default:
                            this.logger.warn("server", `Server ${config.id} unsupported method: ${route.method} for ${route.path}`);
                    }
                } else {
                    this.logger.debug("server", `Server ${config.id} filtering out route: ${route.method} ${route.path}`);
                }
            });
        }

        // Handle router middleware from main app
        this.copyRouterMiddlewareFromMainApp(app, config, shouldAllowRoute);
    }

    /**
     * Copy and filter router middleware from main app
     */
    private copyRouterMiddlewareFromMainApp(app: any, config: MultiServerConfig, shouldAllowRoute: (path: string) => boolean): void {
        // For now, router middleware filtering is handled through route filtering
        // since router routes are registered as individual routes on the HttpServer
        this.logger.debug("server", `Server ${config.id} router middleware handled through route filtering`);
    }

    /**
     * Create a filtered router containing only allowed routes
     */
    private createFilteredRouter(originalRouter: any, allowedRoutes: any[]): any {
        // Import Router dynamically to avoid circular dependencies
        const { Router } = require('../../../routing/Router');
        const filteredRouter = Router();

        // Copy middleware from original router
        const originalMiddleware = originalRouter.getMiddleware();
        originalMiddleware.forEach((mw: any) => {
            filteredRouter.use(mw);
        });

        // Add only allowed routes
        allowedRoutes.forEach((route: any) => {
            const handlers = [...route.middleware, route.handler];
            switch (route.method.toUpperCase()) {
                case 'GET':
                    filteredRouter.get(route.path, ...handlers);
                    break;
                case 'POST':
                    filteredRouter.post(route.path, ...handlers);
                    break;
                case 'PUT':
                    filteredRouter.put(route.path, ...handlers);
                    break;
                case 'DELETE':
                    filteredRouter.delete(route.path, ...handlers);
                    break;
                case 'PATCH':
                    filteredRouter.patch(route.path, ...handlers);
                    break;
                case 'OPTIONS':
                    filteredRouter.options(route.path, ...handlers);
                    break;
                case 'HEAD':
                    filteredRouter.head(route.path, ...handlers);
                    break;
            }
        });

        return filteredRouter;
    }

    /**
     * Start all server instances
     */
    public async startAllServers(): Promise<void> {
        const startPromises = Array.from(this.servers.values()).map(async (instance) => {
            try {
                await instance.server.getApp().start(instance.port);
                this.logger.info("server", `Server ${instance.id} started on ${instance.host}:${instance.port}`);
            } catch (error: any) {
                this.logger.error("server", `Failed to start server ${instance.id}:`, error.message);
                throw error;
            }
        });

        await Promise.all(startPromises);
    }

    /**
     * Stop all server instances
     */
    public async stopAllServers(): Promise<void> {
        const stopPromises = Array.from(this.servers.values()).map(async (instance) => {
            try {
                await instance.server.stop();
                this.logger.info("server", `Server ${instance.id} stopped`);
            } catch (error: any) {
                this.logger.error("server", `Failed to stop server ${instance.id}:`, error.message);
            }
        });

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
     * Get server statistics
     */
    public getStats(): any {
        const serverStats = Array.from(this.servers.entries()).map(([id, instance]) => ({
            id,
            port: instance.port,
            host: instance.host,
            // Add more stats as needed
        }));

        return {
            totalServers: this.servers.size,
            servers: serverStats
        };
    }
}