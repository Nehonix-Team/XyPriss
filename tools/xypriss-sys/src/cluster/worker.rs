use tokio::process::{Command, Child};
use std::process::Stdio;
use anyhow::{Result, Context};
use tracing::{info, error};
use std::time::Instant;

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

    pub fn spawn(&mut self, entry_point: &str, ipc_path: &str) -> Result<()> {
        info!("Spawning worker {} (Node.js)", self.id);
        
        // Pass worker setup via environment variables
        let child = Command::new("node")
            .arg(entry_point)
            .env("XYPRISS_WORKER_ID", self.id.to_string())
            .env("XYPRISS_IPC_PATH", ipc_path)
            .env("NODE_ENV", "production")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to spawn Node.js worker")?;

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
