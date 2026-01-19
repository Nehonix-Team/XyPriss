/* *****************************************************************************
 * Nehonix XyPriss System Information Module
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

use sysinfo::{System, Disks, Networks, Components, Users};
use serde::{Serialize, Deserialize};
use anyhow::Result;
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::path::PathBuf;
use std::thread;

// ============ SYSTEM INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SysInfo {
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub os_edition: String,
    pub kernel_version: String,
    pub architecture: String,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub cpu_vendor: String,
    pub cpu_frequency: u64, // MHz
    pub total_memory: u64,  // bytes
    pub used_memory: u64,
    pub available_memory: u64,
    pub total_swap: u64,
    pub used_swap: u64,
    pub uptime: u64,        // seconds
    pub boot_time: u64,     // unix timestamp
    pub load_average: LoadAverage,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoadAverage {
    pub one: f64,
    pub five: f64,
    pub fifteen: f64,
}

// ============ CPU INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CpuInfo {
    pub name: String,
    pub vendor_id: String,
    pub brand: String,
    pub frequency: u64,      // MHz
    pub usage: f32,          // percentage
    pub core_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CpuUsage {
    pub overall: f32,
    pub per_core: Vec<f32>,
    pub timestamp: u64,
}

// ============ MEMORY INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemoryInfo {
    pub total: u64,
    pub available: u64,
    pub used: u64,
    pub free: u64,
    pub usage_percent: f64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub swap_free: u64,
    pub swap_percent: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemoryStats {
    pub current: MemoryInfo,
    pub peak_usage: u64,
    pub average_usage: u64,
}

// ============ DISK INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub file_system: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub usage_percent: f64,
    pub is_removable: bool,
    pub disk_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiskIOStats {
    pub read_bytes: u64,
    pub write_bytes: u64,
    pub read_count: u64,
    pub write_count: u64,
}

// ============ NETWORK INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NetworkInterface {
    pub name: String,
    pub received: u64,       // bytes
    pub transmitted: u64,    // bytes
    pub packets_received: u64,
    pub packets_transmitted: u64,
    pub errors_received: u64,
    pub errors_transmitted: u64,
    pub mac_address: String,
    pub ip_addresses: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NetworkStats {
    pub total_received: u64,
    pub total_transmitted: u64,
    pub download_speed: f64,  // bytes/sec
    pub upload_speed: f64,
    pub interfaces: Vec<NetworkInterface>,
}

// ============ PROCESS INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub exe: Option<String>,
    pub cmd: Vec<String>,
    pub cpu_usage: f32,
    pub memory: u64,
    pub virtual_memory: u64,
    pub status: String,
    pub start_time: u64,
    pub run_time: u64,
    pub parent_pid: Option<u32>,
    pub user_id: Option<String>,
    pub disk_read: u64,
    pub disk_write: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessStats {
    pub total_processes: usize,
    pub running: usize,
    pub sleeping: usize,
    pub stopped: usize,
    pub zombie: usize,
}

// ============ BATTERY INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BatteryInfo {
    pub state: BatteryState,
    pub percentage: f32,
    pub time_to_full: Option<u64>,  // seconds
    pub time_to_empty: Option<u64>,
    pub power_consumption: f64,      // watts
    pub is_present: bool,
    pub technology: String,
    pub vendor: String,
    pub model: String,
    pub serial: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum BatteryState {
    Charging,
    Discharging,
    Full,
    Empty,
    Unknown,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PortInfo {
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub state: String,
    pub pid: Option<u32>,
}

// ============ TEMPERATURE INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TemperatureInfo {
    pub label: String,
    pub current: f32,      // Celsius
    pub critical: Option<f32>,
    pub max: Option<f32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThermalStats {
    pub components: Vec<TemperatureInfo>,
    pub average_temp: f32,
    pub max_temp: f32,
    pub critical_count: usize,
}

// ============ USER INFO ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserInfo {
    pub name: String,
    pub uid: u32,
    pub gid: u32,
    pub groups: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionInfo {
    pub current_user: UserInfo,
    pub all_users: Vec<String>,
    pub login_time: u64,
}

// ============ MAIN SYSTEM MONITOR ============

pub struct XyPrissSys {
    system: System,
    last_network_check: Option<(SystemTime, u64, u64)>,
}

impl XyPrissSys {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        
        Self {
            system,
            last_network_check: None,
        }
    }

    pub fn refresh(&mut self) {
        self.system.refresh_all();
    }

    pub fn refresh_cpu(&mut self) {
        self.system.refresh_cpu_all();
        // sysinfo needs two samples with a delay to calculate CPU usage
        thread::sleep(Duration::from_millis(200));
        self.system.refresh_cpu_all();
    }

    pub fn refresh_memory(&mut self) {
        self.system.refresh_memory();
    }

    pub fn refresh_processes(&mut self) {
        self.system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        // sysinfo needs two samples with a delay to calculate CPU usage changes
        thread::sleep(Duration::from_millis(200));
        self.system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    }

    // ============ SYSTEM INFO ============

    pub fn get_system_info(&mut self) -> SysInfo {
        self.refresh();
        
        let load_avg = System::load_average();
        
        SysInfo {
            hostname: System::host_name().unwrap_or_default(),
            os_name: System::name().unwrap_or_default(),
            os_version: System::os_version().unwrap_or_default(),
            os_edition: System::long_os_version().unwrap_or_default(),
            kernel_version: System::kernel_version().unwrap_or_default(),
            architecture: std::env::consts::ARCH.to_string(),
            cpu_count: self.system.cpus().len(),
            cpu_brand: self.system.cpus().first()
                .map(|c| c.brand().to_string())
                .unwrap_or_default(),
            cpu_vendor: self.system.cpus().first()
                .map(|c| c.vendor_id().to_string())
                .unwrap_or_default(),
            cpu_frequency: self.system.cpus().first()
                .map(|c| c.frequency())
                .unwrap_or(0),
            total_memory: self.system.total_memory(),
            used_memory: self.system.used_memory(),
            available_memory: self.system.available_memory(),
            total_swap: self.system.total_swap(),
            used_swap: self.system.used_swap(),
            uptime: System::uptime(),
            boot_time: System::boot_time(),
            load_average: LoadAverage {
                one: load_avg.one,
                five: load_avg.five,
                fifteen: load_avg.fifteen,
            },
        }
    }

    pub fn get_platform_info(&self) -> HashMap<String, String> {
        let mut info = HashMap::new();
        
        info.insert("os".to_string(), std::env::consts::OS.to_string());
        info.insert("family".to_string(), std::env::consts::FAMILY.to_string());
        info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
        info.insert("exe_suffix".to_string(), std::env::consts::EXE_SUFFIX.to_string());
        info.insert("dll_prefix".to_string(), std::env::consts::DLL_PREFIX.to_string());
        info.insert("dll_suffix".to_string(), std::env::consts::DLL_SUFFIX.to_string());
        
        if let Ok(hostname) = std::env::var("HOSTNAME").or_else(|_| std::env::var("COMPUTERNAME")) {
            info.insert("hostname_env".to_string(), hostname);
        }
        
        info
    }

    // ============ CPU INFO ============

    pub fn get_cpu_info(&mut self) -> Vec<CpuInfo> {
        self.refresh_cpu();
        
        self.system.cpus().iter().enumerate().map(|(i, cpu)| {
            CpuInfo {
                name: format!("CPU {}", i),
                vendor_id: cpu.vendor_id().to_string(),
                brand: cpu.brand().to_string(),
                frequency: cpu.frequency(),
                usage: cpu.cpu_usage(),
                core_count: self.system.cpus().len(),
            }
        }).collect()
    }

    pub fn get_cpu_usage(&mut self) -> CpuUsage {
        self.refresh_cpu();
        
        let per_core: Vec<f32> = self.system.cpus().iter()
            .map(|cpu| cpu.cpu_usage())
            .collect();
        
        let overall = if !per_core.is_empty() {
            per_core.iter().sum::<f32>() / per_core.len() as f32
        } else {
            0.0
        };
        
        CpuUsage {
            overall,
            per_core,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }

    pub fn get_global_cpu_usage(&mut self) -> f32 {
        self.refresh_cpu();
        self.system.global_cpu_usage()
    }

    // ============ MEMORY INFO ============

    pub fn get_memory_info(&mut self) -> MemoryInfo {
        self.refresh_memory();
        
        let total = self.system.total_memory();
        let used = self.system.used_memory();
        let available = self.system.available_memory();
        let free = self.system.free_memory();
        
        let swap_total = self.system.total_swap();
        let swap_used = self.system.used_swap();
        let swap_free = self.system.free_swap();
        
        MemoryInfo {
            total,
            available,
            used,
            free,
            usage_percent: if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 },
            swap_total,
            swap_used,
            swap_free,
            swap_percent: if swap_total > 0 { (swap_used as f64 / swap_total as f64) * 100.0 } else { 0.0 },
        }
    }

    pub fn get_memory_available(&mut self) -> u64 {
        self.refresh_memory();
        self.system.available_memory()
    }

    pub fn get_memory_usage_percent(&mut self) -> f64 {
        self.refresh_memory();
        let total = self.system.total_memory();
        let used = self.system.used_memory();
        if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        }
    }

    // ============ DISK INFO ============

    pub fn get_disks_info(&self) -> Vec<DiskInfo> {
        let disks = Disks::new_with_refreshed_list();
        
        disks.iter().map(|disk| {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total - available;
            
            DiskInfo {
                name: disk.name().to_string_lossy().into_owned(),
                mount_point: disk.mount_point().to_string_lossy().into_owned(),
                file_system: disk.file_system().to_string_lossy().into_owned(),
                total_space: total,
                available_space: available,
                used_space: used,
                usage_percent: if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 },
                is_removable: disk.is_removable(),
                disk_type: format!("{:?}", disk.kind()),
            }
        }).collect()
    }

    pub fn get_disk_by_mount<P: AsRef<std::path::Path>>(&self, mount_point: P) -> Option<DiskInfo> {
        let disks = self.get_disks_info();
        let path_str = mount_point.as_ref().to_string_lossy();
        
        disks.into_iter()
            .find(|d| d.mount_point == path_str)
    }

    pub fn get_total_disk_space(&self) -> u64 {
        self.get_disks_info().iter()
            .map(|d| d.total_space)
            .sum()
    }

    pub fn get_available_disk_space(&self) -> u64 {
        self.get_disks_info().iter()
            .map(|d| d.available_space)
            .sum()
    }

    // ============ NETWORK INFO ============

    pub fn get_network_stats(&mut self) -> NetworkStats {
        // Initial sample
        let mut networks = Networks::new_with_refreshed_list();
        
        let initial_received: u64 = networks.iter().map(|(_, data)| data.total_received()).sum();
        let initial_transmitted: u64 = networks.iter().map(|(_, data)| data.total_transmitted()).sum();

        // Wait for a sample duration to calculate instantaneous speed
        // This makes the CLI call slower (300ms), but provides useful data
        std::thread::sleep(Duration::from_millis(300));
        networks.refresh(true);

        let total_received: u64 = networks.iter().map(|(_, data)| data.total_received()).sum();
        let total_transmitted: u64 = networks.iter().map(|(_, data)| data.total_transmitted()).sum();
        
        // Calculate speed (Bytes / Second)
        let elapsed = 0.3; // 300ms
        let download_speed = (total_received.saturating_sub(initial_received)) as f64 / elapsed;
        let upload_speed = (total_transmitted.saturating_sub(initial_transmitted)) as f64 / elapsed;

        let interfaces: Vec<NetworkInterface> = networks.iter().map(|(name, data)| {
            // Attempt to resolve IP for this interface
            let ips = local_ip_address::list_afinet_netifas()
                .ok()
                .map(|list| {
                    list.into_iter()
                        .filter(|(n, _)| n == name)
                        .map(|(_, ip)| ip.to_string())
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();

            NetworkInterface {
                name: name.to_string(),
                received: data.total_received(),
                transmitted: data.total_transmitted(),
                packets_received: data.total_packets_received(),
                packets_transmitted: data.total_packets_transmitted(),
                errors_received: data.total_errors_on_received(),
                errors_transmitted: data.total_errors_on_transmitted(),
                mac_address: data.mac_address().to_string(),
                ip_addresses: ips,
            }
        }).collect();
        
        NetworkStats {
            total_received,
            total_transmitted,
            download_speed,
            upload_speed,
            interfaces,
        }
    }

    pub fn get_network_interface(&self, name: &str) -> Option<NetworkInterface> {
        let networks = Networks::new_with_refreshed_list();
        
        networks.iter()
            .find(|(n, _)| *n == name)
            .map(|(name, data)| NetworkInterface {
                name: name.to_string(),
                received: data.total_received(),
                transmitted: data.total_transmitted(),
                packets_received: data.total_packets_received(),
                packets_transmitted: data.total_packets_transmitted(),
                errors_received: data.total_errors_on_received(),
                errors_transmitted: data.total_errors_on_transmitted(),
                mac_address: data.mac_address().to_string(),
                ip_addresses: vec![],
            })
    }

    // ============ PROCESS INFO ============

    pub fn get_processes(&mut self) -> Vec<ProcessInfo> {
        self.refresh_processes();
        
        self.system.processes().values().map(|process| {
            ProcessInfo {
                pid: process.pid().as_u32(),
                name: process.name().to_string_lossy().into_owned(),
                exe: process.exe().map(|p| p.to_string_lossy().into_owned()),
                cmd: process.cmd().iter().map(|s| s.to_string_lossy().into_owned()).collect(),
                cpu_usage: process.cpu_usage(),
                memory: process.memory(),
                virtual_memory: process.virtual_memory(),
                status: format!("{:?}", process.status()),
                start_time: process.start_time(),
                run_time: process.run_time(),
                parent_pid: process.parent().map(|p| p.as_u32()),
                user_id: process.user_id().map(|u| u.to_string()),
                disk_read: process.disk_usage().total_read_bytes,
                disk_write: process.disk_usage().total_written_bytes,
            }
        }).collect()
    }

    pub fn get_process(&mut self, pid: u32) -> Option<ProcessInfo> {
        self.refresh_processes();
        
        let pid = sysinfo::Pid::from_u32(pid);
        self.system.process(pid).map(|process| {
            ProcessInfo {
                pid: process.pid().as_u32(),
                name: process.name().to_string_lossy().into_owned(),
                exe: process.exe().map(|p| p.to_string_lossy().into_owned()),
                cmd: process.cmd().iter().map(|s| s.to_string_lossy().into_owned()).collect(),
                cpu_usage: process.cpu_usage(),
                memory: process.memory(),
                virtual_memory: process.virtual_memory(),
                status: format!("{:?}", process.status()),
                start_time: process.start_time(),
                run_time: process.run_time(),
                parent_pid: process.parent().map(|p| p.as_u32()),
                user_id: process.user_id().map(|u| u.to_string()),
                disk_read: process.disk_usage().total_read_bytes,
                disk_write: process.disk_usage().total_written_bytes,
            }
        })
    }

    pub fn get_current_process(&mut self) -> Option<ProcessInfo> {
        let pid = std::process::id();
        self.get_process(pid)
    }

    pub fn get_process_stats(&mut self) -> ProcessStats {
        self.refresh_processes();
        
        let mut running = 0;
        let mut sleeping = 0;
        let mut stopped = 0;
        let mut zombie = 0;
        
        for process in self.system.processes().values() {
            match format!("{:?}", process.status()).as_str() {
                "Run" => running += 1,
                "Sleep" => sleeping += 1,
                "Stop" => stopped += 1,
                "Zombie" => zombie += 1,
                _ => {}
            }
        }
        
        ProcessStats {
            total_processes: self.system.processes().len(),
            running,
            sleeping,
            stopped,
            zombie,
        }
    }

    pub fn get_top_processes_by_cpu(&mut self, limit: usize) -> Vec<ProcessInfo> {
        let mut processes = self.get_processes();
        processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap());
        processes.truncate(limit);
        processes
    }

    pub fn get_top_processes_by_memory(&mut self, limit: usize) -> Vec<ProcessInfo> {
        let mut processes = self.get_processes();
        processes.sort_by(|a, b| b.memory.cmp(&a.memory));
        processes.truncate(limit);
        processes
    }

    pub fn kill_process(&mut self, pid: u32) -> Result<bool> {
        let pid = sysinfo::Pid::from_u32(pid);
        
        if let Some(process) = self.system.process(pid) {
            Ok(process.kill())
        } else {
            Err(anyhow::anyhow!("Process not found"))
        }
    }

    // ============ TEMPERATURE INFO ============

    pub fn get_temperature_stats(&self) -> ThermalStats {
        let components = Components::new_with_refreshed_list();
        
        let temps: Vec<TemperatureInfo> = components.iter().map(|comp| {
            TemperatureInfo {
                label: comp.label().to_string(),
                current: comp.temperature().unwrap_or(0.0),
                critical: comp.critical(),
                max: comp.max(),
            }
        }).collect();
        
        let avg = if !temps.is_empty() {
            temps.iter().map(|t| t.current).sum::<f32>() / temps.len() as f32
        } else {
            0.0
        };
        
        let max = temps.iter().map(|t| t.current).fold(0.0f32, |a, b| a.max(b));
        let critical_count = temps.iter().filter(|t| {
            t.critical.map(|c| t.current >= c).unwrap_or(false)
        }).count();
        
        ThermalStats {
            components: temps,
            average_temp: avg,
            max_temp: max,
            critical_count,
        }
    }

    // ============ USER INFO ============

    pub fn get_users(&self) -> Vec<String> {
        let users = Users::new_with_refreshed_list();
        users.iter().map(|u| u.name().to_string()).collect()
    }

    pub fn get_current_user(&self) -> Option<String> {
        std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .ok()
    }

    // ============ ENVIRONMENT ============

    pub fn get_env_vars(&self) -> HashMap<String, String> {
        std::env::vars().collect()
    }

    pub fn get_env_var(&self, key: &str) -> Option<String> {
        std::env::var(key).ok()
    }

    pub fn get_path_dirs(&self) -> Vec<PathBuf> {
        if let Some(path) = self.get_env_var("PATH") {
            std::env::split_paths(&path).collect()
        } else {
            vec![]
        }
    }

    pub fn get_home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir()
    }

    pub fn get_config_dir(&self) -> Option<PathBuf> {
        dirs::config_dir()
    }

    pub fn get_cache_dir(&self) -> Option<PathBuf> {
        dirs::cache_dir()
    }

    pub fn get_data_dir(&self) -> Option<PathBuf> {
        dirs::data_dir()
    }

    pub fn get_temp_dir(&self) -> PathBuf {
        std::env::temp_dir()
    }

    // ============ SYSTEM HEALTH ============

    pub fn is_system_healthy(&mut self) -> bool {
        let mem = self.get_memory_info();
        let cpu = self.get_global_cpu_usage();
        
        // Memory usage < 90%, CPU < 90%, swap < 50%
        mem.usage_percent < 90.0 
            && cpu < 90.0 
            && mem.swap_percent < 50.0
    }

    pub fn get_system_health_score(&mut self) -> u8 {
        let mem = self.get_memory_info();
        let cpu = self.get_global_cpu_usage();
        let load = System::load_average();
        
        let mem_score = ((100.0 - mem.usage_percent) as u8).min(100);
        let cpu_score = ((100.0 - cpu) as u8).min(100);
        let load_score = if self.system.cpus().len() > 0 {
            let load_ratio = load.one / self.system.cpus().len() as f64;
            ((100.0 - load_ratio * 100.0).max(0.0) as u8).min(100)
        } else {
            100
        };
        
        (mem_score + cpu_score + load_score) / 3
    }

    // ============ MONITORING ============

    pub fn monitor<F>(&mut self, duration: Duration, interval: Duration, mut callback: F)
    where
        F: FnMut(SystemSnapshot),
    {
        let start = std::time::Instant::now();
        
        while start.elapsed() < duration {
            self.refresh();
            
            let snapshot = SystemSnapshot {
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                cpu_usage: self.get_global_cpu_usage(),
                memory_used: self.system.used_memory(),
                memory_total: self.system.total_memory(),
                process_count: self.system.processes().len(),
            };
            
            callback(snapshot);
            std::thread::sleep(interval);
        }
    }

    pub fn monitor_process(&mut self, pid: u32, duration: Duration, interval: Duration, callback: impl Fn(ProcessInfo)) {
        let start = std::time::Instant::now();
        
        while start.elapsed() < duration {
            self.refresh_processes();
            
            if let Some(info) = self.get_process(pid) {
                callback(info);
            } else {
                break; // Process terminated
            }
            
            std::thread::sleep(interval);
        }
    }

    pub fn get_battery_info(&self) -> BatteryInfo {
        #[cfg(target_os = "linux")]
        {
            let read_sys_file = |name: &str| -> Option<String> {
                std::fs::read_to_string(format!("/sys/class/power_supply/BAT0/{}", name)).ok().map(|s| s.trim().to_string())
            };

            if let Some(capacity_str) = read_sys_file("capacity") {
                let percentage = capacity_str.parse::<f32>().unwrap_or(0.0);
                let status_str = read_sys_file("status").unwrap_or_default();
                let state = match status_str.as_str() {
                    "Charging" => BatteryState::Charging,
                    "Discharging" => BatteryState::Discharging,
                    "Full" => BatteryState::Full,
                    _ => BatteryState::Unknown,
                };

                return BatteryInfo {
                    state,
                    percentage,
                    time_to_full: None,
                    time_to_empty: None,
                    power_consumption: 0.0,
                    is_present: true,
                    technology: read_sys_file("technology").unwrap_or_default(),
                    vendor: read_sys_file("manufacturer").unwrap_or_default(),
                    model: read_sys_file("model_name").unwrap_or_default(),
                    serial: read_sys_file("serial_number").unwrap_or_default(),
                };
            }
        }

        BatteryInfo {
            state: BatteryState::Unknown,
            percentage: 0.0,
            time_to_full: None,
            time_to_empty: None,
            power_consumption: 0.0,
            is_present: false,
            technology: String::new(),
            vendor: String::new(),
            model: String::new(),
            serial: String::new(),
        }
    }

    pub fn get_ports(&self) -> Vec<PortInfo> {
        let mut ports = Vec::new();

        #[cfg(target_os = "linux")]
        {
            let files = [("/proc/net/tcp", "TCP"), ("/proc/net/udp", "UDP")];
            for (file, proto) in files {
                if let Ok(content) = std::fs::read_to_string(file) {
                    for line in content.lines().skip(1) {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() < 4 { continue; }

                        let local = self.parse_proc_addr(parts[1]);
                        let remote = self.parse_proc_addr(parts[2]);
                        let state = self.parse_proc_state(parts[3]);

                        if let (Some((l_addr, l_port)), Some((r_addr, r_port))) = (local, remote) {
                            ports.push(PortInfo {
                                protocol: proto.to_string(),
                                local_address: l_addr,
                                local_port: l_port,
                                remote_address: r_addr,
                                remote_port: r_port,
                                state,
                                pid: None,
                            });
                        }
                    }
                }
            }
        }

        ports
    }

    fn parse_proc_addr(&self, addr: &str) -> Option<(String, u16)> {
        let parts: Vec<&str> = addr.split(':').collect();
        if parts.len() != 2 { return None; }

        let hex_addr = u32::from_str_radix(parts[0], 16).ok()?;
        let port = u16::from_str_radix(parts[1], 16).ok()?;

        let ip = std::net::Ipv4Addr::from(hex_addr.to_be());
        Some((ip.to_string(), port))
    }

    fn parse_proc_state(&self, state: &str) -> String {
        match state {
            "01" => "ESTABLISHED",
            "02" => "SYN_SENT",
            "03" => "SYN_RECV",
            "04" => "FIN_WAIT1",
            "05" => "FIN_WAIT2",
            "06" => "TIME_WAIT",
            "07" => "CLOSE",
            "08" => "CLOSE_WAIT",
            "09" => "LAST_ACK",
            "0A" => "LISTEN",
            "0B" => "CLOSING",
            _ => "UNKNOWN",
        }.to_string()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemSnapshot {
    pub timestamp: u64,
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub process_count: usize,
}

// ============ HELPER FUNCTIONS ============

pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    let bytes = bytes as f64;
    let i = (bytes.log(1024.0).floor() as usize).min(UNITS.len() - 1);
    let value = bytes / 1024_f64.powi(i as i32);
    
    format!("{:.2} {}", value, UNITS[i])
}

pub fn format_duration(seconds: u64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;
    
    if days > 0 {
        format!("{}d {}h {}m {}s", days, hours, minutes, secs)
    } else if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, secs)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}

pub fn get_quick_stats() -> Result<String> {
    let mut sys = XyPrissSys::new();
    let info = sys.get_system_info();
    let mem = sys.get_memory_info();
    let cpu = sys.get_global_cpu_usage();
    
    Ok(format!(
        "OS: {} {}\nCPU: {} ({}%) \nRAM: {} / {} ({}%)\nUptime: {}",
        info.os_name,
        info.os_version,
        info.cpu_brand,
        cpu,
        format_bytes(mem.used),
        format_bytes(mem.total),
        mem.usage_percent as u32,
        format_duration(info.uptime)
    ))
}
