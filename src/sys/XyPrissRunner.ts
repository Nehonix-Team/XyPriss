import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CommandResult } from "./cmdr";

/**
 * Custom error class for XyPriss system operations.
 */
export class XyPrissError extends Error {
    constructor(
        public module: string,
        public action: string,
        public details: string,
        public raw?: any,
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
        this.binaryPath = this.discoverBinary();
    }

    public getBinaryPath(): string {
        return this.binaryPath;
    }

    /**
     * Strategic discovery of the XyPriss System binary.
     * Prioritizes the high-performance Go implementation (XHSC-GO).
     */
    private discoverBinary(): string {
        const getOsPart = () => {
            switch (process.platform) {
                case "win32":
                    return "windows";
                case "darwin":
                    return "darwin";
                default:
                    return "linux";
            }
        };

        const getArchPart = () => {
            switch (process.arch) {
                case "arm64":
                    return "arm64";
                default:
                    return "amd64"; // Default to amd64/x64
            }
        };

        const osPart = getOsPart();
        const archPart = getArchPart();
        const suffix = osPart === "windows" ? ".exe" : "";

        // The new naming convention for the Go implementation
        const goBinName = `xsys-${osPart}-${archPart}${suffix}`;
        // Legacy Rust binary name
        const rustBinName = osPart === "windows" ? "xsys.exe" : "xsys";

        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);

            const locations = [
                // 1. Go implementation (Development & Dist)
                path.resolve(
                    process.cwd(),
                    "tools",
                    "xypriss-sys-go",
                    "dist",
                    goBinName,
                ),
                path.resolve(process.cwd(), "bin", goBinName),

                // 2. Deployment locations relative to script
                path.resolve(__dirname, "..", "..", "bin", goBinName),
                path.resolve(__dirname, "..", "..", "..", "bin", goBinName),

                // 3. Fallback to Rust (Legacy Support)
                path.resolve(
                    process.cwd(),
                    "tools",
                    "xypriss-sys",
                    "target",
                    "release",
                    rustBinName,
                ),
                path.resolve(process.cwd(), "bin", rustBinName),
            ];

            for (const loc of locations) {
                if (fs.existsSync(loc)) {
                    // console.log(`[SYSTEM] Discovered binary: ${loc}`);
                    return loc;
                }
            }
        } catch (e) {
            // Silently fail and fallback
        }

        // Final fallback
        return goBinName;
    }

    /**
     * Executes a command synchronously and returns the parsed JSON result.
     * Standardizes all responses into a Promise-like data structure.
     */
    public runSync<T = any>(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): T {
        const INTERNAL_SIGNATURE =
            "b3f8e9a2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0";
        const cmdArgs: string[] = [
            "--root",
            this.root,
            "--signature",
            INTERNAL_SIGNATURE,
        ];

        if (options.verbose) cmdArgs.push("--verbose");
        if (options.quiet) cmdArgs.push("--quiet");

        // Only add --json if not in interactive mode
        if (!options.interactive) {
            cmdArgs.push("--json");
        }

        cmdArgs.push(module, action, ...args);

        // Add specific flags from options
        for (const [key, value] of Object.entries(options)) {
            if (["verbose", "quiet", "json", "interactive"].includes(key))
                continue;

            // Convert camelCase to kebab-case (e.g. topCpu -> top-cpu)
            const flag = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

            if (value === true) cmdArgs.push(`--${flag}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${flag}`, String(value));
            }
        }

        if (options.interactive) {
            try {
                // Interactive mode: inherited stdio for real-time terminal output (e.g., watch)
                execFileSync(this.binaryPath, cmdArgs, {
                    encoding: "utf8",
                    stdio: "inherit",
                    cwd: this.root,
                });
            } catch (error) {
                // Silent catch for interactive interruptions
            }
            return undefined as unknown as T;
        }

        try {
            const output = execFileSync(this.binaryPath, cmdArgs, {
                encoding: "utf8",
                maxBuffer: 1024 * 1024 * 50, // 50MB buffer
                stdio: ["ignore", "pipe", "pipe"], // Capture both stdout and stderr
            });

            try {
                const result: CommandResult<T> = JSON.parse(output);

                // Handle both wrapped standard responses and raw direct object responses
                if (result && typeof result === "object") {
                    if ("status" in result && "data" in result) {
                        if (result.status === "error") {
                            throw new XyPrissError(
                                module,
                                action,
                                result.message || "Unknown error occurred",
                            );
                        }
                        return result.data as T;
                    }
                    // Assume it's a raw response (like SysInfo)
                    return result as T;
                }

                return result as T;
            } catch (parseError) {
                // If parsing fails, it's likely a raw text output (e.g., from stream or watch)
                // Just return the raw string output as T (which would be string in this case)
                return output as unknown as T;
            }
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

