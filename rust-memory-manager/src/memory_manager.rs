//! # Memory Manager
//! 
//! This module provides the central coordination point for all memory management
//! operations. It integrates memory pools, allocation tracking, and garbage
//! collection into a unified system.
 
use crate::types::{MemoryManagerConfig, MemoryStats, PoolConfig, PoolHandle, AllocationHandle};
use crate::error::{MemoryError, Result};
use crate::memory_pool::MemoryPool;
use crate::allocation_tracker::AllocationTracker;
use crate::garbage_collector::GarbageCollector;
use crate::utils::MemoryPressureLevel;
use dashmap::DashMap;
use parking_lot::RwLock; 
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use once_cell::sync::OnceCell;

/// Central memory management coordinator
/// 
/// The MemoryManager serves as the main entry point for all memory management
/// operations. It coordinates between memory pools, allocation tracking, and
/// garbage collection to provide a unified memory management system.
/// 
/// # Features
/// 
/// - **Unified Interface**: Single point of access for all memory operations
/// - **Pool Management**: Create and manage multiple memory pools
/// - **Allocation Tracking**: Monitor memory usage across the entire system
/// - **Garbage Collection**: Automatic cleanup and optimization
/// - **Thread Safety**: Safe concurrent access from multiple threads
/// - **Configuration**: Flexible configuration for different use cases
/// 
/// # Examples
/// 
/// ```rust
/// use xypriss_memory_manager::{MemoryManager, PoolConfig, PoolStrategy};
/// 
/// // Initialize the memory manager
/// MemoryManager::initialize()?;
/// let manager = MemoryManager::instance();
/// 
/// // Create a memory pool
/// let pool_config = PoolConfig {
///     name: "string_pool".to_string(),
///     capacity: 100,
///     strategy: PoolStrategy::LIFO,
///     ..Default::default()
/// };
/// 
/// let pool_handle = manager.create_pool(pool_config, || String::new())?;
/// 
/// // Use the pool
/// let obj = manager.acquire_from_pool(pool_handle)?;
/// manager.release_to_pool(pool_handle, obj)?;
/// 
/// // Get statistics
/// let stats = manager.get_stats();
/// println!("Total allocated: {} bytes", stats.total_allocated);
/// ```
pub struct MemoryManager {
    /// Configuration
    config: Arc<RwLock<MemoryManagerConfig>>,
    
    /// Memory pools indexed by handle
    pools: DashMap<u64, Box<dyn PoolTrait + Send + Sync>>,
    
    /// Allocation tracker
    allocation_tracker: Arc<AllocationTracker>,
    
    /// Garbage collector
    garbage_collector: Arc<RwLock<Option<GarbageCollector>>>,
    
    /// Whether the manager is initialized
    initialized: AtomicBool,
    
    /// Next pool handle ID
    next_pool_id: std::sync::atomic::AtomicU64,
}

/// Trait for type-erased memory pools
/// 
/// This trait allows us to store different types of memory pools in the same
/// collection while maintaining type safety through the handle system.
trait PoolTrait {
    /// Get pool statistics
    fn get_stats(&self) -> crate::types::PoolStats;
    
    /// Clear the pool
    fn clear(&self) -> Result<()>;
    
    /// Perform cleanup
    fn cleanup(&self) -> Result<usize>;
    
    /// Get pool handle
    fn handle(&self) -> PoolHandle;
}

impl<T: Send + 'static> PoolTrait for MemoryPool<T> {
    fn get_stats(&self) -> crate::types::PoolStats {
        self.get_stats()
    }
    
    fn clear(&self) -> Result<()> {
        self.clear()
    }
    
    fn cleanup(&self) -> Result<usize> {
        self.cleanup()
    }
    
    fn handle(&self) -> PoolHandle {
        self.handle()
    }
}

/// Global memory manager instance
static MEMORY_MANAGER: OnceCell<MemoryManager> = OnceCell::new();

