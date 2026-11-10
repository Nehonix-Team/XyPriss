/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import fs from "fs";
import path from "path";
import util from "node:util";
import { fileURLToPath } from "node:url";
import { ConfigSyntaxParser } from "./ConfigSyntaxParser";
import { XY_ENV_INTERNAL_GET_FOR_ROOT } from "../xhsc/api/env/env";
import {
    isEngineCorePath,
    isCoreFrameworkPath,
    ENGINE_CORE_DIR,
    _StringIncludes,
    _StringReplace,
    _StringStartsWith,
    _StringSlice,
    _StringSubstring,
    _StringIndexOf,
    _StringLastIndexOf,
} from "./CorePathCheck";

export {
    isEngineCorePath,
    isCoreFrameworkPath,
    ENGINE_CORE_DIR,
    _StringIncludes,
    _StringReplace,
    _StringStartsWith,
    _StringSlice,
    _StringSubstring,
    _StringIndexOf,
    _StringLastIndexOf,
};

/**
 * Frozen JavaScript Intrinsics (Primordials)
 *
 * Secures stack trace capture and analysis against prototype pollution attacks
 * targeting Array.prototype[Symbol.iterator], String.prototype, CallSite.prototype, etc.
 *
 * @internal
 * @see XSA-XESS-015
 */
export const _ArrayIsArray = Array.isArray;
export const _ObjectEntries = Object.entries;

// Freeze CallSite accessors at early bootstrap to prevent prototype poisoning
let _CallSiteGetFileName: ((site: any) => string | null | undefined) | null =
    null;
let _CallSiteGetFunctionName:
    | ((site: any) => string | null | undefined)
    | null = null;
let _CallSiteIsEval: ((site: any) => boolean) | null = null;

try {
    const origPrepare = Error.prepareStackTrace;
    Error.prepareStackTrace = (_err, sites) => {
        if (_ArrayIsArray(sites) && sites.length > 0) {
            const proto = Object.getPrototypeOf(sites[0]);
            if (proto) {
                if (typeof proto.getFileName === "function") {
                    _CallSiteGetFileName = Function.prototype.call.bind(
                        proto.getFileName,
                    );
                }
                if (typeof proto.getFunctionName === "function") {
                    _CallSiteGetFunctionName = Function.prototype.call.bind(
                        proto.getFunctionName,
                    );
                }
                if (typeof proto.isEval === "function") {
                    _CallSiteIsEval = Function.prototype.call.bind(
                        proto.isEval,
                    );
                }
                try {
                    Object.freeze(proto);
                } catch {}
            }
        }
        return "";
    };
    const e = new Error();
    void e.stack;
    Error.prepareStackTrace = origPrepare;
} catch {
    // ignore
}

// Capture native V8 C++ CallSite bindings at module bootstrap before any third-party code executes.
// `util.getCallSites` invokes v8::StackTrace::CurrentStackTrace directly in C++, completely
// bypassing `Error.prepareStackTrace` overrides, CallSite prototype manipulation, and ignoring `//# sourceURL` directives.
const _nativeGetCallSites:
    | ((frameCount?: number) => Array<{
          functionName: string;
          scriptName: string;
          lineNumber: number;
          column: number;
      }>)
    | null =
    typeof (util as any).getCallSites === "function"
        ? (util as any).getCallSites.bind(util)
        : null;

export interface PluginMeta {
    name: string;
    version?: string;
    root: string;
    authorKey?: string;
    isTrusted?: boolean;
}

export interface PluginsManifest {
    projectRoot: string;
    plugins: Record<string, PluginMeta>;
    roots: Record<string, string>; // Canonical root path -> plugin name
}

let cachedManifest: PluginsManifest | null = null;

/**
 * Loads the authoritative plugins manifest provided by xfpm.
 */
