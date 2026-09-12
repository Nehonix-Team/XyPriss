/**
 * Lazy accessor for `localSysApi`.
 *
 * Deferred to call-time to break the circular initialization chain:
 * `xhsc.ts` -> `PathApi` -> `XyprissTempDir` -> `xhsc` (localSysApi)
 */
export function getSysApi() {
    if (typeof globalThis !== "undefined" && (globalThis as any).__sys__) {
        return (globalThis as any).__sys__;
    }
    try {
        return (require("../../xhsc") as typeof import("../../xhsc"))?.localSysApi;
    } catch {
        return (globalThis as any)?.__sys__;
    }
}
