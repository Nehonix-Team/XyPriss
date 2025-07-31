/**
 *  Ultra-Fast File Watcher for Auto-Reload
 * High-performance alternative to nodemon with advanced features
 */

import { watch, FSWatcher, Stats, promises as fs } from "fs";
import { join, extname, relative, dirname, basename, resolve } from "path";
import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import * as crypto from "crypto";
import {
    FileWatcherConfig,
    BatchChangeEvent,
    FileChangeEvent,
    RestartStats,
    WatcherHealth,
} from "./types/fw.types";
import { DEFAULT_FW_CONFIG } from "../../const/FileWatcher.config";

export class UltraFastFileWatcher extends EventEmitter {
    private config: FileWatcherConfig;
    private watchers: Map<string, FSWatcher> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private batchTimer?: NodeJS.Timeout;
    private pendingChanges: FileChangeEvent[] = [];
    private fileHashes: Map<string, string> = new Map();
    private isWatching = false;
    private startTime = Date.now();
    private restartStats: RestartStats;
    private health: WatcherHealth;
    private restartCallback?: () => Promise<void>;
    private childProcess?: ChildProcess;
    private healthCheckTimer?: NodeJS.Timeout;
    private customIgnorePatterns: RegExp[] = [];
    private lastRestartTime = 0;

    constructor(config: Partial<FileWatcherConfig> = {}) {
        super();
        this.setMaxListeners(50); // Increase max listeners for better performance

        this.config = {
            ...DEFAULT_FW_CONFIG,
            ...config,
        };

        this.restartStats = {
            totalRestarts: 0,
            lastRestart: null,
            averageRestartTime: 0,
            fastestRestart: Infinity,
            slowestRestart: 0,
            successfulRestarts: 0,
            failedRestarts: 0,
            restartHistory: [],
        };

        this.health = {
            isHealthy: true,
            uptime: 0,
            memoryUsage: process.memoryUsage(),
            activeConnections: 0,
            lastHealthCheck: new Date(),
            errors: [],
        };

        this.setupProcessHandlers();
        this.loadCustomIgnorePatterns();
    }

    /**
     * Setup process handlers for graceful shutdown
     */
    private setupProcessHandlers(): void {
        const gracefulShutdown = async (signal: string) => {
            await this.stopWatching();
            process.exit(0);
        };

        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("uncaughtException", (error) => {
            console.error("Uncaught Exception:", error);
            this.logError("Uncaught Exception", error.message);
        });
        process.on("unhandledRejection", (reason) => {
            console.error("Unhandled Rejection:", reason);
            this.logError("Unhandled Rejection", String(reason));
        });
    }

