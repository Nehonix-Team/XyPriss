use crate::cluster::worker::Worker;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use std::time::Duration;

pub struct ClusterConfig {
    pub workers: usize,
    pub respawn: bool,
    pub ipc_path: String,
    pub entry_point: String,
}

pub struct ClusterManager {
    pub config: ClusterConfig,
    pub workers: Arc<RwLock<Vec<Worker>>>,
}

impl ClusterManager {
    pub fn new(config: ClusterConfig) -> Self {
        let workers_count = if config.workers == 0 {
            num_cpus::get()
        } else {
            config.workers
        };
        
        info!("ClusterManager initialized for {} workers", workers_count);
        
        let mut workers = Vec::with_capacity(workers_count);
        for i in 0..workers_count {
            workers.push(Worker::new(i));
        }

        Self {
            config,
            workers: Arc::new(RwLock::new(workers)),
        }
    }

    pub async fn start(&self) -> Result<()> {
        let mut workers = self.workers.write().await;
        for worker in workers.iter_mut() {
            worker.spawn(&self.config.entry_point, &self.config.ipc_path)?;
        }
        
        // Start monitoring loop in background
        let workers_clone = self.workers.clone();
        let respawn_enabled = self.config.respawn;
        let entry_point = self.config.entry_point.clone();
        let ipc_path = self.config.ipc_path.clone();

        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;
                let mut workers_guard = workers_clone.write().await;
                
                for worker in workers_guard.iter_mut() {
                    if !worker.is_alive().await {
                        warn!("Worker {} (PID: {:?}) died", worker.id, worker.pid());
                        
                        if respawn_enabled {
                            worker.restarts += 1;
                            info!("Respawning worker {} (Attempt {})", worker.id, worker.restarts);
                            if let Err(e) = worker.spawn(&entry_point, &ipc_path) {
                                error!("Failed to respawn worker {}: {}", worker.id, e);
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn get_worker_pids(&self) -> Vec<u32> {
        let workers = self.workers.read().await;
        workers.iter().filter_map(|w| w.pid()).collect()
    }
}
