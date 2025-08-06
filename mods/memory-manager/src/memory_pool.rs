//! # Memory Pool Implementation
//! 
//! This module provides high-performance memory pooling functionality with
//! support for different allocation strategies. Memory pools help reduce
//! allocation overhead and improve cache locality by reusing objects.

use crate::types::{PoolConfig, PoolStrategy, PoolStats, PoolHandle};
use crate::error::{MemoryError, Result};
use parking_lot::RwLock;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, Duration};
use std::sync::Arc;

/// A pooled object with metadata
/// 
/// This structure wraps objects stored in the pool with additional
/// metadata for tracking usage patterns and implementing different
/// allocation strategies.
#[derive(Debug)]
struct PooledObject<T> {
    /// The actual object being pooled
    object: T,
    
    /// When this object was first created
    created_at: SystemTime,
    
    /// When this object was last used
    last_used: SystemTime,
    
    /// How many times this object has been acquired
    usage_count: u64,
    
    /// Unique identifier for this object instance
    id: u64,
}

impl<T> PooledObject<T> {
    fn new(object: T, id: u64) -> Self {
        let now = SystemTime::now();
        Self {
            object,
            created_at: now,
            last_used: now,
            usage_count: 0,
            id,
        }
    }
    
    fn touch(&mut self) {
        self.last_used = SystemTime::now();
        self.usage_count += 1;
    }
    
    fn age(&self) -> Duration {
        SystemTime::now().duration_since(self.created_at).unwrap_or_default()
    }
    
    fn idle_time(&self) -> Duration {
        SystemTime::now().duration_since(self.last_used).unwrap_or_default()
    }
}

/// High-performance memory pool with configurable strategies
/// 
/// The MemoryPool provides efficient object reuse with support for different
/// allocation strategies (LIFO, FIFO, LRU, Random). It's thread-safe and
/// includes comprehensive statistics collection.
/// 
/// # Type Parameters
/// 
/// * `T` - The type of objects to be pooled
/// 
/// # Examples
/// 
/// ```rust
/// use xypriss_memory_manager::{MemoryPool, PoolConfig, PoolStrategy};
/// 
/// // Create a pool configuration
/// let config = PoolConfig {
///     name: "string_pool".to_string(),
///     capacity: 100,
///     strategy: PoolStrategy::LIFO,
///     ..Default::default()
/// };
/// 
/// // Create the pool with a factory function
/// let pool = MemoryPool::new(config, || String::new())?;
/// 
/// // Acquire an object from the pool
/// let mut obj = pool.acquire()?;
/// obj.push_str("Hello, World!");
/// 
/// // Return the object to the pool
/// pool.release(obj)?;
/// ```
pub struct MemoryPool<T> {
    /// Pool configuration
    config: PoolConfig,
    
    /// Storage for pooled objects
    /// Using RwLock for concurrent access - readers can access simultaneously,
    /// writers get exclusive access
    objects: RwLock<VecDeque<PooledObject<T>>>,
    
    /// Factory function for creating new objects
    factory: Box<dyn Fn() -> T + Send + Sync>,
    
    /// Reset function for cleaning objects before returning to pool
    reset_fn: Option<Box<dyn Fn(&mut T) + Send + Sync>>,
    
    /// Statistics tracking
    stats: Arc<RwLock<PoolStats>>,
    
    /// Unique object ID counter
    next_object_id: AtomicU64,
    
    /// Pool handle for external reference
    handle: PoolHandle,
}

