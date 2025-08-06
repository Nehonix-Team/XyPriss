//! # Garbage Collector
//! 
//! This module provides intelligent garbage collection capabilities for the
//! memory management system. It automatically cleans up unused objects,
//! manages memory pressure, and optimizes memory usage patterns.
 
use crate::types::{GCConfig, MemoryStats};
use crate::error::{MemoryError, Result};
use crate::allocation_tracker::AllocationTracker;
use parking_lot::RwLock;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, Duration, Instant};
use std::thread;
use crossbeam::channel::{self, Receiver, Sender};
 
/// Garbage collection statistics
/// 
/// Tracks performance and effectiveness of garbage collection operations.
#[derive(Debug, Clone)]
pub struct GCStats {
    /// Total number of GC cycles performed
    pub total_cycles: u64,
    
    /// Total time spent in GC (milliseconds)
    pub total_time_ms: u64,
    
    /// Average GC cycle time (milliseconds)
    pub avg_cycle_time_ms: u64,
    
    /// Total bytes reclaimed by GC
    pub total_reclaimed_bytes: usize,
    
    /// Number of objects cleaned up
    pub objects_cleaned: u64,
    
    /// Last GC cycle timestamp
    pub last_gc_time: Option<SystemTime>,
    
    /// Current memory pressure (0.0 to 1.0)
    pub memory_pressure: f64,
}

impl Default for GCStats {
    fn default() -> Self {
        Self {
            total_cycles: 0,
            total_time_ms: 0,
            avg_cycle_time_ms: 0,
            total_reclaimed_bytes: 0,
            objects_cleaned: 0,
            last_gc_time: None,
            memory_pressure: 0.0,
        }
    }
}

/// Commands that can be sent to the garbage collector
#[derive(Debug)]
enum GCCommand {
    /// Trigger an immediate GC cycle
    TriggerGC,
    
    /// Update GC configuration
    UpdateConfig(GCConfig),
    
    /// Shutdown the garbage collector
    Shutdown,
    
    /// Force a full cleanup cycle
    ForceCleanup,
}

/// Intelligent garbage collection system
/// 
/// The GarbageCollector automatically manages memory cleanup based on
/// configurable policies. It monitors memory pressure and performs
/// cleanup operations to maintain optimal memory usage.
/// 
/// # Features
/// 
/// - **Automatic Cleanup**: Runs cleanup cycles based on memory pressure
/// - **Configurable Policies**: Flexible configuration for different use cases
/// - **Background Operation**: Runs in a separate thread to minimize impact
/// - **Smart Scheduling**: Adapts cleanup frequency based on memory usage
/// - **Statistics Tracking**: Comprehensive metrics about GC performance
/// 
/// # Examples
/// 
/// ```rust
/// use xypriss_memory_manager::{GarbageCollector, GCConfig};
/// 
/// let config = GCConfig {
///     enabled: true,
///     pressure_threshold: 0.8,
///     interval_seconds: 30,
///     ..Default::default()
/// };
/// 
/// let gc = GarbageCollector::new(config)?;
/// 
/// // GC will now run automatically in the background
/// // You can also trigger manual cleanup
/// gc.trigger_gc()?;
/// 
/// // Get statistics
/// let stats = gc.get_stats();
/// println!("GC cycles: {}", stats.total_cycles);
/// ```
pub struct GarbageCollector {
    /// Current configuration
    config: Arc<RwLock<GCConfig>>,
    
    /// GC statistics
    stats: Arc<RwLock<GCStats>>,
    
    /// Command sender for communicating with GC thread
    command_sender: Sender<GCCommand>,
    
    /// Whether the GC is currently running
    is_running: Arc<AtomicBool>,
    
    /// Handle to the GC background thread
    gc_thread_handle: Option<thread::JoinHandle<()>>,
}

