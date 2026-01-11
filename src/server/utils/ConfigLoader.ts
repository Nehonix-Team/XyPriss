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
        const root = this.findProjectRoot(process.cwd());
        const configPath = path.join(root, "xypriss.config.json");

        // Default meta search
        this.executeMetaConfig();

        if (fs.existsSync(configPath)) {
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
     * Process internal configurations for specialized system instances
     */
    private processInternalConfig(internalConfig: any, root: string): void {
        const sys = (globalThis as any).__sys__;
        if (!sys) return;

        for (const sysName in internalConfig) {
            const config = internalConfig[sysName];

            // 1. Setup specialized FileSystem if __xfs__ is present
            if (config.__xfs__ && config.__xfs__.path) {
                const fsPath = config.__xfs__.path
                    .replace("#$", root)
                    .replace("$#", root);
                const resolvedFsPath = path.resolve(root, fsPath);

                const specializedFS = new XyPrissFS({
                    __root__: resolvedFsPath,
                });
                sys.$add(sysName, specializedFS);
                logger.debug(
                    "server",
                    `Specialized filesystem mapped: ${sysName} -> ${resolvedFsPath}`
                );
            }

            // 2. Execute additional meta logic if __meta__ is present
            if (config.__meta__ && config.__meta__.path) {
                const metaPath = config.__meta__.path
                    .replace("#$", root)
                    .replace("$#", root);
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
     * Run a specific meta file
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