export function getPluginsManifest(): PluginsManifest | null {
    if (cachedManifest) return cachedManifest;

    const manifestPath =
        process.env.XYPRISS_PLUGINS_MANIFEST ||
        (process.env.XYPRISS_PROJECT_ROOT
            ? path.join(
                  process.env.XYPRISS_PROJECT_ROOT,
                  "node_modules",
                  ".xfpm",
                  "plugins_manifest.json",
              )
            : null);

    if (manifestPath && fs.existsSync(manifestPath)) {
        try {
            const raw = fs.readFileSync(manifestPath, "utf-8");
            cachedManifest = JSON.parse(raw);
            return cachedManifest;
        } catch {
            // ignore
        }
    }
    return null;
}

/**
 * Returns the primary project root determined by xfpm CLI.
 */
export function getPrimaryProjectRoot(): string {
    return process.env.XYPRISS_PROJECT_ROOT || process.cwd();
}

/**
 * Checks if a directory is a valid project root.
 */
export function isProjectRoot(dir: string): boolean {
    if (!dir) return false;
    try {
        const resolved = path.resolve(dir);
        const primaryRoot = process.env.XYPRISS_PROJECT_ROOT;
        if (primaryRoot && resolved === path.resolve(primaryRoot)) {
            return true;
        }
        const manifest = getPluginsManifest();
        if (manifest?.roots && manifest.roots[resolved]) {
            return true;
        }
        const pkgPath = path.join(resolved, "package.json");
        return fs.existsSync(pkgPath);
    } catch {
        return false;
    }
}

/**
 * Identifies the project or plugin root for a given caller path using xfpm metadata.
 *
 * @see XSA-XESS-015 - Immune to prototype pollution on String.prototype
 * @see XSA-XESS-018 - Anchored path verification
 */
export function identifyProjectRoot(filePath: string): string | undefined {
    if (!filePath) return undefined;
    if (!path.isAbsolute(filePath)) {
        try {
            filePath = path.resolve(filePath);
        } catch {
            return undefined;
        }
    }

    const normalized = _StringReplace(filePath, /\\/g, "/");
    const primaryRoot = _StringReplace(
        process.env.XYPRISS_PROJECT_ROOT || process.cwd(),
        /\\/g,
        "/",
    );

    // 1. Direct O(1) match against verified plugins registered by xfpm
    const manifest = getPluginsManifest();
    if (manifest?.roots) {
        const rootEntries = _ObjectEntries(manifest.roots);
        for (let i = 0; i < rootEntries.length; i++) {
            const [pluginRoot] = rootEntries[i];
            const normPluginRoot = _StringReplace(pluginRoot, /\\/g, "/");
            if (
                normalized === normPluginRoot ||
                _StringStartsWith(normalized, normPluginRoot + "/")
            ) {
                return pluginRoot;
            }
        }
    }

    // 2. Direct match against primary project root
    if (
        normalized === primaryRoot ||
        _StringStartsWith(normalized, primaryRoot + "/")
    ) {
        // If inside node_modules, it is an undeclared/untrusted dependency, NOT the application root!
        if (_StringIncludes(normalized, "/node_modules/")) {
            return undefined;
        }
        return primaryRoot;
    }

    // 3. Monorepo development mods (/mods/<name>/) fallback
    // @see XSA-XESS-018: Must be strictly anchored to the primary project root or framework monorepo
    const modsIdx = _StringLastIndexOf(normalized, "/mods/");
    if (
        modsIdx !== -1 &&
        (_StringStartsWith(normalized, primaryRoot + "/") ||
            isEngineCorePath(normalized))
    ) {
        const afterMods = _StringSubstring(normalized, modsIdx + 6);
        const nextSlash = _StringIndexOf(afterMods, "/");
        const modName =
            nextSlash === -1
                ? afterMods
                : _StringSubstring(afterMods, 0, nextSlash);
        if (modName) {
            return _StringSubstring(
                normalized,
                0,
                modsIdx + 6 + modName.length,
            );
        }
    }

    return undefined;
}

