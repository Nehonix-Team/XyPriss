use crate::cluster::worker::Worker;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
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
    pub intelligence_enabled: bool,
    pub pre_allocate: bool,
    pub rescue_mode: bool,
}

use crate::cluster::intelligence::{IntelligenceManager, OptimizationAction};

pub struct ClusterManager {
    pub config: ClusterConfig,
    pub workers: Arc<RwLock<Vec<Worker>>>,
    pub intelligence: Option<Arc<IntelligenceManager>>,
}

impl ClusterManager {
    pub fn new(config: ClusterConfig, intelligence: Option<Arc<IntelligenceManager>>) -> Self {
        let count = if config.workers == 0 {
            num_cpus::get()
        } else {
            config.workers
        };
        
        info!("ClusterManager initialized for {} workers", count);
        
        let mut workers = Vec::with_capacity(count);
        for id in 0..count {
            workers.push(Worker::new(id));
        }

        Self {
            config,
            workers: Arc::new(RwLock::new(workers)),
            intelligence,
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
        let intelligence_clone = self.intelligence.clone();

        tokio::spawn(async move {
            use sysinfo::{System, Pid};
            let mut sys = System::new_all();
            let interval = if config_clone.intelligence_enabled {
                Duration::from_millis(100) // Fast check for intelligence/rescue mode
            } else if config_clone.memory_check_interval > 0 {
                Duration::from_millis(config_clone.memory_check_interval)
            } else {
                Duration::from_secs(5)
            };

            let mut loop_count = 0;
            loop {
                tokio::time::sleep(interval).await;
                loop_count += 1;

                // Fast liveness check doesn't need sysinfo refresh
                // Memory check (expensive) every 5s if in intelligence mode, otherwise every loop
                let should_check_resources = if config_clone.intelligence_enabled {
                    loop_count % 50 == 0 // 100ms * 50 = 5s
                } else {
                    true
                };

                if should_check_resources {
                    sys.refresh_all();
                }
                
                let mut workers_guard = workers_clone.write().await;
                let max_mem_bytes = config_clone.max_memory as u64 * 1024 * 1024; // MB to Bytes
                let mut current_total_mem_bytes = 0;
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
                    if should_check_resources {
                        if let Some(p_id) = pid {
                            if let Some(process) = sys.process(Pid::from(p_id as usize)) {
                                let mem = process.memory(); // in Bytes (sysinfo 0.30+)
                                current_total_mem_bytes += mem;

                                if max_mem_bytes > 0 && mem > max_mem_bytes {
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

                // 3. Intelligence Logic
                if let Some(intel) = &intelligence_clone {
                    // Rescue Mode Check (if 0 workers alive)
                    // Note: We check intelligence inside should_rescue but we passed 0 if all dead.
                    // But here 'running_workers_count' is what we have.
                    // Actually handle_js_worker checks this, but we can also check here to pre-emptively activate?
                    // Usually handle_js_worker activates it when request fails.
                    // Let's just do optimization here.

                    if should_check_resources {
                        let total_max_mem = max_mem_bytes * config_clone.workers as u64;
                        let action = intel.optimize_runtime(
                            current_total_mem_bytes / 1024 / 1024, 
                            total_max_mem / 1024 / 1024
                        ).await;
                        
                        match action {
                            OptimizationAction::ForceGC => {
                                // Handled via channel subscription in IpcBridge
                            },
                            OptimizationAction::ReleaseReserveAndGC => {
                                // Log action
                                warn!("[CLUSTER] Critical memory pressure: Releasing reserves and forcing GC");
                            },
                            _ => {}
                        }
                    }
                }
            }
        });

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_worker_pids(&self) -> Vec<u32> {
        let workers = self.workers.read().await;
        workers.iter().filter_map(|w| w.pid()).collect()
    }
}
