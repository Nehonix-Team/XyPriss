/**
 * XyPriss Configuration Loader
 *
 * Automatically loads configuration from external files (TypeScript or JSON)
 * Supports xypriss.config.ts, xypriss.config.js, and xypriss.config.json files
 *
 * @fileoverview Configuration loader for external config files
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 */

import { ServerOptions } from "../ServerFactory";
import * as fs from "fs";
import * as path from "path";

/**
 * Configuration file names to search for (in order of preference)
 */
const CONFIG_FILES = [
  "xypriss.config.ts",
  "xypriss.config.js",
  "xypriss.config.json",
  "xypriss.config.cjs",
  "xypriss.config.mjs",
];

/**
 * Configuration loader class
 * Handles loading and validation of external configuration files
 */
export class ConfigLoader {
  /**
   * Load configuration from external files (synchronous - JSON only)
   *
   * Searches for JSON configuration files in the current working directory
   * and loads the first one found. This is a synchronous version for use in constructors.
   *
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Loaded configuration or null if no config found
   *
   * @example
   * ```typescript
   * const configLoader = new ConfigLoader();
   * const config = configLoader.loadConfigSync();
   * if (config) {
   *   console.log("Loaded config from:", config._source);
   * }
   * ```
   */
  loadConfigSync(cwd: string = process.cwd()): ServerOptions | null {
    // Only load JSON files synchronously for constructor use
    const jsonConfigPath = path.resolve(cwd, "xypriss.config.json");

    if (fs.existsSync(jsonConfigPath)) {
      try {
        const config = this.loadJsonConfig(jsonConfigPath);
        if (config && typeof config === "object") {
          // Add source information for debugging
          (config as any)._source = jsonConfigPath;
          return config as ServerOptions;
        }
      } catch (error) {
        // Silently fail in constructor - config loading errors should not break initialization
        console.warn(`Warning: Failed to load JSON config from ${jsonConfigPath}:`, error);
      }
    }

    return null;
  }

  /**
   * Load configuration from external files (asynchronous)
   *
   * Searches for configuration files in the current working directory
   * and loads the first one found. Supports TypeScript, JavaScript, and JSON files.
   *
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Promise resolving to loaded configuration or null if no config found
   *
   * @example
   * ```typescript
   * const configLoader = new ConfigLoader();
   * const config = await configLoader.loadConfig();
   * if (config) {
   *   console.log("Loaded config from:", config._source);
   * }
   * ```
   */
  async loadConfig(cwd: string = process.cwd()): Promise<ServerOptions | null> {
    for (const configFile of CONFIG_FILES) {
      const configPath = path.resolve(cwd, configFile);

      if (fs.existsSync(configPath)) {
        try {
          const config = await this.loadConfigFile(configPath);
          if (config && typeof config === "object") {
            // Add source information for debugging
            (config as any)._source = configPath;
            return config as ServerOptions;
          }
        } catch (error) {
          console.warn(`Warning: Failed to load config from ${configPath}:`, error);
          // Continue to next file instead of failing
        }
      }
    }

    return null; // No configuration file found
  }

  /**
   * Load configuration from a specific file
   *
   * @param configPath - Absolute path to the configuration file
   * @returns Promise resolving to the loaded configuration
   * @private
   */
  private async loadConfigFile(configPath: string): Promise<any> {
    const ext = path.extname(configPath).toLowerCase();

    switch (ext) {
      case ".json":
        return this.loadJsonConfig(configPath);

      case ".js":
      case ".cjs":
        return this.loadJsConfig(configPath);

      case ".mjs":
        return this.loadMjsConfig(configPath);

      case ".ts":
        return this.loadTsConfig(configPath);

      default:
        throw new Error(`Unsupported config file extension: ${ext}`);
    }
  }

  /**
   * Load JSON configuration file
   *
   * @param configPath - Path to JSON config file
   * @returns Parsed JSON configuration
   * @private
   */
  private loadJsonConfig(configPath: string): any {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  }

