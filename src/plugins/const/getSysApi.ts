import type { localSysApi } from "../../xhsc";

/**
 * Lazy accessor for `localSysApi`.
 *
 * Deferred to call-time to break the circular initialization chain:
 * `xhsc.ts` -> `PathApi` -> `XyprissTempDir` -> `xhsc` (localSysApi)
 *
 * Issue #43: Primary recommended entrypoint to safely access `__sys__` and `__sys__.__env__`
 * without bypassing XyPriss zero-trust encapsulation or mutating `process.env` directly.
 */
type T = typeof localSysApi;
export function getSysApi(): T | undefined {
    if (typeof globalThis !== "undefined" && (globalThis as any).__sys__) {
        return (globalThis as any).__sys__;
    }
    try {
        return (require("../../xhsc") as typeof import("../../xhsc"))
            ?.localSysApi;
    } catch {
        return (globalThis as any)?.__sys__ as T;
    }
}

