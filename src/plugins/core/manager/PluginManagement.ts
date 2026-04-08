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
import type { PluginStats } from "../../types/PluginTypes";
import { HOOK_ID_MAP } from "../../const/PluginHookIds";

/**
 * Plugin Management
 * Handles plugin statistics, permissions, and state toggling
 */
export class PluginManagement {
    private registry: PluginRegistry;
    private permissionManager: PermissionManager;
    private server: any;
    private logger: Logger;

    constructor(
        registry: PluginRegistry,
        permissionManager: PermissionManager,
        server: any,
        logger: Logger,
    ) {
        this.registry = registry;
        this.permissionManager = permissionManager;
        this.server = server;
        this.logger = logger;
    }

    /**
     * Get statistics for all registered plugins
     */
    public getPluginStats(): PluginStats[] {
        const stats: PluginStats[] = [];
        const permissions = this.server.app.configs?.pluginPermissions || [];
        const plugins = this.registry.getAll();

        for (const plugin of plugins) {
            const name = plugin.name;
            const pluginPerm = permissions.find((p: any) => p.name === name);

            // Determine allowed hooks
            let allowedHooks: string[] | "*" = pluginPerm?.allowedHooks || "*";

            // If allowedHooks is '*', it means all hooks EXCEPT management hooks by default
            if (allowedHooks === "*") {
                const actualHooks: string[] = [];
                const denied = pluginPerm?.deniedHooks || [];
                for (const internalName in HOOK_ID_MAP) {
                    if (typeof (plugin as any)[internalName] === "function") {
                        const id =
                            HOOK_ID_MAP[
                                internalName as keyof typeof HOOK_ID_MAP
                            ];
                        if (
                            id !== HOOK_ID_MAP.managePlugins &&
                            !denied.includes(id)
                        ) {
                            actualHooks.push(id);
                        }
                    }
                }
                allowedHooks = actualHooks.length > 0 ? actualHooks : "*";
            } else if (Array.isArray(allowedHooks)) {
                const denied = pluginPerm?.deniedHooks || [];
                allowedHooks = allowedHooks.filter(
                    (h: string) => !denied.includes(h),
                );
            }

            stats.push({
                name: plugin.name,
                version: plugin.version,
                description: plugin.description || "",
                enabled: !this.permissionManager.isPluginDisabled(name, "any"),
                permissions: {
                    allowedHooks,
                    deniedHooks: pluginPerm?.deniedHooks || [],
                    policy: pluginPerm?.policy || "allow",
                },
                uid: plugin.uid,
                dependencies: plugin.dependencies || [],
            });
        }
        return stats;
    }

    /**
     * Set permission for a plugin hook
     */
    public setPluginPermission(
        pluginName: string,
        hookId: string,
        allowed: boolean,
        by: string = "system",
    ): void {
        this.logger.warn(
            "plugins",
            `Permission '${hookId}' for plugin '${pluginName}' ${
                allowed ? "granted" : "revoked"
            } by ${by}`,
        );
        if (!this.server.app.configs) {
            this.server.app.configs = {};
        }
        if (!this.server.app.configs.pluginPermissions) {
            this.server.app.configs.pluginPermissions = [];
        }

        let pluginPerm = this.server.app.configs.pluginPermissions.find(
            (p: any) => p.name === pluginName,
        );

        if (!pluginPerm) {
            pluginPerm = {
                name: pluginName,
                allowedHooks: allowed ? [hookId] : [],
                deniedHooks: allowed ? [] : [hookId],
                policy: "allow",
            };
            this.server.app.configs.pluginPermissions.push(pluginPerm);
            return;
        }

        if (allowed) {
            if (pluginPerm.deniedHooks) {
                pluginPerm.deniedHooks = pluginPerm.deniedHooks.filter(
                    (h: string) => h !== hookId,
                );
            }
            if (Array.isArray(pluginPerm.allowedHooks)) {
                if (!pluginPerm.allowedHooks.includes(hookId)) {
                    pluginPerm.allowedHooks.push(hookId);
                }
            } else if (pluginPerm.allowedHooks === "*") {
                // Already allowed
            } else {
                pluginPerm.allowedHooks = [hookId];
            }
        } else {
            if (!pluginPerm.deniedHooks) pluginPerm.deniedHooks = [];
            if (!pluginPerm.deniedHooks.includes(hookId)) {
                pluginPerm.deniedHooks.push(hookId);
            }
            if (Array.isArray(pluginPerm.allowedHooks)) {
                pluginPerm.allowedHooks = pluginPerm.allowedHooks.filter(
                    (h: string) => h !== hookId,
                );
            }
        }
    }

    /**
     * Disable a plugin globally
     */
    public togglePlugin(
        pluginName: string,
        enabled: boolean,
        requestedBy?: string,
    ): void {
        const caller = requestedBy || "system";
        if (enabled) {
            this.permissionManager.enablePlugin(pluginName);
            this.logger.info(
                "plugins",
                `Plugin '${pluginName}' enabled by '${caller}'`,
            );
        } else {
            this.permissionManager.disablePlugin(pluginName);
            this.logger.info(
                "plugins",
                `Plugin '${pluginName}' disabled by '${caller}'`,
            );
        }
    }
}

