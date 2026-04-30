import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * **Discovery — XyPriss Resource & Binary Discovery Engine**
 *
 * This utility provides a robust, non-hardcoded mechanism for locating
 * binaries and resources within the XyPriss ecosystem. It supports
 * hierarchical searching, environment overrides, and system PATH resolution.
 */
export class Discovery {
    /**
     * **Standard XyPriss search subdirectories**
     *
     * These paths are checked relative to each parent directory during
     * a hierarchical search.
     */
    public static readonly STANDARD_PATHS = [
        "bin",
        path.join("node_modules", "xypriss", "bin"),
        path.join("node_modules", ".bin"),
        path.join("tools", "XHSC", "dist"),
    ];

    /**
     * **Resolve a binary path**
     *
     * Searches for binary candidates in a set of base directories and their parents.
     *
     * @param candidates - List of potential binary names (in order of preference).
     * @param searchBases - Root directories to start the search from.
     * @param subDirs - Subdirectories to check within each base (defaults to STANDARD_PATHS).
     * @returns The absolute path to the found binary, or null if not found.
     */
    public static resolveBinary(
        candidates: string[],
        searchBases: string[],
        subDirs: string[] = Discovery.STANDARD_PATHS,
    ): string | null {
        for (const base of searchBases) {
            let current = base;
            // Traverse up to 8 levels to handle deeply nested node_modules or virtual stores
            for (let depth = 0; depth < 8; depth++) {
                for (const checkDir of subDirs) {
                    const dir = path.join(current, checkDir);
                    for (const name of candidates) {
                        const fullPath = path.join(dir, name);
                        try {
                            if (fs.existsSync(fullPath)) return fullPath;
                        } catch {
                            /* skip permission or access errors */
                        }
                    }
                }

                const parent = path.dirname(current);
                if (parent === current) break;
                current = parent;
            }
        }

        // Final fallback: Manual scan of the system PATH
        const pathEnv = process.env.PATH || "";
        const delimiter = process.platform === "win32" ? ";" : ":";
        const pathDirs = pathEnv.split(delimiter);

        for (const dir of pathDirs) {
            if (!dir) continue;
            for (const name of candidates) {
                const fullPath = path.join(dir, name);
                try {
                    if (fs.existsSync(fullPath)) return fullPath;
                } catch {
                    /* skip */
                }
            }
        }

        return null;
    }

    /**
     * **Get Script Directory**
     *
     * Robustly detects the directory of the currently executing script.
     * Compatible with both CommonJS (__filename) and ESM (import.meta.url).
     */
    public static getScriptDir(): string | null {
        try {
            // @ts-ignore
            const _filename =
                typeof __filename !== "undefined"
                    ? __filename
                    : fileURLToPath(import.meta.url);
            return path.dirname(_filename);
        } catch {
            return null;
        }
    }

    /**
     * **Get Binary from Environment**
     *
     * Checks if a specific environment variable points to a valid binary path.
     */
    public static getFromEnv(envVar: string): string | null {
        const val = process.env[envVar];
        if (val && fs.existsSync(val)) return val;
        return null;
    }
}
