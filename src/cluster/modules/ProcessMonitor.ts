/**
 * Advanced Process Monitoring Module
 * Provides sophisticated CPU, memory, and system resource monitoring
 * with accurate calculations and cross-platform support
 */

import { EventEmitter } from "events";
import { logger } from "../../../shared/logger/Logger";

export interface ProcessStats {
    pid: number;
    memory: {
        rss: number; // Resident Set Size (physical memory)
        vms: number; // Virtual Memory Size
        heapTotal: number; // Total heap size
        heapUsed: number; // Used heap size
        external: number; // External memory
        arrayBuffers: number; // Array buffers
    };
    cpu: {
        usage: number; // Current CPU usage percentage
        userTime: number; // User CPU time (ms)
        systemTime: number; // System CPU time (ms)
        totalTime: number; // Total CPU time (ms)
    };
    uptime: number; // Process uptime in seconds
    threads: number; // Number of threads
    fileDescriptors: number; // Number of open file descriptors
}

export interface SystemStats {
    cpu: {
        cores: number;
        usage: number; // Overall system CPU usage
        loadAverage: number[]; // Load averages [1min, 5min, 15min]
    };
    memory: {
        total: number;
        free: number;
        used: number;
        available: number;
        usagePercentage: number;
        buffers?: number; // Linux only
        cached?: number; // Linux only
    };
    swap: {
        total: number;
        free: number;
        used: number;
        usagePercentage: number;
    };
    uptime: number; // System uptime in seconds
}

interface CPUSnapshot {
    timestamp: number;
    userTime: number;
    systemTime: number;
    totalTime: number;
}

/**
 * Advanced process monitoring with accurate CPU calculations
 */
export class ProcessMonitor extends EventEmitter {
    private cpuSnapshots: Map<number, CPUSnapshot> = new Map();
    private monitoringInterval?: NodeJS.Timeout;
    private isMonitoring: boolean = false;

    constructor() {
        super();
    }

