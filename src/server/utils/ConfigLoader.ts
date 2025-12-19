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
}

export const configLoader = new ConfigLoader();

