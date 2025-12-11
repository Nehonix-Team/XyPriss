/**
 * Plugin API - Imperative plugin registration
 *
 * Usage:
 *   import { Plugin } from 'xypriss';
 *
 *   Plugin.register({
 *     name: 'my-plugin',
 *     version: '1.0.0',
 *     onServerStart: () => console.log('Started!')
 *   });
 */

import type { XyPrissPlugin, PluginCreator } from "../types/PluginTypes";
import { PluginManager } from "../core/PluginManager";

class PluginAPI {
    private static manager: PluginManager | null = null;

    /**
     * Set the plugin manager (called internally by ServerFactory)
     */
    static setManager(manager: PluginManager): void {
        this.manager = manager;
    }

    /**
     * Register a plugin imperatively
     *
     * @example
     * Plugin.register({
     *   name: 'my-plugin',
     *   version: '1.0.0',
     *   onServerStart: () => console.log('Started!')
     * });
     */
    static register(plugin: XyPrissPlugin | PluginCreator, config?: any): void {
        if (!this.manager) {
            throw new Error(
                "Plugin system not initialized. Create a server first."
            );
        }
        this.manager.register(plugin, config);
    }

    /**
     * Get a registered plugin by name
     */
    static get(name: string): XyPrissPlugin | undefined {
        if (!this.manager) {
            throw new Error(
                "Plugin system not initialized. Create a server first."
            );
        }
        return this.manager.getPlugin(name);
    }

    /**
     * Create a plugin (helper for creating plugin objects)
     *
     * @example
     * const myPlugin = Plugin.create({
     *   name: 'my-plugin',
     *   version: '1.0.0',
     *   onServerStart: () => console.log('Started!')
     * });
     */
    static create(plugin: XyPrissPlugin): XyPrissPlugin {
        return plugin;
    }

    /**
     * Create a plugin factory function
     *
     * @example
     * const createAuthPlugin = Plugin.factory((config) => ({
     *   name: 'auth',
     *   version: '1.0.0',
     *   onRequest: (req, res, next) => {
     *     // Use config here
     *     next();
     *   }
     * }));
     */
    static factory(creator: PluginCreator): PluginCreator {
        return creator;
    }
}

export { PluginAPI as Plugin };

