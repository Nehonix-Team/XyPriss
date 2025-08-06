//! # Utility Functions
//! 
//! This module provides various utility functions for memory management,
//! including memory size calculations, formatting helpers, and system
//! information gathering.

use std::time::{SystemTime, UNIX_EPOCH};
 
/// Format bytes in a human-readable format
///  
/// Converts byte counts to human-readable strings with appropriate units
/// (B, KB, MB, GB, TB).
/// 
/// # Arguments
/// 
/// * `bytes` - Number of bytes to format
/// 
/// # Returns
/// 
/// Returns a formatted string with the appropriate unit.
/// 
/// # Examples
/// 
/// ```rust
/// use xypriss_memory_manager::utils::format_bytes;
/// 
/// assert_eq!(format_bytes(1024), "1.00 KB");
/// assert_eq!(format_bytes(1048576), "1.00 MB");
/// assert_eq!(format_bytes(1073741824), "1.00 GB");
/// ```
pub fn format_bytes(bytes: usize) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
    const THRESHOLD: f64 = 1024.0;
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    let bytes_f = bytes as f64;
    let unit_index = (bytes_f.log10() / THRESHOLD.log10()).floor() as usize;
    let unit_index = unit_index.min(UNITS.len() - 1);
    
    let value = bytes_f / THRESHOLD.powi(unit_index as i32);
    
    format!("{:.2} {}", value, UNITS[unit_index])
}

/// Calculate percentage with proper handling of edge cases
/// 
/// # Arguments
/// 
/// * `value` - The value to calculate percentage for
/// * `total` - The total value (100%)
/// 
/// # Returns
/// 
/// Returns the percentage as a float between 0.0 and 100.0.
pub fn calculate_percentage(value: usize, total: usize) -> f64 {
    if total == 0 {
        return 0.0;
    }
    
    (value as f64 / total as f64) * 100.0
}

/// Get current timestamp in milliseconds since Unix epoch
/// 
/// # Returns
/// 
/// Returns the current timestamp in milliseconds.
pub fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Estimate the size of a generic object in memory
/// 
/// This is a rough estimation and may not be accurate for all types.
/// For more precise measurements, consider using specialized tools.
/// 
/// # Arguments
/// 
/// * `_obj` - Reference to the object to estimate
/// 
/// # Returns
/// 
/// Returns an estimated size in bytes.
pub fn estimate_object_size<T>(_obj: &T) -> usize {
    std::mem::size_of::<T>()
}

/// Round up to the nearest power of 2
/// 
/// Useful for memory allocation alignment and pool sizing.
/// 
/// # Arguments
/// 
/// * `value` - Value to round up
/// 
/// # Returns
/// 
/// Returns the next power of 2 greater than or equal to the input.
pub fn next_power_of_2(value: usize) -> usize {
    if value <= 1 {
        return 1;
    }
    
    let mut power = 1;
    while power < value {
        power <<= 1;
    }
    power
}

/// Check if a value is a power of 2
/// 
/// # Arguments
/// 
/// * `value` - Value to check
/// 
/// # Returns
/// 
/// Returns true if the value is a power of 2.
pub fn is_power_of_2(value: usize) -> bool {
    value != 0 && (value & (value - 1)) == 0
}

/// Calculate memory alignment for a given size
/// 
/// Returns the appropriate alignment for memory allocations of the given size.
/// 
/// # Arguments
/// 
/// * `size` - Size in bytes
/// 
/// # Returns
/// 
/// Returns the recommended alignment in bytes.
pub fn calculate_alignment(size: usize) -> usize {
    if size >= 8 {
        8
    } else if size >= 4 {
        4
    } else if size >= 2 {
        2
    } else {
        1
    }
}

/// Get system page size
/// 
/// Returns the system's memory page size, which is useful for
/// memory allocation alignment and optimization.
/// 
/// # Returns
/// 
/// Returns the page size in bytes, or 4096 as a fallback.
pub fn get_page_size() -> usize {
    // On Unix systems, we could use libc::sysconf(libc::_SC_PAGESIZE)
    // For now, return a common default
    4096
}

/// Calculate optimal pool capacity based on object size and memory constraints
/// 
/// This function helps determine an appropriate pool capacity based on
/// the size of objects being pooled and available memory.
/// 
/// # Arguments
/// 
/// * `object_size` - Size of each object in bytes
/// * `max_memory` - Maximum memory to use for the pool in bytes
/// * `min_capacity` - Minimum pool capacity
/// * `max_capacity` - Maximum pool capacity
/// 
/// # Returns
/// 
/// Returns the recommended pool capacity.
pub fn calculate_optimal_pool_capacity(
    object_size: usize,
    max_memory: usize,
    min_capacity: usize,
    max_capacity: usize,
) -> usize {
    if object_size == 0 {
        return min_capacity;
    }
    
    let theoretical_capacity = max_memory / object_size;
    theoretical_capacity.max(min_capacity).min(max_capacity)
}

