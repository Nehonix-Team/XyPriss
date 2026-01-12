import { XyPrissFS } from "./sys/System";
import type fs from "node:fs";

/**
 * XyPriss System Variables Class
 *
 * Provides centralized access to system variables, configuration management,
 * and environment utilities for XyPriss applications. This class serves as
 * a type-safe wrapper around system configuration with built-in helpers
 * for common operations.
 *
 * @class XyPrissSys
 * @version 2.0.
 */
export interface XyPrissSys extends XyPrissFS {
    /**
     * Specialized workspace filesystem instance.
     *
     * This property provides a scoped FileSystem API for a specific project directory
     * (e.g., a plugin's internal workspace). It is automatically initialized via the
     * `$internal` configuration in `xypriss.config.json`.
     *
     * @type {XyPrissFS | undefined}
     * @example
     * ```typescript
     * // List directories in the plugin-specific workspace
     * const dirs = __sys__.$plug?.$lsDirs(".");
     * ```
     */
    $plug?: XyPrissFS;

    /**
     * Alias for `$plug` (Plugin Workspace).
     * @type {XyPrissFS | undefined}
     */
    $plg?: XyPrissFS;
}
export class XyPrissSys {
    /**
     * Specialized workspace filesystem instance.
     *
     * Populated via `$internal` configuration. Allows plugins and internal modules
     * to operate within a restricted directory scope using the standard FileSystem API.
     *
     * @public
     * @type {XyPrissFS | undefined}
     */
    public $plug?: XyPrissFS;

    /**
     * Alias for `$plug` (Plugin Workspace).
     * @public
     * @type {XyPrissFS | undefined}
     */
    public $plg?: XyPrissFS;

    /**
     * Application version string following semantic versioning.
     *
     * @type {string}
     * @default "0.0.0"
     *
     * @example
     * ```typescript
     * __sys____version__ = "1.2.3";
     * console.log(`App version: ${__sys____version__}`);
     * ```
     */
    public __version__: string = "0.0.0";

    /**
     * Application author or maintainer name.
     *
     * @type {string}
     * @default "unknown"
     *
     * @example
     * ```typescript
     * __sys____author__ = "Jane Smith";
     * ```
     */
    public __author__: string = "unknown";

    /**
     * Application description.
     *
     * @type {string}
     * @default "A XyPriss application"
     *
     * @example
     * ```typescript
     * __sys____description__ = "My awesome xypriss application description";
     * ```
     */
    public __description__: string = "A XyPriss application";

    /**
     * Collection of application URLs for various environments or services.
     * Useful for storing API endpoints, frontend URLs, or external service links.
     *
     * @type {Record<string, string>}
     * @default {}
     *
     * @example
     * ```typescript
     * __sys____app_urls__ = {
     *   api: "https://api.example.com",
     *   frontend: "https://app.example.com",
     *   docs: "https://docs.example.com"
     * };
     *
     * const apiUrl = __sys____app_urls__.api;
     * ```
     */
    public __app_urls__: Record<string, string> = {};

    /**
     * Application name identifier.
     *
     * @type {string}
     * @default "xypriss-app"
     *
     * @example
     * ```typescript
     * __sys____name__ = "my-awesome-app";
     * ```
     */
    public __name__: string = "xypriss-app";

    /**
     * Application alias or short name.
     * Used for abbreviated references or CLI commands.
     *
     * @type {string}
     * @default "app"
     *
     * @example
     * ```typescript
     * __sys____alias__ = "myapp";
     * ```
     */
    public __alias__: string = "app";

    /**
     * Server port number (lowercase variant).
     * Synchronized automatically with __PORT__.
     *
     * @type {number}
     * @default 3000
     *
     * @example
     * ```typescript
     * __sys____port__ = 8080;
     * console.log(__sys____PORT__); // Also 8080 (auto-synced)
     * ```
     */
    public __port__: number = 3000;

    /**
     * Server port number (uppercase variant).
     * Synchronized automatically with __port__.
     *
     * @type {number}
     * @default 3000
     *
     * @example
     * ```typescript
     * __sys____PORT__ = 5000;
     * console.log(__sys____port__); // Also 5000 (auto-synced)
     * ```
     */
    public __PORT__: number = 3000;

    /**
     * Current environment mode.
     * Typically "development", "production", "staging", or "test".
     *
     * @type {string}
     * @default "development"
     *
     * @example
     * ```typescript
     * __sys____env__ = "production";
     * if (__sys__$isProduction()) {
     *   // Production-specific logic
     * }
     * ```
     */
    public __env__: string = "development";

