use tokio::process::{Child, Command};
use std::process::Stdio;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error, debug};
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::time::Duration;
use crate::server::ipc::IpcBridge;
use tokio::fs;

#[derive(Debug, Clone, PartialEq)]
pub enum WorkerStatus {
    Starting,
    Running,
    Unhealthy,
    Dead,
}

pub struct Worker {
    pub id: String,
    pub pid: u32,
    pub socket_path: String,
    pub status: WorkerStatus,
    pub bridge: Arc<IpcBridge>,
    pub process: Option<Arc<RwLock<Child>>>,
}

#[derive(Clone)]
pub struct ClusterManager {
    workers: Arc<RwLock<HashMap<String, Worker>>>,
    next_worker_idx: Arc<std::sync::atomic::AtomicUsize>,
    config: ClusterConfig,
}

#[derive(Clone, Debug)]
pub struct ClusterConfig {
    pub num_workers: usize,
    pub worker_script: PathBuf,
    pub base_ipc_path: String,
    pub strategy: LoadBalancingStrategy,
}

#[derive(Clone, Debug, PartialEq)]
pub enum LoadBalancingStrategy {
    RoundRobin,
    Random,
    LeastConnections, // Placeholder for future implementation
}

impl ClusterManager {
    pub fn new(config: ClusterConfig) -> Self {
        Self {
            workers: Arc::new(RwLock::new(HashMap::new())),
            next_worker_idx: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            config,
        }
    }

    pub async fn start(&self) -> Result<()> {
        info!("Starting XHSC Cluster with {} workers", self.config.num_workers);

        for i in 0..self.config.num_workers {
            self.spawn_worker(i).await?;
        }

        // Start health monitor
        self.start_health_monitor();

        Ok(())
    }

    async fn spawn_worker(&self, index: usize) -> Result<()> {
        let worker_id = format!("worker-{}", index);
        let socket_path = format!("{}-{}.sock", self.config.base_ipc_path, worker_id);
        
        // Clean up old socket if exists
        if std::path::Path::new(&socket_path).exists() {
            let _ = fs::remove_file(&socket_path).await;
        }

        info!("Spawning worker {} (IPC: {})", worker_id, socket_path);

        // Env vars for the worker to know it's being managed
        let mut command = Command::new("bun");
        
        command.arg(&self.config.worker_script)
            .env("XHSC_WORKER_ID", &worker_id)
            .env("XHSC_IPC_SOCKET", &socket_path)
            .env("XHSC_MODE", "cluster_worker")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Spawn process asynchronously
        let child = command.spawn()
            .context(format!("Failed to spawn worker {}", worker_id))?;

        let pid = child.id().unwrap_or(0);
        info!("Worker {} started with PID {}", worker_id, pid);

        let bridge = Arc::new(IpcBridge::new(socket_path.clone()));

        // Wrap child in Arc<RwLock> for safe sharing
        let process_handle = Arc::new(RwLock::new(child));

        let worker = Worker {
            id: worker_id.clone(),
            pid,
            socket_path,
            status: WorkerStatus::Starting,
            bridge,
            process: Some(process_handle),
        };

        self.workers.write().await.insert(worker_id, worker);
        Ok(())
    }

    pub async fn get_worker_for_request(&self) -> Option<Arc<IpcBridge>> {
        let workers_guard = self.workers.read().await;
        let healthy_workers: Vec<&Worker> = workers_guard.values()
            .filter(|w| w.status == WorkerStatus::Running || w.status == WorkerStatus::Starting) // Assume starting is OK to try connecting
            .collect();

        if healthy_workers.is_empty() {
            return None;
        }

        match self.config.strategy {
            LoadBalancingStrategy::RoundRobin => {
                let idx = self.next_worker_idx.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let worker = healthy_workers[idx % healthy_workers.len()];
                Some(worker.bridge.clone())
            },
            LoadBalancingStrategy::Random => {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let idx = rng.gen_range(0..healthy_workers.len());
                Some(healthy_workers[idx].bridge.clone())
            },
            _ => {
                // Default Round Robin
                let idx = self.next_worker_idx.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                Some(healthy_workers[idx % healthy_workers.len()].bridge.clone())
            }
        }
    }

    pub async fn shutdown(&self) {
        info!("Shutting down cluster...");
        let mut workers = self.workers.write().await;
        for (id, worker) in workers.iter_mut() {
            info!("Stopping worker {} (PID: {})", id, worker.pid);
            // In a real impl, we'd send a SIGTERM signal
            unsafe {
                libc::kill(worker.pid as i32, libc::SIGTERM);
            }
        }
    }

    fn start_health_monitor(&self) {
        let manager = self.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;
                manager.check_health().await;
            }
        });
    }

    async fn check_health(&self) {
        let mut workers = self.workers.write().await;
        for (id, worker) in workers.iter_mut() {
            if worker.status == WorkerStatus::Dead {
                continue;
            }

            match worker.bridge.health_check().await {
                Ok(true) => {
                    if worker.status != WorkerStatus::Running {
                        info!("Worker {} is now HEALTHY", id);
                        worker.status = WorkerStatus::Running;
                    }
                },
                Ok(false) | Err(_) => {
                    warn!("Worker {} health check failed", id);
                    if worker.status == WorkerStatus::Running {
                        worker.status = WorkerStatus::Unhealthy;
                    }
                    // Logic to restart worker could go here
                }
            }
        }
    }
}
