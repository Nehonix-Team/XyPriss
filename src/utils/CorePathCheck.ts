import { fileURLToPath } from "node:url";

/**
 * Frozen JavaScript Intrinsics (Primordials)
 *
 * Secures string handling and path normalization against prototype pollution attacks
 * targeting String.prototype.includes, String.prototype.replace, String.prototype.startsWith, etc.
 *
 * @internal
 * @see XSA-XESS-015
 */
export const _StringIncludes = Function.prototype.call.bind(
    String.prototype.includes,
) as (str: string, search: string) => boolean;

export const _StringReplace = Function.prototype.call.bind(
    String.prototype.replace,
) as (str: string, pattern: RegExp | string, replacement: string) => string;

export const _StringStartsWith = Function.prototype.call.bind(
    String.prototype.startsWith,
) as (str: string, search: string) => boolean;

export const _StringSlice = Function.prototype.call.bind(
    String.prototype.slice,
) as (str: string, start: number, end?: number) => string;

export const _StringSubstring = Function.prototype.call.bind(
    String.prototype.substring,
) as (str: string, start: number, end?: number) => string;

export const _StringIndexOf = Function.prototype.call.bind(
    String.prototype.indexOf,
) as (str: string, search: string, fromIndex?: number) => number;

export const _StringLastIndexOf = Function.prototype.call.bind(
    String.prototype.lastIndexOf,
) as (str: string, search: string, fromIndex?: number) => number;

/**
 * Resolved canonical installation directory for the XyPriss engine core.
 * Anchoring this path at module load time eliminates heuristic substring bypasses.
 *
 * @internal
 * @see XSA-XESS-018
 */
export let ENGINE_CORE_DIR = "";
try {
    let thisFile = "";
    if (typeof import.meta !== "undefined" && import.meta.url) {
        thisFile = _StringReplace(fileURLToPath(import.meta.url), /\\/g, "/");
    } else if (typeof __filename !== "undefined") {
        thisFile = _StringReplace(__filename, /\\/g, "/");
    }
    if (thisFile) {
        const srcIdx = _StringLastIndexOf(thisFile, "/src/");
        if (srcIdx !== -1) {
            ENGINE_CORE_DIR = _StringSlice(thisFile, 0, srcIdx + 1); // root directory with trailing '/'
        } else {
            const distIdx = _StringLastIndexOf(thisFile, "/dist/");
            if (distIdx !== -1) {
                ENGINE_CORE_DIR = _StringSlice(thisFile, 0, distIdx + 1); // root directory with trailing '/'
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
 * @see XSA-XESS-015 - Immune to prototype pollution on String.prototype
 * @see XSA-XESS-018 - Heuristic path evaluation hardening anchored on ENGINE_CORE_DIR
 */
export function isEngineCorePath(filePath: string): boolean {
    if (!filePath) return false;
    const normalizedPath = _StringReplace(filePath, /\\/g, "/");

    if (ENGINE_CORE_DIR && _StringStartsWith(normalizedPath, ENGINE_CORE_DIR)) {
        return true;
    }

    if (
        _StringIncludes(normalizedPath, "/XyPriss/src/") ||
        _StringIncludes(normalizedPath, "/XyPriss/dist/") ||
        _StringIncludes(normalizedPath, "/node_modules/xypriss/")
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
 * @see XSA-XESS-015
 * @see XSA-XESS-018
 */
export function isCoreFrameworkPath(filePath: string): boolean {
    if (!filePath) return false;

    const normalizedPath = _StringReplace(filePath, /\\/g, "/");

    // Authorize trusted internal mods within the framework repository
    if (_StringIncludes(normalizedPath, "/XyPriss/mods/")) return true;

    // Exclude other plugins even if they contain 'src' or are named 'xypriss-something'
    if (_StringIncludes(normalizedPath, "/mods/")) return false;

    // Engine Core is always trusted
    return isEngineCorePath(filePath);
}