    /**
     * Project root directory used for resolving relative paths.
     * Defaults to the current working directory.
     *
     * @type {string}
     * @default process.cwd()
     *
     * @example
     * ```typescript
     * __sys____root__ = "/path/to/project";
     * ```
     */
    public __root__: string = process.cwd();

    /**
     * Internal File System API instance.
     * @private
     */
    private _fs: XyPrissFS;

    /**
     * Environment variables manager providing access to process.env.
     * Offers a clean API for getting, setting, and managing environment variables.
     *
     * @type {Object}
     * @property {Function} set - Set an environment variable
     * @property {Function} get - Get an environment variable with optional default
     * @property {Function} has - Check if an environment variable exists
     * @property {Function} delete - Remove an environment variable
     * @property {Function} all - Get all environment variables
     *
     * @example
     * ```typescript
     * // Set environment variable
     * __sys____ENV__.set('API_KEY', 'secret123');
     *
     * // Get with default
     * const apiKey = __sys____ENV__.get('API_KEY', 'default-key');
     *
     * // Check existence
     * if (__sys____ENV__.has('DATABASE_URL')) {
     *   const dbUrl = __sys____ENV__.get('DATABASE_URL');
     * }
     *
     * // Delete variable
     * __sys____ENV__.delete('TEMP_VAR');
     *
     * // Get all variables
     * const allEnv = __sys____ENV__.all();
     * ```
     */
    public __ENV__ = {
        /**
         * Set an environment variable.
         *
         * @param {string} key - The environment variable name
         * @param {string} value - The value to set
         * @returns {void}
         */
        set: (key: string, value: string): void => {
            process.env[key] = value;
        },

        /**
         * Get an environment variable with an optional default value.
         *
         * @param {string} key - The environment variable name
         * @param {string} [defaultValue] - Default value if variable is not set
         * @returns {string | undefined} The environment variable value or default
         */
        get: (key: string, defaultValue?: string): string | undefined => {
            return process.env[key] || defaultValue;
        },

        /**
         * Check if an environment variable exists.
         *
         * @param {string} key - The environment variable name
         * @returns {boolean} True if the variable exists
         */
        has: (key: string): boolean => {
            return process.env[key] !== undefined;
        },

        /**
         * Delete an environment variable.
         *
         * @param {string} key - The environment variable name
         * @returns {void}
         */
        delete: (key: string): void => {
            delete process.env[key];
        },

        /**
         * Get all environment variables.
         *
         * @returns {NodeJS.ProcessEnv} All environment variables
         */
        all: (): NodeJS.ProcessEnv => {
            return process.env;
        },
    };

    /**
     * Index signature allowing dynamic property assignment.
     * Enables flexible extension of system variables at runtime.
     *
     * @example
     * ```typescript
     * sys['customProperty'] = 'custom value';
     * __sys__$add('anotherProperty', 123);
     * ```
     */
    [key: string]: any;

    /**
     * Creates a new XyPrissSys instance with optional initial data.
     * All port-related properties are automatically synchronized.
     *
     * @constructor
     * @param {Record<string, any>} [data={}] - Initial system variable data
     *
     * @example
     * ```typescript
     * // Create with defaults
     * const sys = new XyPrissSys();
     *
     * // Create with custom data
     * const sys = new XyPrissSys({
     *   __version__: "2.0.0",
     *   __author__: "Development Team",
     *   __port__: 8080,
     *   __env__: "production",
     *   customVar: "custom value"
     * });
     * ```
     */
    constructor(data: Record<string, any> = {}) {
        this._fs = new XyPrissFS(this);
        this.$update(data);

        // Return a Proxy to delegate unknown property/method access to _fs
        return new Proxy(this, {
            get: (target, prop, receiver) => {
                // If the property exists on XyPrissSys, return it
                if (Reflect.has(target, prop)) {
                    return Reflect.get(target, prop, receiver);
                }

                // Otherwise, check if it exists on XyPrissFS
                const fsValue = Reflect.get(target._fs, prop);
                if (typeof fsValue === "function") {
                    // Bind functions to the _fs instance
                    return fsValue.bind(target._fs);
                }

                return fsValue;
            },
        });
    }