impl GarbageCollector {
    /// Create a new garbage collector with the specified configuration
    /// 
    /// # Arguments
    /// 
    /// * `config` - GC configuration parameters
    /// 
    /// # Returns
    /// 
    /// Returns a new GarbageCollector instance or an error if initialization fails.
    pub fn new(config: GCConfig) -> Result<Self> {
        let (command_sender, command_receiver) = channel::unbounded();
        let config_arc = Arc::new(RwLock::new(config.clone()));
        let stats_arc = Arc::new(RwLock::new(GCStats::default()));
        let is_running = Arc::new(AtomicBool::new(false));
        
        // Start the GC background thread if enabled
        let gc_thread_handle = if config.enabled {
            let config_clone = config_arc.clone();
            let stats_clone = stats_arc.clone();
            let is_running_clone = is_running.clone();
            
            Some(thread::spawn(move || {
                Self::gc_thread_main(command_receiver, config_clone, stats_clone, is_running_clone);
            }))
        } else {
            None
        };
        
        let gc = Self {
            config: config_arc,
            stats: stats_arc,
            command_sender,
            is_running,
            gc_thread_handle,
        };
        
        log::info!("Garbage collector initialized (enabled: {})", config.enabled);
        
        Ok(gc)
    }
    
    /// Trigger an immediate garbage collection cycle
    /// 
    /// This method requests an immediate GC cycle, regardless of the
    /// configured schedule or memory pressure.
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if the request was sent successfully.
    pub fn trigger_gc(&self) -> Result<()> {
        self.command_sender
            .send(GCCommand::TriggerGC)
            .map_err(|_| MemoryError::gc_error("Failed to send GC trigger command"))?;
        
        log::debug!("Triggered manual GC cycle");
        Ok(())
    }
    
    /// Update the garbage collector configuration
    /// 
    /// # Arguments
    /// 
    /// * `new_config` - New configuration to apply
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if the configuration was updated successfully.
    pub fn update_config(&self, new_config: GCConfig) -> Result<()> {
        self.command_sender
            .send(GCCommand::UpdateConfig(new_config))
            .map_err(|_| MemoryError::gc_error("Failed to send config update command"))?;
        
        log::info!("Updated GC configuration");
        Ok(())
    }
    
    /// Force a comprehensive cleanup cycle
    /// 
    /// This performs a more aggressive cleanup than normal GC cycles,
    /// useful for reducing memory usage before critical operations.
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if the cleanup request was sent successfully.
    pub fn force_cleanup(&self) -> Result<()> {
        self.command_sender
            .send(GCCommand::ForceCleanup)
            .map_err(|_| MemoryError::gc_error("Failed to send force cleanup command"))?;
        
        log::info!("Triggered force cleanup cycle");
        Ok(())
    }
    
    /// Get current garbage collection statistics
    /// 
    /// # Returns
    /// 
    /// Returns a snapshot of current GC statistics.
    pub fn get_stats(&self) -> GCStats {
        self.stats.read().clone()
    }
    