    /**
     * Start monitoring processes
     */
    public startMonitoring(interval: number = 5000): void {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.emit("monitoring_tick");
        }, interval);

        logger.info(
            "cluster",
            `Process monitoring started (interval: ${interval}ms)`
        );
    }

    /**
     * Stop monitoring processes
     */
    public stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        this.isMonitoring = false;
        this.cpuSnapshots.clear();
        logger.info("cluster", "Process monitoring stopped");
    }

    /**
     * Get comprehensive process statistics
     */
    public async getProcessStats(pid: number): Promise<ProcessStats> {
        try {
            const [memory, cpu, uptime, threads, fds] = await Promise.all([
                this._getProcessMemory(pid),
                this._getProcessCPU(pid),
                this._getProcessUptime(pid),
                this._getProcessThreads(pid),
                this._getProcessFileDescriptors(pid),
            ]);

            return {
                pid,
                memory,
                cpu,
                uptime,
                threads,
                fileDescriptors: fds,
            };
        } catch (error) {
            logger.error(
                "cluster",
                `Failed to get process stats for PID ${pid}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Get system-wide statistics
     */
    public async getSystemStats(): Promise<SystemStats> {
        try {
            const [cpu, memory, swap, uptime] = await Promise.all([
                this._getSystemCPU(),
                this._getSystemMemory(),
                this._getSystemSwap(),
                this._getSystemUptime(),
            ]);

            return {
                cpu,
                memory,
                swap,
                uptime,
            };
        } catch (error) {
            logger.error("cluster", "Failed to get system stats:", error);
            throw error;
        }
    }

    /**
     * Get accurate CPU usage with proper time-based calculation
     */
    private async _getProcessCPU(pid: number): Promise<ProcessStats["cpu"]> {
        const currentSnapshot = await this._takeCPUSnapshot(pid);
        const previousSnapshot = this.cpuSnapshots.get(pid);

        let usage = 0;
        if (previousSnapshot) {
            const timeDelta =
                currentSnapshot.timestamp - previousSnapshot.timestamp;
            const cpuDelta =
                currentSnapshot.totalTime - previousSnapshot.totalTime;

            if (timeDelta > 0) {
                // Calculate CPU usage as percentage of elapsed time
                usage = Math.min(100, (cpuDelta / timeDelta) * 100);
            }
        }

        // Store current snapshot for next calculation
        this.cpuSnapshots.set(pid, currentSnapshot);

        return {
            usage,
            userTime: currentSnapshot.userTime,
            systemTime: currentSnapshot.systemTime,
            totalTime: currentSnapshot.totalTime,
        };
    }

    /**
     * Take a CPU snapshot for accurate delta calculations
     */
    private async _takeCPUSnapshot(pid: number): Promise<CPUSnapshot> {
        const timestamp = Date.now();

        if (process.platform === "linux") {
            const fs = await import("fs");
            const stat = await fs.promises.readFile(
                `/proc/${pid}/stat`,
                "utf8"
            );
            const fields = stat.split(" ");

            const utime = parseInt(fields[13]) || 0; // User time in clock ticks
            const stime = parseInt(fields[14]) || 0; // System time in clock ticks
            const clockTicks = 100; // Standard Linux clock ticks per second

            const userTime = (utime / clockTicks) * 1000; // Convert to milliseconds
            const systemTime = (stime / clockTicks) * 1000; // Convert to milliseconds
            const totalTime = userTime + systemTime;

            return { timestamp, userTime, systemTime, totalTime };
        } else if (process.platform === "darwin") {
            // macOS implementation using ps
            const { spawn } = await import("child_process");
            return new Promise((resolve, reject) => {
                const ps = spawn("ps", ["-o", "time=", "-p", pid.toString()]);
                let output = "";

                ps.stdout.on("data", (data) => {
                    output += data.toString();
                });

                ps.on("close", (code) => {
                    if (code === 0) {
                        // Parse time format (MM:SS.ss or HH:MM:SS)
                        const timeStr = output.trim();
                        const totalTime = this._parseTimeString(timeStr);

                        resolve({
                            timestamp,
                            userTime: totalTime * 0.7, // Approximate split
                            systemTime: totalTime * 0.3,
                            totalTime,
                        });
                    } else {
                        reject(
                            new Error(`ps command failed with code ${code}`)
                        );
                    }
                });

                ps.on("error", reject);
            });
        } else {
            // Fallback for other platforms
            return {
                timestamp,
                userTime: 0,
                systemTime: 0,
                totalTime: 0,
            };
        }
    }

    /**
     * Parse time string from ps output
     */
    private _parseTimeString(timeStr: string): number {
        const parts = timeStr.split(":").map(Number);
        if (parts.length === 2) {
            // MM:SS format
            return (parts[0] * 60 + parts[1]) * 1000;
        } else if (parts.length === 3) {
            // HH:MM:SS format
            return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }
        return 0;
    }

    /**
     * Get detailed process memory information
     */
    private async _getProcessMemory(
        pid: number
    ): Promise<ProcessStats["memory"]> {
        if (process.platform === "linux") {
            const fs = await import("fs");
            const [statm, status] = await Promise.all([
                fs.promises.readFile(`/proc/${pid}/statm`, "utf8"),
                fs.promises.readFile(`/proc/${pid}/status`, "utf8"),
            ]);

            const statmFields = statm.split(" ");
            const pageSize = 4096;

            const vms = parseInt(statmFields[0]) * pageSize; // Virtual memory size
            const rss = parseInt(statmFields[1]) * pageSize; // Resident set size

            // Extract additional memory info from status
            const vmSizeMatch = status.match(/VmSize:\s+(\d+)\s+kB/);
            const vmRSSMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
            const vmDataMatch = status.match(/VmData:\s+(\d+)\s+kB/);

            return {
                rss: vmRSSMatch ? parseInt(vmRSSMatch[1]) * 1024 : rss,
                vms: vmSizeMatch ? parseInt(vmSizeMatch[1]) * 1024 : vms,
                heapTotal: vmDataMatch ? parseInt(vmDataMatch[1]) * 1024 : 0,
                heapUsed: rss,
                external: 0,
                arrayBuffers: 0,
            };
        } else if (process.platform === "darwin") {
            // macOS implementation
            const { spawn } = await import("child_process");
            return new Promise((resolve, reject) => {
                const ps = spawn("ps", [
                    "-o",
                    "rss=,vsz=",
                    "-p",
                    pid.toString(),
                ]);
                let output = "";

                ps.stdout.on("data", (data) => {
                    output += data.toString();
                });

                ps.on("close", (code) => {
                    if (code === 0) {
                        const [rssKB, vszKB] = output
                            .trim()
                            .split(/\s+/)
                            .map(Number);
                        const rss = (rssKB || 0) * 1024;
                        const vms = (vszKB || 0) * 1024;

                        resolve({
                            rss,
                            vms,
                            heapTotal: vms,
                            heapUsed: rss,
                            external: 0,
                            arrayBuffers: 0,
                        });
                    } else {
                        reject(
                            new Error(`ps command failed with code ${code}`)
                        );
                    }
                });

                ps.on("error", reject);
            });
        } else {
            // Fallback for other platforms
            return {
                rss: 0,
                vms: 0,
                heapTotal: 0,
                heapUsed: 0,
                external: 0,
                arrayBuffers: 0,
            };
        }
    }

    /**
     * Get process uptime in seconds
     */
    private async _getProcessUptime(pid: number): Promise<number> {
        if (process.platform === "linux") {
            const fs = await import("fs");
            const stat = await fs.promises.readFile(
                `/proc/${pid}/stat`,
                "utf8"
            );
            const fields = stat.split(" ");
            const starttime = parseInt(fields[21]) || 0; // Process start time in clock ticks

            const uptimeFile = await fs.promises.readFile(
                "/proc/uptime",
                "utf8"
            );
            const systemUptime = parseFloat(uptimeFile.split(" ")[0]);
            const clockTicks = 100; // Standard Linux clock ticks per second

            const processStartTime = starttime / clockTicks;
            return Math.max(0, systemUptime - processStartTime);
        } else if (process.platform === "darwin") {
            const { spawn } = await import("child_process");
            return new Promise((resolve, reject) => {
                const ps = spawn("ps", ["-o", "etime=", "-p", pid.toString()]);
                let output = "";

                ps.stdout.on("data", (data) => {
                    output += data.toString();
                });

                ps.on("close", (code) => {
                    if (code === 0) {
                        const etimeStr = output.trim();
                        resolve(this._parseEtimeString(etimeStr));
                    } else {
                        reject(
                            new Error(`ps command failed with code ${code}`)
                        );
                    }
                });

                ps.on("error", reject);
            });
        } else {
            return 0;
        }
    }

    /**
     * Parse etime string from ps output
     */
    private _parseEtimeString(etimeStr: string): number {
        const parts = etimeStr.split(":").map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 1) {
            return parts[0];
        }
        return 0;
    }

    /**
     * Get number of threads for a process
     */
    private async _getProcessThreads(pid: number): Promise<number> {
        if (process.platform === "linux") {
            try {
                const fs = await import("fs");
                const status = await fs.promises.readFile(
                    `/proc/${pid}/status`,
                    "utf8"
                );
                const threadsMatch = status.match(/Threads:\s+(\d+)/);
                return threadsMatch ? parseInt(threadsMatch[1]) : 1;
            } catch {
                return 1;
            }
        } else {
            return 1; // Default for other platforms
        }
    }

    /**
     * Get number of open file descriptors
     */
    private async _getProcessFileDescriptors(pid: number): Promise<number> {
        if (process.platform === "linux") {
            try {
                const fs = await import("fs");
                const fdDir = await fs.promises.readdir(`/proc/${pid}/fd`);
                return fdDir.length;
            } catch {
                return 0;
            }
        } else {
            return 0; // Default for other platforms
        }
    }

    /**
     * Get system CPU information
     */
    private async _getSystemCPU(): Promise<SystemStats["cpu"]> {
        const os = await import("os");
        const cores = os.cpus().length;
        const loadAverage = os.loadavg();

        // Calculate system CPU usage
        let usage = 0;
        if (process.platform === "linux") {
            try {
                const fs = await import("fs");
                const stat = await fs.promises.readFile("/proc/stat", "utf8");
                const cpuLine = stat.split("\n")[0];
                const cpuTimes = cpuLine.split(/\s+/).slice(1).map(Number);

                const idle = cpuTimes[3] || 0;
                const total = cpuTimes.reduce((sum, time) => sum + time, 0);
                usage = total > 0 ? Math.max(0, 100 - (idle / total) * 100) : 0;
            } catch {
                // Fallback to load average approximation
                usage = Math.min(100, (loadAverage[0] / cores) * 100);
            }
        } else {
            // Approximate from load average
            usage = Math.min(100, (loadAverage[0] / cores) * 100);
        }

        return {
            cores,
            usage,
            loadAverage,
        };
    }

    /**
     * Get system memory information
     */
    private async _getSystemMemory(): Promise<SystemStats["memory"]> {
        const os = await import("os");
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercentage = (used / total) * 100;

        let buffers: number | undefined;
        let cached: number | undefined;
        let available = free;

        if (process.platform === "linux") {
            try {
                const fs = await import("fs");
                const meminfo = await fs.promises.readFile(
                    "/proc/meminfo",
                    "utf8"
                );

                const buffersMatch = meminfo.match(/Buffers:\s+(\d+)\s+kB/);
                const cachedMatch = meminfo.match(/Cached:\s+(\d+)\s+kB/);
                const availableMatch = meminfo.match(
                    /MemAvailable:\s+(\d+)\s+kB/
                );

                buffers = buffersMatch
                    ? parseInt(buffersMatch[1]) * 1024
                    : undefined;
                cached = cachedMatch
                    ? parseInt(cachedMatch[1]) * 1024
                    : undefined;
                available = availableMatch
                    ? parseInt(availableMatch[1]) * 1024
                    : free;
            } catch {
                // Use OS defaults
            }
        }

        return {
            total,
            free,
            used,
            available,
            usagePercentage,
            buffers,
            cached,
        };
    }

    /**
     * Get system swap information
     */
    private async _getSystemSwap(): Promise<SystemStats["swap"]> {
        if (process.platform === "linux") {
            try {
                const fs = await import("fs");
                const meminfo = await fs.promises.readFile(
                    "/proc/meminfo",
                    "utf8"
                );

                const swapTotalMatch = meminfo.match(/SwapTotal:\s+(\d+)\s+kB/);
                const swapFreeMatch = meminfo.match(/SwapFree:\s+(\d+)\s+kB/);

                const total = swapTotalMatch
                    ? parseInt(swapTotalMatch[1]) * 1024
                    : 0;
                const free = swapFreeMatch
                    ? parseInt(swapFreeMatch[1]) * 1024
                    : 0;
                const used = total - free;
                const usagePercentage = total > 0 ? (used / total) * 100 : 0;

                return { total, free, used, usagePercentage };
            } catch {
                return { total: 0, free: 0, used: 0, usagePercentage: 0 };
            }
        } else if (process.platform === "darwin") {
            try {
                const { execSync } = await import("child_process");
                const swapUsage = execSync("sysctl vm.swapusage", {
                    encoding: "utf8",
                });

                const totalMatch = swapUsage.match(/total = ([\d.]+)([MG])/);
                const usedMatch = swapUsage.match(/used = ([\d.]+)([MG])/);

                let total = 0;
                let used = 0;

                if (totalMatch) {
                    const value = parseFloat(totalMatch[1]);
                    const unit = totalMatch[2];
                    total =
                        unit === "G"
                            ? value * 1024 * 1024 * 1024
                            : value * 1024 * 1024;
                }

                if (usedMatch) {
                    const value = parseFloat(usedMatch[1]);
                    const unit = usedMatch[2];
                    used =
                        unit === "G"
                            ? value * 1024 * 1024 * 1024
                            : value * 1024 * 1024;
                }

                const free = total - used;
                const usagePercentage = total > 0 ? (used / total) * 100 : 0;

                return { total, free, used, usagePercentage };
            } catch {
                return { total: 0, free: 0, used: 0, usagePercentage: 0 };
            }
        } else {
            return { total: 0, free: 0, used: 0, usagePercentage: 0 };
        }
    }

    /**
     * Get system uptime in seconds
     */
    private async _getSystemUptime(): Promise<number> {
        const os = await import("os");
        return os.uptime();
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.stopMonitoring();
        this.removeAllListeners();
    }
}

