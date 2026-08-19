/**
 * Helper utility to determine whether a feature configuration module is enabled.
 * Returns false if conf is false, null, undefined, or an object with `enabled: false`.
 * Returns true if conf is true or a truthy object where `enabled` is not false.
 */
export function isFeatureEnabled(conf: any): boolean {
    if (conf === false || conf === null || conf === undefined) return false;
    if (conf === true) return true;
    if (typeof conf === "object") {
        if (conf.enabled === false) return false;
        return true;
    }
    return false;
}