  /**
   * Load JavaScript configuration file
   *
   * @param configPath - Path to JS config file
   * @returns Configuration object exported by the JS file
   * @private
   */
  private async loadJsConfig(configPath: string): Promise<any> {
    // For CommonJS and ESM files, we need dynamic import which works for both
    try {
      // Use dynamic import which works for both CommonJS and ESM
      const config = await import(configPath);

      // Handle both default export and named exports
      return config.default || config;
    } catch (error) {
      // Fallback to require for CommonJS in environments where dynamic import fails
      try {
        // Clear require cache to allow reloading
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);

        // Handle both default export and module.exports
        return config.default || config;
      } catch (fallbackError) {
        throw new Error(`Failed to load JS config: ${error}. Fallback also failed: ${fallbackError}`);
      }
    }
  }

  /**
   * Load ES Module configuration file
   *
   * @param configPath - Path to MJS config file
   * @returns Configuration object exported by the MJS file
   * @private
   */
  private async loadMjsConfig(configPath: string): Promise<any> {
    // For ES modules, we need dynamic import
    try {
      const config = await import(configPath);
      return config.default || config;
    } catch (error) {
      throw new Error(`Failed to load MJS config: ${error}`);
    }
  }

  /**
   * Load TypeScript configuration file
   *
   * @param configPath - Path to TS config file
   * @returns Configuration object exported by the TS file
   * @private
   */
  private async loadTsConfig(configPath: string): Promise<any> {
    try {
      // First, try to load as JavaScript (if user compiled it)
      const jsPath = configPath.replace(/\.ts$/, ".js");
      if (fs.existsSync(jsPath)) {
        return this.loadJsConfig(jsPath);
      }

      // Try dynamic import directly (works if ts-node or similar is available)
      const config = await import(configPath);
      return config.default || config;
    } catch (error: any) {
      // If direct import fails, try to compile with ts-node if available
      try {
        // Check if ts-node is available
        require.resolve("ts-node");
        // Register ts-node for TypeScript compilation
        require("ts-node/register");

        // Clear require cache and load the TypeScript file
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);

        return config.default || config;
      } catch (tsNodeError) {
        // If ts-node is not available or fails, provide helpful error message
        throw new Error(
          `Failed to load TS config from ${configPath}. ` +
          `Please ensure ts-node is installed (npm install ts-node) or compile to JS first. ` +
          `Original error: ${error.message}`
        );
      }
    }
  }

  /**
   * Validate configuration object
   *
   * Performs basic validation on the loaded configuration
   *
   * @param config - Configuration object to validate
   * @returns True if configuration is valid
   *
   * @example
   * ```typescript
   * const loader = new ConfigLoader();
   * const config = await loader.loadConfig();
   * if (config && loader.validateConfig(config)) {
   *   console.log("Config is valid");
   * }
   * ```
   */
  validateConfig(config: any): boolean {
    // Basic validation - check if it's an object
    if (!config || typeof config !== "object") {
      return false;
    }

    // Check for required structure (at least one valid property)
    const validKeys = [
      "env", "server", "security", "performance", "monitoring",
      "cache", "cluster", "plugins", "requestManagement", "fileUpload"
    ];

    return validKeys.some(key => key in config);
  }

  /**
   * Get list of available configuration files in a directory
   *
   * @param cwd - Directory to search (defaults to process.cwd())
   * @returns Array of available configuration file names
   *
   * @example
   * ```typescript
   * const loader = new ConfigLoader();
   * const files = loader.getAvailableConfigFiles();
   * console.log("Available config files:", files);
   * ```
   */
  getAvailableConfigFiles(cwd: string = process.cwd()): string[] {
    const available: string[] = [];

    for (const configFile of CONFIG_FILES) {
      const configPath = path.resolve(cwd, configFile);
      if (fs.existsSync(configPath)) {
        available.push(configFile);
      }
    }

    return available;
  }
}

/**
 * Default configuration loader instance
 * Can be used directly without creating a new instance
 */
export const configLoader = new ConfigLoader();

/**
 * Convenience function to load configuration
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Promise resolving to loaded configuration or null
 *
 * @example
 * ```typescript
 * import { loadConfig } from "xypriss/config-loader";
 *
 * const config = await loadConfig();
 * if (config) {
 *   const app = createServer(config);
 * }
 * ```
 */
export async function loadConfig(cwd?: string): Promise<ServerOptions | null> {
  return configLoader.loadConfig(cwd);
}
