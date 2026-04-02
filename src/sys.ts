import fs from "fs";
import path from "path";
import os from "os";
import { XyPrissFS } from "./sys/System";
import { DotEnvLoader } from "./utils/DotEnvLoader";
import { XY_ENV_STORE_KEY, XY_SYS_REGISTER_FS } from "./sys/api/env/env";
import {
    isProjectRoot,
    getCallerProjectRoot,
    setRootInterceptor,
} from "./utils/ProjectDiscovery";
import { logger } from "./shared/logger/Logger";
import { XyprissTempDir } from "./plugins/const/XyprissTempDir";

/**
 * **XyPriss System Variables (`__sys__`)**
 *
 * The **Central Nervous System** of a XyPriss application.
 * This class serves as the singleton entry point for all system operations.
 *
 * Modular Namespaces:
 * - `fs`: Filesystem operations
 * - `os`: Operating system & hardware telemetry
 * - `path`: Path utilities
 * - `vars`: Dynamic configuration & metadata
 * - `__env__`: Environment variables & security manager (EnvApi)
 */
export class XyPrissSys extends XyPrissFS {
    private readonly _pluginMap: Map<string, XyPrissFS> = new Map();

    /** Authorized specialized workspace filesystems for plugins. */
    public readonly plugins: { get(pluginId: string): XyPrissFS | undefined };

    /**
     * **Register Specialized Filesystem (Internal)**
     *
     * Adds a XyPrissFS instance to the system plugins map securely.
     */
    public [XY_SYS_REGISTER_FS](pluginId: string, instance: XyPrissFS): void {
        this._pluginMap.set(pluginId, instance);
    }

    private _root: string = process.cwd();

    public get __root__(): string {
        return getCallerProjectRoot() || this._root;
    }

    constructor(data: Record<string, any> = {}) {
        const root = data.__root__ || process.cwd();

        // Resolve environment mode before super() as it's now readonly
        const envUpdate =
            data.__env__ || data.__env || data.__mode__ || data.__mode;
        const mode =
            typeof envUpdate === "string"
                ? envUpdate
                : envUpdate?.mode || "development";

        super({ __root__: root, __mode__: mode });
        this._root = root;

        // Initialize default vars
        this.vars.update({
            __version__: "0.0.0",
            __author__: "unknown",
            __description__: "A XyPriss application",
            __app_urls__: {},
            __name__: "xypriss-app",
            __alias__: "app",
            __port__: 7682,
            __PORT__: 7682,
            ...data,
        });

        // Lock __root__ so hackers cannot override it via Object.defineProperty
        Object.defineProperty(this, "__root__", {
            get: () => getCallerProjectRoot() || this._root,
            enumerable: true,
            configurable: false,
        });

        // Specialized Workspace Discovery (Security Restricted)
        const pluginsAccess = {
            get: (pluginId: string): XyPrissFS | undefined => {
                let instance = this._pluginMap.get(pluginId);
                if (!instance) {
                    // 🛡️ Security Policy: Config-driven authorization
                    const config = this._loadConfig();
                    const internal = config?.$internal || config?.internal;
                    const pluginConfig = internal?.[pluginId];
                    const xfsPath = pluginConfig?.__xfs__?.path;

                    let resolvedRoot: string | null = null;
                    if (xfsPath) {
                        resolvedRoot = this._resolvePath(xfsPath, root);
                    }

                    if (resolvedRoot && fs.existsSync(resolvedRoot)) {
                        instance = new XyPrissFS({
                            __root__: resolvedRoot,
                            __mode__: mode,
                        });
                        logger.debug(
                            "security",
                            `Plugin ${pluginId} authorized. Workspace root: ${resolvedRoot}`,
                        );
                        this._pluginMap.set(pluginId, instance);
                        return instance;
                    } else {
                        // 🛡️ Implicit Void Sandbox Warning (but return undefined)
                        const voidPath = path.join(
                            XyprissTempDir,
                            "void",
                            "sandbox",
                            pluginId.replace(/[^a-zA-Z0-9-]/g, "_"),
                        );

                        __sys__.fs.mkdirSafe(voidPath);

                        logger.warn(
                            "security",
                            `Plugin ${pluginId} requested workspace but was not explicitly authorized in config. Assigned implicit Void Sandbox (${voidPath}).`,
                        );
                        return undefined;
                    }
                }
                return instance;
            },
        };

        // Inject the restricted accessor
        this.plugins = pluginsAccess;

        // Lock plugins map reference so it cannot be replaced
        Object.defineProperty(this, "plugins", {
            value: this.plugins,
            enumerable: true,
            writable: false,
            configurable: false,
        });
    }

