use tokio::process::{Command, Child};
use std::process::Stdio;
use anyhow::{Result, Context};
use tracing::{info, warn, error};
use std::time::Instant;
use crate::cluster::manager::ClusterConfig;

pub struct Worker {
    pub id: usize,
    pub child: Option<Child>,
    pub start_time: Instant,
    pub restarts: u32,
    pub last_heartbeat: Instant,
}

impl Worker {
    pub fn new(id: usize) -> Self {
        Self {
            id,
            child: None,
            start_time: Instant::now(),
            restarts: 0,
            last_heartbeat: Instant::now(),
        }
    }

    pub fn spawn(&mut self, config: &ClusterConfig) -> Result<()> {
        info!("Spawning worker {} (Node.js)", self.id);
        
        // Pass worker setup via environment variables
        // Detect runner based on extension
        let runner = if config.entry_point.ends_with(".ts") { "bun" } else { "node" };

        let mut cmd = Command::new(runner);
        
        // Handle memory limits for Node.js
        if runner == "node" && config.max_memory > 0 {
            cmd.arg(format!("--max-old-space-size={}", config.max_memory));
        }

        let mut child = cmd
            .arg(&config.entry_point)
            .env("XYPRISS_WORKER_ID", self.id.to_string())
            .env("XYPRISS_IPC_PATH", &config.ipc_path)
            .env("XYPRISS_MAX_CPU", config.max_cpu.to_string())
            .env("NODE_ENV", "production")
            .env("NO_COLOR", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to spawn Node.js worker")?;

        let stdout = child.stdout.take().context("Failed to capture stdout")?;
        let stderr = child.stderr.take().context("Failed to capture stderr")?;
        let worker_id = self.id;

        // Stream stdout to info logs
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                info!("[Worker {}] {}", worker_id, line);
            }
        });

        // Stream stderr to error logs
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                warn!("[Worker {}] {}", worker_id, line);
            }
        });

        self.child = Some(child);
        self.start_time = Instant::now();
        self.last_heartbeat = Instant::now();
        
        Ok(())
    }

    pub async fn is_alive(&mut self) -> bool {
        if let Some(child) = self.child.as_mut() {
            match child.try_wait() {
                Ok(None) => true, // Still running
                _ => {
                    self.child = None;
                    false
                }
            }
        } else {
            false
        }
    }

    pub fn pid(&self) -> Option<u32> {
        self.child.as_ref().and_then(|c| c.id())
    }
}
