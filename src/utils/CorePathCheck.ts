import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Frozen JavaScript Intrinsics (Primordials)
 *
 * Secures string handling, path normalization, JSON serialization, and collections
 * against prototype pollution and monkey-patching attacks.
 *
 * @internal
 * @see XSA-XESS-015
 * @see XSA-XESS-020
 * @see XSA-XESS-021
 * @see XSA-XESS-022
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

export const _StringEndsWith = Function.prototype.call.bind(
    String.prototype.endsWith,
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

export const _PathResolve = path.resolve.bind(path) as (...paths: string[]) => string;
export const _PathIsAbsolute = path.isAbsolute.bind(path) as (p: string) => boolean;

export const _JSONParse = JSON.parse;
export const _JSONStringify = JSON.stringify;

export const _Uint8ArrayFill = Function.prototype.call.bind(
    Uint8Array.prototype.fill,
) as (arr: Uint8Array, value: number, start?: number, end?: number) => Uint8Array;

export const _WeakMapGet = Function.prototype.call.bind(
    WeakMap.prototype.get,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;

export const _WeakMapSet = Function.prototype.call.bind(
    WeakMap.prototype.set,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, val: V) => WeakMap<K, V>;

export const _WeakMapHas = Function.prototype.call.bind(
    WeakMap.prototype.has,
) as <K extends object>(map: WeakMap<K, any>, key: K) => boolean;

export const _WeakMapDelete = Function.prototype.call.bind(
    WeakMap.prototype.delete,
) as <K extends object>(map: WeakMap<K, any>, key: K) => boolean;

/**
 * Resolved canonical installation directory for the XyPriss engine core.
 * Anchoring this path at module load time eliminates heuristic substring bypasses.
 *
 * @internal
 * @see XSA-XESS-018
 * @see XSA-XESS-026
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
 * @see XSA-XESS-026 - Rejects any node_modules subpath not strictly starting with ENGINE_CORE_DIR
 */
export function isEngineCorePath(filePath: string): boolean {
    if (!filePath) return false;
    const normalizedPath = _StringReplace(filePath, /\\/g, "/");

    // Any path inside node_modules that is NOT inside our resolved ENGINE_CORE_DIR
    // is an untrusted third-party package and CANNOT be the engine core.
    if (_StringIncludes(normalizedPath, "/node_modules/")) {
        if (ENGINE_CORE_DIR && _StringStartsWith(normalizedPath, ENGINE_CORE_DIR)) {
            return true;
        }
        return false;
    }

    if (ENGINE_CORE_DIR && _StringStartsWith(normalizedPath, ENGINE_CORE_DIR)) {
        return true;
    }

    if (
        _StringIncludes(normalizedPath, "/XyPriss/src/") ||
        _StringIncludes(normalizedPath, "/XyPriss/dist/")
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
 * @see XSA-XESS-026
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
