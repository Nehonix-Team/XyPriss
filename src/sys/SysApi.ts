import { FSApi } from "./FSApi";

/**
 * Professional System Monitoring and Analysis API bridging to xsys.
 * All public methods are prefixed with '$'.
 */
export class SysApi extends FSApi {
    public $info = (extended = false) =>
        this.runner.runSync("sys", "info", [], { extended });
    public $cpu = (cores = false) =>
        this.runner.runSync("sys", "cpu", [], { cores });
    public $memory = (watch = false) =>
        this.runner.runSync("sys", "memory", [], { watch });
    public $disks = (mount?: string) =>
        this.runner.runSync("sys", "disks", [], { mount });
    public $network = (interfaceName?: string) =>
        this.runner.runSync("sys", "network", [], { interface: interfaceName });

    public $processes = (
        options: { pid?: number; topCpu?: number; topMem?: number } = {}
    ) => this.runner.runSync("sys", "processes", [], options);

    public $health = () => this.runner.runSync("sys", "health");
    public $env = (variable?: string) =>
        this.runner.runSync("sys", "env", variable ? [variable] : []);
    public $find = (p: string, pattern: string) =>
        this.runner.runSync("search", "find", [p], { pattern });
    public $grep = (p: string, pattern: string) =>
        this.runner.runSync("search", "grep", [p, pattern]);

    public $ports = () => this.runner.runSync("sys", "ports");
    public $battery = () => this.runner.runSync("sys", "battery");
}

