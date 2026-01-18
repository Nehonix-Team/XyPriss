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
            concurrency: AtomicUsize::new(2), // Ultra-conservative Slow Start
            timeout_secs: AtomicU64::new(90), // High timeout for heavy metadata
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
            // On error, immediately drop concurrency to minimum safety level
            let current = self.concurrency.load(Ordering::Relaxed);
            if current > 2 {
                self.concurrency.store(current / 2, Ordering::Relaxed);
            }
            // Increase timeout significantly on failure
            let current_timeout = self.timeout_secs.load(Ordering::Relaxed);
            if current_timeout < 180 {
                self.timeout_secs.store(current_timeout + 15, Ordering::Relaxed);
            }
        } else {
            // Update average latency (moving average)
            let prev_avg = self.avg_latency_ms.load(Ordering::Relaxed);
            let new_avg = (prev_avg * 7 + ms) / 8;
            self.avg_latency_ms.store(new_avg, Ordering::Relaxed);

            // Adaptive Concurrency Control
            let current = self.concurrency.load(Ordering::Relaxed);
            if ms < 400 && current < 64 {
                // Network is blazing fast, speed up
                self.concurrency.fetch_add(2, Ordering::Relaxed);
            } else if ms < 1000 && current < 32 {
                // Network is good, speed up slowly
                self.concurrency.fetch_add(1, Ordering::Relaxed);
            } else if ms > 3000 && current > 4 {
                // Network is struggling, slow down
                self.concurrency.store(current - 1, Ordering::Relaxed);
            }
            
            // If latency is getting better, we can slightly reduce timeout
            let current_timeout = self.timeout_secs.load(Ordering::Relaxed);
            if ms < 2000 && current_timeout > 30 {
                // Don't reduce too fast to avoid oscillations
                if self.total_requests.load(Ordering::Relaxed) % 10 == 0 {
                    self.timeout_secs.fetch_sub(1, Ordering::Relaxed);
                }
            }
        }
    }

    pub fn get_concurrency(&self) -> usize {
        let latency = self.avg_latency_ms.load(Ordering::Relaxed);
        let current = self.concurrency.load(Ordering::Relaxed);
        
        // SAFETY CAP: On a slow network, NEVER go high regardless of success
        if latency > 3000 {
            current.min(4)
        } else if latency > 1500 {
            current.min(8)
        } else if latency > 800 {
            current.min(16)
        } else {
            current.min(64)
        }.max(1)
    }

    pub fn get_timeout(&self, attempt: u32) -> Duration {
        let base = self.timeout_secs.load(Ordering::Relaxed);
        // On retry, exponentially increase patience
        let patience_factor = 1 + (attempt as u64);
        Duration::from_secs(base * patience_factor)
    }
}

pub type GlobalConfig = Arc<DynamicConfig>;
