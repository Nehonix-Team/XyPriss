import { XyPrissFS } from "./sys/System";

/**
 * **XyPriss System Variables (`__sys__`)**
 *
 * The **Central Nervous System** of a XyPriss application.
 * This class serves as the singleton entry point for:
 *
 * 1.  **Configuration Management**: Stores and syncs app metadata (`__port__`, `__mode__`).
 * 2.  **Environment Control**: Provides a safe, typed interface for `process.env`.
 * 3.  **System Operations**: Inherits ALL capabilities from `SysApi`, `FSApi`, and `PathApi`.
 *
 * Access this global instance via `__sys__` anywhere in your code.
 *
 * @class XyPrissSys
 * @extends XyPrissFS
 */
export class XyPrissSys extends XyPrissFS {
    /** Specialized workspace filesystem instance (optional plugin scope). */
    public $plug?: XyPrissFS;
    public $plg?: XyPrissFS;

    // =========================================================================
    // SYSTEM METADATA (Configuration)
    // =========================================================================

    /** Application version string (semver). */
    public __version__: string = "0.0.0";
    /** Application author or organization. */
    public __author__: string = "unknown";
    /** Brief application description. */
    public __description__: string = "A XyPriss application";
    /** Map of application-specific URLs (e.g., API docs, frontend). */
    public __app_urls__: Record<string, string> = {};
    /** Application slug name (kebab-case recommended). */
    public __name__: string = "xypriss-app";
    /** Short alias for CLI or logging. */
    public __alias__: string = "app";
    /** Primary listening port (number). Syncs with `__PORT__`. */
    public __port__: number = 3000;
    /** Primary listening port (mirror). Syncs with `__port__`. */
    public __PORT__: number = 3000;
    /** Absolute path to the project root directory. */
    public __root__: string = process.cwd();

    /**
     * **Environment Variable Manager (`__env__`)**
     *
     * A cleaner, safer interface for interacting with `process.env`.
     * Also manages the current environment mode (development, production, etc.).
     */
    public __env__ = {
        /** Current environment mode (development, production, staging, test). */
        mode: "development",

        /**
         * Sets an environment variable.
         * @param {string} key - The variable name.
         * @param {string} value - The value to set.
         */
        set: (key: string, value: string) => {
            process.env[key] = value;
        },
        /**
         * Gets an environment variable with an optional default.
         * @param {string} key - The variable name.
         * @param {string} [defaultValue] - Value to return if key is missing.
         * @returns {string|undefined} The value or default.
         */
        get: (key: string, defaultValue?: string) => {
            return process.env[key] || defaultValue;
        },
        /**
         * Checks if an environment variable exists.
         * @param {string} key - The variable name.
         * @returns {boolean} True if defined.
         */
        has: (key: string) => {
            return process.env[key] !== undefined;
        },
        /**
         * Deletes an environment variable.
         * @param {string} key - The variable name.
         */
        delete: (key: string) => {
            delete process.env[key];
        },
        /**
         * Returns all environment variables as an object.
         * @returns {NodeJS.ProcessEnv} Dictionary of all variables.
         */
        all: () => {
            return process.env;
        },

        // Helper methods for the mode
        /** Returns true if `mode` is "production". */
        isProduction: () => this.__env__.mode === "production",
        /** Returns true if `mode` is "development". */
        isDevelopment: () => this.__env__.mode === "development",
        /** Returns true if `mode` is "staging". */
        isStaging: () => this.__env__.mode === "staging",
        /** Returns true if `mode` is "test". */
        isTest: () => this.__env__.mode === "test",
        /** Returns true if `mode` matches the provided name. */
        is: (envName: string) => this.__env__.mode === envName,
    };

    /** Index signature allowing dynamic property assignment for custom config. */
    [key: string]: any;

    /**
     * **Initialize System**
     *
     * Creates the global system instance.
     * Automatically syncs ports and environment settings based on inputs.
     *
     * @param {Record<string, any>} [data] - Initial configuration data to merge.
     */
    constructor(data: Record<string, any> = {}) {
        const root = data.__root__ || process.cwd();
        super({ __root__: root });
        this.__root__ = root;
        this.$update(data);
    }

