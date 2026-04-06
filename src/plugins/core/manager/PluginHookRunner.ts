/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import { Logger } from "../../../shared/logger";
import type { PermissionManager } from "../PermissionManager";
import type { PluginRegistry } from "./PluginRegistry";
import type { PluginSecurity } from "./PluginSecurity";
import type { XyPrissPlugin } from "../../types/PluginTypes";

/**
 * Plugin Hook Runner
 * Handles the execution of lifecycle hooks and event triggers
 */
export class PluginHookRunner {
    private registry: PluginRegistry;
    private permissionManager: PermissionManager;
    private security: PluginSecurity;
    private server: any;
    private logger: Logger;

    constructor(
        registry: PluginRegistry,
        permissionManager: PermissionManager,
        security: PluginSecurity,
        server: any,
        logger: Logger,
    ) {
        this.registry = registry;
        this.permissionManager = permissionManager;
        this.security = security;
        this.server = server;
        this.logger = logger;
    }

    /**
     * Execute a lifecycle hook on all plugins in order
     */
    public async executeHook(
        hookName: keyof XyPrissPlugin,
        ...args: any[]
    ): Promise<void> {
        const order = this.registry.getOrder();

        for (const pluginName of order) {
            const plugin = this.registry.get(pluginName);
            if (plugin && typeof plugin[hookName] === "function") {
                const restrictedServer = this.security.createRestrictedServer(
                    this.server,
                    pluginName,
                    this.permissionManager,
                );

                try {
                    // Check permission (logs error if denied)
                    if (
                        this.permissionManager.checkPermission(
                            pluginName,
                            hookName as string,
                        )
                    ) {
                        // LAZY SECURITY DISCOVERY: If root is missing, find it now pendant l'exécution
                        if (!plugin.__root__) {
                            const stack = new Error().stack || "";
                            this.security.verifyContract(
                                plugin,
                                stack,
                                true, // Execution phase
                            );
                        }

                        // For server lifecycle hooks, pass the server instance
                        if (
                            [
                                "onServerStart",
                                "onServerReady",
                                "onServerStop",
                            ].includes(hookName)
                        ) {
                            await (plugin[hookName] as any)(
                                restrictedServer,
                                ...args,
                            );
                        } else {
                            // Mask HTTP requests passed as arguments for the current plugin
                            const maskedArgs = args.map((arg) => {
                                // Simple heuristic for XyPrissRequest: has headers and socket/url
                                if (
                                    arg &&
                                    typeof arg === "object" &&
                                    arg.headers &&
                                    (arg.socket || arg.url)
                                ) {
                                    return this.permissionManager.maskRequest(
                                        arg,
                                        pluginName,
                                    );
                                }
                                return arg;
                            });
                            await (plugin[hookName] as any)(...maskedArgs);
                        }
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.${hookName}:`,
                        error,
                    );
                    // If it's a critical lifecycle hook, rethrow to stop server startup
                    if (hookName === "onServerStart") {
                        throw error;
                    }
                }
            }
        }
    }

    /**
     * Trigger a security attack hook on all plugins
     */
    public triggerSecurityAttack(attackData: any, req: any, res: any): void {
        this.executeEventHook("onSecurityAttack", attackData, req, res);
    }

    /**
     * Trigger a response time hook on all plugins
     */
    public triggerResponseTime(responseTime: number, req: any, res: any): void {
        this.executeEventHook("onResponseTime", responseTime, req, res);
    }

    /**
     * Trigger a route error hook on all plugins
     */
    public triggerRouteError(error: Error, req: any, res: any): void {
        this.executeEventHook("onRouteError", error, req, res);
    }

    /**
     * Trigger a rate limit hook on all plugins
     */
    public triggerRateLimit(limitData: any, req: any, res: any): void {
        this.executeEventHook("onRateLimit", limitData, req, res);
    }

    /**
     * Internal helper to execute event hooks with masked requests
     */
    private executeEventHook(
        hookName: keyof XyPrissPlugin,
        data: any,
        req: any,
        res: any,
    ): void {
        this.executeHook(hookName, data, req, res).catch(() => {});
    }
}

