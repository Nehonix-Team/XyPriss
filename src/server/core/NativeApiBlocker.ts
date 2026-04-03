import {
    isCoreFrameworkPath,
    isCoreStack,
    isPluginPath,
    isTestPath,
    isTrustedDependencyPath,
} from "../../utils/ProjectDiscovery";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORBIDDEN_MODULES = new Set([
    "fs",
    "node:fs",
    "fs/promises",
    "node:fs/promises",
    "os",
    "node:os",
    "path",
    "node:path",
    "child_process",
    "node:child_process",
    "crypto",
    "node:crypto",
]);

/** Bare names used for cache purge & execution-level patching */
const FORBIDDEN_BARE = ["fs", "os", "path", "child_process", "crypto"] as const;

// const DEBUG = process.env.XYPRISS_BLOCKER_DEBUG === "1";
const DEBUG = false;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Hard-kill — process.exit can be swallowed by uncaughtException handlers */
function fatalExit(reason: string): never {
    // Print before any exit attempt so the message is always visible
    process.stderr.write(reason + "\n");
    try {
        process.exit(1);
    } catch {
        // Last resort — process.abort() cannot be caught
        process.abort();
    }
    // TypeScript unreachable guard
    throw new Error("unreachable");
}

function securityError(
    contextType: "plugin" | "User Script",
    moduleName: string,
    callerLine: string,
): never {
    fatalExit(
        `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR \x1b[0m\n` +
            `\x1b[31mDirect access to native module '${moduleName}' is strictly forbidden for ${contextType}s.\x1b[0m\n` +
            `\x1b[33mCaller detected:\x1b[0m ${callerLine}\n` +
            `\x1b[32mPlease use the sandboxed '__sys__' API instead.\x1b[0m`,
    );
}

// ---------------------------------------------------------------------------
// Initialization guard — prevent double-init and re-entrancy
// ---------------------------------------------------------------------------

let _initialized = false;

// ---------------------------------------------------------------------------
// 1. Bun ESM Interception (source-level scanner via Bun.plugin + onLoad)
//    Runs BEFORE any plugin/user file is evaluated.
//    Catches: static import, re-export, dynamic import(), require() in source.
// ---------------------------------------------------------------------------

if (
    typeof process !== "undefined" &&
    process.versions?.bun &&
    // @ts-ignore
    typeof Bun !== "undefined" &&
    // @ts-ignore
    typeof Bun.plugin === "function"
) {
    /**
     * Covers:
     *   import foo from "fs"
     *   import { x } from "node:fs/promises"
     *   export { y } from "child_process"
     *   const m = require("crypto")
     *   const m = await import("os")
     *   const m = await import(`node:path`)
     */
    const forbiddenSourcePattern =
        /(?:import|export)[\s\S]*?from\s*['"`](node:)?(?:fs(?:\/promises)?|os|path|child_process|crypto)['"`]|require\s*\(\s*['"`](node:)?(?:fs(?:\/promises)?|os|path|child_process|crypto)['"`]\s*\)|import\s*\(\s*['"`](node:)?(?:fs(?:\/promises)?|os|path|child_process|crypto)['"`]\s*\)/g;

    // @ts-ignore
    Bun.plugin({
        name: "XyPrissNativeBlocker",
        setup(build: any) {
            build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args: any) => {
                const normalizedPath: string = args.path.replace(/\\/g, "/");

                // Allow: framework internals, node_modules, tests
                if (
                    isCoreFrameworkPath(normalizedPath) ||
                    normalizedPath.includes("/node_modules/") ||
                    isTestPath(normalizedPath)
                ) {
                    return undefined;
                }

                // @ts-ignore
                const content: string = await Bun.file(args.path).text();
                forbiddenSourcePattern.lastIndex = 0;
                const match = forbiddenSourcePattern.exec(content);

                if (match) {
                    fatalExit(
                        `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR \x1b[0m\n` +
                            `\x1b[31mForbidden native module usage detected in plugin source code!\x1b[0m\n` +
                            `\x1b[33mFile:\x1b[0m ${args.path}\n` +
                            `\x1b[33mOffending snippet:\x1b[0m ${match[0].trim()}\n` +
                            `\x1b[32mPlugins MUST use the sandboxed '__sys__' API for system operations.\x1b[0m`,
                    );
                }

                return undefined;
            });
        },
    });
}

// ---------------------------------------------------------------------------
// 2. Core access-check logic (shared between CJS require patch & exec patch)
// ---------------------------------------------------------------------------

