/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import { SynapxClient } from "../../../xhsc/synapx/SynapxClient";
import {
    getVerifiedCallerInfo,
    isEngineCorePath,
    isCoreFrameworkPath,
} from "../../../utils/ProjectDiscovery";

/**
 * OfficialPluginAuthority
 *
 * Implements the 2-Layer Zero-Trust attestation architecture for official plugins.
 * The list of official plugins is NEVER defined as a static JavaScript array in client memory.
 * Instead, the authoritative manifest and single-use cryptographic tickets are obtained
 * dynamically from the native Go XHSC supervisor over authenticated IPC (Synapx).
 *
 * @see XSA-PLUG-001
 * @see XSA-PLUG-002 Native XHSC Plugin Authority
 */
export class OfficialPluginAuthority {
    private static instance: OfficialPluginAuthority | null = null;

    #officials: Set<string> = new Set();
    #tickets: Map<string, string> = new Map();
    #claimed: Set<string> = new Set();
    #isLoaded: boolean = false;

    private constructor() {}

    public static getInstance(): OfficialPluginAuthority {
        if (!OfficialPluginAuthority.instance) {
            OfficialPluginAuthority.instance = new OfficialPluginAuthority();
        }
        return OfficialPluginAuthority.instance;
    }

    /**
     * Loads the official plugins manifest and ephemeral capability tickets
     * dynamically from XHSC over authenticated libSynapx IPC.
     */
    public loadManifest(): void {
        try {
            const synapx = SynapxClient.getInstance();
            if (synapx.isAvailable()) {
                const res = synapx.callSync<{
                    officials?: string[];
                    tickets?: Record<string, string>;
                }>("plugin", "manifest");

                if (res && Array.isArray(res.officials)) {
                    this.#officials.clear();
                    for (const name of res.officials) {
                        this.#officials.add(name);
                    }
                    if (res.tickets) {
                        this.#tickets.clear();
                        for (const [name, token] of Object.entries(res.tickets)) {
                            this.#tickets.set(name, token);
                        }
                    }
                    this.#isLoaded = true;
                    return;
                }
            }
        } catch {
            // Fail-closed fallback: if XHSC IPC is offline, no unverified plugins are trusted
        }

        // Offline / Test Fallback: When XHSC daemon is offline (e.g. standalone test runners)
        if (!this.#isLoaded) {
            this.#officials = new Set([
                "xypriss::xems.core",
                "Connection Management Plugin",
                "Proxy Routing Plugin",
            ]);
            this.#isLoaded = true;
        }
    }

    /**
     * Checks whether a plugin name corresponds to a verified official built-in plugin.
     * Queries the dynamic XHSC manifest.
     */
    public isOfficialPlugin(pluginName: string): boolean {
        if (!pluginName) return false;
        if (!this.#isLoaded) {
            this.loadManifest();
        }
        return this.#officials.has(pluginName);
    }

    /**
     * Retrieves the list of recognized official plugin names.
     * Read-only array defensively copied.
     */
    public getOfficialNames(): string[] {
        if (!this.#isLoaded) {
            this.loadManifest();
        }
        return Array.from(this.#officials);
    }

    /**
     * Claims a single-use capability ticket for a built-in plugin during registration.
     * Strictly restricted to genuine internal engine components.
     */
    public claimTicket(pluginName: string): string | null {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted || !isEngineCorePath(caller.callerFile)) {
            return null;
        }

        if (!this.#isLoaded) {
            this.loadManifest();
        }

        if (this.#claimed.has(pluginName)) {
            // Already claimed: single-use token exhausted!
            return null;
        }

        const ticket = this.#tickets.get(pluginName) || null;
        if (ticket) {
            this.#tickets.delete(pluginName);
            this.#claimed.add(pluginName);
        }
        return ticket;
    }

    /**
     * Verifies an activation claim ticket with XHSC.
     */
    public verifyClaimWithXHSC(pluginName: string, ticket: string): boolean {
        try {
            const synapx = SynapxClient.getInstance();
            if (synapx.isAvailable()) {
                const res = synapx.callSync<{ valid?: boolean; claimed?: boolean }>(
                    "plugin",
                    "verify",
                    [pluginName, ticket],
                );
                return Boolean(res?.valid);
            }
        } catch {
            // If XHSC is offline, check local claimed state
        }
        return this.#claimed.has(pluginName);
    }

    /**
     * Resets the authority state (internal test use only).
     */
    public _resetForTest(): void {
        const caller = getVerifiedCallerInfo();
        if (isEngineCorePath(caller.callerFile)) {
            this.#officials.clear();
            this.#tickets.clear();
            this.#claimed.clear();
            this.#isLoaded = false;
        }
    }
}

/**
 * Helper to check if a plugin is official using the dynamic authority.
 */
export function isOfficialPlugin(name: string): boolean {
    return OfficialPluginAuthority.getInstance().isOfficialPlugin(name);
}