    /**
     * Update system variables with new data.
     * Automatically synchronizes __port__ and __PORT__ to maintain consistency.
     * Supports backward compatibility for legacy single-underscore variants.
     *
     * @param {Record<string, any>} data - Partial data to merge into system variables
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__$update({
     *   __version__: "1.5.0",
     *   __port__: 9000,
     *   newFeature: true
     * });
     *
     * // Port is automatically synced
     * console.log(__sys____port__);  // 9000
     * console.log(__sys____PORT__);  // 9000
     * ```
     */
    public $update(data: Record<string, any>): void {
        Object.assign(this, data);

        // Synchronize port variants
        if (data.__port__ !== undefined) this.__PORT__ = data.__port__;
        if (data.__PORT__ !== undefined) this.__port__ = data.__PORT__;

        // Backward compatibility for single underscore
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
     * Add or update a single system variable.
     * Provides a cleaner API for adding individual properties.
     *
     * @param {string} key - Variable name
     * @param {any} value - Variable value (any type)
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__$add('databaseUrl', 'postgresql://localhost:5432/mydb');
     * __sys__$add('maxConnections', 100);
     * __sys__$add('features', { darkMode: true, beta: false });
     *
     * console.log(__sys__databaseUrl);    // 'postgresql://localhost:5432/mydb'
     * console.log(__sys__maxConnections); // 100
     * ```
     */
    public $add(key: string, value: any): void {
        this[key] = value;
    }

    /**
     * Remove a system variable.
     *
     * @param {string} key - Variable name to remove
     * @returns {boolean} True if the variable existed and was removed
     *
     * @example
     * ```typescript
     * __sys__$add('tempVar', 'temporary');
     * console.log(__sys__$has('tempVar')); // true
     *
     * __sys__$remove('tempVar');
     * console.log(__sys__$has('tempVar')); // false
     * ```
     */
    public $remove(key: string): boolean {
        if (this.$has(key)) {
            delete this[key];
            return true;
        }
        return false;
    }

    /**
     * Export all system variables as a plain JavaScript object.
     * Excludes internal methods (starting with $) and the __ENV__ manager.
     * Useful for serialization, logging, or persistence.
     *
     * @returns {Record<string, any>} Plain object containing all system variables
     *
     * @example
     * ```typescript
     * const config = __sys__$toJSON();
     * console.log(JSON.stringify(config, null, 2));
     *
     * // Save to file
     * fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
     *
     * // Send in API response
     * res.json({ system: config });
     * ```
     */
    public $toJSON(): Record<string, any> {
        const json: Record<string, any> = {};
        for (const key in this) {
            if (
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__ENV__"
            ) {
                json[key] = this[key];
            }
        }
        return json;
    }

    /**
     * Check if the current environment is production.
     * Compares __env__ against "production" (case-sensitive).
     *
     * @returns {boolean} True if environment is production
     *
     * @example
     * ```typescript
     * if (__sys__$isProduction()) {
     *   console.log('Running in production mode');
     *   // Enable production optimizations
     *   enableCaching();
     *   disableDebugMode();
     * }
     * ```
     */
    public $isProduction(): boolean {
        return this.__env__ === "production";
    }

    /**
     * Check if the current environment is development.
     * Compares __env__ against "development" (case-sensitive).
     *
     * @returns {boolean} True if environment is development
     *
     * @example
     * ```typescript
     * if (__sys__$isDevelopment()) {
     *   console.log('Running in development mode');
     *   // Enable development features
     *   enableHotReload();
     *   showDebugInfo();
     * }
     * ```
     */
    public $isDevelopment(): boolean {
        return this.__env__ === "development";
    }

    /**
     * Check if the current environment is staging.
     * Compares __env__ against "staging" (case-sensitive).
     *
     * @returns {boolean} True if environment is staging
     *
     * @example
     * ```typescript
     * if (__sys__$isStaging()) {
     *   console.log('Running in staging mode');
     *   // Use staging configurations
     * }
     * ```
     */
    public $isStaging(): boolean {
        return this.__env__ === "staging";
    }

    /**
     * Check if the current environment is test.
     * Compares __env__ against "test" (case-sensitive).
     *
     * @returns {boolean} True if environment is test
     *
     * @example
     * ```typescript
     * if (__sys__$isTest()) {
     *   console.log('Running in test mode');
     *   // Use test database
     *   useTestDatabase();
     * }
     * ```
     */
    public $isTest(): boolean {
        return this.__env__ === "test";
    }

    /**
     * Check if environment matches a custom environment name.
     * Performs case-sensitive comparison.
     *
     * @param {string} envName - Environment name to check against
     * @returns {boolean} True if current environment matches the provided name
     *
     * @example
     * ```typescript
     * if (__sys__$isEnvironment('qa')) {
     *   console.log('Running in QA environment');
     * }
     *
     * if (__sys__$isEnvironment('local')) {
     *   // Local development specific code
     * }
     * ```
     */
    public $isEnvironment(envName: string): boolean {
        return this.__env__ === envName;
    }

    /**
     * Get a system variable with an optional default value.
     * Type-safe retrieval with generic type parameter support.
     *
     * @template T - Expected type of the return value
     * @param {string} key - Variable name to retrieve
     * @param {T} [defaultValue] - Default value if variable doesn't exist
     * @returns {T} The variable value or default value
     *
     * @example
     * ```typescript
     * // Get with type inference
     * const port = __sys__$get<number>('__port__', 3000);
     * const name = __sys__$get<string>('__name__', 'default-app');
     *
     * // Get complex types
     * interface AppConfig {
     *   theme: string;
     *   features: string[];
     * }
     * const config = __sys__$get<AppConfig>('config', {
     *   theme: 'light',
     *   features: []
     * });
     *
     * // Works with undefined variables
     * const missing = __sys__$get('nonexistent', 'fallback'); // 'fallback'
     * ```
     */
    public $get<T = any>(key: string, defaultValue?: T): T {
        return (this[key] !== undefined ? this[key] : defaultValue) as T;
    }

    /**
     * Check if a system variable exists.
     * Returns true even if the value is falsy (null, false, 0, empty string).
     *
     * @param {string} key - Variable name to check
     * @returns {boolean} True if variable exists (even if falsy)
     *
     * @example
     * ```typescript
     * __sys__$add('enabled', false);
     * __sys__$add('count', 0);
     * __sys__$add('name', '');
     *
     * console.log(__sys__$has('enabled')); // true (even though value is false)
     * console.log(__sys__$has('count'));   // true (even though value is 0)
     * console.log(__sys__$has('name'));    // true (even though value is '')
     * console.log(__sys__$has('missing')); // false
     *
     * // Conditional logic
     * if (__sys__$has('apiKey')) {
     *   const apiKey = __sys__$get('apiKey');
     *   initializeAPI(apiKey);
     * }
     * ```
     */
    public $has(key: string): boolean {
        return this[key] !== undefined;
    }

    /**
     * Get all system variable keys.
     * Excludes internal methods and the __ENV__ manager.
     *
     * @returns {string[]} Array of all variable names
     *
     * @example
     * ```typescript
     * const keys = __sys__$keys();
     * console.log(keys); // ['__version__', '__author__', '__port__', ...]
     *
     * // Iterate over all variables
     * keys.forEach(key => {
     *   console.log(`${key}: ${__sys__$get(key)}`);
     * });
     * ```
     */
    public $keys(): string[] {
        return Object.keys(this).filter(
            (key) =>
                !key.startsWith("$") &&
                typeof this[key] !== "function" &&
                key !== "__ENV__"
        );
    }

    /**
     * Reset all system variables to default values.
     * Preserves the __ENV__ manager instance.
     *
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__$add('customVar', 'custom');
     * __sys____version__ = "2.0.0";
     *
     * __sys__$reset();
     *
     * console.log(__sys____version__);     // "0.0.0" (default)
     * console.log(__sys__$has('customVar')); // false
     * ```
     */
    public $reset(): void {
        // Store __ENV__ reference
        const envManager = this.__ENV__;

        // Clear all properties
        Object.keys(this).forEach((key) => {
            if (key !== "__ENV__" && !key.startsWith("$")) {
                delete this[key];
            }
        });

        // Restore defaults
        this.__version__ = "0.0.0";
        this.__author__ = "unknown";
        this.__app_urls__ = {};
        this.__name__ = "xypriss-app";
        this.__description__ = "A XyPriss application";
        this.__alias__ = "app";
        this.__port__ = 3000;
        this.__PORT__ = 3000;
        this.__env__ = "development";
        this.__ENV__ = envManager;
    }

    /**
     * Clone the current system configuration.
     * Creates a new instance with the same variable values.
     *
     * @returns {XyPrissSys} New instance with cloned values
     *
     * @example
     * ```typescript
     * const sys1 = new XyPrissSys({ __version__: "1.0.0" });
     * const sys2 = sys1.$clone();
     *
     * sys2.__version__ = "2.0.0";
     *
     * console.log(sys1.__version__); // "1.0.0" (unchanged)
     * console.log(sys2.__version__); // "2.0.0"
     * ```
     */
    public $clone(): XyPrissSys {
        return new XyPrissSys(this.$toJSON());
    }
}

// Self-register global __sys__ if in a global environment
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

/**
 * Default instance for easy access
 */
export const __sys__ = (globalThis as any).__sys__ as XyPrissSys;

