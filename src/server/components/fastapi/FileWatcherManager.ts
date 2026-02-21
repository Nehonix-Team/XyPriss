/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import {
    FileWatcherManagerDependencies,
    FileWatcherManagerOptions,
} from "../../../types/components/FWM.type";
import { UltraFastFileWatcher } from "../../service/Reload/FileWatcher";
import { HotReloader } from "../../service/Reload/HotReloader";
import { logger } from "../../../../shared/logger/Logger";
// import {
//     TypeScriptChecker,
//     TypeScriptCheckerConfig,
//     TypeCheckResult,
// } from "./typescript/TypeScriptChecker";

/**
 * FileWatcherManager - Handles all file watching and hot reload operations for FastApi.ts
 * Manages file monitoring, hot reload functionality, and server restart coordination
 */
export class FileWatcherManager {
    protected readonly options: FileWatcherManagerOptions;
    protected readonly dependencies: FileWatcherManagerDependencies;
    private fileWatcher?: UltraFastFileWatcher;
    private hotReloader?: HotReloader;
    private httpServer?: any;
    private isMainProcess = true;
    // private typeScriptChecker?: TypeScriptChecker;

    constructor(
        options: FileWatcherManagerOptions,
        dependencies: FileWatcherManagerDependencies,
    ) {
        this.options = options;
        this.dependencies = dependencies;

        if (this.options.fileWatcher?.enabled) {
            this.initializeFileWatcher();
        }

        // Initialize TypeScript checker if enabled
        // if (this.options.fileWatcher?.typeCheck?.enabled) {
        //     this.initializeTypeScriptChecker();
        // }
    }

    /**
     * Initialize file watcher and hot reloader
     */
    private initializeFileWatcher(): void {
        if (!this.options.fileWatcher?.enabled) return;

        logger.debug("fileWatcher", "Initializing file watcher...");

        // Check if we're in the main process or a child process
        this.isMainProcess = !process.env.XyPriss_CHILD_PROCESS;

        if (this.isMainProcess) {
            console.log("reloading...");
            // Main process: Initialize hot reloader for true process restart
            this.hotReloader = new HotReloader(
                {
                    enabled: true,
                    script: process.argv[1] || "index.js",
                    args: process.argv.slice(2),
                    env: process.env, // Don't set XyPriss_CHILD_PROCESS here - it will be set when spawning child processes
                    cwd: process.cwd(),
                    restartDelay: this.options.fileWatcher.restartDelay || 500,
                    maxRestarts: this.options.fileWatcher.maxRestarts || 10,
                    gracefulShutdownTimeout: 5000,
                    verbose: this.options.fileWatcher.verbose || false,
                    typescript: this.options.fileWatcher.typescript || {
                        enabled: true,
                        runner: "auto",
                        runnerArgs: [],
                        fallbackToNode: true,
                        autoDetectRunner: true,
                    },
                },
                this.options,
            );

            // Initialize file watcher for the main process
            this.fileWatcher = new UltraFastFileWatcher(
                this.options.fileWatcher,
            );
        } else {
            // Child process: Don't initialize file watcher to avoid conflicts
            logger.debug(
                "fileWatcher",
                "Running in child process mode (hot reload enabled)",
            );
        }

        logger.debug("fileWatcher", "FW initialized");
    }

    /**
     * Initialize TypeScript checker
     */
    // private initializeTypeScriptChecker(): void {
    //     if (!this.options.fileWatcher?.typeCheck?.enabled) return;
    //     logger.debug("typescript", "Initializing TypeScript checker...");

    //     const typeCheckConfig: TypeScriptCheckerConfig = {
    //         enabled: true,
    //         configFile: this.options.fileWatcher.typeCheck.configFile,
    //         watchMode: false,
    //         checkOnSave: this.options.fileWatcher.typeCheck.checkOnSave ?? true,
    //         showWarnings:
    //             this.options.fileWatcher.typeCheck.showWarnings ?? true,
    //         showInfos: this.options.fileWatcher.typeCheck.showInfos ?? false,
    //         maxErrors: this.options.fileWatcher.typeCheck.maxErrors ?? 50,
    //         excludePatterns: [
    //             "node_modules",
    //             "dist",
    //             "build",
    //             ".git",
    //             ...(this.options.fileWatcher.typeCheck.excludePatterns || []),
    //         ],
    //         includePatterns: this.options.fileWatcher.typeCheck
    //             .includePatterns || ["**/*.ts", "**/*.tsx"],
    //         verbose: this.options.fileWatcher.typeCheck.verbose ?? false,
    //     };

