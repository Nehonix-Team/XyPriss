use clap::Subcommand;
use std::path::PathBuf;
use anyhow::Result;
use crate::Cli;

mod core;
mod ipc;
mod router;
mod quality;

use crate::cluster::manager::BalancingStrategy;

#[derive(Subcommand, Clone, Debug)]
pub enum ServerAction {
    /// Start the XHSC (XyPriss Hyper-System Core)
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

        /// Max retry attempts for failed requests
        #[arg(long, default_value = "0")]
        retry_max: usize,

        /// Retry delay in milliseconds
        #[arg(long, default_value = "100")]
        retry_delay: u64,

        /// Load balancing strategy for clustering
        #[arg(long, default_value = "round-robin")]
        cluster_strategy: BalancingStrategy,

        /// Maximum memory per worker (in MB, 0 for unlimited)
        #[arg(long, default_value = "0")]
        cluster_max_memory: usize,

        /// Maximum CPU percentage per worker (0 for unlimited)
        #[arg(long, default_value = "0")]
        cluster_max_cpu: usize,

        /// Enable Network Quality monitoring
        #[arg(long)]
        quality_enabled: bool,

        /// Reject requests on poor network conditions
        #[arg(long)]
        quality_reject_poor: bool,

        /// Minimum bandwidth requirement in bytes/second
        #[arg(long, default_value = "0")]
        quality_min_bw: usize,

        /// Maximum acceptable latency in milliseconds
        #[arg(long, default_value = "0")]
        quality_max_lat: u64,

        /// Priority for worker processes (-20 to 19)
        #[arg(long, default_value = "0", allow_hyphen_values = true)]
        cluster_priority: i32,

        /// File descriptor limit for workers
        #[arg(long, default_value = "0")]
        file_descriptor_limit: u64,

        /// Enable GC hints (Node.js --expose-gc)
        #[arg(long)]
        gc_hint: bool,

        /// Memory check interval for workers in ms
        #[arg(long, default_value = "5000")]
        cluster_memory_check_interval: u64,

        /// Enforce hard memory limits (kill if exceeded)
        #[arg(long, default_value = "true", action = clap::ArgAction::Set)]
        cluster_enforce_hard_limits: bool,

        /// Enable intelligence features
        #[arg(long)]
        intelligence: bool,

        /// Pre-allocate resources at startup
        #[arg(long)]
        pre_allocate: bool,

        /// Enable fast rescue mode
        #[arg(long, default_value = "true", action = clap::ArgAction::Set)]
        rescue_mode: bool,
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
            retry_max,
                retry_delay,
                cluster_strategy,
                cluster_max_memory,
                cluster_max_cpu,
                quality_enabled,
                quality_reject_poor,
                quality_min_bw,
                quality_max_lat,
                cluster_priority,
                file_descriptor_limit,
                gc_hint,
                cluster_memory_check_interval,
                cluster_enforce_hard_limits,
                intelligence,
                pre_allocate,
                rescue_mode,
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
                retry_max,
                retry_delay,
                cluster_strategy,
                cluster_max_memory,
                cluster_max_cpu,
                quality_enabled,
                quality_reject_poor,
                quality_min_bw,
                quality_max_lat,
                cluster_priority,
                file_descriptor_limit,
                gc_hint,
                cluster_memory_check_interval,
                cluster_enforce_hard_limits,
                intelligence,
                pre_allocate,
                rescue_mode,
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
                    println!("● XHSC is RUNNING (P{})", p);
                    println!("  Name: {}", process.name().to_string_lossy());
                    println!("  Memory: {} KB", process.memory());
                    println!("  CPU Usage: {}%", process.cpu_usage());
                } else {
                    println!("○ XHSC is NOT running (P{})", p);
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
