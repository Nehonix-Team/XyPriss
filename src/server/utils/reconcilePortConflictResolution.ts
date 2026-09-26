/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

export interface PortConflictResolvable {
    autoKillConflict?: boolean;
    autoPortSwitch?: {
        enabled?: boolean;
        maxAttempts?: number;
        startPort?: number;
        portRange?: [number, number];
        strategy?: "increment" | "random" | "predefined";
        predefinedPorts?: number[];
        onPortSwitch?: (originalPort: number, newPort: number) => void;
    };
    [key: string]: any;
}

/**
 * Reconciles the mutual exclusivity between autoKillConflict and autoPortSwitch.
 *
 * Rules:
 * 1. When autoKillConflict is active (enabled: true), autoPortSwitch is deactivated (enabled: false).
 * 2. When autoPortSwitch is active (enabled: true), autoKillConflict is deactivated (false).
 * 3. In multi-server mode, configurations defined outside `multiServer` act as the global base.
 *    Any server defined inside `multiServer.servers` can override them.
 * 4. In single-server mode, the same mutual exclusivity applies: activate one and deactivate the other.
 *
 * @param targetServerConf - The server config block to reconcile in-place
 * @param overridesServerConf - Optional override config block (e.g. from individual child server)
 */
export function reconcilePortConflictResolution(
    targetServerConf?: PortConflictResolvable,
    overridesServerConf?: PortConflictResolvable,
): PortConflictResolvable {
    if (!targetServerConf) {
        return targetServerConf as any;
    }

    // Determine if overrides explicitly specify either option
    const hasOverridePortSwitch =
        overridesServerConf?.autoPortSwitch?.enabled !== undefined;
    const hasOverrideKillConflict =
        overridesServerConf?.autoKillConflict !== undefined;

    let portSwitchEnabled = false;
    let autoKillEnabled = false;

    if (hasOverridePortSwitch || hasOverrideKillConflict) {
        // Child override takes precedence over global
        if (overridesServerConf?.autoPortSwitch?.enabled === true) {
            portSwitchEnabled = true;
            autoKillEnabled = false;
        } else if (overridesServerConf?.autoKillConflict === true) {
            autoKillEnabled = true;
            portSwitchEnabled = false;
        } else if (overridesServerConf?.autoKillConflict === false) {
            autoKillEnabled = false;
            portSwitchEnabled = Boolean(
                overridesServerConf?.autoPortSwitch?.enabled ??
                    targetServerConf.autoPortSwitch?.enabled,
            );
        } else if (overridesServerConf?.autoPortSwitch?.enabled === false) {
            portSwitchEnabled = false;
            autoKillEnabled = targetServerConf.autoKillConflict !== false;
        }
    } else {
        // Evaluate target / global server configuration
        if (targetServerConf.autoPortSwitch?.enabled === true) {
            portSwitchEnabled = true;
            autoKillEnabled = false;
        } else if (targetServerConf.autoKillConflict !== false) {
            autoKillEnabled = true;
            portSwitchEnabled = false;
        } else {
            autoKillEnabled = false;
            portSwitchEnabled = false;
        }
    }

    targetServerConf.autoKillConflict = autoKillEnabled;
    if (targetServerConf.autoPortSwitch) {
        targetServerConf.autoPortSwitch.enabled = portSwitchEnabled;
    } else {
        targetServerConf.autoPortSwitch = { enabled: portSwitchEnabled };
    }

    return targetServerConf;
}
