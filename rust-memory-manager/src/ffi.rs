//! # Foreign Function Interface (FFI)
//! 
//! This module provides C-compatible functions that can be called from Node.js
//! using FFI libraries. All functions are designed to be safe to call from
//! JavaScript and handle errors gracefully.
//! 
//! # Safety
//! 
//! All FFI functions are marked as `extern "C"` and use C-compatible types.
//! Error handling is done through return codes and out parameters to avoid
//! exceptions crossing language boundaries.

use crate::memory_manager::MemoryManager;
use crate::types::{PoolConfig, PoolStrategy, MemoryManagerConfig, GCConfig};
use crate::error::MemoryError;
use libc::{c_char, c_int, c_uint, c_ulong, size_t};
use std::ffi::{CStr, CString};
use std::ptr;
use std::slice; 
use serde_json;

/// FFI Result codes
/// 
/// These codes are returned by FFI functions to indicate success or failure.
/// They correspond to different error conditions that can occur.
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FFIResult {
    /// Operation completed successfully
    Success = 0,
    /// Generic error occurred
    Error = 1,
    /// Invalid parameter provided
    InvalidParameter = 2,
    /// Memory manager not initialized
    NotInitialized = 3,
    /// Pool not found
    PoolNotFound = 4,
    /// Allocation not found
    AllocationNotFound = 5,
    /// Out of memory
    OutOfMemory = 6,
    /// Operation not supported
    NotSupported = 7,
}

impl From<MemoryError> for FFIResult {
    fn from(error: MemoryError) -> Self {
        match error {
            MemoryError::NotInitialized => FFIResult::NotInitialized,
            MemoryError::PoolNotFound { .. } => FFIResult::PoolNotFound,
            MemoryError::AllocationNotFound { .. } => FFIResult::AllocationNotFound,
            MemoryError::OutOfMemory { .. } => FFIResult::OutOfMemory,
            MemoryError::NotSupported { .. } => FFIResult::NotSupported,
            MemoryError::InvalidConfiguration { .. } => FFIResult::InvalidParameter,
            _ => FFIResult::Error,
        }
    }
}

/// C-compatible memory statistics structure
/// 
/// This structure mirrors the Rust MemoryStats but uses C-compatible types.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct CMemoryStats {
    pub total_allocated: size_t,
    pub total_deallocated: size_t,
    pub peak_usage: size_t,
    pub active_pools: c_uint,
    pub active_allocations: c_ulong,
    pub total_allocations: c_ulong,
    pub total_deallocations: c_ulong,
    pub gc_cycles: c_ulong,
    pub gc_time_ms: c_ulong,
    pub memory_pressure: f64,
}

/// C-compatible pool configuration structure
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct CPoolConfig {
    pub capacity: size_t,
    pub strategy: c_int, // 0=LIFO, 1=FIFO, 2=LRU, 3=Random
    pub max_age_seconds: c_ulong, // 0 means no limit
    pub max_idle_seconds: c_ulong, // 0 means no limit
    pub pre_allocate: c_int, // 0=false, 1=true
    pub enable_stats: c_int, // 0=false, 1=true
}

/// Initialize the memory manager with default configuration
/// 
/// This function must be called before using any other memory management functions.
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if initialization was successful.
/// 
/// # Safety
/// 
/// This function is safe to call from any thread, but should only be called once.
#[no_mangle]
pub extern "C" fn xypriss_memory_init() -> FFIResult {
    match MemoryManager::initialize() {
        Ok(_) => FFIResult::Success,
        Err(e) => {
            log::error!("Failed to initialize memory manager: {}", e);
            FFIResult::from(e)
        }
    }
}

/// Initialize the memory manager with custom configuration
/// 
/// # Arguments
/// 
/// * `max_memory_bytes` - Maximum memory usage in bytes
/// * `enable_tracking` - Whether to enable allocation tracking (0=false, 1=true)
/// * `enable_logging` - Whether to enable detailed logging (0=false, 1=true)
/// * `gc_enabled` - Whether to enable garbage collection (0=false, 1=true)
/// * `gc_threshold` - Memory pressure threshold for GC (0.0 to 1.0)
/// 
/// # Returns 
/// 
/// Returns FFIResult::Success if initialization was successful.
/// 
/// # Safety
/// 
/// This function is safe to call from any thread, but should only be called once.
#[no_mangle]
pub extern "C" fn xypriss_memory_init_with_config(
    max_memory_bytes: size_t,
    enable_tracking: c_int,
    enable_logging: c_int,
    gc_enabled: c_int,
    gc_threshold: f64,
) -> FFIResult {
    let config = MemoryManagerConfig {
        max_memory_bytes,
        enable_tracking: enable_tracking != 0,
        enable_logging: enable_logging != 0,
        gc_config: GCConfig {
            enabled: gc_enabled != 0,
            pressure_threshold: gc_threshold,
            ..Default::default()
        },
        ..Default::default()
    };
    
    match MemoryManager::initialize_with_config(config) {
        Ok(_) => FFIResult::Success,
        Err(e) => {
            log::error!("Failed to initialize memory manager with config: {}", e);
            FFIResult::from(e)
        }
    }
}

