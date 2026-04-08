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
        const id = plugin.uid || plugin.name;
        this.plugins.set(id, plugin);
    }

    /**
     * Unregister a plugin from the registry
     */
    public unregister(name: string): void {
        this.plugins.delete(name);
        this.pluginOrder = this.pluginOrder.filter((n) => n !== name);
    }

    /**
     * Check if a plugin is registered (by UID or name)
     */
    public has(id: string): boolean {
        if (this.plugins.has(id)) return true;
        // Fallback to name search if id is not found (for legacy/dependency resolution)
        return Array.from(this.plugins.values()).some((p) => p.name === id);
    }

    /**
     * Get a plugin by UID or name
     */
    public get(id: string): XyPrissPlugin | undefined {
        if (this.plugins.get(id)) return this.plugins.get(id);
        // Fallback: strictly return the first one that matches the name
        return Array.from(this.plugins.values()).find((p) => p.name === id);
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

        for (const id of this.plugins.keys()) visit(id);

        this.pluginOrder = order;
        this.logger.debug("plugins", "Plugin execution order:", order);
    }
}

