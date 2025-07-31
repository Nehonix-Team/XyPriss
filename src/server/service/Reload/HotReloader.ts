/**
 * Enhanced Hot Reloader with QuickDev Integration
 * Integrates with powerful Go-based QuickDev service with fallback to local implementation
 * Enables real hot reload by restarting the entire process
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { existsSync, promises as fs } from "fs";
import { join } from "path";
import { HotReloaderConfig } from "./types/hotreloader";
import { DEFAULT_FW_CONFIG } from "../../const/FileWatcher.config";
import { TypeScriptExecutor } from "./exec/TypeScriptExecutor";
import { Logger } from "../../utils/Logger";
import { ServerOptions } from "../../../ServerFactory";
import { FileWatcherManagerOptions } from "../../../types/components/FWM.type";

export class HotReloader extends EventEmitter {
    private config: HotReloaderConfig;
    private childProcess?: ChildProcess;
    private isRunning = false;
    private restartCount = 0;
    private lastRestart = 0;
    private tsExecutor: TypeScriptExecutor;
    private standaloneExecutablePath?: string;
    private logger: Logger;

    // QuickDev integration
    private quickdevProcess?: ChildProcess;
    private isQuickDevAvailable = false;
    private useQuickDev = true; // Prefer QuickDev by default
    private quickdevConfigPath?: string;
    private FWConfig: FileWatcherManagerOptions;

    constructor(
        config: Partial<HotReloaderConfig> = {},
        FWConfig: FileWatcherManagerOptions
    ) {
        super();

        this.config = {
            enabled: true,
            script: process.argv[1] || "index.js",
            args: process.argv.slice(2),
            env: { ...process.env },
            cwd: process.cwd(),
            restartDelay: 500,
            maxRestarts: DEFAULT_FW_CONFIG.maxRestarts,
            gracefulShutdownTimeout: 5000,
            verbose: false,
            typescript: {
                enabled: true,
                runner: "auto",
                runnerArgs: [],
                fallbackToNode: true,
                autoDetectRunner: true,
                enableRuntimeCompilation: true,
            },
            ...config,
        };

        this.FWConfig = FWConfig;
        // Initialize logger
        this.logger = new Logger({
            enabled: true,
            level: this.config.verbose ? "debug" : "info",
            components: { fileWatcher: true },
            types: {
                hotReload: true,
                startup: true,
                warnings: true,
                errors: true,
            },
        });

        // Initialize TypeScript executor
        this.tsExecutor = new TypeScriptExecutor({
            verbose: this.config.verbose,
            fallbackToNode: this.config.typescript?.fallbackToNode ?? true,
            compilerOptions: this.config.typescript?.compilerOptions,
        });

        // Check for standalone executable
        this.checkStandaloneExecutable();

        // Check QuickDev availability (synchronous check first)
        this.checkQuickDevAvailabilitySync();

        // Then do async check for more thorough detection
        this.checkQuickDevAvailability();
    }

    /**
     * Check if QuickDev service is available (synchronous check)
     */
    private checkQuickDevAvailabilitySync(): void {
        try {
            // Quick synchronous check using which/where command
            const { execSync } = require("child_process");
            const command =
                process.platform === "win32"
                    ? "where quickdev"
                    : "which quickdev";

            execSync(command, { stdio: "pipe" });
            this.isQuickDevAvailable = true;
            this.logger.debug(
                "fileWatcher",
                "QuickDev service detected (sync check)"
            );
        } catch (error) {
            this.isQuickDevAvailable = false;
            this.logger.debug(
                "fileWatcher",
                "QuickDev service not found (sync check)"
            );
        }
    }

    /**
     * Check if QuickDev service is available (async verification)
     */
    private async checkQuickDevAvailability(): Promise<void> {
        try {
            // Check if quickdev is installed globally
            const checkProcess = spawn("quickdev", ["--help"], {
                stdio: "pipe",
                shell: true,
            });

            checkProcess.on("close", (code) => {
                // Only update if sync check didn't already detect it
                if (!this.isQuickDevAvailable) {
                    this.isQuickDevAvailable = code === 0;
                }

                if (this.isQuickDevAvailable) {
                    this.logger.debug(
                        "fileWatcher",
                        "QuickDev service detected and available"
                    );
                } else {
                    this.logger.debug(
                        "fileWatcher",
                        "QuickDev service not available, will use fallback"
                    );
                }
            });

            checkProcess.on("error", () => {
                // Only update if sync check didn't already detect it
                if (!this.isQuickDevAvailable) {
                    this.isQuickDevAvailable = false;
                    this.logger.debug(
                        "fileWatcher",
                        "QuickDev service not available, will use fallback"
                    );
                }
            });

            // Timeout after 2 seconds
            setTimeout(() => {
                if (checkProcess.pid) {
                    checkProcess.kill();
                    // Only update if sync check didn't already detect it
                    if (!this.isQuickDevAvailable) {
                        this.isQuickDevAvailable = false;
                    }
                }
            }, 2000);
        } catch (error) {
            this.isQuickDevAvailable = false;
            this.logger.debug(
                "fileWatcher",
                "QuickDev service check failed, will use fallback"
            );
        }
    }

    /**
     * Check for standalone TypeScript executable
     */
    private checkStandaloneExecutable(): void {
        const executablePaths = [
            join(
                process.cwd(),
                "dist",
                "tsr",
                process.platform === "win32" ? "tsr.cjs" : "tsr"
            ),
            join(process.cwd(), "dist", "tsr", "tsr.cmd"), // Windows batch file
            join(
                __dirname,
                "executable",
                "bin",
                process.platform === "win32" ? "tsr.exe" : "tsr"
            ),
        ];

        for (const path of executablePaths) {
            if (existsSync(path)) {
                this.standaloneExecutablePath = path;
                if (this.config.verbose) {
                    console.log(`Found standalone TSR executable: ${path}`);
                }
                break;
            }
        }

        if (!this.standaloneExecutablePath && this.config.verbose) {
            console.log(
                "No standalone TSR executable found, using TypeScript executor"
            );
        }
    }

    /**
     * Create QuickDev configuration file
     */
    private async createQuickDevConfig(): Promise<string> {
        const configPath = join(process.cwd(), "quickdev.config.json");

        const quickdevConfig = {
            script: this.config.script,
            watch: this.FWConfig.fileWatcher?.watchPaths || ["src", "config"],
            ignore: this.FWConfig.fileWatcher?.ignorePaths || [
                "node_modules",
                "dist",
                "coverage",
                ".git",
                "build",
            ],
            extensions: this.FWConfig.fileWatcher?.extensions || [
                ".ts",
                ".js",
                ".jsx",
                ".tsx",
            ],
            gracefulShutdown: true,
            gracefulShutdownTimeout: Math.floor(
                this.config.gracefulShutdownTimeout / 1000
            ),
            maxRestarts: this.config.maxRestarts,
            resetRestartsAfter: 60000,
            restartDelay: this.config.restartDelay,
            batchChanges: true,
            batchTimeout: 300,
            enableHashing: true,
            usePolling: false,
            pollingInterval: 100,
            followSymlinks: false,
            watchDotFiles: false,
            ignoreFile: ".quickdevignore",
            parallelProcessing: true,
            memoryLimit: 500,
            maxFileSize: 10,
            excludeEmptyFiles: true,
            debounceMs: 250,
            healthCheck: true,
            healthCheckInterval: 30,
            clearScreen: true,
            typescriptRunner:
                this.config.typescript?.runner === "auto"
                    ? undefined
                    : this.config.typescript?.runner,
            tsNodeFlags: this.config.typescript?.runnerArgs?.join(" "),
        };

        try {
            await fs.writeFile(
                configPath,
                JSON.stringify(quickdevConfig, null, 2)
            );
            this.logger.debug(
                "fileWatcher",
                `Created QuickDev config: ${configPath}`
            );
            this.quickdevConfigPath = configPath;
            return configPath;
        } catch (error) {
            this.logger.warn(
                "fileWatcher",
                "Failed to create QuickDev config file:",
                error
            );
            throw error;
        }
    }

    /**
     * Start the hot reloader with QuickDev integration
     */
    public async start(): Promise<void> {
        if (!this.config.enabled) {
            this.logger.info("fileWatcher", "Hot reloader disabled");
            return;
        }

        if (this.isRunning) {
            this.logger.debug("fileWatcher", "Hot reloader already running");
            return;
        }

        try {
            this.logger.info("fileWatcher", "Starting hot reloader...");

            // Wait for QuickDev availability check to complete
            await new Promise((resolve) => setTimeout(resolve, 500));

            if (this.useQuickDev && this.isQuickDevAvailable) {
                await this.startQuickDev();
            } else {
                await this.startChildProcess();
            }

            this.isRunning = true;
            this.logger.info("fileWatcher", "Hot reloader started");
        } catch (error: any) {
            this.logger.error(
                "fileWatcher",
                "Failed to start hot reloader:",
                error.message
            );

            // Try fallback if QuickDev fails
            if (
                this.useQuickDev &&
                this.isQuickDevAvailable &&
                !this.childProcess
            ) {
                this.logger.info(
                    "fileWatcher",
                    "QuickDev failed, trying fallback..."
                );
                this.isQuickDevAvailable = false;
                await this.startChildProcess();
                this.isRunning = true;
            } else {
                throw error;
            }
        }
    }

    /**
     * Start QuickDev service
     */
    private async startQuickDev(): Promise<void> {
        try {
            // Create configuration file
            await this.createQuickDevConfig();

            this.logger.debug("fileWatcher", "Starting QuickDev service...");

            // Start QuickDev process
            this.quickdevProcess = spawn(
                "quickdev",
                ["-script", this.config.script],
                {
                    cwd: this.config.cwd,
                    env: this.config.env,
                    stdio: this.config.verbose ? "inherit" : "pipe",
                    shell: true,
                }
            );

            return new Promise((resolve, reject) => {
                let resolved = false;

                // Set a timeout to prevent hanging
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        this.logger.warn(
                            "fileWatcher",
                            "QuickDev startup timeout, assuming success"
                        );
                        resolve();
                    }
                }, 5000); // 5 second timeout

                this.quickdevProcess!.on("spawn", () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.logger.debug(
                            "fileWatcher",
                            `QuickDev service started (PID: ${this.quickdevProcess?.pid})`
                        );
                        resolve();
                    }
                });

                this.quickdevProcess!.on("error", (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.logger.error(
                            "fileWatcher",
                            "QuickDev service error:",
                            error.message
                        );
                        reject(error);
                    }
                });

                this.quickdevProcess!.on("exit", (code, signal) => {
                    this.logger.debug(
                        "fileWatcher",
                        `QuickDev service exited (code: ${code}, signal: ${signal})`
                    );
                    this.emit("process:exit", { code, signal });

                    // If process exits immediately, it might be an error
                    if (!resolved && code !== 0) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(
                            new Error(
                                `QuickDev process exited with code ${code}`
                            )
                        );
                        return;
                    }

                    // Auto-restart on unexpected exit
                    if (this.isRunning && code !== 0 && !signal) {
                        this.logger.info(
                            "fileWatcher",
                            "Unexpected exit, restarting..."
                        );
                        setTimeout(
                            () => this.restart(),
                            this.config.restartDelay
                        );
                    }
                });

                // Also resolve if the process is spawned successfully (alternative check)
                setTimeout(() => {
                    if (
                        !resolved &&
                        this.quickdevProcess &&
                        this.quickdevProcess.pid
                    ) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.logger.debug(
                            "fileWatcher",
                            `QuickDev service confirmed running (PID: ${this.quickdevProcess.pid})`
                        );
                        resolve();
                    }
                }, 1000); // Check after 1 second
            });
        } catch (error) {
            throw new Error(`Failed to start QuickDev service: ${error}`);
        }
    }

    /**
     * Stop the hot reloader
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        try {
            this.logger.debug("fileWatcher", "Stopping hot reloader...");

            if (this.quickdevProcess) {
                await this.stopQuickDev();
            }

            if (this.childProcess) {
                await this.stopChildProcess();
            }

            this.isRunning = false;
            this.logger.debug("fileWatcher", "Hot reloader stopped");
        } catch (error: any) {
            this.logger.error(
                "fileWatcher",
                "Error stopping hot reloader:",
                error.message
            );
        }
    }

    /**
     * Stop QuickDev service gracefully
     */
    private async stopQuickDev(): Promise<void> {
        if (!this.quickdevProcess) return;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.quickdevProcess) {
                    this.logger.debug(
                        "fileWatcher",
                        "Force killing QuickDev service..."
                    );
                    this.quickdevProcess.kill("SIGKILL");
                }
                resolve();
            }, this.config.gracefulShutdownTimeout);

            this.quickdevProcess!.on("exit", () => {
                clearTimeout(timeout);
                resolve();
            });

            // Try graceful shutdown first
            this.logger.debug(
                "fileWatcher",
                "Sending SIGTERM to QuickDev service..."
            );
            this.quickdevProcess!.kill("SIGTERM");
        });
    }

    /**
     * Restart the child process (hot reload)
     */
    public async restart(): Promise<void> {
        if (!this.isRunning) {
            this.logger.info(
                "fileWatcher",
                "Hot reloader not running, starting..."
            );
            await this.start();
            return;
        }

        // Check restart limits
        const now = Date.now();
        if (now - this.lastRestart < this.config.restartDelay) {
            this.logger.debug("fileWatcher", "Restart too soon, waiting...");
            return;
        }

        if (this.restartCount >= this.config.maxRestarts) {
            this.logger.warn(
                "fileWatcher",
                `Maximum restarts (${this.config.maxRestarts}) reached`
            );
            return;
        }

        try {
            this.logger.hotReload("fileWatcher", "Hot reloading process...");

            const startTime = Date.now();

            // Stop current process
            if (this.quickdevProcess) {
                await this.stopQuickDev();
            }

            if (this.childProcess) {
                await this.stopChildProcess();
            }

            // Wait for restart delay
            await new Promise((resolve) =>
                setTimeout(resolve, this.config.restartDelay)
            );

            // Start new process
            if (this.useQuickDev && this.isQuickDevAvailable) {
                await this.startQuickDev();
            } else {
                await this.startChildProcess();
            }

            const duration = Date.now() - startTime;
            this.restartCount++;
            this.lastRestart = now;

            this.emit("restart:completed", {
                duration,
                restartCount: this.restartCount,
            });

            this.logger.hotReload(
                "fileWatcher",
                `Process hot reloaded (${duration}ms)`
            );
        } catch (error: any) {
            this.emit("restart:failed", { error: error.message });
            this.logger.error(
                "fileWatcher",
                "Hot reload failed:",
                error.message
            );
        }
    }

    /**
     * Check if the script is a TypeScript file
     */
    private isTypeScriptFile(script: string): boolean {
        return script.endsWith(".ts") || script.endsWith(".tsx");
    }

    /**
     * Get the appropriate runtime and arguments for the script using TypeScript executor
     */
    private async getRuntimeConfig(): Promise<{
        runtime: string;
        args: string[];
    }> {
        const isTS = this.isTypeScriptFile(this.config.script);
        const tsConfig = this.config.typescript;

        // If TypeScript is disabled or not a TS file, use default behavior
        if (!tsConfig?.enabled || !isTS) {
            const runtime = process.execPath.includes("bun") ? "bun" : "node";
            return {
                runtime,
                args: [this.config.script, ...this.config.args],
            };
        }

        // Try standalone executable first (most reliable)
        if (this.standaloneExecutablePath) {
            this.logger.debug(
                "fileWatcher",
                `Using standalone TSR executable: ${this.standaloneExecutablePath}`
            );

            // For Windows .cmd files, use node to execute the .cjs file
            if (this.standaloneExecutablePath.endsWith(".cmd")) {
                const cjsPath = this.standaloneExecutablePath.replace(
                    ".cmd",
                    ".cjs"
                );
                return {
                    runtime: "node",
                    args: [cjsPath, this.config.script, ...this.config.args],
                };
            } else if (this.standaloneExecutablePath.endsWith(".cjs")) {
                return {
                    runtime: "node",
                    args: [
                        this.standaloneExecutablePath,
                        this.config.script,
                        ...this.config.args,
                    ],
                };
            } else {
                // Unix executable
                return {
                    runtime: this.standaloneExecutablePath,
                    args: [this.config.script, ...this.config.args],
                };
            }
        }

        try {
            // Use the TypeScript executor to determine the best execution method
            const result = await this.tsExecutor.executeTypeScript(
                this.config.script,
                this.config.args
            );

            if (result.success) {
                this.logger.debug(
                    "fileWatcher",
                    `Using ${result.method}: ${
                        result.runtime
                    } ${result.args.join(" ")}`
                );
                return {
                    runtime: result.runtime,
                    args: result.args,
                };
            } else {
                throw new Error(result.error || "TypeScript execution failed");
            }
        } catch (error: any) {
            this.logger.warn(
                "fileWatcher",
                `TypeScript executor failed: ${error.message}`
            );

            // Fallback to node if TypeScript executor fails
            if (tsConfig.fallbackToNode) {
                this.logger.warn(
                    "fileWatcher",
                    "Falling back to node (may fail for TypeScript files)"
                );
                return {
                    runtime: "node",
                    args: [this.config.script, ...this.config.args],
                };
            } else {
                throw error;
            }
        }
    }

    /**
     * Start child process
     */
    private async startChildProcess(): Promise<void> {
        try {
            const { runtime, args } = await this.getRuntimeConfig();

            this.logger.debug(
                "fileWatcher",
                `Starting process with: ${runtime} ${args.join(" ")}`
            );

            return new Promise((resolve, reject) => {
                let resolved = false;

                this.childProcess = spawn(runtime, args, {
                    cwd: this.config.cwd,
                    env: {
                        ...this.config.env,
                        XyPriss_CHILD_PROCESS: "true", // Mark child processes
                    },
                    stdio: "inherit",
                    detached: false,
                });

                // Set a timeout to prevent hanging
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        this.logger.warn(
                            "fileWatcher",
                            "Child process startup timeout, assuming success"
                        );
                        resolve();
                    }
                }, 5000); // 5 second timeout

                this.childProcess.on("spawn", () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.logger.debug(
                            "fileWatcher",
                            `Child process started (PID: ${this.childProcess?.pid})`
                        );
                        resolve();
                    }
                });

                this.childProcess.on("error", async (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);

                        // Handle TypeScript runner not found error
                        if (
                            error.message.includes("ENOENT") &&
                            this.isTypeScriptFile(this.config.script)
                        ) {
                            const tsConfig = this.config.typescript;
                            if (tsConfig?.fallbackToNode) {
                                this.logger.warn(
                                    "fileWatcher",
                                    "TypeScript runner failed, falling back to node (this will likely fail for .ts files)"
                                );
                                this.logger.warn(
                                    "fileWatcher",
                                    "Install a TypeScript runner: npm install -g tsx"
                                );

                                // Retry with node
                                this.childProcess = spawn(
                                    "node",
                                    [this.config.script, ...this.config.args],
                                    {
                                        cwd: this.config.cwd,
                                        env: {
                                            ...this.config.env,
                                            XyPriss_CHILD_PROCESS: "true", // Mark child processes
                                        },
                                        stdio: "inherit",
                                        detached: false,
                                    }
                                );
                                return;
                            }
                        }

                        this.logger.error(
                            "fileWatcher",
                            "Child process error:",
                            error.message
                        );

                        // Provide helpful error messages for common issues
                        if (error.message.includes("ENOENT")) {
                            try {
                                const { runtime: errorRuntime } =
                                    await this.getRuntimeConfig();
                                this.logger.error(
                                    "fileWatcher",
                                    `Runtime '${errorRuntime}' not found. Please install it:`
                                );

                                switch (errorRuntime) {
                                    case "tsx":
                                        this.logger.error(
                                            "fileWatcher",
                                            "   npm install -g tsx"
                                        );
                                        break;
                                    case "ts-node":
                                        this.logger.error(
                                            "fileWatcher",
                                            "   npm install -g ts-node"
                                        );
                                        break;
                                    case "bun":
                                        this.logger.error(
                                            "fileWatcher",
                                            "   Visit: https://bun.sh/docs/installation"
                                        );
                                        break;
                                    default:
                                        this.logger.error(
                                            "fileWatcher",
                                            `   Make sure '${errorRuntime}' is installed and available in PATH`
                                        );
                                }
                            } catch {
                                this.logger.error(
                                    "fileWatcher",
                                    "   Make sure the runtime is installed and available in PATH"
                                );
                            }
                        }

                        reject(error);
                    }
                });

                this.childProcess.on("exit", (code, signal) => {
                    this.logger.debug(
                        "fileWatcher",
                        `Child process exited (code: ${code}, signal: ${signal})`
                    );

                    this.emit("process:exit", { code, signal });

                    // If process exits immediately, it might be an error
                    if (!resolved && code !== 0) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(
                            new Error(`Child process exited with code ${code}`)
                        );
                        return;
                    }

                    // Auto-restart on unexpected exit
                    if (this.isRunning && code !== 0 && !signal) {
                        this.logger.info(
                            "fileWatcher",
                            "Unexpected exit, restarting..."
                        );
                        setTimeout(
                            () => this.restart(),
                            this.config.restartDelay
                        );
                    }
                });

                // Also resolve if the process is spawned successfully (alternative check)
                setTimeout(() => {
                    if (
                        !resolved &&
                        this.childProcess &&
                        this.childProcess.pid
                    ) {
                        resolved = true;
                        clearTimeout(timeout);
                        this.logger.debug(
                            "fileWatcher",
                            `Child process confirmed running (PID: ${this.childProcess.pid})`
                        );
                        resolve();
                    }
                }, 1000); // Check after 1 second
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Stop child process gracefully
     */
    private async stopChildProcess(): Promise<void> {
        if (!this.childProcess) return;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.childProcess) {
                    // console.log('Force killing child process...');
                    this.childProcess.kill("SIGKILL");
                }
                resolve();
            }, this.config.gracefulShutdownTimeout);

            this.childProcess!.on("exit", () => {
                clearTimeout(timeout);
                resolve();
            });

            // Try graceful shutdown first
            this.logger.debug(
                "fileWatcher",
                "Sending SIGTERM to child process..."
            );
            this.childProcess!.kill("SIGTERM");
        });
    }

    /**
     * Get hot reloader status
     */
    public getStatus(): {
        isRunning: boolean;
        restartCount: number;
        lastRestart: number;
        childPid?: number;
        quickdevPid?: number;
        service: "quickdev" | "local" | "none";
        isQuickDevAvailable: boolean;
        config: HotReloaderConfig;
    } {
        let service: "quickdev" | "local" | "none" = "none";

        if (this.isRunning) {
            if (this.quickdevProcess) {
                service = "quickdev";
            } else if (this.childProcess) {
                service = "local";
            }
        }

        return {
            isRunning: this.isRunning,
            restartCount: this.restartCount,
            lastRestart: this.lastRestart,
            childPid: this.childProcess?.pid,
            quickdevPid: this.quickdevProcess?.pid,
            service,
            isQuickDevAvailable: this.isQuickDevAvailable,
            config: this.config,
        };
    }

    /**
     * Reset restart counter
     */
    public resetRestartCount(): void {
        this.restartCount = 0;
        this.lastRestart = 0;
        // console.log('Restart counter reset');
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<HotReloaderConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.emit("config:updated", this.config);
    }

    /**
     * Check if process is healthy
     */
    public isHealthy(): boolean {
        if (!this.isRunning) return false;

        if (this.quickdevProcess) {
            return (
                !this.quickdevProcess.killed &&
                this.restartCount < this.config.maxRestarts
            );
        }

        if (this.childProcess) {
            return (
                !this.childProcess.killed &&
                this.restartCount < this.config.maxRestarts
            );
        }

        return false;
    }

    /**
     * Get QuickDev availability status
     */
    public getQuickDevStatus(): {
        available: boolean;
        inUse: boolean;
        pid?: number;
    } {
        return {
            available: this.isQuickDevAvailable,
            inUse: this.isRunning && !!this.quickdevProcess,
            pid: this.quickdevProcess?.pid,
        };
    }

    /**
     * Force use of local reloader (disable QuickDev)
     */
    public async useLocalReloader(): Promise<void> {
        if (this.isRunning && this.quickdevProcess) {
            await this.stop();
        }

        this.useQuickDev = false;

        if (this.isRunning) {
            await this.start();
        }

        this.logger.info("fileWatcher", "Forced to use local reloader");
    }

    /**
     * Enable QuickDev if available
     */
    public async enableQuickDev(): Promise<void> {
        this.useQuickDev = true;

        if (
            this.isRunning &&
            !this.quickdevProcess &&
            this.isQuickDevAvailable
        ) {
            await this.restart();
        }

        this.logger.info("fileWatcher", "QuickDev enabled");
    }
}

export default HotReloader;

