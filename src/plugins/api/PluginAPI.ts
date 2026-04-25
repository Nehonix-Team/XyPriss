/**
 * Plugin API
 * Public API for plugin management as documented in PLUGIN_SYSTEM_GUIDE.md
 */

import type { XyPrissPlugin, PluginCreator } from "../types/PluginTypes";
import { XyPluginManager as PluginManager } from "../core/XPluginManager";
import { XyPrissXHSC } from "../../xhsc";

// ─── Internal State ──────────────────────────────────────────────────────────

let globalPluginManager: PluginManager | null = null;

const pendingPlugins: Array<{
    plugin: XyPrissPlugin | PluginCreator;
    config?: any;
}> = [];

// ─── Blocked / Private members ───────────────────────────────────────────────

/**
 * Methods that must never be accessible from outside the module.
 * The Proxy intercepts any access to these keys and throws immediately.
 */
const PRIVATE_MEMBERS = new Set<string>(["register"]);

// ─── Internal helpers ─────────────────────────────────────────────────────────

function assertNonEmptyString(
    value: unknown,
    errorMessage: string,
): asserts value is string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(errorMessage);
    }
}

function resolvePluginRoot(rootOrSys: string | { __root__: string }): string {
    const root =
        typeof rootOrSys === "string" ? rootOrSys : rootOrSys?.__root__;
    if (!root || typeof root !== "string" || !root.trim()) {
        throw new Error(
            "XyPriss Security Error: The provided root or '__sys__' instance is invalid or lacks a captured project root.",
        );
    }
    return root;
}

// ─── Internal exports ────────────────────────────────────────────────────────

/**
 * Set the global plugin manager.
 * @internal — Used by the server factory only.
 */
export async function setGlobalPluginManager(
    manager: PluginManager,
): Promise<void> {
    globalPluginManager = manager;

    // Flush pending queue in parallel
    const queue = pendingPlugins.splice(0);
    await Promise.all(
        queue.map(({ plugin, config }) => manager.register(plugin, config)),
    );
}

/**
 * Get the global plugin manager.
 * @internal
 */
export function getGlobalPluginManager(): PluginManager | null {
    return globalPluginManager;
}

// ─── PluginAPI class ─────────────────────────────────────────────────────────

class PluginAPI {
    /**
     * Reads and returns the project manifest (`package.json`) associated with the provided system core.
     *
     * This method is cryptographically and logically bound to the system instance to ensure
     * that plugins only access the metadata of their authorized environment.
     *
     * @template T - The expected structure of the manifest file.
     * @param sys - The XyPriss Hyper-System Core (`__sys__`) instance.
     * @returns The parsed JSON content of the `package.json` file.
     * @throws {Error} If the system instance is invalid, lacks a root path, or the manifest cannot be read.
     *
     * @example
     * ```typescript
     * const pkg = Plugin.manifest<MyPackageJson>(__sys__);
     * console.log(`Running in ${pkg.name}@${pkg.version}`);
     * ```
     */
    public manifest<T>(sys: XyPrissXHSC): T {
        if (!sys || !sys.__root__) {
            throw new Error(
                "XyPriss Security Error: The provided system core instance is invalid or lacks an authorized project root association.",
            );
        }

        const manifestPath = sys.fs.join(sys.__root__, "package.json");
        if (!sys.path.exists(manifestPath)) {
            throw new Error(
                `XyPriss I/O Error: Unable to access project manifest at "${manifestPath}". Verify that the file exists and is readable.`,
            );
        }
        try {
            return sys.fs.readJsonSync(manifestPath) as T;
        } catch (err) {
            throw new Error(
                `XyPriss I/O Error: Unable to access project manifest at "${manifestPath}". Verify that the file exists and is readable.`,
            );
        }
    }

    /**
     * @private — Internal registration. Never call this directly.
     * Use `exec()` instead.
     */
    private register(
        plugin: XyPrissPlugin | PluginCreator,
        config?: any,
    ): void {
        const manager = globalPluginManager;

        if (manager) {
            manager.register(plugin, config);
        } else {
            pendingPlugins.push({ plugin, config });
        }
    }

    /**
     * Register a plugin — the sole public entry point for plugin registration.
     *
     * @example
     * ```typescript
     * Plugin.exec(Plugin.create({
     *   name: "test",
     *   version: "1.0.0",
     *   onServerStart(server) {
     *     console.log("Server started");
     *   },
     * }, __sys__.__root__));
     * ```
     */
    exec(plugin: XyPrissPlugin | PluginCreator, config?: any): void {
        this.register(plugin, config);
    }

    /**
     * Get a registered plugin by name.
     *
     * @example
     * ```typescript
     * const plugin = Plugin.get("my-plugin");
     * if (plugin) {
     *   console.log(`Found plugin: ${plugin.name}@${plugin.version}`);
     * }
     * ```
     */
    get(name: string):
        | {
              name: string;
              version: string;
              __root__: string;
          }
        | undefined {
        const manager = globalPluginManager;

        if (!manager) {
            throw new Error(
                "Plugin system not initialized. Create a server instance first.",
            );
        }
        const plugin = manager.getPlugin(name);

        if (!plugin) {
            return undefined;
        }

        return {
            name: plugin.name,
            version: plugin.version,
            __root__: plugin.__root__ || "",
        };
    }

