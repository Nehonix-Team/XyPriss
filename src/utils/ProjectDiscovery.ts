import fs from "fs";
import path from "path";

/**
 * Checks if a directory is a "Real Project" root based on hierarchical criteria.
 * Criteria:
 * 1. (package.json + node_modules) -> Strong baseline
 * 2. (package.json + src + tsconfig.json) -> High priority
 */
export function isProjectRoot(dir: string): boolean {
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) return false;

    // Strong Heuristics (Zero FS Read)
    const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));
    const hasTsConfig = fs.existsSync(path.join(dir, "tsconfig.json"));
    const hasSrc = fs.existsSync(path.join(dir, "src"));
    const hasXyConfig =
        fs.existsSync(path.join(dir, "xypriss.config.json")) ||
        fs.existsSync(path.join(dir, "xypriss.config.jsonc"));

    if (hasNodeModules || hasXyConfig || (hasSrc && hasTsConfig)) return true;

    // Package Metadata Heuristic: A 'Real' package root is a unit that
    // has an identity (name + version). This correctly identifies
    // installed plugins even if they've been flattened or lack source configs.
    try {
        const pkgStr = fs.readFileSync(pkgPath, "utf-8");
        // Fast pre-check before parsing JSON
        if (pkgStr.includes('"name"') && pkgStr.includes('"version"')) {
            const pkg = JSON.parse(pkgStr);
            if (pkg.name && pkg.version) return true;
        }
    } catch {
        // Any error in reading/parsing means it's not a valid project root
    }

    return false;
}

/**
 * Identifies the project root for a given caller path by traversing up the filesystem.
 */
export function identifyProjectRoot(filePath: string): string | undefined {
    let current = path.resolve(path.dirname(filePath));
    const systemRootDir = path.parse(current).root;

    while (current !== systemRootDir) {
        if (isProjectRoot(current)) {
            return current;
        }
        current = path.dirname(current);
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
    if (!stack) return undefined;

    const lines = stack.split("\n");
    let callerLine = "";
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Filter out framework files to find user/plugin code
        if (
            !line.includes("EnvApi.ts") &&
            !line.includes("EnvApi.js") &&
            !line.includes("System.ts") &&
            !line.includes("System.js") &&
            !line.includes("sys.ts") &&
            !line.includes("sys.js") &&
            !line.includes("ProjectDiscovery.ts") &&
            !line.includes("ProjectDiscovery.js") &&
            !line.includes("ConfigLoader.ts") &&
            !line.includes("ConfigLoader.js") &&
            !line.includes("StartupProcessor.ts") &&
            !line.includes("StartupProcessor.js") &&
            !line.includes("XPluginManager.ts") &&
            !line.includes("XPluginManager.js") &&
            !line.includes("PluginSecurity.ts") &&
            !line.includes("PluginSecurity.js") &&
            !line.includes("PluginLoader.ts") &&
            !line.includes("PluginLoader.js") &&
            !line.includes("PluginHookRunner.ts") &&
            !line.includes("PluginHookRunner.js") &&
            !line.includes("XyServerCreator.ts") &&
            !line.includes("XyServerCreator.js") &&
            !line.includes("XyLifecycleManager.ts") &&
            !line.includes("XyLifecycleManager.js") &&
            !line.includes("ServerFactory.ts") &&
            !line.includes("ServerFactory.js") &&
            !line.includes("index.ts") &&
            !line.includes("index.js") &&
            // Specifically skip __xhsc__ property getters without blocking user "getXXX" functions
            !line.includes("at get [") &&
            !line.includes("at getStrict (") &&
            !line.includes("at all (")
        ) {
            callerLine = line;
            break;
        }
    }

    if (!callerLine) return undefined;

    const match =
        callerLine.match(/\((.*):\d+:\d+\)$/) ||
        callerLine.match(/at (.*):\d+:\d+$/);
    if (!match) return undefined;

    const filePath = match[1];
    const root = identifyProjectRoot(filePath);
    if (root && rootInterceptor) {
        return rootInterceptor(root) || root;
    }
    return root;
}

