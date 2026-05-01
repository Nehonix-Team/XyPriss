import { getSysApi } from "../../plugins/const/getSysApi";
import { logger } from "../../shared/logger/Logger";
import { XyPrissFS } from "../../xhsc/System";
import { __sys__ } from "../../xhsc";
import { XY_XHSC_REGISTER_FS } from "../../xhsc/api/env/env";
import { getCallerProjectRoot } from "../../utils/ProjectDiscovery";
import { ConfigSyntaxParser } from "../../utils/ConfigSyntaxParser";
import { MetaConfigRunner } from "./MetaConfigRunner";

/**
 * XyPriss Configuration Loader
 *
 * Automatically loads configuration from xypriss.config.json
 * This loader identifies the project root and applies system variables to the global __sys__ object.
 */
export class ConfigLoader {
    private isConfigApplied = false;
    private packageJson: any = null;
    private metaRunner = new MetaConfigRunner();
    private sys = getSysApi();

    /**
     * Load all xypriss.config.json files found in the project and apply configurations
     */
    public loadAndApplySysConfig(): void {
        if (this.isConfigApplied) return;
        this.isConfigApplied = true;
        const root = getCallerProjectRoot() || __sys__.__root__;

        logger.debug(
            "server",
            `ConfigLoader: Initializing discovery from root: ${root}`,
        );

        const configFiles: string[] = [];

        // Only look for config at the absolute project root (preferring .jsonc)
        for (const name of ["xypriss.config.jsonc", "xypriss.config.json"]) {
            const potentialConfig = this.sys.path.join(root, name);
            if (this.sys.fs.exist(potentialConfig)) {
                logger.debug(
                    "server",
                    `ConfigLoader: Found configuration file: ${potentialConfig}`,
                );
                configFiles.push(potentialConfig);
                break; // Stop after first match in root
            }
        }

        if (configFiles.length === 0) {
            logger.debug(
                "server",
                `ConfigLoader: No configuration file found in ${root}`,
            );
        }

        // Process only the root configuration
        for (const configPath of configFiles) {
            this.applyConfigFromFile(configPath, root);
        }

        // Final meta search from root
        this.metaRunner.executeMetaConfig(root);
    }

    /**
     * Apply configuration from a specific file
     */
    private applyConfigFromFile(configPath: string, projectRoot: string): void {
        const configDir = this.sys.path.dirname(configPath);
        if (!this.sys.fs.exist(configPath)) return;

        const rawContent = this.sys.fs.readSync(configPath);
        const cleanContent = this.stripComments(rawContent);
        const rawConfig = JSON.parse(cleanContent);

        // Load package.json if not already loaded
        this.loadPackageJson(projectRoot);

        logger.debug(
            "server",
            `ConfigLoader: Resolving references for ${this.sys.path.basename(configPath)}`,
        );
        if (__sys__?.__env__) {
            const envSnapshot = __sys__.__env__.all();
            logger.debug(
                "server",
                `ConfigLoader: Env keys available in store for ${projectRoot}: ${Object.keys(envSnapshot).join(", ")}`,
            );
        }

        // Resolve environment and package variable references
        const config = this.resolveRefs(rawConfig);

        if (!config) return;

        logger.debug(
            "server",
            `ConfigLoader: Applied configuration from: ${this.sys.path.relative(projectRoot, configPath)}`,
        );

        // Apply __sys__ config if present
        if (config?.$vars) {
            if (__sys__) {
                logger.debug(
                    "server",
                    `ConfigLoader: Updating system variables with $vars: ${JSON.stringify(config.$vars)}`,
                );
                __sys__.vars.update(config.$vars);
            }
        }

        // Process internal configuration
        const internal =
            config?.vars?.internal || config?.internal || config?.$internal;
        if (internal) {
            this.processInternalConfig(internal, projectRoot, configDir);
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

                    if (
                        resolvedFsPath &&
                        this.sys.fs.exist(resolvedFsPath)
                    ) {
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

                    if (
                        resolvedMetaPath &&
                        this.sys.fs.exist(resolvedMetaPath)
                    ) {
                        if (
                            this.sys.fs.stats(resolvedMetaPath).is_dir
                        ) {
                            this.metaRunner.executeMetaConfig(resolvedMetaPath);
                        } else {
                            this.metaRunner.runMetaFile(resolvedMetaPath);
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
                return this.sys.path.resolve(
                    projectRoot,
                    rootMatch[1].replace(/^\//, ""),
                );
            }

            // 2. CWD Anchors: CWD://
            const cwdMatch = cleanedPath.match(/^CWD:\/\/(.*)$/i);
            if (cwdMatch) {
                return this.sys.path.resolve(
                    process.cwd(),
                    cwdMatch[1].replace(/^\//, ""),
                );
            }

            if (this.sys.path.isAbsolute(cleanedPath)) return cleanedPath;
            return this.sys.path.resolve(configDir, cleanedPath);
        } catch (error) {
            return null;
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
        const pkgPath = this.sys.path.join(root, "package.json");
        if (this.sys.fs.exist(pkgPath)) {
            try {
                this.packageJson = JSON.parse(
                    this.sys.fs.readSync(pkgPath),
                );
            } catch (error) {
                logger.warn(
                    "server",
                    "Failed to parse package.json for configuration resolution",
                );
            }
        }
    }

    private resolveRefs(obj: any): any {
        const parser = new ConfigSyntaxParser(
            this.packageJson,
            __sys__?.__env__,
        );
        return parser.resolve(obj);
    }
}

export const configLoader = new ConfigLoader();