impl<T> MemoryPool<T>
where
    T: Send + 'static,
{
    /// Create a new memory pool with the specified configuration
    /// 
    /// # Arguments
    /// 
    /// * `config` - Pool configuration parameters
    /// * `factory` - Function to create new objects when pool is empty
    /// 
    /// # Returns
    /// 
    /// Returns a new MemoryPool instance or an error if configuration is invalid.
    pub fn new<F>(config: PoolConfig, factory: F) -> Result<Self>
    where
        F: Fn() -> T + Send + Sync + 'static,
    {
        // Validate configuration
        if config.capacity == 0 {
            return Err(MemoryError::InvalidConfiguration {
                parameter: "capacity".to_string(),
                reason: "capacity must be greater than 0".to_string(),
            });
        }
        
        let handle = PoolHandle(rand::random());
        let stats = Arc::new(RwLock::new(PoolStats {
            name: config.name.clone(),
            current_size: 0,
            capacity: config.capacity,
            total_acquisitions: 0,
            total_returns: 0,
            cache_hits: 0,
            cache_misses: 0,
            hit_ratio: 0.0,
            avg_lifetime_ms: 0,
            created_at: SystemTime::now(),
            collected_at: SystemTime::now(),
        }));
        
        let pool = Self {
            config,
            objects: RwLock::new(VecDeque::with_capacity(config.capacity)),
            factory: Box::new(factory),
            reset_fn: None,
            stats,
            next_object_id: AtomicU64::new(1),
            handle,
        };
        
        // Pre-allocate objects if requested
        if pool.config.pre_allocate {
            pool.pre_allocate_objects()?;
        }
        
        log::info!("Created memory pool '{}' with capacity {}", 
                  pool.config.name, pool.config.capacity);
        
        Ok(pool)
    }
    
    /// Set a reset function for cleaning objects before returning to pool
    /// 
    /// The reset function is called on each object before it's returned to
    /// the pool, allowing you to clean up any state and prepare it for reuse.
    /// 
    /// # Arguments
    /// 
    /// * `reset_fn` - Function to reset object state
    pub fn with_reset<F>(mut self, reset_fn: F) -> Self
    where
        F: Fn(&mut T) + Send + Sync + 'static,
    {
        self.reset_fn = Some(Box::new(reset_fn));
        self
    }
    
    /// Acquire an object from the pool
    /// 
    /// This method attempts to reuse an existing object from the pool.
    /// If no objects are available, it creates a new one using the factory function.
    /// 
    /// # Returns
    /// 
    /// Returns an object of type T, either reused from the pool or newly created.
    pub fn acquire(&self) -> Result<T> {
        let mut stats = self.stats.write();
        stats.total_acquisitions += 1;
        
        // Try to get an object from the pool based on strategy
        if let Some(pooled_obj) = self.get_object_by_strategy()? {
            stats.cache_hits += 1;
            stats.hit_ratio = stats.cache_hits as f64 / stats.total_acquisitions as f64;
            
            log::debug!("Pool '{}': cache hit, reusing object {}", 
                       self.config.name, pooled_obj.id);
            
            return Ok(pooled_obj.object);
        }
        
        // Pool is empty, create new object
        stats.cache_misses += 1;
        stats.hit_ratio = stats.cache_hits as f64 / stats.total_acquisitions as f64;
        
        let new_object = (self.factory)();
        
        log::debug!("Pool '{}': cache miss, created new object", self.config.name);
        
        Ok(new_object)
    }
    
    /// Return an object to the pool
    /// 
    /// This method returns an object to the pool for future reuse.
    /// The object will be reset (if a reset function is provided) and
    /// stored according to the pool's allocation strategy.
    /// 
    /// # Arguments
    /// 
    /// * `mut object` - The object to return to the pool
    /// 
    /// # Returns
    /// 
    /// Returns Ok(()) if successful, or an error if the pool is full or
    /// the reset function fails.
    pub fn release(&self, mut object: T) -> Result<()> {
        let mut stats = self.stats.write();
        stats.total_returns += 1;
        
        // Check if pool is at capacity
        {
            let objects = self.objects.read();
            if objects.len() >= self.config.capacity {
                log::debug!("Pool '{}': at capacity, discarding object", self.config.name);
                return Ok(()); // Silently discard if pool is full
            }
        }
        
        // Reset the object if reset function is provided
        if let Some(ref reset_fn) = self.reset_fn {
            reset_fn(&mut object);
        }
        
        // Create pooled object wrapper
        let object_id = self.next_object_id.fetch_add(1, Ordering::Relaxed);
        let pooled_obj = PooledObject::new(object, object_id);
        
        // Add to pool based on strategy
        self.add_object_by_strategy(pooled_obj)?;
        
        // Update stats
        {
            let objects = self.objects.read();
            stats.current_size = objects.len();
        }
        
        log::debug!("Pool '{}': returned object {}, pool size: {}", 
                   self.config.name, object_id, stats.current_size);
        
        Ok(())
    }
    
    /// Get current pool statistics
    /// 
    /// Returns a snapshot of the current pool statistics including
    /// hit ratios, object counts, and performance metrics.
    pub fn get_stats(&self) -> PoolStats {
        let mut stats = self.stats.write();
        stats.collected_at = SystemTime::now();
        
        // Update current size
        {
            let objects = self.objects.read();
            stats.current_size = objects.len();
        }
        
        stats.clone()
    }
    
    /// Get the pool handle
    /// 
    /// Returns the unique handle for this pool, which can be used
    /// for external references and FFI operations.
    pub fn handle(&self) -> PoolHandle {
        self.handle
    }
    
    /// Clear all objects from the pool
    /// 
    /// Removes all objects from the pool, effectively resetting it to
    /// an empty state. This can be useful for cleanup or when changing
    /// pool configuration.
    pub fn clear(&self) -> Result<()> {
        let mut objects = self.objects.write();
        let cleared_count = objects.len();
        objects.clear();
        
        // Update stats
        {
            let mut stats = self.stats.write();
            stats.current_size = 0;
        }
        
        log::info!("Pool '{}': cleared {} objects", self.config.name, cleared_count);
        
        Ok(())
    }
    
    /// Perform cleanup of old or idle objects
    /// 
    /// Removes objects that exceed the configured maximum age or idle time.
    /// This helps prevent memory leaks and ensures objects don't become stale.
    /// 
    /// # Returns
    /// 
    /// Returns the number of objects that were cleaned up.
    pub fn cleanup(&self) -> Result<usize> {
        let mut objects = self.objects.write();
        let initial_size = objects.len();
        
        // Remove objects that are too old or have been idle too long
        objects.retain(|obj| {
            let should_keep = self.should_keep_object(obj);
            if !should_keep {
                log::debug!("Pool '{}': cleaning up object {} (age: {:?}, idle: {:?})",
                           self.config.name, obj.id, obj.age(), obj.idle_time());
            }
            should_keep
        });
        
        let cleaned_count = initial_size - objects.len();
        
        // Update stats
        {
            let mut stats = self.stats.write();
            stats.current_size = objects.len();
        }
        
        if cleaned_count > 0 {
            log::info!("Pool '{}': cleaned up {} objects", self.config.name, cleaned_count);
        }
        
        Ok(cleaned_count)
    }

    // Private helper methods

    /// Pre-allocate objects to fill the pool
    fn pre_allocate_objects(&self) -> Result<()> {
        let mut objects = self.objects.write();

        for i in 0..self.config.capacity {
            let object = (self.factory)();
            let object_id = self.next_object_id.fetch_add(1, Ordering::Relaxed);
            let pooled_obj = PooledObject::new(object, object_id);
            objects.push_back(pooled_obj);
        }

        log::info!("Pool '{}': pre-allocated {} objects",
                  self.config.name, self.config.capacity);

        Ok(())
    }

    /// Get an object from the pool based on the configured strategy
    fn get_object_by_strategy(&self) -> Result<Option<PooledObject<T>>> {
        let mut objects = self.objects.write();

        if objects.is_empty() {
            return Ok(None);
        }

        let mut selected_obj = match self.config.strategy {
            PoolStrategy::LIFO => {
                // Last In, First Out - take from back
                objects.pop_back()
            }
            PoolStrategy::FIFO => {
                // First In, First Out - take from front
                objects.pop_front()
            }
            PoolStrategy::LRU => {
                // Least Recently Used - find object with oldest last_used time
                let mut oldest_index = 0;
                let mut oldest_time = objects[0].last_used;

                for (i, obj) in objects.iter().enumerate() {
                    if obj.last_used < oldest_time {
                        oldest_time = obj.last_used;
                        oldest_index = i;
                    }
                }

                objects.remove(oldest_index)
            }
            PoolStrategy::Random => {
                // Random selection
                let index = rand::random::<usize>() % objects.len();
                objects.remove(index)
            }
        };

        // Update object metadata
        if let Some(ref mut obj) = selected_obj {
            obj.touch();
        }

        Ok(selected_obj)
    }

    /// Add an object to the pool based on the configured strategy
    fn add_object_by_strategy(&self, pooled_obj: PooledObject<T>) -> Result<()> {
        let mut objects = self.objects.write();

        match self.config.strategy {
            PoolStrategy::LIFO => {
                // Add to back for LIFO
                objects.push_back(pooled_obj);
            }
            PoolStrategy::FIFO => {
                // Add to back for FIFO (remove from front)
                objects.push_back(pooled_obj);
            }
            PoolStrategy::LRU => {
                // For LRU, add to back (most recently used)
                objects.push_back(pooled_obj);
            }
            PoolStrategy::Random => {
                // For random, position doesn't matter
                objects.push_back(pooled_obj);
            }
        }

        Ok(())
    }

    /// Check if an object should be kept in the pool
    fn should_keep_object(&self, obj: &PooledObject<T>) -> bool {
        // Check maximum age
        if let Some(max_age_seconds) = self.config.max_age_seconds {
            if obj.age().as_secs() > max_age_seconds {
                return false;
            }
        }

        // Check maximum idle time
        if let Some(max_idle_seconds) = self.config.max_idle_seconds {
            if obj.idle_time().as_secs() > max_idle_seconds {
                return false;
            }
        }

        true
    }
}

