/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import { Logger } from "../../shared/logger/Logger";
import {
    PluginHookIds,
    HOOK_ID_MAP,
    HOOK_METADATA,
} from "../const/PluginHookIds";
import type { XyPrissServer } from "../types/PluginTypes";

/**
 * PermissionManager handles all security-related checks for the plugin system.
 * It enforces hook policies and masks sensitive data.
 */
export class PermissionManager {
    private logger: Logger;
    private disabledPlugins: Set<string> = new Set();

    constructor(
        private server: XyPrissServer,
        logger?: Logger,
    ) {
        this.logger = logger || new Logger();
    }

    /**
     * Disable a plugin globally.
     * @param pluginName - Name of the plugin to disable.
     */
    public disablePlugin(pluginName: string): void {
        this.disabledPlugins.add(pluginName);
    }

    /**
     * Enable a plugin globally.
     * @param pluginName - Name of the plugin to enable.
     */
    public enablePlugin(pluginName: string): void {
        this.disabledPlugins.delete(pluginName);
    }

    /**
     * Check if a plugin is disabled and log a warning if it is.
     */
    public isPluginDisabled(
        pluginName: string,
        internalHookName: string,
    ): boolean {
        if (this.disabledPlugins.has(pluginName)) {
            const hookId = HOOK_ID_MAP[internalHookName] || internalHookName;
            const meta = HOOK_METADATA[hookId];

            let message = `Plugin '${pluginName}' is disabled but tried to execute hook '${hookId}'.`;
            if (meta) {
                message = `Plugin '${pluginName}' is disabled and cannot ${meta.action} (Hook: ${hookId} - ${meta.name}).`;
            }

            this.logger.error(
                "plugins",
                `${message} Please enable it if you want to use its features.`,
            );
            return true;
        }
        return false;
    }

    /**
     * Check if a plugin is allowed to execute a specific hook.
     * Enforces strict policies for privileged hooks.
     */
    public checkPermission(
        pluginName: string,
        internalHookName: string,
    ): boolean {
        if (this.isPluginDisabled(pluginName, internalHookName)) {
            return false;
        }

        const hookId = HOOK_ID_MAP[internalHookName] || internalHookName;
        const meta = HOOK_METADATA[hookId];
        const permissions = this.server.app.configs?.pluginPermissions;

        // Special case: Privileged hooks are denied by default unless explicitly allowed
        const isPrivilegedHook = [
            PluginHookIds.MANAGE_PLUGINS,
            PluginHookIds.ON_CONSOLE_INTERCEPT,
            PluginHookIds.ON_AUXILIARY_SERVER_DEPLOY,
            PluginHookIds.ACCESS_CONFIGS,
        ].includes(hookId as any);

        // Helper to log denials
        const logDenial = (reason: string, solution?: string) => {
            let message = `Plugin '${pluginName}' is denied access to hook '${hookId}'.`;

            if (meta) {
                const typeSuffix = isPrivilegedHook
                    ? "This is a privileged action restricted by the engine."
                    : "This action is currently not allowed by the security policy.";
                message = `Plugin '${pluginName}' is attempting to ${meta.action} using hook '${hookId}' (${meta.name}).\n${meta.description}\n${typeSuffix}`;
            }

            this.logger.error(
                "plugins",
                `${message}${solution ? `\nTo allow this: ${solution}` : ""}`,
            );
        };

        const solutionPrivileged = `Add '${hookId}' to 'allowedHooks' in the server configuration for plugin '${pluginName}'.`;

        // If no permissions configured
        if (!permissions || permissions.length === 0) {
            if (isPrivilegedHook) {
                logDenial(
                    "Privileged hook denied by default.",
                    solutionPrivileged,
                );
                return false;
            }
            return true;
        }

        const pluginPerm = permissions.find((p) => p.name === pluginName);

        // If plugin is not listed in permissions
        if (!pluginPerm) {
            if (isPrivilegedHook) {
                logDenial(
                    "Privileged hook denied by default.",
                    solutionPrivileged,
                );
                return false;
            }
            return true;
        }

        // Check explicitly denied hooks first (they override everything)
        if (pluginPerm.deniedHooks?.includes(hookId)) {
            logDenial(
                "Explicitly denied in configuration.",
                `Remove '${hookId}' from 'deniedHooks' for plugin '${pluginName}'.`,
            );
            return false;
        }

        const policy = pluginPerm.policy || "allow";
        const allowedHooks = pluginPerm.allowedHooks;

        // Strict Enforcement for Privileged Hooks
        if (isPrivilegedHook) {
            if (Array.isArray(allowedHooks) && allowedHooks.includes(hookId)) {
                return true;
            }

            // WILDWACRD STOP GAP: '*' should never grant privileged capabilities.
            // Privileged capabilities require rigorous, explicit declaration.
            logDenial(
                "Privileged hook must be explicitly whitelisted by string declaration. Wildcard '*' does not grant privileged capabilities.",
                solutionPrivileged,
            );
            return false;
        }

        // Standard Hook Logic
        if (policy === "deny") {
            // "deny" policy = Whitelist
            if (allowedHooks === "*") return true;
            if (Array.isArray(allowedHooks) && allowedHooks.includes(hookId)) {
                return true;
            }
            logDenial(
                "Denied by 'deny' policy (Whitelist mode).",
                `Add '${hookId}' to 'allowedHooks' or change policy for plugin '${pluginName}'.`,
            );
            return false;
        }

        // "allow" policy = Blacklist (already checked deniedHooks above)
        return true;
    }

    /**
     * Creates a masked version of the request object for security in plugin hooks.
     * Prevents plugins from accessing sensitive data like body, query, and cookies.
     */
    public maskRequest(req: any): any {
        if (!req) return req;

        const maskedMessage =
            "Access to sensitive request data is restricted in this hook for security reasons.";
        const sensitiveFields = ["body", "query", "cookies", "params"];

        return new Proxy(req, {
            get(target, prop) {
                if (
                    typeof prop === "string" &&
                    sensitiveFields.includes(prop)
                ) {
                    return maskedMessage;
                }
                const value = target[prop];
                if (typeof value === "function") {
                    return value.bind(target);
                }
                return value;
            },
            ownKeys(target) {
                return Reflect.ownKeys(target);
            },
            getOwnPropertyDescriptor(target, prop) {
                if (
                    typeof prop === "string" &&
                    sensitiveFields.includes(prop)
                ) {
                    return {
                        value: maskedMessage,
                        enumerable: true,
                        configurable: true,
                        writable: false,
                    };
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },
        });
    }
}