/// Generate a simple hash for string keys
/// 
/// This is a basic hash function for use in internal data structures.
/// Not cryptographically secure.
/// 
/// # Arguments
/// 
/// * `key` - String to hash
/// 
/// # Returns
/// 
/// Returns a hash value as u64.
pub fn simple_hash(key: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64; // FNV offset basis
    
    for byte in key.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3); // FNV prime
    }
    
    hash
}

/// Memory pressure level classification
/// 
/// Classifies memory pressure into discrete levels for easier decision making.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryPressureLevel {
    /// Low pressure (0.0 - 0.5)
    Low,
    /// Medium pressure (0.5 - 0.8)
    Medium,
    /// High pressure (0.8 - 0.95)
    High,
    /// Critical pressure (0.95 - 1.0)
    Critical,
}

impl MemoryPressureLevel {
    /// Convert memory pressure ratio to pressure level
    /// 
    /// # Arguments
    /// 
    /// * `pressure` - Memory pressure ratio (0.0 to 1.0)
    /// 
    /// # Returns
    /// 
    /// Returns the corresponding pressure level.
    pub fn from_ratio(pressure: f64) -> Self {
        if pressure < 0.5 {
            Self::Low
        } else if pressure < 0.8 {
            Self::Medium
        } else if pressure < 0.95 {
            Self::High
        } else {
            Self::Critical
        }
    }
    
    /// Get the string representation of the pressure level
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "Low",
            Self::Medium => "Medium",
            Self::High => "High",
            Self::Critical => "Critical",
        }
    }
    
    /// Check if this pressure level requires immediate action
    pub fn requires_action(&self) -> bool {
        matches!(self, Self::High | Self::Critical)
    }
}

/// Configuration validation utilities
pub mod validation {
    use crate::error::{MemoryError, Result};
    
    /// Validate pool capacity
    pub fn validate_pool_capacity(capacity: usize) -> Result<()> {
        if capacity == 0 {
            return Err(MemoryError::InvalidConfiguration {
                parameter: "capacity".to_string(),
                reason: "capacity must be greater than 0".to_string(),
            });
        }
        
        if capacity > 1_000_000 {
            return Err(MemoryError::InvalidConfiguration {
                parameter: "capacity".to_string(),
                reason: "capacity is too large (max: 1,000,000)".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Validate memory size
    pub fn validate_memory_size(size: usize, max_size: usize) -> Result<()> {
        if size > max_size {
            return Err(MemoryError::AllocationTooLarge {
                size,
                max_size,
            });
        }
        
        Ok(())
    }
    
    /// Validate percentage value
    pub fn validate_percentage(value: f64, name: &str) -> Result<()> {
        if value < 0.0 || value > 1.0 {
            return Err(MemoryError::InvalidConfiguration {
                parameter: name.to_string(),
                reason: "value must be between 0.0 and 1.0".to_string(),
            });
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(512), "512.00 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
        assert_eq!(format_bytes(1073741824), "1.00 GB");
    }
    
    #[test]
    fn test_calculate_percentage() {
        assert_eq!(calculate_percentage(0, 100), 0.0);
        assert_eq!(calculate_percentage(50, 100), 50.0);
        assert_eq!(calculate_percentage(100, 100), 100.0);
        assert_eq!(calculate_percentage(100, 0), 0.0); // Edge case
    }
    
    #[test]
    fn test_next_power_of_2() {
        assert_eq!(next_power_of_2(0), 1);
        assert_eq!(next_power_of_2(1), 1);
        assert_eq!(next_power_of_2(2), 2);
        assert_eq!(next_power_of_2(3), 4);
        assert_eq!(next_power_of_2(8), 8);
        assert_eq!(next_power_of_2(9), 16);
    }
    
    #[test]
    fn test_is_power_of_2() {
        assert!(!is_power_of_2(0));
        assert!(is_power_of_2(1));
        assert!(is_power_of_2(2));
        assert!(!is_power_of_2(3));
        assert!(is_power_of_2(4));
        assert!(is_power_of_2(8));
        assert!(!is_power_of_2(9));
    }
    
    #[test]
    fn test_memory_pressure_level() {
        assert_eq!(MemoryPressureLevel::from_ratio(0.3), MemoryPressureLevel::Low);
        assert_eq!(MemoryPressureLevel::from_ratio(0.6), MemoryPressureLevel::Medium);
        assert_eq!(MemoryPressureLevel::from_ratio(0.9), MemoryPressureLevel::High);
        assert_eq!(MemoryPressureLevel::from_ratio(0.98), MemoryPressureLevel::Critical);
        
        assert!(!MemoryPressureLevel::Low.requires_action());
        assert!(!MemoryPressureLevel::Medium.requires_action());
        assert!(MemoryPressureLevel::High.requires_action());
        assert!(MemoryPressureLevel::Critical.requires_action());
    }
}
