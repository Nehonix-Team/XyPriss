/**
 * Lazy accessor for `localSysApi`.
 *
 * Deferred to call-time to break the circular initialization chain:
 * `xhsc.ts` -> `PathApi` -> `XyprissTempDir` -> `xhsc` (localSysApi)
 */
export function getSysApi() {
    return (require("../../xhsc") as typeof import("../../xhsc")).localSysApi;
}
