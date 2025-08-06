//! # Error Handling
//! 
//! This module provides comprehensive error handling for the XyPriss Memory Manager (XyPMM).
//! It defines all possible error conditions and provides utilities for error
//! reporting and recovery.

use thiserror::Error;
use std::fmt;

/// Result type alias for memory manager operations
/// 
/// This is a convenience type alias that uses our custom MemoryError
/// as the error type. Most functions in this crate return this type.
pub type Result<T> = std::result::Result<T, MemoryError>;

/// Comprehensive error types for memory management operations
/// 
/// This enum covers all possible error conditions that can occur during
/// memory management operations. Each variant includes relevant context
/// information to help with debugging and error recovery.
#[derive(Error, Debug, Clone)]
pub enum MemoryError {
    /// Pool-related errors
    #[error("Pool error: {message}")]
    PoolError { message: String },
    
    /// Pool with the specified name already exists
    #[error("Pool '{name}' already exists")]
    PoolAlreadyExists { name: String },
    
    /// Pool with the specified name was not found
    #[error("Pool '{name}' not found")]
    PoolNotFound { name: String },
    
    /// Pool has reached its maximum capacity
    #[error("Pool '{name}' is at maximum capacity ({capacity})")]
    PoolCapacityExceeded { name: String, capacity: usize },
    
    /// Pool is empty when trying to acquire an object
    #[error("Pool '{name}' is empty")]
    PoolEmpty { name: String },
    
    /// Allocation tracking errors
    #[error("Allocation error: {message}")]
    AllocationError { message: String },
    
    /// Allocation with the specified ID was not found
    #[error("Allocation with ID {id} not found")]
    AllocationNotFound { id: u64 },
    
    /// Allocation size exceeds the maximum allowed size
    #[error("Allocation size {size} exceeds maximum allowed size {max_size}")]
    AllocationTooLarge { size: usize, max_size: usize },
    
    /// Memory limit has been exceeded
    #[error("Memory limit exceeded: current {current} bytes, limit {limit} bytes")]
    MemoryLimitExceeded { current: usize, limit: usize },
    
    /// Garbage collection errors
    #[error("Garbage collection error: {message}")]
    GarbageCollectionError { message: String },
    
    /// GC cycle took too long to complete
    #[error("Garbage collection timeout: took {actual_ms}ms, limit {limit_ms}ms")]
    GarbageCollectionTimeout { actual_ms: u64, limit_ms: u64 },
    
    /// Configuration errors
    #[error("Configuration error: {message}")]
    ConfigurationError { message: String },
    
    /// Invalid configuration parameter
    #[error("Invalid configuration parameter '{parameter}': {reason}")]
    InvalidConfiguration { parameter: String, reason: String },
    
    /// Initialization errors
    #[error("Initialization error: {message}")]
    InitializationError { message: String },
    
    /// Memory manager has already been initialized
    #[error("Memory manager has already been initialized")]
    AlreadyInitialized,
    
    /// Memory manager has not been initialized
    #[error("Memory manager has not been initialized")]
    NotInitialized,
    
    /// Thread synchronization errors
    #[error("Synchronization error: {message}")]
    SynchronizationError { message: String },
    
    /// Lock acquisition failed
    #[error("Failed to acquire lock: {resource}")]
    LockError { resource: String },
    
    /// Serialization/deserialization errors
    #[error("Serialization error: {message}")]
    SerializationError { message: String },
    
    /// JSON parsing error
    #[error("JSON error: {source}")]
    JsonError {
        #[from]
        source: serde_json::Error,
    },
    
    /// I/O errors
    #[error("I/O error: {source}")]
    IoError {
        #[from]
        source: std::io::Error,
    },
    
    /// System-level errors
    #[error("System error: {message}")]
    SystemError { message: String },
    
    /// Out of memory condition
    #[error("Out of memory: failed to allocate {requested} bytes")]
    OutOfMemory { requested: usize },
    
    /// Invalid handle provided
    #[error("Invalid handle: {handle_type} with ID {id}")]
    InvalidHandle { handle_type: String, id: u64 },
    
    /// Operation not supported
    #[error("Operation not supported: {operation}")]
    NotSupported { operation: String },
    
    /// Internal error (should not happen in normal operation)
    #[error("Internal error: {message}")]
    InternalError { message: String },
}

impl MemoryError {
    /// Create a new pool error
    pub fn pool_error<S: Into<String>>(message: S) -> Self {
        Self::PoolError {
            message: message.into(),
        }
    }
    
    /// Create a new allocation error
    pub fn allocation_error<S: Into<String>>(message: S) -> Self {
        Self::AllocationError {
            message: message.into(),
        }
    }
    
