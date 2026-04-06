/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

/**
 * Plugin permission structure for fine-grained security control.
 */
export interface PluginPermission {
    /** Name of the plugin */
    name: string;
    /** List of allowed hooks (e.g. "onRegister", "onServerStart") or "*" for all */
    allowedHooks?: string[] | "*";
    /** List of explicitly denied hooks that override allowedHooks */
    deniedHooks?: string[];
    /** Policy for unlisted hooks: "allow" (default) or "deny" */
    policy?: "allow" | "deny";
}

/**
 * Internal storage for plugin permissions
 */
export type PluginPermissionsConfig = PluginPermission[];

