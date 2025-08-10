/**
 * CPU Monitoring Module for XyPriss Cluster Management
 * Provides sophisticated CPU usage tracking and monitoring capabilities
 * Supports multiple platforms with fallback mechanisms
 */

import { logger } from "../../../shared/logger/Logger";
import type { BunWorker } from "../../types";
import { CpuMonitorConfig, CpuDataPoint, ProcessCpuStats, SystemCpuStats } from "../../types/CpuMon.t";
import os from "os"


/**
 * Enhanced CPU Monitor with sophisticated tracking capabilities
 */
export class CpuMonitor {
    private config: CpuMonitorConfig;
    private history: CpuDataPoint[] = [];
    private processHistory: Map<number, ProcessCpuStats[]> = new Map();
    private monitoringInterval?: NodeJS.Timeout;
    private isMonitoring: boolean = false;

    constructor(config: Partial<CpuMonitorConfig> = {}) {
        this.config = {
            enabled: true,
            sampleInterval: 5000, // 5 seconds
            historySize: 100, // Keep 100 samples (~8 minutes at 5s intervals)
            smoothingFactor: 0.3,
            alertThresholds: {
                warning: 70,
                critical: 90,
            },
            ...config,
        };
    }

    /**
     * Start CPU monitoring
     */
    public startMonitoring(): void {
        if (this.isMonitoring || !this.config.enabled) {
            return;
        }

        this.isMonitoring = true;
        logger.info("cluster", "Starting CPU monitoring");

        this.monitoringInterval = setInterval(async () => {
            try {
                await this.collectSystemStats();
            } catch (error) {
                logger.error("cluster", "Error collecting CPU stats:", error);
            }
        }, this.config.sampleInterval);
    }

    /**
     * Stop CPU monitoring
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        logger.info("cluster", "Stopped CPU monitoring");
    }

    /**
     * Calculate sophisticated CPU usage for the cluster
     */
    public async calculateClusterCpuUsage(
        workers: BunWorker[]
    ): Promise<number> {
        try {
            const activeWorkers = workers.filter(
                (w) => w.health.status === "healthy"
            );

            if (activeWorkers.length === 0) {
                return 0;
            }

            // Get system-wide CPU usage
            const systemStats = await this.getSystemCpuStats();

            // Calculate worker-specific CPU usage
            const workerCpuPromises = activeWorkers.map(async (worker) => {
                if (worker.subprocess && !worker.subprocess.killed) {
                    return await this.getProcessCpuUsage(worker.subprocess.pid);
                }
                return 0;
            });

            const workerCpuUsages = await Promise.all(workerCpuPromises);
            const totalWorkerCpu = workerCpuUsages.reduce(
                (sum, usage) => sum + usage,
                0
            );

            // Combine system and worker metrics with intelligent weighting
            const systemWeight = 0.4;
            const workerWeight = 0.6;

            const weightedCpu =
                systemStats.overall * systemWeight +
                Math.min(totalWorkerCpu, 100) * workerWeight;

            // Apply smoothing if we have historical data
            const smoothedCpu = this.applySmoothingToUsage(weightedCpu);

            return Math.min(Math.round(smoothedCpu), 100);
        } catch (error) {
            logger.error(
                "cluster",
                "Error calculating cluster CPU usage:",
                error
            );
            return 0;
        }
    }

    /**
     * Get CPU usage for a specific process with enhanced accuracy
     */
    public async getProcessCpuUsage(pid: number): Promise<number> {
        try {
            const stats = await this.getProcessCpuStats(pid);

            // Store in history for trend analysis
            this.updateProcessHistory(pid, stats);

            return stats.usage;
        } catch (error) {
            logger.debug(
                "cluster",
                `Error getting CPU usage for PID ${pid}:`,
                error
            );
            return 0;
        }
    }

