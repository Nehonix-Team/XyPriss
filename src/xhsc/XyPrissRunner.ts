import path from "node:path";
import fs from "node:fs";
import { execFileSync, spawn, ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { Logger } from "../shared/logger/Logger";
import { CommandResult } from "./cmdr";
import { XHSC_SIGNATURE } from "../server/const/XHSC_SIGNATURE";

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
 * **Native System Runner**
 *
 * This class serves as the core bridge between the Node.js runtime and the
 * high-performance system core. It manages process spawning, argument
 * serialization, and bidirectional streaming.
 */
export class XyPrissRunner {
    private binaryPath: string;

    constructor(private root: string) {
        this.binaryPath = this.discoverBinary();
    }

    public getRoot(): string {
        return this.root;
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

        // Candidate names in order of preference
        const goBinName = `xhsc-${osPart}-${archPart}${suffix}`;
        const genericBinName = osPart === "windows" ? "xhsc.exe" : "xhsc";
        const candidates = [goBinName, genericBinName];

        try {
            // Get location of *this* file (compiled JS)
            const __filename = fileURLToPath(import.meta.url);
            const scriptDir = path.dirname(__filename);

            // Bases for recursive search: script location and current working directory
            const searchBases = [scriptDir, process.cwd()];

            for (const base of searchBases) {
                let current = base;
                // Go up up to 8 levels to handle deeply nested node_modules / virtual_store
                for (let depth = 0; depth < 8; depth++) {
                    // Check 1: Standard bin/ at this level
                    const binDir = path.join(current, "bin");
                    for (const name of candidates) {
                        const fullPath = path.join(binDir, name);
                        if (fs.existsSync(fullPath)) return fullPath;
                    }

                    // Check 2: node_modules/.bin (if we are at project/env root)
                    const nodeModulesBin = path.join(
                        current,
                        "node_modules",
                        ".bin",
                    );
                    for (const name of candidates) {
                        const fullPath = path.join(nodeModulesBin, name);
                        if (fs.existsSync(fullPath)) return fullPath;
                    }

                    // Check 3: Local dev folders
                    const devPath = path.join(current, "tools", "XHSC", "dist");
                    for (const name of candidates) {
                        const fullPath = path.join(devPath, name);
                        if (fs.existsSync(fullPath)) return fullPath;
                    }

                    const parent = path.dirname(current);
                    if (parent === current) break;
                    current = parent;
                }
            }
        } catch (e) {
            // Silently fall through to generic name
        }

        // Final fallback (generic name which might be in PATH)
        return genericBinName;
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
        const INTERNAL_SIGNATURE = XHSC_SIGNATURE;
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
            if (
                ["verbose", "quiet", "json", "interactive", "input"].includes(
                    key,
                )
            )
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
            const execOptions: any = {
                encoding: "utf8",
                maxBuffer: 1024 * 1024 * 100, // 100MB buffer
                stdio: ["ignore", "pipe", "pipe"], // Default: ignore stdin
                cwd: this.root,
            };

            if (options.input !== undefined) {
                execOptions.input = options.input;
                execOptions.stdio = ["pipe", "pipe", "pipe"]; // Enable stdin
            }

            const output = execFileSync(this.binaryPath, cmdArgs, execOptions);

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
                    .replace(/Command failed:.*xhsc" /, "")
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

    /**
     * Executes a command asynchronously and returns the parsed JSON result.
     */
    public async runAsync<T = any>(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): Promise<T> {
        try {
            const { spawn } = await import("node:child_process");

            const INTERNAL_SIGNATURE = XHSC_SIGNATURE;
            const cmdArgs: string[] = [
                "--root",
                this.root,
                "--signature",
                INTERNAL_SIGNATURE,
                "--json", // Ensure JSON output for parsing
            ];

            if (options.verbose) cmdArgs.push("--verbose");
            if (options.quiet) cmdArgs.push("--quiet");

            cmdArgs.push(module, action, ...args);

            // Add specific flags from options
            for (const [key, value] of Object.entries(options)) {
                if (
                    [
                        "verbose",
                        "quiet",
                        "json",
                        "interactive",
                        "input",
                    ].includes(key)
                )
                    continue;

                const flag = key.replace(
                    /[A-Z]/g,
                    (m) => "-" + m.toLowerCase(),
                );
                if (value === true) cmdArgs.push(`--${flag}`);
                else if (value !== false && value !== undefined) {
                    cmdArgs.push(`--${flag}`, String(value));
                }
            }

            return await new Promise<T>((resolve, reject) => {
                const child = spawn(this.binaryPath, cmdArgs, {
                    cwd: this.root,
                });

                let stdout = "";
                let stderr = "";

                if (options.input !== undefined) {
                    child.stdin.write(options.input);
                    child.stdin.end();
                }

                child.stdout.on("data", (data) => {
                    stdout += data.toString();
                });

                child.stderr.on("data", (data) => {
                    stderr += data.toString();
                });

                child.on("close", (code) => {
                    if (code !== 0) {
                        let errorMessage = `Command failed with exit code ${code}`;
                        try {
                            const result = JSON.parse(stdout);
                            if (result.status === "error" && result.message) {
                                errorMessage = result.message;
                            }
                        } catch {
                            if (stderr.trim()) errorMessage = stderr.trim();
                        }
                        return reject(
                            new XyPrissError(module, action, errorMessage, {
                                stdout,
                                stderr,
                                code,
                            }),
                        );
                    }

                    try {
                        const result: CommandResult<T> = JSON.parse(stdout);
                        if (result && typeof result === "object") {
                            if ("status" in result && "data" in result) {
                                if (result.status === "error") {
                                    return reject(
                                        new XyPrissError(
                                            module,
                                            action,
                                            result.message ||
                                                "Unknown error occurred",
                                        ),
                                    );
                                }
                                return resolve(result.data as T);
                            }
                        }
                        resolve(result as any as T);
                    } catch (parseError) {
                        resolve(stdout as unknown as T);
                    }
                });

                child.on("error", (err) => {
                    reject(new XyPrissError(module, action, err.message, err));
                });
            });
        } catch (error: any) {
            if (error instanceof XyPrissError) throw error;

            let errorMessage = error.message;

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

            throw new XyPrissError(module, action, errorMessage, error);
        }
    }

    /**
     * Run a module action and return the stdout as a Readable stream
     */
    public runStream(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): Readable {
        const cmdArgs = [
            "--root",
            this.root,
            "--signature",
            XHSC_SIGNATURE,
            module,
            action,
            ...args,
        ];

        for (const [key, value] of Object.entries(options)) {
            if (["input"].includes(key)) continue;

            const flag = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
            if (value === true) cmdArgs.push(`--${flag}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${flag}`, String(value));
            }
        }

        const child = spawn(this.binaryPath, cmdArgs, {
            cwd: this.root,
        });

        if (options.input !== undefined) {
            child.stdin.write(options.input);
            child.stdin.end();
        }

        // Return the stdout stream
        return child.stdout;
    }

    /**
     * Run a module action and return the stdin as a Writable stream
     */
    public runWritableStream(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): Writable {
        const cmdArgs = [
            "--root",
            this.root,
            "--signature",
            XHSC_SIGNATURE,
            module,
            action,
            ...args,
        ];

        for (const [key, value] of Object.entries(options)) {
            const flag = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
            if (value === true) cmdArgs.push(`--${flag}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${flag}`, String(value));
            }
        }

        const child = spawn(this.binaryPath, cmdArgs, {
            cwd: this.root,
        });

        // Return the stdin stream
        return child.stdin;
    }
}

