/**
 * Plugin API
 * Public API for plugin management as documented in PLUGIN_SYSTEM_GUIDE.md
 */

import type { XyPrissPlugin, PluginCreator } from "../types/PluginTypes";
import { XyPluginManager as PluginManager } from "../core/XPluginManager";
import { identifyProjectRoot } from "../../utils/ProjectDiscovery";
import { XyPrissFS } from "../../xhsc/System";
import path from "node:path";

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
export async function setGlobalPluginManager(
    manager: PluginManager,
): Promise<void> {
    globalPluginManager = manager;

    // Register all pending plugins
    for (const { plugin, config } of pendingPlugins) {
        await manager.register(plugin, config);
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
     * Register a plugin imperatively - alias for register
     * @param plugin - Plugin instance or creator function
     * @param config - Optional configuration
     *
     * @example
     * ```typescript
     * Plugin.exec(Plugin.create({
     *   name: "test",
     *   version: "1.0.0",
     *   onServerStart(server) {
     *       console.log("Server started");
     *   },
     * });
     * ```
     */
    exec(...p: Parameters<typeof this.register>): void {
        this.register(...p);
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
                "Plugin system not initialized. Create a server instance first.",
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
    create(plugin: XyPrissPlugin, Sys: string): XyPrissPlugin {
        if (!Sys) {
            throw new Error(
                "XyPriss Initialization Error: To create a plugin, you MUST provide the plugin's root path or its '__sys__' instance as the second argument to Plugin.create().\n" +
                    "Example: return Plugin.create({ ... }, __sys__.__root__);",
            );
        }

        if (typeof Sys !== "string") {
            throw new Error(
                "XyPriss Initialization Error: To create a plugin, you MUST provide the plugin's root path or its '__sys__' instance as the second argument to Plugin.create().\n" +
                    "Example: return Plugin.create({ ... }, __sys__.__root__);",
            );
        }
        const pluginRoot = Sys;

        if (!pluginRoot) {
            throw new Error(
                "XyPriss Security Error: The provided root or '__sys__' instance is invalid or lacks a captured project root.",
            );
        }
        
        // Explicitly trust the root provided by the developer
        plugin.__root__ = pluginRoot;

        return plugin;
    },

    factory<TConfig = any>(
        creator: (config: TConfig) => XyPrissPlugin,
        rootOrSys: any,
    ): PluginCreator {
        if (!rootOrSys) {
            throw new Error(
                "XyPriss Initialization Error: Plugin.factory() now requires the plugin's root path or '__sys__' instance as the second argument.",
            );
        }

        const pluginRoot =
            typeof rootOrSys === "string" ? rootOrSys : rootOrSys.__root__;

        if (!pluginRoot) {
            throw new Error(
                "XyPriss Security Error: The provided root or '__sys__' instance is invalid for this factory.",
            );
        }

        return ((config: TConfig) => {
            const plugin = creator(config);
            plugin.__root__ = pluginRoot;
            return plugin;
        }) as PluginCreator;
    },

    // /**
    //  * Get statistics for all registered plugins
    //  * Requires MANAGE_PLUGINS permission
    //  */
    // getStats(): import("../types/PluginTypes").PluginStats[] {
    //     const manager = getGlobalPluginManager();
    //     if (!manager) return [];
    //     return manager.getPluginStats();
    // },

    // /**
    //  * Set permission for a plugin hook
    //  * Requires MANAGE_PLUGINS permission
    //  */
    // setPermission(
    //     pluginName: string,
    //     hookId: string,
    //     allowed: boolean,
    //     by?: string
    // ): void {
    //     const manager = getGlobalPluginManager();
    //     if (manager) {
    //         manager.setPluginPermission(pluginName, hookId, allowed, by);
    //     }
    // },

    // /**
    //  * Toggle plugin enabled/disabled state
    //  * Requires MANAGE_PLUGINS permission
    //  */
    // toggle(pluginName: string, enabled: boolean, by?: string): void {
    //     const manager = getGlobalPluginManager();
    //     if (manager) {
    //         manager.togglePlugin(pluginName, enabled, by);
    //     }
    // },
    /**
     * Create an empty plugin that does nothing.
     * Useful for placeholder plugins or testing.
     * @returns A do-nothing plugin instance
     */
    void(): XyPrissPlugin {
        return {
            name: "void-plugin-" + Math.random().toString(36).substring(7),
            version: "1.0.0",
        };
    },
};

