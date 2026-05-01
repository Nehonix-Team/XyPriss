import { logger } from "../../shared/logger/Logger";
import { __sys__ } from "../../xhsc";
import { getSysApi } from "../../plugins/const/getSysApi";
import { getCallerProjectRoot } from "../../utils/ProjectDiscovery";

/**
 * XyPriss Meta Configuration Runner
 *
 * Discovers and executes early initialization logic from meta files before
 * the standard xypriss.config is fully processed.
 */
export class MetaConfigRunner {
    private executedMetas = new Set<string>();

    /**
     * Executes a specific meta configuration file
     */
    public runMetaFile(metaPath: string): void {
        const sys = getSysApi();
        const absolutePath = sys.path.resolve(metaPath);
        if (this.executedMetas.has(absolutePath)) return;
        this.executedMetas.add(absolutePath);

        try {
            import(`file://${metaPath}`)
                .then((module) => {
                    if (module && typeof module.run === "function") {
                        // Allow synchronous or asynchronous run() functions
                        const result = module.run();
                        if (result instanceof Promise) {
                            result.catch(this.handleFatalError.bind(this, metaPath));
                        }
                    }
                    logger.debug("server", `Executed meta file: ${metaPath}`);
                })
                .catch(this.handleFatalError.bind(this, metaPath));
        } catch (error: any) {
            this.handleFatalError(metaPath, error);
        }
    }

    /**
     * Discovers and executes meta configuration files based on priority
     */
    public executeMetaConfig(searchDir?: string): void {
        const sys = getSysApi();
        const root = searchDir || getCallerProjectRoot() || __sys__.__root__;
        const metaFiles = searchDir
            ? [
                  sys.path.join(root, "+xypriss.meta.ts"),
                  sys.path.join(root, "+xypriss.meta.js"),
                  sys.path.join(root, ".meta", "+xypriss.meta.ts"),
                  sys.path.join(root, ".meta", "+xypriss.meta.js"),
              ]
            : [
                  sys.path.join(root, "+xypriss.meta.ts"),
                  sys.path.join(root, "+xypriss.meta.js"),
                  sys.path.join(root, ".private", "+xypriss.meta.ts"),
                  sys.path.join(root, ".private", "+xypriss.meta.js"),
                  sys.path.join(root, ".meta", "+xypriss.meta.js"),
                  sys.path.join(root, ".meta", "+xypriss.meta.ts"),
                  sys.path.join(root, ".xypriss", "+xypriss.meta.ts"),
                  sys.path.join(root, ".xypriss", "+xypriss.meta.js"),
              ];

        for (const metaPath of metaFiles) {
            if (sys.fs.exist(metaPath)) {
                this.runMetaFile(metaPath);
                if (!searchDir) return;
            }
        }
    }

    private handleFatalError(metaPath: string, error: any): void {
        logger.error(
            "server",
            `FATAL: Failed to execute meta file ${metaPath}: ${error.message || error}`,
        );

        // Terminate process securely via system API
        if (globalThis.__sys__ && typeof globalThis.__sys__.exit === "function") {
            globalThis.__sys__.exit(1);
        } else {
            process.exit(1);
        }
    }
}
