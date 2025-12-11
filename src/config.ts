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
 * // Update specific config
 * Configs.update('fileUpload', { maxFileSize: 10 * 1024 * 1024 });
 * ```
 */

import type { ServerOptions } from "./types/types";

/**
 * Configuration Manager Class
 * Singleton pattern for managing XyPriss configurations
 */
class ConfigurationManager {
    private static instance: ConfigurationManager;
    private config: ServerOptions = {};
    private initialized: boolean = false;

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {}

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
     * @param config - Server configuration options
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
    public static get<K extends keyof ServerOptions>(
        key: K
    ): ServerOptions[K] | undefined {
        const instance = ConfigurationManager.getInstance();
        return instance.config[key];
    }

    /**
     * Get the entire configuration object
     * @returns Complete server configuration
     */
    public static getAll(): ServerOptions {
        const instance = ConfigurationManager.getInstance();
        return { ...instance.config };
    }

    /**
     * Update a specific configuration section
     * @param key - Configuration key to update
     * @param value - New value for the configuration section
     */
    public static update<K extends keyof ServerOptions>(
        key: K,
        value: ServerOptions[K]
    ): void {
        const instance = ConfigurationManager.getInstance();
        instance.config[key] = value;
    }

    /**
     * Merge configuration with existing config
     * @param config - Partial configuration to merge
     */
    public static merge(config: Partial<ServerOptions>): void {
        const instance = ConfigurationManager.getInstance();
        instance.config = {
            ...instance.config,
            ...config,
            // Deep merge for nested objects
            server: { ...instance.config.server, ...config.server },
            cache: { ...instance.config.cache, ...config.cache },
            security: { ...instance.config.security, ...config.security },
            performance: {
                ...instance.config.performance,
                ...config.performance,
            },
            fileUpload: { ...instance.config.fileUpload, ...config.fileUpload },
            monitoring: { ...instance.config.monitoring, ...config.monitoring },
            cluster: { ...instance.config.cluster, ...config.cluster },
            multiServer: {
                ...instance.config.multiServer,
                ...config.multiServer,
            },
            requestManagement: {
                ...instance.config.requestManagement,
                ...config.requestManagement,
            },
        };
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
        defaultValue: ServerOptions[K]
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

