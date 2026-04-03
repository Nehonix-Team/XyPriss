import {
    isCoreFrameworkPath,
    isCoreStack,
    isPluginPath,
    isTestPath,
    isTrustedDependencyPath,
} from "../../utils/ProjectDiscovery";

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

// 1. Bun ESM Interception (Using Bun.plugin + onLoad Scanner)
// This is the "Nuclear" option that scans plugin source code BEFORE evaluation.
if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.bun
) {
    // @ts-ignore
    if (typeof Bun !== "undefined" && Bun.plugin) {
        // @ts-ignore
        Bun.plugin({
            name: "XyPrissNativeBlocker",
            setup(build: any) {
                // Intercept all .ts/.js files. We filtrate within the hook for better control.
                build.onLoad({ filter: /\.(ts|js)x?$/ }, async (args: any) => {
                    const normalizedPath = args.path.replace(/\\/g, "/");

                    // Only scan plugins (mods/). This prevents false positives in the core and trusted root deps.
                    // IMPORTANT: We skip scanning for node_modules to allow libraries to use native APIs.
                    // We also return undefined to let Bun handle the file normally.
                    if (
                        !isPluginPath(normalizedPath) ||
                        normalizedPath.includes("/node_modules/") ||
                        isTestPath(normalizedPath)
                    )
                        return undefined;

                    // Read the source file
                    const content = await Bun.file(args.path).text();

                    // Regex to find forbidden imports (import ... from "fs", require("fs"), etc.)
                    // This catches static imports and direct require() calls in the source.
                    const forbiddenPattern =
                        /(import|export).*from\s*['"](node:)?(fs|os|path|child_process|crypto)[\/'"]|require\s*\(\s*['"](node:)?(fs|os|path|child_process|crypto)[\/'"]\)/g;

                    const match = content.match(forbiddenPattern);
                    if (match) {
                        console.error(
                            `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR \x1b[0m\n` +
                                `\x1b[31mForbidden native module usage detected in plugin source code!\x1b[0m\n` +
                                `\x1b[33mFile:\x1b[0m ${args.path}\n` +
                                `\x1b[33mOffending code snippet:\x1b[0m ${match[0]}\n` +
                                `\x1b[32mPlugins MUST use the sandboxed '__sys__' API for system operations.\x1b[0m`,
                        );
                        // Kill the process immediately to prevent any evaluation
                        process.exit(1);
                    }

                    // No forbidden code, let Bun load it normally
                    return undefined;
                });
            },
        });
    }
}

/**
 * Initializes the Zero-Trust Native API Blocker.
 * This intercepts `require` (and `import` in Bun) to prevent end-user code
 * or plugins from accessing sensitive native APIs directly.
 */
export function initializeNativeApiBlocker() {
    const checkAccess = (
        importerOrStack: string,
        isBunResolver = false,
        moduleName = "Unknown",
    ) => {
        let isAuthorized = false;

        if (isBunResolver) {
            isAuthorized =
                isCoreFrameworkPath(importerOrStack) ||
                isTrustedDependencyPath(importerOrStack);
        } else {
            isAuthorized = isCoreStack(importerOrStack);
        }

        // If not already authorized via core/stack check, perform granular path analysis
        if (!isAuthorized) {
            // Extract the first real caller outside of our blocker
            const lines = importerOrStack.split("\n");
            let realCallerLine = "";
            let callerPath = "Unknown";

            for (const line of lines) {
                if (
                    line.includes("at ") &&
                    !line.includes("NativeApiBlocker.ts") &&
                    !line.includes(" (node:") &&
                    !line.includes(" (bun:") &&
                    !line.includes(" (native") &&
                    !line.includes(" <anonymous>")
                ) {
                    realCallerLine = line.trim();
                    const match =
                        realCallerLine.match(/\((.*):\d+:\d+\)$/) ||
                        realCallerLine.match(/at (.*):\d+:\d+$/) ||
                        realCallerLine.match(/at (.*)$/);
                    if (match) callerPath = match[1];
                    break;
                }
            }

            // FINAL CHECK: If the caller is a trusted dependency (root node_modules) OR a test script, let it pass!
            if (isTrustedDependencyPath(callerPath) || isTestPath(callerPath)) {
                return;
            }

            const isPlugin = isPluginPath(callerPath);
            const contextType = isPlugin ? "plugin" : "User Script";

            console.error(
                `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR \x1b[0m\n` +
                    `\x1b[31mDirect access to native module '${moduleName}' is strictly forbidden for ${contextType}s.\x1b[0m\n` +
                    `\x1b[33mCaller detected:\x1b[0m ${realCallerLine}\n` +
                    `\x1b[32mPlease use the sandboxed '__sys__' API instead.\x1b[0m`,
            );
            // Mandatory exit to prevent try/catch bypassing
            process.exit(1);
        }
    };

    // 2. Node.js & Bun CJS Interception (Monkey Patching `require`)
    // @ts-ignore
    const Module = require("module");
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function (id: string) {
        if (FORBIDDEN_MODULES.has(id)) {
            const stack = new Error().stack || "";
            checkAccess(stack, false, id);
        }
        return originalRequire.apply(this, arguments as any);
    };

    // 3. Execution-Level Monkey Patching (Foolproof fallback)
    const patchModule = (name: string) => {
        try {
            const mod = require(name);
            const methods = Object.keys(mod).filter(
                (k) => typeof mod[k] === "function",
            );

            for (const method of methods) {
                const originalMethod = mod[method];
                try {
                    Object.defineProperty(mod, method, {
                        value: function () {
                            const stack = new Error().stack || "";
                            checkAccess(stack, false, `${name}.${method}`);
                            return originalMethod.apply(this, arguments);
                        },
                        configurable: true,
                        writable: true,
                    } as any);
                } catch (e) {
                    // Fallback for non-configurable properties (like some native ones in Bun)
                    mod[method] = function () {
                        const stack = new Error().stack || "";
                        checkAccess(stack, false, `${name}.${method}`);
                        return originalMethod.apply(this, arguments);
                    };
                }
            }
        } catch (e) {
            // Ignore modules that fail to load
        }
    };

    // Apply execution-level guards for key modules
    ["fs", "os", "child_process", "crypto"].forEach(patchModule);
}

