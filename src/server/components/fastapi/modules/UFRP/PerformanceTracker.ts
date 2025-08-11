/**
 * XyPrissJS - Performance Tracker Module
 * Tracks performance metrics using existing PerformanceMonitor
 */

import { PerformanceMonitor } from "../../../../optimization/performance-monitor";
import { PerformanceConfig, PerformanceStats } from "./types/PerformanceTypes";
 
export class PerformanceTracker {
    private monitor: PerformanceMonitor;
    private config: PerformanceConfig;
    private stats: PerformanceStats;

    constructor(config: PerformanceConfig) {
        this.config = config;
        this.stats = {
            requests: {
                total: 0,
                avgResponseTime: 0,
                totalResponseTime: 0,
            },
            system: {},
            alerts: [],
        };

        this.monitor = new PerformanceMonitor({
            enabled: config.enabled,
            metrics: config.metrics,
            interval: config.interval,
            alerts: config.alerts,
        });
    }

    recordMetric(name: string, value: number): void {
        // Use the monitor's middleware to record metrics
        const req = { method: "GET", path: "/metrics" };
        const res = {
            statusCode: 200,
            set: () => {},
            on: (event: string, callback: () => void) => {
                if (event === "finish") {
                    callback();
                }
            },
        };
        const next = () => {};
        this.monitor.getMiddleware()(req, res, next);
    }

    getStats(): PerformanceStats {
        const metrics = this.monitor.getMetrics();
        return {
            requests: {
                total: metrics.requests.total,
                avgResponseTime: metrics.responses.average,
                totalResponseTime:
                    metrics.responses.average * metrics.requests.total,
            },
            system: metrics,
            alerts: metrics.alerts || [],
        };
    }

    updateConfig(newConfig: Partial<PerformanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
        // Create a new monitor instance with updated config
        this.monitor = new PerformanceMonitor({
            enabled: this.config.enabled,
            metrics: this.config.metrics,
            interval: this.config.interval,
            alerts: this.config.alerts,
        });
    }

    getHealthStatus(): any {
        return this.monitor.getHealthStatus();
    }

    stop(): void {
        this.monitor.stop();
    }
}

