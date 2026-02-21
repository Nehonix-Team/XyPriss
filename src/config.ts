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
 * @example
 * ```typescript
 * import { Configs } from 'xypriss';
 *
 * // Set configuration
 * Configs.set({
 *   fileUpload: {
 *     enabled: true,
 *     maxFileSize: 5 * 1024 * 1024
 *   }
 * });
 *
 * // Get configuration
 * const fileUploadConfig = Configs.get('fileUpload');
 *
 * // Get entire config
 * const allConfigs = Configs.getAll();
 *
 * // Update specific config (updates the source of truth)
 * Configs.update('fileUpload', { maxFileSize: 10 * 1024 * 1024 });
 * ```
 */

import type { ServerOptions } from "./types/types";
import { DEFAULT_OPTIONS } from "./server/const/default";
import { timingSafeEqual, createHash } from "crypto";
import { mergeWithDefaults } from "./utils/mergeWithDefaults";

/**
 * Configuration Manager Class
 * Singleton pattern for managing XyPriss configurations
 */ 
class ConfigurationManager {
    private static instance: ConfigurationManager;
    private config: ServerOptions;
    private initialized: boolean = false;

    /**
     * Private constructor to enforce singleton pattern
     * Initializes with default configuration
     */
    private constructor() {
        // Initialize with default configuration
        this.config = { ...DEFAULT_OPTIONS };
    }

    /**
     * Get the singleton instance
     */
    private static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * Set the entire configuration
     * @param config - XP Server configuration options
     */
    public static set(config: ServerOptions): void {
        const instance = ConfigurationManager.getInstance();
        instance.config = { ...instance.config, ...config };

        // Strict validation for XEMS if persistence is enabled
        ConfigurationManager.validateXemsConfig(instance.config);

        instance.initialized = true;
    }

    /**
     * Get a specific configuration section
     * @param key - Configuration key (e.g., 'fileUpload', 'security', 'cache')
     * @returns The configuration value for the specified key
     */
    public static get<K extends keyof ServerOptions>(key: K): ServerOptions[K] {
        const instance = ConfigurationManager.getInstance();
        return instance.config[key];
    }

    /**
     * Get the entire configuration object
     * @returns Complete XyPriss Server Configuration (XPSC)
     */
    public static getAll(): ServerOptions {
        const instance = ConfigurationManager.getInstance();
        return { ...instance.config };
    }

    /**
     * Update a specific XyPriss configuration section (deep merge)
     * @param key - Configuration key to update
     * @param value - Partial value to merge with existing configuration
     */
    public static update<K extends keyof ServerOptions>(
        key: K,
        value: Partial<ServerOptions[K]>,
    ): void {
        const instance = ConfigurationManager.getInstance();
        const currentValue = instance.config[key];

        // Deep merge the new value with the existing value
        if (
            typeof currentValue === "object" &&
            currentValue !== null &&
            !Array.isArray(currentValue)
        ) {
            instance.config[key] = {
                ...currentValue,
                ...value,
            } as ServerOptions[K];
        } else {
            // For non-object values, just replace
            instance.config[key] = value as ServerOptions[K];
        }

        // Validate XEMS if it was part of the update
        if (key === "server") {
            ConfigurationManager.validateXemsConfig(instance.config);
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
     * @param config - Partial configuration to merge
     */
    public static merge(config: Partial<ServerOptions>): void {
        const instance = ConfigurationManager.getInstance();

        // Check if the incoming config is marked as immutable
        const shouldBeImmutable = (config as any)?.__isXyPrissImmutable;

        instance.config = ConfigurationManager.deepMerge(
            instance.config,
            config,
        );

        // Strict validation for XEMS
        ConfigurationManager.validateXemsConfig(instance.config);

        // If it should be immutable, wrap it using the global __const__.$make
        if (
            shouldBeImmutable &&
            typeof (globalThis as any).__const__ !== "undefined"
        ) {
            instance.config = (globalThis as any).__const__.$make(
                instance.config,
                "Configs",
            );
        }

        instance.initialized = true;
    }

    /**
     * Check if configuration has been initialized
     * @returns true if configuration has been set, false otherwise
     */
    public static isInitialized(): boolean {
        const instance = ConfigurationManager.getInstance();
        return instance.initialized;
    }

    /**
     * Reset configuration to empty state
     * Useful for testing or reinitializing
     */
    public static reset(): void {
        const instance = ConfigurationManager.getInstance();
        instance.config = {};
        instance.initialized = false;
    }

    /**
     * Check if a specific configuration section exists
     * @param key - Configuration key to check
     * @returns true if the configuration section exists
     */
    public static has<K extends keyof ServerOptions>(key: K): boolean {
        const instance = ConfigurationManager.getInstance();
        return key in instance.config && instance.config[key] !== undefined;
    }

    /**
     * Get configuration with a default value if not set
     * @param key - Configuration key
     * @param defaultValue - Default value to return if key doesn't exist
     * @returns Configuration value or default value
     */
    public static getOrDefault<K extends keyof ServerOptions>(
        key: K,
        defaultValue: ServerOptions[K],
    ): ServerOptions[K] {
        const instance = ConfigurationManager.getInstance();
        return instance.config[key] ?? defaultValue;
    }

    /**
     * Delete a specific configuration section
     * @param key - Configuration key to delete
     */
    public static delete<K extends keyof ServerOptions>(key: K): void {
        const instance = ConfigurationManager.getInstance();
        delete instance.config[key];
    }

    /**
     * Validates XEMS configuration strictly
     * @param config - Current server configuration
     * @throws Error if XEMS persistence is enabled but secret is invalid
     */

    private static validateXemsConfig(config: ServerOptions): void {
        const xems = config.server?.xems;
        if (typeof xems !== "object" || !xems.persistence?.enabled) return;

        const secret = xems.persistence.secret;

        if (!secret || typeof secret !== "string") {
            throw new Error(
                "[XyPriss] XEMS Persistence enabled but no secret provided. " +
                    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))\"",
            );
        }

        // 1. Longueur exacte en bytes
        const byteLength = Buffer.byteLength(secret, "utf8");
        if (byteLength !== 32) {
            throw new Error(
                `[XyPriss] Secret must be exactly 32 bytes. Got ${byteLength} bytes (${secret.length} chars).`,
            );
        }

        // 2. Timing-safe check contre placeholders connus
        const WEAK_SECRETS = [
            "CHANGE_ME_TO_A_SECURE_32_CHAR_KEY",
            "00000000000000000000000000000000",
            "12345678901234567890123456789012",
        ];
        const secretBuf = Buffer.from(secret);
        for (const weak of WEAK_SECRETS) {
            const weakBuf = Buffer.from(weak);
            if (
                secretBuf.length === weakBuf.length &&
                timingSafeEqual(secretBuf, weakBuf)
            ) {
                throw new Error(
                    "[XyPriss] Secret matches a known weak placeholder.",
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

// Self-register global __cfg__ if in a global environment
if (typeof globalThis !== "undefined") {
    (globalThis as any).__cfg__ =
        (globalThis as any).__cfg__ || ConfigurationManager;
}

/**
 * Default instance for easy access
 */
export const __cfg__ = (globalThis as any)
    .__cfg__ as typeof ConfigurationManager;

