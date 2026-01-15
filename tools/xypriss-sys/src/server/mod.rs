use clap::Subcommand;
use std::path::PathBuf;
use anyhow::Result;
use crate::Cli;

mod core;
mod ipc;
mod router;

#[derive(Subcommand, Clone, Debug)]
pub enum ServerAction {
    /// Start the XHSC (XyPriss Hybrid Server Core)
    Start {
        /// Port to listen on
        #[arg(short, long, default_value = "4349")]
        port: u16,
        
        /// Host to bind to
        #[arg(short, long, default_value = "127.0.0.1")]
        host: String,

        /// IPC path (Unix Domain Socket) for JS communication
        #[arg(short, long)]
        ipc: Option<String>,

        /// Request timeout in seconds
        #[arg(long, default_value = "30")]
        timeout: u64,

        /// Max body size in bytes
        #[arg(long, default_value = "10485760")] // 10MB
        max_body_size: usize,
    },
    /// Stop the running XHSC
    Stop {
        /// PID of the server process
        pid: u32,
    },
    /// Check server status
    Status {
        /// Optional PID to check
        pid: Option<u32>,
    },
}

pub fn handle_server_action(action: ServerAction, _root: PathBuf, _cli: &Cli) -> Result<()> {
    match action {
        ServerAction::Start { port, host, ipc, timeout, max_body_size } => {
            core::start_server(host, port, ipc, timeout, max_body_size)?;
        },
        ServerAction::Stop { pid } => {
            use sysinfo::{Pid, System};
            let mut s = System::new_all();
            s.refresh_all();
            
            if let Some(process) = s.process(Pid::from(pid as usize)) {
                println!("Stopping server with PID: {} ({})", pid, process.name().to_string_lossy());
                process.kill();
                println!("✓ Server stopped");
            } else {
                println!("✗ No server found with PID: {}", pid);
            }
        },
        ServerAction::Status { pid } => {
            use sysinfo::{Pid, System};
            let mut s = System::new_all();
            s.refresh_all();
            
            if let Some(p) = pid {
                if let Some(process) = s.process(Pid::from(p as usize)) {
                    println!("● XHSC is RUNNING (PID: {})", p);
                    println!("  Name: {}", process.name().to_string_lossy());
                    println!("  Memory: {} KB", process.memory());
                    println!("  CPU Usage: {}%", process.cpu_usage());
                } else {
                    println!("○ XHSC is NOT running (PID: {})", p);
                }
            } else {
                // Try to find xsys processes
                let xsys_processes: Vec<_> = s.processes().values()
                    .filter(|p| p.name().to_string_lossy().contains("xsys"))
                    .collect();
                
                if xsys_processes.is_empty() {
                    println!("○ No XHSC processes found");
                } else {
                    println!("XHSC Processes found:");
                    for p in xsys_processes {
                        println!("  - PID: {}, Name: {}, Status: {:?}", p.pid(), p.name().to_string_lossy(), p.status());
                    }
                }
            }
        }
    }
    Ok(())
}