    //     this.typeScriptChecker = new TypeScriptChecker(typeCheckConfig);
    //     logger.debug("typescript", "TypeScript checker initialized");
    // }

    /**
     * Get file watcher instance
     */
    public getFileWatcher(): UltraFastFileWatcher | undefined {
        return this.fileWatcher;
    }

    /**
     * Get hot reloader instance
     */
    public getHotReloader(): HotReloader | undefined {
        return this.hotReloader;
    }

    /**
     * Check if file watcher is enabled
     */
    public isFileWatcherEnabled(): boolean {
        return this.options.fileWatcher?.enabled === true;
    }

    /**
     * Check if running in main process
     */
    public isInMainProcess(): boolean {
        return this.isMainProcess;
    }

    /**
     * Set HTTP server reference for restart operations
     */
    public setHttpServer(server: any): void {
        this.httpServer = server;
    }

    /**
     * Start file watcher for auto-reload (main process only)
     */
    public async startFileWatcher(): Promise<void> {
        if (!this.fileWatcher) return;

        try {
            logger.debug(
                "fileWatcher",
                " Starting file watcher for auto-reload...",
            );

            // Setup file watcher event handlers
            this.setupFileWatcherEventHandlers();

            // Start watching with restart callback
            await this.fileWatcher.startWatching(async () => {
                await this.restartServer();
            });

            logger.debug("fileWatcher", "File watcher started successfully");
        } catch (error: any) {
            logger.error(
                "fileWatcher",
                "Failed to start file watcher:",
                error.message,
            );
        }
    }

    /**
     * Start file watcher with hot reload (main process)
     */
    public async startFileWatcherWithHotReload(): Promise<void> {
        if (!this.fileWatcher || !this.hotReloader) return;

        try {
            logger.debug(
                "fileWatcher",
                "Starting file watcher with hot reload...",
            );

            // Setup file watcher event handlers for hot reload
            this.setupHotReloadEventHandlers();

            // Start watching with hot reload callback
            await this.fileWatcher.startWatching(async () => {
                await this.triggerHotReload();
            });

            logger.debug(
                "fileWatcher",
                "File watcher with hot reload started successfully",
            );
        } catch (error: any) {
            logger.error(
                "fileWatcher",
                "Failed to start file watcher with hot reload:",
                error.message,
            );
        }
    }

    /**
     * Setup hot reload event handlers
     */
    private setupHotReloadEventHandlers(): void {
        if (!this.fileWatcher || !this.hotReloader) return;

        this.fileWatcher.on("file:changed", async (event: any) => {
            if (this.options.fileWatcher?.verbose) {
                logger.debug("fileWatcher", `File changed: ${event.filename}`);
            }

            // Automatically check TypeScript if enabled and file is a TypeScript file
            // await this.handleTypeScriptCheck(event);
        });

        this.fileWatcher.on("restart:starting", (event: any) => {
            logger.debug(
                "fileWatcher",
                `Hot reloading due to: ${event.filename}`,
            );
        });

        this.hotReloader.on("restart:completed", (data: any) => {
            logger.debug(
                "fileWatcher",
                `Hot reload completed in ${data.duration}ms`,
            );
        });

        this.hotReloader.on("restart:failed", (data: any) => {
            logger.error("fileWatcher", `Hot reload failed: ${data.error}`);
        });
    }

    /**
     * Setup file watcher event handlers
     */
    private setupFileWatcherEventHandlers(): void {
        if (!this.fileWatcher) return;

        this.fileWatcher.on("file:changed", async (event: any) => {
            if (this.options.fileWatcher?.verbose) {
                logger.debug("fileWatcher", `File changed: ${event.filename}`);
            }

            // Automatically check TypeScript if enabled and file is a TypeScript file
            // await this.handleTypeScriptCheck(event);
        });

        this.fileWatcher.on("restart:starting", (event: any) => {
            logger.debug("fileWatcher", `Restarting due to: ${event.filename}`);
        });

        this.fileWatcher.on("restart:completed", (data: any) => {
            logger.debug(
                "fileWatcher",
                `Restart completed in ${data.duration}ms`,
            );
        });

        this.fileWatcher.on("restart:failed", (data: any) => {
            logger.error("fileWatcher", `Restart failed: ${data.error}`);
        });
    }

