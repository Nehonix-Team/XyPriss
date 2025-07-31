import { PluginRegistry } from "../../plugins/PluginRegistry";
import { PluginEngine } from "../../plugins/PluginEngine";
import { PluginType } from "../../plugins/types/PluginTypes";
import { PluginManagerDependencies } from "../../../types/components/PlugingM.type";
import { logger } from "../../utils/Logger";

/**
 * PluginManager - Handles all plugin-related operations for FastApi.ts
 * Manages plugin registration, execution, and monitoring
 */
export class PluginManager {
    protected readonly dependencies: PluginManagerDependencies;
    private pluginRegistry!: PluginRegistry;
    private pluginEngine!: PluginEngine;

    constructor(dependencies: PluginManagerDependencies) {
        this.dependencies = dependencies;
        this.initializePluginSystem();
    }

    /**
     * Initialize the plugin system
     */
    private initializePluginSystem(): void {
        logger.debug("plugins", "Initializing plugin system...");

        // Initialize plugin registry
        this.pluginRegistry = new PluginRegistry(
            this.dependencies.cacheManager.getCache(),
            this.dependencies.cluster
        );

        // Initialize plugin engine
        this.pluginEngine = new PluginEngine(
            this.pluginRegistry,
            this.dependencies.cacheManager.getCache(),
            this.dependencies.cluster
        );

        logger.debug("plugins", "Plugin system initialized");
    }

    /**
     * Get plugin registry instance
     */
    public getPluginRegistry(): PluginRegistry {
        return this.pluginRegistry;
    }

    /**
     * Get plugin engine instance
     */
    public getPluginEngine(): PluginEngine {
        return this.pluginEngine;
    }

    /**
     * Add plugin monitoring endpoints to the Express app
     */
    public addPluginMonitoringEndpoints(basePoint: string): void {
        // Plugin registry status endpoint
        this.dependencies.app.get(
            basePoint + "/health/plugins",
            async (req, res) => {
                try {
                    const registryStats = this.getPluginRegistryStats();
                    const engineStats = this.getPluginEngineStats();

                    res.json({
                        timestamp: new Date().toISOString(),
                        plugins: {
                            registry: registryStats,
                            engine: engineStats,
                            status: "healthy",
                        },
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get plugin statistics",
                        message: error.message,
                    });
                }
            }
        );

        // Individual plugin statistics endpoint
        this.dependencies.app.get(
            basePoint + "/plugins/:pluginId/stats",
            async (req: any, res: any) => {
                try {
                    const { pluginId } = req.params;
                    const stats = this.getPluginStats(pluginId);

                    if (!stats) {
                        return res.status(404).json({
                            error: "Plugin not found",
                            pluginId,
                        });
                    }

                    res.json({
                        timestamp: new Date().toISOString(),
                        pluginId,
                        stats,
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get plugin statistics",
                        message: error.message,
                    });
                }
            }
        );

        // Plugin management endpoint - register plugin
        this.dependencies.app.post(
            basePoint + "/plugins/register",
            async (req: any, res: any) => {
                try {
                    const { pluginConfig } = req.body;

                    if (!pluginConfig) {
                        return res.status(400).json({
                            error: "Plugin configuration is required",
                        });
                    }

                    // Validate plugin configuration
                    if (
                        !pluginConfig.id ||
                        !pluginConfig.name ||
                        !pluginConfig.version
                    ) {
                        return res.status(400).json({
                            error: "Plugin must have id, name, and version",
                        });
                    }

                    // Check if plugin already exists
                    const existingPlugin = this.getPlugin(pluginConfig.id);
                    if (existingPlugin) {
                        return res.status(409).json({
                            error: "Plugin already registered",
                            pluginId: pluginConfig.id,
                        });
                    }

                    // For security, only allow registration of pre-approved plugin types
                    const allowedPluginTypes = [
                        "performance",
                        "cache",
                        "monitoring",
                    ];
                    if (!allowedPluginTypes.includes(pluginConfig.type)) {
                        return res.status(403).json({
                            error: "Plugin type not allowed for dynamic registration",
                            allowedTypes: allowedPluginTypes,
                        });
                    }

                    // Create a simple plugin instance from configuration
                    const dynamicPlugin =
                        this.createDynamicPlugin(pluginConfig);

                    // Register the dynamic plugin
                    await this.registerPlugin(dynamicPlugin);

                    res.json({
                        success: true,
                        message: `Plugin ${pluginConfig.id} registered successfully`,
                        pluginId: pluginConfig.id,
                        type: pluginConfig.type,
                        registeredAt: new Date().toISOString(),
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to register plugin",
                        message: error.message,
                    });
                }
            }
        );

        // Plugin management endpoint - unregister plugin
        this.dependencies.app.delete(
            basePoint + "/plugins/:pluginId",
            async (req, res) => {
                try {
                    const { pluginId } = req.params;
                    await this.unregisterPlugin(pluginId);

                    res.json({
                        success: true,
                        message: `Plugin ${pluginId} unregistered successfully`,
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to unregister plugin",
                        message: error.message,
                    });
                }
            }
        );
    }

