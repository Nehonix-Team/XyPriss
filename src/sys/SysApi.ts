import { FSApi } from "./FSApi";

/**
 * **Professional System Monitoring & Intelligence API**
 *
 * The `SysApi` class offers deep, real-time insights into the host environment.
 * It acts as a bridge to the operating system's kernel, providing data on
 * hardware resources, network configurations, and process management.
 *
 * This API is essential for building dashboards, monitoring tools, or simply
 * making environment-aware decisions within your application.
 *
 * **Core Capabilities:**
 * - **Hardware Telemetry:** CPU, Memory, Disk, and Battery stats.
 * - **Network Analysis:** Port scanning, Interface metrics.
 * - **Runtime Control:** Process lookups, Environment variable management.
 * - **Deep Search:** Regex-based file finding and content grep.
 *
 * @class SysApi
 * @extends FSApi
 */
export class SysApi extends FSApi {
    /**
     * **Get System Info**
     *
     * Retrieves static system information such as the OS name, kernel version,
     * architecture, and hostname.
     *
     * @param {boolean} [extended=false] - Reserved for future extended metadata.
     * @returns {any} An object containing system details (`os_name`, `kernel_version`, etc.).
     *
     * @example
     * // Logging startup environment
     * const info = __sys__.$info();
     * console.log(`Starting on ${info.hostname} (${info.os_name} ${info.kernel_version})`);
     */
    public $info = (extended = false) =>
        this.runner.runSync("sys", "info", [], { extended });

    /**
     * **Get CPU Statistics**
     *
     * Retrieves detailed CPU information including model, speed, and usage load.
     * Can return aggregated global usage or per-core statistics.
     *
     * @param {boolean} [cores=false] - If true, returns an array of data for each individual core.
     * @returns {any[]} An array of CPU objects. Index 0 usually contains global stats if cores=false.
     *
     * @example
     * // Checking CPU Model
     * const cpus = __sys__.$cpu();
     * if (cpus.length > 0) {
     *     console.log(`Processor: ${cpus[0].brand}`);
     *     console.log(`Current Load: ${cpus[0].usage}%`);
     * }
     *
     * @example
     * // Inspecting all cores
     * const allCores = __sys__.$cpu(true);
     * console.log(`Core count: ${allCores.length}`);
     */
    public $cpu = (cores = false) =>
        this.runner.runSync("sys", "cpu", [], { cores });

    /**
     * **Get Memory Usage**
     *
     * Retrieves global system memory statistics (RAM and Swap).
     * Includes total available, used, free, and cached memory values.
     *
     * @param {boolean} [watch=false] - Internal flag for continuous monitoring streams.
     * @returns {any} A memory stats object `{ total, used, free, available, swap_total, ... }`.
     *
     * @example
     * // Monitoring RAM usage
     * const mem = __sys__.$memory();
     * const usedPercent = ((mem.used / mem.total) * 100).toFixed(1);
     * console.log(`Memory Usage: ${usedPercent}%`);
     */
    public $memory = (watch = false) =>
        this.runner.runSync("sys", "memory", [], { watch });

    /**
     * **Get Mounted Disks**
     *
     * Lists all mounted filesystems across the host.
     * Returns capacity, used space, mount point, and filesystem type for each disk.
     *
     * @param {string} [mount] - Optional filter to get stats for a specific mount point (e.g., "/").
     * @returns {any[]} An array of disk objects.
     *
     * @example
     * // finding low disk space
     * const disks = __sys__.$disks();
     * disks.forEach(d => {
     *     if (d.available < 1024 * 1024 * 1024) { // < 1GB
     *         console.warn(`Low space on ${d.mount_point}: ${d.available_human}`);
     *     }
     * });
     */
    public $disks = (mount?: string) =>
        this.runner.runSync("sys", "disks", [], { mount });

    /**
     * **Get Network Interfaces**
     *
     * Retrieves data on network interfaces, including MAC addresses, IP addresses,
     * and traffic statistics (packets sent/received).
     *
     * @param {string} [interfaceName] - Optional name to filter (e.g., "eth0", "wlan0").
     * @returns {any[]} An array of interface objects.
     *
     * @example
     * // List all IPs
     * const nets = __sys__.$network();
     * nets.forEach(net => {
     *     console.log(`Interface: ${net.name}, IP: ${net.ip_v4}`);
     * });
     */
    public $network = (interfaceName?: string) =>
        this.runner.runSync("sys", "network", [], { interface: interfaceName });

