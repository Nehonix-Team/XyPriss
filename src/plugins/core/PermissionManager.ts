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
import { __sys__ } from "../../xhsc";
import { PluginPermission } from "../types/PluginPermissions";
import { OFFICIAL_PLUGINS } from "../const/OFFICIAL_PLUGINS";

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

        // --- BUILT-IN PLUGINS BYPASS ---
        // Built-in (official) plugins always bypass security checks for full capabilities.
        if (OFFICIAL_PLUGINS.includes(pluginName)) {
            return true;
        }

        const hookId = HOOK_ID_MAP[internalHookName] || internalHookName;
        const meta = HOOK_METADATA[hookId];
        const permissions = __sys__?.vars.get(
            "pluginPermissions",
        ) as PluginPermission[];

        // Special case: Privileged hooks are denied by default unless explicitly allowed
        const isPrivilegedHook = [
            PluginHookIds.MANAGE_PLUGINS,
            PluginHookIds.ON_CONSOLE_INTERCEPT,
            PluginHookIds.ON_AUXILIARY_SERVER_DEPLOY,
            PluginHookIds.BYPASS_NAMESPACE,
            PluginHookIds.OVERWRITE_PROTECTED,
            PluginHookIds.GLOBAL_MIDDLEWARE,
            PluginHookIds.ACCESS_CONFIGS,
            PluginHookIds.ACCESS_SENSITIVE_DATA,
            PluginHookIds.ON_REQUEST,
            PluginHookIds.ON_RESPONSE,
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

        const isLifecycleHook = hookId.startsWith("XHS.HOOK.LIFECYCLE.");

        // If no permissions configured
        if (!permissions || permissions.length === 0) {
            if (isPrivilegedHook) {
                logDenial(
                    "Privileged hook denied by default.",
                    solutionPrivileged,
                );
                return false;
            }
            // Allow lifecycle hooks by default to permit boot, deny everything else
            return isLifecycleHook;
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
            // Allow lifecycle hooks by default to permit boot, deny everything else
            return isLifecycleHook;
        }

        // Check explicitly denied hooks first (they override everything)
        if (pluginPerm.deniedHooks?.includes(hookId)) {
            logDenial(
                "Explicitly denied in configuration.",
                `Remove '${hookId}' from 'deniedHooks' for plugin '${pluginName}'.`,
            );
            return false;
        }

        const policy = pluginPerm.policy || "deny"; // G3 Security: Default to 'deny' (Whitelist)
        const allowedHooks = pluginPerm.allowedHooks;

        // 1. Strict Enforcement for Privileged Hooks
        if (isPrivilegedHook) {
            if (Array.isArray(allowedHooks) && allowedHooks.includes(hookId)) {
                return true;
            }

            // WILDWACRD STOP GAP: '*' should never grant privileged capabilities.
            logDenial(
                "Privileged hook must be explicitly whitelisted by string declaration. Wildcard '*' does not grant privileged capabilities.",
                solutionPrivileged,
            );
            return false;
        }

        // 2. Lifecycle Hooks: Always allowed for engine stability (unless denied)
        if (isLifecycleHook) return true;

        // 3. Standard Hook Logic
        if (policy === "deny") {
            // "deny" policy = Whitelist mode
            if (isLifecycleHook) return true; // Lifecycle is always whitelisted by default
            if (allowedHooks === "*") return true;
            if (Array.isArray(allowedHooks) && allowedHooks.includes(hookId)) {
                return true;
            }
            logDenial(
                "Denied by 'deny' policy (Whitelist mode).",
                `Add '${hookId}' to 'allowedHooks' for plugin '${pluginName}'.`,
            );
            return false;
        }

        // "allow" policy = Blacklist mode
        return true;
    }

    /**
     * Creates a masked version of the request object for security in plugin hooks.
     * Prevents plugins from accessing sensitive data like body, query, and cookies
     * unless explicitly authorized with ACCESS_SENSITIVE_DATA permission.
     */
    public maskRequest(req: any, pluginName?: string): any {
        if (!req) return req;

        if (pluginName) {
            const permissions = __sys__?.vars.get(
                "pluginPermissions",
            ) as PluginPermission[];
            if (permissions) {
                const pluginPerm = permissions.find(
                    (p) => p.name === pluginName,
                );
                if (pluginPerm) {
                    const allowedHooks = pluginPerm.allowedHooks || [];
                    const isAllowed =
                        Array.isArray(allowedHooks) &&
                        allowedHooks.includes(
                            PluginHookIds.ACCESS_SENSITIVE_DATA,
                        );
                    const isDenied = pluginPerm.deniedHooks?.includes(
                        PluginHookIds.ACCESS_SENSITIVE_DATA,
                    );

                    if (isAllowed && !isDenied) {
                        return req; // Explicitly allowed: return unmasked real request
                    }
                }
            }
        }

        const maskedMessage = `${pluginName} is trying to access sensitive request data, which is restricted for security reasons. Requires XHS.PERM.SECURITY.SENSITIVE_DATA permission.`;
        const sensitiveFields = [
            "body",
            "query",
            "cookies",
            "params",
            "headers",
        ];

        return new Proxy(req, {
            get(target, prop) {
                if (typeof prop === "string" && prop === "headers") {
                    const originalHeaders = target[prop] || {};
                    const safeHeaders = [
                        "user-agent",
                        "referer",
                        "host",
                        "accept",
                        "content-type",
                        "content-length",
                        "connection",
                        "x-forwarded-for",
                        "cf-connecting-ip",
                    ];

                    const maskedHeaders: Record<string, string> = {};
                    for (const [key, value] of Object.entries(
                        originalHeaders,
                    )) {
                        const lowerKey = key.toLowerCase();
                        if (safeHeaders.includes(lowerKey)) {
                            maskedHeaders[key] = value as string;
                        }
                    }
                    return maskedHeaders;
                }

                if (
                    typeof prop === "string" &&
                    sensitiveFields.includes(prop)
                ) {
                    return `[${pluginName}] Access to sensitive request data '${prop}' is restricted for security reasons. Requires XHS.PERM.SECURITY.SENSITIVE_DATA.`;
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