    /**
     * Create a dynamic plugin from configuration
     */
    private createDynamicPlugin(pluginConfig: any): any {
        return {
            id: pluginConfig.id,
            name: pluginConfig.name,
            version: pluginConfig.version,
            type: pluginConfig.type,
            priority: pluginConfig.priority || 2,
            isAsync: pluginConfig.isAsync !== false,
            isCacheable: pluginConfig.isCacheable === true,
            maxExecutionTime: pluginConfig.maxExecutionTime || 1000,
            execute: async (context: any) => {
                // Simple execution logic for dynamic plugins
                const startTime = performance.now();

                // Basic plugin functionality based on type
                let result: any = { success: true };

                if (pluginConfig.type === "performance") {
                    result.metrics = {
                        executionTime: performance.now() - startTime,
                        timestamp: Date.now(),
                        route: context.req.path,
                    };
                } else if (pluginConfig.type === "cache") {
                    result.cacheKey = `dynamic:${context.req.path}`;
                    result.cacheable = true;
                } else if (pluginConfig.type === "monitoring") {
                    result.monitoring = {
                        requestId: context.executionId,
                        userAgent: context.req.headers["user-agent"],
                        ip: context.req.ip,
                    };
                }

                return {
                    success: true,
                    executionTime: performance.now() - startTime,
                    data: result,
                    shouldContinue: true,
                };
            },
        };
    }

    /**
     * Register a plugin with the server
     */
    public async registerPlugin(plugin: any): Promise<void> {
        await this.pluginRegistry.register(plugin);
    }

    /**
     * Unregister a plugin from the server
     */
    public async unregisterPlugin(pluginId: string): Promise<void> {
        await this.pluginRegistry.unregister(pluginId);
    }

    /**
     * Get plugin by ID
     */
    public getPlugin(pluginId: string): any {
        return this.pluginRegistry.getPlugin(pluginId);
    }

    /**
     * Get all registered plugins
     */
    public getAllPlugins(): any[] {
        return this.pluginRegistry.getAllPlugins();
    }

    /**
     * Get plugins by type
     */
    public getPluginsByType(type: PluginType): any[] {
        return this.pluginRegistry.getPluginsByType(type);
    }

    /**
     * Get plugin execution statistics
     */
    public getPluginStats(pluginId?: string): any {
        if (pluginId) {
            return this.pluginRegistry.getPluginStats(pluginId);
        }
        return this.pluginRegistry.getAllStats();
    }

    /**
     * Get plugin registry statistics
     */
    public getPluginRegistryStats(): any {
        return this.pluginRegistry.getRegistryStats();
    }

    /**
     * Get plugin engine statistics
     */
    public getPluginEngineStats(): any {
        return this.pluginEngine.getEngineStats();
    }

    /**
     * Initialize built-in plugins
     */
    public async initializeBuiltinPlugins(): Promise<void> {
        try {
            // Import and register built-in plugins
            const { JWTAuthPlugin } = await import(
                "../../plugins/builtin/JWTAuthPlugin"
            );
            const { ResponseTimePlugin } = await import(
                "../../plugins/builtin/ResponseTimePlugin"
            );
            const { SmartCachePlugin } = await import(
                "../../plugins/builtin/SmartCachePlugin"
            );

            // Register security plugins
            await this.registerPlugin(new JWTAuthPlugin());

            // Register performance plugins
            await this.registerPlugin(new ResponseTimePlugin());

            // Register cache plugins
            await this.registerPlugin(new SmartCachePlugin());

            logger.debug(
                "plugins",
                "Built-in plugins initialized successfully"
            );
        } catch (error: any) {
            console.error(
                "Failed to initialize built-in plugins:",
                error.message
            );
        }
    }

    /**
     * Get plugin system health status
     */
    public getPluginSystemHealth(): any {
        try {
            const registryStats = this.getPluginRegistryStats();
            const engineStats = this.getPluginEngineStats();

            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
                registry: {
                    totalPlugins: registryStats.totalPlugins,
                    activePlugins: registryStats.activePlugins,
                    averageExecutionTime: registryStats.averageExecutionTime,
                },
                engine: {
                    totalExecutions: engineStats.totalExecutions,
                    successRate: engineStats.successRate,
                    averageExecutionTime: engineStats.averageExecutionTime,
                },
            };
        } catch (error: any) {
            return {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                error: error.message,
            };
        }
    }
}

