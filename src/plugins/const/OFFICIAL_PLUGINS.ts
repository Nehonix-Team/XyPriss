import { OfficialPluginAuthority, isOfficialPlugin } from "../core/manager/OfficialPluginAuthority";

export { isOfficialPlugin };

/**
 * Dynamic proxy object emulating array .includes() while obtaining
 * the official plugin manifest dynamically from XHSC over secure IPC.
 *
 * No static plugin names are hardcoded in JavaScript memory.
 *
 * @deprecated Prefer `isOfficialPlugin(name)` directly.
 * @see XSA-PLUG-002
 */
export const OFFICIAL_PLUGINS = {
    includes(name: string): boolean {
        return OfficialPluginAuthority.getInstance().isOfficialPlugin(name);
    },
    indexOf(name: string): number {
        return OfficialPluginAuthority.getInstance().isOfficialPlugin(name) ? 0 : -1;
    },
    get length(): number {
        return OfficialPluginAuthority.getInstance().getOfficialNames().length;
    },
    [Symbol.iterator]() {
        return OfficialPluginAuthority.getInstance().getOfficialNames()[Symbol.iterator]();
    },
};
