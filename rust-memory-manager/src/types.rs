//! # Core Types and Data Structures
//! 
//! This module defines all the core types, structures, and enums used throughout
//! the XyPriss Memory Manager. These types provide a consistent interface for
//! memory management operations and configuration.

use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime};
  
/// Memory pool allocation strategies
/// 
/// Different strategies for managing object allocation and deallocation
/// within memory pools. Each strategy has different performance characteristics
/// and use cases.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PoolStrategy {
    /// Last In, First Out - Most recently returned objects are reused first
    /// Best for: Temporal locality, cache-friendly access patterns
    LIFO,
    
    /// First In, First Out - Oldest objects are reused first
    /// Best for: Fair distribution, preventing object starvation
    FIFO,
    
    /// Least Recently Used - Objects not used for longest time are reused first
    /// Best for: Memory efficiency, automatic cleanup of unused objects
    LRU,
    
    /// Random selection - Objects are selected randomly for reuse
    /// Best for: Load balancing, avoiding worst-case scenarios
    Random,
}

/// Memory pool configuration
/// 
/// Configuration parameters for creating and managing memory pools.
/// These settings control pool behavior, capacity, and cleanup policies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    /// Unique identifier for the pool
    pub name: String,
    
    /// Maximum number of objects the pool can hold
    pub capacity: usize,
    
    /// Allocation strategy to use for this pool
    pub strategy: PoolStrategy,
    
    /// Maximum age of objects in the pool (in seconds)
    /// Objects older than this will be automatically cleaned up
    pub max_age_seconds: Option<u64>,
    
    /// Maximum idle time before an object is considered for cleanup (in seconds)
    pub max_idle_seconds: Option<u64>,
    
    /// Whether to pre-allocate objects to fill the pool initially
    pub pre_allocate: bool,
    
    /// Whether to enable detailed statistics collection for this pool
    pub enable_stats: bool,
    
    /// Custom metadata associated with this pool
    pub metadata: Option<String>,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            name: "default_pool".to_string(),
            capacity: 100,
            strategy: PoolStrategy::LIFO,
            max_age_seconds: Some(3600), // 1 hour
            max_idle_seconds: Some(300), // 5 minutes
            pre_allocate: false,
            enable_stats: true,
            metadata: None,
        }
    }
}

/// Information about a memory allocation
/// 
/// Tracks metadata about individual memory allocations for monitoring
/// and debugging purposes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocationInfo {
    /// Unique identifier for this allocation
    pub id: u64,
    
    /// Size of the allocation in bytes
    pub size: usize,
    
    /// Timestamp when the allocation was created
    pub created_at: SystemTime,
    
    /// Timestamp when the allocation was last accessed
    pub last_accessed: SystemTime,
    
    /// Number of times this allocation has been accessed
    pub access_count: u64,
    
    /// Optional tag for categorizing allocations
    pub tag: Option<String>,
    
    /// Stack trace where the allocation occurred (if available)
    pub stack_trace: Option<String>,
}

/// Memory usage statistics
/// 
/// Comprehensive statistics about memory usage across the entire system.
/// These stats are useful for monitoring, debugging, and optimization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    /// Total bytes currently allocated
    pub total_allocated: usize,
    
    /// Total bytes deallocated since startup
    pub total_deallocated: usize,
    
    /// Peak memory usage since startup
    pub peak_usage: usize,
    
    /// Number of active memory pools
    pub active_pools: usize,
    
    /// Number of active allocations being tracked
    pub active_allocations: u64,
    
    /// Total number of allocations since startup
    pub total_allocations: u64,
    
    /// Total number of deallocations since startup
    pub total_deallocations: u64,
    
    /// Number of garbage collection cycles performed
    pub gc_cycles: u64,
    
    /// Total time spent in garbage collection (in milliseconds)
    pub gc_time_ms: u64,
    
    /// Current memory pressure level (0.0 to 1.0)
    pub memory_pressure: f64,
    
    /// Timestamp when these stats were collected
    pub collected_at: SystemTime,
}

impl Default for MemoryStats {
    fn default() -> Self {
        Self {
            total_allocated: 0,
            total_deallocated: 0,
            peak_usage: 0,
            active_pools: 0,
            active_allocations: 0,
            total_allocations: 0,
            total_deallocations: 0,
            gc_cycles: 0,
            gc_time_ms: 0,
            memory_pressure: 0.0,
            collected_at: SystemTime::now(),
        }
    }
}

/// Pool-specific statistics
/// 
/// Detailed statistics for individual memory pools, useful for
/// performance analysis and optimization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    /// Pool name
    pub name: String,
    
    /// Current number of objects in the pool
    pub current_size: usize,
    
    /// Maximum capacity of the pool
    pub capacity: usize,
    
    /// Total number of objects acquired from this pool
    pub total_acquisitions: u64,
    
    /// Total number of objects returned to this pool
    pub total_returns: u64,
    
    /// Number of cache hits (objects reused from pool)
    pub cache_hits: u64,
    
    /// Number of cache misses (new objects created)
    pub cache_misses: u64,
    
    /// Cache hit ratio (0.0 to 1.0)
    pub hit_ratio: f64,
    
    /// Average object lifetime in the pool (in milliseconds)
    pub avg_lifetime_ms: u64,
    
    /// Timestamp when this pool was created
    pub created_at: SystemTime,
    
    /// Timestamp when these stats were collected
    pub collected_at: SystemTime,
}

/// Garbage collection configuration
/// 
/// Settings that control when and how garbage collection is performed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCConfig {
    /// Enable automatic garbage collection
    pub enabled: bool,
    
    /// Memory pressure threshold to trigger GC (0.0 to 1.0)
    pub pressure_threshold: f64,
    
    /// Interval between GC cycles (in seconds)
    pub interval_seconds: u64,
    
    /// Maximum time to spend in a single GC cycle (in milliseconds)
    pub max_gc_time_ms: u64,
    
    /// Whether to perform aggressive cleanup during GC
    pub aggressive_cleanup: bool,
}

impl Default for GCConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            pressure_threshold: 0.8,
            interval_seconds: 60,
            max_gc_time_ms: 100,
            aggressive_cleanup: false,
        }
    }
}

/// Memory manager configuration
/// 
/// Global configuration for the entire memory management system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryManagerConfig {
    /// Maximum total memory usage (in bytes)
    pub max_memory_bytes: usize,
    
    /// Enable allocation tracking
    pub enable_tracking: bool,
    
    /// Enable detailed logging
    pub enable_logging: bool,
    
    /// Garbage collection configuration
    pub gc_config: GCConfig,
    
    /// Default pool configuration for new pools
    pub default_pool_config: PoolConfig,
}

impl Default for MemoryManagerConfig {
    fn default() -> Self {
        Self {
            max_memory_bytes: 1024 * 1024 * 1024, // 1GB
            enable_tracking: true,
            enable_logging: false,
            gc_config: GCConfig::default(),
            default_pool_config: PoolConfig::default(),
        }
    }
}

/// Handle for a memory pool
/// 
/// Opaque handle that can be passed across FFI boundaries to identify
/// a specific memory pool instance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PoolHandle(pub u64);

/// Handle for a tracked allocation
/// 
/// Opaque handle that can be passed across FFI boundaries to identify
/// a specific allocation instance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AllocationHandle(pub u64);