    /// Create a new garbage collection error
    pub fn gc_error<S: Into<String>>(message: S) -> Self {
        Self::GarbageCollectionError {
            message: message.into(),
        }
    }
    
    /// Create a new configuration error
    pub fn config_error<S: Into<String>>(message: S) -> Self {
        Self::ConfigurationError {
            message: message.into(),
        }
    }
    
    /// Create a new initialization error
    pub fn init_error<S: Into<String>>(message: S) -> Self {
        Self::InitializationError {
            message: message.into(),
        }
    }
    
    /// Create a new synchronization error
    pub fn sync_error<S: Into<String>>(message: S) -> Self {
        Self::SynchronizationError {
            message: message.into(),
        }
    }
    
    /// Create a new system error
    pub fn system_error<S: Into<String>>(message: S) -> Self {
        Self::SystemError {
            message: message.into(),
        }
    }
    
    /// Create a new internal error
    pub fn internal_error<S: Into<String>>(message: S) -> Self {
        Self::InternalError {
            message: message.into(),
        }
    } 
     
    /// Check if this error is recoverable
    /// 
    /// Some errors indicate temporary conditions that might resolve themselves,
    /// while others indicate permanent failures that require intervention.
    pub fn is_recoverable(&self) -> bool {
        match self {
            // Temporary conditions that might resolve
            Self::PoolEmpty { .. } => true,
            Self::PoolCapacityExceeded { .. } => true,
            Self::MemoryLimitExceeded { .. } => true,
            Self::GarbageCollectionTimeout { .. } => true,
            Self::LockError { .. } => true,
            Self::OutOfMemory { .. } => true,
            
            // Permanent failures
            Self::PoolNotFound { .. } => false,
            Self::AllocationNotFound { .. } => false,
            Self::InvalidConfiguration { .. } => false,
            Self::AlreadyInitialized => false,
            Self::NotInitialized => false,
            Self::InvalidHandle { .. } => false,
            Self::NotSupported { .. } => false,
            Self::InternalError { .. } => false,
            
            // Other errors might be recoverable depending on context
            _ => false,
        }
    }
    
    /// Get the error category
    /// 
    /// Categorizes errors for easier handling and reporting.
    pub fn category(&self) -> ErrorCategory {
        match self {
            Self::PoolError { .. }
            | Self::PoolAlreadyExists { .. }
            | Self::PoolNotFound { .. }
            | Self::PoolCapacityExceeded { .. }
            | Self::PoolEmpty { .. } => ErrorCategory::Pool,
            
            Self::AllocationError { .. }
            | Self::AllocationNotFound { .. } 
            | Self::AllocationTooLarge { .. }
            | Self::MemoryLimitExceeded { .. }
            | Self::OutOfMemory { .. } => ErrorCategory::Allocation,
            
            Self::GarbageCollectionError { .. }
            | Self::GarbageCollectionTimeout { .. } => ErrorCategory::GarbageCollection,
            
            Self::ConfigurationError { .. }
            | Self::InvalidConfiguration { .. } => ErrorCategory::Configuration,
            
            Self::InitializationError { .. }
            | Self::AlreadyInitialized
            | Self::NotInitialized => ErrorCategory::Initialization,
            
            Self::SynchronizationError { .. }
            | Self::LockError { .. } => ErrorCategory::Synchronization,
            
            Self::SerializationError { .. }
            | Self::JsonError { .. } => ErrorCategory::Serialization,
            
            Self::IoError { .. } => ErrorCategory::IO,
            
            Self::SystemError { .. } => ErrorCategory::System,
            
            Self::InvalidHandle { .. }
            | Self::NotSupported { .. }
            | Self::InternalError { .. } => ErrorCategory::Internal,
        }
    }
}

/// Error categories for easier error handling
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCategory {
    Pool,
    Allocation,
    GarbageCollection,
    Configuration,
    Initialization,
    Synchronization,
    Serialization,
    IO,
    System,
    Internal,
}

impl fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pool => write!(f, "Pool"),
            Self::Allocation => write!(f, "Allocation"),
            Self::GarbageCollection => write!(f, "GarbageCollection"),
            Self::Configuration => write!(f, "Configuration"),
            Self::Initialization => write!(f, "Initialization"),
            Self::Synchronization => write!(f, "Synchronization"),
            Self::Serialization => write!(f, "Serialization"),
            Self::IO => write!(f, "IO"),
            Self::System => write!(f, "System"),
            Self::Internal => write!(f, "Internal"),
        }
    }
}