function checkAccess(
    importerOrStack: string,
    isBunResolver: boolean,
    moduleName: string,
): void {
    let isAuthorized = false;

    if (isBunResolver) {
        isAuthorized =
            isCoreFrameworkPath(importerOrStack) ||
            isTrustedDependencyPath(importerOrStack);
    } else {
        isAuthorized = isCoreStack(importerOrStack);
    }

    if (DEBUG) {
        process.stderr.write(
            `[NativeApiBlocker] isAuthorized=${isAuthorized} module=${moduleName}\nstack=${importerOrStack}\n`,
        );
    }

    if (isAuthorized) return;

    // -----------------------------------------------------------------------
    // Granular caller analysis
    // -----------------------------------------------------------------------
    const lines = importerOrStack.split("\n");
    let realCallerLine = "";
    let callerPath = "Unknown";

    for (const line of lines) {
        if (
            line.includes("at ") &&
            !line.includes("NativeApiBlocker.") &&
            !line.includes(" (node:") &&
            !line.includes(" (bun:") &&
            !line.includes(" (native") &&
            !line.includes(" <anonymous>")
        ) {
            realCallerLine = line.trim();
            const match =
                realCallerLine.match(/\((.+?):\d+:\d+\)$/) ||
                realCallerLine.match(/at (.+?):\d+:\d+$/) ||
                realCallerLine.match(/at (.+?)$/);
            if (match) callerPath = match[1];
            break;
        }
    }

    // Trusted dependency (root node_modules) or test file → allow
    if (isTrustedDependencyPath(callerPath) || isTestPath(callerPath)) {
        return;
    }

    const isPlugin = isPluginPath(callerPath);
    const contextType = isPlugin ? "plugin" : "User Script";

    securityError(contextType, moduleName, realCallerLine);
}

// ---------------------------------------------------------------------------
// Public initializer
// ---------------------------------------------------------------------------

/**
 * Initializes the Zero-Trust Native API Blocker.
 *
 * Layers:
 *  2. CJS `require` monkey-patch (Node.js + Bun CJS)
 *  3. `process.binding` block (low-level native binding access)
 *  4. Execution-level method patch (foolproof fallback for pre-cached requires)
 *  5. `require.cache` purge of any forbidden modules already loaded
 */