/// Shutdown the memory manager
/// 
/// This function should be called when the application is shutting down
/// to ensure all resources are properly cleaned up.
/// 
/// # Safety
/// 
/// This function is safe to call from any thread.
#[no_mangle]
pub extern "C" fn xypriss_memory_shutdown() {
    MemoryManager::shutdown();
}

/// Create a new memory pool
/// 
/// # Arguments
/// 
/// * `name` - Null-terminated string with the pool name
/// * `config` - Pool configuration
/// * `object_size` - Size of objects in this pool (in bytes)
/// * `pool_handle` - Output parameter for the pool handle
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if the pool was created successfully.
/// 
/// # Safety
/// 
/// The `name` parameter must be a valid null-terminated C string.
/// The `pool_handle` parameter must point to valid memory.
#[no_mangle]
pub extern "C" fn xypriss_memory_create_pool(
    name: *const c_char,
    config: CPoolConfig,
    object_size: size_t,
    pool_handle: *mut c_ulong,
) -> FFIResult {
    if name.is_null() || pool_handle.is_null() {
        return FFIResult::InvalidParameter;
    }
    
    let name_str = unsafe {
        match CStr::from_ptr(name).to_str() {
            Ok(s) => s,
            Err(_) => return FFIResult::InvalidParameter,
        }
    };
    
    let strategy = match config.strategy {
        0 => PoolStrategy::LIFO,
        1 => PoolStrategy::FIFO,
        2 => PoolStrategy::LRU,
        3 => PoolStrategy::Random,
        _ => return FFIResult::InvalidParameter,
    };
    
    let pool_config = PoolConfig {
        name: name_str.to_string(),
        capacity: config.capacity,
        strategy,
        max_age_seconds: if config.max_age_seconds == 0 { None } else { Some(config.max_age_seconds) },
        max_idle_seconds: if config.max_idle_seconds == 0 { None } else { Some(config.max_idle_seconds) },
        pre_allocate: config.pre_allocate != 0,
        enable_stats: config.enable_stats != 0,
        metadata: Some(format!("object_size:{}", object_size)),
    };
    
    // For FFI, we create pools that manage raw byte arrays
    let factory = move || vec![0u8; object_size];
    
    match MemoryManager::instance().create_pool(pool_config, factory) {
        Ok(handle) => {
            unsafe {
                *pool_handle = handle.0;
            }
            FFIResult::Success
        }
        Err(e) => {
            log::error!("Failed to create pool '{}': {}", name_str, e);
            FFIResult::from(e)
        }
    }
}

/// Acquire an object from a memory pool
/// 
/// # Arguments
/// 
/// * `pool_handle` - Handle to the pool
/// * `object_ptr` - Output parameter for the object pointer
/// * `object_size` - Output parameter for the object size
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if an object was acquired successfully.
/// 
/// # Safety
/// 
/// The returned object pointer must be freed using `xypriss_memory_release_object`.
/// The `object_ptr` and `object_size` parameters must point to valid memory.
#[no_mangle]
pub extern "C" fn xypriss_memory_acquire_object(
    pool_handle: c_ulong,
    object_ptr: *mut *mut u8,
    object_size: *mut size_t,
) -> FFIResult {
    if object_ptr.is_null() || object_size.is_null() {
        return FFIResult::InvalidParameter;
    }
    
    // For now, return not supported as we need better type handling
    // In a real implementation, we'd maintain a registry of pools with their object sizes
    FFIResult::NotSupported
}

/// Release an object back to a memory pool
/// 
/// # Arguments
/// 
/// * `pool_handle` - Handle to the pool
/// * `object_ptr` - Pointer to the object to release
/// * `object_size` - Size of the object
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if the object was released successfully.
/// 
/// # Safety
/// 
/// The `object_ptr` must have been acquired from the same pool using
/// `xypriss_memory_acquire_object`.
#[no_mangle]
pub extern "C" fn xypriss_memory_release_object(
    pool_handle: c_ulong,
    object_ptr: *mut u8,
    object_size: size_t,
) -> FFIResult {
    if object_ptr.is_null() {
        return FFIResult::InvalidParameter;
    }
    
    // For now, return not supported as we need better type handling
    FFIResult::NotSupported
}

