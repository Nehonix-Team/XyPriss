import { BaseApi } from "./PathApi";
import { getCallerProjectRoot, getVerifiedCallerInfo } from "../utils/ProjectDiscovery";
import { _WeakMapGet, _WeakMapSet } from "../utils/CorePathCheck";

const _varsStore = new WeakMap<VarsApi, Map<string, any>>();

function getVarsMap(api: VarsApi): Map<string, any> {
    let map = _WeakMapGet(_varsStore, api);
    if (!map) {
        map = new Map();
        _WeakMapSet(_varsStore, api, map);
    }
    return map;
}

/**
 * **Dynamic Variables & Configuration API**
 *
 * Provides a managed key-value store for application variables and system metadata.
 * Protected with Zero-Trust Caller Verification against unauthorized third-party dependencies.
 *
 * @see XSA-VARS-001
 * @see XSA-XESS-023
 * @see XSA-FS-002
 */
export class VarsApi extends BaseApi {
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
        return getCallerProjectRoot() as unknown as string;
    }

    constructor(runner: any) {
        super(runner);
        _WeakMapSet(_varsStore, this, new Map());

        // ==========================================
        // ENTERPRISE IMMUTABILITY SHIELD
        // ==========================================
        // Lock __root__ so hackers cannot override it via Object.defineProperty
        Object.defineProperty(this, "__root__", {
            get: () => getCallerProjectRoot() as unknown as string,
            enumerable: true,
            configurable: false,
        });
    }

    /**
     * **Get Variable**
     *
     * Retrieves the value of a dynamic variable.
     * Denied for untrusted third-party callers in `node_modules`.
     *
     * @see XSA-VARS-001
     * @param {string} key - The variable name.
     * @param {any} [defaultValue] - Value to return if key is missing.
     * @returns {any} The variable value or default.
     */
    public get(key: string, defaultValue?: any): any {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return defaultValue;
        }

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
        const vars = getVarsMap(this);
        return vars.has(key) ? vars.get(key) : defaultValue;
    }

    /**
     * **Set Variable**
     *
     * Sets or updates a dynamic variable.
     * Denied for untrusted third-party callers in `node_modules`.
     *
     * @see XSA-VARS-001
     * @param {string} key - The variable name.
     * @param {any} value - The value to store.
     * @returns {void}
     */
    public set(key: string, value: any): void {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return;
        }

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
        getVarsMap(this).set(key, value);
    }

    /**
     * **Check Existence**
     *
     * @see XSA-VARS-001
     * @param {string} key - The variable name.
     * @returns {boolean} True if defined.
     */
    public has(key: string): boolean {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return false;
        }
        return key in this || getVarsMap(this).has(key);
    }

    /**
     * **Remove Variable**
     *
     * @see XSA-VARS-001
     * @param {string} key - The variable name.
     */
    public delete(key: string): void {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return;
        }
        getVarsMap(this).delete(key);
    }

    /**
     * **Update Multiple Variables**
     *
     * Merges a configuration object into the variable store.
     * Denied for untrusted third-party callers.
     *
     * @see XSA-VARS-001
     * @param {Record<string, any>} data - Data to merge.
     */
    public update(data: Record<string, any>): void {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return;
        }
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
     *
     * @see XSA-VARS-001
     */
    public keys(): string[] {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return [];
        }
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
        return Array.from(new Set([...explicitKeys, ...getVarsMap(this).keys()]));
    }

    /**
     * **Get All Variables**
     *
     * @see XSA-VARS-001
     */
    public all(): Record<string, any> {
        const caller = getVerifiedCallerInfo();
        if (caller.isUntrusted) {
            return {};
        }
        const json: Record<string, any> = {};
        for (const key of this.keys()) {
            json[key] = this.get(key);
        }
        return json;
    }

    /**
     * **Serialize to JSON**
     *
     * @see XSA-VARS-001
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
        getVarsMap(this).clear();
    }
}

