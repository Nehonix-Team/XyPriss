use anyhow::Result;
use colored::*;
use std::time::Duration;
use crate::sys;
use crate::cli::{Cli, MonitorAction};

pub fn handle(action: MonitorAction, cli: &Cli) -> Result<()> {
    let mut sys = sys::XyPrissSys::new();

    match action {
        MonitorAction::System { duration, interval } => {
            println!("{} Monitoring system for {}s (interval: {}s)", "⚡".yellow(), duration, interval);
            
            sys.monitor(Duration::from_secs(duration), Duration::from_secs_f64(interval), |snapshot| {
                if cli.json {
                    println!("{}", serde_json::to_string(&snapshot).unwrap());
                } else {
                    print!("\r{} CPU: {:.1}%  RAM: {} / {}  Processes: {}  ",
                        "⚡".yellow(),
                        snapshot.cpu_usage,
                        sys::format_bytes(snapshot.memory_used),
                        sys::format_bytes(snapshot.memory_total),
                        snapshot.process_count
                    );
                    use std::io::Write;
                    std::io::stdout().flush().ok();
                }
            });
            println!("\n{} Monitoring complete", "✓".green());
        }
        
        MonitorAction::Process { pid, duration } => {
            println!("{} Monitoring process {} for {}s", "⚡".yellow(), pid, duration);
            
            sys.monitor_process(pid, Duration::from_secs(duration), Duration::from_secs(1), |info| {
                if cli.json {
                    println!("{}", serde_json::to_string(&info).unwrap());
                } else {
                    print!("\r{} CPU: {:.1}%  RAM: {}  Disk R/W: {} / {}  ",
                        "⚡".yellow(),
                        info.cpu_usage,
                        sys::format_bytes(info.memory),
                        sys::format_bytes(info.disk_read),
                        sys::format_bytes(info.disk_write)
                    );
                    use std::io::Write;
                    std::io::stdout().flush().ok();
                }
            });
            println!("\n{} Monitoring complete", "✓".green());
        }
    }

    Ok(())
}
