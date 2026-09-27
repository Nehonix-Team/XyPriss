/**
 * Checks if a given file path belongs to the deep engine core.
 * These files are skipped during stack analysis to find the user/plugin caller.
 */
export function isEngineCorePath(filePath: string): boolean {
    if (!filePath) return false;
    const normalizedPath = filePath.replace(/\\/g, "/");

    if (
        normalizedPath.includes("/XyPriss/src/") ||
        normalizedPath.includes("/XyPriss/dist/") ||
        normalizedPath.includes("/node_modules/xypriss/")
    ) {
        return true;
    }

    return false;
}

/**
 * Checks if a given file path belongs directly to the XyPriss Core Engine
 * or if it comes from an external plugin / user space.
 * This is used for SECURITY authorization.
 */
export function isCoreFrameworkPath(filePath: string): boolean {
    if (!filePath) return false;

    const normalizedPath = filePath.replace(/\\/g, "/");

    // Authorize trusted internal mods within the framework repository
    if (normalizedPath.includes("/XyPriss/mods/")) return true;

    // Exclude other plugins even if they contain 'src' or are named 'xypriss-something'
    if (normalizedPath.includes("/mods/")) return false;

    // Engine Core is always trusted
    return isEngineCorePath(filePath);
}
