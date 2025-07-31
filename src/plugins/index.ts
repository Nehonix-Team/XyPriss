/**
 * Plugin System Exports
 *
 * Exports all plugins and types for the FastXyPrissServer plugin system
 */

// Plugin classes
export { RouteOptimizationPlugin } from "./route-optimization-plugin";
export { ServerMaintenancePlugin } from "./server-maintenance-plugin";
export { PluginManager } from "./plugin-manager";

// Types
export * from "./types/index";

// Re-export for convenience
export type {
    RouteStats,
    OptimizationRule,
    RouteOptimizationConfig,
    MaintenanceIssue,
    HealthMetrics,
    MaintenanceConfig,
    PluginManagerConfig,
} from "./types/index";