    /**
     * Get detailed CPU statistics for a process
     */
    public async getProcessCpuStats(pid: number): Promise<ProcessCpuStats> {
        const timestamp = Date.now();

        try {
            if (process.platform === "linux") {
                return await this.getLinuxProcessCpuStats(pid, timestamp);
            } else if (process.platform === "darwin") {
                return await this.getMacOSProcessCpuStats(pid, timestamp);
            } else if (process.platform === "win32") {
                return await this.getWindowsProcessCpuStats(pid, timestamp);
            } else {
                // Fallback for unsupported platforms
                return {
                    pid,
                    usage: 0,
                    userTime: 0,
                    systemTime: 0,
                    totalTime: 0,
                    timestamp,
                };
            }
        } catch (error) {
            throw new Error(
                `Failed to get process CPU stats for PID ${pid}: ${error}`
            );
        }
    }

    /**
     * Get system-wide CPU statistics
     */
    public async getSystemCpuStats(): Promise<SystemCpuStats> {
        const timestamp = Date.now();
        const loadAverage =
            process.platform !== "win32" ? os.loadavg() : [0, 0, 0];

        try {
            if (process.platform === "linux") {
                return await this.getLinuxSystemCpuStats(
                    timestamp,
                    loadAverage
                );
            } else if (process.platform === "darwin") {
                return await this.getMacOSSystemCpuStats(
                    timestamp,
                    loadAverage
                );
            } else if (process.platform === "win32") {
                return await this.getWindowsSystemCpuStats(timestamp);
            } else {
                // Fallback
                return {
                    overall: 0,
                    cores: [],
                    loadAverage,
                    processes: 0,
                    timestamp,
                };
            }
        } catch (error) {
            logger.error("cluster", "Error getting system CPU stats:", error);
            return {
                overall: 0,
                cores: [],
                loadAverage,
                processes: 0,
                timestamp,
            };
        }
    }

    /**
     * Apply exponential smoothing to CPU usage
     */
    private applySmoothingToUsage(currentUsage: number): number {
        if (this.history.length === 0) {
            return currentUsage;
        }

        const lastUsage = this.history[this.history.length - 1].usage;
        const smoothingFactor = this.config.smoothingFactor;

        return (
            smoothingFactor * currentUsage + (1 - smoothingFactor) * lastUsage
        );
    }

    /**
     * Update process history for trend analysis
     */
    private updateProcessHistory(pid: number, stats: ProcessCpuStats): void {
        if (!this.processHistory.has(pid)) {
            this.processHistory.set(pid, []);
        }

        const history = this.processHistory.get(pid)!;
        history.push(stats);

        // Keep only recent history
        if (history.length > this.config.historySize) {
            history.shift();
        }
    }

    /**
     * Collect and store system-wide statistics
     */
    private async collectSystemStats(): Promise<void> {
        try {
            const systemStats = await this.getSystemCpuStats();

            const dataPoint: CpuDataPoint = {
                timestamp: systemStats.timestamp,
                usage: systemStats.overall,
                processes: new Map(),
            };

            this.history.push(dataPoint);

            // Keep only recent history
            if (this.history.length > this.config.historySize) {
                this.history.shift();
            }

            // Store system stats for future reference if needed

            // Check for alerts
            this.checkAlertThresholds(systemStats.overall);
        } catch (error) {
            logger.error("cluster", "Error collecting system stats:", error);
        }
    }

    /**
     * Check if CPU usage exceeds alert thresholds
     */
    private checkAlertThresholds(usage: number): void {
        if (usage >= this.config.alertThresholds.critical) {
            logger.warn(
                "cluster",
                `Critical CPU usage detected: ${usage.toFixed(1)}%`
            );
        } else if (usage >= this.config.alertThresholds.warning) {
            logger.warn(
                "cluster",
                `High CPU usage detected: ${usage.toFixed(1)}%`
            );
        }
    }

