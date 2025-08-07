/**
 * Memory management utilities for cluster operations
 */

import { EventEmitter } from "events";
import { logger } from "../../shared/logger/Logger";
import { ProcessMonitor, type SystemStats } from "./modules/ProcessMonitor";
import type {
    ClusterConfig,
    MemoryAlert,
    MemoryStats,
    WorkerMemoryStats,
} from "../types/cluster";

/**
 * Advanced memory management for cluster operations using ProcessMonitor
 */
export class MemoryManager extends EventEmitter {
    private config: ClusterConfig["resources"];
    private processMonitor: ProcessMonitor;
    private monitoringInterval?: NodeJS.Timeout;
    private memoryHistory: Map<string, number[]> = new Map();
    private lastGCHint: Map<string, number> = new Map();
    private systemStats?: SystemStats;
    private isLowMemoryMode: boolean = false;

    constructor(config?: ClusterConfig["resources"]) {
        super();
        this.config = config || {};
        this.processMonitor = new ProcessMonitor();
        this.isLowMemoryMode =
            config?.performanceOptimization?.lowMemoryMode || false;
        logger.info("cluster", "MemoryManager initialized with ProcessMonitor");
    }

    /**
     * Start memory monitoring
     */
    public startMonitoring(): void {
        const interval =
            this.config?.memoryManagement?.memoryCheckInterval || 30000;

        logger.info(
            "cluster",
            `Starting memory monitoring (interval: ${interval}ms)`
        );

        this.monitoringInterval = setInterval(async () => {
            await this.checkMemoryUsage();
        }, interval);

        // Initial check
        this.checkMemoryUsage();
    }

