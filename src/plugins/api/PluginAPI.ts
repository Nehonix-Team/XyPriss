/**
 * Plugin API
 * Public API for plugin management as documented in PLUGIN_SYSTEM_GUIDE.md
 */

import type { XyPrissPlugin, PluginCreator } from "../types/PluginTypes";
import { PluginManager } from "../core/PluginManager";

/**
 * Global plugin manager instance
 * This will be set by the server when it's created
 */
let globalPluginManager: PluginManager | null = null;

/**
 * Pending plugins registered before server creation
 */
const pendingPlugins: Array<{
    plugin: XyPrissPlugin | PluginCreator;
    config?: any;
}> = [];

/**
 * Set the global plugin manager
 * @internal - Used by the server factory
 */
export function setGlobalPluginManager(manager: PluginManager): void {
    globalPluginManager = manager;

    // Register all pending plugins
    for (const { plugin, config } of pendingPlugins) {
        manager.register(plugin, config);
    }

    // Clear pending queue
    pendingPlugins.length = 0;
}

/**
 * Get the global plugin manager
 * @internal
 */
export function getGlobalPluginManager(): PluginManager | null {
    return globalPluginManager;
}

/**
 * Plugin API
 * Provides imperative methods for plugin management
 */
export const Plugin = {
    /**
     * Register a plugin imperatively
     * @param plugin - Plugin instance or creator function
     * @param config - Optional configuration
     *
     * @example
     * ```typescript
     * Plugin.register({
     *   name: "my-plugin",
     *   version: "1.0.0",
     *   onServerStart: () => console.log("Started!")
     * });
     * ```
     */
    register(plugin: XyPrissPlugin | PluginCreator, config?: any): void {
        const manager = getGlobalPluginManager();

        if (manager) {
            // Server is already created, register immediately
            manager.register(plugin, config);
        } else {
            // Server not created yet, add to pending queue
            pendingPlugins.push({ plugin, config });
        }
    },

    /**
     * Get a registered plugin by name
     * @param name - Plugin name
     * @returns Plugin instance or undefined if not found
     *
     * @example
     * ```typescript
     * const plugin = Plugin.get("my-plugin");
     * if (plugin) {
     *   console.log(`Found plugin: ${plugin.name}@${plugin.version}`);
     * }
     * ```
     */
    get(name: string): XyPrissPlugin | undefined {
        const manager = getGlobalPluginManager();

        if (!manager) {
            throw new Error(
                "Plugin system not initialized. Create a server instance first."
            );
        }

        return manager.getPlugin(name);
    },

    /**
     * Create a plugin (helper method)
     * This is just a type-safe identity function that helps with TypeScript inference
     * @param plugin - Plugin definition
     * @returns The same plugin instance
     *
     * @example
     * ```typescript
     * const myPlugin = Plugin.create({
     *   name: "my-plugin",
     *   version: "1.0.0",
     *   onServerStart: (server) => {
     *     console.log("Plugin started!");
     *   }
     * });
     * ```
     */
    create(plugin: XyPrissPlugin): XyPrissPlugin {
        return plugin;
    },

    /**
     * Create a plugin factory function
     * Useful for creating reusable plugins with configuration
     * @param creator - Function that creates a plugin from config
     * @returns Plugin creator function
     *
     * @example
     * ```typescript
     * const createMyPlugin = Plugin.factory((config: { apiKey: string }) => ({
     *   name: "my-plugin",
     *   version: "1.0.0",
     *   onServerStart: (server) => {
     *     server.apiKey = config.apiKey;
     *   }
     * }));
     *
     * // Use it
     * const plugin = createMyPlugin({ apiKey: "secret" });
     * Plugin.register(plugin);
     * ```
     */
    factory<TConfig = any>(
        creator: (config: TConfig) => XyPrissPlugin
    ): PluginCreator {
        return creator as PluginCreator;
    },
};

