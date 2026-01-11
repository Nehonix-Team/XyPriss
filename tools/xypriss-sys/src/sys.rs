use sysinfo::{System, Disks, Networks, Components, Users};
use serde::Serialize;

#[derive(Serialize)]
pub struct SysInfo {
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub cpu_count: usize,
    pub total_memory: u64,
    pub used_memory: u64,
    pub total_swap: u64,
    pub used_swap: u64,
}

#[derive(Serialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
    pub is_removable: bool,
}

pub fn get_system_info() -> SysInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    SysInfo {
        hostname: System::host_name().unwrap_or_default(),
        os_name: System::name().unwrap_or_default(),
        os_version: System::os_version().unwrap_or_default(),
        kernel_version: System::kernel_version().unwrap_or_default(),
        cpu_count: sys.cpus().len(),
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_swap: sys.total_swap(),
        used_swap: sys.used_swap(),
    }
}

pub fn get_disks_info() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks.iter().map(|disk| DiskInfo {
        name: disk.name().to_string_lossy().into_owned(),
        mount_point: disk.mount_point().to_string_lossy().into_owned(),
        total_space: disk.total_space(),
        available_space: disk.available_space(),
        is_removable: disk.is_removable(),
    }).collect()
}
