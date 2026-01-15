use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};
use crate::cluster::manager::ClusterConfig;

/// Manages intelligent cluster behavior including rescue mode and resource optimization
#[allow(dead_code)]
pub struct IntelligenceManager {
    config: ClusterConfig,
    rescue_active: AtomicBool,
    pre_allocated_memory: tokio::sync::Mutex<Option<Vec<u8>>>,
    rescue_activation_count: AtomicUsize,
    last_rescue_activation: RwLock<Option<Instant>>,
    gc_notify: tokio::sync::broadcast::Sender<()>,
}

impl IntelligenceManager {
    /// Creates a new IntelligenceManager with optional memory pre-allocation
    /// 
    /// Pre-allocation reserves 25% of max_memory to ensure the parent process
    /// maintains a stable footprint for recovery operations
    pub fn new(config: ClusterConfig) -> Self {
        let pre_allocated_memory = Self::allocate_reserved_memory(&config);
        let (tx, _) = tokio::sync::broadcast::channel(1);

        Self {
            config,
            rescue_active: AtomicBool::new(false),
            pre_allocated_memory: tokio::sync::Mutex::new(pre_allocated_memory),
            rescue_activation_count: AtomicUsize::new(0),
            last_rescue_activation: RwLock::new(None),
            gc_notify: tx,
        }
    }

    /// Pre-allocates memory to reserve system resources
    fn allocate_reserved_memory(config: &ClusterConfig) -> Option<Vec<u8>> {
        if !config.intelligence_enabled || !config.pre_allocate || config.max_memory == 0 {
            return None;
        }

        let bytes_to_allocate = (config.max_memory * 1024 * 1024 / 4) as usize;
        let mb_allocated = bytes_to_allocate / 1024 / 1024;
        
        info!(
            "Pre-allocating {} MB to reserve system resources",
            mb_allocated
        );

        match std::panic::catch_unwind(|| vec![0u8; bytes_to_allocate]) {
            Ok(buffer) => {
                debug!("Memory pre-allocation successful");
                Some(buffer)
            }
            Err(_) => {
                error!(
                    "Failed to pre-allocate {} MB, continuing without reservation",
                    mb_allocated
                );
                None
            }
        }
    }

    /// Returns the current rescue mode status
    #[inline]
    pub fn is_rescue_active(&self) -> bool {
        self.rescue_active.load(Ordering::Acquire)
    }

    /// Activates or deactivates rescue mode with proper logging and metrics
    pub async fn set_rescue_active(&self, active: bool) {
        let was_active = self.rescue_active.swap(active, Ordering::AcqRel);
        
        // Only log and update metrics if state actually changed
        if active != was_active {
            if active {
                let count = self.rescue_activation_count.fetch_add(1, Ordering::Relaxed) + 1;
                let mut last_activation = self.last_rescue_activation.write().await;
                *last_activation = Some(Instant::now());
                
                warn!(
                    "Rescue Mode ACTIVATED - Workers are down (activation count: {})",
                    count
                );
            } else {
                if let Some(activated_at) = *self.last_rescue_activation.read().await {
                    let duration = activated_at.elapsed();
                    info!(
                        "Rescue Mode DEACTIVATED - Workers are back online (was active for {:?})",
                        duration
                    );
                } else {
                    info!("Rescue Mode DEACTIVATED - Workers are back online");
                }
            }
        }
    }

    /// Determines if rescue mode should be activated based on worker status
    /// 
    /// Returns true only if:
    /// - Intelligence is enabled
    /// - Rescue mode is configured
    /// - No workers are currently running
    #[inline]
    pub fn should_rescue(&self, worker_count: usize) -> bool {
        self.config.intelligence_enabled 
            && self.config.rescue_mode 
            && worker_count == 0
    }

    /// Returns the number of times rescue mode has been activated
    pub fn get_rescue_activation_count(&self) -> usize {
        self.rescue_activation_count.load(Ordering::Relaxed)
    }

    /// Returns the duration since last rescue activation, if any
    pub async fn get_time_since_last_rescue(&self) -> Option<Duration> {
        self.last_rescue_activation
            .read()
            .await
            .map(|instant| instant.elapsed())
    }

