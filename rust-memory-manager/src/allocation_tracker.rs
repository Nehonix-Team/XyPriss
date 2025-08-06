//! # Allocation Tracker
//! 
//! This module provides comprehensive memory allocation tracking capabilities.
//! It monitors all allocations, tracks their lifecycle, and provides leak
//! detection and memory usage analysis.

use crate::types::{AllocationInfo, AllocationHandle, MemoryStats};
use crate::error::{MemoryError, Result};
use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::SystemTime;
use std::sync::Arc;
use parking_lot::RwLock;

/// Comprehensive allocation tracking system
/// 
/// The AllocationTracker monitors all memory allocations within the system,
/// providing detailed statistics, leak detection, and memory usage analysis.
/// It's designed to be thread-safe and low-overhead for production use.
/// 
/// # Features
/// 
/// - **Real-time Tracking**: Monitor allocations as they happen
/// - **Leak Detection**: Identify allocations that haven't been freed
/// - **Usage Statistics**: Detailed metrics about memory usage patterns
/// - **Thread Safety**: Concurrent access from multiple threads
/// - **Low Overhead**: Minimal performance impact in production
/// 
/// # Examples
/// 
/// ```rust
/// use xypriss_memory_manager::AllocationTracker;
/// 
/// let tracker = AllocationTracker::new();
/// 
/// // Track an allocation
/// let handle = tracker.track_allocation(1024, Some("buffer".to_string()))?;
/// 
/// // Get current statistics
/// let stats = tracker.get_stats();
/// println!("Total allocated: {} bytes", stats.total_allocated);
/// 
/// // Free the allocation
/// tracker.free_allocation(handle)?;
/// ```
pub struct AllocationTracker {
    /// Map of active allocations
    /// Using DashMap for concurrent access without locks
    allocations: DashMap<u64, AllocationInfo>,
    
    /// Next allocation ID
    next_id: AtomicU64, 
    
    /// Total bytes currently allocated
    total_allocated: AtomicUsize,
    
    /// Total bytes deallocated since startup
    total_deallocated: AtomicUsize,
    
    /// Peak memory usage
    peak_usage: AtomicUsize,
    
    /// Total number of allocations since startup
    total_allocations: AtomicU64,
    
    /// Total number of deallocations since startup
    total_deallocations: AtomicU64,
    
    /// Cached statistics (updated periodically)
    cached_stats: Arc<RwLock<MemoryStats>>,
    
    /// Whether tracking is enabled
    enabled: AtomicU64, // Using AtomicU64 as AtomicBool for consistency
}

impl AllocationTracker {
    /// Create a new allocation tracker
    /// 
    /// # Returns
    /// 
    /// Returns a new AllocationTracker instance ready for use.
    pub fn new() -> Self {
        Self {
            allocations: DashMap::new(),
            next_id: AtomicU64::new(1),
            total_allocated: AtomicUsize::new(0),
            total_deallocated: AtomicUsize::new(0),
            peak_usage: AtomicUsize::new(0),
            total_allocations: AtomicU64::new(0),
            total_deallocations: AtomicU64::new(0),
            cached_stats: Arc::new(RwLock::new(MemoryStats::default())),
            enabled: AtomicU64::new(1), // 1 = enabled, 0 = disabled
        }
    }
    