/// Track a memory allocation
/// 
/// # Arguments
/// 
/// * `size` - Size of the allocation in bytes
/// * `tag` - Optional null-terminated string tag (can be null)
/// * `allocation_handle` - Output parameter for the allocation handle
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if the allocation was tracked successfully.
/// 
/// # Safety
/// 
/// The `allocation_handle` parameter must point to valid memory.
/// If `tag` is not null, it must be a valid null-terminated C string.
#[no_mangle]
pub extern "C" fn xypriss_memory_track_allocation(
    size: size_t,
    tag: *const c_char,
    allocation_handle: *mut c_ulong,
) -> FFIResult {
    if allocation_handle.is_null() {
        return FFIResult::InvalidParameter;
    }
    
    let tag_str = if tag.is_null() {
        None
    } else {
        unsafe {
            match CStr::from_ptr(tag).to_str() {
                Ok(s) => Some(s.to_string()),
                Err(_) => return FFIResult::InvalidParameter,
            }
        }
    };
    
    match MemoryManager::instance().track_allocation(size, tag_str) {
        Ok(handle) => {
            unsafe {
                *allocation_handle = handle.0;
            }
            FFIResult::Success
        }
        Err(e) => {
            log::error!("Failed to track allocation: {}", e);
            FFIResult::from(e)
        }
    }
}

/// Free a tracked allocation
/// 
/// # Arguments
/// 
/// * `allocation_handle` - Handle to the allocation to free
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if the allocation was freed successfully.
/// 
/// # Safety
/// 
/// This function is safe to call from any thread.
#[no_mangle]
pub extern "C" fn xypriss_memory_free_allocation(allocation_handle: c_ulong) -> FFIResult {
    use crate::types::AllocationHandle;
    
    let handle = AllocationHandle(allocation_handle);
    match MemoryManager::instance().free_allocation(handle) {
        Ok(_) => FFIResult::Success,
        Err(e) => {
            log::error!("Failed to free allocation: {}", e);
            FFIResult::from(e)
        }
    }
}

/// Get current memory statistics
/// 
/// # Arguments
/// 
/// * `stats` - Output parameter for the statistics
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if statistics were retrieved successfully.
/// 
/// # Safety
/// 
/// The `stats` parameter must point to valid memory.
#[no_mangle]
pub extern "C" fn xypriss_memory_get_stats(stats: *mut CMemoryStats) -> FFIResult {
    if stats.is_null() {
        return FFIResult::InvalidParameter;
    }
    
    let rust_stats = MemoryManager::instance().get_stats();
    
    unsafe {
        *stats = CMemoryStats {
            total_allocated: rust_stats.total_allocated,
            total_deallocated: rust_stats.total_deallocated,
            peak_usage: rust_stats.peak_usage,
            active_pools: rust_stats.active_pools as c_uint,
            active_allocations: rust_stats.active_allocations as c_ulong,
            total_allocations: rust_stats.total_allocations as c_ulong,
            total_deallocations: rust_stats.total_deallocations as c_ulong,
            gc_cycles: rust_stats.gc_cycles as c_ulong,
            gc_time_ms: rust_stats.gc_time_ms as c_ulong,
            memory_pressure: rust_stats.memory_pressure,
        };
    }
    
    FFIResult::Success
}

/// Trigger garbage collection
/// 
/// # Returns
/// 
/// Returns FFIResult::Success if GC was triggered successfully.
/// 
/// # Safety
/// 
/// This function is safe to call from any thread.
#[no_mangle]
pub extern "C" fn xypriss_memory_trigger_gc() -> FFIResult {
    match MemoryManager::instance().trigger_gc() {
        Ok(_) => FFIResult::Success,
        Err(e) => {
            log::error!("Failed to trigger GC: {}", e);
            FFIResult::from(e)
        }
    }
}

/// Get the last error message
/// 
/// # Arguments
/// 
/// * `buffer` - Buffer to write the error message to
/// * `buffer_size` - Size of the buffer
/// 
/// # Returns
/// 
/// Returns the length of the error message, or 0 if no error.
/// 
/// # Safety
/// 
/// The `buffer` parameter must point to valid memory of at least `buffer_size` bytes.
#[no_mangle]
pub extern "C" fn xypriss_memory_get_last_error(
    buffer: *mut c_char,
    buffer_size: size_t,
) -> size_t {
    if buffer.is_null() || buffer_size == 0 {
        return 0;
    }
    
    // For now, return empty string as we don't maintain a global error state
    unsafe {
        *buffer = 0;
    }
    0
}
