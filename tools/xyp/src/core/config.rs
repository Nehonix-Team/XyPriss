use std::sync::atomic::{AtomicUsize, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use parking_lot::RwLock;
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
            concurrency: AtomicUsize::new(16), // Start conservative
            timeout_secs: AtomicU64::new(30),
            avg_latency_ms: AtomicU64::new(500),
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
            // On error, immediately reduce concurrency to relieve pressure
            let current = self.concurrency.load(Ordering::Relaxed);
            if current > 4 {
                self.concurrency.store(current - 2, Ordering::Relaxed);
            }
            // Increase timeout
            let current_timeout = self.timeout_secs.load(Ordering::Relaxed);
            if current_timeout < 120 {
                self.timeout_secs.store(current_timeout + 5, Ordering::Relaxed);
            }
        } else {
            // Update average latency (moving average)
            let prev_avg = self.avg_latency_ms.load(Ordering::Relaxed);
            let new_avg = (prev_avg * 9 + ms) / 10;
            self.avg_latency_ms.store(new_avg, Ordering::Relaxed);

            // If network is fast (< 500ms), increase concurrency slowly
            if ms < 800 {
                let current = self.concurrency.load(Ordering::Relaxed);
                if current < 64 {
                    self.concurrency.fetch_add(1, Ordering::Relaxed);
                }
            } else if ms > 5000 {
                // If network is very slow (> 5s), reduce concurrency
                let current = self.concurrency.load(Ordering::Relaxed);
                if current > 8 {
                    self.concurrency.store(current - 1, Ordering::Relaxed);
                }
            }
        }
    }

    pub fn get_concurrency(&self) -> usize {
        self.concurrency.load(Ordering::Relaxed)
    }

    pub fn get_timeout(&self) -> Duration {
        Duration::from_secs(self.timeout_secs.load(Ordering::Relaxed))
    }
}

pub type GlobalConfig = Arc<DynamicConfig>;
