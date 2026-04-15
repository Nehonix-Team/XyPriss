/**
 * **System Information Types**
 *
 * Standardized interfaces for the XyPriss System API.
 * Maps directly to the underlying native core structures.
 */

export interface SystemInfo {
    hostname: string;
    os_name: string;
    os_version: string;
    os_edition: string;
    kernel_version: string;
    architecture: string;
    cpu_count: number;
    cpu_brand: string;
    cpu_vendor: string;
    cpu_frequency: number; // MHz
    total_memory: number; // bytes
    used_memory: number;
    available_memory: number;
    total_swap: number;
    used_swap: number;
    uptime: number; // seconds
    boot_time: number; // unix timestamp
    load_average: {
        one: number;
        five: number;
        fifteen: number;
    };
}

export interface CpuInfo {
    name: string;
    vendor_id: string;
    brand: string;
    frequency: number;
    usage: number;
    core_count: number;
}

export interface CpuUsage {
    overall: number;
    per_core: number[];
    timestamp: number;
}

export interface MemoryInfo {
    /** Total physical memory in bytes */
    total: number;
    /** available physical memory in bytes */
    available: number;
    /** Used physical memory in bytes */
    used: number;
    /** Free physical memory in bytes */
    free: number;
    /** Memory usage percentage (0-100) */
    usage_percent: number;
    /** Total swap memory in bytes */
    swap_total: number;
    /** Used swap memory in bytes */
    swap_used: number;
    /** Free swap memory in bytes */
    swap_free: number;
    /** Swap usage percentage (0-100) */
    swap_percent: number;
}

/**
 * **System Hardware**
 *
 * A consolidated, high-level view of the system's current hardware state.
 * Combines static host information with real-time memory metrics,
 * eliminating redundant fields for a cleaner API surface.
 */
export interface SystemHardware extends MemoryInfo {
    /** Hostname of the operating system */
    hostname: string;
    /** Operating System Name (e.g., "Linux", "Windows_NT") */
    os_name: string;
    /** OS Release Version */
    os_version: string;
    /** Detailed OS Edition (e.g., "Ubuntu 22.04 LTS") */
    os_edition: string;
    /** Kernel Version */
    kernel_version: string;
    /** System Architecture (renamed from architecture) */
    arch: string;
    /** Number of logical CPU cores */
    cpu_count: number;
    /** CPU Brand String */
    cpu_brand: string;
    /** CPU Vendor ID */
    cpu_vendor: string;
    /** Base CPU Frequency in MHz */
    cpu_frequency: number;
    /** System Uptime in seconds */
    uptime: number;
    /** Boot Time (Unix Timestamp) */
    boot_time: number;
    /** System Load Averages (1, 5, 15 minutes) */
    load_average: {
        one: number;
        five: number;
        fifteen: number;
    };
}

export interface DiskInfo {
    name: string;
    mount_point: string;
    file_system: string;
    total_space: number;
    available_space: number;
    used_space: number;
    usage_percent: number;
    is_removable: boolean;
    disk_type: string;
}

export interface NetworkInterface {
    name: string;
    received: number;
    transmitted: number;
    packets_received: number;
    packets_transmitted: number;
    errors_received: number;
    errors_transmitted: number;
    mac_address: string;
    ip_addresses: string[];
}

export interface NetworkStats {
    total_received: number;
    total_transmitted: number;
    download_speed: number;
    upload_speed: number;
    interfaces: NetworkInterface[];
}

export interface ProcessInfo {
    pid: number;
    name: string;
    exe?: string;
    cmd: string[];
    cpu_usage: number;
    memory: number;
    virtual_memory: number;
    status: string;
    start_time: number;
    run_time: number;
    parent_pid?: number;
    user_id?: string;
    disk_read: number;
    disk_write: number;
}

export interface ProcessStats {
    total_processes: number;
    running: number;
    sleeping: number;
    stopped: number;
    zombie: number;
}

export interface PortInfo {
    protocol: string;
    local_address: string;
    local_port: number;
    remote_address: string;
    remote_port: number;
    state: string;
    pid?: number;
}

export interface BatteryInfo {
    state: "Charging" | "Discharging" | "Full" | "Empty" | "Unknown";
    percentage: number;
    time_to_full?: number;
    time_to_empty?: number;
    power_consumption: number;
    is_present: boolean;
    technology: string;
    vendor: string;
    model: string;
    serial: string;
}

export interface PathCheck {
    exists: boolean;
    readable: boolean;
    writable: boolean;
}

export interface FileStats {
    size: number;
    is_file: boolean;
    is_dir: boolean;
    modified: number;
    permissions: number;
    // Optional / OS-dependent fields
    is_symlink?: boolean;
    created?: number;
    accessed?: number;
    readonly?: boolean;
}

export interface DirUsage {
    path: string;
    size: number;
    file_count: number;
    dir_count: number;
}

export interface DedupeGroup {
    hash: string;
    paths: string[];
    size: number;
}

export interface SearchMatch {
    file: string;
    line: number;
    content: string;
}

export interface MonitorSnapshot {
    timestamp: string;
    cpu_usage: number;
    memory_used: number;
    memory_total: number;
    process_count: number;
}

export interface ProcessMonitorSnapshot {
    timestamp: string;
    cpu_usage: number;
    memory: number;
    disk_read: number;
    disk_write: number;
}

export interface ArchiveOptions {
    gzip?: boolean;
}

export interface BatchRenameChange {
    old_path: string;
    new_path: string;
}
/**
 * **Filesystem Open Flags**
 *
 * Standardized flags for opening files, following Node.js conventions
 * and mapping to native XHSC `os` constants.
 *
 * ---
 *
 * ### Read flags
 * - `"r"`   — Open for **reading only**. Fails if the file does not exist.
 * - `"r+"`  — Open for **reading and writing**. Fails if the file does not exist.
 * - `"rs+"` — Open for **reading and writing in synchronous mode**. Instructs the OS
 *             to bypass the local file system cache. Useful for NFS mounts or
 *             scenarios where cache coherency is critical.
 *
 * ### Write flags
 * - `"w"`   — Open for **writing only**. The file is **created** if it does not exist,
 *             or **truncated to zero length** if it does.
 * - `"wx"`  — Like `"w"`, but **fails if the file already exists** (exclusive create).
 * - `"w+"`  — Open for **reading and writing**. The file is **created** if it does not
 *             exist, or **truncated** if it does.
 * - `"wx+"` — Like `"w+"`, but **fails if the file already exists** (exclusive create).
 *
 * ### Append flags
 * - `"a"`   — Open for **appending only**. The file is **created** if it does not exist.
 *             The write position is always set to the end of the file.
 * - `"ax"`  — Like `"a"`, but **fails if the file already exists** (exclusive create).
 * - `"a+"`  — Open for **reading and appending**. The file is **created** if it does
 *             not exist. Reading is allowed from any position; writes always go to EOF.
 * - `"ax+"` — Like `"a+"`, but **fails if the file already exists** (exclusive create).
 *
 * ---
 *
 * > **`x` suffix** — The exclusive flag (`x`) maps to `O_EXCL` at the OS level.
 * > It guarantees atomicity: the operation succeeds only if *this* call creates the file,
 * > preventing race conditions in concurrent environments.
 */
export type OpenFlag =
    | "r"
    | "r+"
    | "rs+"
    | "w"
    | "wx"
    | "w+"
    | "wx+"
    | "a"
    | "ax"
    | "a+"
    | "ax+";

export type FileOpenFlags = OpenFlag | number;

