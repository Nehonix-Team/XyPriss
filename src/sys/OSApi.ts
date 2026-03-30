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
} from "./types";

/**
 * **Operating System & Hardware API**
 */
export class OSApi extends BaseApi {
    /**
     * **Get CPU Statistics**
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
     * **Get Memory Usage**
     */
    public memory = (watch = false): MemoryInfo =>
        this.runner.runSync("sys", "memory", [], { watch });

    /**
     * **Get Hardware Telemetry**
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
     * **Get Mounted Disks**
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
     * **Get Network Interfaces**
     */
    public network = (
        interfaceName?: string,
    ): NetworkStats | NetworkInterface =>
        this.runner.runSync("sys", "network", [], { interface: interfaceName });

    /**
     * **List & Query Processes**
     */
    public processes = (
        options: { pid?: number; topCpu?: number; topMem?: number } = {},
    ): ProcessInfo[] | ProcessInfo | ProcessStats =>
        this.runner.runSync("sys", "processes", [], options);

    /**
     * **System Health Check**
     */
    public health = (): any => this.runner.runSync("sys", "health");

    /**
     * **Monitor System Performance**
     */
    public monitor = (duration = 60, interval = 1): void | MonitorSnapshot[] =>
        this.runner.runSync("monitor", "system", [], {
            duration,
            interval,
            interactive: true,
        });

    /**
     * **Monitor Specific Process**
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
     * **Kill Process**
     */
    public kill = (target: number | string): void => {
        if (typeof target === "number") {
            this.runner.runSync("sys", "kill", [], { pid: target });
        } else {
            this.runner.runSync("sys", "kill", [], { name: target });
        }
    };

    /**
     * **Get Active Ports**
     */
    public ports = (): PortInfo[] => this.runner.runSync("sys", "ports");

    /**
     * **Get System Temperatures**
     */
    public temp = (): any[] => this.runner.runSync("sys", "temp");

    /**
     * **Get Battery Status**
     */
    public battery = (): BatteryInfo => this.runner.runSync("sys", "battery");

    /**
     * **Get Operating System Platform**
     */
    public platform = (): string => process.platform;
}

