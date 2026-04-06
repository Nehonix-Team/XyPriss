import { BaseApi } from "./PathApi";

/**
 * **Dynamic Variables & Configuration API**
 *
 * Provides a managed key-value store for application variables and system metadata.
 */
export class VarsApi extends BaseApi {
    private vars: Map<string, any> = new Map();

    // Explicit typed properties for IntelliSense
    public __version__: string = "0.0.0";
    public __author__: string = "unknown";
    public __description__: string = "A XyPriss application";
    public __app_urls__: Record<string, string> = {};
    public __name__: string = "xypriss-app";
    public __alias__: string = "app";
    public __port__: number = 3000;
    public __PORT__: number = 3000;
    public get __root__(): string {
        return this.runner.getRoot();
    }

    constructor(runner: any) {
        super(runner);

        // ==========================================
        // ENTERPRISE IMMUTABILITY SHIELD
        // ==========================================
        // Lock __root__ so hackers cannot override it via Object.defineProperty
        Object.defineProperty(this, "__root__", {
            get: () => this.runner.getRoot(),
            enumerable: true,
            configurable: false,
        });
    }

    /**
     * **Get Variable**
     *
     * Retrieves the value of a dynamic variable.
     *
     * @param {string} key - The variable name.
     * @param {any} [defaultValue] - Value to return if key is missing.
     * @returns {any} The variable value or default.
     */
    public get(key: string, defaultValue?: any): any {
        // First check explicit properties
        if (
            key in this &&
            ![
                "__root__",
                "get",
                "set",
                "has",
                "delete",
                "update",
                "keys",
                "all",
                "clear",
                "toJSON",
                "clone",
                "vars",
                "runner",
            ].includes(key)
        ) {
            return (this as any)[key] ?? defaultValue;
        }
        return this.vars.has(key) ? this.vars.get(key) : defaultValue;
    }

    /**
     * **Set Variable**
     *
     * Sets or updates a dynamic variable.
     *
     * @param {string} key - The variable name.
     * @param {any} value - The value to store.
     * @returns {void}
     */
    public set(key: string, value: any): void {
        // Sync with explicit properties if they match
        if (
            key in this &&
            ![
                "__root__",
                "get",
                "set",
                "has",
                "delete",
                "update",
                "keys",
                "all",
                "clear",
                "toJSON",
                "clone",
                "vars",
                "runner",
            ].includes(key)
        ) {
            (this as any)[key] = value;
        }
        this.vars.set(key, value);
    }

    /**
     * **Check Existence**
     *
     * @param {string} key - The variable name.
     * @returns {boolean} True if defined.
     */
    public has(key: string): boolean {
        return key in this || this.vars.has(key);
    }

    /**
     * **Remove Variable**
     *
     * @param {string} key - The variable name.
     */
    public delete(key: string): void {
        this.vars.delete(key);
    }

    /**
     * **Update Multiple Variables**
     *
     * Merges a configuration object into the variable store.
     *
     * @param {Record<string, any>} data - Data to merge.
     */
    public update(data: Record<string, any>): void {
        for (const [key, value] of Object.entries(data)) {
            if (
                !key.startsWith("$") &&
                key !== "__root__" &&
                typeof value !== "function"
            ) {
                this.set(key, value);
            }
        }
    }

    /**
     * **List Keys**
     */
    public keys(): string[] {
        const explicitKeys = [
            "__version__",
            "__author__",
            "__description__",
            "__app_urls__",
            "__name__",
            "__alias__",
            "__port__",
            "__PORT__",
            "__root__",
        ];
        return Array.from(new Set([...explicitKeys, ...this.vars.keys()]));
    }

    /**
     * **Get All Variables**
     */
    public all(): Record<string, any> {
        const json: Record<string, any> = {};
        for (const key of this.keys()) {
            json[key] = this.get(key);
        }
        return json;
    }

    /**
     * **Serialize to JSON**
     */
    public toJSON(): Record<string, any> {
        return this.all();
    }

    /**
     * **Deep Clone**
     */
    public clone(): Record<string, any> {
        return JSON.parse(JSON.stringify(this.all()));
    }

    /**
     * **Clear All**
     */
    public clear(): void {
        this.vars.clear();
    }
}