    /// Enable or disable allocation tracking
    /// 
    /// When disabled, tracking operations become no-ops for better performance.
    /// 
    /// # Arguments
    /// 
    /// * `enabled` - Whether to enable tracking
    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(if enabled { 1 } else { 0 }, Ordering::Relaxed);
        log::info!("Allocation tracking {}", if enabled { "enabled" } else { "disabled" });
    }
    
    /// Check if tracking is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed) != 0
    }
    
    /// Track a new memory allocation
    /// 
    /// Records a new allocation in the tracking system with optional metadata.
    /// 
    /// # Arguments
    /// 
    /// * `size` - Size of the allocation in bytes
    /// * `tag` - Optional tag for categorizing the allocation
    /// 
    /// # Returns
    /// 
    /// Returns an AllocationHandle that can be used to reference this allocation.
    pub fn track_allocation(&self, size: usize, tag: Option<String>) -> Result<AllocationHandle> {
        if !self.is_enabled() {
            return Ok(AllocationHandle(0)); // Return dummy handle when disabled
        }
        
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let now = SystemTime::now();
        
        let allocation_info = AllocationInfo {
            id,
            size,
            created_at: now,
            last_accessed: now,
            access_count: 1,
            tag,
            stack_trace: self.capture_stack_trace(),
        };
        
        // Insert into tracking map
        self.allocations.insert(id, allocation_info);
        
        // Update counters
        let new_total = self.total_allocated.fetch_add(size, Ordering::Relaxed) + size;
        self.total_allocations.fetch_add(1, Ordering::Relaxed);
        
        // Update peak usage if necessary
        let current_peak = self.peak_usage.load(Ordering::Relaxed);
        if new_total > current_peak {
            self.peak_usage.store(new_total, Ordering::Relaxed);
        }
        
        log::debug!("Tracked allocation {} of {} bytes (tag: {:?})", 
                   id, size, allocation_info.tag);
        
        Ok(AllocationHandle(id))
    }
    
    /// Free a tracked allocation
    /// 
    /// Removes an allocation from tracking and updates statistics.
    /// 
    /// # Arguments
    /// 
    /// * `handle` - Handle to the allocation to free
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if successful, or an error if the allocation wasn't found.
    pub fn free_allocation(&self, handle: AllocationHandle) -> Result<()> {
        if !self.is_enabled() || handle.0 == 0 {
            return Ok(()); // No-op when disabled or dummy handle
        }
        
        let id = handle.0;
        
        // Remove from tracking map
        if let Some((_, allocation_info)) = self.allocations.remove(&id) {
            // Update counters
            self.total_allocated.fetch_sub(allocation_info.size, Ordering::Relaxed);
            self.total_deallocated.fetch_add(allocation_info.size, Ordering::Relaxed);
            self.total_deallocations.fetch_add(1, Ordering::Relaxed);
            
            log::debug!("Freed allocation {} of {} bytes", id, allocation_info.size);
            
            Ok(())
        } else {
            Err(MemoryError::AllocationNotFound { id })
        }
    }
    
    /// Update access information for an allocation
    /// 
    /// Records that an allocation has been accessed, updating its last_accessed
    /// time and incrementing the access count.
    /// 
    /// # Arguments
    /// 
    /// * `handle` - Handle to the allocation
    pub fn touch_allocation(&self, handle: AllocationHandle) -> Result<()> {
        if !self.is_enabled() || handle.0 == 0 {
            return Ok(());
        }
        
        let id = handle.0;
        
        if let Some(mut allocation) = self.allocations.get_mut(&id) {
            allocation.last_accessed = SystemTime::now();
            allocation.access_count += 1;
            Ok(())
        } else {
            Err(MemoryError::AllocationNotFound { id })
        }
    }
    
    /// Get information about a specific allocation
    /// 
    /// # Arguments
    /// 
    /// * `handle` - Handle to the allocation
    /// 
    /// # Returns
    /// 
    /// Returns the AllocationInfo if found, or an error if not found.
    pub fn get_allocation_info(&self, handle: AllocationHandle) -> Result<AllocationInfo> {
        if !self.is_enabled() || handle.0 == 0 {
            return Err(MemoryError::AllocationNotFound { id: handle.0 });
        }
        
        let id = handle.0;
        
        if let Some(allocation) = self.allocations.get(&id) {
            Ok(allocation.clone())
        } else {
            Err(MemoryError::AllocationNotFound { id })
        }
    }
    
    /// Get current memory statistics
    /// 
    /// Returns comprehensive statistics about current memory usage,
    /// including totals, peaks, and allocation counts.
    pub fn get_stats(&self) -> MemoryStats {
        let mut stats = self.cached_stats.write();
        
        // Update with current values
        stats.total_allocated = self.total_allocated.load(Ordering::Relaxed);
        stats.total_deallocated = self.total_deallocated.load(Ordering::Relaxed);
        stats.peak_usage = self.peak_usage.load(Ordering::Relaxed);
        stats.active_allocations = self.allocations.len() as u64;
        stats.total_allocations = self.total_allocations.load(Ordering::Relaxed);
        stats.total_deallocations = self.total_deallocations.load(Ordering::Relaxed);
        stats.collected_at = SystemTime::now();
        
        stats.clone()
    }
    
    /// Detect potential memory leaks
    /// 
    /// Identifies allocations that have been active for a long time or
    /// haven't been accessed recently, which might indicate memory leaks.
    /// 
    /// # Arguments
    /// 
    /// * `max_age_seconds` - Maximum age for an allocation before it's considered a leak
    /// * `max_idle_seconds` - Maximum idle time before an allocation is considered a leak
    /// 
    /// # Returns
    /// 
    /// Returns a vector of AllocationInfo for potentially leaked allocations.
    pub fn detect_leaks(&self, max_age_seconds: u64, max_idle_seconds: u64) -> Vec<AllocationInfo> {
        if !self.is_enabled() {
            return Vec::new();
        }
        
        let now = SystemTime::now();
        let mut leaks = Vec::new();
        
        for allocation_ref in self.allocations.iter() {
            let allocation = allocation_ref.value();
            
            let age = now.duration_since(allocation.created_at)
                .unwrap_or_default()
                .as_secs();
            
            let idle_time = now.duration_since(allocation.last_accessed)
                .unwrap_or_default()
                .as_secs();
            
            if age > max_age_seconds || idle_time > max_idle_seconds {
                leaks.push(allocation.clone());
            }
        }
        
        if !leaks.is_empty() {
            log::warn!("Detected {} potential memory leaks", leaks.len());
        }
        
        leaks
    }
    
    /// Get allocations by tag
    /// 
    /// Returns all allocations that match the specified tag.
    /// 
    /// # Arguments
    /// 
    /// * `tag` - Tag to search for
    /// 
    /// # Returns
    /// 
    /// Returns a vector of AllocationInfo for matching allocations.
    pub fn get_allocations_by_tag(&self, tag: &str) -> Vec<AllocationInfo> {
        if !self.is_enabled() {
            return Vec::new();
        }
        
        self.allocations
            .iter()
            .filter_map(|entry| {
                let allocation = entry.value();
                if allocation.tag.as_ref().map(|t| t.as_str()) == Some(tag) {
                    Some(allocation.clone())
                } else {
                    None
                }
            })
            .collect()
    }
    
    /// Clear all tracking data
    /// 
    /// Removes all tracked allocations and resets statistics.
    /// This should only be used for testing or when shutting down.
    pub fn clear(&self) {
        self.allocations.clear();
        self.total_allocated.store(0, Ordering::Relaxed);
        self.total_deallocated.store(0, Ordering::Relaxed);
        self.peak_usage.store(0, Ordering::Relaxed);
        self.total_allocations.store(0, Ordering::Relaxed);
        self.total_deallocations.store(0, Ordering::Relaxed);
        
        log::info!("Allocation tracker cleared");
    }
    
    /// Capture stack trace for debugging (placeholder implementation)
    /// 
    /// In a real implementation, this would capture the current stack trace
    /// to help identify where allocations are coming from.
    fn capture_stack_trace(&self) -> Option<String> {
        // TODO: Implement actual stack trace capture
        // This would require additional dependencies like backtrace
        None
    }
}

impl Default for AllocationTracker {
    fn default() -> Self {
        Self::new()
    }
}

// Thread safety: AllocationTracker is Send + Sync because:
// - DashMap is Send + Sync
// - All atomic types are Send + Sync
// - RwLock is Send + Sync
unsafe impl Send for AllocationTracker {}
unsafe impl Sync for AllocationTracker {}