    /**
     * Trigger hot reload (true process restart)
     */
    private async triggerHotReload(): Promise<void> {
        if (!this.hotReloader) {
            logger.warn(
                "fileWatcher",
                "Hot reloader not available, falling back to regular restart",
            );
            await this.restartServer();
            return;
        }

        // try {
        //     // Check TypeScript types before restarting if enabled
        //     if (
        //         this.typeScriptChecker &&
        //         this.options.fileWatcher?.typeCheck?.checkBeforeRestart
        //     ) {
        //         logger.debug(
        //             "typescript",
        //             "Checking TypeScript types before restart..."
        //         );
        //         const typeCheckResult =
        //             await this.typeScriptChecker.checkFiles();

        //         if (
        //             !typeCheckResult.success &&
        //             this.options.fileWatcher?.typeCheck?.failOnError
        //         ) {
        //             logger.error(
        //                 "typescript",
        //                 "❌ TypeScript errors found, skipping restart"
        //             );
        //             logger.error(
        //                 "typescript",
        //                 `Found ${typeCheckResult.errors.length} errors`
        //             );
        //             return;
        //         }

        //         if (typeCheckResult.errors.length > 0) {
        //             logger.warn(
        //                 "typescript",
        //                 `TypeScript errors found but continuing restart (${typeCheckResult.errors.length} errors)`
        //             );
        //         }
        //     }

        //     logger.debug(
        //         "fileWatcher",
        //         "Triggering hot reload (process restart)..."
        //     );
        //     await this.hotReloader.restart();
        // } catch (error: any) {
        //     logger.error("fileWatcher", "Hot reload failed:", error.message);
        //     // Fallback to regular restart
        //     logger.debug("fileWatcher", "Falling back to regular restart...");
        //     await this.restartServer();
        // }
    }

    /**
     * Restart server (for file watcher) with hot reload
     * Uses HotReloader for true process restart with TypeScript support
     */
    private async restartServer(): Promise<void> {
        try {
            logger.info("fileWatcher", "🔄 Hot reloading server...");

            // Use hot reloader for true process restart (supports TypeScript)
            if (this.hotReloader) {
                await this.hotReloader.restart();
                return;
            }

            // This should not happen if FileWatcherManager is properly initialized
            logger.error(
                "fileWatcher",
                "❌ HotReloader not available - this indicates a configuration issue",
            );
            throw new Error(
                "HotReloader not initialized. Cannot perform hot reload.",
            );
        } catch (error: any) {
            logger.error(
                "fileWatcher",
                "Server hot reload failed:",
                error.message,
            );
            throw error;
        }
    }

    /**
     * Stop file watcher
     */
    public async stopFileWatcher(): Promise<void> {
        if (this.fileWatcher) {
            await this.fileWatcher.stopWatching();
            logger.debug("fileWatcher", "File watcher stopped");
        }
    }

    /**
     * Get file watcher status
     */
    public getFileWatcherStatus(): any {
        return this.fileWatcher?.getStatus() || null;
    }

    /**
     * Get file watcher restart stats
     */
    public getFileWatcherStats(): any {
        return this.fileWatcher?.getRestartStats() || null;
    }

    /**
     * Check TypeScript files for errors
     */
    public async checkTypeScript(files?: string[]): Promise<any> {
        // if (!this.typeScriptChecker) {
        //     return {
        //         success: false,
        //         errors: [
        //             {
        //                 file: "system",
        //                 line: 0,
        //                 column: 0,
        //                 message: "TypeScript checker not initialized",
        //                 code: 0,
        //                 severity: "error",
        //                 category: "system",
        //                 source: "FileWatcherManager",
        //             },
        //         ],
        //         warnings: [],
        //         totalFiles: 0,
        //         checkedFiles: [],
        //         duration: 0,
        //         timestamp: new Date(),
        //     };
        // }
        // return await this.typeScriptChecker.checkFiles(files);
    }

    /**
     * Get TypeScript checker status
     */
    public getTypeScriptStatus(): any {
        // return this.typeScriptChecker?.getStatus() || null;
    }

    /**
     * Enable TypeScript checking
     */
    public enableTypeScriptChecking(): void {
        // if (this.typeScriptChecker) {
        //     this.typeScriptChecker.setEnabled(true);
        // } else {
        //     logger.warn("typescript", "TypeScript checker not initialized");
        // }
    }