    /**
     * Get Linux process CPU statistics using /proc filesystem
     */
    private async getLinuxProcessCpuStats(
        pid: number,
        timestamp: number
    ): Promise<ProcessCpuStats> {
        const fs = await import("fs");

        try {
            // Read process stat file
            const statData = await fs.promises.readFile(
                `/proc/${pid}/stat`,
                "utf8"
            );
            const statFields = statData.trim().split(/\s+/);

            if (statFields.length < 15) {
                throw new Error("Invalid stat file format");
            }

            const utime = parseInt(statFields[13]); // User time in clock ticks
            const stime = parseInt(statFields[14]); // System time in clock ticks
            const totalTime = utime + stime;

            // Get system clock ticks per second
            const clockTicks = 100; // Usually 100 on Linux, but could vary

            // Convert to milliseconds
            const userTimeMs = (utime / clockTicks) * 1000;
            const systemTimeMs = (stime / clockTicks) * 1000;
            const totalTimeMs = (totalTime / clockTicks) * 1000;

            // Calculate CPU usage percentage
            let usage = 0;
            const previousStats = this.getLastProcessStats(pid);

            if (previousStats) {
                const timeDelta = timestamp - previousStats.timestamp;
                const cpuTimeDelta = totalTimeMs - previousStats.totalTime;

                if (timeDelta > 0) {
                    usage = Math.min(100, (cpuTimeDelta / timeDelta) * 100);
                }
            }

            return {
                pid,
                usage,
                userTime: userTimeMs,
                systemTime: systemTimeMs,
                totalTime: totalTimeMs,
                timestamp,
            };
        } catch (error) {
            throw new Error(`Failed to read Linux process stats: ${error}`);
        }
    }

    /**
     * Get macOS process CPU statistics using ps command
     */
    private async getMacOSProcessCpuStats(
        pid: number,
        timestamp: number
    ): Promise<ProcessCpuStats> {
        const { spawn } = await import("child_process");

        return new Promise((resolve, reject) => {
            const ps = spawn("ps", ["-o", "pcpu=,time=", "-p", pid.toString()]);
            let output = "";

            ps.stdout.on("data", (data) => {
                output += data.toString();
            });

            ps.on("close", (code) => {
                if (code === 0) {
                    try {
                        const lines = output.trim().split("\n");
                        const data = lines[lines.length - 1]
                            .trim()
                            .split(/\s+/);

                        const cpuPercent = parseFloat(data[0]) || 0;
                        const timeStr = data[1] || "0:00.00";

                        // Parse time format (MM:SS.ss or HH:MM:SS.ss)
                        const timeParts = timeStr.split(":");
                        let totalSeconds = 0;

                        if (timeParts.length === 2) {
                            totalSeconds =
                                parseInt(timeParts[0]) * 60 +
                                parseFloat(timeParts[1]);
                        } else if (timeParts.length === 3) {
                            totalSeconds =
                                parseInt(timeParts[0]) * 3600 +
                                parseInt(timeParts[1]) * 60 +
                                parseFloat(timeParts[2]);
                        }

                        const totalTimeMs = totalSeconds * 1000;

                        resolve({
                            pid,
                            usage: cpuPercent,
                            userTime: totalTimeMs * 0.7, // Approximate split
                            systemTime: totalTimeMs * 0.3,
                            totalTime: totalTimeMs,
                            timestamp,
                        });
                    } catch (error) {
                        reject(
                            new Error(
                                `Failed to parse macOS ps output: ${error}`
                            )
                        );
                    }
                } else {
                    reject(new Error(`ps command failed with code ${code}`));
                }
            });

            ps.on("error", reject);
        });
    }

    /**
     * Get Windows process CPU statistics using wmic
     */
    private async getWindowsProcessCpuStats(
        pid: number,
        timestamp: number
    ): Promise<ProcessCpuStats> {
        const { spawn } = await import("child_process");

        return new Promise((resolve, reject) => {
            const wmic = spawn("wmic", [
                "process",
                "where",
                `ProcessId=${pid}`,
                "get",
                "PageFileUsage,UserModeTime,KernelModeTime",
                "/format:csv",
            ]);

            let output = "";

            wmic.stdout.on("data", (data) => {
                output += data.toString();
            });

            wmic.on("close", (code) => {
                if (code === 0) {
                    try {
                        const lines = output.trim().split("\n");
                        const dataLine = lines.find((line) =>
                            line.includes(pid.toString())
                        );

                        if (!dataLine) {
                            throw new Error("Process not found in wmic output");
                        }

                        const fields = dataLine.split(",");
                        const kernelTime = parseInt(fields[1]) || 0;
                        const userTime = parseInt(fields[2]) || 0;

                        // Convert from 100-nanosecond intervals to milliseconds
                        const kernelTimeMs = kernelTime / 10000;
                        const userTimeMs = userTime / 10000;
                        const totalTimeMs = kernelTimeMs + userTimeMs;

                        // Calculate usage based on previous measurement
                        let usage = 0;
                        const previousStats = this.getLastProcessStats(pid);

                        if (previousStats) {
                            const timeDelta =
                                timestamp - previousStats.timestamp;
                            const cpuTimeDelta =
                                totalTimeMs - previousStats.totalTime;

                            if (timeDelta > 0) {
                                usage = Math.min(
                                    100,
                                    (cpuTimeDelta / timeDelta) * 100
                                );
                            }
                        }

                        resolve({
                            pid,
                            usage,
                            userTime: userTimeMs,
                            systemTime: kernelTimeMs,
                            totalTime: totalTimeMs,
                            timestamp,
                        });
                    } catch (error) {
                        reject(
                            new Error(
                                `Failed to parse Windows wmic output: ${error}`
                            )
                        );
                    }
                } else {
                    reject(new Error(`wmic command failed with code ${code}`));
                }
            });

            wmic.on("error", reject);
        });
    }

