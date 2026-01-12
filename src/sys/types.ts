/**
 * **System Information Types**
 *
 * Standardized interfaces for the XyPriss System API.
 * Maps directly to the underlying Rust structures.
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
    total: number;
    available: number;
    used: number;
    free: number;
    usage_percent: number;
    swap_total: number;
    swap_used: number;
    swap_free: number;
    swap_percent: number;
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
    is_symlink: boolean;
    modified: string;
    created: string;
    accessed: string;
    readonly: boolean;
    permissions: number;
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

