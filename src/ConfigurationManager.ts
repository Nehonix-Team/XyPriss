import type { ServerOptions } from "./types/types";
import { DEFAULT_OPTIONS } from "./server/const/default";
import { timingSafeEqual } from "crypto";
import { mergeWithDefaults } from "./utils/mergeWithDefaults";
import { WEAK_SECRETS } from "./configs/WEAK_SECRETS";
import { xemsKeyPlaceholder } from "./server/const/xemsKeyPlaceholder";
import { getVerifiedCallerInfo, getPrimaryProjectRoot } from "./utils/ProjectDiscovery";
import { isEngineCorePath } from "./utils/CorePathCheck";

/**
 * Verifies whether the calling code is authorized to access or mutate host server configurations.
 *
 * Security Invariants enforced:
 * 1. Stack frames originating from `<eval>`, `[vm]`, or untrusted origins are strictly denied.
 * 2. Internal XyPriss engine core frames (`<engine-core>` or within `ENGINE_CORE_DIR`) are trusted.
 * 3. Any stack frame traversing through `/node_modules/` (third-party/transitive packages) is denied,
 *    preventing side-channel memory inspection by unverified dependencies.
 * 4. The caller root must match the bootstrapped primary project root (`primaryProjectRoot`).
 *
 * @returns {boolean} true if caller is Engine Core or Primary Host Application
 * @see XSA-CFG-001 Root-Scoped Configuration Sandboxing & Intrinsics Memory Fortification
 * @see XSA-XESS-029 Elimination of Global Configuration Leakage (ES Private Slots & Proxied Global Registry)
 * @see XSA-XESS-024 Caller validation for ConfigurationManager singleton access
 */
function isAuthorizedConfigCaller(): boolean {
    const caller = getVerifiedCallerInfo();
    if (caller.isUntrusted) {
        return false;
    }

    // 1. Engine Core frames are strictly trusted (<engine-core> or canonical core path)
    if (caller.callerFile === "<engine-core>" || isEngineCorePath(caller.callerFile)) {
        return true;
    }

    // 2. Resolve primary host root
    const primaryRoot = getPrimaryProjectRoot();
    if (!primaryRoot) {
        return false;
    }

    // 3. Reject any caller originating from node_modules (transitive/third-party dependencies)
    // even if they reside inside the primary project directory structure.
    const normalizedFile = caller.callerFile.replace(/\\/g, "/");
    if (normalizedFile.includes("/node_modules/")) {
        return false;
    }

    // 4. Authorized if caller root matches primary project root
    return caller.root === primaryRoot;
}

/**
 * Configuration Manager Class
 * Singleton pattern for managing XyPriss configurations
 */

/**
 * XyPriss Configuration Manager
 *
 * Provides a safe way to access and update XyPriss configurations
 * without encountering "cannot access before initialization" errors.
 *
 * This class acts as a singleton configuration store that can be used
 * in modular structures where accessing `app.configs` directly might
 * cause initialization timing issues.
 *
 * **IMPORTANT**: This is the SINGLE SOURCE OF TRUTH for all XyPriss configurations.
 * All components should use `Configs.get()` to access configuration values
 * instead of copying values during initialization.
 *
 * Hardened with native ES private fields (`#config`, `#instance`) to eliminate
 * heap inspection and prototype tampering vulnerabilities.
 *
 * @see XSA-CFG-001 Root-Scoped Configuration Sandboxing & Intrinsics Memory Fortification
 * @see XSA-XESS-029 Elimination of Global Configuration Leakage
 */
class ConfigurationManager {
    static #instance: ConfigurationManager;
    #config: ServerOptions;
    #initialized: boolean = false;

    /**
     * @see XSA-XESS-024 Prevents direct access to server configuration object
     * @see XSA-CFG-001 Root-Scoped Configuration Sandboxing & Intrinsics Memory Fortification
     */
    public get config(): ServerOptions {
        if (!isAuthorizedConfigCaller()) {
            return {} as ServerOptions;
        }
        return this.#config;
    }

    public set config(val: ServerOptions) {
        if (!isAuthorizedConfigCaller()) {
            return;
        }
        this.#config = val;
    }