    /**
     * Get the last recorded stats for a process
     */
    private getLastProcessStats(pid: number): ProcessCpuStats | null {
        const history = this.processHistory.get(pid);
        return history && history.length > 0
            ? history[history.length - 1]
            : null;
    }

    /**
     * Get Linux system CPU statistics using /proc/stat
     */
    private async getLinuxSystemCpuStats(
        timestamp: number,
        loadAverage: number[]
    ): Promise<SystemCpuStats> {
        const fs = await import("fs");

        try {
            const statData = await fs.promises.readFile("/proc/stat", "utf8");
            const lines = statData.split("\n");

            // Parse overall CPU line
            const cpuLine = lines[0];
            const cpuTimes = cpuLine.split(/\s+/).slice(1).map(Number);

            const idle = cpuTimes[3] || 0;
            const iowait = cpuTimes[4] || 0;
            const total = cpuTimes.reduce((sum, time) => sum + time, 0);

            const overall =
                total > 0
                    ? Math.max(0, 100 - ((idle + iowait) / total) * 100)
                    : 0;

            // Parse per-core CPU usage
            const cores: number[] = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith("cpu")) {
                    const coreTimes = line.split(/\s+/).slice(1).map(Number);
                    if (coreTimes.length >= 4) {
                        const coreIdle = coreTimes[3] || 0;
                        const coreIowait = coreTimes[4] || 0;
                        const coreTotal = coreTimes.reduce(
                            (sum, time) => sum + time,
                            0
                        );
                        const coreUsage =
                            coreTotal > 0
                                ? Math.max(
                                      0,
                                      100 -
                                          ((coreIdle + coreIowait) /
                                              coreTotal) *
                                              100
                                  )
                                : 0;
                        cores.push(coreUsage);
                    }
                } else {
                    break;
                }
            }

            // Get process count
            let processes = 0;
            try {
                const procDirs = await fs.promises.readdir("/proc");
                processes = procDirs.filter((dir) => /^\d+$/.test(dir)).length;
            } catch {
                processes = 0;
            }