export function initializeNativeApiBlocker(): void {
    if (_initialized) return;
    _initialized = true;

    // -------------------------------------------------------------------------
    // 2. CJS require patch
    // -------------------------------------------------------------------------
    // @ts-ignore
    const Module = require("module");
    const originalRequire = Module.prototype.require as (id: string) => unknown;

    Module.prototype.require = function (id: string): unknown {
        if (FORBIDDEN_MODULES.has(id)) {
            const stack = new Error().stack ?? "";
            checkAccess(stack, false, id);
        }
        return originalRequire.apply(this, arguments as any);
    };

    // Freeze the patched prototype so nobody can restore originalRequire
    // by replacing Module.prototype.require again after us.
    // (We only freeze the require property, not the whole prototype, to avoid
    //  breaking legitimate framework instrumentation of other properties.)
    try {
        Object.defineProperty(Module.prototype, "require", {
            value: Module.prototype.require,
            writable: false,
            configurable: false,
        });
    } catch {
        // Already non-configurable — fine
    }

    // -------------------------------------------------------------------------
    // 3. Block process.binding (low-level native access used by advanced bypasses)
    // -------------------------------------------------------------------------
    const originalBinding = (process as any).binding as (
        name: string,
    ) => unknown;
    if (typeof originalBinding === "function") {
        (process as any).binding = function (name: string): unknown {
            // fs_event_wrap, fs_poll, etc. are all prefixed with "fs"
            if (
                name === "fs" ||
                name === "os" ||
                name === "crypto" ||
                name.startsWith("fs_") ||
                name === "pipe_wrap"
            ) {
                const stack = new Error().stack ?? "";
                checkAccess(stack, false, `process.binding(${name})`);
            }
            return originalBinding.call(process, name);
        };

        try {
            Object.defineProperty(process, "binding", {
                value: (process as any).binding,
                writable: false,
                configurable: false,
            });
        } catch {
            // Already frozen — fine
        }
    }

    // -------------------------------------------------------------------------
    // 4. Execution-level method patching (handles pre-cached / already-loaded
    //    modules that bypass the require hook)
    // -------------------------------------------------------------------------
    const patchModule = (name: string): void => {
        let mod: Record<string, unknown>;
        try {
            mod = originalRequire.call(Module, name) as Record<string, unknown>;
        } catch {
            return;
        }

        patchObject(mod, name);
    };

    const patchObject = (
        obj: Record<string, unknown>,
        moduleName: string,
        visited = new Set<unknown>(),
    ): void => {
        if (!obj || visited.has(obj)) return;
        visited.add(obj);

        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === "function") {
                const original = val as (...args: unknown[]) => unknown;
                const wrapped = function (
                    this: unknown,
                    ...args: unknown[]
                ): unknown {
                    const stack = new Error().stack ?? "";
                    checkAccess(stack, false, `${moduleName}.${key}`);
                    return original.apply(this, args);
                };
                try {
                    Object.defineProperty(obj, key, {
                        value: wrapped,
                        configurable: true,
                        writable: true,
                    });
                } catch {
                    try {
                        obj[key] = wrapped;
                    } catch {
                        /* non-writable */
                    }
                }
            } else if (
                val !== null &&
                typeof val === "object" &&
                !Array.isArray(val)
            ) {
                // Recurse into sub-namespaces (e.g. fs.promises)
                patchObject(
                    val as Record<string, unknown>,
                    `${moduleName}.${key}`,
                    visited,
                );
            }
        }
    };

    FORBIDDEN_BARE.forEach(patchModule);

    // -------------------------------------------------------------------------
    // 5. Synchronize with ESM Cache
    //    Node.js and modern Bun use a separate binding space for ESM namespaces.
    //    This forces the engine to propagate our CJS monkey-patch updates to
    //    ESM module namespaces (e.g., `import * as fs from "fs"`).
    // -------------------------------------------------------------------------
    if (typeof (Module as any).syncBuiltinESMExports === "function") {
        try {
            (Module as any).syncBuiltinESMExports();
        } catch {
            // Safe fallback
        }
    }

    // -------------------------------------------------------------------------
    // 6. Purge already-loaded forbidden modules from require.cache
    //    Prevents: const fs = require("fs") called before blocker init,
    //    then storing the reference and using it later.
    //    We replace cached entries with a Proxy that calls checkAccess on any
    //    property access, rather than deleting (deletion causes a re-require
    //    which would re-run module code).
    // -------------------------------------------------------------------------
    const cache = require.cache as Record<string, unknown>;
    for (const key of Object.keys(cache)) {
        const bare = FORBIDDEN_BARE.find(
            (m) =>
                key === `node:${m}` ||
                key.endsWith(`/${m}.js`) ||
                key.endsWith(`\\${m}.js`) ||
                key === m,
        );
        if (bare) {
            const cached = (cache[key] as any)?.exports;
            if (cached && typeof cached === "object") {
                patchObject(
                    cached as Record<string, unknown>,
                    bare,
                    new Set<unknown>(),
                );
            }
        }
    }
}

/**
 * Recursively scans a directory for forbidden static imports.
 * This complements the execution-level NativeApiBlocker by catching static ESM
 * namespace imports which cannot be monkey-patched dynamically in Bun/Node.
 */
export function scanPluginSourceForNativeApis(
    dir: string,
    pluginName: string,
): void {
    const fs = require("fs");
    const path = require("path");

    // The same regex used by the Bun plugin
    const forbiddenSourcePattern =
        /(?:import|export)[^;\n]*?from\s*['"`](node:)?(?:fs(?:\/promises)?|os|path|child_process|crypto)['"`]/g;

    const scanDir = (currentDir: string) => {
        let files: string[] = [];
        try {
            files = fs.readdirSync(currentDir);
        } catch {
            return;
        }

        for (const file of files) {
            // Skip node_modules (trusted dependencies) and dist/build artifacts if needed
            if (
                file === "node_modules" ||
                file === ".xpm" ||
                file === ".git" ||
                file.includes("rollup.config") ||
                file.includes("jest.config") ||
                file.includes("tsup.config") ||
                file.includes("vite.config") ||
                file.includes("webpack.config")
            )
                continue;

            const fullPath = path.join(currentDir, file);
            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                scanDir(fullPath);
            } else if (stat.isFile() && /\.[cm]?[jt]sx?$/.test(file)) {
                try {
                    const content = fs.readFileSync(fullPath, "utf-8");
                    forbiddenSourcePattern.lastIndex = 0;
                    const match = forbiddenSourcePattern.exec(content);

                    if (match) {
                        securityError(
                            "plugin",
                            match[0].trim(),
                            `${pluginName} (${fullPath})`,
                        );
                    }
                } catch {
                    // Ignore read errors
                }
            }
        }
    };

    scanDir(dir);
}

