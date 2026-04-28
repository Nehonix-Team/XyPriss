import * as fs from "fs";
import * as path from "path";
import { logger } from "../../shared/logger/Logger";
import { XyPrissFS } from "../../xhsc/System";
import { __sys__ } from "../../xhsc";
import { XY_XHSC_REGISTER_FS } from "../../xhsc/api/env/env";
import { getCallerProjectRoot } from "../../utils/ProjectDiscovery";

/**
 * XyPriss Configuration Loader
 *
 * Automatically loads configuration from xypriss.config.json
 * This loader identifies the project root and applies system variables to the global __sys__ object.
 */
export class ConfigLoader {
    private isConfigApplied = false;
    private executedMetas = new Set<string>();
    private packageJson: any = null;

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
        const root = getCallerProjectRoot() || __sys__.__root__;
        const configFiles: string[] = [];

        // Only look for config at the absolute project root (preferring .jsonc)
        for (const name of ["xypriss.config.jsonc", "xypriss.config.json"]) {
            const potentialConfig = path.join(root, name);
            if (fs.existsSync(potentialConfig)) {
                configFiles.push(potentialConfig);
                break; // Stop after first match in root
            }
        }

        // Process only the root configuration
        for (const configPath of configFiles) {
            this.applyConfigFromFile(configPath, root);
        }

        // Final meta search from root
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

            // Load package.json if not already loaded
            this.loadPackageJson(projectRoot);

            // Resolve environment and package variable references
            const config = this.resolveRefs(rawConfig);

            if (!config) return;

            logger.debug(
                "server",
                `Loading configuration: ${path.relative(
                    projectRoot,
                    configPath,
                )}`,
            );

            // Apply __sys__ config if present
            if (config?.__vars__) {
                if (__sys__) {
                    __sys__.vars.update(config.__vars__);
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
     * Handle specialized filesystems and meta logic defined by plugin IDs.
     */
    private processInternalConfig(
        internalConfig: any,
        projectRoot: string,
        configDir: string,
    ): void {
        if (!__sys__) return;

        const allPermissions: any[] = [];

        for (const [pluginId, sysConfig] of Object.entries(internalConfig)) {
            const config =
                typeof sysConfig === "string" ? {} : (sysConfig as any);

            if (pluginId) {
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

                        __sys__[XY_XHSC_REGISTER_FS](pluginId, specializedFS);

                        logger.debug(
                            "server",
                            `Specialized filesystem mapped: ${pluginId} -> ${resolvedFsPath} (from: ${rawPath})`,
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

                // 3. Extract plugin permissions
                if (config.permissions) {
                    allPermissions.push({
                        name: pluginId,
                        ...config.permissions,
                    });
                }
            }
        }
        if (allPermissions.length > 0) {
            __sys__.vars.set("pluginPermissions", allPermissions);
            logger.debug(
                "server",
                `Loaded ${allPermissions.length} plugin permission rules from configuration`,
            );
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

            // 1. Project Root Anchors: ROOT://
            const rootMatch = cleanedPath.match(/^ROOT:\/\/(.*)$/i);
            if (rootMatch) {
                return path.resolve(
                    projectRoot,
                    rootMatch[1].replace(/^\//, ""),
                );
            }

            // 2. CWD Anchors: CWD://
            const cwdMatch = cleanedPath.match(/^CWD:\/\/(.*)$/i);
            if (cwdMatch) {
                return path.resolve(
                    process.cwd(),
                    cwdMatch[1].replace(/^\//, ""),
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
        const root = searchDir || this.findProjectRoot(__sys__.__root__);
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

    private loadPackageJson(root: string): void {
        if (this.packageJson) return;
        const pkgPath = path.join(root, "package.json");
        if (fs.existsSync(pkgPath)) {
            try {
                this.packageJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            } catch (error) {
                logger.warn("server", "Failed to parse package.json for configuration resolution");
            }
        }
    }

    private getDeepValue(obj: any, path: string): any {
        if (!obj) return undefined;
        const parts = path.split(".");
        let current = obj;
        for (const part of parts) {
            if (current === null || typeof current !== "object") return undefined;
            current = current[part];
        }
        return current;
    }

    private resolveRefs(obj: any): any {
        if (typeof obj === "string") {
            // 1. Resolve $(env).KEY or &(env).KEY
            let resolved = obj.replace(
                /([\$\&])\(env\)\.([\w\d_.-]+)/g,
                (match, prefix, key) => {
                    if (!__sys__.__env__.has(key)) {
                        throw new Error(
                            `Dynamic configuration error: Environment variable "${key}" not found`,
                        );
                    }
                    return __sys__.__env__.get(key)!;
                },
            );

            // 2. Resolve $(pkg).path or &(pkg).path
            resolved = resolved.replace(
                /([\$\&])\(pkg\)\.([\w\d_.-]+)/g,
                (match, prefix, propPath) => {
                    if (!this.packageJson) return match;
                    const val = this.getDeepValue(this.packageJson, propPath);
                    if (val === undefined) {
                        throw new Error(
                            `Dynamic configuration error: Property "${propPath}" not found in package.json`,
                        );
                    }
                    return String(val);
                },
            );

            return resolved;
        } else if (Array.isArray(obj)) {
            return obj.map((item) => this.resolveRefs(item));
        } else if (typeof obj === "object" && obj !== null) {
            const resolved: any = {};
            for (const key in obj) {
                const resolvedKey = this.resolveRefs(key);
                resolved[resolvedKey] = this.resolveRefs(obj[key]);
            }
            return resolved;
        }
        return obj;
    }

    private resolveEnvRefs(obj: any): any {
        return this.resolveRefs(obj);
    }
}

export const configLoader = new ConfigLoader();