            return {
                overall,
                cores,
                loadAverage,
                processes,
                timestamp,
            };
        } catch (error) {
            throw new Error(`Failed to read Linux system stats: ${error}`);
        }
    }

    /**
     * Get macOS system CPU statistics using system commands
     */
    private async getMacOSSystemCpuStats(
        timestamp: number,
        loadAverage: number[]
    ): Promise<SystemCpuStats> {
        const { spawn } = await import("child_process");

        return new Promise((resolve, reject) => {
            // Use iostat to get CPU usage
            const iostat = spawn("iostat", ["-c", "1", "1"]);
            let output = "";

            iostat.stdout.on("data", (data) => {
                output += data.toString();
            });

            iostat.on("close", async (code) => {
                if (code === 0) {
                    try {
                        const lines = output.trim().split("\n");
                        const cpuLine = lines[lines.length - 1];
                        const values = cpuLine.trim().split(/\s+/);

                        // iostat format: %user %nice %sys %idle
                        const idle = parseFloat(values[3]) || 0;

                        // Calculate overall CPU usage (100 - idle)
                        const overall = Math.max(0, 100 - idle);

                        // Get process count
                        let processes = 0;
                        try {
                            const ps = spawn("ps", ["-A"]);
                            let psOutput = "";

                            ps.stdout.on("data", (data) => {
                                psOutput += data.toString();
                            });

                            ps.on("close", () => {
                                processes = psOutput.split("\n").length - 2; // Subtract header and empty line

                                resolve({
                                    overall,
                                    cores: [], // macOS per-core stats require more complex parsing
                                    loadAverage,
                                    processes,
                                    timestamp,
                                });
                            });
                        } catch {
                            resolve({
                                overall,
                                cores: [],
                                loadAverage,
                                processes: 0,
                                timestamp,
                            });
                        }
                    } catch (error) {
                        reject(
                            new Error(
                                `Failed to parse macOS iostat output: ${error}`
                            )
                        );
                    }
                } else {
                    reject(
                        new Error(`iostat command failed with code ${code}`)
                    );
                }
            });

            iostat.on("error", reject);
        });
    }

    /**
     * Get Windows system CPU statistics using wmic
     */
    private async getWindowsSystemCpuStats(
        timestamp: number
    ): Promise<SystemCpuStats> {
        const { spawn } = await import("child_process");

        return new Promise((resolve, reject) => {
            const wmic = spawn("wmic", [
                "cpu",
                "get",
                "loadpercentage",
                "/value",
            ]);

            let output = "";

            wmic.stdout.on("data", (data) => {
                output += data.toString();
            });

            wmic.on("close", async (code) => {
                if (code === 0) {
                    try {
                        const lines = output.split("\n");
                        const loadLine = lines.find((line) =>
                            line.includes("LoadPercentage")
                        );

                        let overall = 0;
                        if (loadLine) {
                            const match =
                                loadLine.match(/LoadPercentage=(\d+)/);
                            if (match) {
                                overall = parseInt(match[1]);
                            }
                        }

                        // Get process count
                        let processes = 0;
                        try {
                            const tasklist = spawn("tasklist", ["/fo", "csv"]);
                            let taskOutput = "";

                            tasklist.stdout.on("data", (data) => {
                                taskOutput += data.toString();
                            });

                            tasklist.on("close", () => {
                                processes = taskOutput.split("\n").length - 2; // Subtract header and empty line

                                resolve({
                                    overall,
                                    cores: [], // Windows per-core stats require additional commands
                                    loadAverage: [0, 0, 0], // Windows doesn't have load average
                                    processes,
                                    timestamp,
                                });
                            });
                        } catch {
                            resolve({
                                overall,
                                cores: [],
                                loadAverage: [0, 0, 0],
                                processes: 0,
                                timestamp,
                            });
                        }
                    } catch (error) {
                        reject(
                            new Error(
                                `Failed to parse Windows wmic output: ${error}`
                            )
                        );
                    }
                } else {
                    reject(new Error(`wmic command failed with code ${code}`));
                }
            });

            wmic.on("error", reject);
        });
    }

    /**
     * Get CPU usage trend for a process
     */
    public getProcessCpuTrend(pid: number, samples: number = 10): number[] {
        const history = this.processHistory.get(pid);
        if (!history || history.length === 0) {
            return [];
        }

        const recentHistory = history.slice(-samples);
        return recentHistory.map((stats) => stats.usage);
    }

    /**
     * Get system CPU usage trend
     */
    public getSystemCpuTrend(samples: number = 10): number[] {
        if (this.history.length === 0) {
            return [];
        }

        const recentHistory = this.history.slice(-samples);
        return recentHistory.map((point) => point.usage);
    }

    /**
     * Get current configuration
     */
    public getConfig(): CpuMonitorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<CpuMonitorConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Restart monitoring if interval changed
        if (this.isMonitoring && newConfig.sampleInterval) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    /**
     * Clear all historical data
     */
    public clearHistory(): void {
        this.history = [];
        this.processHistory.clear();
        // Clear any cached system stats if needed
        logger.info("cluster", "CPU monitoring history cleared");
    }

    /**
     * Get monitoring status
     */
    public isActive(): boolean {
        return this.isMonitoring;
    }
}

