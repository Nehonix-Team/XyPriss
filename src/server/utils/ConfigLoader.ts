import * as fs from "fs";
import * as path from "path";
import { logger } from "../../shared/logger/Logger";
import { XyPrissFS } from "../../sys/System";
import { __sys__ } from "../../sys";
import { XY_SYS_REGISTER_FS } from "../../sys/api/env/env";

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
            let configFound = false;
            for (const name of [
                "xypriss.config.json",
                "xypriss.config.jsonc",
            ]) {
                const potentialConfig = path.join(currentDir, name);
                if (fs.existsSync(potentialConfig)) {
                    configFiles.push(potentialConfig);
                    configFound = true;
                    highestRoot = currentDir;
                    break; // Prefer the first found config in this directory
                }
            }

            if (fs.existsSync(path.join(currentDir, "package.json"))) {
                highestRoot = currentDir;
            }
            currentDir = path.dirname(currentDir);
        }

        const root = highestRoot;

        // 2. Scan for other configs recursively (downwards search from root)
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

            const rawContent = fs.readFileSync(configPath, "utf-8");
            const cleanContent = this.stripComments(rawContent);
            const rawConfig = JSON.parse(cleanContent);

            // Resolve environment variable references
            const config = this.resolveEnvRefs(rawConfig);

            if (!config) return;

            logger.debug(
                "server",
                `Loading configuration: ${path.relative(
                    projectRoot,
                    configPath,
                )}`,
            );

            // Apply __sys__ config if present
            if (config?.__sys__) {
                if (__sys__) {
                    __sys__.vars.update(config.__sys__);
                }
            }

            // Process internal configuration
            const internal =
                config?.vars?.internal || config?.internal || config?.$internal;
            if (internal) {
                this.processInternalConfig(internal, projectRoot, configDir);
            }
        } catch (error: any) {
            logger.warn(
                "server",
                `Failed to load or parse config at ${configPath}: ${error.message}`,
            );
        }
    }

    /**
     * Processes the internal configuration block.
     * Handle specialized filesystems (plug, plg) and meta logic.
     */
    private processInternalConfig(
        internalConfig: any,
        projectRoot: string,
        configDir: string,
    ): void {
        if (!__sys__) return;

        for (const sysName in internalConfig) {
            const config = internalConfig[sysName];

            // 1. Setup specialized FileSystem if __xfs__ is present
            if (config.__xfs__ && config.__xfs__.path) {
                const rawPath = config.__xfs__.path;
                const resolvedFsPath = this.resolvePath(
                    rawPath,
                    projectRoot,
                    configDir,
                );

                if (resolvedFsPath && fs.existsSync(resolvedFsPath)) {
                    const specializedFS = new XyPrissFS({
                        __root__: resolvedFsPath,
                        __mode__: __sys__.__env__.mode,
                    });

                    __sys__[XY_SYS_REGISTER_FS](sysName, specializedFS);

                    // Handle legacy aliases for plug/plg
                    if (sysName.replace(/^\$/, "") === "plug")
                        __sys__[XY_SYS_REGISTER_FS]("plg", specializedFS);
                    if (sysName.replace(/^\$/, "") === "plg")
                        __sys__[XY_SYS_REGISTER_FS]("plug", specializedFS);

                    logger.debug(
                        "server",
                        `Specialized filesystem mapped: ${sysName} -> ${resolvedFsPath}`,
                    );
                }
            }

            // 2. Execute additional meta logic if __meta__ is present
            if (config.__meta__ && config.__meta__.path) {
                const rawPath = config.__meta__.path;
                const resolvedMetaPath = this.resolvePath(
                    rawPath,
                    projectRoot,
                    configDir,
                );

                if (resolvedMetaPath && fs.existsSync(resolvedMetaPath)) {
                    if (fs.statSync(resolvedMetaPath).isDirectory()) {
                        this.executeMetaConfig(resolvedMetaPath);
                    } else {
                        this.runMetaFile(resolvedMetaPath);
                    }
                }
            }
        }
    }

    /**
     * Resolves a path string into an absolute path.
     */
    private resolvePath(
        rawPath: string,
        projectRoot: string,
        configDir: string,
    ): string | null {
        try {
            let cleanedPath = rawPath.replace(/\s*\/\s*/g, "/").trim();
            const rootPlaceholder = /\s*(?:#\s*\$|\$\s*#)\s*/;
            if (rootPlaceholder.test(cleanedPath)) {
                return path.resolve(
                    projectRoot,
                    cleanedPath.replace(rootPlaceholder, "").replace(/^\//, ""),
                );
            }
            if (path.isAbsolute(cleanedPath)) return cleanedPath;
            return path.resolve(configDir, cleanedPath);
        } catch (error) {
            return null;
        }
    }

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
                        `Failed to execute meta file ${metaPath}: ${error.message}`,
                    );
                });
        } catch (error: any) {
            logger.warn(
                "server",
                `Failed to initiate meta execution ${metaPath}: ${error.message}`,
            );
        }
    }

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
                if (!searchDir) return;
            }
        }
    }

    private discoverConfigs(
        dir: string,
        results: string[],
        depth: number = 0,
    ): void {
        if (depth > 5) return;
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    const ignore = [
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
                    if (ignore.includes(item.name)) continue;
                    this.discoverConfigs(fullPath, results, depth + 1);
                } else if (
                    item.name === "xypriss.config.json" ||
                    item.name === "xypriss.config.jsonc"
                ) {
                    if (!results.includes(fullPath)) results.push(fullPath);
                }
            }
        } catch (error) {}
    }

    private stripComments(content: string): string {
        const noComments = content.replace(
            /("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g,
            (match, group1) => (group1 ? group1 : ""),
        );
        return noComments.replace(
            /("(?:[^"\\]|\\.)*")|,\s*([}\]])/g,
            (match, group1, group2) => (group1 ? group1 : group2),
        );
    }

    private resolveEnvRefs(obj: any): any {
        if (typeof obj === "string") {
            return obj.replace(
                /\$\{env:([\w\d_.-]+)(?:\|([^}]+))?\}/g,
                (match, key, defaultValue) => {
                    return __sys__.__env__.has(key)
                        ? __sys__.__env__.get(key)!
                        : defaultValue !== undefined
                          ? defaultValue
                          : match;
                },
            );
        } else if (Array.isArray(obj)) {
            return obj.map((item) => this.resolveEnvRefs(item));
        } else if (typeof obj === "object" && obj !== null) {
            const resolved: any = {};
            for (const key in obj) {
                resolved[key] = this.resolveEnvRefs(obj[key]);
            }
            return resolved;
        }
        return obj;
    }
}

export const configLoader = new ConfigLoader();