    /**
     * Load custom ignore patterns from file
     */
    private async loadCustomIgnorePatterns(): Promise<void> {
        try {
            const ignoreFile = join(
                process.cwd(),
                this.config.customIgnoreFile
            );
            const content = await fs.readFile(ignoreFile, "utf8");

            this.customIgnorePatterns = content
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith("#"))
                .map((pattern) => {
                    try {
                        // Convert glob-like patterns to regex
                        const regexPattern = pattern
                            .replace(/\./g, "\\.")
                            .replace(/\*/g, ".*")
                            .replace(/\?/g, ".");
                        return new RegExp(regexPattern);
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean) as RegExp[];

            if (this.config.verbose) {
                console.log(
                    `Loaded ${this.customIgnorePatterns.length} custom ignore patterns`
                );
            }
        } catch {
            // Ignore if file doesn't exist
        }
    }

    /**
     * Start watching files with  initialization
     */
    public async startWatching(
        restartCallback?: () => Promise<void>
    ): Promise<void> {
        if (!this.config.enabled) {
            console.log("File watcher disabled");
            return;
        }

        if (this.isWatching) {
            console.log("File watcher already running");
            return;
        }

        this.restartCallback = restartCallback;
        this.startTime = Date.now();

        try {
            if (this.config.clearScreen) {
                console.clear();
            }

            if (this.config.showBanner) {
                this.showBanner();
            }

            // console.log("Starting  file watcher...");

            // Validate watch paths
            await this.validateWatchPaths();

            // Start watching directories
            const watchPromises = this.config.watchPaths.map((path) =>
                this.watchDirectory(path)
            );

            if (this.config.parallelProcessing) {
                await Promise.allSettled(watchPromises);
            } else {
                for (const promise of watchPromises) {
                    await promise;
                }
            }

            this.isWatching = true;

            // Start health check
            if (this.config.healthCheck) {
                this.startHealthCheck();
            }

            this.emit("watcher:started", {
                watchPaths: this.config.watchPaths,
                extensions: this.config.extensions,
                config: this.config,
            });

            // console.log(`File watcher started successfully!`);
            // console.log(`Watching ${this.config.watchPaths.length} paths`);
            // console.log(`Extensions: ${this.config.extensions.join(", ")}`);
            // console.log(`   Debounce: ${this.config.debounceMs}ms`);
            // console.log(
            //     `   Batch changes: ${
            //         this.config.batchChanges ? "enabled" : "disabled"
            //     }`
            // );

            if (this.config.verbose) {
                console.log(`   Paths: ${this.config.watchPaths.join(", ")}`);
                console.log(
                    `   Ignored: ${this.config.ignorePaths.length} paths, ${
                        this.config.ignorePatterns.length +
                        this.customIgnorePatterns.length
                    } patterns`
                );
            }
        } catch (error: any) {
            console.error("Failed to start file watcher:", error.message);
            this.logError("Start watcher failed", error.message);
            throw error;
        }
    }

    /**
     *  directory watching with better error handling
     */
    private async watchDirectory(watchPath: string): Promise<void> {
        try {
            const fullPath = resolve(process.cwd(), watchPath);

            // Check if path exists
            const stats = await fs.stat(fullPath).catch(() => null);
            if (!stats) {
                console.warn(`Path does not exist: ${watchPath}`);
                return;
            }

            if (!stats.isDirectory()) {
                console.warn(`Path is not a directory: ${watchPath}`);
                return;
            }

            const watcher = watch(
                fullPath,
                {
                    recursive: true,
                    persistent: this.config.persistentWatching,
                },
                async (eventType, filename) => {
                    if (!filename) return;

                    await this.handleWatchEvent(eventType, filename, fullPath);
                }
            );

            watcher.on("error", (error) => {
                console.error(`Watcher error for ${watchPath}:`, error.message);
                this.logError(`Watcher error: ${watchPath}`, error.message);

                // Attempt to restart this watcher
                setTimeout(() => this.restartWatcher(watchPath), 1000);
            });

            watcher.on("close", () => {
                if (this.config.verbose) {
                    console.log(`Watcher closed for: ${watchPath}`);
                }
            });

            this.watchers.set(watchPath, watcher);
            this.health.activeConnections++;

            if (this.config.verbose) {
                console.log(`Watching: ${watchPath}`);
            }
        } catch (error: any) {
            console.error(
                `Failed to watch directory ${watchPath}:`,
                error.message
            );
            this.logError(
                `Watch directory failed: ${watchPath}`,
                error.message
            );
        }
    }

    /**
     * Handle watch events with  processing
     */
    private async handleWatchEvent(
        eventType: string,
        filename: string,
        basePath: string
    ): Promise<void> {
        try {
            const filePath = join(basePath, filename);
            const relativePath = relative(process.cwd(), filePath);

            // Skip if should be ignored
            if (this.shouldIgnoreFile(relativePath, filename)) {
                return;
            }

            // Get file stats
            let stats: Stats | null = null;
            let isDirectory = false;
            let size = 0;

            try {
                stats = await fs.stat(filePath);
                isDirectory = stats.isDirectory();
                size = stats.size;

                // Skip large files
                if (
                    !isDirectory &&
                    size > this.config.maxFileSize * 1024 * 1024
                ) {
                    if (this.config.verbose) {
                        console.log(
                            `Skipping large file: ${filename} (${(
                                size /
                                1024 /
                                1024
                            ).toFixed(2)}MB)`
                        );
                    }
                    return;
                }

                // Skip empty files if configured
                if (
                    this.config.excludeEmptyFiles &&
                    size === 0 &&
                    !isDirectory
                ) {
                    return;
                }
            } catch {
                // File might have been deleted
            }

            // Check file extension for non-directories
            if (!isDirectory && !this.shouldWatchFile(filename)) {
                return;
            }

            // Generate hash for content comparison if enabled
            let hash: string | undefined;
            let previousHash: string | undefined;

            if (this.config.enableFileHashing && !isDirectory && stats) {
                try {
                    const content = await fs.readFile(filePath);
                    hash = crypto
                        .createHash("md5")
                        .update(content)
                        .digest("hex");
                    previousHash = this.fileHashes.get(filePath);

                    // Skip if content hasn't actually changed
                    if (previousHash === hash) {
                        return;
                    }

                    this.fileHashes.set(filePath, hash);
                } catch {
                    // Ignore hash errors
                }
            }

            const changeEvent: FileChangeEvent = {
                type: this.getEventType(eventType, stats !== null),
                filename: basename(filename),
                fullPath: filePath,
                relativePath,
                timestamp: new Date(),
                size,
                hash,
                previousHash,
                isDirectory,
                stats: stats || undefined,
            };

            if (this.config.batchChanges) {
                this.addToBatch(changeEvent);
            } else {
                this.handleFileChange(changeEvent);
            }
        } catch (error: any) {
            if (this.config.verbose) {
                console.error(`Error handling watch event:`, error.message);
            }
        }
    }

    /**
     * Add change to batch processing
     */
    private addToBatch(event: FileChangeEvent): void {
        this.pendingChanges.push(event);

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        this.batchTimer = setTimeout(() => {
            this.processBatch();
        }, this.config.batchTimeout);
    }

    /**
     * Process batched changes
     */
    private processBatch(): void {
        if (this.pendingChanges.length === 0) return;

        const startTime = Date.now();
        const changes = [...this.pendingChanges];
        this.pendingChanges = [];

        const batchEvent: BatchChangeEvent = {
            changes,
            totalFiles: changes.length,
            timestamp: new Date(),
            duration: 0,
        };

        if (this.config.verbose) {
            console.log(`Processing batch of ${changes.length} changes`);
        }

        // Process the most recent change for restart
        const latestChange = changes[changes.length - 1];
        this.processFileChange(latestChange, changes.length);

        batchEvent.duration = Date.now() - startTime;
        this.emit("batch:processed", batchEvent);
    }

    /**
     *  file change handling
     */
    private handleFileChange(event: FileChangeEvent): void {
        const key = event.fullPath;

        // Clear existing timer
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set debounced timer
        const timer = setTimeout(() => {
            this.processFileChange(event);
            this.debounceTimers.delete(key);
        }, this.config.debounceMs);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Process file change with  logic
     */
    private async processFileChange(
        event: FileChangeEvent,
        batchSize = 1
    ): Promise<void> {
        try {
            if (this.config.verbose) {
                const batchInfo =
                    batchSize > 1 ? ` (batch of ${batchSize})` : "";
                console.log(
                    `File ${event.type}: ${event.relativePath}${batchInfo}`
                );
            }

            this.emit("file:changed", event);

            // Check restart limits with time-based reset
            const now = Date.now();
            if (now - this.lastRestartTime > this.config.resetRestartsAfter) {
                this.restartStats.totalRestarts = 0;
                this.lastRestartTime = now;
            }

            if (this.restartStats.totalRestarts >= this.config.maxRestarts) {
                console.warn(
                    `Maximum restarts (${this.config.maxRestarts}) reached. Auto-reload paused.`
                );
                console.warn(
                    `   Will reset after ${Math.round(
                        this.config.resetRestartsAfter / 60000
                    )} minutes.`
                );
                return;
            }

            // Trigger restart
            await this.triggerRestart(event, batchSize);
        } catch (error: any) {
            console.error("Failed to process file change:", error.message);
            this.logError("Process file change failed", error.message);
        }
    }

    /**
     *  server restart with better error handling
     */
    private async triggerRestart(
        event: FileChangeEvent,
        fileCount = 1
    ): Promise<void> {
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage();

        try {
            const fileInfo = fileCount > 1 ? ` (${fileCount} files)` : "";
            console.log(
                `Restarting server due to changes ${fileInfo}: ${event.relativePath}`
            );

            this.emit("restart:starting", { event, fileCount });

            // Graceful shutdown of previous process
            if (this.childProcess && this.config.gracefulShutdown) {
                await this.gracefulShutdown();
            }

            // Add restart delay
            if (this.config.restartDelay > 0) {
                await new Promise((resolve) =>
                    setTimeout(resolve, this.config.restartDelay)
                );
            }

            // Execute restart callback
            if (this.restartCallback) {
                await Promise.race([
                    this.restartCallback(),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Restart timeout")),
                            30000
                        )
                    ),
                ]);
            }

            const duration = Date.now() - startTime;
            this.updateRestartStats(
                event.relativePath,
                duration,
                true,
                fileCount,
                memoryBefore
            );

            this.emit("restart:completed", {
                event,
                duration,
                success: true,
                fileCount,
            });

            // const speedEmoji =
            //     duration < 500 ? "⚡" : duration < 1000 ? "" : "🔄";
            //${speedEmoji}
            console.log(` Server restarted successfully (${duration}ms)`);
        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.updateRestartStats(
                event.relativePath,
                duration,
                false,
                fileCount,
                memoryBefore
            );

            this.emit("restart:failed", {
                event,
                error: error.message,
                duration,
                fileCount,
            });

            console.error(
                `Server restart failed (${duration}ms): ${error.message}`
            );
            this.logError("Server restart failed", error.message);
        }
    }