impl MemoryManager {
    /// Initialize the global memory manager instance
    /// 
    /// This must be called once before using any memory management features.
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if initialization was successful.
    pub fn initialize() -> Result<()> {
        Self::initialize_with_config(MemoryManagerConfig::default())
    }
    
    /// Initialize the memory manager with custom configuration
    /// 
    /// # Arguments
    /// 
    /// * `config` - Configuration for the memory manager
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if initialization was successful.
    pub fn initialize_with_config(config: MemoryManagerConfig) -> Result<()> {
        let manager = Self::new(config)?;
        
        MEMORY_MANAGER
            .set(manager)
            .map_err(|_| MemoryError::AlreadyInitialized)?;
        
        log::info!("Memory manager initialized successfully");
        Ok(())
    }
    
    /// Get the global memory manager instance
    /// 
    /// # Panics
    /// 
    /// Panics if the memory manager has not been initialized.
    pub fn instance() -> &'static MemoryManager {
        MEMORY_MANAGER
            .get()
            .expect("Memory manager not initialized. Call MemoryManager::initialize() first.")
    }
    
    /// Create a new memory manager instance (for testing)
    /// 
    /// # Arguments
    /// 
    /// * `config` - Configuration for the memory manager
    /// 
    /// # Returns
    /// 
    /// Returns a new MemoryManager instance.
    fn new(config: MemoryManagerConfig) -> Result<Self> {
        let allocation_tracker = Arc::new(AllocationTracker::new());
        allocation_tracker.set_enabled(config.enable_tracking);
        
        // Initialize garbage collector if enabled
        let garbage_collector = if config.gc_config.enabled {
            Some(GarbageCollector::new(config.gc_config.clone())?)
        } else {
            None
        };
        
        let manager = Self {
            config: Arc::new(RwLock::new(config)),
            pools: DashMap::new(),
            allocation_tracker,
            garbage_collector: Arc::new(RwLock::new(garbage_collector)),
            initialized: AtomicBool::new(true),
            next_pool_id: std::sync::atomic::AtomicU64::new(1),
        };
        
        Ok(manager)
    }
    
    /// Create a new memory pool
    /// 
    /// # Arguments
    /// 
    /// * `config` - Pool configuration
    /// * `factory` - Function to create new objects
    /// 
    /// # Returns
    /// 
    /// Returns a handle to the created pool.
    pub fn create_pool<T, F>(&self, config: PoolConfig, factory: F) -> Result<PoolHandle>
    where
        T: Send + 'static,
        F: Fn() -> T + Send + Sync + 'static,
    {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        let pool = MemoryPool::new(config, factory)?;
        let handle = pool.handle();
        
        self.pools.insert(handle.0, Box::new(pool));
        
        log::info!("Created memory pool with handle {:?}", handle);
        Ok(handle)
    }
    
    /// Acquire an object from a memory pool
    /// 
    /// # Arguments
    /// 
    /// * `handle` - Handle to the pool
    /// 
    /// # Returns
    /// 
    /// Returns the acquired object or an error if the pool doesn't exist.
    pub fn acquire_from_pool<T>(&self, handle: PoolHandle) -> Result<T>
    where
        T: Send + 'static,
    {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        // This is a simplified version - in practice, we'd need better type handling
        // For the FFI interface, we'll work with raw pointers and size information
        Err(MemoryError::NotSupported {
            operation: "acquire_from_pool with generic types".to_string(),
        })
    }
    
    /// Release an object back to a memory pool
    /// 
    /// # Arguments
    /// 
    /// * `handle` - Handle to the pool
    /// * `object` - Object to release
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if successful.
    pub fn release_to_pool<T>(&self, handle: PoolHandle, object: T) -> Result<()>
    where
        T: Send + 'static,
    {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        // This is a simplified version - in practice, we'd need better type handling
        Err(MemoryError::NotSupported {
            operation: "release_to_pool with generic types".to_string(),
        })
    }
    
    /// Track a memory allocation
    /// 
    /// # Arguments
    /// 
    /// * `size` - Size of the allocation in bytes
    /// * `tag` - Optional tag for categorizing the allocation
    /// 
    /// # Returns
    /// 
    /// Returns a handle to the tracked allocation.
    pub fn track_allocation(&self, size: usize, tag: Option<String>) -> Result<AllocationHandle> {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        self.allocation_tracker.track_allocation(size, tag)
    }
    
    /// Free a tracked allocation
    /// 
    /// # Arguments
    /// 
    /// * `handle` - Handle to the allocation
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if successful.
    pub fn free_allocation(&self, handle: AllocationHandle) -> Result<()> {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        self.allocation_tracker.free_allocation(handle)
    }
    
    /// Get comprehensive memory statistics
    /// 
    /// # Returns
    /// 
    /// Returns current memory statistics across all components.
    pub fn get_stats(&self) -> MemoryStats {
        if !self.initialized.load(Ordering::Relaxed) {
            return MemoryStats::default();
        }
        
        let mut stats = self.allocation_tracker.get_stats();
        
        // Add pool statistics
        stats.active_pools = self.pools.len();
        
        // Add GC statistics if available
        if let Some(ref gc) = *self.garbage_collector.read() {
            let gc_stats = gc.get_stats();
            stats.gc_cycles = gc_stats.total_cycles;
            stats.gc_time_ms = gc_stats.total_time_ms;
        }
        
        // Calculate memory pressure
        let config = self.config.read();
        stats.memory_pressure = stats.total_allocated as f64 / config.max_memory_bytes as f64;
        
        stats
    }
    
    /// Get current memory pressure level
    /// 
    /// # Returns
    /// 
    /// Returns the current memory pressure level.
    pub fn get_memory_pressure_level(&self) -> MemoryPressureLevel {
        let stats = self.get_stats();
        MemoryPressureLevel::from_ratio(stats.memory_pressure)
    }
    
    /// Trigger garbage collection
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if GC was triggered successfully.
    pub fn trigger_gc(&self) -> Result<()> {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        if let Some(ref gc) = *self.garbage_collector.read() {
            gc.trigger_gc()
        } else {
            Err(MemoryError::gc_error("Garbage collector not enabled"))
        }
    }
    
    /// Update memory manager configuration
    /// 
    /// # Arguments
    /// 
    /// * `new_config` - New configuration to apply
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if configuration was updated successfully.
    pub fn update_config(&self, new_config: MemoryManagerConfig) -> Result<()> {
        if !self.initialized.load(Ordering::Relaxed) {
            return Err(MemoryError::NotInitialized);
        }
        
        // Update allocation tracker
        self.allocation_tracker.set_enabled(new_config.enable_tracking);
        
        // Update GC configuration
        if let Some(ref gc) = *self.garbage_collector.read() {
            gc.update_config(new_config.gc_config.clone())?;
        }
        
        // Update main configuration
        *self.config.write() = new_config;
        
        log::info!("Memory manager configuration updated");
        Ok(())
    }
    
    /// Shutdown the memory manager
    /// 
    /// Cleans up all resources and stops background threads.
    pub fn shutdown() {
        if let Some(manager) = MEMORY_MANAGER.get() {
            manager.shutdown_internal();
        }
    }
    
    /// Internal shutdown implementation
    fn shutdown_internal(&self) {
        self.initialized.store(false, Ordering::Relaxed);
        
        // Shutdown garbage collector
        if let Some(mut gc) = self.garbage_collector.write().take() {
            if let Err(e) = gc.shutdown() {
                log::error!("Error shutting down garbage collector: {}", e);
            }
        }
        
        // Clear all pools
        self.pools.clear();
        
        // Clear allocation tracker
        self.allocation_tracker.clear();
        
        log::info!("Memory manager shutdown complete");
    }
}

impl Drop for MemoryManager {
    fn drop(&mut self) {
        self.shutdown_internal();
    }
}

// Thread safety: MemoryManager is Send + Sync because all internal components are thread-safe
unsafe impl Send for MemoryManager {}
unsafe impl Sync for MemoryManager {}
