import { fileURLToPath } from "node:url";
import path from "node:path";
import { XStringify } from "xypriss-security";

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

export const _PathResolve = path.resolve.bind(path) as (
    ...paths: string[]
) => string;
export const _PathIsAbsolute = path.isAbsolute.bind(path) as (
    p: string,
) => boolean;
export const _PathPosixNormalize = path.posix.normalize.bind(path.posix) as (
    p: string,
) => string;

export const _JSONParse = JSON.parse;
export const _JSONStringify = JSON.stringify;
// Sérialiseur défensif anti-cycles (réservé aux logs / audits)
export const _SafeStringify = XStringify;

export const _Uint8ArrayFill = Function.prototype.call.bind(
    Uint8Array.prototype.fill,
) as (
    arr: Uint8Array,
    value: number,
    start?: number,
    end?: number,
) => Uint8Array;

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
 * Immutable const anchored at module load time to eliminate heuristic substring bypasses
 * and CJS/namespace mutation.
 *
 * @internal
 * @see XSA-XESS-018
 * @see XSA-XESS-026
 * @see XSA-CORE-002
 * @see XSA-CORE-006
 */
export const ENGINE_CORE_DIR: string = (() => {
    try {
        let thisFile = "";
        if (typeof import.meta !== "undefined" && import.meta.url) {
            thisFile = _StringReplace(
                fileURLToPath(import.meta.url),
                /\\/g,
                "/",
            );
        } else if (typeof __filename !== "undefined") {
            thisFile = _StringReplace(__filename, /\\/g, "/");
        }
        if (thisFile) {
            thisFile = _PathPosixNormalize(thisFile);
            const srcIdx = _StringLastIndexOf(thisFile, "/src/");
            if (srcIdx !== -1) {
                return _StringSlice(thisFile, 0, srcIdx + 1); // root directory with trailing '/'
            }
            const distIdx = _StringLastIndexOf(thisFile, "/dist/");
            if (distIdx !== -1) {
                return _StringSlice(thisFile, 0, distIdx + 1); // root directory with trailing '/'
            }
        }
    } catch {
        // fail-closed: empty string disables core-path matching
    }
    return "";
})();

const ENGINE_SRC_DIR = ENGINE_CORE_DIR ? ENGINE_CORE_DIR + "src/" : "";
const ENGINE_DIST_DIR = ENGINE_CORE_DIR ? ENGINE_CORE_DIR + "dist/" : "";

/**
 * Canonicalizes a raw file path by converting Windows separators and resolving
 * any relative traversal segments (`..`, `.`, `//`).
 *
 * @see XSA-CORE-003
 */
function canonicalizePath(filePath: string): string {
    const slashed = _StringReplace(filePath, /\\/g, "/");
    return _PathPosixNormalize(slashed);
}

/**
 * Checks if a given file path belongs strictly to the XyPriss engine core
 * (`${ENGINE_CORE_DIR}src/` or `${ENGINE_CORE_DIR}dist/`).
 * These files are skipped during stack analysis to locate the user/plugin caller.
 *
 * @see XSA-XESS-015 - Immune to prototype pollution on String.prototype
 * @see XSA-XESS-018 - Heuristic path evaluation hardening anchored on ENGINE_CORE_DIR
 * @see XSA-XESS-026 - Rejects any node_modules subpath not strictly inside engine core
 * @see XSA-CORE-001 - Eliminates substring spoofing (`/XyPriss/src/`, `/XyPriss/dist/`)
 * @see XSA-CORE-002 - Restricts trust strictly to `src/` and `dist/` (excludes sibling `mods/` & nested `node_modules/`)
 * @see XSA-CORE-003 - Canonicalizes `..` path traversal before prefix checks
 */
export function isEngineCorePath(filePath: string): boolean {
    if (!filePath || !ENGINE_CORE_DIR) return false;
    if (filePath === "<engine-core>") return true;
    const canonical = canonicalizePath(filePath);

    // Canonical match for ENGINE_CORE_DIR itself (with or without trailing slash)
    const normCore = canonicalizePath(ENGINE_CORE_DIR);
    if (canonical === normCore) {
        return true;
    }

    // Must reside strictly inside the engine's own `src/` or `dist/` directory
    const inSrc =
        ENGINE_SRC_DIR !== "" && _StringStartsWith(canonical, ENGINE_SRC_DIR);
    const inDist =
        ENGINE_DIST_DIR !== "" && _StringStartsWith(canonical, ENGINE_DIST_DIR);
    if (!inSrc && !inDist) {
        return false;
    }

    // Reject any nested node_modules inside the engine directory (e.g. transitive dependencies)
    const rel = _StringSlice(canonical, ENGINE_CORE_DIR.length);
    if (_StringIncludes(rel, "node_modules/")) {
        return false;
    }

    return true;
}

/**
 * Checks if a given file path belongs directly to the XyPriss Core Engine
 * or if it comes from an external plugin / user space.
 * This is used for SECURITY authorization.
 *
 * @see XSA-XESS-015
 * @see XSA-XESS-018
 * @see XSA-XESS-026
 * @see XSA-CORE-001 - Eliminates `/XyPriss/mods/` substring bypass
 * @see XSA-CORE-002 - Plugins in `mods/` are sandboxed under their own root, never treated as core framework
 * @see XSA-CORE-003 - Canonicalizes `..` path traversal before verification
 */
export function isCoreFrameworkPath(filePath: string): boolean {
    if (!filePath) return false;
    return isEngineCorePath(filePath);
}