let rootInterceptor: ((callerRoot: string) => string | undefined) | null = null;
export function setRootInterceptor(
    interceptor: (callerRoot: string) => string | undefined,
) {
    rootInterceptor = interceptor;
}

export interface VerifiedCallerInfo {
    root: string | undefined;
    isUntrusted: boolean;
    callerFile: string;
}

function normalizeScriptName(rawScript: string): string {
    if (!rawScript) return "";
    if (_StringStartsWith(rawScript, "file://")) {
        try {
            return fileURLToPath(rawScript);
        } catch {
            return _StringSlice(rawScript, 7);
        }
    }
    return rawScript;
}

function isRuntimeLoaderPath(filePath: string): boolean {
    const norm = _StringReplace(filePath, /\\/g, "/");
    return (
        _StringIncludes(norm, "/node_modules/tsx/") ||
        _StringIncludes(norm, "/node_modules/ts-node/") ||
        _StringIncludes(norm, "/node_modules/.bin/")
    );
}

/**
 * Captures raw C++ V8/JSC CallSite frames.
 *
 * Security Architecture (Fail-Closed & Anti-Spoofing):
 * 1. Prioritizes `util.getCallSites(64)` when running on Node.js/V8, directly invoking
 *    the C++ v8::StackTrace without touching JavaScript prototype methods or `Error.prepareStackTrace`.
 * 2. Falls back to controlled `Error.prepareStackTrace` with frozen `CallSite.prototype` accessors
 *    and indexed array iteration, immune to `Array.prototype[Symbol.iterator]` prototype pollution.
 *
 * @internal
 * @see XSA-XESS-015
 */
export function captureNativeFrames(): Array<{
    filePath: string;
    fnName: string;
    isEval: boolean;
}> {
    const frames: Array<{ filePath: string; fnName: string; isEval: boolean }> =
        [];

    // Priority 1: Native C++ V8 CallSite frames (util.getCallSites)
    // Directly queries V8 engine in C++, immune to Error.prepareStackTrace overrides,
    // CallSite prototype manipulation, and ignoring `//# sourceURL` directives.
    if (_nativeGetCallSites) {
        try {
            const nativeSites = _nativeGetCallSites(64);
            const nativeLen = _ArrayIsArray(nativeSites)
                ? nativeSites.length
                : 0;
            if (nativeLen > 0) {
                for (let i = 0; i < nativeLen; i++) {
                    const s = nativeSites[i];
                    if (!s) continue;
                    const rawScript = s.scriptName || "";
                    const fnName = s.functionName || "";
                    frames[frames.length] = {
                        filePath: normalizeScriptName(rawScript),
                        fnName,
                        isEval:
                            !rawScript &&
                            (fnName === "eval" || fnName === "anonymous"),
                    };
                }
                return frames;
            }
        } catch {
            // fallback to Error.prepareStackTrace
        }
    }

    // Priority 2: Controlled Error.prepareStackTrace override (Node.js fallback / Bun JSC)
    const prevPrepare = Error.prepareStackTrace;
    const prevLimit = Error.stackTraceLimit;
    let rawSites: any[] = [];
    try {
        Error.stackTraceLimit = 64;
        Error.prepareStackTrace = (_err: Error, stack: any[]) => {
            rawSites = _ArrayIsArray(stack) ? stack : [];
            return "";
        };
        const probe = new Error();
        void probe.stack;
    } catch {
        // ignore
    } finally {
        Error.prepareStackTrace = prevPrepare;
        Error.stackTraceLimit = prevLimit;
    }

    // Use indexed iteration and frozen CallSite accessors to defeat prototype pollution
    for (let i = 0; i < rawSites.length; i++) {
        const site = rawSites[i];
        if (!site) continue;
        try {
            const rawFile = _CallSiteGetFileName
                ? _CallSiteGetFileName(site) || ""
                : typeof site.getFileName === "function"
                  ? site.getFileName() || ""
                  : "";
            const fnName = _CallSiteGetFunctionName
                ? _CallSiteGetFunctionName(site) || ""
                : typeof site.getFunctionName === "function"
                  ? site.getFunctionName() || ""
                  : "";
            const isEval = _CallSiteIsEval
                ? Boolean(_CallSiteIsEval(site))
                : typeof site.isEval === "function"
                  ? Boolean(site.isEval())
                  : false;

            frames[frames.length] = {
                filePath: normalizeScriptName(rawFile),
                fnName,
                isEval,
            };
        } catch {
            // ignore
        }
    }

    return frames;
}

