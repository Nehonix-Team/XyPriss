/**
 * Standalone TypeScript Executor
 * Self-contained TypeScript execution without external dependencies
 */

import { spawn, ChildProcess, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, extname, basename } from "path";
import { EventEmitter } from "events";
import type * as tse from "../types/TSExecutor.type";

export class TypeScriptExecutor extends EventEmitter {
    private config: tse.TypeScriptExecutorConfig;
    private tempDir: string;
    private executablePath?: string;

    constructor(config: tse.TypeScriptExecutorConfig = {}) {
        super();
        this.config = {
            verbose: false,
            tempDir: join(process.cwd(), ".nehonix tse", "temp", ".ts-executor-temp"),
            timeout: 30000,
            retryAttempts: 3,
            fallbackToNode: true,
            compilerOptions: {
                target: "ES2020",
                module: "CommonJS",
                moduleResolution: "node",
                allowSyntheticDefaultImports: true,
                esModuleInterop: true,
                skipLibCheck: true,
                strict: false,
                declaration: false,
                sourceMap: false,
            },
            ...config,
        };

        this.tempDir = this.config.tempDir!;
        this.ensureTempDir();
        this.initializeExecutable();
    }

    /**
     * Ensure temp directory exists
     */
    private ensureTempDir(): void {
        try {
            if (!existsSync(this.tempDir)) {
                mkdirSync(this.tempDir, { recursive: true });
            }
        } catch (error: any) {
            if (this.config.verbose) {
                console.warn(
                    `Failed to create temp directory: ${error.message}`
                );
            }
        }
    }

    /**
     * Initialize the standalone executable path
     */
    private initializeExecutable(): void {
        const executableName =
            process.platform === "win32" ? "ts-executor.exe" : "ts-executor";
        this.executablePath = join(__dirname, "bin", executableName);

        // If executable doesn't exist, we'll use runtime compilation
        if (!existsSync(this.executablePath)) {
            if (this.config.verbose) {
                console.log(
                    "Standalone executable not found, using runtime compilation"
                );
            }
            this.executablePath = undefined;
        }
    }

    /**
     * Execute TypeScript file with the best available method
     */
    public async executeTypeScript(
        scriptPath: string,
        args: string[] = []
    ): Promise<tse.ExecutionResult> {
        const startTime = Date.now();

        if (!existsSync(scriptPath)) {
            return {
                success: false,
                runtime: "none",
                args: [],
                error: `Script file not found: ${scriptPath}`,
                duration: Date.now() - startTime,
                method: "node-fallback",
            };
        }

        // Try different execution methods in order of preference
        const methods = [
            () => this.tryStandaloneExecutable(scriptPath, args),
            () => this.tryExternalRunners(scriptPath, args),
            () => this.tryRuntimeCompilation(scriptPath, args),
            () => this.tryNodeFallback(scriptPath, args),
        ];

        for (const method of methods) {
            try {
                const result = await method();
                if (result.success) {
                    result.duration = Date.now() - startTime;
                    return result;
                }
            } catch (error: any) {
                if (this.config.verbose) {
                    console.warn(`Execution method failed: ${error.message}`);
                }
            }
        }

        return {
            success: false,
            runtime: "none",
            args: [],
            error: "All execution methods failed",
            duration: Date.now() - startTime,
            method: "node-fallback",
        };
    }

    /**
     * Try using standalone executable
     */
    private async tryStandaloneExecutable(
        scriptPath: string,
        args: string[]
    ): Promise<tse.ExecutionResult> {
        if (!this.executablePath || !existsSync(this.executablePath)) {
            throw new Error("Standalone executable not available");
        }

        if (this.config.verbose) {
            console.log(`Using standalone executable: ${this.executablePath}`);
        }

        return {
            success: true,
            runtime: this.executablePath,
            args: [scriptPath, ...args],
            method: "external-runner",
            duration: 0,
        };
    }

    /**
     * Try external TypeScript runners (ts-node, tsx, bun)
     */
    private async tryExternalRunners(
        scriptPath: string,
        args: string[]
    ): Promise<tse.ExecutionResult> {
        const runners = ["ts-node", "tsx", "bun"];

        for (const runner of runners) {
            try {
                const runnerPath = this.findRunner(runner);
                if (runnerPath) {
                    if (this.config.verbose) {
                        console.log(
                            `Using external runner: ${runner} at ${runnerPath}`
                        );
                    }

                    const runtimeArgs =
                        runner === "bun"
                            ? ["run", scriptPath, ...args]
                            : [scriptPath, ...args];

                    return {
                        success: true,
                        runtime: runnerPath,
                        args: runtimeArgs,
                        method: "external-runner",
                        duration: 0,
                    };
                }
            } catch (error) {
                continue;
            }
        }

        throw new Error("No external runners available");
    }

    /**
     * Try runtime TypeScript compilation
     */
    private async tryRuntimeCompilation(
        scriptPath: string,
        args: string[]
    ): Promise<tse.ExecutionResult> {
        if (!this.isTypeScriptFile(scriptPath)) {
            throw new Error("Not a TypeScript file");
        }

        try {
            const compiledPath = await this.compileTypeScript(scriptPath);

            if (this.config.verbose) {
                console.log(`Runtime compilation successful: ${compiledPath}`);
            }

            return {
                success: true,
                runtime: "node",
                args: [compiledPath, ...args],
                compiledPath,
                method: "runtime-compile",
                duration: 0,
            };
        } catch (error: any) {
            throw new Error(`Runtime compilation failed: ${error.message}`);
        }
    }

