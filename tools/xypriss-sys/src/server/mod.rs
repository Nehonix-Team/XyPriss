use clap::Subcommand;
use std::path::PathBuf;
use anyhow::Result;
use crate::Cli;

mod core;
mod ipc;
mod router;

#[derive(Subcommand, Clone)]
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
            println!("Stopping server with PID: {}", pid);
            // Implementation for stop logic
        },
        ServerAction::Status { pid } => {
            println!("Checking status for PID: {:?}", pid);
            // Implementation for status logic
        }
    }
    Ok(())
}
