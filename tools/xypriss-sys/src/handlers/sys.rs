use anyhow::Result;
use colored::*;
use crate::sys;
use crate::cli::{Cli, SysAction};
use crate::utils::{print_output, success_msg, print_system_info, print_cpu_bar, print_disk_info};
use std::time::Duration;

pub fn handle(action: SysAction, cli: &Cli) -> Result<()> {
    let mut sys = sys::XyPrissSys::new();

    match action {
        SysAction::Info { extended } => {
            let info = sys.get_system_info();
            if cli.json {
                println!("{}", serde_json::to_string_pretty(&info)?);
            } else {
                print_system_info(&info, extended);
            }
        }
        
        SysAction::Cpu { cores } => {
            if cores {
                let cpu_info = sys.get_cpu_info();
                print_output(&cpu_info, cli.json, "cpu")?;
            } else {
                let usage = sys.get_cpu_usage();
                print_output(&usage, cli.json, "usage")?;
                if !cli.json {
                    println!("{} Overall: {}%", "CPU".cyan().bold(), format!("{:.1}", usage.overall).yellow());
                    for (i, core_usage) in usage.per_core.iter().enumerate() {
                        print_cpu_bar(i, *core_usage);
                    }
                }
            }
        }
        
        SysAction::Memory { watch } => {
            if watch {
                loop {
                    let mem = sys.get_memory_info();
                    print!("\r{} Used: {} / {} ({:.1}%)  ",
                        "RAM".cyan().bold(),
                        sys::format_bytes(mem.used).yellow(),
                        sys::format_bytes(mem.total),
                        mem.usage_percent
                    );
                    use std::io::Write;
                    std::io::stdout().flush()?;
                    std::thread::sleep(Duration::from_secs(1));
                }
            } else {
                let mem = sys.get_memory_info();
                print_output(&mem, cli.json, "memory")?;
            }
        }
        
        SysAction::Disks { mount } => {
            if let Some(mp) = mount {
                if let Some(disk) = sys.get_disk_by_mount(&mp) {
                    print_output(&disk, cli.json, "disk")?;
                } else {
                    println!("{} Disk not found", "✗".red());
                }
            } else {
                let disks = sys.get_disks_info();
                print_output(&disks, cli.json, "disks")?;
                if !cli.json {
                    for disk in &disks {
                        print_disk_info(&disk);
                    }
                }
            }
        }
        
        SysAction::Network { interface } => {
            if let Some(iface) = interface {
                if let Some(net) = sys.get_network_interface(&iface) {
                    print_output(&net, cli.json, "interface")?;
                }
            } else {
                let stats = sys.get_network_stats();
                print_output(&stats, cli.json, "network")?;
            }
        }
        
        SysAction::Processes { pid, top_cpu, top_mem } => {
            if let Some(p) = pid {
                if let Some(proc) = sys.get_process(p) {
                    print_output(&proc, cli.json, "process")?;
                }
            } else if let Some(n) = top_cpu {
                let procs = sys.get_top_processes_by_cpu(n);
                print_output(&procs, cli.json, "processes")?;
            } else if let Some(n) = top_mem {
                let procs = sys.get_top_processes_by_memory(n);
                print_output(&procs, cli.json, "processes")?;
            } else {
                let stats = sys.get_process_stats();
                print_output(&stats, cli.json, "stats")?;
            }
        }
        
        SysAction::Temp => {
            let temps = sys.get_temperature_stats();
            print_output(&temps, cli.json, "temperatures")?;
        }
        
        SysAction::Health => {
            let score = sys.get_system_health_score();
            print_output(&score, cli.json, "score")?;
            if !cli.json {
                let color = if score > 80 { "green" } else if score > 50 { "yellow" } else { "red" };
                println!("{} System Health: {}%", "♥".red(), format!("{}", score).color(color).bold());
            }
        }
        
        SysAction::Env { var } => {
            if let Some(v) = var {
                if let Some(value) = sys.get_env_var(&v) {
                    print_output(&value, cli.json, "value")?;
                }
            } else {
                let vars = sys.get_env_vars();
                print_output(&vars, cli.json, "env")?;
            }
        }
        
        SysAction::Paths => {
            let paths = sys.get_path_dirs();
            print_output(&paths, cli.json, "paths")?;
        }
        
        SysAction::User => {
            if let Some(user) = sys.get_current_user() {
                print_output(&user, cli.json, "user")?;
            }
        }
        
        SysAction::Kill { pid } => {
            let killed = sys.kill_process(pid)?;
            if killed {
                success_msg(&format!("Process {} killed", pid), cli)?;
            } else {
                println!("{} Failed to kill process {}", "✗".red(), pid);
            }
        }
        
        SysAction::Quick => {
            let stats = sys::get_quick_stats()?;
            println!("{}", stats);
        }
 
        SysAction::Ports => {
            let ports = sys.get_ports();
            print_output(&ports, cli.json, "ports")?;
            if !cli.json {
                println!("{:<6} {:<25} {:<25} {:<15}", "PROTO", "LOCAL", "REMOTE", "STATE");
                for p in ports {
                    println!("{:<6} {:<25} {:<25} {:<15}", 
                        p.protocol.green(), 
                        format!("{}:{}", p.local_address, p.local_port),
                        format!("{}:{}", p.remote_address, p.remote_port),
                        p.state.yellow()
                    );
                }
            }
        }
 
        SysAction::Battery => {
            let info = sys.get_battery_info();
            print_output(&info, cli.json, "battery")?;
            if !cli.json {
                if !info.is_present {
                    println!("{} No battery detected", "❌".red());
                } else {
                    println!("{} Battery Status:", "🔋".green());
                    println!("   State:      {:?}", info.state);
                    println!("   Percentage: {:.1}%", info.percentage);
                    println!("   Vendor:     {}", info.vendor);
                    println!("   Model:      {}", info.model);
                }
            }
        }
    }

    Ok(())
}
