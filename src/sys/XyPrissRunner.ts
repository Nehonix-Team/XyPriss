import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { CommandResult } from "./cmdr";

/**
 * Custom error class for XyPriss system operations.
 */
export class XyPrissError extends Error {
    constructor(
        public module: string,
        public action: string,
        public details: string,
        public raw?: any
    ) {
        super(`[XyPriss Error] ${module}.${action} failed: ${details}`);
        this.name = "XyPrissError";
    }
}

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

        const fullCommand = `"${this.binaryPath}" ${cmdArgs.join(" ")}`;

        try {
            const output = execSync(fullCommand, {
                encoding: "utf8",
                maxBuffer: 1024 * 1024 * 50, // 50MB buffer
                stdio: ["ignore", "pipe", "pipe"], // Capture both stdout and stderr
            });

            const result: CommandResult<T> = JSON.parse(output);

            // Handle both wrapped standard responses and raw direct object responses
            if (result && typeof result === "object") {
                if ("status" in result && "data" in result) {
                    if (result.status === "error") {
                        throw new XyPrissError(
                            module,
                            action,
                            result.message || "Unknown error occurred"
                        );
                    }
                    return result.data as T;
                }
                // Assume it's a raw response (like SysInfo)
                return result as T;
            }

            return result as T;
        } catch (error: any) {
            // If it's already a XyPrissError, just rethrow it
            if (error instanceof XyPrissError) throw error;

            let errorMessage = error.message;

            // Try to extract JSON error from stdout if it exists
            if (error.stdout) {
                try {
                    const result = JSON.parse(error.stdout.toString());
                    if (result.status === "error" && result.message) {
                        errorMessage = result.message;
                    }
                } catch {
                    // Ignore parsing error
                }
            } else if (error.stderr) {
                const stderrMsg = error.stderr.toString().trim();
                if (stderrMsg) errorMessage = stderrMsg;
            }

            // Strip technical "Command failed:" prefix if present to keep it professional
            if (errorMessage.includes("Command failed:")) {
                errorMessage = errorMessage
                    .replace(/Command failed:.*xsys" /, "")
                    .replace(/^.*execSync.*$/m, "") // Remove stack trace lines from message if bun adds them
                    .trim();
            }

            // Remove redundant "Error: " prefix if it double-labels
            if (errorMessage.startsWith("Error: ")) {
                errorMessage = errorMessage.substring(7);
            }

            throw new XyPrissError(module, action, errorMessage, error);
        }
    }
}