    /**
     * Create a type-safe plugin instance with a validated root.
     *
     * @example
     * ```typescript
     * const myPlugin = Plugin.create({
     *   name: "my-plugin",
     *   version: "1.0.0",
     *   onServerStart: (server) => console.log("Plugin started!"),
     * }, __sys__.__root__);
     * ```
     */
    create(plugin: XyPrissPlugin, Sys: string): XyPrissPlugin {
        assertNonEmptyString(
            Sys,
            "XyPriss Initialization Error: To create a plugin, you MUST provide the plugin's root path or its '__sys__' instance as the second argument to Plugin.create().\n" +
                "Example: return Plugin.create({ ... }, __sys__.__root__);",
        );

        plugin.__root__ = Sys;
        return plugin;
    }

    /**
     * Create a typed plugin factory with a pre-assigned root.
     *
     * @example
     * ```typescript
     * const myFactory = Plugin.factory(
     *   (config: MyConfig) => ({ name: "my-plugin", version: "1.0.0" }),
     *   __sys__.__root__
     * );
     * ```
     */
    factory<TConfig = any>(
        creator: (config: TConfig) => XyPrissPlugin,
        rootOrSys: string | { __root__: string },
    ): PluginCreator {
        if (!rootOrSys) {
            throw new Error(
                "XyPriss Initialization Error: Plugin.factory() requires the plugin's root path or '__sys__' instance as the second argument.",
            );
        }

        const pluginRoot = resolvePluginRoot(rootOrSys);

        return ((config: TConfig) => {
            const plugin = creator(config);
            plugin.__root__ = pluginRoot;
            return plugin;
        }) as PluginCreator;
    }

    // /**
    //  * Get statistics for all registered plugins
    //  * Requires MANAGE_PLUGINS permission
    //  */
    // getStats(): import("../types/PluginTypes").PluginStats[] {
    //     const manager = globalPluginManager;
    //     if (!manager) return [];
    //     return manager.getPluginStats();
    // }

    // /**
    //  * Set permission for a plugin hook
    //  * Requires MANAGE_PLUGINS permission
    //  */
    // setPermission(pluginName: string, hookId: string, allowed: boolean, by?: string): void {
    //     globalPluginManager?.setPluginPermission(pluginName, hookId, allowed, by);
    // }

    // /**
    //  * Toggle plugin enabled/disabled state
    //  * Requires MANAGE_PLUGINS permission
    //  */
    // toggle(pluginName: string, enabled: boolean, by?: string): void {
    //     globalPluginManager?.togglePlugin(pluginName, enabled, by);
    // }

    /**
     * Create a no-op placeholder plugin.
     * Useful for testing or conditional plugin slots.
     */
    void(): XyPrissPlugin {
        return {
            name: `void-plugin-${Math.random().toString(36).slice(2, 9)}`,
            version: "1.0.0",
        };
    }
}

// ─── Proxy Shield ─────────────────────────────────────────────────────────────

/**
 * Wraps the PluginAPI instance in a Proxy that:
 *   1. Blocks direct access to private members (e.g. `register`).
 *   2. Prevents any mutation of the instance from outside.
 *   3. Prevents prototype inspection / tampering.
 */
function createSecurePluginAPI(
    instance: PluginAPI,
): Readonly<Omit<PluginAPI, "register">> {
    return new Proxy(instance, {
        get(target, prop: string | symbol) {
            // Block private members by name
            if (typeof prop === "string" && PRIVATE_MEMBERS.has(prop)) {
                throw new TypeError(
                    `XyPriss Security Error: '${prop}' is a private method and cannot be accessed externally.`,
                );
            }

            const value = Reflect.get(target, prop, target);

            // Bind methods so `this` always refers to the real instance, not the proxy
            if (typeof value === "function") {
                return value.bind(target);
            }

            return value;
        },

        // Prevent property assignment from outside
        set(_target, prop: string | symbol) {
            throw new TypeError(
                `XyPriss Security Error: Cannot assign to '${String(prop)}' — the Plugin API is read-only.`,
            );
        },

        // Prevent property deletion
        deleteProperty(_target, prop: string | symbol) {
            throw new TypeError(
                `XyPriss Security Error: Cannot delete '${String(prop)}' — the Plugin API is immutable.`,
            );
        },

        // Prevent defineProperty overrides
        defineProperty(_target, prop: string | symbol) {
            throw new TypeError(
                `XyPriss Security Error: Cannot redefine '${String(prop)}' on the Plugin API.`,
            );
        },

        // Prevent prototype chain inspection / hijacking
        getPrototypeOf() {
            return null;
        },

        // Prevent setPrototypeOf
        setPrototypeOf() {
            throw new TypeError(
                "XyPriss Security Error: Cannot modify the prototype of the Plugin API.",
            );
        },
    }) as Readonly<Omit<PluginAPI, "register">>;
}

export const Plugin = createSecurePluginAPI(new PluginAPI());

