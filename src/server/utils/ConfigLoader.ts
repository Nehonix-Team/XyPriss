import * as fs from "fs";
import * as path from "path";
import { logger } from "../../../shared/logger/Logger";
import { XyPrissFS } from "../../sys/System";

/**
 * XyPriss Configuration Loader
 *
 * Automatically loads configuration from xypriss.config.json
 * This loader identifies the project root and applies system variables to the global __sys__ object.
 */
export class ConfigLoader {
    private isConfigApplied = false;
    private executedMetas = new Set<string>();

    /**
     * Find the project root by searching for package.json or node_modules
     * @param startDir - Directory to start searching from
     */
    private findProjectRoot(startDir: string): string {
        let currentDir = path.resolve(startDir);
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            if (
                fs.existsSync(path.join(currentDir, "package.json")) ||
                fs.existsSync(path.join(currentDir, "node_modules"))
            ) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return startDir;
    }

    /**
     * Load all xypriss.config.json files found in the project and apply configurations
     */
    public loadAndApplySysConfig(): void {
        if (this.isConfigApplied) return;
        this.isConfigApplied = true;
        let currentDir = process.cwd();
        const filesystemRoot = path.parse(currentDir).root;
        const configFiles: string[] = [];
        let highestRoot = currentDir;

        // 1. Search upwards to find ALL configs and the highest project root
        while (currentDir !== filesystemRoot) {
            const potentialConfig = path.join(
                currentDir,
                "xypriss.config.json"
            );
            if (fs.existsSync(potentialConfig)) {
                configFiles.push(potentialConfig);
                highestRoot = currentDir;
            }
            if (fs.existsSync(path.join(currentDir, "package.json"))) {
                highestRoot = currentDir;
            }
            currentDir = path.dirname(currentDir);
        }

        const root = highestRoot;

        // 2. Scan for other configs recursively (downwards search from root)
        // This avoids hardcoding directory names like "plugins", "mods", etc.
        this.discoverConfigs(root, configFiles);

        // 3. Process each found configuration
        for (const configPath of configFiles) {
            this.applyConfigFromFile(configPath, root);
        }

        // 4. Final meta search from root if not already handled
        this.executeMetaConfig(root);
    }

    /**
     * Apply configuration from a specific file
     */
    private applyConfigFromFile(configPath: string, projectRoot: string): void {
        const configDir = path.dirname(configPath);
        try {
            if (!fs.existsSync(configPath)) return;

            const content = fs.readFileSync(configPath, "utf-8");
            const config = JSON.parse(content);

            if (!config) return;

            logger.debug(
                "server",
                `Loading configuration: ${path.relative(
                    projectRoot,
                    configPath
                )}`
            );

            // Apply __sys__ config if present
            if (config.__sys__) {
                const sys = (globalThis as any).__sys__;
                if (sys) {
                    sys.$update(config.__sys__);
                }
            }

            // Process $internal configuration
            if (config.$internal) {
                this.processInternalConfig(
                    config.$internal,
                    projectRoot,
                    configDir
                );
            }
        } catch (error: any) {
            logger.warn(
                "server",
                `Failed to load or parse config at ${configPath}: ${error.message}`
            );
        }
    }

    /**
     * Processes the `$internal` configuration block within `xypriss.config.json`.
     *
     * This method dynamically initializes specialized system properties (e.g., `$plug`)
     * by mapping them to dedicated FileSystem instances and isolated meta-configuration
     * logic. This facilitates workspace isolation for plugins and internal tools.
     *
     * @param {any} internalConfig - The internal configuration object from the config file.
     * @param {string} projectRoot - The project root directory used for path resolution.
     * @param {string} configDir - The directory where the configuration file is located.
     * @private
     */
    private processInternalConfig(
        internalConfig: any,
        projectRoot: string,
        configDir: string
    ): void {
        const sys = (globalThis as any).__sys__;
        if (!sys) return;

        for (const sysName in internalConfig) {
            const config = internalConfig[sysName];

            // 1. Setup specialized FileSystem if __xfs__ is present
            if (config.__xfs__ && config.__xfs__.path) {
                const rawPath = config.__xfs__.path;
                const resolvedFsPath = this.resolvePath(
                    rawPath,
                    projectRoot,
                    configDir
                );

                if (resolvedFsPath) {
                    // Runtime validation: Ensure the path exists
                    if (fs.existsSync(resolvedFsPath)) {
                        const specializedFS = new XyPrissFS({
                            __root__: resolvedFsPath,
                        });
                        sys.$add(sysName, specializedFS);

                        // Add alias for $plug / $plg
                        if (sysName === "$plug")
                            sys.$add("$plg", specializedFS);
                        if (sysName === "$plg")
                            sys.$add("$plug", specializedFS);

                        logger.debug(
                            "server",
                            `Specialized filesystem mapped: ${sysName} -> ${resolvedFsPath}`
                        );
                    } else {
                        logger.error(
                            "server",
                            `System Workspace Error: Path for ${sysName} not found: ${resolvedFsPath} (from: ${rawPath})`
                        );
                    }
                } else {
                    logger.error(
                        "server",
                        `Unresolvable __xfs__ path for ${sysName}: ${rawPath}`
                    );
                }
            }

            // 2. Execute additional meta logic if __meta__ is present
            if (config.__meta__ && config.__meta__.path) {
                const rawPath = config.__meta__.path;
                const resolvedMetaPath = this.resolvePath(
                    rawPath,
                    projectRoot,
                    configDir
                );

                if (resolvedMetaPath) {
                    // If it's a directory, search for meta files inside it
                    if (fs.existsSync(resolvedMetaPath)) {
                        if (fs.statSync(resolvedMetaPath).isDirectory()) {
                            this.executeMetaConfig(resolvedMetaPath);
                        } else {
                            // If it's a file, execute it directly
                            this.runMetaFile(resolvedMetaPath);
                        }
                    } else {
                        logger.error(
                            "server",
                            `System Workspace Error: Meta path not found: ${resolvedMetaPath} (from: ${rawPath})`
                        );
                    }
                } else {
                    logger.error(
                        "server",
                        `Unresolvable __meta__ path for ${sysName}: ${rawPath}`
                    );
                }
            }
        }
    }

