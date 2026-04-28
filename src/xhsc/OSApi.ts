import { BaseApi } from "./PathApi";
import {
    CpuInfo,
    CpuUsage,
    MemoryInfo,
    SystemHardware,
    DiskInfo,
    NetworkStats,
    NetworkInterface,
    ProcessInfo,
    ProcessStats,
    MonitorSnapshot,
    ProcessMonitorSnapshot,
    PortInfo,
    BatteryInfo,
    SystemInfo,
} from "./types";

/**
 * **Operating System & Hardware API**
 */
export class OSApi extends BaseApi {
    /**
     * **CPU Statistics & Load Analysis**
     *
     * Retrieves detailed information about CPU performance. Can return either
     * an overall average usage snapshot or a per-core breakdown.
     *
     * @param {boolean} [cores=false] - If true, returns an array of individual core statistics.
     * @returns {CpuUsage | CpuInfo[]} Overall usage summary or detailed per-core array.
     *
     * @example
     * // Get overall CPU usage
     * const usage = __sys__.os.cpu();
     * console.log(`CPU Load: ${usage.overall}%`);
     *
     * // Get per-core details
     * const cores = __sys__.os.cpu(true);
     * cores.forEach(c => console.log(`Core ${c.id}: ${c.usage}%`));
     */
    public cpu(cores: true): CpuInfo[];
    public cpu(cores?: false): CpuUsage;
    public cpu(cores = false): CpuUsage | CpuInfo[] {
        const results = this.runner.runSync("sys", "cpu", []) as CpuInfo[];
        if (cores) return results;

        let totalUsage = 0;
        const per_core = results.map((c) => {
            totalUsage += c.usage;
            return c.usage;
        });

        return {
            overall: results.length ? totalUsage / results.length : 0,
            per_core,
            timestamp: Date.now(),
        } as CpuUsage;
    }

    /**
     * **Memory & Swap Utilization**
     *
     * Returns a snapshot of the system's memory state, including RAM (total, used, free)
     * and Swap space utilization.
     *
     * @param {boolean} [watch=false] - If true, triggers the underlying engine to start
     * tracking memory trends for subsequent calls.
     * @returns {MemoryInfo} Current memory and swap statistics.
     *
     * @example
     * const mem = __sys__.os.memory();
     * console.log(`RAM Used: ${mem.used / 1024 / 1024} MB`);
     */
    public memory = (watch = false): MemoryInfo =>
        this.runner.runSync("sys", "memory", [], { watch });

    /**
     * **General System Metadata**
     *
     * Retrieves fundamental operating system information such as kernel version,
     * hostname, uptime, and distribution details.
     *
     * @returns {SystemInfo} Basic system metadata.
     */
    public info = (): SystemInfo => this.runner.runSync("sys", "info", []);

    /**
     * **Unified Hardware Telemetry**
     *
     * Combines memory, CPU, and low-level system metadata into a single
     * comprehensive hardware profile. Useful for system monitoring dashboards.
     *
     * @returns {SystemHardware} Complete hardware and OS profile.
     */
    public get hardware(): SystemHardware {
        const mem = this.memory();
        const info = this.runner.runSync("sys", "info", []) as any;

        const {
            total_memory,
            used_memory,
            available_memory,
            total_swap,
            used_swap,
            architecture,
            ...restInfo
        } = info;

        return {
            ...mem,
            ...restInfo,
            arch: architecture,
        };
    }

    /**
     * **Disk & Filesystem Storage Info**
     *
     * Lists all mounted filesystems or retrieves details for a specific mount point.
     * Provides capacity, usage, and available space for each disk.
     *
     * @param {string} [mount] - Optional mount point (e.g., '/', '/home') to filter.
     * @returns {DiskInfo[] | DiskInfo | undefined} List of all disks or a specific disk entry.
     *
     * @example
     * // List all disks
     * const allDisks = __sys__.os.disks();
     *
     * // Get root partition info
     * const root = __sys__.os.disks('/');
     */
    public disks(mount: string): DiskInfo | undefined;
    public disks(): DiskInfo[];
    public disks(mount?: string): DiskInfo | DiskInfo[] | undefined {
        const disks = this.runner.runSync("sys", "disks", []) as DiskInfo[];
        if (mount) {
            return disks.find((d) => d.mount_point === mount);
        }
        return disks;
    }

    /**
     * **Network Interface Statistics**
     *
     * Retrieves status and statistics for network interfaces, including
     * IP addresses, MAC addresses, and traffic metrics (bytes sent/received).
     *
     * @param {string} [interfaceName] - Optional name of the interface (e.g., 'eth0', 'wlan0').
     * @returns {NetworkStats | NetworkInterface} Global stats or specific interface details.
     */
    public network = (
        interfaceName?: string,
    ): NetworkStats | NetworkInterface =>
        this.runner.runSync("sys", "network", [], { interface: interfaceName });

