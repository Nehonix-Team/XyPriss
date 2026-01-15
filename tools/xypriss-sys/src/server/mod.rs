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

        /// Enable clustering mode
        #[arg(long)]
        cluster: bool,

        /// Number of workers for clustering (0 for auto)
        #[arg(long, default_value = "0")]
        cluster_workers: usize,

        /// Automatically respawn dead workers
        #[arg(long, default_value = "true", action = clap::ArgAction::Set)]
        cluster_respawn: bool,

        /// Entry point for Node.js workers (e.g., dist/index.js)
        #[arg(short, long)]
        entry_point: Option<String>,

        /// Maximum concurrent requests globally
        #[arg(long, default_value = "0")]
        max_concurrent_requests: usize,

        /// Maximum concurrent requests per IP
        #[arg(long, default_value = "0")]
        max_per_ip: usize,

        /// Maximum number of requests in queue before rejecting
        #[arg(long, default_value = "1000")]
        max_queue_size: usize,

        /// Queue timeout in milliseconds
        #[arg(long, default_value = "0")]
        queue_timeout: u64,

        /// Maximum URL length in bytes
        #[arg(long, default_value = "2048")]
        max_url_length: usize,

        /// Enable Circuit Breaker for IPC
        #[arg(long)]
        breaker_enabled: bool,

        /// Circuit Breaker failure threshold
        #[arg(long, default_value = "5")]
        breaker_threshold: usize,

        /// Circuit Breaker reset timeout in seconds
        #[arg(long, default_value = "60")]
        breaker_timeout: u64,
    },
    /// Stop the running XHSC
    Stop {
        /// PID of the server process
        #[arg(short, long)]
        pid: u32,
    },
    /// Check server status
    Status {
        /// Optional PID to check
        #[arg(short, long)]
        pid: Option<u32>,
    },
}

pub fn handle_server_action(action: ServerAction, _root: PathBuf, _cli: &Cli) -> Result<()> {
    match action {
        ServerAction::Start { 
            port, 
            host, 
            ipc, 
            timeout, 
            max_body_size,
            cluster,
            cluster_workers,
            cluster_respawn,
            entry_point,
            max_concurrent_requests,
            max_per_ip,
            max_queue_size,
            queue_timeout,
            max_url_length,
            breaker_enabled,
            breaker_threshold,
            breaker_timeout,
        } => {
            core::start_server(
                host, 
                port, 
                ipc, 
                timeout, 
                max_body_size,
                cluster,
                cluster_workers,
                cluster_respawn,
                entry_point,
                max_concurrent_requests,
                max_per_ip,
                max_queue_size,
                queue_timeout,
                max_url_length,
                breaker_enabled,
                breaker_threshold,
                breaker_timeout,
            )?;
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