    /**
     * Resolves a path string into an absolute path.
     * Supports #$ (project root) and relative paths (local configuration).
     */
    private resolvePath(
        rawPath: string,
        projectRoot: string,
        configDir: string
    ): string | null {
        try {
            // Clean up the raw path (spaces around slashes, etc.)
            let cleanedPath = rawPath.replace(/\s*\/\s*/g, "/").trim();

            // Case 1: Project Root Resolution (#$ or $#)
            const rootPlaceholder = /\s*(?:#\s*\$|\$\s*#)\s*/;
            if (rootPlaceholder.test(cleanedPath)) {
                return path.resolve(
                    projectRoot,
                    cleanedPath.replace(rootPlaceholder, "").replace(/^\//, "")
                );
            }

            // Case 2: Local path resolution (absolute or relative)
            if (path.isAbsolute(cleanedPath)) {
                return cleanedPath;
            }

            // Resolve relative to the configuration file directory
            return path.resolve(configDir, cleanedPath);
        } catch (error) {
            return null;
        }
    }

    /**
     * Executes a specific XyPriss meta configuration file.
     *
     * Dynamically imports the specified file and invokes the exported `run()` function.
     * This allows for project-specific or plugin-specific initialization logic.
     *
     * @param {string} metaPath - Absolute path to the meta configuration file (.ts or .js).
     * @private
     */
    private runMetaFile(metaPath: string): void {
        const absolutePath = path.resolve(metaPath);
        if (this.executedMetas.has(absolutePath)) return;
        this.executedMetas.add(absolutePath);

        try {
            import(`file://${metaPath}`)
                .then((module) => {
                    if (module && typeof module.run === "function") {
                        module.run();
                    }
                    logger.debug("server", `Executed meta file: ${metaPath}`);
                })
                .catch((error) => {
                    logger.warn(
                        "server",
                        `Failed to execute meta file ${metaPath}: ${error.message}`
                    );
                });
        } catch (error: any) {
            logger.warn(
                "server",
                `Failed to initiate meta execution ${metaPath}: ${error.message}`
            );
        }
    }

    /**
     * Search for +xypriss.meta.ts or +xypriss.meta.js and execute it
     * @param searchDir - Optional directory to search in, defaults to project root
     */
    private executeMetaConfig(searchDir?: string): void {
        const root = searchDir || this.findProjectRoot(process.cwd());

        const metaFiles = searchDir
            ? [
                  path.join(root, "+xypriss.meta.ts"),
                  path.join(root, "+xypriss.meta.js"),
                  path.join(root, ".meta", "+xypriss.meta.ts"),
                  path.join(root, ".meta", "+xypriss.meta.js"),
              ]
            : [
                  path.join(root, "+xypriss.meta.ts"),
                  path.join(root, "+xypriss.meta.js"),
                  path.join(root, ".private", "+xypriss.meta.ts"),
                  path.join(root, ".private", "+xypriss.meta.js"),
                  path.join(root, ".meta", "+xypriss.meta.js"),
                  path.join(root, ".meta", "+xypriss.meta.ts"),
                  path.join(root, ".xypriss", "+xypriss.meta.ts"),
                  path.join(root, ".xypriss", "+xypriss.meta.js"),
              ];

        for (const metaPath of metaFiles) {
            if (fs.existsSync(metaPath)) {
                this.runMetaFile(metaPath);
                if (!searchDir) return; // For root search, stop after first found. For plugin paths, we might want to continue or be more specific.
            }
        }
    }

    /**
     * Recursively discovers all xypriss.config.json files starting from a directory.
     * Skips common non-project directories (node_modules, dist, etc.) for efficiency.
     *
     * @param dir - The directory to start the search from.
     * @param results - Array to accumulate found configuration paths.
     * @param depth - Current recursion depth (limit to prevent excessive scanning).
     * @private
     */
    private discoverConfigs(
        dir: string,
        results: string[],
        depth: number = 0
    ): void {
        if (depth > 5) return; // Limit depth for performance

        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    // Skip common ignore patterns
                    const ignorePatterns = [
                        "node_modules",
                        "dist",
                        ".git",
                        "target",
                        "out",
                        ".private",
                        ".meta",
                        "temp",
                        "tmp",
                        ".xypriss",
                    ];
                    if (ignorePatterns.includes(item.name)) continue;

                    this.discoverConfigs(fullPath, results, depth + 1);
                } else if (item.name === "xypriss.config.json") {
                    if (!results.includes(fullPath)) {
                        results.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Log error only in debug if needed, otherwise skip inaccessible dirs
        }
    }
}

export const configLoader = new ConfigLoader();

