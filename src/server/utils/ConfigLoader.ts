import * as fs from "fs";
import * as path from "path";
import { logger } from "../../../shared/logger/Logger";
import { XyPrissFS } from "../../sys/FileSystem";

/**
 * XyPriss Configuration Loader
 *
 * Automatically loads configuration from xypriss.config.json
 * This loader identifies the project root and applies system variables to the global __sys__ object.
 */
export class ConfigLoader {
    private metaExecuted = false;

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
     * Load xypriss.config.json and apply __sys__ configuration
     */
    public loadAndApplySysConfig(): void {
        let currentDir = process.cwd();
        const filesystemRoot = path.parse(currentDir).root;
        let configPath = "";
        let configFound = false;
        let configRoot = "";

        // Search upwards for xypriss.config.json
        while (currentDir !== filesystemRoot) {
            const potentialPath = path.join(currentDir, "xypriss.config.json");
            if (fs.existsSync(potentialPath)) {
                configPath = potentialPath;
                configRoot = currentDir;
                configFound = true;
                break;
            }
            currentDir = path.dirname(currentDir);
        }

        // If no config found, fallback to project root for meta execution
        const root = configFound
            ? configRoot
            : this.findProjectRoot(process.cwd());

        console.log("debug:: root path: ", root);

        // Default meta search from the identified root
        this.executeMetaConfig(root);

        console.log("debug:: found config: ", configFound);
        console.log("debug:: config toot path: ", configRoot);

        if (configFound) {
            try {
                const content = fs.readFileSync(configPath, "utf-8");
                const config = JSON.parse(content);

                if (config) {
                    // Apply __sys__ config if present
                    if (config.__sys__) {
                        if (
                            typeof globalThis !== "undefined" &&
                            (globalThis as any).__sys__
                        ) {
                            (globalThis as any).__sys__.$update(config.__sys__);
                        }
                    }

                    // Process $internal configuration
                    if (config.$internal) {
                        this.processInternalConfig(config.$internal, root);
                    }
                }
            } catch (error: any) {
                logger.warn(
                    "server",
                    `Failed to load or parse xypriss.config.json: ${error.message}`
                );
            }
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
     * @param {string} root - The project root directory used for path resolution.
     * @private
     */
    private processInternalConfig(internalConfig: any, root: string): void {
        const sys = (globalThis as any).__sys__;
        if (!sys) return;

        for (const sysName in internalConfig) {
            const config = internalConfig[sysName];

            // 1. Setup specialized FileSystem if __xfs__ is present
            if (config.__xfs__ && config.__xfs__.path) {
                const fsPath = config.__xfs__.path.replace(
                    /(?:#\s*\$|\$\s*#)\s*/g,
                    root
                );
                const resolvedFsPath = path.resolve(root, fsPath);

                const specializedFS = new XyPrissFS({
                    __root__: resolvedFsPath,
                });
                sys.$add(sysName, specializedFS);

                // Add alias for $plug / $plg
                if (sysName === "$plug") sys.$add("$plg", specializedFS);
                if (sysName === "$plg") sys.$add("$plug", specializedFS);

                logger.debug(
                    "server",
                    `Specialized filesystem mapped: ${sysName} -> ${resolvedFsPath}`
                );
            }

            // 2. Execute additional meta logic if __meta__ is present
            if (config.__meta__ && config.__meta__.path) {
                const metaPath = config.__meta__.path.replace(
                    /(?:#\s*\$|\$\s*#)\s*/g,
                    root
                );
                const resolvedMetaPath = path.resolve(root, metaPath);

                // If it's a directory, search for meta files inside it
                if (fs.existsSync(resolvedMetaPath)) {
                    if (fs.statSync(resolvedMetaPath).isDirectory()) {
                        this.executeMetaConfig(resolvedMetaPath);
                    } else {
                        // If it's a file, execute it directly
                        this.runMetaFile(resolvedMetaPath);
                    }
                } else {
                    logger.warn(
                        "server",
                        `Meta path not found: ${resolvedMetaPath}`
                    );
                }
            }
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
}

export const configLoader = new ConfigLoader();



