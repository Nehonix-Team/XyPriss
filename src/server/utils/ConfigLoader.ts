/**
 * Configuration Loader for XyPrissJS
 * Loads configuration from various sources with priority order
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { ServerOptions } from "../../types/types";

export interface ConfigLoaderOptions {
    configFile?: string;
    searchPaths?: string[];
    allowedExtensions?: string[];
}

export class ConfigLoader {
    private static readonly DEFAULT_CONFIG_FILES = [
        "XyPriss.config.js",
        "XyPriss.config.ts",
        "XyPriss.config.json",
        "XyPriss.config.mjs",
        ".XyPrissrc",
        ".XyPrissrc.json",
        ".XyPrissrc.js",
    ];

    private static readonly DEFAULT_SEARCH_PATHS = [
        process.cwd(),
        join(process.cwd(), "config"),
        join(process.cwd(), ".config"),
    ];

    /**
     * Load configuration from file system
     */
    public static loadConfig(
        options: ConfigLoaderOptions = {}
    ): Partial<ServerOptions> | null {
        const {
            configFile,
            searchPaths = ConfigLoader.DEFAULT_SEARCH_PATHS,
            allowedExtensions = [".js", ".ts", ".json", ".mjs"],
        } = options;

        if (
            configFile &&
            !allowedExtensions.some((ext) => configFile.endsWith(ext))
        ) {
            console.warn(
                `Config file ${configFile} has unsupported extension. Allowed extensions: ${allowedExtensions.join(
                    ", "
                )}`
            );
            return null;
        }

        // If specific config file is provided, try to load it
        if (configFile) {
            const config = ConfigLoader.loadConfigFile(configFile);
            if (config) {
                console.log(`✔Loaded configuration from: ${configFile}`);
                return config;
            }
        }

        // Search for config files in search paths
        for (const searchPath of searchPaths) {
            for (const configFileName of ConfigLoader.DEFAULT_CONFIG_FILES) {
                const configPath = join(searchPath, configFileName);

                if (existsSync(configPath)) {
                    const config = ConfigLoader.loadConfigFile(configPath);
                    if (config) {
                        console.log(
                            `✔Loaded configuration from: ${configPath}`
                        );
                        return config;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Load configuration from a specific file
     */
    private static loadConfigFile(
        filePath: string
    ): Partial<ServerOptions> | null {
        try {
            if (!existsSync(filePath)) {
                return null;
            }

            const ext = filePath.split(".").pop()?.toLowerCase();

            switch (ext) {
                case "json":
                    return ConfigLoader.loadJsonConfig(filePath);

                case "js":
                case "mjs":
                    return ConfigLoader.loadJsConfig(filePath);

                case "ts":
                    return ConfigLoader.loadTsConfig(filePath);

                default:
                    // Try to parse as JSON for .XyPrissrc files
                    return ConfigLoader.loadJsonConfig(filePath);
            }
        } catch (error: any) {
            console.warn(
                ` Failed to load config from ${filePath}: ${error.message}`
            );
            return null;
        }
    }

    /**
     * Load JSON configuration
     */
    private static loadJsonConfig(
        filePath: string
    ): Partial<ServerOptions> | null {
        try {
            const content = readFileSync(filePath, "utf8");
            return JSON.parse(content);
        } catch (error: any) {
            console.warn(
                ` Failed to parse JSON config ${filePath}: ${error.message}`
            );
            return null;
        }
    }

    /**
     * Load JavaScript configuration
     */
    private static loadJsConfig(
        filePath: string
    ): Partial<ServerOptions> | null {
        try {
            // Clear require cache to allow hot reloading
            delete require.cache[require.resolve(filePath)];

            const config = require(filePath);

            // Handle both default export and named export
            return config.default || config;
        } catch (error: any) {
            console.warn(
                ` Failed to load JS config ${filePath}: ${error.message}`
            );
            return null;
        }
    }

    /**
     * Load TypeScript configuration (requires ts-node or similar)
     */
    private static loadTsConfig(
        filePath: string
    ): Partial<ServerOptions> | null {
        try {
            // Try to register TypeScript if not already registered
            try {
                require("ts-node/register");
            } catch {
                // ts-node not available, try tsx
                try {
                    require("tsx/cjs");
                } catch {
                    console.warn(
                        ` TypeScript config found but no TypeScript loader available. Install ts-node or tsx.`
                    );
                    return null;
                }
            }

            // Clear require cache
            delete require.cache[require.resolve(filePath)];

            const config = require(filePath);

            // Handle both default export and named export
            return config.default || config;
        } catch (error: any) {
            console.warn(
                ` Failed to load TS config ${filePath}: ${error.message}`
            );
            return null;
        }
    }

    /**
     * Merge configurations with priority order
     */
    public static mergeConfigs(
        baseConfig: Partial<ServerOptions>,
        ...configs: (Partial<ServerOptions> | null)[]
    ): ServerOptions {
        let merged = { ...baseConfig };

        for (const config of configs) {
            if (config) {
                merged = ConfigLoader.deepMerge(merged, config);
            }
        }

        return merged as ServerOptions;
    }

    /**
     * Deep merge two configuration objects
     */
    private static deepMerge(target: any, source: any): any {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (
                    typeof source[key] === "object" &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof target[key] === "object" &&
                    target[key] !== null &&
                    !Array.isArray(target[key])
                ) {
                    result[key] = ConfigLoader.deepMerge(
                        target[key],
                        source[key]
                    );
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Validate configuration
     */
    public static validateConfig(config: Partial<ServerOptions>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Validate file watcher configuration
        if (config.fileWatcher) {
            const fw = config.fileWatcher;

            if (
                fw.typescript?.runner &&
                typeof fw.typescript.runner !== "string"
            ) {
                errors.push("fileWatcher.typescript.runner must be a string");
            }

            if (
                fw.typescript?.runnerArgs &&
                !Array.isArray(fw.typescript.runnerArgs)
            ) {
                errors.push(
                    "fileWatcher.typescript.runnerArgs must be an array"
                );
            }

            if (fw.extensions && !Array.isArray(fw.extensions)) {
                errors.push("fileWatcher.extensions must be an array");
            }

            if (fw.watchPaths && !Array.isArray(fw.watchPaths)) {
                errors.push("fileWatcher.watchPaths must be an array");
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

