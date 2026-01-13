/**
 * XyPrissJS Ultra-Fast Plugin System
 *
 * Comprehensive plugin system exports for ultra-fast performance
 * with <1ms execution overhead and enterprise-grade security.
 */

import { JWTAuthPlugin } from "./builtin/JWTAuthPlugin";
import { ResponseTimePlugin } from "./builtin/ResponseTimePlugin";
import { SmartCachePlugin } from "./builtin/SmartCachePlugin";
import { PluginEngine } from "./PluginEngine";
import { PluginRegistry } from "./PluginRegistry";
import {
    BasePlugin,
    PerformancePlugin,
    SecurityPlugin,
    CachePlugin,
    NativePlugin,
    PluginExecutionContext,
    PluginPriority,
    PluginType,
} from "./types/PluginTypes";

// Import concrete classes for default export
import { SecurityPlugin as SecurityPluginClass } from "./core/SecurityPlugin";
import { PerformancePlugin as PerformancePluginClass } from "./core/PerformancePlugin";
import { CachePlugin as CachePluginClass } from "./core/CachePlugin";

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
    SecurityPlugin,
    PerformancePlugin,
    CachePlugin,
    SecurityPlugin as ISecurityPlugin,
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
export { SecurityPlugin as SecurityPluginBase } from "./core/SecurityPlugin";
export { PerformancePlugin as PerformancePluginBase } from "./core/PerformancePlugin";
export { CachePlugin as CachePluginBase } from "./core/CachePlugin";

// Built-in plugins
export { JWTAuthPlugin } from "./builtin/JWTAuthPlugin";
export { ResponseTimePlugin } from "./builtin/ResponseTimePlugin";
export { SmartCachePlugin } from "./builtin/SmartCachePlugin";

// Network plugins
export * from "./network";

/**
 * Plugin system version and metadata
 */
export const PLUGIN_SYSTEM_VERSION = "1.0.0";
export const PLUGIN_SYSTEM_NAME = "XyPrissJS Ultra-Fast Plugin System";

/** 
 * Performance targets achieved by the plugin system
 */
export const PERFORMANCE_TARGETS = {
    PLUGIN_EXECUTION_OVERHEAD: "<1ms",
    SECURITY_PLUGIN_EXECUTION: "<2ms",
    CACHE_PLUGIN_EXECUTION: "<0.5ms",
    PERFORMANCE_PLUGIN_EXECUTION: "<0.3ms",
    PLUGIN_REGISTRATION: "<0.1ms",
} as const;

/**
 * Default plugin configurations
 */
export const DEFAULT_PLUGIN_CONFIG = {
    maxExecutionTime: 1000, // 1 second default timeout
    enableProfiling: true,
    enableCaching: true,
    enableEncryption: false,
    enableAuditLogging: false,
    securityLevel: "basic" as const,
    customSettings: {},
};

/**
 * Plugin system utilities
 */
export class PluginSystemUtils {
    /**
     * Validate plugin configuration
     */
    static validatePluginConfig(config: any): boolean {
        if (!config.id || typeof config.id !== "string") {
            return false;
        }

        if (!config.name || typeof config.name !== "string") {
            return false;
        }

        if (!config.version || typeof config.version !== "string") {
            return false;
        }

        if (typeof config.execute !== "function") {
            return false;
        }

        return true;
    }

    /**
     * Create plugin performance summary
     */
    static createPerformanceSummary(stats: any[]): any {
        if (!stats || stats.length === 0) {
            return {
                totalPlugins: 0,
                averageExecutionTime: 0,
                totalExecutions: 0,
                successRate: 100,
            };
        }

        const totalExecutions = stats.reduce(
            (sum, stat) => sum + stat.executionCount,
            0
        );
        const totalExecutionTime = stats.reduce(
            (sum, stat) => sum + stat.totalExecutionTime,
            0
        );
        const totalErrors = stats.reduce(
            (sum, stat) => sum + stat.errorCount,
            0
        );

        return {
            totalPlugins: stats.length,
            averageExecutionTime:
                totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
            totalExecutions,
            successRate:
                totalExecutions > 0
                    ? ((totalExecutions - totalErrors) / totalExecutions) * 100
                    : 100,
        };
    }