/**
 * Verifies that an internal property accessor (such as `BaseApi.prototype.runner`)
 * or internal engine method is being invoked directly by an internal XyPriss core module
 * and not by userland or third-party `node_modules` code.
 *
 * @see XSA-XESS-015 - Immune to prototype pollution on String.prototype
 * @see XSA-XESS-018 - Excludes internal configuration proxies from bypassing caller checks
 */
export function isImmediateInternalEngineCall(): boolean {
    const frames = captureNativeFrames();

    for (let i = 0; i < frames.length; i++) {
        const { filePath, fnName, isEval } = frames[i];
        if (isEval) {
            return false;
        }
        if (!filePath) continue;
        if (_StringIncludes(filePath, "[eval]")) {
            return false;
        }
        if (
            _StringStartsWith(filePath, "node:") ||
            _StringStartsWith(filePath, "bun:") ||
            filePath === "native"
        ) {
            continue;
        }

        const norm = _StringReplace(filePath, /\\/g, "/");

        // Skip stack-tracing plumbing and entrypoint caller wrappers inside the engine
        if (isEngineCorePath(norm)) {
            if (
                fnName === "captureNativeFrames" ||
                fnName === "isImmediateInternalEngineCall" ||
                fnName === "get runner" ||
                fnName === "runner" ||
                fnName === "runSync" ||
                fnName === "runAsync" ||
                fnName === "runStream" ||
                fnName === "runWritableStream" ||
                fnName === "call" ||
                fnName === "callSync" ||
                fnName === "callSyncSubprocess" ||
                fnName === "executeEnvCall" ||
                fnName === "configureShield"
            ) {
                continue;
            }
        }

        // The very first frame outside the entrypoint plumbing is the direct caller
        return isEngineCorePath(norm);
    }

    return false;
}

/**
 * Extracts verified caller information by inspecting the ENTIRE active call stack.
 * Immune to `Error.prepareStackTrace` hijacking AND `//# sourceURL` spoofing:
 * even if an attacker injects a fake frame via `new Function("//# sourceURL=...")`,
 * the attacker's own `node_modules/...` frame remains on the call stack and is detected.
 *
 * @see XSA-XESS-015 - Immune to prototype pollution on String.prototype and CallSite.prototype
 */
export function getVerifiedCallerInfo(): VerifiedCallerInfo {
    const frames = captureNativeFrames();
    let immediateCallerRoot: string | undefined;
    let immediateCallerFile = "";

    for (let i = 0; i < frames.length; i++) {
        const { filePath, isEval } = frames[i];

        if (isEval) {
            return {
                root: undefined,
                isUntrusted: true,
                callerFile: filePath || "<eval>",
            };
        }

        if (!filePath) continue;
        if (_StringIncludes(filePath, "[eval]")) {
            return {
                root: undefined,
                isUntrusted: true,
                callerFile: filePath || "<eval>",
            };
        }
        if (
            _StringStartsWith(filePath, "node:") ||
            _StringStartsWith(filePath, "bun:") ||
            filePath === "native"
        ) {
            continue;
        }

        // Skip XyPriss internal engine frames
        if (isEngineCorePath(filePath)) {
            continue;
        }

        // Skip CLI TypeScript loaders (tsx / ts-node) at the bottom of the stack
        if (isRuntimeLoaderPath(filePath)) {
            continue;
        }

        const root = identifyProjectRoot(filePath);

        // If ANY frame in the call chain originates from an undeclared/untrusted node_modules package,
        // reject the entire operation immediately (defeats //# sourceURL wrapper functions).
        if (!root) {
            return {
                root: undefined,
                isUntrusted: true,
                callerFile: filePath,
            };
        }

        if (!immediateCallerRoot) {
            immediateCallerRoot = rootInterceptor
                ? rootInterceptor(root) || root
                : root;
            immediateCallerFile = filePath;
        }
    }

    if (immediateCallerRoot) {
        return {
            root: immediateCallerRoot,
            isUntrusted: false,
            callerFile: immediateCallerFile,
        };
    }

    /**
     * Fail-Closed Security Policy:
     * When the call stack cannot be unambiguously attributed to an authorized application caller
     * (e.g. empty stack, stack-scrubbing attempt, or only internal frames present without userland anchor),
     * access is strictly DENIED.
     *
     * @see XSA-XESS-015
     */
    return {
        root: undefined,
        isUntrusted: true,
        callerFile: "<unverified-stack>",
    };
}