    /**
     * Graceful shutdown of child process
     */
    private async gracefulShutdown(): Promise<void> {
        if (!this.childProcess) return;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.childProcess) {
                    this.childProcess.kill("SIGKILL");
                }
                resolve();
            }, this.config.gracefulShutdownTimeout);

            this.childProcess!.on("exit", () => {
                clearTimeout(timeout);
                resolve();
            });

            this.childProcess!.kill("SIGTERM");
        });
    }

    /**
     *  restart statistics
     */
    private updateRestartStats(
        filename: string,
        duration: number,
        success: boolean,
        fileCount: number,
        memoryUsage: NodeJS.MemoryUsage
    ): void {
        this.restartStats.totalRestarts++;
        this.restartStats.lastRestart = new Date();

        if (success) {
            this.restartStats.successfulRestarts++;
            this.restartStats.fastestRestart = Math.min(
                this.restartStats.fastestRestart,
                duration
            );
            this.restartStats.slowestRestart = Math.max(
                this.restartStats.slowestRestart,
                duration
            );
        } else {
            this.restartStats.failedRestarts++;
        }

        this.restartStats.restartHistory.push({
            timestamp: new Date(),
            reason: `File changed: ${filename}`,
            duration,
            success,
            fileCount,
            memoryUsage,
        });

        // Keep only last 50 restart records
        if (this.restartStats.restartHistory.length > 50) {
            this.restartStats.restartHistory =
                this.restartStats.restartHistory.slice(-50);
        }

        // Calculate average restart time (successful only)
        const successfulRestarts = this.restartStats.restartHistory.filter(
            (r) => r.success
        );
        if (successfulRestarts.length > 0) {
            const totalDuration = successfulRestarts.reduce(
                (sum, r) => sum + r.duration,
                0
            );
            this.restartStats.averageRestartTime =
                totalDuration / successfulRestarts.length;
        }
    }

    /**
     *  file filtering with pattern matching
     */
    private shouldIgnoreFile(filePath: string, filename: string): boolean {
        // Check ignore paths
        if (
            this.config.ignorePaths.some(
                (ignorePath) =>
                    filePath.includes(ignorePath) ||
                    filePath.startsWith(ignorePath)
            )
        ) {
            return true;
        }

        // Check ignore patterns
        if (
            this.config.ignorePatterns.some((pattern) => pattern.test(filePath))
        ) {
            return true;
        }

        // Check custom ignore patterns
        if (
            this.customIgnorePatterns.some((pattern) => pattern.test(filePath))
        ) {
            return true;
        }

        // Check dot files
        if (
            !this.config.watchDotFiles &&
            filename.startsWith(".") &&
            filename !== ".env"
        ) {
            return true;
        }

        return false;
    }

    /**
     *  file extension checking
     */
    private shouldWatchFile(filename: string): boolean {
        const ext = extname(filename).toLowerCase();
        return (
            this.config.extensions.length === 0 ||
            this.config.extensions.includes(ext)
        );
    }

    /**
     * Get proper event type
     */
    private getEventType(
        eventType: string,
        fileExists: boolean
    ): FileChangeEvent["type"] {
        switch (eventType) {
            case "change":
                return "change";
            case "rename":
                return fileExists ? "add" : "delete";
            default:
                return "change";
        }
    }

    /**
     * Validate watch paths
     */
    private async validateWatchPaths(): Promise<void> {
        const validPaths: string[] = [];

        for (const path of this.config.watchPaths) {
            try { 
                const fullPath = resolve(process.cwd(), path);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    validPaths.push(path);
                } else {
                    console.warn(`Skipping non-directory path: ${path}`);
                }
            } catch {
                // console.warn(`Skipping non-existent path: ${path}`);
            }
        }

        if (validPaths.length === 0) {
            throw new Error("No valid watch paths found");
        }

        this.config.watchPaths = validPaths;
    }

    /**
     * Restart a specific watcher
     */
    private async restartWatcher(watchPath: string): Promise<void> {
        if (!this.isWatching) return;

        try {
            console.log(`Restarting watcher for: ${watchPath}`);

            const existingWatcher = this.watchers.get(watchPath);
            if (existingWatcher) {
                existingWatcher.close();
                this.watchers.delete(watchPath);
                this.health.activeConnections--;
            }

            await this.watchDirectory(watchPath);
            console.log(`Watcher restarted for: ${watchPath}`);
        } catch (error: any) {
            console.error(
                `Failed to restart watcher for ${watchPath}:`,
                error.message
            );
            this.logError(
                `Restart watcher failed: ${watchPath}`,
                error.message
            );
        }
    }

    /**
     * Start health monitoring
     */
    private startHealthCheck(): void {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Perform health check
     */
    private performHealthCheck(): void {
        const now = Date.now();
        const memoryUsage = process.memoryUsage();
        const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

        this.health.uptime = now - this.startTime;
        this.health.memoryUsage = memoryUsage;
        this.health.lastHealthCheck = new Date();
        this.health.isHealthy = memoryMB < this.config.memoryLimit;

        if (!this.health.isHealthy) {
            console.warn(
                `High memory usage: ${memoryMB.toFixed(2)}MB (limit: ${
                    this.config.memoryLimit
                }MB)`
            );
            this.logError("High memory usage", `${memoryMB.toFixed(2)}MB`);
        }

        this.emit("health:check", this.health);

        if (this.config.verbose) {
            console.log(
                `Health check: ${
                    this.health.isHealthy ? "OK" : "WARNING"
                } (${memoryMB.toFixed(2)}MB)`
            );
        }
    }

    /**
     * Log error to health system
     */
    private logError(type: string, message: string): void {
        this.health.errors.push({
            timestamp: new Date(),
            error: `${type}: ${message}`,
            resolved: false,
        });

        // Keep only last 20 errors
        if (this.health.errors.length > 20) {
            this.health.errors = this.health.errors.slice(-20);
        }
    }

    /**
     * Show startup banner
     */
    private showBanner(): void {
        // console.log("╔════════════════════════════════════════╗");
        // console.log("║                UF - Watcher            ║");
        // console.log("║        High-Performance File Monitor   ║");
        // console.log("║              Powered By Nehonix        ║");
        // console.log("╚════════════════════════════════════════╝");
        // console.log("");
    }

    /**
     *  stop watching with cleanup
     */
    public async stopWatching(): Promise<void> {
        if (!this.isWatching) return;

        try {
            console.log("Stopping file watcher...");

            // Stop health check
            if (this.healthCheckTimer) {
                clearInterval(this.healthCheckTimer);
                this.healthCheckTimer = undefined;
            }

            // Clear batch timer
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = undefined;
            }

            // Process any pending batch
            if (this.pendingChanges.length > 0) {
                this.processBatch();
            }

            // Clear debounce timers
            for (const timer of this.debounceTimers.values()) {
                clearTimeout(timer);
            }
            this.debounceTimers.clear();

            // Close all watchers
            const closePromises = Array.from(this.watchers.entries()).map(
                ([path, watcher]) =>
                    new Promise<void>((resolve) => {
                        try {
                            watcher.close();
                            resolve();
                        } catch (error) {
                            console.warn(`Failed to close watcher for ${path}`);
                            resolve();
                        }
                    })
            );

            await Promise.allSettled(closePromises);

            this.watchers.clear();
            this.fileHashes.clear();
            this.health.activeConnections = 0;
            this.isWatching = false;

            // Graceful shutdown of child process
            if (this.childProcess && this.config.gracefulShutdown) {
                await this.gracefulShutdown();
            }

            this.emit("watcher:stopped", {
                uptime: Date.now() - this.startTime,
                stats: this.restartStats,
            });
        } catch (error: any) {
            this.logError("Stop watcher failed", error.message);
        }
    }

    /**
     * Get restart statistics
     */
    public getRestartStats(): RestartStats {
        return { ...this.restartStats };
    }

    /**
     * Get watcher status
     */
    public getStatus(): {
        isWatching: boolean;
        watchedPaths: string[];
        activeWatchers: number;
        config: FileWatcherConfig;
        stats: RestartStats;
    } {
        return {
            isWatching: this.isWatching,
            watchedPaths: Array.from(this.watchers.keys()),
            activeWatchers: this.watchers.size,
            config: this.config,
            stats: this.getRestartStats(),
        };
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<FileWatcherConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.emit("config:updated", this.config);
    }

    /**
     * Reset restart statistics
     */
    public resetStats(): void {
        this.restartStats = {
            totalRestarts: 0,
            lastRestart: null,
            averageRestartTime: 0,
            restartHistory: [],
            successfulRestarts: 0,
            failedRestarts: 0,
            fastestRestart: Infinity,
            slowestRestart: 0,
        };
        this.emit("stats:reset");
    }
}

export default UltraFastFileWatcher;

