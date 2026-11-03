import fs from "fs";
import path from "path";
import { ConfigSyntaxParser } from "./ConfigSyntaxParser";
import { XY_ENV_INTERNAL_GET_FOR_ROOT } from "../xhsc/api/env/env";

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
    const primaryRoot = (process.env.XYPRISS_PROJECT_ROOT || process.cwd()).replace(/\\/g, "/");

    // 1. Direct O(1) match against verified plugins registered by xfpm
    const manifest = getPluginsManifest();
    if (manifest?.roots) {
        for (const [pluginRoot, _pluginName] of Object.entries(manifest.roots)) {
            const normPluginRoot = pluginRoot.replace(/\\/g, "/");
            if (normalized === normPluginRoot || normalized.startsWith(normPluginRoot + "/")) {
                return pluginRoot;
            }
        }
    }

    // 2. Direct match against primary project root
    if (normalized === primaryRoot || normalized.startsWith(primaryRoot + "/")) {
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
        const modName = nextSlash === -1 ? afterMods : afterMods.substring(0, nextSlash);
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

/**
 * Retrieves the project root of the code currently executing by analyzing the stack trace.
 */
export function getCallerProjectRoot(): string | undefined {
    const stack = new Error().stack;
    if (!stack) return getPrimaryProjectRoot();

    const lines = stack.split("\n");
    let callerFilePath = "";

    // Line 0 is 'Error', Line 1 is getCallerProjectRoot itself
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.includes(" (node:") || line.includes(" (bun:") || line.includes(" (native"))
            continue;

        const match =
            line.match(/\((.*\.([jt]s|[cm]js)):\d+:\d+\)$/) ||
            line.match(/at (.*\.([jt]s|[cm]js)):\d+:\d+$/);

        if (!match) continue;

        const filePath = match[1];
        if (!filePath || filePath === "native" || filePath === "node:fs" || filePath === "fs")
            continue;

        // Skip internal engine files to locate the user/plugin caller
        if (isEngineCorePath(filePath)) {
            continue;
        }

        if (
            line.includes("at get [") ||
            line.includes("at getStrict (") ||
            line.includes("PluginAPI.") ||
            line.includes("Plugin.")
        )
            continue;

        callerFilePath = filePath;
        break;
    }

    if (!callerFilePath) return getPrimaryProjectRoot();

    const root = identifyProjectRoot(callerFilePath);

    if (root && rootInterceptor) {
        return rootInterceptor(root) || root;
    }
    return root;
}

import { isEngineCorePath, isCoreFrameworkPath } from "./CorePathCheck";
export { isEngineCorePath, isCoreFrameworkPath };

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
                    } catch { /* ignore */ }
                }

                // Resolve references &(pkg), &(env), etc.
                const sys = (globalThis as any).__sys__;
                
                // Safely resolve &(env:...) variables scoped to the target project root
                // using the internal symbol (safe from third-party / plugin tampering).
                let envProvider = sys?.__env__;
                if (sys?.__env__?.[XY_ENV_INTERNAL_GET_FOR_ROOT]) {
                    envProvider = {
                        has: (key: string) => sys.__env__[XY_ENV_INTERNAL_GET_FOR_ROOT](key, projectRoot) !== undefined,
                        get: (key: string) => sys.__env__[XY_ENV_INTERNAL_GET_FOR_ROOT](key, projectRoot)
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


