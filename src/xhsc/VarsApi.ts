import { BaseApi } from "./PathApi";
import {
    getCallerProjectRoot,
    getVerifiedCallerInfo,
    captureNativeFrames,
    isEngineCorePath,
    extractPackageNameFromPath,
    _StringIncludes,
    _StringReplace,
    _StringStartsWith,
    _StringEndsWith,
} from "../utils/ProjectDiscovery";
import { _JSONParse, _JSONStringify } from "../utils/CorePathCheck";

/**
 * System keys that cannot be modified, updated, or deleted by user code or plugins.
 * Only internal engine core components can write to these keys.
 *
 * @internal
 * @see XSA-VARS-002
 */
const PROTECTED_SYSTEM_KEYS = new Set([
    "pluginPermissions",
    "__engine__",
    "__sys__",
]);

function isProtectedKey(key: string): boolean {
    return (
        PROTECTED_SYSTEM_KEYS.has(key) ||
        _StringStartsWith(key, "__sys") ||
        _StringStartsWith(key, "sys.")
    );
}

function deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
        deepFreeze((obj as any)[key]);
    }
    return obj;
}

function isCallerEngineCore(): boolean {
    const frames = captureNativeFrames();
    for (let i = 0; i < frames.length; i++) {
        const { filePath, fnName, isEval } = frames[i];
        if (isEval) return false;
        if (!filePath) continue;
        if (
            _StringStartsWith(filePath, "node:") ||
            _StringStartsWith(filePath, "bun:") ||
            filePath === "native" ||
            _StringIncludes(filePath, "[eval]") ||
            _StringIncludes(filePath, "[vm]")
        ) {
            continue;
        }
        const normalized = _StringReplace(filePath, /\\/g, "/");
        if (
            fnName === "captureNativeFrames" ||
            fnName === "isCallerEngineCore" ||
            _StringEndsWith(normalized, "/src/xhsc/VarsApi.ts") ||
            _StringEndsWith(normalized, "/dist/xhsc/VarsApi.js")
        ) {
            continue;
        }
        return isEngineCorePath(normalized);
    }
    return false;
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
 * @see XSA-XESS-027 Hardened with native ES private fields against prototype hooking
 */
export class VarsApi extends BaseApi {
    #vars: Map<string, any> = new Map();

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
        const pkg = extractPackageNameFromPath(caller.callerFile);

        // System-critical variables (e.g. pluginPermissions) are strictly reserved to engine core
        if (isProtectedKey(key)) {
            if (isCallerEngineCore()) {
                const raw = this.#vars.get(key);
                if (!raw) return defaultValue;
                try {
                    return deepFreeze(structuredClone(raw));
                } catch {
                    return deepFreeze(_JSONParse(_JSONStringify(raw)));
                }
            }
            return defaultValue;
        }

        if (caller.isUntrusted) {
            return defaultValue;
        }

        // For third-party callers in node_modules, do not expose host variables.
        // Third-party packages only access their own scoped variables.
        if (pkg !== null) {
            return defaultValue !== undefined
                ? defaultValue
                : key === "servers"
                  ? {}
                  : defaultValue;
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
        const vars = this.#vars;
        return vars.has(key) ? vars.get(key) : defaultValue;
    }

    /**
     * **Set Variable**
     *
     * Sets or updates a dynamic variable.
     * Denied for untrusted third-party callers in `node_modules`.
     * System-critical variables (e.g. `pluginPermissions`) are strictly restricted to engine core.
     *
     * @see XSA-VARS-001
     * @see XSA-VARS-002 Protected system keys
     * @param {string} key - The variable name.
     * @param {any} value - The value to store.
     * @returns {void}
     */
    public set(key: string, value: any): void {
        const caller = getVerifiedCallerInfo();
        const pkg = extractPackageNameFromPath(caller.callerFile);

        if (caller.isUntrusted || pkg !== null) {
            console.error(
                `\x1b[31m[XyPriss Security] PERMISSION DENIED: Third-party dependency '${pkg || "unknown"}' is not authorized to set variable '${key}'. Blocked.\x1b[0m`,
            );
            return;
        }

        if (isProtectedKey(key)) {
            if (!isCallerEngineCore()) {
                console.error(
                    `\x1b[31m[XyPriss Security] PERMISSION DENIED: Unauthorized modification of protected system variable '${key}' blocked. Only internal engine components can modify system variables.\x1b[0m`,
                );
                return;
            }
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
        this.#vars.set(key, value);
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
        return key in this || this.#vars.has(key);
    }

    /**
     * **Remove Variable**
     *
     * @see XSA-VARS-001
     * @see XSA-VARS-002 Protected system keys
     * @param {string} key - The variable name.
     */
    public delete(key: string): void {
        const caller = getVerifiedCallerInfo();
        const pkg = extractPackageNameFromPath(caller.callerFile);
        if (caller.isUntrusted || pkg !== null) {
            return;
        }

        if (isProtectedKey(key)) {
            if (!isCallerEngineCore()) {
                console.error(
                    `\x1b[31m[XyPriss Security] PERMISSION DENIED: Unauthorized deletion of protected system variable '${key}' blocked.\x1b[0m`,
                );
                return;
            }
        }
        this.#vars.delete(key);
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
        const pkg = extractPackageNameFromPath(caller.callerFile);
        if (caller.isUntrusted || pkg !== null) {
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
        const pkg = extractPackageNameFromPath(caller.callerFile);
        if (caller.isUntrusted || pkg !== null) {
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
        return Array.from(new Set([...explicitKeys, ...this.#vars.keys()]));
    }

    /**
     * **Get All Variables**
     *
     * @see XSA-VARS-001
     */
    public all(): Record<string, any> {
        const caller = getVerifiedCallerInfo();
        const pkg = extractPackageNameFromPath(caller.callerFile);
        if (caller.isUntrusted || pkg !== null) {
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
        if (!isCallerEngineCore()) {
            console.error(
                `\x1b[31m[XyPriss Security] PERMISSION DENIED: Unauthorized attempt to clear system variables blocked.\x1b[0m`,
            );
            return;
        }
        this.#vars.clear();
    }
}

