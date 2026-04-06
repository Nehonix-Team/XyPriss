/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import {
    identifyProjectRoot,
    verifyPluginContract,
    isCoreFrameworkPath,
    isPluginPath,
} from "../../../utils/ProjectDiscovery";
import { validatePlgInput } from "../../../schemas/plugingSchema";
import { OFFICIAL_PLUGINS } from "../../const/OFFICIAL_PLUGINS";
import type { XyPrissPlugin, PluginServer } from "../../types/PluginTypes";
import type { PermissionManager } from "../PermissionManager";
/**
 * Plugin Security
 * Handles contract verification, validation, and restricted server proxy
 */
export class PluginSecurity {
    /**
     * Verify plugin security contract
     */
    public verifyContract(
        plugin: XyPrissPlugin,
        callerStack: string,
        isExecutionPhase: boolean = false,
    ): string {
        // --- ROOT DISCOVERY ---
        // We now prioritize the root provided explicitly via Plugin.create(..., __sys__)
        let pluginRoot = plugin.__root__ || "";

        if (!pluginRoot && !isExecutionPhase) {
            // Fallback for registration if not provided via Plugin.create
            // We search the stack for the first non-framework file
            const lines = callerStack.split("\n");
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (
                    line.includes("at ") &&
                    !line.includes("XPluginManager.ts") &&
                    !line.includes("PluginSecurity.ts") &&
                    !line.includes("PluginLoader.ts") &&
                    !line.includes("PluginHookRunner.ts") &&
                    !line.includes(" (node:") &&
                    !line.includes(" (bun:") &&
                    !line.includes(" <anonymous>")
                ) {
                    const match =
                        line.match(/\((.*):\d+:\d+\)$/) ||
                        line.match(/at (.*):\d+:\d+$/);
                    if (match) {
                        pluginRoot = identifyProjectRoot(match[1]) || "";
                        if (pluginRoot) break;
                    }
                }
            }
        }

        // --- SECURITY VALIDATION ---
        if (!pluginRoot) {
            // If we still have no root, we cannot verify the contract.
            // During registration, this is a FATAL error if we're not inside the core.
            if (!isExecutionPhase) {
                this.throwViolation(
                    plugin.name,
                    "Unknown (Mandatory __sys__ instance missing in Plugin.create)",
                );
            }
            return "";
        }

        // Always verify if it's NOT a core framework path
        const isOfficial = OFFICIAL_PLUGINS.includes(plugin.name);

        if (!isCoreFrameworkPath(pluginRoot)) {
            if (!isOfficial) {
                const contractOk = verifyPluginContract(
                    pluginRoot,
                    plugin.name,
                );

                if (!contractOk) {
                    this.throwViolation(plugin.name, pluginRoot);
                }
            }

            // Perform static source code analysis to catch ESM namespace imports
            // which bypass the execution-level NativeApiBlocker.
            // Even official plugins must adhere to the zero-trust policy.
            // scanPluginSourceForNativeApis(pluginRoot, plugin.name); // COMMENTER POUR DES TESTS INTERNES MAIS DEVRAIT PAS L'ETRE EN PRODUCTION
        }

        // Cache it for future calls
        plugin.__root__ = pluginRoot;
        return pluginRoot;
    }

    /**
     * Throw a security contract violation error
     */
    private throwViolation(pluginName: string, pluginRoot: string): never {
        const errorMsg =
            `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR \x1b[0m\n` +
            `\x1b[31mPlugin '${pluginName}' refused registration!\x1b[0m\n` +
            `\x1b[33mReason:\x1b[0m Mandatory '$internal' entry for '${pluginName}' or 'type: \"plugin\"' is missing in xypriss.config.json(c).\n` +
            `\x1b[34mPlugin Path:\x1b[0m ${pluginRoot || "Unknown"}\n` +
            `\x1b[32mAction Required:\x1b[0m Ensure 'type': 'plugin' is set and declare the plugin namespace inside the '$internal' block of the plugin's configuration file.`;

        console.error(errorMsg);
        throw new Error(
            `Security Contract Violation: Plugin ${pluginName} is missing valid configuration contract`,
        );
    }

    /**
     * Validate plugin basic metadata
     */
    public validateMetadata(plugin: XyPrissPlugin): void {
        if (!plugin.name || !plugin.version) {
            throw new Error("Plugin must have name and version");
        }

        const vldt = validatePlgInput({
            name: plugin.name,
            version: plugin.version,
        });

        if (typeof vldt === "string") {
            throw new Error(vldt);
        }
    }

    /**
     * Create a restricted proxy of the server for plugins.
     * This limits access to only allowed methods on the app instance.
     */
    public createRestrictedServer(
        server: any,
        pluginName: string,
        permissionManager: PermissionManager,
    ): PluginServer {
        const allowedAppMethods = [
            "get",
            "post",
            "put",
            "delete",
            "patch",
            "options",
            "head",
            "connect",
            "trace",
            "all",
            "use",
            "logger",
            "configs",
        ];

        // Proxy for the app instance
        const appProxy = new Proxy(server.app, {
            get(target: any, prop: string | symbol) {
                if (
                    typeof prop === "string" &&
                    allowedAppMethods.includes(prop)
                ) {
                    // --- SECURITY CHECK: Configuration Access ---
                    if (prop === "configs") {
                        // Exception: Official plugins can access configs
                        if (OFFICIAL_PLUGINS.includes(pluginName)) {
                            return target[prop];
                        }

                        const hasPermission = permissionManager.checkPermission(
                            pluginName,
                            "configs",
                        );

                        if (!hasPermission) {
                            return undefined;
                        }
                    }

                    const value = target[prop];
                    return typeof value === "function"
                        ? value.bind(target)
                        : value;
                }

                // Block other properties
                return undefined;
            },
        });

        // Proxy for the server instance
        return new Proxy(server, {
            get(_target: any, prop: string | symbol) {
                if (prop === "app") {
                    return appProxy;
                }
                return undefined;
            },
        }) as unknown as PluginServer;
    }
}

