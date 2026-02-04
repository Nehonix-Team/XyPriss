/**
 * Plugin Manager
 *
 * Manages all server plugins including route optimization and maintenance
 */

import { EventEmitter } from "events";
import { RouteOptimizationPlugin } from "./route-optimization-plugin";
import { ServerMaintenancePlugin } from "./modules/builtin/server-maintenance-plugin";
import { PluginManagerConfig } from "./types";

export class PluginManager extends EventEmitter {
    private routeOptimizationPlugin?: RouteOptimizationPlugin;
    private serverMaintenancePlugin?: ServerMaintenancePlugin;
    private customPlugins = new Map<string, any>();
    private logger: any;

    constructor(private config: PluginManagerConfig = {}) {
        super();
    }

    /**
     * Initialize all plugins
     */
    public initialize(app: any, logger: any): void {
        this.logger = logger;

        // Initialize route optimization plugin
        if (this.config.routeOptimization?.enabled !== false) {
            this.routeOptimizationPlugin = new RouteOptimizationPlugin(
                this.config.routeOptimization,
            );
            this.routeOptimizationPlugin.initialize(app, logger);

            // Forward events
            this.routeOptimizationPlugin.on("route_optimized", (data) => {
                this.emit("route_optimized", data);
            });
            this.routeOptimizationPlugin.on("analysis_complete", (data) => {
                this.emit("route_analysis_complete", data);
            });
        }

        // Initialize server maintenance plugin
        if (this.config.serverMaintenance?.enabled !== false) {
            this.serverMaintenancePlugin = new ServerMaintenancePlugin(
                this.config.serverMaintenance,
            );
            this.serverMaintenancePlugin.initialize(app, logger);

            // Forward events
            this.serverMaintenancePlugin.on("issue_detected", (issue) => {
                this.emit("maintenance_issue", issue);
            });
            this.serverMaintenancePlugin.on("health_check", (metrics) => {
                this.emit("health_check", metrics);
            });
            this.serverMaintenancePlugin.on(
                "maintenance_complete",
                (actions) => {
                    this.emit("maintenance_complete", actions);
                },
            );
            this.serverMaintenancePlugin.on("critical_issue", (issue) => {
                this.emit("critical_issue", issue);
            });
        }

        // Initialize custom plugins
        if (this.config.customPlugins) {
            for (const { name, plugin, config } of this.config.customPlugins) {
                try {
                    const pluginInstance = new plugin(config);
                    if (pluginInstance.initialize) {
                        pluginInstance.initialize(app, logger);
                    }
                    this.customPlugins.set(name, pluginInstance);
                    logger.info(
                        "plugins",
                        `Custom plugin initialized: ${name}`,
                    );
                } catch (error) {
                    logger.error(
                        "plugins",
                        `Failed to initialize custom plugin ${name}: ${error}`,
                    );
                }
            }
        }

        logger.info("plugins", "Plugin Manager initialized");
    }

    /**
     * Get route optimization plugin
     */
    public getRouteOptimizationPlugin(): RouteOptimizationPlugin | undefined {
        return this.routeOptimizationPlugin;
    }

    /**
     * Get server maintenance plugin
     */
    public getServerMaintenancePlugin(): ServerMaintenancePlugin | undefined {
        return this.serverMaintenancePlugin;
    }

    /**
     * Get custom plugin by name
     */
    public getCustomPlugin(name: string): any {
        return this.customPlugins.get(name);
    }

    /**
     * Get comprehensive server status
     */
    public getServerStatus(): any {
        const status: any = {
            timestamp: new Date(),
            uptime: process.uptime(),
            plugins: {
                routeOptimization: !!this.routeOptimizationPlugin,
                serverMaintenance: !!this.serverMaintenancePlugin,
                custom: Array.from(this.customPlugins.keys()),
            },
        };

        // Add route optimization data
        if (this.routeOptimizationPlugin) {
            status.routeOptimization = {
                trackedRoutes:
                    this.routeOptimizationPlugin.getRouteStats().length,
                optimizedRoutes:
                    this.routeOptimizationPlugin.getOptimizedRoutes().length,
                topRoutes: this.routeOptimizationPlugin
                    .getRouteStats()
                    .slice(0, 5),
            };
        }

        // Add maintenance data
        if (this.serverMaintenancePlugin) {
            const healthMetrics =
                this.serverMaintenancePlugin.getHealthMetrics();
            const issues = this.serverMaintenancePlugin.getUnresolvedIssues();

            status.maintenance = {
                health: healthMetrics,
                unresolvedIssues: issues.length,
                criticalIssues: issues.filter((i) => i.severity >= 8).length,
                recentIssues: issues.slice(-5),
            };
        }

        return status;
    }

    /**
     * Destroy all plugins
     */
    public destroy(): void {
        if (this.routeOptimizationPlugin) {
            this.routeOptimizationPlugin.destroy();
        }

        if (this.serverMaintenancePlugin) {
            this.serverMaintenancePlugin.destroy();
        }

        for (const [name, plugin] of this.customPlugins.entries()) {
            try {
                if (plugin.destroy) {
                    plugin.destroy();
                }
            } catch (error) {
                this.logger?.error(
                    "plugins",
                    `Error destroying custom plugin ${name}: ${error}`,
                );
            }
        }

        this.customPlugins.clear();
        this.removeAllListeners();
    }
}

