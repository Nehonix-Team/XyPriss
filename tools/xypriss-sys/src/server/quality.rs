/**
 * Network Quality Manager
 *
 * This module provides a quality manager for monitoring network conditions.
 * It tracks latency and bandwidth metrics and can reject requests based on
 * poor network conditions.
 *
 * @fileoverview Network quality manager for monitoring network conditions
 * @version 1.0.0
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```rust
 * let quality_manager = QualityManager::new(NetworkQualityConfig {
 *     enabled: true,
 *     reject_on_poor: true,
 *     min_bandwidth: 1000,
 *     max_latency: 100,
 *     check_interval: 1000,
 * });
 * ```
 */
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::collections::VecDeque;
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkQualityConfig {
    pub enabled: bool,
    pub reject_on_poor: bool,
    pub min_bandwidth: usize, // bytes/sec
    pub max_latency: u64,     // ms
    pub check_interval: u64,  // ms
}

pub struct QualityManager {
    config: NetworkQualityConfig,
    pub metrics: Arc<QualityMetrics>,
}

pub struct QualityMetrics {
    latencies: RwLock<VecDeque<u64>>,
    bandwidths: RwLock<VecDeque<usize>>,
    max_samples: usize,
}

impl QualityMetrics {
    pub fn new(max_samples: usize) -> Self {
        Self {
            latencies: RwLock::new(VecDeque::with_capacity(max_samples)),
            bandwidths: RwLock::new(VecDeque::with_capacity(max_samples)),
            max_samples,
        }
    }

    pub fn record_request(&self, latency_ms: u64, bytes: usize, duration_secs: f64) {
        {
            let mut l = self.latencies.write();
            if l.len() >= self.max_samples { l.pop_front(); }
            l.push_back(latency_ms);
        }

        let bandwidth = if duration_secs > 0.0 {
            (bytes as f64 / duration_secs) as usize
        } else {
            0
        };

        if bandwidth > 0 {
            let mut b = self.bandwidths.write();
            if b.len() >= self.max_samples { b.pop_front(); }
            b.push_back(bandwidth);
        }
    }

    pub fn get_average_latency(&self) -> u64 {
        let l = self.latencies.read();
        if l.is_empty() { return 0; }
        l.iter().sum::<u64>() / l.len() as u64
    }

    pub fn get_average_bandwidth(&self) -> usize {
        let b = self.bandwidths.read();
        if b.is_empty() { return 0; }
        b.iter().sum::<usize>() / b.len()
    }
}

impl QualityManager {
    pub fn new(config: NetworkQualityConfig) -> Self {
        Self {
            config,
            metrics: Arc::new(QualityMetrics::new(100)), // Track last 100 requests
        }
    }

    pub fn is_poor(&self) -> bool {
        if !self.config.enabled { return false; }
        
        let avg_lat = self.metrics.get_average_latency();
        let avg_bw = self.metrics.get_average_bandwidth();

        if self.config.max_latency > 0 && avg_lat > self.config.max_latency {
            return true;
        }

        if self.config.min_bandwidth > 0 && avg_bw > 0 && avg_bw < self.config.min_bandwidth {
            return true;
        }

        false
    }

    pub fn record(&self, latency_ms: u64, bytes: usize, duration_secs: f64) {
        if self.config.enabled {
            self.metrics.record_request(latency_ms, bytes, duration_secs);
        }
    }

    pub fn should_reject(&self) -> bool {
        self.config.enabled && self.config.reject_on_poor && self.is_poor()
    }
}