    /**
     * **Sleep (Utility)**
     *
     * Asynchronously pauses execution for the specified number of milliseconds.
     *
     * @param {number} ms - Milliseconds to sleep.
     * @returns {Promise<void>}
     */
    public async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    public toJSON(): Record<string, any> {
        return this.vars.all();
    }

    private _loadConfig(): any {
        try {
            const root = this._root;
            for (const name of [
                "xypriss.config.jsonc",
                "xypriss.config.json",
            ]) {
                const configPath = path.join(root, name);
                if (fs.existsSync(configPath)) {
                    const raw = fs.readFileSync(configPath, "utf-8");
                    const clean = raw
                        .replace(
                            /("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g,
                            (m, g) => (g ? g : ""),
                        )
                        .replace(
                            /("(?:[^"\\]|\\.)*")|,\s*([}\]])/g,
                            (m, g1, g2) => (g1 ? g1 : g2),
                        );
                    return JSON.parse(clean);
                }
            }
        } catch {}
        return null;
    }

    private _resolvePath(raw: string, projectRoot: string): string | null {
        try {
            let p = raw.replace(/\s*\/\s*/g, "/").trim();
            if (p.startsWith("ROOT://")) {
                return path.resolve(
                    projectRoot,
                    p.substring(7).replace(/^\//, ""),
                );
            }
            if (p.startsWith("CWD://")) {
                return path.resolve(
                    process.cwd(),
                    p.substring(6).replace(/^\//, ""),
                );
            }
            if (path.isAbsolute(p)) return p;
            return path.resolve(projectRoot, p);
        } catch {
            return null;
        }
    }
}

// Global Registration & Environment Setup
if (typeof globalThis !== "undefined") {
    const originalEnv = { ...process.env };
    const envPaths: { path: string; restricted: boolean }[] = [];

    // Improved root detection: start from the main script's directory if possible,
    // otherwise fallback to process.cwd().
    let currentDir = process.cwd();
    if (process.argv[1]) {
        try {
            const resolvedPath = fs.realpathSync(process.argv[1]);
            if (fs.existsSync(resolvedPath)) {
                currentDir = path.dirname(resolvedPath);
            }
        } catch (e) {
            // Fallback to process.cwd()
        }
    }

    const rootDir = path.parse(currentDir).root;
    let foundRoot = process.cwd();

    // Identify all projects in the hierarchy
    const projects: string[] = [];
    let tempDir = currentDir;
    while (tempDir !== rootDir) {
        if (isProjectRoot(tempDir)) {
            projects.push(tempDir);
        }
        tempDir = path.dirname(tempDir);
    }

    // The closest project to the script is our primary root
    if (projects.length > 0) {
        foundRoot = projects[0];
    } else {
        // Fallback to searching for ANY package.json if no 'real' project found
        tempDir = currentDir;
        while (tempDir !== rootDir) {
            if (fs.existsSync(path.join(tempDir, "package.json"))) {
                foundRoot = tempDir;
                break;
            }
            tempDir = path.dirname(tempDir);
        }
    }

    // Load environment variables for each project hierarchy independently
    const projectEnvs = new Map<string, Record<string, string | undefined>>();

    // Process each project found in the hierarchy
    for (const projectPath of projects) {
        const envPath = path.resolve(projectPath, ".env");
        const envData: Record<string, string | undefined> = {};

        if (fs.existsSync(envPath)) {
            const loaded = DotEnvLoader.load({
                path: [envPath],
                override: true,
            });
            for (const key in loaded) {
                envData[key] = loaded[key] as string;
            }
        }
        projectEnvs.set(projectPath, envData);
    }

    // Initialize the Symbol-keyed secure store as a Map of project environments
    (globalThis as any)[XY_ENV_STORE_KEY] = projectEnvs;

    // Use the primary project root's environment for system defaults
    const primaryEnv = projectEnvs.get(foundRoot) || {};
    const defaultPort = parseInt((primaryEnv as any)["PORT"] || "3000");

    if (!(globalThis as any).__sys__) {
        const sysInstance = new XyPrissSys({
            __root__: foundRoot,
            __port__: defaultPort,
            __PORT__: defaultPort,
            __mode__: (primaryEnv as any)["NODE_ENV"] || "development",
        });

        // ==========================================
        // ENTERPRISE IMMUTABILITY SHIELD
        // ==========================================
        // Lock the global __sys__ object so it cannot be overwritten by hackers (e.g., __sys__ = {})
        Object.defineProperty(globalThis, "__sys__", {
            value: sysInstance,
            writable: false,
            enumerable: true,
            configurable: false,
        });
    }
}

/** Global singleton instance of the system. */
export const __sys__ = (globalThis as any).__sys__ as XyPrissSys;

