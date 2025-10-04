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
    private servers: Map<string, MultiServerInstance> = new Map();

    constructor(baseConfig: ServerOptions, logger: Logger) {
        this.baseConfig = baseConfig;
        this.logger = logger;
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

        // Apply route filtering if specified
        if (config.allowedRoutes || config.routePrefix) {
            this.applyRouteFiltering(app, config);
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
     * Apply route filtering to limit which routes this server handles
     */
    private applyRouteFiltering(app: any, config: MultiServerConfig): void {
        // Store original route registration methods
        const originalGet = app.get.bind(app);
        const originalPost = app.post.bind(app);
        const originalPut = app.put.bind(app);
        const originalDelete = app.delete.bind(app);
        const originalPatch = app.patch.bind(app);

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

        // Override route registration methods with filtering
        const createFilteredMethod = (originalMethod: Function) => {
            return (path: string, ...handlers: any[]) => {
                if (shouldAllowRoute(path)) {
                    this.logger.debug("server", `Server ${config.id} registering route: ${path}`);
                    return originalMethod(path, ...handlers);
                } else {
                    this.logger.debug("server", `Server ${config.id} skipping route: ${path}`);
                    return app; // Return app for chaining, but don't register
                }
            };
        };

        app.get = createFilteredMethod(originalGet);
        app.post = createFilteredMethod(originalPost);
        app.put = createFilteredMethod(originalPut);
        app.delete = createFilteredMethod(originalDelete);
        app.patch = createFilteredMethod(originalPatch);
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