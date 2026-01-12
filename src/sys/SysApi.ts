import { FSApi } from "./FSApi";

/**
 * **Professional System Monitoring & Intelligence API**
 *
 * Provides deep insights into hardware resources, network state, running processes, and
 * environment configuration. Acts as the system-level interface for the XyPriss ecosystem.
 * All data is retrieved directly from the operating system for maximum accuracy and performance.
 *
 * **Key Capabilities:**
 * - **Hardware**: CPU, Memory, Disks, Battery.
 * - **Network**: Interfaces, active ports, connections.
 * - **Runtime**: Processes, Environment variables.
 *
 * @final This API is part of the core system inheritance chain.
 * @access Public API via `__sys__` (e.g., `__sys__.$cpu()`, `__sys__.$ports()`).
 */
export class SysApi extends FSApi {
    /**
     * **Get System Info**
     *
     * Retrieves general system information including OS version, hostname, kernel version, and uptime.
     *
     * @param {boolean} [extended=false] - (Currently unused foundation for future extended stats).
     * @returns {any} System info object.
     *
     * @example
     * ```typescript
     * const sysInfo = __sys__.$info();
     * console.log(`Host: ${sysInfo.hostname}, OS: ${sysInfo.os_name}`);
     * ```
     */
    public $info = (extended = false) =>
        this.runner.runSync("sys", "info", [], { extended });

    /**
     * **Get CPU Stats**
     *
     * Retrieves CPU usage and information.
     *
     * @param {boolean} [cores=false] - If true, returns detailed usage stats per core.
     * @returns {any[]} Array of CPU information.
     *
     * @example
     * ```typescript
     * // Get global CPU usage
     * const cpus = __sys__.$cpu();
     * console.log(`Model: ${cpus[0].brand}`);
     * ```
     */
    public $cpu = (cores = false) =>
        this.runner.runSync("sys", "cpu", [], { cores });

    /**
     * **Get Memory Usage**
     *
     * Retrieves global RAM and Swap usage statistics.
     *
     * @param {boolean} [watch=false] - (Internal) Mode for continuous watching.
     * @returns {any} Memory stats object `{ total, used, free, ... }`.
     *
     * @example
     * ```typescript
     * const mem = __sys__.$memory();
     * const usedGB = (mem.used / 1024 / 1024 / 1024).toFixed(2);
     * console.log(`RAM Used: ${usedGB} GB`);
     * ```
     */
    public $memory = (watch = false) =>
        this.runner.runSync("sys", "memory", [], { watch });

    /**
     * **Get Mounted Disks**
     *
     * Lists all mounted filesystems and their usage/capacity.
     *
     * @param {string} [mount] - Optional filter to request info for a specific mount point.
     * @returns {any[]} Array of disk objects.
     */
    public $disks = (mount?: string) =>
        this.runner.runSync("sys", "disks", [], { mount });

    /**
     * **Get Network Interfaces**
     *
     * Lists network interfaces and their data metrics (bytes sent/received).
     *
     * @param {string} [interfaceName] - Optional filter for a specific interface (e.g., "eth0").
     * @returns {any[]} Interface stats.
     */
    public $network = (interfaceName?: string) =>
        this.runner.runSync("sys", "network", [], { interface: interfaceName });

    /**
     * **List Processes**
     *
     * Lists active system processes. Supporting sorting and filtering.
     *
     * @param {Object} options - Filter options.
     * @param {number} [options.pid] - Filter by specific PID.
     * @param {number} [options.topCpu] - Return only top N processes by CPU usage.
     * @param {number} [options.topMem] - Return only top N processes by Memory usage.
     * @returns {any[]} List of process objects.
     *
     * @example
     * ```typescript
     * // Get top 5 CPU-consuming processes
     * const heavyProcs = __sys__.$processes({ topCpu: 5 });
     * ```
     */
    public $processes = (
        options: { pid?: number; topCpu?: number; topMem?: number } = {}
    ) => this.runner.runSync("sys", "processes", [], options);

    /**
     * **System Health Check**
     *
     * Runs quickly diagnostic heuristics on the system status.
     * @returns {any} Health status object.
     */
    public $health = () => this.runner.runSync("sys", "health");

    /**
     * **Environment Variables**
     *
     * Gets environment variables from the system scope.
     * @param {string} [variable] - Specific variable to direct query from OS.
     * @returns {any} Variable value or list of variables.
     */
    public $env = (variable?: string) =>
        this.runner.runSync("sys", "env", variable ? [variable] : []);

    /**
     * **Find Files (Search)**
     *
     * Powerful recursive file search using regex patterns.
     *
     * @param {string} p - Root directory to search.
     * @param {string} pattern - Regex pattern to match filenames.
     * @returns {string[]} List of matching file paths.
     *
     * @example
     * ```typescript
     * // Find all TypeScript files in src
     * const tsFiles = __sys__.$find("src", "\\.ts$");
     * ```
     */
    public $find = (p: string, pattern: string) =>
        this.runner.runSync("search", "find", [p], { pattern });

    /**
     * **Grep Content (Search)**
     *
     * Searches for text content within files.
     *
     * @param {string} p - Path to search.
     * @param {string} pattern - Regex or text pattern to search in file content.
     * @returns {any[]} matches.
     */
    public $grep = (p: string, pattern: string) =>
        this.runner.runSync("search", "grep", [p, pattern]);

    /**
     * **Get Active Ports**
     *
     * Lists all active network ports (listening, established) with their associated PID.
     * Vital for server monitoring.
     *
     * @returns {Object[]} List of port info objects `{ protocol, local_port, state, pid, ... }`.
     *
     * @example
     * ```typescript
     * const openPorts = __sys__.$ports().filter(p => p.state === "LISTEN");
     * ```
     */
    public $ports = () => this.runner.runSync("sys", "ports");

    /**
     * **Get Battery Status**
     *
     * Retrieves battery telemetry including charge percentage, state (Charging/Discharging), and health.
     *
     * @returns {Object} Battery info `{ percentage, state, is_present, ... }`.
     */
    public $battery = () => this.runner.runSync("sys", "battery");
}

