import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { CommandResult } from "./cmdr";

/**
 * Internal runner for the xsys Rust binary.
 * Handles execution and JSON parsing for all system and filesystem operations.
 */
export class XyPrissRunner {
    private binaryPath: string;

    constructor(private root: string) {
        // The binary is expected to be in the project root's bin directory
        this.binaryPath = path.resolve(process.cwd(), "bin", "xsys");

        // Fallback for development if not found in root bin
        if (!fs.existsSync(this.binaryPath)) {
            const devPath = path.resolve(
                process.cwd(),
                "tools",
                "xypriss-sys",
                "target",
                "release",
                "xsys"
            );
            if (fs.existsSync(devPath)) {
                this.binaryPath = devPath;
            }
        }
    }

    /**
     * Executes a command synchronously and returns the parsed JSON result.
     * Standardizes all responses into a Promise-like data structure.
     */
    public runSync<T = any>(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {}
    ): T {
        const cmdArgs: string[] = ["--root", this.root];

        if (options.verbose) cmdArgs.push("--verbose");
        if (options.quiet) cmdArgs.push("--quiet");
        cmdArgs.push("--json");

        cmdArgs.push(module, action, ...args);

        // Add specific flags from options
        for (const [key, value] of Object.entries(options)) {
            if (["verbose", "quiet", "json"].includes(key)) continue;
            if (value === true) cmdArgs.push(`--${key}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${key}`, String(value));
            }
        }

        try {
            const output = execSync(
                `"${this.binaryPath}" ${cmdArgs.join(" ")}`,
                {
                    encoding: "utf8",
                    maxBuffer: 1024 * 1024 * 50, // 50MB buffer
                }
            );
            const result: CommandResult<T> = JSON.parse(output);

            if (result.status === "error") {
                throw new Error(
                    result.message ||
                        `Unknown error in xsys ${module} ${action}`
                );
            }

            return result.data as T;
        } catch (error: any) {
            if (error.stdout) {
                try {
                    const result = JSON.parse(error.stdout);
                    throw new Error(result.message || error.message);
                } catch {
                    throw error;
                }
            }
            throw error;
        }
    }
}