    /**
     * **Process Listing & Querying**
     *
     * Retrieves the current process tree with options to filter by PID or
     * sort by resource consumption (CPU/Memory).
     *
     * @param {Object} [options] - Query options.
     * @param {number} [options.pid] - Filter by specific Process ID.
     * @param {number} [options.topCpu] - Number of top CPU-consuming processes to return.
     * @param {number} [options.topMem] - Number of top Memory-consuming processes to return.
     * @returns {ProcessInfo[] | ProcessInfo | ProcessStats} Process list or individual process data.
     *
     * @security Sensitive internal processes (signature/root flags) are automatically filtered.
     */
    public processes = (
        options: { pid?: number; topCpu?: number; topMem?: number } = {},
    ): ProcessInfo[] | ProcessInfo | ProcessStats => {
        const prs = this.runner.runSync("sys", "processes", [], options);
        if (typeof prs === "object" && !Array.isArray(prs)) {
            return prs as ProcessInfo | ProcessStats;
        }

        const processess = prs as ProcessInfo[];
        // const nprs = processess.map((pr: ProcessInfo): ProcessInfo => {
        //     return {
        //         ...pr,
        //         cmd: pr.cmd.filter((c: string) => !c.includes("--signature")),
        //     };
        // });
        // permet de masquer notre processus et ses infos
        const nprs = processess.filter((pr: ProcessInfo) => {
            return (
                !pr.cmd.includes("--signature") && !pr.cmd.includes("--root")
            );
        });
        return nprs;
    };

    /**
     * **System Health Assessment**
     *
     * Performs a high-level check of system stability, identifying potential issues
     * with resource exhaustion, high temperatures, or service failures.
     *
     * @returns {any} A health status object with warnings and critical flags.
     */
    public health = (): any => this.runner.runSync("sys", "health");

    /**
     * **Real-time System Monitoring**
     *
     * Starts a monitoring session to capture system performance snapshots over time.
     *
     * @param {number} [duration=60] - How long to monitor in seconds.
     * @param {number} [interval=1] - Frequency of snapshots in seconds.
     * @returns {MonitorSnapshot[] | void} Captured snapshots (if not running in interactive mode).
     */
    public monitor = (duration = 60, interval = 1): void | MonitorSnapshot[] =>
        this.runner.runSync("monitor", "system", [], {
            duration,
            interval,
            interactive: true,
        });

    /**
     * **Individual Process Monitoring**
     *
     * Tracks resource usage (CPU, Memory, Threads) for a specific process over time.
     *
     * @param {number} pid - The ID of the process to monitor.
     * @param {number} [duration=60] - Monitoring duration in seconds.
     * @returns {ProcessMonitorSnapshot[] | void} Captured snapshots.
     */
    public monitorProcess = (
        pid: number,
        duration = 60,
    ): void | ProcessMonitorSnapshot[] => {
        return this.runner.runSync("monitor", "process", [], {
            pid,
            duration,
            interactive: true,
        });
    };

    /**
     * **Terminate Process**
     *
     * Forcefully stops a process by its ID or Name.
     *
     * @param {number | string} target - PID (number) or Process Name (string).
     */
    public kill = (target: number | string): void => {
        if (typeof target === "number") {
            this.runner.runSync("sys", "kill", [], { pid: target });
        } else {
            this.runner.runSync("sys", "kill", [], { name: target });
        }
    };

    /**
     * **Network Port Discovery**
     *
     * Scans and lists all active TCP/UDP ports on the system, including
     * local/remote addresses and associated process names.
     *
     * @returns {PortInfo[]} List of active network ports.
     */
    public ports = (): PortInfo[] => this.runner.runSync("sys", "ports");

    /**
     * **Thermal Sensors Data**
     *
     * Retrieves temperature readings from various hardware sensors (CPU, GPU, Motherboard).
     *
     * @returns {any[]} List of sensor names and their current temperature in Celsius.
     */
    public temp = (): any[] => this.runner.runSync("sys", "temp");

    /**
     * **Battery & Power Management**
     *
     * Retrieves battery status, charge level, and power source information.
     * Useful for managing background tasks on mobile/laptop hardware.
     *
     * @returns {BatteryInfo} Battery status metadata.
     */
    public battery = (): BatteryInfo => this.runner.runSync("sys", "battery");

    /**
     * **Current OS Platform**
     *
     * Returns the operating system platform (e.g., 'linux', 'darwin', 'win32').
     *
     * @returns {string} Platform identifier.
     */
    public platform = (): string => process.platform;

    /**
     * **User Home Path**
     *
     * Returns the absolute path to the current user's home directory.
     *
     * @returns {string} Absolute home directory path.
     */
    public homeDir = (): string => this.runner.runSync("sys", "home-dir");

    /**
     * **System CPU Architecture**
     *
     * Returns the processor architecture (e.g., 'x64', 'arm64').
     *
     * @returns {string} Architecture identifier.
     */
    public arch = (): string => process.arch;
}

