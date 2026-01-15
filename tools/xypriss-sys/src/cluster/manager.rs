use crate::cluster::worker::Worker;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum BalancingStrategy {
    #[default]
    RoundRobin,
    LeastConnections,
    WeightedRoundRobin,
    WeightedLeastConnections,
    IpHash,
    LeastResponseTime,
}

impl std::str::FromStr for BalancingStrategy {
    type Err = String;
    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "round-robin" => Ok(BalancingStrategy::RoundRobin),
            "least-connections" => Ok(BalancingStrategy::LeastConnections),
            "weighted-round-robin" => Ok(BalancingStrategy::WeightedRoundRobin),
            "weighted-least-connections" => Ok(BalancingStrategy::WeightedLeastConnections),
            "ip-hash" => Ok(BalancingStrategy::IpHash),
            "least-response-time" => Ok(BalancingStrategy::LeastResponseTime),
            _ => Err(format!("Unknown strategy: {}", s)),
        }
    }
}

#[derive(Clone)]
pub struct ClusterConfig {
    pub workers: usize,
    pub respawn: bool,
    pub ipc_path: String,
    pub entry_point: String,
    pub strategy: BalancingStrategy,
    pub max_memory: usize,
    pub max_cpu: usize,
    pub priority: i32,
    pub file_descriptor_limit: u64,
    pub gc_hint: bool,
    pub memory_check_interval: u64,
    pub enforce_hard_limits: bool,
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
            worker.spawn(&self.config)?;
        }
        
        // Start monitoring loop in background
        let workers_clone = self.workers.clone();
        let config_clone = self.config.clone();

        tokio::spawn(async move {
            use sysinfo::{System, Pid};
            let mut sys = System::new_all();
            let interval = if config_clone.memory_check_interval > 0 {
                Duration::from_millis(config_clone.memory_check_interval)
            } else {
                Duration::from_secs(5)
            };

            loop {
                tokio::time::sleep(interval).await;
                sys.refresh_all();
                
                let mut workers_guard = workers_clone.write().await;
                let max_mem_bytes = config_clone.max_memory as u64 * 1024 * 1024; // MB to Bytes

                for worker in workers_guard.iter_mut() {
                    let pid = worker.pid();
                    
                    // 1. Check if alive
                    if !worker.is_alive().await {
                        warn!("Worker {} (PID: {:?}) died", worker.id, pid);
                        if config_clone.respawn {
                            worker.restarts += 1;
                            info!("Respawning worker {} (Attempt {})", worker.id, worker.restarts);
                            let _ = worker.spawn(&config_clone);
                        }
                        continue;
                    }

                    // 2. Resource Enforcement (Memory)
                    if let Some(p_id) = pid {
                        if max_mem_bytes > 0 {
                            if let Some(process) = sys.process(Pid::from(p_id as usize)) {
                                let mem = process.memory(); // in Bytes (sysinfo 0.30+)
                                if mem > max_mem_bytes {
                                    if config_clone.enforce_hard_limits {
                                        warn!("Worker {} (PID: {}) exceeded memory limit ({} MB > {} MB). Killing.", 
                                               worker.id, p_id, mem / 1024 / 1024, max_mem_bytes / 1024 / 1024);
                                        process.kill();
                                    } else {
                                        warn!("Worker {} (PID: {}) is near memory limit ({} MB / {} MB)", 
                                               worker.id, p_id, mem / 1024 / 1024, max_mem_bytes / 1024 / 1024);
                                    }
                                }
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