    /**
     * Stop memory monitoring
     */
    public stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
            logger.info("cluster", "Memory monitoring stopped");
        }
    }

    /**
     * Get system memory statistics using ProcessMonitor
     */
    public async getSystemMemoryStats(): Promise<MemoryStats> {
        try {
            // Update system stats periodically
            this.systemStats = await this.processMonitor.getSystemStats();
            const { memory, swap } = this.systemStats;

            return {
                totalMemory: memory.total,
                usedMemory: memory.used,
                freeMemory: memory.free,
                usagePercentage: memory.usagePercentage,
                swapUsed: swap.used,
                swapTotal: swap.total,
                swapPercentage: swap.usagePercentage,
            };
        } catch (error) {
            logger.error(
                "cluster",
                "Failed to get system memory stats:",
                error
            );
            // Fallback to basic OS stats
            const os = require("os");
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const usagePercentage = (usedMemory / totalMemory) * 100;

            return {
                totalMemory,
                usedMemory,
                freeMemory,
                usagePercentage,
                swapUsed: 0,
                swapTotal: 0,
                swapPercentage: 0,
            };
        }
    }

    /**
     * Get swap memory information using platform-specific methods
     */
    public getSwapMemoryInfo(): {
        swapUsed: number;
        swapTotal: number;
        swapPercentage: number;
    } {
        try {
            if (process.platform === "linux") {
                return this.getLinuxSwapInfo();
            } else if (process.platform === "darwin") {
                return this.getMacOSSwapInfo();
            } else if (process.platform === "win32") {
                return this.getWindowsSwapInfo();
            } else {
                return { swapUsed: 0, swapTotal: 0, swapPercentage: 0 };
            }
        } catch (error) {
            logger.warn("cluster", "Failed to get swap memory info:", error);
            return { swapUsed: 0, swapTotal: 0, swapPercentage: 0 };
        }
    }

    /**
     * Get swap information on Linux
     */
    private getLinuxSwapInfo(): {
        swapUsed: number;
        swapTotal: number;
        swapPercentage: number;
    } {
        try {
            const fs = require("fs");
            const meminfo = fs.readFileSync("/proc/meminfo", "utf8");

            const swapTotalMatch = meminfo.match(/SwapTotal:\s+(\d+)\s+kB/);
            const swapFreeMatch = meminfo.match(/SwapFree:\s+(\d+)\s+kB/);

            const swapTotal = swapTotalMatch
                ? parseInt(swapTotalMatch[1]) * 1024
                : 0;
            const swapFree = swapFreeMatch
                ? parseInt(swapFreeMatch[1]) * 1024
                : 0;
            const swapUsed = swapTotal - swapFree;
            const swapPercentage =
                swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;

            return { swapUsed, swapTotal, swapPercentage };
        } catch (error) {
            throw new Error(`Failed to get Linux swap info: ${error}`);
        }
    }

    /**
     * Get swap information on macOS
     */
    private getMacOSSwapInfo(): {
        swapUsed: number;
        swapTotal: number;
        swapPercentage: number;
    } {
        try {
            const { execSync } = require("child_process");
            const swapUsage = execSync("sysctl vm.swapusage", {
                encoding: "utf8",
            });

            // Parse output like: vm.swapusage: total = 2048.00M  used = 617.75M  free = 1430.25M  (encrypted)
            const totalMatch = swapUsage.match(/total = ([\d.]+)([MG])/);
            const usedMatch = swapUsage.match(/used = ([\d.]+)([MG])/);

            let swapTotal = 0;
            let swapUsed = 0;

            if (totalMatch) {
                const value = parseFloat(totalMatch[1]);
                const unit = totalMatch[2];
                swapTotal =
                    unit === "G"
                        ? value * 1024 * 1024 * 1024
                        : value * 1024 * 1024;
            }

            if (usedMatch) {
                const value = parseFloat(usedMatch[1]);
                const unit = usedMatch[2];
                swapUsed =
                    unit === "G"
                        ? value * 1024 * 1024 * 1024
                        : value * 1024 * 1024;
            }

            const swapPercentage =
                swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;
            return { swapUsed, swapTotal, swapPercentage };
        } catch (error) {
            throw new Error(`Failed to get macOS swap info: ${error}`);
        }
    }

    /**
     * Get swap information on Windows
     */
    private getWindowsSwapInfo(): {
        swapUsed: number;
        swapTotal: number;
        swapPercentage: number;
    } {
        try {
            const { execSync } = require("child_process");
            // Use wmic to get page file information
            const pageFileInfo = execSync(
                "wmic pagefile get Size,Usage /format:csv",
                { encoding: "utf8" }
            );

            const lines = pageFileInfo
                .split("\n")
                .filter(
                    (line: string) => line.trim() && !line.includes("Node")
                );
            let totalSize = 0;
            let totalUsage = 0;

            for (const line of lines) {
                const parts = line.split(",");
                if (parts.length >= 3) {
                    const size = parseInt(parts[1]) || 0;
                    const usage = parseInt(parts[2]) || 0;
                    totalSize += size;
                    totalUsage += usage;
                }
            }

            const swapTotal = totalSize * 1024 * 1024; // Convert MB to bytes
            const swapUsed = totalUsage * 1024 * 1024;
            const swapPercentage =
                swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;

            return { swapUsed, swapTotal, swapPercentage };
        } catch (error) {
            throw new Error(`Failed to get Windows swap info: ${error}`);
        }
    }

    /**
     * Get worker memory statistics using actual process monitoring
     */
    public async getWorkerMemoryStats(
        workerId: string,
        pid: number
    ): Promise<WorkerMemoryStats> {
        try {
            const processStats = await this.processMonitor.getProcessStats(pid);

            return {
                workerId,
                pid,
                memoryUsage: {
                    rss: processStats.memory.rss,
                    heapTotal: processStats.memory.heapTotal,
                    heapUsed: processStats.memory.heapUsed,
                    external: processStats.memory.external,
                    arrayBuffers: processStats.memory.arrayBuffers,
                },
                cpuUsage: processStats.cpu.usage,
                uptime: processStats.uptime,
            };
        } catch (error) {
            logger.error(
                "cluster",
                `Failed to get memory stats for worker ${workerId} (PID: ${pid}):`,
                error
            );
            // Return minimal stats on error
            return {
                workerId,
                pid,
                memoryUsage: {
                    rss: 0,
                    heapTotal: 0,
                    heapUsed: 0,
                    external: 0,
                    arrayBuffers: 0,
                },
                cpuUsage: 0,
                uptime: 0,
            };
        }
    }

    /**
     * Check if memory usage is within limits
     */
    public checkMemoryLimits(
        workerId: string,
        memoryUsage: number
    ): {
        withinLimits: boolean;
        action: "none" | "warning" | "restart" | "scale_down";
        message: string;
    } {
        const maxMemory = this.parseMemoryString(
            this.config?.maxMemoryPerWorker || "1GB"
        );
        const warningThreshold =
            this.config?.memoryManagement?.memoryWarningThreshold || 80;
        const criticalThreshold =
            this.config?.memoryManagement?.memoryCriticalThreshold || 95;

        const usagePercentage = (memoryUsage / maxMemory) * 100;

        if (usagePercentage >= criticalThreshold) {
            return {
                withinLimits: false,
                action: this.config?.enforcement?.enforceHardLimits
                    ? "restart"
                    : "scale_down",
                message: `Worker ${workerId} memory usage critical: ${usagePercentage.toFixed(
                    1
                )}%`,
            };
        }

        if (usagePercentage >= warningThreshold) {
            return {
                withinLimits: true,
                action: "warning",
                message: `Worker ${workerId} memory usage high: ${usagePercentage.toFixed(
                    1
                )}%`,
            };
        }

        return {
            withinLimits: true,
            action: "none",
            message: `Worker ${workerId} memory usage normal: ${usagePercentage.toFixed(
                1
            )}%`,
        };
    }

    /**
     * Detect memory leaks in workers
     */
    public detectMemoryLeak(workerId: string, memoryUsage: number): boolean {
        if (!this.config?.memoryManagement?.memoryLeakDetection) {
            return false;
        }

        const history = this.memoryHistory.get(workerId) || [];
        history.push(memoryUsage);

        // Keep only last 10 measurements
        if (history.length > 10) {
            history.shift();
        }

        this.memoryHistory.set(workerId, history);

        // Detect consistent memory growth
        if (history.length >= 5) {
            const trend = this.calculateMemoryTrend(history);
            const leakThreshold = 0.1; // 10% consistent growth

            if (trend > leakThreshold) {
                logger.warn(
                    "cluster",
                    `Memory leak detected in worker ${workerId}`
                );
                this.emitMemoryAlert({
                    type: "leak_detected",
                    workerId,
                    message: `Memory leak detected in worker ${workerId}`,
                    memoryUsage,
                    threshold: leakThreshold,
                    timestamp: Date.now(),
                    action: "restart_worker",
                });
                return true;
            }
        }

        return false;
    }

    /**
     * Suggest garbage collection for worker
     */
    public suggestGarbageCollection(workerId: string): boolean {
        if (!this.config?.memoryManagement?.garbageCollectionHint) {
            return false;
        }

        const lastGC = this.lastGCHint.get(workerId) || 0;
        const gcCooldown = 60000; // 1 minute cooldown

        if (Date.now() - lastGC > gcCooldown) {
            this.lastGCHint.set(workerId, Date.now());
            logger.debug(
                "cluster",
                `Suggesting garbage collection for worker ${workerId}`
            );
            return true;
        }

        return false;
    }

    /**
     * Get memory optimization recommendations
     */
    public async getMemoryOptimizationRecommendations(): Promise<{
        recommendations: string[];
        canEnableLowMemoryMode: boolean;
        suggestedWorkerCount: number;
    }> {
        const systemStats = await this.getSystemMemoryStats();
        const recommendations: string[] = [];

        if (systemStats.usagePercentage > 85) {
            recommendations.push(
                "System memory usage is high (>85%). Consider reducing worker count."
            );
        }

        if (systemStats.usagePercentage > 95) {
            recommendations.push(
                "Critical memory usage! Enable low memory mode immediately."
            );
        }

        if (
            !this.config?.performanceOptimization?.lowMemoryMode &&
            systemStats.usagePercentage > 70
        ) {
            recommendations.push(
                "Consider enabling low memory mode for better resource utilization."
            );
        }

        if (!this.config?.memoryManagement?.memoryLeakDetection) {
            recommendations.push(
                "Enable memory leak detection for better stability."
            );
        }

        const maxWorkers = await this.calculateOptimalWorkerCount(systemStats);

        return {
            recommendations,
            canEnableLowMemoryMode: systemStats.usagePercentage > 70,
            suggestedWorkerCount: maxWorkers,
        };
    }

    /**
     * Calculate optimal worker count based on available memory
     */
    public async calculateOptimalWorkerCount(
        systemStats?: MemoryStats
    ): Promise<number> {
        const stats = systemStats || (await this.getSystemMemoryStats());
        const maxMemoryPerWorker = this.parseMemoryString(
            this.config?.maxMemoryPerWorker || "512MB"
        );
        const reservedMemory = this.parseMemoryString(
            this.config?.memoryManagement?.memoryReservation || "1GB"
        );

        const availableMemory = stats.totalMemory - reservedMemory;
        const maxWorkers = Math.floor(availableMemory / maxMemoryPerWorker);

        // Ensure at least 1 worker, but respect system limits
        return Math.max(1, Math.min(maxWorkers, require("os").cpus().length));
    }

    /**
     * Enable low memory mode
     */
    public enableLowMemoryMode(): void {
        this.isLowMemoryMode = true;
        logger.info("cluster", "Low memory mode enabled");

        this.emit("low_memory_mode_enabled", {
            timestamp: Date.now(),
            systemStats: this.getSystemMemoryStats(),
        });
    }

    /**
     * Disable low memory mode
     */
    public disableLowMemoryMode(): void {
        this.isLowMemoryMode = false;
        logger.info("cluster", "Low memory mode disabled");

        this.emit("low_memory_mode_disabled", {
            timestamp: Date.now(),
            systemStats: this.getSystemMemoryStats(),
        });
    }

    /**
     * Check current memory usage and emit alerts if needed
     */
    private async checkMemoryUsage(): Promise<void> {
        const systemStats = await this.getSystemMemoryStats();
        const warningThreshold =
            this.config?.memoryManagement?.memoryWarningThreshold || 80;
        const criticalThreshold =
            this.config?.memoryManagement?.memoryCriticalThreshold || 95;

        if (systemStats.usagePercentage >= criticalThreshold) {
            this.emitMemoryAlert({
                type: "critical",
                message: `Critical system memory usage: ${systemStats.usagePercentage.toFixed(
                    1
                )}%`,
                memoryUsage: systemStats.usedMemory,
                threshold: criticalThreshold,
                timestamp: Date.now(),
                action: "scale_down",
            });

            if (!this.isLowMemoryMode) {
                this.enableLowMemoryMode();
            }
        } else if (systemStats.usagePercentage >= warningThreshold) {
            this.emitMemoryAlert({
                type: "warning",
                message: `High system memory usage: ${systemStats.usagePercentage.toFixed(
                    1
                )}%`,
                memoryUsage: systemStats.usedMemory,
                threshold: warningThreshold,
                timestamp: Date.now(),
                action: "alert_only",
            });
        } else if (
            this.isLowMemoryMode &&
            systemStats.usagePercentage < warningThreshold - 10
        ) {
            // Exit low memory mode if usage drops significantly
            this.disableLowMemoryMode();
        }
    }

    /**
     * Parse memory string to bytes
     */
    private parseMemoryString(memoryStr: string): number {
        const units: { [key: string]: number } = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024,
        };

        const match = memoryStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
        if (!match) {
            throw new Error(`Invalid memory format: ${memoryStr}`);
        }

        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        return value * (units[unit] || 1);
    }

    /**
     * Calculate memory trend from history
     */
    private calculateMemoryTrend(history: number[]): number {
        if (history.length < 2) return 0;

        const first = history[0];
        const last = history[history.length - 1];

        return (last - first) / first;
    }

    // Removed - using ProcessMonitor module instead

    /**
     * Emit memory alert
     */
    private emitMemoryAlert(alert: MemoryAlert): void {
        logger.warn("cluster", `Memory Alert: ${alert.message}`);
        this.emit("memory_alert", alert);
    }

    /**
     * Clean up resources and stop monitoring
     */
    public destroy(): void {
        this.stopMonitoring();
        this.processMonitor.destroy();
        this.memoryHistory.clear();
        this.lastGCHint.clear();
        this.removeAllListeners();
        logger.info("cluster", "MemoryManager destroyed");
    }
}

