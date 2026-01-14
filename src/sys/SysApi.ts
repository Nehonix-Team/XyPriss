/* *****************************************************************************
 * Nehonix XyPriss System
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

import { FSApi } from "./FSApi";
import {
    SystemInfo,
    CpuInfo,
    CpuUsage,
    MemoryInfo,
    DiskInfo,
    NetworkInterface,
    NetworkStats,
    ProcessInfo,
    PortInfo,
    BatteryInfo,
    SearchMatch,
    ProcessStats,
    SystemHardware,
} from "./types";

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
     * @returns {SystemInfo} An object containing system details (`os_name`, `kernel_version`, etc.).
     *
     * @example
     * // Logging startup environment
     * const info = __sys__.$info();
     * console.log(`Starting on ${info.hostname} (${info.os_name} ${info.kernel_version})`);
     */
    public $info = (extended = false): SystemInfo =>
        this.runner.runSync("sys", "info", [], { extended });

    /**
     * **Get CPU Statistics**
     *
     * Retrieves detailed CPU information. Returns an array of core stats if `cores`
     * is true, or a global usage summary object if `cores` is false.
     *
     * @param {boolean} [cores=false] - If true, returns detailed per-core info.
     * @returns {CpuUsage | CpuInfo[]} Global usage stats or array of core details.
     *
     * @example
     * // Simple usage check
     * const cpu = __sys__.$cpu() as CpuUsage;
     * console.log(`Load: ${cpu.overall}%`);
     *
     * @example
     * // Detailed Core Info
     * const cores = __sys__.$cpu(true) as CpuInfo[];
     * console.log(`Core 0 Speed: ${cores[0].frequency} MHz`);
     */
    public $cpu = (cores = false): CpuUsage | CpuInfo[] =>
        this.runner.runSync("sys", "cpu", [], { cores });

    /**
     * **Get Memory Usage**
     *
     * Retrieves global system memory statistics (RAM and Swap).
     * Includes total available, used, free, and cached memory values.
     *
     * @param {boolean} [watch=false] - Internal flag for continuous monitoring streams.
     * @returns {MemoryInfo} A memory stats object `{ total, used, free, available, swap_total, ... }`.
     *
     * @example
     * // Monitoring RAM usage
     * const mem = __sys__.$memory();
     * const usedPercent = ((mem.used / mem.total) * 100).toFixed(1);
     * console.log(`Memory Usage: ${usedPercent}%`);
     */
    public $memory = (watch = false): MemoryInfo =>
        this.runner.runSync("sys", "memory", [], { watch });

    /**
     * **Get Hardware Telemetry**
     *
     * Retrieves a consolidated view of the system's hardware state, combining
     * real-time memory metrics with static system information.
     *
     * @returns {SystemHardware} Consolidated system hardware object.
     *
     * @example
     * // One-call hardware check
     * const hw = __sys__.$hardware;
     * console.log(`[${hw.arch}] ${hw.hostname}: ${hw.usage_percent}% Mem Used`);
     */
    public get $hardware(): SystemHardware {
        const mem = this.$memory();
        const info = this.$info();

        // Destructure to remove duplicate keys from SystemInfo
        // that are already better represented in MemoryInfo
        const {
            total_memory,
            used_memory,
            available_memory,
            total_swap,
            used_swap,
            architecture, // Renaming this
            ...restInfo
        } = info;

        return {
            ...mem, // Spread MemoryInfo first (standard keys like 'total', 'used')
            ...restInfo, // Spread remaining SystemInfo
            arch: architecture, // Add renamed 'arch' property
        };
    }

    /**
     * **Alias for $hardware**
     *
     * Shorthand alias for accessing system hardware info.
     * @example
     * // One-call hardware check
     * const hw = __sys__.hdw;
     * console.log(`[${hw.arch}] ${hw.hostname}: ${hw.usage_percent}% Mem Used`);
     *
     * @see {@link SysApi.$hardware}
     */
    public get hdw(): SystemHardware {
        return this.$hardware;
    }

    /**
     * **Get Mounted Disks**
     *
     * Lists all mounted filesystems across the host.
     * Returns capacity, used space, mount point, and filesystem type for each disk.
     *
     * @param {string} [mount] - Optional filter to get stats for a specific mount point (e.g., "/").
     * @returns {DiskInfo[]} An array of disk objects.
     *
     * @example
     * // finding low disk space
     * const disks = __sys__.$disks();
     * disks.forEach(d => {
     *     if (d.available_space < 1024 * 1024 * 1024) { // < 1GB
     *         console.warn(`Low space on ${d.mount_point}`);
     *     }
     * });
     */
    public $disks = (mount?: string): DiskInfo[] =>
        this.runner.runSync("sys", "disks", [], { mount });

    /**
     * **Get Network Interfaces**
     *
     * Retrieves data on network interfaces, including MAC addresses, IP addresses,
     * and traffic statistics (packets sent/received).
     *
     * @param {string} [interfaceName] - Optional name to filter (e.g., "eth0", "wlan0").
     * @returns {NetworkStats | NetworkInterface} Global stats or specific interface details.
     *
     * @example
     * // List all IPs
     * const net = __sys__.$network() as NetworkStats;
     * net.interfaces.forEach(i => {
     *     console.log(`Interface: ${i.name}, IPs: ${i.ip_addresses.join(", ")}`);
     * });
     */
    public $network = (
        interfaceName?: string
    ): NetworkStats | NetworkInterface =>
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
     * @returns {ProcessInfo[] | ProcessInfo | ProcessStats} Process list, single process, or summary stats.
     *
     * @example
     * // Identifying the heaviest CPU task
     * const hogs = __sys__.$processes({ topCpu: 1 }) as ProcessInfo[];
     * if (hogs.length) {
     *     console.log(`Top CPU: ${hogs[0].name} (${hogs[0].cpu_usage}%)`);
     * }
     */
    public $processes = (
        options: { pid?: number; topCpu?: number; topMem?: number } = {}
    ): ProcessInfo[] | ProcessInfo | ProcessStats =>
        this.runner.runSync("sys", "processes", [], options);

    /**
     * **System Health Check**
     *
     * Runs a quick diagnostic scan of vital system parameters to determine basic health.
     * Useful for keep-alive checks or status dashboards.
     *
     * @returns {any} Health summary object (structure may vary).
     */
    public $health = (): any => this.runner.runSync("sys", "health");

    /**
     * **Environment Variables**
     *
     * Accesses the system-wide environment variables.
     * Can return all variables or the value of a specific key.
     *
     * @param {string} [variable] - The specific variable name to query (e.g., "PATH").
     * @returns {Record<string, string> | string } A dictionary of all env vars, or the string value of the requested variable.
     *
     * @example
     * // Checking user shell
     * const shell = __sys__.$env("SHELL");
     */
    public $env = (variable?: string): Record<string, string> | string =>
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
    public $find = (p: string, pattern: string): string[] =>
        this.runner.runSync("search", "find", [p], { pattern });

    /**
     * **Grep File Content**
     *
     * Searches for text patterns *inside* files within a directory.
     * Returns matching lines along with line numbers and file paths.
     *
     * @param {string} p - The directory to search in.
     * @param {string} pattern - The text or regex to search for.
     * @returns {SearchMatch[]} List of match objects `{ file, line, content }`.
     *
     * @example
     * // Finding TODO comments
     * const todos = __sys__.$grep("src", "TODO:");
     */
    public $grep = (p: string, pattern: string): SearchMatch[] =>
        this.runner.runSync("search", "grep", [p, pattern]);

    /**
     * **Get Active Ports**
     *
     * Scans for open network ports on the system. Returns detailed info including
     * the protocol (TCP/UDP), local address, state (LISTEN, ESTABLISHED), and the PID using it.
     *
     * @returns {PortInfo[]} List of port objects.
     *
     * @example
     * // Finding what is running on port 8080
     * const ports = __sys__.$ports();
     * const appPort = ports.find(p => p.local_port === 8080);
     * if (appPort) console.log(`Port 8080 used by PID ${appPort.pid}`);
     */
    public $ports = (): PortInfo[] => this.runner.runSync("sys", "ports");

    /**
     * **Get Battery Status**
     *
     * Retrieves battery telemetry for laptops/mobile devices.
     * Includes charge percentage, charging state, health, and time remaining (if available).
     *
     * @returns {BatteryInfo} Battery info `{ percentage, state, is_present, ... }`.
     *
     * @example
     * // Warn if battery is low
     * const bat = __sys__.$battery();
     * if (bat.is_present && bat.percentage < 20 && bat.state === "Discharging") {
     *     console.warn("Battery Low! Plug in soon.");
     * }
     */
    public $battery = (): BatteryInfo => this.runner.runSync("sys", "battery");
}