    /**
     * Generate plugin health report
     */
    static generateHealthReport(registryStats: any, engineStats: any): any {
        const isHealthy =
            registryStats.totalPlugins > 0 &&
            registryStats.averageExecutionTime < 10 && // 10ms threshold
            engineStats.circuitBreakersOpen === 0;

        return {
            status: isHealthy ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            metrics: {
                totalPlugins: registryStats.totalPlugins,
                averageExecutionTime: registryStats.averageExecutionTime,
                circuitBreakersOpen: engineStats.circuitBreakersOpen,
                contextPoolSize: engineStats.contextPoolSize,
                warmedUpPlugins: engineStats.warmedUpPlugins,
            },
            recommendations: this.generateRecommendations(
                registryStats,
                engineStats
            ),
        };
    }

    /**
     * Generate performance recommendations
     */
    private static generateRecommendations(
        registryStats: any,
        engineStats: any
    ): string[] {
        const recommendations: string[] = [];

        if (registryStats.averageExecutionTime > 5) {
            recommendations.push(
                "Consider optimizing slow plugins or increasing timeout values"
            );
        }

        if (engineStats.circuitBreakersOpen > 0) {
            recommendations.push(
                "Review and fix failing plugins to restore full functionality"
            );
        }

        if (engineStats.contextPoolSize < 10) {
            recommendations.push(
                "Consider increasing context pool size for better performance"
            );
        }

        if (registryStats.totalPlugins === 0) {
            recommendations.push(
                "Initialize built-in plugins to enable enhanced functionality"
            );
        }

        if (recommendations.length === 0) {
            recommendations.push("Plugin system is performing optimally");
        }

        return recommendations;
    }
}

/**
 * Plugin system factory for easy initialization
 */
export class PluginSystemFactory {
    /**
     * Create a pre-configured plugin registry
     */
    static createRegistry(
        cache: any,
        cluster?: any,
        config?: any
    ): PluginRegistry {
        return new PluginRegistry(cache, cluster, config);
    }

    /**
     * Create a pre-configured plugin engine
     */
    static createEngine(
        registry: PluginRegistry,
        cache: any,
        cluster?: any
    ): PluginEngine {
        return new PluginEngine(registry, cache, cluster);
    }

    /**
     * Create all built-in plugins
     */
    static createBuiltinPlugins(): any[] {
        return [
            new JWTAuthPlugin(),
            new ResponseTimePlugin(),
            new SmartCachePlugin(),
        ];
    }

    /**
     * Initialize complete plugin system
     */
    static async initializeSystem(
        cache: any,
        cluster?: any,
        config?: any
    ): Promise<{
        registry: PluginRegistry;
        engine: PluginEngine;
        plugins: any[];
    }> {
        const registry = this.createRegistry(cache, cluster, config);
        const engine = this.createEngine(registry, cache, cluster);
        const plugins = this.createBuiltinPlugins();

        // Register all built-in plugins
        for (const plugin of plugins) {
            await registry.register(plugin);
        }

        return { registry, engine, plugins };
    }
}

/**
 * Plugin development helpers
 */
export class PluginDevelopmentHelpers {
    /**
     * Create a basic plugin template
     */
    static createPluginTemplate(
        id: string,
        name: string,
        type: PluginType,
        priority: PluginPriority = PluginPriority.NORMAL
    ): Partial<BasePlugin> {
        return {
            id,
            name,
            version: "1.0.0",
            type,
            priority,
            isAsync: true,
            isCacheable: false,
            maxExecutionTime: 1000,
            execute: async (context: PluginExecutionContext) => {
                // Plugin implementation goes here
                return {
                    success: true,
                    executionTime: 0,
                    shouldContinue: true,
                };
            },
        };
    }

    /**
     * Validate plugin implementation
     */
    static validatePlugin(plugin: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!plugin.id) errors.push("Plugin must have an id");
        if (!plugin.name) errors.push("Plugin must have a name");
        if (!plugin.version) errors.push("Plugin must have a version");
        if (!plugin.type) errors.push("Plugin must have a type");
        if (!plugin.execute) errors.push("Plugin must have an execute method");
        if (typeof plugin.execute !== "function")
            errors.push("Plugin execute must be a function");

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

/**
 * Export everything for convenience
 */
export default {
    PluginRegistry,
    PluginEngine,
    SecurityPlugin: SecurityPluginClass,
    PerformancePlugin: PerformancePluginClass,
    CachePlugin: CachePluginClass,
    JWTAuthPlugin,
    ResponseTimePlugin,
    SmartCachePlugin,
    PluginSystemUtils,
    PluginSystemFactory,
    PluginDevelopmentHelpers,
    PLUGIN_SYSTEM_VERSION,
    PLUGIN_SYSTEM_NAME,
    PERFORMANCE_TARGETS,
    DEFAULT_PLUGIN_CONFIG,
};

