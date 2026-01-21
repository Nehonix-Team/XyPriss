use std::sync::atomic::{AtomicUsize, AtomicU64, Ordering};
use std::time::Duration;
use std::sync::Arc;

pub struct DynamicConfig {
    /// Current max concurrency (changes dynamically)
    pub concurrency: AtomicUsize,
    /// Base timeout in seconds
    pub timeout_secs: AtomicU64,
    /// Average latency observed (in milliseconds)
    pub avg_latency_ms: AtomicU64,
    /// Performance history to adjust values
    pub total_requests: AtomicU64,
    pub total_errors: AtomicU64,
}

impl DynamicConfig {
    pub fn new() -> Self {
        Self {
            concurrency: AtomicUsize::new(2), // Start at the floor
            timeout_secs: AtomicU64::new(120), // 2 minutes base timeout
            avg_latency_ms: AtomicU64::new(2000),
            total_requests: AtomicU64::new(0),
            total_errors: AtomicU64::new(0),
        }
    }

    /// Record a request execution time and adjust settings
    pub fn record_request(&self, duration: Duration, is_error: bool) {
        let ms = duration.as_millis() as u64;
        self.total_requests.fetch_add(1, Ordering::Relaxed);
        
        if is_error {
            self.total_errors.fetch_add(1, Ordering::Relaxed);
            let current = self.concurrency.load(Ordering::Relaxed);
            if current > 1 {
                self.concurrency.store(1, Ordering::Relaxed); // Drop to 1 on error to clear the pipe
            }
            let current_timeout = self.timeout_secs.load(Ordering::Relaxed);
            if current_timeout < 300 {
                self.timeout_secs.store(current_timeout + 30, Ordering::Relaxed);
            }
        } else {
            let prev_avg = self.avg_latency_ms.load(Ordering::Relaxed);
            let new_avg = (prev_avg * 7 + ms) / 8;
            self.avg_latency_ms.store(new_avg, Ordering::Relaxed);

            let current = self.concurrency.load(Ordering::Relaxed);
            if ms < 500 && current < 64 {
                self.concurrency.fetch_add(2, Ordering::Relaxed);
            } else if ms < 1500 && current < 16 {
                self.concurrency.fetch_add(1, Ordering::Relaxed);
            } else if ms > 8000 && current > 1 {
                // EXTREME SLOWDOWN: If a single JSON takes > 8s, drop to 1-2 connections
                self.concurrency.store(1, Ordering::Relaxed);
            } else if ms > 4000 && current > 2 {
                self.concurrency.store(2, Ordering::Relaxed);
            }
        }
    }

    pub fn get_concurrency(&self) -> usize {
        let latency = self.avg_latency_ms.load(Ordering::Relaxed);
        let current = self.concurrency.load(Ordering::Relaxed);
        
        if latency > 6000 {
            current.min(1) // Single file at a time if the pipe is that thin
        } else if latency > 3000 {
            current.min(2)
        } else if latency > 1500 {
            current.min(4)
        } else {
            current.min(64)
        }.max(1)
    }

    pub fn get_timeout(&self, attempt: u32) -> Duration {
        let base = self.timeout_secs.load(Ordering::Relaxed);
        // Be significantly more patient on each retry
        let patience_factor = 1 + (attempt as u64 * 2);
        Duration::from_secs(base * patience_factor)
    }
}

pub type GlobalConfig = Arc<DynamicConfig>;
