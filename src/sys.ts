import { XyPrissFS } from "./sys/System";

/**
 * **XyPriss System Variables**
 *
 * The central hub for all system interactions within a XyPriss application.
 * This class combines **Configuration Management**, **Environment Control**, and
 * **System/Filesystem Operations** into a single, powerful global object (`__sys__`).
 *
 * **Core Features:**
 * 1.  **Unified API**: Access all system tools directly (e.g., `__sys__.$readJson`, `__sys__.$cpu`).
 * 2.  **Configuration**: Manages app metadata (`__port__`, `__env__`, `__version__`).
 * 3.  **Environment**: Type-safe wrapper around `process.env`.
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

    /** Application version string. */
    public __version__: string = "0.0.0";
    /** Application author. */
    public __author__: string = "unknown";
    /** Application description. */
    public __description__: string = "A XyPriss application";
    /** Map of application-specific URLs. */
    public __app_urls__: Record<string, string> = {};
    /** Application name (slug). */
    public __name__: string = "xypriss-app";
    /** Application alias. */
    public __alias__: string = "app";
    /** Primary listening port (number). */
    public __port__: number = 3000;
    /** Primary listening port (mirror). */
    public __PORT__: number = 3000;
    /** Current environment (development, production, staging, test). */
    public __env__: string = "development";
    /** Project root directory path. */
    public __root__: string = process.cwd();

    /**
     * **Environment Manager**
     *
     * Safer alternative to direct `process.env` access.
     */
    public __ENV__ = {
        /** Set an environment variable. */
        set: (key: string, value: string) => {
            process.env[key] = value;
        },
        /** Get an environment variable with optional default. */
        get: (key: string, defaultValue?: string) => {
            return process.env[key] || defaultValue;
        },
        /** Check if a variable exists. */
        has: (key: string) => {
            return process.env[key] !== undefined;
        },
        /** Delete a variable. */
        delete: (key: string) => {
            delete process.env[key];
        },
        /** Get all variables. */
        all: () => {
            return process.env;
        },
    };

    /** Index signature allowing dynamic property assignment. */
    [key: string]: any;

    /**
     * **Initialize System**
     *
     * Creates the global system instance.
     * Automatically syncs ports and environment settings.
     *
     * @param {Record<string, any>} [data] - Initial configuration data.
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
     * Handles specific logic like port synchronization (`__port__` <-> `__PORT__`).
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
        if (data.__env !== undefined) this.__env__ = data.__env;
    }

    /**
     * **Add Custom Variable**
     *
     * Adds a custom property to the system object.
     *
     * @param {string} key - Property name.
     * @param {any} value - Value.
     */
    public $add(key: string, value: any): void {
        this[key] = value;
    }

    /**
     * **Remove Variable**
     *
     * Removes a property from the system object.
     *
     * @param {string} key - Property name.
     * @returns {boolean} True if removed.
     */
    public $remove(key: string): boolean {
        if (this.$has(key)) {
            delete this[key];
            return true;
        }
        return false;
    }

    /**
     * **Serialize to JSON**
     *
     * Returns a plain JSON representation of the system configuration.
     * Excludes methods, internal prefixes (`$`), and the `fs/sys/path` properties.
     *
     * @returns {Record<string, any>} Clean JSON object.
     */
    public $toJSON(): Record<string, any> {
        const json: Record<string, any> = {};
        for (const key in this) {
            if (
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__ENV__" &&
                !["fs", "sys", "path"].includes(key)
            ) {
                json[key] = this[key];
            }
        }
        return json;
    }

    // =========================================================================
    // ENVIRONMENT CHECKS
    // =========================================================================

    public $isProduction = () => this.__env__ === "production";
    public $isDevelopment = () => this.__env__ === "development";
    public $isStaging = () => this.__env__ === "staging";
    public $isTest = () => this.__env__ === "test";
    public $isEnvironment = (envName: string) => this.__env__ === envName;

    /**
     * **Get Value**
     *
     * Safely retrieves a value by key.
     */
    public $get<T = any>(key: string, defaultValue?: T): T {
        return (this[key] !== undefined ? this[key] : defaultValue) as T;
    }

    /**
     * **Check Key Existence**
     */
    public $has(key: string): boolean {
        return this[key] !== undefined;
    }

    /**
     * **List Configuration Keys**
     *
     * Returns all configuration keys (excluding methods and internal props).
     */
    public $keys(): string[] {
        return Object.keys(this).filter(
            (key) =>
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__ENV__" &&
                !["fs", "sys", "path"].includes(key)
        );
    }

    /**
     * **Reset System State**
     *
     * Resets all configuration to defaults.
     * **Warning:** Does not reset the `__root__` or `__ENV__` manager logic.
     */
    public $reset(): void {
        const envManager = this.__ENV__;
        Object.keys(this).forEach((key) => {
            if (
                key !== "__ENV__" &&
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
        this.__env__ = "development";
        this.__root__ = process.cwd();
        this.__ENV__ = envManager;
    }

    /**
     * **Clone System**
     *
     * Creates a deep copy of the current system configuration.
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
            __env__: process.env["NODE_ENV"] || "development",
        });
}

export const __sys__ = (globalThis as any).__sys__ as XyPrissSys;