    /// Optimizes memory usage during runtime through garbage collection hints
    /// 
    /// This function acts as a proactive resource manager. 
    /// If memory usage exceeds 75%, it signals workers to perform Garbage Collection.
    /// If memory usage exceeds 90%, it releases pre-allocated reserve memory to prevent crashes
    /// and aggressively signals GC.
    ///
    /// It returns an OptimizationAction indicating what action was taken.
    pub async fn optimize_runtime(&self, current_mem_mb: u64, max_mem_mb: u64) -> OptimizationAction {
        if !self.config.intelligence_enabled || max_mem_mb == 0 {
            return OptimizationAction::None;
        }

        let usage_percent = (current_mem_mb as f64 / max_mem_mb as f64) * 100.0;
        
        // Critical: > 90% usage
        if usage_percent > 90.0 {
            warn!("[INTELLIGENCE] Critical memory pressure detected ({:.1}%)", usage_percent);
            
            // Release reserve immediately
            self.release_reserved_memory().await;
            
            // Signal GC
            let _ = self.gc_notify.send(());

            return OptimizationAction::ReleaseReserveAndGC;
        }

        // Warning: > 75% usage
        if usage_percent > 75.0 {
            debug!("[INTELLIGENCE] High memory pressure detected ({:.1}%)", usage_percent);
            // Signal GC
            let _ = self.gc_notify.send(());
            return OptimizationAction::ForceGC;
        }

        OptimizationAction::None
    }
}

pub enum OptimizationAction {
    None,
    ForceGC,
    ReleaseReserveAndGC,
}

impl IntelligenceManager {
    /// Provides diagnostic information about current intelligence state
    pub async fn get_diagnostics(&self) -> IntelligenceDiagnostics {
        IntelligenceDiagnostics {
            enabled: self.config.intelligence_enabled,
            rescue_mode_enabled: self.config.rescue_mode,
            rescue_active: self.is_rescue_active(),
            pre_allocated_mb: self.pre_allocated_memory.lock().await.as_ref()
                .map(|m| m.len() / 1024 / 1024)
                .unwrap_or(0),
            activation_count: self.get_rescue_activation_count(),
            time_since_last_rescue: self.get_time_since_last_rescue().await,
        }
    }

    /// Releases pre-allocated memory (irreversible operation)
    /// 
    /// This should only be called in critical memory situations as it cannot
    /// be reversed without recreating the IntelligenceManager
    pub async fn release_reserved_memory(&self) {
        let mut guard = self.pre_allocated_memory.lock().await; // Lock held
        if let Some(buffer) = guard.take() {
            let mb_released = buffer.len() / 1024 / 1024;
            warn!(
                "[INTELLIGENCE] Releasing {} MB of reserved memory due to critical pressure",
                mb_released
            );
            drop(buffer);
        }
    }

    pub fn subscribe_gc(&self) -> tokio::sync::broadcast::Receiver<()> {
        self.gc_notify.subscribe()
    }
}

/// Diagnostic information about intelligence manager state
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct IntelligenceDiagnostics {
    pub enabled: bool,
    pub rescue_mode_enabled: bool,
    pub rescue_active: bool,
    pub pre_allocated_mb: usize,
    pub activation_count: usize,
    pub time_since_last_rescue: Option<Duration>,
}

impl std::fmt::Display for IntelligenceDiagnostics {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "Intelligence Manager Diagnostics:")?;
        writeln!(f, "  Enabled: {}", self.enabled)?;
        writeln!(f, "  Rescue Mode: {} (active: {})", 
            self.rescue_mode_enabled, self.rescue_active)?;
        writeln!(f, "  Pre-allocated Memory: {} MB", self.pre_allocated_mb)?;
        writeln!(f, "  Rescue Activations: {}", self.activation_count)?;
        if let Some(duration) = self.time_since_last_rescue {
            writeln!(f, "  Time Since Last Rescue: {:?}", duration)?;
        }
        Ok(())
    }
}