    /**
     * Fallback to node (will likely fail for .ts files)
     */
    private async tryNodeFallback(
        scriptPath: string,
        args: string[]
    ): Promise<tse.ExecutionResult> {
        if (!this.config.fallbackToNode) {
            throw new Error("Node fallback disabled");
        }

        if (this.config.verbose) {
            console.warn("Using node fallback (may fail for TypeScript files)");
        }

        return {
            success: true,
            runtime: "node",
            args: [scriptPath, ...args],
            method: "node-fallback",
            duration: 0,
        };
    }

    /**
     * Find TypeScript runner executable
     */
    private findRunner(runner: string): string | null {
        // Try different paths and extensions
        const paths = [
            // Local node_modules/.bin
            join(process.cwd(), "node_modules", ".bin", runner),
            join(process.cwd(), "node_modules", ".bin", `${runner}.cmd`),
            join(process.cwd(), "node_modules", ".bin", `${runner}.exe`),
            join(process.cwd(), "node_modules", ".bin", `${runner}.ps1`),
        ];

        // Add global paths
        if (process.platform === "win32") {
            paths.push(
                `${process.env.APPDATA}\\npm\\${runner}.cmd`,
                `${process.env.APPDATA}\\npm\\${runner}.exe`,
                `${process.env.ProgramFiles}\\nodejs\\${runner}.cmd`
            );
        } else {
            paths.push(
                `/usr/local/bin/${runner}`,
                `/usr/bin/${runner}`,
                `${process.env.HOME}/.npm-global/bin/${runner}`
            );
        }

        for (const path of paths) {
            if (existsSync(path)) {
                return path;
            }
        }

        // Try using 'where' or 'which' command
        try {
            const command = process.platform === "win32" ? "where" : "which";
            const result = execSync(`${command} ${runner}`, {
                encoding: "utf8",
                stdio: "pipe",
            }).trim();

            if (result) {
                const firstPath = result.split("\n")[0].trim();
                if (existsSync(firstPath)) {
                    return firstPath;
                }
            }
        } catch {
            // Command failed, continue
        }

        return null;
    }

    /**
     * Compile TypeScript file to JavaScript
     */
    private async compileTypeScript(scriptPath: string): Promise<string> {
        try {
            // Try to use TypeScript compiler API
            const ts = require("typescript");
            const sourceCode = readFileSync(scriptPath, "utf8");

            const result = ts.transpileModule(sourceCode, {
                compilerOptions: this.config.compilerOptions,
                fileName: scriptPath,
            });

            if (result.diagnostics && result.diagnostics.length > 0) {
                const errors = result.diagnostics.map(
                    (d: any) =>
                        `${d.file?.fileName || scriptPath}:${
                            d.start
                                ? ts.getLineAndCharacterOfPosition(
                                      d.file!,
                                      d.start
                                  ).line + 1
                                : "?"
                        } - ${d.messageText}`
                );

                if (this.config.verbose) {
                    console.warn(
                        "TypeScript compilation warnings:",
                        errors.join("\n")
                    );
                }
            }

            // Write compiled JavaScript
            const compiledPath = join(
                this.tempDir,
                `${basename(scriptPath, ".ts")}.js`
            );
            writeFileSync(compiledPath, result.outputText);

            return compiledPath;
        } catch (error: any) {
            // Fallback: Simple regex-based transpilation for basic cases
            if (this.config.verbose) {
                console.warn(
                    "TypeScript compiler not available, using simple transpilation"
                );
            }

            return this.simpleTranspile(scriptPath);
        }
    }

    /**
     * Simple regex-based TypeScript to JavaScript transpilation
     */
    private simpleTranspile(scriptPath: string): string {
        const sourceCode = readFileSync(scriptPath, "utf8");

        // Basic TypeScript to JavaScript conversion
        let jsCode = sourceCode
            // Remove type annotations
            .replace(
                /:\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&\s]*(?=\s*[=,;)\n])/g,
                ""
            )
            // Remove interface declarations
            .replace(/interface\s+[A-Za-z_$][A-Za-z0-9_$]*\s*{[^}]*}/g, "")
            // Remove type imports
            .replace(/import\s+type\s+{[^}]*}\s+from\s+['"][^'"]*['"];?/g, "")
            // Remove generic type parameters
            .replace(/<[A-Za-z_$][A-Za-z0-9_$<>[\]|&\s]*>/g, "")
            // Remove 'as' type assertions
            .replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$<>[\]|&\s]*/g, "");

        const compiledPath = join(
            this.tempDir,
            `${basename(scriptPath, ".ts")}.js`
        );
        writeFileSync(compiledPath, jsCode);

        if (this.config.verbose) {
            console.log(`Simple transpilation completed: ${compiledPath}`);
        }

        return compiledPath;
    }

    /**
     * Check if file is TypeScript
     */
    private isTypeScriptFile(filePath: string): boolean {
        const ext = extname(filePath).toLowerCase();
        return ext === ".ts" || ext === ".tsx";
    }

    /**
     * Spawn child process with the execution result
     */
    public spawnProcess(
        result: tse.ExecutionResult,
        options: any = {}
    ): ChildProcess {
        if (this.config.verbose) {
            console.log(`Spawning: ${result.runtime} ${result.args.join(" ")}`);
        }

        return spawn(result.runtime, result.args, {
            stdio: "inherit",
            ...options,
        });
    }

    /**
     * Clean up temporary files
     */
    public cleanup(): void {
        try {
            if (existsSync(this.tempDir)) {
                const fs = require("fs");
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            }
        } catch (error: any) {
            if (this.config.verbose) {
                console.warn(`Cleanup failed: ${error.message}`);
            }
        }
    }
}

export default TypeScriptExecutor;

