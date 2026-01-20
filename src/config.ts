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

        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = result[key];

            const isSourceObj =
                sourceValue &&
                typeof sourceValue === "object" &&
                !Array.isArray(sourceValue);
            const isTargetObj =
                targetValue &&
                typeof targetValue === "object" &&
                !Array.isArray(targetValue);

            if (isSourceObj && isTargetObj) {
                // Both are objects, merge them recursively
                if (targetValue === sourceValue) {
                    continue;
                }

                if ((targetValue as any).__isXyPrissImmutable) {
                    // Target is immutable. We must merge recursively into it to trigger traps
                    // and ensure compatibility.
                    ConfigurationManager.deepMerge(targetValue, sourceValue);
                    result[key] = targetValue;
                } else {
                    // Target is plain, merge recursively
                    result[key] = ConfigurationManager.deepMerge(
                        targetValue,
                        sourceValue,
                    ) as any;
                }
            } else if (
                Array.isArray(sourceValue) &&
                Array.isArray(targetValue)
            ) {
                // For arrays, concatenate them to allow additive configuration (e.g., plugins)
                result[key] = [...targetValue, ...sourceValue] as any;
            } else if (sourceValue !== undefined) {
                // Primitive, non-matching types, or target is not an object.

                // If the parent (target) is immutable, try to set it there to trigger trap
                // This will throw if the value is different from the current one.
                if ((target as any).__isXyPrissImmutable) {
                    (target as any)[key] = sourceValue;
                }

                result[key] = sourceValue as any;
            }
        }

        return result;
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