// We need to add rand dependency for random strategy
use rand;

impl<T> Drop for MemoryPool<T> {
    fn drop(&mut self) {
        log::info!("Dropping memory pool '{}'", self.config.name);
    }
}

// Thread safety: MemoryPool is Send + Sync because:
// - All internal data is protected by RwLock
// - Factory and reset functions are required to be Send + Sync
// - AtomicU64 is Send + Sync
unsafe impl<T: Send> Send for MemoryPool<T> {}
unsafe impl<T: Send> Sync for MemoryPool<T> {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::PoolStrategy;

    #[test]
    fn test_pool_creation() {
        let config = PoolConfig {
            name: "test_pool".to_string(),
            capacity: 10,
            strategy: PoolStrategy::LIFO,
            ..Default::default()
        };

        let pool = MemoryPool::new(config, || String::new()).unwrap();
        let stats = pool.get_stats();

        assert_eq!(stats.name, "test_pool");
        assert_eq!(stats.capacity, 10);
        assert_eq!(stats.current_size, 0);
    }

    #[test]
    fn test_acquire_and_release() {
        let config = PoolConfig {
            name: "test_pool".to_string(),
            capacity: 5,
            strategy: PoolStrategy::LIFO,
            ..Default::default()
        };

        let pool = MemoryPool::new(config, || String::new()).unwrap();

        // Acquire an object
        let obj = pool.acquire().unwrap();
        assert_eq!(obj, String::new());

        // Release it back
        pool.release(obj).unwrap();

        let stats = pool.get_stats();
        assert_eq!(stats.current_size, 1);
        assert_eq!(stats.total_acquisitions, 1);
        assert_eq!(stats.total_returns, 1);
    }

    #[test]
    fn test_pool_strategies() {
        for strategy in [PoolStrategy::LIFO, PoolStrategy::FIFO, PoolStrategy::LRU, PoolStrategy::Random] {
            let config = PoolConfig {
                name: format!("test_pool_{:?}", strategy),
                capacity: 3,
                strategy,
                ..Default::default()
            };

            let pool = MemoryPool::new(config, || String::new()).unwrap();

            // Fill the pool
            for i in 0..3 {
                let mut obj = pool.acquire().unwrap();
                obj.push_str(&format!("item_{}", i));
                pool.release(obj).unwrap();
            }

            let stats = pool.get_stats();
            assert_eq!(stats.current_size, 3);
        }
    }
}
