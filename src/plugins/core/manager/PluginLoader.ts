/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import { Logger } from "../../../shared/logger";
import { createServer } from "../../../server/ServerFactory";
import type { ServerOptions } from "../../../types/types";
import type { PermissionManager } from "../PermissionManager";
import type { PluginRegistry } from "./PluginRegistry";
import type { PluginSecurity } from "./PluginSecurity";
import type { PluginHookRunner } from "./PluginHookRunner";
import type { PluginInterceptor } from "./PluginInterceptor";
import type { PluginManagement } from "./PluginManagement";
import type {
    XyPrissPlugin,
    PluginCreator,
    XyPrissServer,
} from "../../types/PluginTypes";
import { withInternalFlag } from "../../../server/utils/internalFlagsFunctions";
import { Hash } from "xypriss-security";

/**
 * Plugin Loader
 * Handles the heavy lifting of plugin registration and system initialization
 */
export class PluginLoader {
    private registry: PluginRegistry;
    private security: PluginSecurity;
    private hooks: PluginHookRunner;
    private interceptor: PluginInterceptor;
    private management: PluginManagement;
    private server: XyPrissServer;
    private logger: Logger;
    private initializedRef: { value: boolean };
    private permissionManager: PermissionManager;

    constructor(
        registry: PluginRegistry,
        security: PluginSecurity,
        hooks: PluginHookRunner,
        interceptor: PluginInterceptor,
        management: PluginManagement,
        server: XyPrissServer,
        logger: Logger,
        initializedRef: { value: boolean },
        permissionManager: PermissionManager,
    ) {
        this.registry = registry;
        this.security = security;
        this.hooks = hooks;
        this.interceptor = interceptor;
        this.management = management;
        this.server = server;
        this.logger = logger;
        this.initializedRef = initializedRef;
        this.permissionManager = permissionManager;
    }

    /**
     * Register a plugin
     */
    public async register(
        plugin: XyPrissPlugin | PluginCreator,
        config?: any,
    ): Promise<void> {
        // If it's a function, call it to get the plugin
        const pluginInstance =
            typeof plugin === "function" ? plugin(config) : plugin;

        // --- SECURITY & VALIDATION ---
        const callerStack = new Error().stack || "";
        this.security.verifyContract(pluginInstance, callerStack);
        this.security.validateMetadata(pluginInstance);

        if (pluginInstance.__root__) {
            const fs = require("fs");
            const path = require("path");
            const sigPath = path.join(
                pluginInstance.__root__,
                "xypriss.plugin.xsig",
            );
            if (fs.existsSync(sigPath)) {
                this.security.verifyContentIntegrity(
                    pluginInstance.__root__,
                    pluginInstance.name,
                );
            }
        }

        // Generate fingerprint and UID
        pluginInstance.fingerprint =
            await this.generateFingerprint(pluginInstance);
        pluginInstance.uid = this.generateUid(pluginInstance);

        // Check for exact technical duplicates (same UID)
        if (this.registry.has(pluginInstance.uid)) {
            if (!this.server.options?.isAuxiliary) {
                this.logger.error(
                    "plugins",
                    `Plugin "${pluginInstance.name}" (${pluginInstance.uid}) is already registered. Duplicate ignored.`,
                );
            }
            return;
        }

        // Check permission for onRegister if it exists
        if (pluginInstance.onRegister) {
            if (
                !this.permissionManager.checkPermission(
                    pluginInstance.name,
                    "onRegister",
                )
            ) {
                return;
            }
        }

        // Store plugin
        this.registry.register(pluginInstance);

        if (!this.server.options?.isAuxiliary) {
            const serverName =
                this.server.options?.logging?.instanceName || "main";
            this.logger.info(
                "plugins",
                `Registered plugin for '${serverName}': xypriss::ext/${pluginInstance.name}@${pluginInstance.version} [hash:${pluginInstance.uid}]`,
            );
        }

        // If already initialized, fully initialize this plugin immediately
        if (this.initializedRef.value) {
            await this.initializeLatePlugin(pluginInstance);
        }
    }

    /**
     * Unregister a plugin
     */
    public async unregister(name: string): Promise<void> {
        this.logger.info("plugins", `Unregistering plugin: ${name}`);
        if (this.registry.has(name)) {
            this.registry.unregister(name);
            this.logger.info("plugins", `Unregistered plugin: ${name}`);
        }
    }

