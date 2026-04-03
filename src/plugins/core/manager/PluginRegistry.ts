/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import { Logger } from "../../../shared/logger";
import type { XyPrissPlugin } from "../../types/PluginTypes";

/**
 * Plugin Registry
 * Handles plugin storage, retrieval, and dependency resolution
 */
export class PluginRegistry {
    private plugins: Map<string, XyPrissPlugin> = new Map();
    private pluginOrder: string[] = [];
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public register(plugin: XyPrissPlugin): void {
        this.plugins.set(plugin.name, plugin);
    }

    /**
     * Unregister a plugin from the registry
     */
    public unregister(name: string): void {
        this.plugins.delete(name);
        this.pluginOrder = this.pluginOrder.filter((n) => n !== name);
    }

    /**
     * Check if a plugin is registered
     */
    public has(name: string): boolean {
        return this.plugins.has(name);
    }

    /**
     * Get a plugin by name
     */
    public get(name: string): XyPrissPlugin | undefined {
        return this.plugins.get(name);
    }

    public getAll(): XyPrissPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugins by type
     */
    public getByType(type: string): XyPrissPlugin[] {
        return Array.from(this.plugins.values()).filter((p) => p.type === type);
    }

    /**
     * Get the resolved execution order of plugins
     */
    public getOrder(): string[] {
        return this.pluginOrder;
    }

    /**
     * Resolve dependencies and determine execution order
     */
    public resolveDependencies(): void {
        const visited = new Set<string>();
        const temp = new Set<string>();
        const order: string[] = [];

        const visit = (name: string) => {
            if (temp.has(name)) {
                throw new Error(`Circular dependency detected: ${name}`);
            }
            if (visited.has(name)) return;

            temp.add(name);
            const plugin = this.plugins.get(name);

            if (plugin?.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (!this.plugins.has(dep)) {
                        throw new Error(
                            `Plugin '${name}' depends on '${dep}' which is not registered`,
                        );
                    }
                    visit(dep);
                }
            }

            temp.delete(name);
            visited.add(name);
            order.push(name);
        };

        for (const name of this.plugins.keys()) visit(name);

        this.pluginOrder = order;
        this.logger.debug("plugins", "Plugin execution order:", order);
    }
}

