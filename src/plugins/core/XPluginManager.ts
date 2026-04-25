/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

/**
 * Plugin Manager
 * Orchestrates plugin registration, lifecycle, and security via specialized modules
 */

import { Logger } from "../../shared/logger";
import type { XyPrissApp } from "../../types/types";
import type {
    XyPrissPlugin,
    XyPrissServer,
    PluginCreator,
} from "../types/PluginTypes";
import { PermissionManager } from "./PermissionManager";
import { PluginRegistry } from "./manager/PluginRegistry";
import { PluginSecurity } from "./manager/PluginSecurity";
import { PluginHookRunner } from "./manager/PluginHookRunner";
import { PluginInterceptor } from "./manager/PluginInterceptor";
import { PluginManagement } from "./manager/PluginManagement";
import { PluginLoader } from "./manager/PluginLoader";
import { XemsBuiltinPlugin } from "../builtin/xems/XemsBuiltinPlugin";

export class XyPluginManager {
    private server: XyPrissServer;
    private logger: Logger;
    private initialized: { value: boolean } = { value: false };
    private permissionManager: PermissionManager;

    // Sub-modules
    private registry: PluginRegistry;
    private security: PluginSecurity;
    private hooks: PluginHookRunner;
    private interceptor: PluginInterceptor;
    private management: PluginManagement;
    private loader: PluginLoader;

    constructor(server: XyPrissServer) {
        this.server = server;
        this.logger = (server as any).getLogger?.() || new Logger();
        this.permissionManager = new PermissionManager(server, this.logger);

        // Initialize sub-modules
        this.registry = new PluginRegistry(this.logger);
        this.security = new PluginSecurity();
        this.hooks = new PluginHookRunner(
            this.registry,
            this.permissionManager,
            this.security,
            this.server,
            this.logger,
        );
        this.interceptor = new PluginInterceptor(
            this.registry,
            this.permissionManager,
            this.logger,
        );
        this.management = new PluginManagement(
            this.registry,
            this.permissionManager,
            this.server,
            this.logger,
        );
        this.loader = new PluginLoader(
            this.registry,
            this.security,
            this.hooks,
            this.interceptor,
            this.management,
            this.server,
            this.logger,
            this.initialized,
            this.permissionManager,
        );
    }

    /**
     * Register a plugin
     */
    async register(
        plugin: XyPrissPlugin | PluginCreator,
        config?: any,
    ): Promise<void> {
        return this.loader.register(plugin, config);
    }

    /**
     * Alias for register (Legacy compatibility)
     */
    async registerPlugin(
        plugin: XyPrissPlugin | PluginCreator,
        config?: any,
    ): Promise<void> {
        return this.register(plugin, config);
    }

    /**
     * Unregister a plugin (Legacy compatibility)
     */
    async unregisterPlugin(pluginId: string): Promise<void> {
        return this.loader.unregister(pluginId);
    }

    /**
     * Initialize all registered plugins
     */
    async initialize(): Promise<void> {
        return this.loader.initialize();
    }

    /**
     * Toggle plugin activation state
     */
    public togglePlugin(
        pluginName: string,
        enabled: boolean,
        requestedBy?: string,
    ): void {
        this.management.togglePlugin(pluginName, enabled, requestedBy);
    }

    /**
     * Execute a lifecycle hook on all plugins
     */
    async executeHook(
        hookName: keyof XyPrissPlugin,
        ...args: any[]
    ): Promise<void> {
        await this.hooks.executeHook(hookName, ...args);
    }

    /**
     * Trigger various event hooks
     */
    triggerSecurityAttack(attackData: any, req: any, res: any): void {
        this.hooks.triggerSecurityAttack(attackData, req, res);
    }

    triggerResponseTime(responseTime: number, req: any, res: any): void {
        this.hooks.triggerResponseTime(responseTime, req, res);
    }

    triggerRouteError(error: Error, req: any, res: any): void {
        this.hooks.triggerRouteError(error, req, res);
    }

    triggerRateLimit(limitData: any, req: any, res: any): void {
        this.hooks.triggerRateLimit(limitData, req, res);
    }

    /**
     * Apply plugin components to the server application
     */
    registerRoutes(app: XyPrissApp): void {
        this.interceptor.registerRoutes(app);
    }

    applyMiddleware(app: XyPrissApp): void {
        this.interceptor.applyMiddleware(app);
    }

    applyErrorHandlers(app: XyPrissApp): void {
        this.interceptor.applyErrorHandlers(app);
    }

    getPlugin(name: string): XyPrissPlugin | undefined {
        return this.registry.get(name);
    }

    /**
     * Get all registered plugins (Legacy compatibility)
     */
    public getAllPlugins(): XyPrissPlugin[] {
        return this.registry.getAll();
    }

    /**
     * Get plugins by type (Legacy compatibility)
     */
    public getPluginsByType(type: any): XyPrissPlugin[] {
        return this.registry.getByType(type);
    }

    /**
     * Get plugin statistics (Legacy compatibility)
     */
    getPluginStats(pluginId?: string): any {
        if (pluginId) {
            const stats = this.management.getPluginStats();
            return stats.find((s) => s.name === pluginId) || {};
        }
        return this.management.getPluginStats();
    }

    /**
     * Get registry statistics (Legacy compatibility)
     */
    public getPluginRegistryStats(): any {
        const all = this.registry.getAll();
        return {
            totalPlugins: all.length,
            activePlugins: all.length,
            averageExecutionTime: 0,
        };
    }

    /**
     * Get engine statistics (Legacy compatibility)
     */
    public getPluginEngineStats(): any {
        return this.getPluginEngine().getEngineStats();
    }

    setPluginPermission(
        pluginName: string,
        hookId: string,
        allowed: boolean,
        by: string = "system",
    ): void {
        this.management.setPluginPermission(pluginName, hookId, allowed, by);
    }

    /**
     * Get a legacy-compatible plugin engine bridge
     */
    public getPluginEngine(): any {
        return {
            executePlugins: async (
                type: any,
                req: any,
                res: any,
                next: any,
            ) => {
                // Bridge to new interceptor hooks
                // Filter plugins by type and execute their onRequest or onResponse hooks
                const plugins = this.registry.getByType(type);
                for (const plugin of plugins) {
                    if (
                        this.permissionManager.isPluginDisabled(
                            plugin.name,
                            "onRequest",
                        )
                    )
                        continue;

                    try {
                        if (plugin.onRequest) {
                            await plugin.onRequest(req, res, next);
                        }
                    } catch (error) {
                        this.logger.error(
                            "plugins",
                            `Error executing plugin ${plugin.name} during ${type} phase:`,
                            error,
                        );
                    }
                }
                return true;
            },
            triggerConsoleLogHook: (log: any) => {
                this.hooks.executeHook("onConsoleIntercept", log);
            },
            getEngineStats: () => ({
                activeExecutions: 0,
                successRate: 100,
            }),
        };
    }

    /**
     * Initialize built-in core plugins
     */
    public async initializeBuiltinPlugins(): Promise<void> {
        this.logger.debug("plugins", "Initializing built-in plugins...");

        try {
            // 1. XEMS Core Plugin (Security & Sessions)
            await this.register(new XemsBuiltinPlugin());

            this.logger.debug("plugins", "Built-in plugins registered");
        } catch (error: any) {
            this.logger.error(
                "plugins",
                "Failed to initialize built-in plugins:",
                error,
            );
        }
    }

    /**
     * Shut down all plugins
     */
    async shutdown(): Promise<void> {
        await this.hooks.executeHook("onServerStop");
    }
}