/**
 * Retrieves the project root of the code currently executing by analyzing the native V8 call stack.
 */
export function getCallerProjectRoot(): string | undefined {
    const info = getVerifiedCallerInfo();
    if (info.isUntrusted) {
        return undefined;
    }
    return info.root;
}

/**
 * Loads and cleans a XyPriss configuration file (JSON or JSONC).
 * Removes comments and trailing commas to ensure compatibility with standard JSON.parse.
 */
export function loadXyConfig(projectRoot: string): any | null {
    for (const name of ["xypriss.config.jsonc", "xypriss.config.json"]) {
        const configPath = path.join(projectRoot, name);
        if (fs.existsSync(configPath)) {
            try {
                const raw = fs.readFileSync(configPath, "utf-8");
                const clean = raw
                    .replace(
                        /("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g,
                        (m, g) => (g ? g : ""),
                    )
                    .replace(/("(?:[^"\\]|\\.)*")|,\s*([}\]])/g, (m, g1, g2) =>
                        g1 ? g1 : g2,
                    );

                const rawJson = JSON.parse(clean);

                // Load package.json from the same directory for resolution
                let pkgJson = null;
                const pkgPath = path.join(projectRoot, "package.json");
                if (fs.existsSync(pkgPath)) {
                    try {
                        pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                    } catch {
                        /* ignore */
                    }
                }

                // Resolve references &(pkg), &(env), etc.
                const sys = (globalThis as any).__sys__;

                // Safely resolve &(env:...) variables scoped to the target project root
                // using the internal symbol (safe from third-party / plugin tampering).
                let envProvider = sys?.__env__;
                if (sys?.__env__?.[XY_ENV_INTERNAL_GET_FOR_ROOT]) {
                    envProvider = {
                        has: (key: string) =>
                            sys.__env__[XY_ENV_INTERNAL_GET_FOR_ROOT](
                                key,
                                projectRoot,
                            ) !== undefined,
                        get: (key: string) =>
                            sys.__env__[XY_ENV_INTERNAL_GET_FOR_ROOT](
                                key,
                                projectRoot,
                            ),
                    };
                }

                const parser = new ConfigSyntaxParser(pkgJson, envProvider);
                return parser.resolve(rawJson);
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Verifies if a given directory contains a valid XyPriss plugin contract.
 * Required: xypriss.config.json(c) with the plugin's namespace under '$internal'
 */
export function verifyPluginContract(
    pluginRoot: string,
    pluginName: string,
): boolean {
    const config = loadXyConfig(pluginRoot);
    if (!config) return false;

    const internal = config.$internal || config.internal;
    if (!internal) return false;

    const pluginContract = internal[pluginName];
    // The plugin must declare itself in the $internal block WITH 'type': 'plugin'
    return !!(pluginContract && pluginContract.type === "plugin");
}

/**
 * Retrieves the plugin configuration if it exists and is valid.
 */
export function getPluginConfig(pluginRoot: string): any | null {
    return loadXyConfig(pluginRoot);
}

