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
            concurrency: AtomicUsize::new(32), // Start at 32 (faster for modern connections)
            timeout_secs: AtomicU64::new(15), // Reduced for faster failover/retries
            avg_latency_ms: AtomicU64::new(500), // assume good latency initially
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
            // On error, back off but not too much if it was a timeout
            if current > 8 {
                self.concurrency.store(current / 2, Ordering::Relaxed);
            }
        } else {
            let prev_avg = self.avg_latency_ms.load(Ordering::Relaxed);
            let new_avg = (prev_avg * 7 + ms) / 8; 
            self.avg_latency_ms.store(new_avg, Ordering::Relaxed);

            let current = self.concurrency.load(Ordering::Relaxed);
            // Aggressive ramp up: if it works, try more.
            // Even if it's "slow" (e.g. 1s), we want MORE concurrency to hide that 1s.
            if current < 512 {
                if ms < 200 {
                    self.concurrency.fetch_add(16, Ordering::Relaxed);
                } else if ms < 1000 {
                    self.concurrency.fetch_add(8, Ordering::Relaxed);
                } else {
                    self.concurrency.fetch_add(2, Ordering::Relaxed);
                }
            }
        }
    }

    pub fn get_concurrency(&self) -> usize {
        let latency = self.avg_latency_ms.load(Ordering::Relaxed);
        let current = self.concurrency.load(Ordering::Relaxed);
        
        // Even on slow networks, metadata (small JSON) benefits from high concurrency
        // to hide Round-Trip Time (RTT).
        if latency > 5000 {
            current.min(16) // Extreme latency: still allow some parallelism
        } else if latency > 2000 {
            current.min(32)
        } else if latency > 1000 {
            current.min(64)
        } else if latency > 500 {
            current.min(96)
        } else {
            current.min(128) // Cap metadata concurrency at 128 even on fast networks
        }.max(8)
    }

    pub fn get_timeout(&self, attempt: u32) -> Duration {
        let base = self.timeout_secs.load(Ordering::Relaxed);
        // Be significantly more patient on each retry
        let patience_factor = 1 + (attempt as u64 * 2);
        Duration::from_secs(base * patience_factor)
    }
}

pub type GlobalConfig = Arc<DynamicConfig>;