    /**
     * Private constructor to enforce singleton pattern
     * Initializes with default configuration
     */
    private constructor() {
        // Initialize with default configuration
        this.#config = { ...DEFAULT_OPTIONS };
    }

    private static getOrCreateInstance(): ConfigurationManager {
        if (!ConfigurationManager.#instance) {
            ConfigurationManager.#instance = new ConfigurationManager();
        }
        return ConfigurationManager.#instance;
    }

    /**
     * Get the singleton instance
     * @see XSA-XESS-024 Caller validation for ConfigurationManager singleton access
     * @see XSA-CFG-001 Root-Scoped Configuration Sandboxing
     */
    public static getInstance(): ConfigurationManager {
        if (!isAuthorizedConfigCaller()) {
            return undefined as unknown as ConfigurationManager;
        }
        return ConfigurationManager.getOrCreateInstance();
    }

    /**
     * Set the entire configuration
     * @see XSA-VARS-001 - Enforces caller verification against unauthorized third-party modification
     * @see XSA-CFG-001 - Rejects unauthorized caller mutation
     * @param config - XP Server configuration options
     */
    public static set(config: ServerOptions): void {
        if (!isAuthorizedConfigCaller()) {
            return;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        instance.#config = ConfigurationManager.deepMerge(
            { ...DEFAULT_OPTIONS },
            config,
        );

        // Strict validation for XEMS if persistence is enabled
        ConfigurationManager.validateXemsConfig(instance.#config);
        ConfigurationManager.validateGeneralConfig(instance.#config);

        instance.#initialized = true;
    }

    /**
     * Get a specific configuration section
     * @see XSA-VARS-001 - Denied for untrusted third-party callers
     * @see XSA-CFG-001 - Root-Scoped Configuration Sandboxing (returns undefined for third-party packages)
     * @param key - Configuration key (e.g., 'fileUpload', 'security', 'cache')
     * @returns The configuration value for the specified key
     */
    public static get<K extends keyof ServerOptions>(key: K): ServerOptions[K] {
        if (!isAuthorizedConfigCaller()) {
            return undefined as unknown as ServerOptions[K];
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        const val = instance.#config[key];
        if (typeof val === "object" && val !== null) {
            return (Array.isArray(val) ? [...val] : { ...val }) as ServerOptions[K];
        }
        return val;
    }

    /**
     * Get the entire configuration object
     * @see XSA-VARS-001 - Denied for untrusted third-party callers
     * @see XSA-CFG-001 - Root-Scoped Configuration Sandboxing
     * @returns Complete XyPriss Server Configuration (XPSC)
     */
    public static getAll(): ServerOptions {
        if (!isAuthorizedConfigCaller()) {
            return {} as ServerOptions;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        return { ...instance.#config };
    }

    /**
     * Update a specific XyPriss configuration section (deep merge)
     * @see XSA-VARS-001 - Denied for untrusted third-party callers
     * @see XSA-CFG-001 - Rejects unauthorized caller mutation
     * @param key - Configuration key to update
     * @param value - Partial value to merge with existing configuration
     */
    public static update<K extends keyof ServerOptions>(
        key: K,
        value: Partial<ServerOptions[K]>,
    ): void {
        if (!isAuthorizedConfigCaller()) {
            return;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        const currentValue = instance.#config[key];

        // Deep merge the new value with the existing value
        if (
            typeof currentValue === "object" &&
            currentValue !== null &&
            !Array.isArray(currentValue)
        ) {
            instance.#config[key] = {
                ...currentValue,
                ...value,
            } as ServerOptions[K];
        } else {
            // For non-object values, just replace
            instance.#config[key] = value as ServerOptions[K];
        }

        // Validate XEMS if it was part of the update
        if (key === "server") {
            ConfigurationManager.validateXemsConfig(instance.#config);
        }
    }

    /**
     * Deep merge helper function
     * @param target - Target object
     * @param source - Source object to merge
     * @returns Merged object
     */

    /**
     * Deeply merge two configuration objects
     * @param target - Target object to merge into
     * @param source - Source object to merge from
     * @returns Merged object
     */
    private static deepMerge<T extends Record<string, any>>(
        target: T,
        source: Partial<T>,
    ): T {
        // Create a plain copy of target. If target is a Proxy, this spreads its properties.
        const result = (
            Array.isArray(target) ? [...target] : { ...target }
        ) as T;

        // for (const key in source) {
        //     const sourceValue = source[key];
        //     const targetValue = result[key];

        //     const isSourceObj =
        //         sourceValue &&
        //         typeof sourceValue === "object" &&
        //         !Array.isArray(sourceValue);
        //     const isTargetObj =
        //         targetValue &&
        //         typeof targetValue === "object" &&
        //         !Array.isArray(targetValue);

        //     if (isSourceObj && isTargetObj) {
        //         // Both are objects, merge them recursively
        //         if (targetValue === sourceValue) {
        //             continue;
        //         }

        //         if ((targetValue as any).__isXyPrissImmutable) {
        //             // Target is immutable. We must merge recursively into it to trigger traps
        //             // and ensure compatibility.
        //             ConfigurationManager.deepMerge(targetValue, sourceValue);
        //             result[key] = targetValue;
        //         } else {
        //             // Target is plain, merge recursively
        //             result[key] = ConfigurationManager.deepMerge(
        //                 targetValue,
        //                 sourceValue,
        //             ) as any;
        //         }
        //     } else if (
        //         Array.isArray(sourceValue) &&
        //         Array.isArray(targetValue)
        //     ) {
        //         // For arrays, concatenate them to allow additive configuration (e.g., plugins)
        //         result[key] = [...targetValue, ...sourceValue] as any;
        //     } else if (sourceValue !== undefined) {
        //         // Primitive, non-matching types, or target is not an object.

        //         // If the parent (target) is immutable, try to set it there to trigger trap
        //         // This will throw if the value is different from the current one.
        //         if ((target as any).__isXyPrissImmutable) {
        //             (target as any)[key] = sourceValue;
        //         }

        //         result[key] = sourceValue as any;
        //     }
        // }

        return mergeWithDefaults(target, source);
    }

    /**
     * Merge configuration with existing config (deep merge)
     * @see XSA-VARS-001 - Denied for untrusted third-party callers
     * @see XSA-CFG-001 - Rejects unauthorized caller mutation
     * @param config - Partial configuration to merge
     */
    public static merge(config: Partial<ServerOptions>): void {
        if (!isAuthorizedConfigCaller()) {
            return;
        }

        const instance = ConfigurationManager.getOrCreateInstance();

        // Check if the incoming config is marked as immutable
        const shouldBeImmutable = (config as any)?.__isXyPrissImmutable;

        instance.#config = ConfigurationManager.deepMerge(
            instance.#config,
            config,
        );

        // Strict validation for XEMS
        ConfigurationManager.validateXemsConfig(instance.#config);
        ConfigurationManager.validateGeneralConfig(instance.#config);

        // If it should be immutable, wrap it using the global __const__.vars.make
        if (
            shouldBeImmutable &&
            typeof (globalThis as any).__const__ !== "undefined"
        ) {
            instance.#config = (globalThis as any).__const__.vars.make(
                instance.#config,
                "Configs",
            );
        }

        instance.#initialized = true;
    }

    /**
     * Check if configuration has been initialized
     * @see XSA-CFG-001 - Returns false for untrusted callers
     * @returns true if configuration has been set, false otherwise
     */
    public static isInitialized(): boolean {
        if (!isAuthorizedConfigCaller()) {
            return false;
        }
        const instance = ConfigurationManager.getOrCreateInstance();
        return instance.#initialized;
    }

    /**
     * Reset configuration to empty state
     * Useful for testing or reinitializing
     * @see XSA-CFG-001 - Rejects unauthorized caller mutation
     */
    public static reset(): void {
        if (!isAuthorizedConfigCaller()) {
            return;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        instance.#config = { ...DEFAULT_OPTIONS };
        instance.#initialized = false;
    }

    /**
     * Check if a specific configuration section exists
     * @see XSA-XESS-024 Caller validation for configuration section existence
     * @see XSA-CFG-001 - Returns false for untrusted callers
     * @param key - Configuration key to check
     * @returns true if the configuration section exists
     */
    public static has<K extends keyof ServerOptions>(key: K): boolean {
        if (!isAuthorizedConfigCaller()) {
            return false;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        return key in instance.#config && instance.#config[key] !== undefined;
    }

    /**
     * Get configuration with a default value if not set
     * @see XSA-XESS-024 Caller validation for default config retrieval
     * @see XSA-CFG-001 - Returns default value for untrusted callers
     * @param key - Configuration key
     * @param defaultValue - Default value to return if key doesn't exist
     * @returns Configuration value or default value
     */
    public static getOrDefault<K extends keyof ServerOptions>(
        key: K,
        defaultValue: ServerOptions[K],
    ): ServerOptions[K] {
        if (!isAuthorizedConfigCaller()) {
            return defaultValue;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        return instance.#config[key] ?? defaultValue;
    }

    /**
     * Delete a specific configuration section
     * @see XSA-CFG-001 - Rejects unauthorized caller mutation
     * @param key - Configuration key to delete
     */
    public static delete<K extends keyof ServerOptions>(key: K): void {
        if (!isAuthorizedConfigCaller()) {
            return;
        }

        const instance = ConfigurationManager.getOrCreateInstance();
        delete instance.#config[key];
    }

    /**
     * Validates XEMS configuration strictly
     * @param config - Current server configuration
     * @throws Error if XEMS persistence is enabled but secret is invalid
     */

    /**
     * General configuration validation
     * @param config - Current server configuration
     */
    private static validateGeneralConfig(config: ServerOptions): void {
        // XHSC is mandatory and enabled by default.
        // It cannot be explicitly set to false.
        if (config.server && config.server.xhsc === false) {
            throw new Error(
                "[XSec] XHSC is enabled by default and cannot be disabled.",
            );
        }
    }

    private static validateXemsConfig(config: ServerOptions): void {
        const xems = config.server?.xems;
        if (typeof xems !== "object" || !xems.enable) return;

        const secret = xems.secret;

        if (!secret || typeof secret !== "string") {
            throw new Error(
                "[XyPriss] XEMS Persistence enabled but no secret provided. " +
                    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))\"",
            );
        }

        // 0. Vérification de l'extension du fichier
        if (
            xems?.enable
            // !xems?.persistence?.path?.endsWith(".xems")
        ) {
            if (!xems?.path) {
                throw new Error(
                    `[XyPriss] XEMS Persistence path is required when persistence is enabled.`,
                );
            }
            // if (xems.persistence.path.length > 20) {
            //     throw new Error(
            //         `[XyPriss] XEMS Persistence path too long. Maximum 20 characters allowed.`,
            //     );
            // }
            if (!xems?.path?.endsWith(".xems")) {
                throw new Error(
                    `[XyPriss] XEMS Persistence path must end with ".xems". Got ${xems?.path}`,
                );
            }
        }

        // 1. Longueur exacte en bytes
        // const byteLength = Buffer.byteLength(secret, "utf8");
        // if (byteLength !== 32) {
        //     throw new Error(
        //         `[XyPriss] Secret must be exactly 32 bytes. Got ${byteLength} bytes (${secret.length} chars).`,
        //     );
        // }

        if (
            xemsKeyPlaceholder.toLowerCase().trim() ===
            secret.toLowerCase().trim()
        ) {
            // throw new Error(
            //     "[XyPriss] Secret matches the default placeholder. Generate a real secret key using:\n\n" +
            //         "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))\"\n\n" +
            //         "or using the XyPriss Cipher class (https://xypriss.nehonix.com/docs/security/xsec-m?h=cipher#the-unified-cipher-api)",
            // );

            return;
        }

        // 2. Timing-safe check contre placeholders connus
        const secretBuf = Buffer.from(secret);
        for (const weak of WEAK_SECRETS) {
            const weakBuf = Buffer.from(weak);
            if (
                secretBuf.length === weakBuf.length &&
                timingSafeEqual(secretBuf, weakBuf)
            ) {
                throw new Error(
                    "[XyPriss] Secret matches a known weak secret or placeholder. Generate a real secret key using:\n\n" +
                        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))\"\n\n" +
                        "or using the XyPriss Cipher class (https://xypriss.nehonix.com/docs/security/xsec-m?h=cipher#the-unified-cipher-api)",
                );
            }
        }

        // 3. Entropie de Shannon (bits par caractère)
        const entropy = ConfigurationManager.shannonEntropy(secret);
        if (entropy < 3.5) {
            throw new Error(
                `[XyPriss] Secret entropy too low (${entropy.toFixed(2)} bits/char, minimum 3.5). ` +
                    "Avoid dictionary words, repeated patterns, or predictable sequences.",
            );
        }

        // 4. Détection de patterns répétitifs (ex: "abcabc...", "aaa...")
        if (ConfigurationManager.hasRepetitivePattern(secret)) {
            throw new Error(
                "[XyPriss] Secret contains repetitive patterns. Use a randomly generated key.",
            );
        }

        // 5. Détection de mots du dictionnaire évidents
        const COMMON_WORDS = [
            "secret",
            "password",
            "key",
            "admin",
            "xems",
            "change",
            "secure",
        ];
        const lowerSecret = secret.toLowerCase();
        for (const word of COMMON_WORDS) {
            if (lowerSecret.includes(word)) {
                throw new Error(
                    `[XyPriss] Secret contains a common word ("${word}"). ` +
                        "Use a randomly generated key with no dictionary words.",
                );
            }
        }
    }

    /**
     * Calcule l'entropie de Shannon en bits par caractère
     * Une clé aléatoire de 32 chars ASCII aura ~4.5-5 bits/char
     * "a_very_secret_32_chars_key_12345" aura ~3.2 bits/char → rejeté
     */
    private static shannonEntropy(str: string): number {
        const freq = new Map<string, number>();
        for (const char of str) {
            freq.set(char, (freq.get(char) ?? 0) + 1);
        }
        let entropy = 0;
        for (const count of freq.values()) {
            const p = count / str.length;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    /**
     * Détecte si une string contient un pattern qui se répète
     * ex: "abcdabcdabcdabcdabcdabcdabcdabcd" → true
     */
    private static hasRepetitivePattern(str: string): boolean {
        const len = str.length;
        // Teste les périodes de 2 à len/2
        for (let period = 2; period <= len / 2; period++) {
            if (len % period !== 0) continue;
            const pattern = str.slice(0, period);
            if (pattern.repeat(len / period) === str) return true;
        }
        return false;
    }
}

/**
 * Export as Configs for easier usage
 */
export { ConfigurationManager as Configs };
export { ConfigurationManager as CM };

/**
 * Creates a zero-trust Proxy wrapper around ConfigurationManager for globalThis exposure.
 *
 * Security Invariants:
 * - Traps every property lookup: if caller is not authorized, returns `undefined`.
 * - Prevents prototype reflection, `ownKeys` disclosure, and property deletion or overwrites.
 *
 * @see XSA-CFG-001 Root-Scoped Configuration Sandboxing & Intrinsics Memory Fortification
 * @see XSA-XESS-029 Elimination of Global Configuration Leakage (ES Private Slots & Proxied Global Registry)
 */
function createSecuredGlobalCfgProxy(target: typeof ConfigurationManager): typeof ConfigurationManager {
    return new Proxy(target, {
        get(t, prop, receiver) {
            if (!isAuthorizedConfigCaller()) {
                return undefined;
            }
            const val = Reflect.get(t, prop, receiver);
            return typeof val === "function" ? val.bind(t) : val;
        },
        set() {
            return false;
        },
        defineProperty() {
            return false;
        },
        deleteProperty() {
            return false;
        },
        ownKeys() {
            if (!isAuthorizedConfigCaller()) {
                return [];
            }
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(t, prop) {
            if (!isAuthorizedConfigCaller()) {
                return undefined;
            }
            return Reflect.getOwnPropertyDescriptor(t, prop);
        },
    });
}

// Self-register global __cfg__ if in a global environment wrapped with zero-trust Proxy
if (typeof globalThis !== "undefined") {
    (globalThis as any).__cfg__ =
        (globalThis as any).__cfg__ || createSecuredGlobalCfgProxy(ConfigurationManager);
}

/**
 * Default instance for easy access
 */
export const __cfg__ = (typeof globalThis !== "undefined" && (globalThis as any).__cfg__)
    ? (globalThis as any).__cfg__ as typeof ConfigurationManager
    : createSecuredGlobalCfgProxy(ConfigurationManager);