    /**
     * **Update Configuration**
     *
     * Merges a configuration object into the system state.
     * Handles intelligent synchronization of properties (like matching `__port__` and `__PORT__`).
     *
     * @param {Record<string, any>} data - Data to merge.
     */
    public $update(data: Record<string, any>): void {
        Object.assign(this, data);
        if (data.__port__ !== undefined) this.__PORT__ = data.__port__;
        if (data.__PORT__ !== undefined) this.__port__ = data.__PORT__;
        if (data.__port !== undefined) {
            this.__port__ = data.__port;
            this.__PORT__ = data.__port;
        }
        if (data.__PORT !== undefined) {
            this.__port__ = data.__PORT;
            this.__PORT__ = data.__PORT;
        }
        if (data.__mode !== undefined) this.__env__.mode = data.__mode;
        if (data.__mode__ !== undefined) this.__env__.mode = data.__mode__;
        if (data.__env !== undefined) this.__env__.mode = data.__env;
    }

    /**
     * **Add Custom Variable ($add)**
     *
     * Dynamically adds a property to the system object.
     * Use this for runtime configuration injection.
     *
     * @param {string} key - Property name.
     * @param {any} value - Value.
     */
    public $add(key: string, value: any): void {
        this[key] = value;
    }

    /**
     * **Remove Variable ($remove)**
     *
     * Removes a property from the system object.
     *
     * @param {string} key - Property name.
     * @returns {boolean} True if the property existed and was removed.
     */
    public $remove(key: string): boolean {
        if (this.$has(key)) {
            delete this[key];
            return true;
        }
        return false;
    }

    /**
     * **Serialize to JSON ($toJSON)**
     *
     * Returns a clean, plain JSON representation of the system configuration.
     * It strictly excludes internal methods, prefix-properties (starting with `$`),
     * and API inheritance artifacts (`fs`/`sys`/`path` references).
     *
     * @returns {Record<string, any>} A serializable configuration object.
     */
    public $toJSON(): Record<string, any> {
        const json: Record<string, any> = {};
        for (const key in this) {
            if (
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__env__" &&
                !["fs", "sys", "path"].includes(key)
            ) {
                json[key] = this[key];
            }
        }
        return json;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * **Get Value ($get)**
     *
     * Safely retrieves a configuration value by key, with a fallback default.
     *
     * @template T
     * @param {string} key - Property key.
     * @param {T} [defaultValue] - Value to return if key is undefined.
     * @returns {T} The found value or default.
     */
    public $get<T = any>(key: string, defaultValue?: T): T {
        return (this[key] !== undefined ? this[key] : defaultValue) as T;
    }

    /**
     * **Check Existence ($has)**
     *
     * Checks if a configuration key is defined on the system object.
     *
     * @param {string} key - Property key.
     * @returns {boolean} True if defined.
     */
    public $has(key: string): boolean {
        return this[key] !== undefined;
    }

    /**
     * **List Configuration Keys ($keys)**
     *
     * Returns a list of all active configuration keys (e.g., `__port__`, `__version__`).
     * Filters out internal methods and API properties.
     *
     * @returns {string[]} Array of key strings.
     */
    public $keys(): string[] {
        return Object.keys(this).filter(
            (key) =>
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__env__" &&
                !["fs", "sys", "path"].includes(key),
        );
    }

    /**
     * **Reset System State ($reset)**
     *
     * Resets all custom configuration to default values.
     * Useful for testing or re-initialization.
     */
    public $reset(): void {
        const envManager = this.__env__;
        Object.keys(this).forEach((key) => {
            if (
                key !== "__env__" &&
                !key.startsWith("$") &&
                !["fs", "sys", "path"].includes(key)
            ) {
                delete this[key];
            }
        });

        this.__version__ = "0.0.0";
        this.__author__ = "unknown";
        this.__app_urls__ = {};
        this.__name__ = "xypriss-app";
        this.__description__ = "A XyPriss application";
        this.__alias__ = "app";
        this.__port__ = 3000;
        this.__PORT__ = 3000;
        this.__root__ = process.cwd();
        this.__env__ = envManager;
        this.__env__.mode = "development";
    }

    /**
     * **Clone System ($clone)**
     *
     * Creates a deep independent copy of the current system configuration.
     *
     * @returns {XyPrissSys} A new independent instance.
     */
    public $clone(): XyPrissSys {
        return new XyPrissSys(this.$toJSON());
    }
}

// Global Registration
if (typeof globalThis !== "undefined") {
    const defaultPort = parseInt(process.env["PORT"] || "3000");
    (globalThis as any).__sys__ =
        (globalThis as any).__sys__ ||
        new XyPrissSys({
            __port__: defaultPort,
            __PORT__: defaultPort,
            __mode__: process.env["NODE_ENV"] || "development",
        });
}

/** Global singleton instance of the system. */
export const __sys__ = (globalThis as any).__sys__ as XyPrissSys;

