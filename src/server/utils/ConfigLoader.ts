import * as fs from "fs";
import * as path from "path";
import { logger } from "../../../shared/logger/Logger";

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

        // Execute meta config first if it exists
        this.executeMetaConfig();

        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, "utf-8");
                const config = JSON.parse(content);

                if (config) {
                    const keys = Object.keys(config);

                    // Validation: only "__sys__" is allowed in this file
                    if (keys.length === 1 && keys[0] === "__sys__") {
                        if (
                            typeof globalThis !== "undefined" &&
                            (globalThis as any).__sys__
                        ) {
                            (globalThis as any).__sys__.$update(config.__sys__);
                        }
                    } else {
                        logger.warn(
                            "server",
                            `xypriss.config.json is invalid. Only the "__sys__" key is allowed.`
                        );
                    }
                }
            } catch (error: any) {
                // Silently fail or log a minimal warning to avoid breaking the app
                logger.warn(
                    "server",
                    `Failed to load or parse xypriss.config.json: ${error.message}`
                );
            }
        }
    }

    /**
     * Search for +xypriss.meta.ts or +xypriss.meta.js and execute it
     */
    private executeMetaConfig(): void {
        if (this.metaExecuted) return;
        this.metaExecuted = true;

        const root = this.findProjectRoot(process.cwd());
        const metaFiles = [
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
                try {
                    // Use dynamic import to execute the file
                    // We don't await it to keep the method synchronous as per ConfigLoader design
                    import(`file://${metaPath}`)
                        .then((module) => {
                            // If it exports a run function, execute it
                            if (module && typeof module.run === "function") {
                                module.run();
                            }
                            logger.debug(
                                "server",
                                `Executed meta config: ${metaPath}`
                            );
                        })
                        .catch((error) => {
                            logger.warn(
                                "server",
                                `Failed to execute meta config ${metaPath}: ${error.message}`
                            );
                        });
                    return; // Stop after first found and executed
                } catch (error: any) {
                    logger.warn(
                        "server",
                        `Failed to initiate meta config execution ${metaPath}: ${error.message}`
                    );
                }
            }
        }
    }
}

export const configLoader = new ConfigLoader();

