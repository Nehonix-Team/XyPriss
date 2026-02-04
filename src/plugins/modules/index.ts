/**
 * XyPrissJS Ultra-Fast Plugin System
 *
 * Comprehensive plugin system exports for ultra-fast performance
 * with <1ms execution overhead and enterprise-grade security.
 */

// Import concrete classes for default export

// Core plugin system
export { PluginRegistry } from "./PluginRegistry";
export { PluginEngine } from "./PluginEngine";

// Plugin types and interfaces (only export runtime-available types)
export {
    PluginType,
    PluginPriority,
    PluginEventType,
} from "./types/PluginTypes";

// Export interfaces as type-only exports to avoid runtime issues
export type {
    BasePlugin,
    PerformancePlugin,
    CachePlugin,
    PerformancePlugin as IPerformancePlugin,
    CachePlugin as ICachePlugin,
    NativePlugin,
    PluginExecutionContext,
    PluginExecutionResult,
    PluginInitializationContext,
    PluginConfiguration,
    PerformanceMetrics,
    PluginRegistryConfig,
    PluginExecutionStats,
    PluginEvent,
} from "./types/PluginTypes";

// Base plugin classes (concrete implementations)
export { PerformancePlugin as PerformancePluginBase } from "./core/PerformancePlugin";
export { CachePlugin as CachePluginBase } from "./core/CachePlugin";

// Built-in plugins
export { ResponseTimePlugin } from "./builtin/ResponseTimePlugin";
export { SmartCachePlugin } from "./builtin/SmartCachePlugin";

// Network plugins
export * from "./network";
export * from "./xems";

