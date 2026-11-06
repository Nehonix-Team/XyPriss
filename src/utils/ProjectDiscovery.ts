import fs from "fs";
import path from "path";
import util from "node:util";
import { fileURLToPath } from "node:url";
import { ConfigSyntaxParser } from "./ConfigSyntaxParser";
import { XY_ENV_INTERNAL_GET_FOR_ROOT } from "../xhsc/api/env/env";
import { isEngineCorePath, isCoreFrameworkPath } from "./CorePathCheck";

export { isEngineCorePath, isCoreFrameworkPath };

// Capture native V8 C++ CallSite bindings at module bootstrap before any third-party code executes.
// `util.getCallSites` invokes v8::StackTrace::CurrentStackTrace directly in C++, completely
// bypassing `Error.prepareStackTrace` overrides and ignoring `//# sourceURL` directives.
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

    const normalized = filePath.replace(/\\/g, "/");
    const primaryRoot = (
        process.env.XYPRISS_PROJECT_ROOT || process.cwd()
    ).replace(/\\/g, "/");

    // 1. Direct O(1) match against verified plugins registered by xfpm
    const manifest = getPluginsManifest();
    if (manifest?.roots) {
        for (const [pluginRoot, _pluginName] of Object.entries(
            manifest.roots,
        )) {
            const normPluginRoot = pluginRoot.replace(/\\/g, "/");
            if (
                normalized === normPluginRoot ||
                normalized.startsWith(normPluginRoot + "/")
            ) {
                return pluginRoot;
            }
        }
    }

    // 2. Direct match against primary project root
    if (
        normalized === primaryRoot ||
        normalized.startsWith(primaryRoot + "/")
    ) {
        // If inside node_modules, it is an undeclared/untrusted dependency, NOT the application root!
        if (normalized.includes("/node_modules/")) {
            return undefined;
        }
        return primaryRoot;
    }

    // 3. Monorepo development mods (/mods/<name>/) fallback
    const modsIdx = normalized.lastIndexOf("/mods/");
    if (modsIdx !== -1) {
        const afterMods = normalized.substring(modsIdx + 6);
        const nextSlash = afterMods.indexOf("/");
        const modName =
            nextSlash === -1 ? afterMods : afterMods.substring(0, nextSlash);
        if (modName) {
            return normalized.substring(0, modsIdx + 6 + modName.length);
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
    if (rawScript.startsWith("file://")) {
        try {
            return fileURLToPath(rawScript);
        } catch {
            return rawScript.slice(7);
        }
    }
    return rawScript;
}

function isRuntimeLoaderPath(filePath: string): boolean {
    const norm = filePath.replace(/\\/g, "/");
    return (
        norm.includes("/node_modules/tsx/") ||
        norm.includes("/node_modules/ts-node/") ||
        norm.includes("/node_modules/.bin/")
    );
}

/**
 * Captures raw C++ V8/JSC CallSite frames by temporarily overriding `Error.prepareStackTrace`
 * synchronously during stack generation. This neutralizes any user/attacker `Error.prepareStackTrace`
 * hijack and returns the full un-truncated call stack across both Node.js (V8) and Bun (JSC).
 */
function captureNativeFrames(): Array<{
    filePath: string;
    fnName: string;
    isEval: boolean;
}> {
    const frames: Array<{ filePath: string; fnName: string; isEval: boolean }> =
        [];

    // 1. Capture full CallSite array via controlled prepareStackTrace override (immune to prior Error.prepareStackTrace hijacks)
    const prevPrepare = Error.prepareStackTrace;
    const prevLimit = Error.stackTraceLimit;
    let rawSites: any[] = [];
    try {
        Error.stackTraceLimit = 64;
        Error.prepareStackTrace = (_err: Error, stack: any[]) => {
            rawSites = Array.isArray(stack) ? stack : [];
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

    for (const site of rawSites) {
        if (!site) continue;
        try {
            const rawFile =
                typeof site.getFileName === "function"
                    ? site.getFileName() || ""
                    : "";
            const fnName =
                typeof site.getFunctionName === "function"
                    ? site.getFunctionName() || ""
                    : "";
            const isEval =
                typeof site.isEval === "function"
                    ? Boolean(site.isEval())
                    : false;
            frames.push({
                filePath: normalizeScriptName(rawFile),
                fnName,
                isEval,
            });
        } catch {
            // ignore
        }
    }

    // 2. Also merge frames from Node C++ util.getCallSites (which strips //# sourceURL on V8)
    if (_nativeGetCallSites) {
        try {
            const nativeSites = _nativeGetCallSites(64);
            for (const s of nativeSites) {
                if (!s) continue;
                const rawScript = s.scriptName || "";
                const fnName = s.functionName || "";
                frames.push({
                    filePath: normalizeScriptName(rawScript),
                    fnName,
                    isEval:
                        !rawScript &&
                        (fnName === "eval" || fnName === "anonymous"),
                });
            }
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
 */
export function isImmediateInternalEngineCall(): boolean {
    const frames = captureNativeFrames();

    for (let i = 0; i < frames.length; i++) {
        const { filePath, fnName, isEval } = frames[i];
        if (isEval) {
            return false;
        }
        if (!filePath) continue;
        if (
            filePath.startsWith("node:") ||
            filePath.startsWith("bun:") ||
            filePath === "native" ||
            filePath.includes("[eval]")
        ) {
            continue;
        }

        const norm = filePath.replace(/\\/g, "/");

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
                fnName === "executeEnvCall"
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
        if (
            filePath.startsWith("node:") ||
            filePath.startsWith("bun:") ||
            filePath === "native" ||
            filePath.includes("[eval]")
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

    return {
        root: getPrimaryProjectRoot(),
        isUntrusted: false,
        callerFile: "",
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