    /**
     * Disable TypeScript checking
     */
    public disableTypeScriptChecking(): void {
        // if (this.typeScriptChecker) {
        //     this.typeScriptChecker.setEnabled(false);
        // } else {
        //     logger.warn("typescript", "TypeScript checker not initialized");
        // }
    }

    /**
     * Handle automatic TypeScript checking when files change
     */
    // private async handleTypeScriptCheck(event: any): Promise<void> {
    //     if (
    //         !this.typeScriptChecker ||
    //         !this.options.fileWatcher?.typeCheck?.checkOnSave
    //     ) {
    //         return;
    //     }

    //     // Only check TypeScript files
    //     const filename = event.filename || event.path || "";
    //     if (!filename.endsWith(".ts") && !filename.endsWith(".tsx")) {
    //         return;
    //     }

    //     try {
    //         logger.debug("typescript", `Checking TypeScript for: ${filename}`);

    //         const result = await this.typeScriptChecker.checkFiles([filename]);

    //         if (result.errors.length > 0) {
    //             logger.error(
    //                 "typescript",
    //                 `❌ TypeScript errors in ${filename}:`
    //             );
    //             result.errors.slice(0, 3).forEach((error) => {
    //                 logger.error(
    //                     "typescript",
    //                     `  Line ${error.line}: ${error.message} (TS${error.code})`
    //                 );
    //             });
    //             if (result.errors.length > 3) {
    //                 logger.error(
    //                     "typescript",
    //                     `  ... and ${result.errors.length - 3} more errors`
    //                 );
    //             }
    //         } else {
    //             if (this.options.fileWatcher?.typeCheck?.verbose) {
    //                 logger.info(
    //                     "typescript",
    //                     `✔ No TypeScript errors in ${filename}`
    //                 );
    //             }
    //         }

    //         if (
    //             result.warnings.length > 0 &&
    //             this.options.fileWatcher?.typeCheck?.showWarnings
    //         ) {
    //             logger.warn(
    //                 "typescript",
    //                 `TypeScript warnings in ${filename}:`
    //             );
    //             result.warnings.slice(0, 2).forEach((warning) => {
    //                 logger.warn(
    //                     "typescript",
    //                     `  Line ${warning.line}: ${warning.message} (TS${warning.code})`
    //                 );
    //             });
    //             if (result.warnings.length > 2) {
    //                 logger.warn(
    //                     "typescript",
    //                     `  ... and ${result.warnings.length - 2} more warnings`
    //                 );
    //             }
    //         }
    //     } catch (error: any) {
    //         logger.warn(
    //             "typescript",
    //             `Failed to check TypeScript for ${filename}: ${error.message}`
    //         );
    //     }
    // }

    /**
     * Add file watcher monitoring endpoints
     */
    public addFileWatcherMonitoringEndpoints(basePoint: string): void {
        if (!this.fileWatcher || !this.options.fileWatcher?.enabled) return;

        // File watcher status endpoint
        this.dependencies.app.get(
            basePoint + "/health/filewatcher",
            async (req, res) => {
                try {
                    const status = this.getFileWatcherStatus();
                    const stats = this.getFileWatcherStats();

                    res.json({
                        timestamp: new Date().toISOString(),
                        fileWatcher: {
                            status,
                            stats,
                        },
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get file watcher status",
                        message: error.message,
                    });
                }
            },
        );

        // File watcher control endpoint
        this.dependencies.app.post(
            basePoint + "/filewatcher/control",
            async (req, res) => {
                try {
                    const { action } = req.body;

                    if (action === "stop") {
                        await this.stopFileWatcher();
                        res.json({
                            success: true,
                            message: "File watcher stopped",
                        });
                    } else if (action === "start") {
                        await this.startFileWatcher();
                        res.json({
                            success: true,
                            message: "File watcher started",
                        });
                    } else if (action === "restart") {
                        await this.stopFileWatcher();
                        await this.startFileWatcher();
                        res.json({
                            success: true,
                            message: "File watcher restarted",
                        });
                    } else if (action === "reset-stats") {
                        if (this.fileWatcher) {
                            this.fileWatcher.resetStats();
                        }
                        res.json({
                            success: true,
                            message: "File watcher stats reset",
                        });
                    } else {
                        res.status(400).json({
                            error: "Invalid action. Use 'start', 'stop', 'restart', or 'reset-stats'",
                        });
                    }
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to control file watcher",
                        message: error.message,
                    });
                }
            },
        );
    }
}

