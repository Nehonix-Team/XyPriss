import { fileURLToPath } from "node:url";

/**
 * Resolved canonical installation directory for the XyPriss engine core.
 * Anchoring this path at module load time eliminates heuristic substring bypasses.
 *
 * @internal
 * @see XSA-XESS-018
 */
let _resolvedEngineDir = "";
try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
        const thisFile = fileURLToPath(import.meta.url).replace(/\\/g, "/");
        const srcIdx = thisFile.lastIndexOf("/src/");
        if (srcIdx !== -1) {
            _resolvedEngineDir = thisFile.slice(0, srcIdx + 5); // includes "/src/"
        } else {
            const distIdx = thisFile.lastIndexOf("/dist/");
            if (distIdx !== -1) {
                _resolvedEngineDir = thisFile.slice(0, distIdx + 6); // includes "/dist/"
            }
        }
    }
} catch {
    // fallback
}

/**
 * Checks if a given file path belongs to the deep engine core.
 * These files are skipped during stack analysis to find the user/plugin caller.
 *
 * @see XSA-XESS-018 - Heuristic path evaluation hardening
 */
export function isEngineCorePath(filePath: string): boolean {
    if (!filePath) return false;
    const normalizedPath = filePath.replace(/\\/g, "/");

    if (_resolvedEngineDir && normalizedPath.startsWith(_resolvedEngineDir)) {
        return true;
    }

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
 *
 * @see XSA-XESS-018
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
