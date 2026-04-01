import fs from "fs";
import path from "path";
import { XyPrissFS } from "./sys/System";
import { DotEnvLoader } from "./utils/DotEnvLoader";
import { XY_ENV_STORE_KEY, XY_SYS_REGISTER_FS } from "./sys/api/env/env";

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
    /** Specialized workspace filesystem instance (optional plugin scope). */
    public plug?: XyPrissFS;
    public plg?: XyPrissFS;

    /**
     * **Register Specialized Filesystem (Internal)**
     *
     * Adds a named XyPrissFS instance to the system (e.g., plug, plg).
     */
    public [XY_SYS_REGISTER_FS](name: string, instance: XyPrissFS): void {
        const cleanName = name.replace(/^\$/, ""); // Remove legacy $ if present
        (this as any)[cleanName] = instance;
    }

    public __root__: string = process.cwd();

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
        this.__root__ = root;

        // Initialize default vars
        this.vars.update({
            __version__: "0.0.0",
            __author__: "unknown",
            __description__: "A XyPriss application",
            __app_urls__: {},
            __name__: "xypriss-app",
            __alias__: "app",
            __port__: 3000,
            __PORT__: 3000,
            ...data,
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
}

// Global Registration & Environment Setup
if (typeof globalThis !== "undefined") {
    const originalEnv = { ...process.env };
    const envPaths: string[] = [];
    let currentDir = process.cwd();
    const rootDir = path.parse(currentDir).root;

    while (currentDir !== rootDir) {
        envPaths.push(path.resolve(currentDir, ".private/.env"));
        envPaths.push(path.resolve(currentDir, ".env.local"));
        envPaths.push(path.resolve(currentDir, ".env"));

        // SECURITY: Stop upward search once the project root is identified.
        // This prevents leaking environment variables from unrelated parent directories.
        if (fs.existsSync(path.join(currentDir, "package.json"))) {
            break;
        }

        currentDir = path.dirname(currentDir);
    }
    envPaths.push(path.resolve(rootDir, ".env"));

    const loaded = DotEnvLoader.load({
        path: envPaths.reverse(),
        override: true,
    });

    // Initialize the Symbol-keyed secure store
    (globalThis as any)[XY_ENV_STORE_KEY] = { ...originalEnv, ...loaded };

    const defaultPort = parseInt(
        ((globalThis as any)[XY_ENV_STORE_KEY] as any)["PORT"] || "3000",
    );

    if (!(globalThis as any).__sys__) {
        (globalThis as any).__sys__ = new XyPrissSys({
            __port__: defaultPort,
            __PORT__: defaultPort,
            __mode__:
                ((globalThis as any)[XY_ENV_STORE_KEY] as any)["NODE_ENV"] ||
                "development",
        });
    }
}

/** Global singleton instance of the system. */
export const __sys__ = (globalThis as any).__sys__ as XyPrissSys;