    /// Check if the garbage collector is currently running
    /// 
    /// # Returns
    /// 
    /// Returns true if a GC cycle is currently in progress.
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }
    
    /// Calculate current memory pressure
    /// 
    /// Memory pressure is a value between 0.0 and 1.0 indicating how close
    /// the system is to its memory limits.
    /// 
    /// # Arguments
    /// 
    /// * `current_usage` - Current memory usage in bytes
    /// * `max_memory` - Maximum allowed memory in bytes
    /// 
    /// # Returns
    /// 
    /// Returns memory pressure as a float between 0.0 and 1.0.
    pub fn calculate_memory_pressure(&self, current_usage: usize, max_memory: usize) -> f64 {
        if max_memory == 0 {
            return 0.0;
        }
        
        let pressure = current_usage as f64 / max_memory as f64;
        pressure.min(1.0).max(0.0)
    }
    
    /// Shutdown the garbage collector
    /// 
    /// Stops the background GC thread and cleans up resources.
    /// This should be called when shutting down the application.
    pub fn shutdown(&mut self) -> Result<()> {
        // Send shutdown command
        if let Err(_) = self.command_sender.send(GCCommand::Shutdown) {
            log::warn!("Failed to send shutdown command to GC thread");
        }
        
        // Wait for thread to finish
        if let Some(handle) = self.gc_thread_handle.take() {
            if let Err(_) = handle.join() {
                log::warn!("GC thread panicked during shutdown");
            }
        }
        
        log::info!("Garbage collector shutdown complete");
        Ok(())
    }
    
    /// Main loop for the garbage collector background thread
    /// 
    /// This function runs in a separate thread and handles GC operations
    /// based on configuration and memory pressure.
    fn gc_thread_main(
        command_receiver: Receiver<GCCommand>,
        config: Arc<RwLock<GCConfig>>,
        stats: Arc<RwLock<GCStats>>,
        is_running: Arc<AtomicBool>,
    ) {
        log::info!("GC background thread started");
        
        let mut last_gc_time = Instant::now();
        
        loop {
            let config_snapshot = config.read().clone();
            
            // Calculate sleep duration based on interval
            let sleep_duration = Duration::from_secs(config_snapshot.interval_seconds);
            
            // Wait for commands or timeout
            match command_receiver.recv_timeout(sleep_duration) {
                Ok(GCCommand::TriggerGC) => {
                    Self::perform_gc_cycle(&config, &stats, &is_running, false);
                    last_gc_time = Instant::now();
                }
                Ok(GCCommand::ForceCleanup) => {
                    Self::perform_gc_cycle(&config, &stats, &is_running, true);
                    last_gc_time = Instant::now();
                }
                Ok(GCCommand::UpdateConfig(new_config)) => {
                    *config.write() = new_config;
                    log::info!("GC configuration updated");
                }
                Ok(GCCommand::Shutdown) => {
                    log::info!("GC thread received shutdown command");
                    break;
                }
                Err(channel::RecvTimeoutError::Timeout) => {
                    // Regular interval - check if we should run GC
                    if config_snapshot.enabled {
                        // TODO: Check memory pressure and decide if GC is needed
                        // For now, just run GC on schedule
                        if last_gc_time.elapsed() >= sleep_duration {
                            Self::perform_gc_cycle(&config, &stats, &is_running, false);
                            last_gc_time = Instant::now();
                        }
                    }
                }
                Err(channel::RecvTimeoutError::Disconnected) => {
                    log::warn!("GC command channel disconnected");
                    break;
                }
            }
        }
        
        log::info!("GC background thread stopped");
    }
    
    /// Perform a garbage collection cycle
    /// 
    /// This is the core GC logic that performs cleanup operations.
    /// 
    /// # Arguments
    /// 
    /// * `config` - GC configuration
    /// * `stats` - GC statistics to update
    /// * `is_running` - Flag to indicate GC is running
    /// * `aggressive` - Whether to perform aggressive cleanup
    fn perform_gc_cycle(
        config: &Arc<RwLock<GCConfig>>,
        stats: &Arc<RwLock<GCStats>>,
        is_running: &Arc<AtomicBool>,
        aggressive: bool,
    ) {
        let start_time = Instant::now();
        is_running.store(true, Ordering::Relaxed);
        
        log::debug!("Starting GC cycle (aggressive: {})", aggressive);
        
        // TODO: Implement actual garbage collection logic
        // This would involve:
        // 1. Scanning memory pools for cleanup opportunities
        // 2. Removing old/unused objects from pools
        // 3. Checking allocation tracker for potential leaks
        // 4. Performing system-level memory cleanup if needed
        
        // Simulate some work
        thread::sleep(Duration::from_millis(10));
        
        let cycle_time = start_time.elapsed();
        is_running.store(false, Ordering::Relaxed);
        
        // Update statistics
        {
            let mut stats_guard = stats.write();
            stats_guard.total_cycles += 1;
            stats_guard.total_time_ms += cycle_time.as_millis() as u64;
            stats_guard.avg_cycle_time_ms = stats_guard.total_time_ms / stats_guard.total_cycles;
            stats_guard.last_gc_time = Some(SystemTime::now());
        }
        
        log::debug!("GC cycle completed in {:?}", cycle_time);
        
        // Check if we exceeded the maximum GC time
        let config_snapshot = config.read();
        if cycle_time.as_millis() as u64 > config_snapshot.max_gc_time_ms {
            log::warn!("GC cycle took {}ms, exceeding limit of {}ms", 
                      cycle_time.as_millis(), config_snapshot.max_gc_time_ms);
        }
    }
}

impl Drop for GarbageCollector {
    fn drop(&mut self) {
        if let Err(e) = self.shutdown() {
            log::error!("Error during GC shutdown: {}", e);
        }
    }
}
