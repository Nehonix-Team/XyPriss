/***************************************************************************
 * ConsoleInterceptor.ts - Console Interception System for FastXyPrissServer
 * This file contains the ConsoleInterceptor class, which intercepts and manages all console output through the unified logging system
 * @author Nehonix
 * @license NehoPSLA - PROPRIETARY SOFTWARE
 * @version 1.0
 * @copyright Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This software is the proprietary information of NEHONIX and is protected
 * by copyright law and international treaties. Unauthorized reproduction,
 * distribution, modification, or use of this software is strictly prohibited
 * and may result in severe civil and criminal penalties.
 *
 * Licensed under the NEHO Proprietary Software License Agreement (NehoPSLA).
 * See LICENSE.md for full terms and conditions.
 * Official License: http://dll.nehonix.com/NehoPSLA/license
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

import { PluginRegistry } from "./modules/PluginRegistry";
import { PluginEngine } from "./modules/PluginEngine";
import { PluginType, PluginPriority } from "./modules/types/PluginTypes";
import { PluginManagerDependencies } from "../types/components/PlugingM.type";
import { logger } from "../../shared/logger/Logger";

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
            this.dependencies.options,
        );

        // Initialize plugin engine
        this.pluginEngine = new PluginEngine(
            this.pluginRegistry,
            this.dependencies.cacheManager.getCache(),
            this.dependencies.options.pluginPermissions,
        );

        // Automatically register plugins from options
        this.initializeConfiguredPlugins();

        logger.debug("plugins", "Plugin system initialized");
    }

    /**
     * Initialize plugins registered in server options
     */
    private initializeConfiguredPlugins(): void {
        const plugins = this.dependencies.options.plugins?.register;
        if (!plugins || !Array.isArray(plugins)) return;

        plugins.forEach((plugin: any) => {
            // If it's a function (PluginCreator), execute it
            const pluginInstance =
                typeof plugin === "function" ? plugin() : plugin;
            this.registerPlugin(pluginInstance).catch((err) => {
                logger.error(
                    "plugins",
                    `Failed to register configured plugin ${
                        pluginInstance.name || "unknown"
                    }:`,
                    err,
                );
            });
        });
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
            },
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
            },
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
            },
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
            },
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
        // Transform legacy plugin if necessary
        if (!plugin.id && plugin.name) {
            plugin.id = `${plugin.name.toLowerCase().replace(/\s+/g, "-")}`;
        }
        if (!plugin.type) {
            plugin.type = PluginType.MIDDLEWARE;
        }
        if (plugin.priority === undefined) {
            plugin.priority = PluginPriority.NORMAL;
        }
        if (typeof plugin.execute !== "function") {
            plugin.execute = () => ({
                success: true,
                shouldContinue: true,
            });
        }
        if (!plugin.maxExecutionTime) {
            plugin.maxExecutionTime = 1000;
        }

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
            const { SmartCachePlugin } =
                await import("./modules/builtin/SmartCachePlugin");
            const { XemsBuiltinPlugin } =
                await import("./modules/xems/XemsBuiltinPlugin");

            // Register cache plugins
            await this.registerPlugin(new SmartCachePlugin());

            // Register XEMS core plugin
            await this.registerPlugin(new XemsBuiltinPlugin());

            logger.debug(
                "plugins",
                "Built-in plugins initialized successfully",
            );
        } catch (error: any) {
            console.error(
                "Failed to initialize built-in plugins:",
                error.message,
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

    /**
     * Bridge method for legacy error handler application
     */
    public applyErrorHandlers(app: any): void {
        logger.debug("plugins", "Applying legacy error handlers (bridge)...");
        // For now, this is handled by the plugin engine execution loop
    }

    /**
     * Bridge method for legacy route registration
     */
    public registerRoutes(app: any): void {
        logger.debug("plugins", "Registering legacy routes (bridge)...");
        // Legacy plugins registered via registerPlugin will be handled here if needed
    }

    /**
     * Bridge method for legacy middleware application
     */
    public applyMiddleware(app: any): void {
        logger.debug("plugins", "Applying legacy middleware (bridge)...");
        // Enterprise plugins use the PluginEngine in the request loop
    }
}

