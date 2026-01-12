import { XyPrissRunner } from "./XyPrissRunner";

/**
 * Professional System Monitoring and Analysis API bridging to xsys.
 * Provides deep insights into hardware, processes, and environment.
 */
export class SysApi {
    constructor(private runner: XyPrissRunner) {}

    /**
     * Gets general system information (OS, Hostname, Uptime).
     */
    public info(extended = false): any {
        return this.runner.runSync("sys", "info", [], { extended });
    }

    /**
     * Gets CPU usage and core information.
     */
    public cpu(cores = false): any {
        return this.runner.runSync("sys", "cpu", [], { cores });
    }

    /**
     * Gets memory (RAM/Swap) utilization statistics.
     */
    public memory(watch = false): any {
        return this.runner.runSync("sys", "memory", [], { watch });
    }

    /**
     * Lists available disks and their mount points.
     */
    public disks(mount?: string): any {
        return this.runner.runSync("sys", "disks", [], { mount });
    }

    /**
     * Gets network interface statistics.
     */
    public network(interfaceName?: string): any {
        return this.runner.runSync("sys", "network", [], {
            interface: interfaceName,
        });
    }

    /**
     * Lists and filters active processes.
     */
    public processes(
        options: { pid?: number; topCpu?: number; topMem?: number } = {}
    ): any {
        return this.runner.runSync("sys", "processes", [], options);
    }

    /**
     * Runs automated diagnostic checks and returns a health score.
     */
    public health(): any {
        return this.runner.runSync("sys", "health");
    }

    /**
     * Manages environment variables.
     */
    public env(variable?: string): any {
        return this.runner.runSync("sys", "env", variable ? [variable] : []);
    }

    /**
     * Recursively finds files matching a regex pattern.
     */
    public find(p: string, pattern: string): string[] {
        return this.runner.runSync("search", "find", [p], { pattern });
    }

    /**
     * Searches for text patterns within files (Grep).
     */
    public grep(p: string, pattern: string): any[] {
        return this.runner.runSync("search", "grep", [p, pattern]);
    }
}
