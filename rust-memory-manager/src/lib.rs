//! # XyPriss Memory Manager
//!
//! A high-performance memory management module written in Rust for the XyPriss framework.
//! This module provides advanced memory pooling, allocation tracking, and garbage collection
//! utilities that can be used from Node.js through FFI (Foreign Function Interface).
//!  
//! ## Features 
//!
//! - **Memory Pools**: Efficient object reuse with configurable strategies (LIFO, FIFO, LRU)
//! - **Allocation Tracking**: Monitor memory usage and detect potential leaks
//! - **Garbage Collection**: Smart cleanup with configurable thresholds
//! - **Thread Safety**: All operations are thread-safe using lock-free data structures
//! - **C FFI**: Compatible interface for Node.js integration
//! - **Performance Monitoring**: Real-time metrics and statistics
//!
//! ## Architecture
//!
//! The memory manager is built around several core components:
//!
//! 1. **MemoryPool**: Manages object reuse with different allocation strategies
//! 2. **AllocationTracker**: Monitors memory usage and provides leak detection
//! 3. **GarbageCollector**: Handles automatic cleanup based on configurable rules
//! 4. **MemoryManager**: Central coordinator that orchestrates all components
//! 5. **FFI Interface**: C-compatible functions for Node.js integration

// Re-export all public modules for easy access
pub mod memory_pool;
pub mod allocation_tracker;
pub mod garbage_collector;
pub mod memory_manager;
pub mod ffi;
pub mod types;
pub mod utils;
pub mod error;

// Re-export commonly used types and functions
pub use memory_manager::MemoryManager;
pub use memory_pool::{MemoryPool, PoolStrategy};
pub use allocation_tracker::AllocationTracker;
pub use garbage_collector::GarbageCollector;
pub use types::{MemoryStats, PoolConfig, AllocationInfo};
pub use error::{MemoryError, Result};

// FFI exports for C compatibility
pub use ffi::*;

/// Initialize the memory manager with default configuration
///
/// This function sets up the global memory manager instance with sensible defaults.
/// It should be called once at the start of your application.
///
/// # Returns
///
/// Returns `true` if initialization was successful, `false` otherwise.
///
/// # Example
///
/// ```rust
/// use xypriss_memory_manager::init_memory_manager;
///
/// if init_memory_manager() {
///     println!("Memory manager initialized successfully");
/// } else {
///     eprintln!("Failed to initialize memory manager");
/// }
/// ```
pub fn init_memory_manager() -> bool {
    match MemoryManager::initialize() {
        Ok(_) => {
            log::info!("XyPriss Memory Manager initialized successfully");
            true
        }
        Err(e) => {
            log::error!("Failed to initialize memory manager: {}", e);
            false
        }
    }
}

/// Get the global memory manager instance
///
/// Returns a reference to the singleton memory manager instance.
/// The instance must be initialized first using `init_memory_manager()`.
///
/// # Panics
///
/// Panics if the memory manager has not been initialized.
///
/// # Example
///
/// ```rust
/// use xypriss_memory_manager::{init_memory_manager, get_memory_manager};
///
/// init_memory_manager();
/// let manager = get_memory_manager();
/// let stats = manager.get_stats();
/// println!("Current memory usage: {} bytes", stats.total_allocated);
/// ```
pub fn get_memory_manager() -> &'static MemoryManager {
    MemoryManager::instance()
}

/// Shutdown the memory manager and cleanup all resources
///
/// This function should be called when your application is shutting down
/// to ensure all resources are properly cleaned up.
///
/// # Example
///
/// ```rust
/// use xypriss_memory_manager::shutdown_memory_manager;
///
/// // At application shutdown
/// shutdown_memory_manager();
/// ```
pub fn shutdown_memory_manager() {
    MemoryManager::shutdown();
    log::info!("XyPriss Memory Manager shutdown complete");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_manager_initialization() {
        assert!(init_memory_manager());

        let manager = get_memory_manager();
        let stats = manager.get_stats();

        // Verify initial state
        assert_eq!(stats.total_allocated, 0);
        assert_eq!(stats.active_pools, 0);

        shutdown_memory_manager();
    }
}