/**
 * Checks if a given file path belongs directly to the XyPriss Core Engine
 * or if it comes from an external plugin / user space.
 */
export function isCoreFrameworkPath(filePath: string): boolean {
    if (!filePath) return false;

    // Normalize path just in case
    const normalizedPath = filePath.replace(/\\/g, "/");

    // XyPriss core execution vectors usually stem from:
    // 1. Within node_modules/xypriss/...
    // 2. Local development inside /XyPriss/src/... or /XyPriss/dist/...

    // Authorize trusted internal mods within the framework repository
    if (normalizedPath.includes("/XyPriss/mods/")) return true;

    // Exclude other plugins even if they contain 'src' or are named 'xypriss-something'
    if (normalizedPath.includes("/mods/")) return false;

    // Authorize xypriss core and its internal sub-packages (xypriss-security, xypriss-utils, etc.)
    if (normalizedPath.includes("/node_modules/xypriss")) return true;

    // Authorize local project sources
    if (normalizedPath.includes("/XyPriss/src/")) return true;
    if (normalizedPath.includes("/XyPriss/dist/")) return true;

    return false;
}

/**
 * Validates a call stack to determine whether the execution trace originated
 * safely from within the core framework, dropping unauthorized usage.
 */
export function isCoreStack(stack: string): boolean {
    if (!stack) return false;

    // Parse the stack specifically to find the originating (calling) module
    const lines = stack.split("\n");
    // Line 0 is Error message. Line 1 is the interception site. Line 2+ traces back.
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Skip internal Node/Bun native APIs in the trace
        if (
            line.includes(" (node:") ||
            line.includes(" (bun:") ||
            line.includes(" (internal:") ||
            line.includes(" (native") ||
            line.trim() === "at native"
        )
            continue;

        // We look for the first real file in the trace that isn't native or our blocker script
        // We use . (dot) to match both .ts and .js versions of the blocker
        if (line.includes("NativeApiBlocker.")) continue;
        if (
            line.includes("module.js") ||
            line.includes("internal/modules/") ||
            line.includes("node:internal")
        )
            continue;

        // If the first actionable file trace we find is outside the core, immediate rejection
        // Skip common framework files to find the real caller
        if (
            line.includes("ProjectDiscovery.") ||
            line.includes("XyServerCreator.") ||
            line.includes("PluginLoader.") ||
            line.includes("PluginSecurity.") ||
            line.includes("PluginHookRunner.") ||
            line.includes("XPluginManager.") ||
            line.includes("XyLifecycleManager.") ||
            line.includes("ConfigLoader.") ||
            line.includes("StartupProcessor.") ||
            line.includes("System.") ||
            line.includes("EnvApi.") ||
            line.includes("sys.")
        ) {
            continue;
        }

        const match =
            line.match(/\((.*):\d+:\d+\)$/) ||
            line.match(/at (.*):\d+:\d+$/) ||
            line.match(/at (.*)$/);
        if (match) {
            const filePath = match[1];
            if (
                filePath === "native" ||
                filePath === "node:fs" ||
                filePath === "fs"
            )
                continue;
            const result = isCoreFrameworkPath(filePath);
            return result;
        }
    }
    return false;
}

/**
 * Checks if a given file path belongs to a trusted dependency (root node_modules).
 * Trusted dependencies are those installed in the main project's node_modules
 * but NOT inside a plugin directory.
 */
export function isTrustedDependencyPath(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    // Authorize node_modules only if NOT inside a /mods/ directory
    return (
        normalizedPath.includes("/node_modules/") &&
        !normalizedPath.includes("/mods/")
    );
}

/**
 * Checks if a given file path belongs to a plugin (resides in /mods/).
 */
export function isPluginPath(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return normalizedPath.includes("/mods/");
}

/**
 * Checks if a given file path belongs to a test directory (e.g., /.private/).
 */
export function isTestPath(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return normalizedPath.includes("/.private/");
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
                return JSON.parse(clean);
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