    /**
     * Initialize all plugins (resolve dependencies and set execution order)
     */
    public async initialize(): Promise<void> {
        this.registry.resolveDependencies();
        const order = this.registry.getOrder();

        // --- STEP 1: Call onRegister for all plugins ---
        // This is the first hook, called only after all plugins are successfully registered in the registry
        for (const pluginName of order) {
            const plugin = this.registry.get(pluginName);
            if (
                plugin &&
                plugin.onRegister &&
                this.permissionManager.checkPermission(
                    plugin.name,
                    "onRegister",
                )
            ) {
                try {
                    const result = plugin.onRegister(null);
                    if (result instanceof Promise) {
                        await result;
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onRegister:`,
                        error,
                    );
                }
            }
        }

        this.initializedRef.value = true; // Set before calling hooks so late-registered plugins are detected
        await this.hooks.executeHook("onServerStart");

        // Execute management hook for plugins with permission
        for (const pluginName of order) {
            const plugin = this.registry.get(pluginName);
            if (
                plugin &&
                typeof plugin.managePlugins === "function" &&
                this.permissionManager.checkPermission(
                    plugin.name,
                    "managePlugins",
                )
            ) {
                try {
                    await plugin.managePlugins({
                        getStats: () => this.management.getPluginStats(),
                        setPermission: (
                            p: string,
                            h: string,
                            a: boolean,
                            by?: string,
                        ) =>
                            this.management.setPluginPermission(
                                p,
                                h,
                                a,
                                by || pluginName,
                            ),
                        toggle: (p: string, e: boolean, by?: string) =>
                            this.management.togglePlugin(
                                p,
                                e,
                                by || pluginName,
                            ),
                    });
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.managePlugins:`,
                        error,
                    );
                }
            }
        }

        // Execute Ops hook for plugins with permission to deploy auxiliary servers
        for (const pluginName of order) {
            const plugin = this.registry.get(pluginName);
            if (
                plugin &&
                typeof plugin.onAuxiliaryServerDeploy === "function" &&
                this.permissionManager.checkPermission(
                    plugin.name,
                    "onAuxiliaryServerDeploy",
                )
            ) {
                try {
                    await plugin.onAuxiliaryServerDeploy(
                        {
                            createAuxiliaryServer: (options: ServerOptions) =>
                                createServer(
                                    withInternalFlag(
                                        {
                                            ...options,
                                            performance: { enabled: false },
                                            plugins: { register: [] },
                                            logging: {
                                                enabled: true,
                                                level: "info",
                                            },
                                        },
                                        "isAuxiliary",
                                    ) as any,
                                ),

                            getRouteRegistry: () =>
                                (this.server.app as any).getRouteRegistry(),
                        },
                        this.server,
                    );
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onAuxiliaryServerDeploy:`,
                        error,
                    );
                }
            }
        }
    }

    /**
     * Handle initialization for a late-registered plugin
     */
    private async initializeLatePlugin(plugin: XyPrissPlugin): Promise<void> {
        // Resolve dependencies for this plugin
        this.registry.resolveDependencies();

        // Register routes for this late plugin
        this.interceptor.registerPluginRoutes(plugin, this.server.app, true);

        // Apply middleware for this late plugin
        if (plugin.middleware || plugin.onRequest) {
            this.interceptor.applyPluginMiddleware(plugin, this.server.app);
        }

        // Call lifecycle hooks for late plugin
        const restrictedServer = this.security.createRestrictedServer(
            this.server,
            plugin.name,
            this.permissionManager,
        );

        if (plugin.onServerStart) {
            if (
                this.permissionManager.checkPermission(
                    plugin.name,
                    "onServerStart",
                )
            ) {
                Promise.resolve(
                    plugin.onServerStart(restrictedServer as any),
                ).catch((error) => {
                    this.logger.error(
                        "plugins",
                        `Error in ${plugin.name}.onServerStart:`,
                        error,
                    );
                });
            }
        }

        if (plugin.onServerReady) {
            if (
                this.permissionManager.checkPermission(
                    plugin.name,
                    "onServerReady",
                )
            ) {
                Promise.resolve(
                    plugin.onServerReady(restrictedServer as any),
                ).catch((error) => {
                    this.logger.error(
                        "plugins",
                        `Error in ${plugin.name}.onServerReady:`,
                        error,
                    );
                });
            }
        }
    }

    /**
     * Generate a fingerprint based on basic metadata
     */
    private async generateFingerprint(plugin: XyPrissPlugin): Promise<string> {
        // description + name
        const base = `${plugin.description || ""}:${plugin.name}`;
        // Use Hash.create from xypriss-security
        try {
            const hash = Hash.create(base, { algorithm: "sha256" })
                .toString("hex")
                .substring(0, 10);
            return hash;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate a technical UID
     */
    private generateUid(plugin: XyPrissPlugin): string {
        return `${plugin.name}.${plugin.fingerprint}`;
    }
}