    /**
     * **List & Query Processes**
     *
     * Retrieves a snapshot of the processes running on the system.
     * Supports intelligent filtering to find specific PIDs or top resource consumers.
     *
     * @param {Object} options - Search/Filter criteria.
     * @param {number} [options.pid] - Find a specific process by PID.
     * @param {number} [options.topCpu] - Get the top N processes sorted by CPU usage.
     * @param {number} [options.topMem] - Get the top N processes sorted by Memory usage.
     * @returns {any[]} List of process objects.
     *
     * @example
     * // Identifying the heaviest CPU task
     * const hogs = __sys__.$processes({ topCpu: 1 });
     * if (hogs.length) {
     *     console.log(`Top CPU: ${hogs[0].name} (${hogs[0].cpu_usage}%)`);
     * }
     */
    public $processes = (
        options: { pid?: number; topCpu?: number; topMem?: number } = {}
    ) => this.runner.runSync("sys", "processes", [], options);

    /**
     * **System Health Check**
     *
     * Runs a quick diagnostic scan of vital system parameters to determine basic health.
     * Useful for keep-alive checks or status dashboards.
     *
     * @returns {any} Health summary object.
     */
    public $health = () => this.runner.runSync("sys", "health");

    /**
     * **Environment Variables**
     *
     * Accesses the system-wide environment variables.
     * Can return all variables or the value of a specific key.
     *
     * @param {string} [variable] - The specific variable name to query (e.g., "PATH").
     * @returns {any} A dictionary of all env vars, or the string value of the requested variable.
     *
     * @example
     * // Checking user shell
     * const shell = __sys__.$env("SHELL");
     */
    public $env = (variable?: string) =>
        this.runner.runSync("sys", "env", variable ? [variable] : []);

    /**
     * **Find Files (Regex Search)**
     *
     * Performs a high-performance, recursive file search using regular expressions.
     * Search is performed at the native level, making it extremely fast even on large trees.
     *
     * @param {string} p - The root directory to start searching from.
     * @param {string} pattern - The Regex pattern to match against filenames.
     * @returns {string[]} A list of absolute paths matching the pattern.
     *
     * @example
     * // Find all config files
     * const configs = __sys__.$find("src", ".*\\.config\\.(js|ts)$");
     */
    public $find = (p: string, pattern: string) =>
        this.runner.runSync("search", "find", [p], { pattern });

    /**
     * **Grep File Content**
     *
     * Searches for text patterns *inside* files within a directory.
     * Returns matching lines along with line numbers and file paths.
     *
     * @param {string} p - The directory to search in.
     * @param {string} pattern - The text or regex to search for.
     * @returns {any[]} List of match objects `{ file, line, content }`.
     *
     * @example
     * // Finding TODO comments
     * const todos = __sys__.$grep("src", "TODO:");
     */
    public $grep = (p: string, pattern: string) =>
        this.runner.runSync("search", "grep", [p, pattern]);

    /**
     * **Get Active Ports**
     *
     * Scans for open network ports on the system. Returns detailed info including
     * the protocol (TCP/UDP), local address, state (LISTEN, ESTABLISHED), and the PID using it.
     *
     * @returns {Object[]} List of port objects.
     *
     * @example
     * // Finding what is running on port 8080
     * const ports = __sys__.$ports();
     * const appPort = ports.find(p => p.local_port === 8080);
     * if (appPort) console.log(`Port 8080 used by PID ${appPort.pid}`);
     */
    public $ports = () => this.runner.runSync("sys", "ports");

    /**
     * **Get Battery Status**
     *
     * Retrieves battery telemetry for laptops/mobile devices.
     * Includes charge percentage, charging state, health, and time remaining (if available).
     *
     * @returns {Object} Battery info `{ percentage, state, is_present, ... }`.
     *
     * @example
     * // Warn if battery is low
     * const bat = __sys__.$battery();
     * if (bat.is_present && bat.percentage < 20 && bat.state === "Discharging") {
     *     console.warn("Battery Low! Plug in soon.");
     * }
     */
    public $battery = () => this.runner.runSync("sys", "battery");
}

