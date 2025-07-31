/**
 * XyPrissJS - Metrics Collector Module
 * Aggregates and manages metrics from all UFRP modules
 */

import { CacheStats } from "./types/CacheTypes";
import { PerformanceStats } from "./types/PerformanceTypes";
import { SecurityStats } from "./types/SecurityTypes";
import { TaskStats } from "./types/TaskTypes";
import { WorkerStats } from "./types/WorkerTypes";
import { AggregatedMetrics, MetricsConfig } from "./types/MetricsTypes";

export class MetricsCollector {
    private config: MetricsConfig;
    private metricsHistory: AggregatedMetrics[] = [];
    private collectionInterval?: NodeJS.Timeout;
    private alertCallbacks: ((alert: any) => void)[] = [];

    constructor(config: Partial<MetricsConfig> = {}) {
        this.config = {
            enabled: true,
            collectionInterval: 60000, // 1 minute
            retentionPeriod: 3600000, // 1 hour
            alertThresholds: {
                errorRate: 5, // 5%
                responseTime: 1000, // 1 second
                memoryUsage: 90, // 90%
                cpuUsage: 80, // 80%
            },
            ...config,
        };

        if (this.config.enabled) {
            this.startCollection();
        }
    }

    private startCollection(): void {
        this.collectionInterval = setInterval(() => {
            this.cleanupOldMetrics();
        }, Math.min(this.config.collectionInterval, 60000)); // At least every minute
    }

    collectMetrics(
        cache: CacheStats,
        performance: PerformanceStats,
        security: SecurityStats,
        tasks: TaskStats,
        workers: WorkerStats
    ): void {
        if (!this.config.enabled) return;

        const metrics: AggregatedMetrics = {
            timestamp: Date.now(),
            cache,
            performance,
            security,
            tasks,
            workers,
            system: this.collectSystemMetrics(),
        };

        this.metricsHistory.push(metrics);
        this.checkAlerts(metrics);
    }

    private collectSystemMetrics() {
        const os = require("os");
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        return {
            uptime: os.uptime(),
            memory: {
                total: totalMemory,
                used: usedMemory,
                free: freeMemory,
            },
            cpu: {
                usage: this.calculateCPUUsage(),
                cores: os.cpus().length,
            },
        };
    }

    private calculateCPUUsage(): number {
        const os = require("os");
        const cpus = os.cpus();

        interface CPUAccumulator {
            idle: number;
            total: number;
        }

        interface CPUTimes {
            idle: number;
            user: number;
            nice: number;
            sys: number;
            irq: number;
        }

        const totalCPU = cpus.reduce(
            (acc: CPUAccumulator, cpu: { times: CPUTimes }) => {
                acc.idle += cpu.times.idle;
                acc.total += Object.values(cpu.times).reduce(
                    (a: number, b: number) => a + b,
                    0
                );
                return acc;
            },
            { idle: 0, total: 0 }
        );

        return (1 - totalCPU.idle / totalCPU.total) * 100;
    }

    private checkAlerts(metrics: AggregatedMetrics): void {
        const alerts = [];

        // Check error rate
        const errorRate =
            (metrics.security.blockedRequests /
                metrics.security.totalRequests) *
            100;
        if (errorRate > this.config.alertThresholds.errorRate) {
            alerts.push({
                type: "ERROR_RATE",
                message: `High error rate detected: ${errorRate.toFixed(2)}%`,
                value: errorRate,
                threshold: this.config.alertThresholds.errorRate,
            });
        }

        // Check response time
        if (
            metrics.performance.requests.avgResponseTime >
            this.config.alertThresholds.responseTime
        ) {
            alerts.push({
                type: "RESPONSE_TIME",
                message: `High average response time: ${metrics.performance.requests.avgResponseTime}ms`,
                value: metrics.performance.requests.avgResponseTime,
                threshold: this.config.alertThresholds.responseTime,
            });
        }

        // Check memory usage
        const memoryUsage =
            (metrics.system.memory.used / metrics.system.memory.total) * 100;
        if (memoryUsage > this.config.alertThresholds.memoryUsage) {
            alerts.push({
                type: "MEMORY_USAGE",
                message: `High memory usage: ${memoryUsage.toFixed(2)}%`,
                value: memoryUsage,
                threshold: this.config.alertThresholds.memoryUsage,
            });
        }

        // Check CPU usage
        if (metrics.system.cpu.usage > this.config.alertThresholds.cpuUsage) {
            alerts.push({
                type: "CPU_USAGE",
                message: `High CPU usage: ${metrics.system.cpu.usage.toFixed(
                    2
                )}%`,
                value: metrics.system.cpu.usage,
                threshold: this.config.alertThresholds.cpuUsage,
            });
        }

        // Notify alert subscribers
        alerts.forEach((alert) => {
            this.alertCallbacks.forEach((callback) => callback(alert));
        });
    }

    private cleanupOldMetrics(): void {
        const now = Date.now();
        this.metricsHistory = this.metricsHistory.filter(
            (metric) => now - metric.timestamp <= this.config.retentionPeriod
        );
    }

    getMetrics(timeRange?: {
        start: number;
        end: number;
    }): AggregatedMetrics[] {
        if (!timeRange) {
            return [...this.metricsHistory];
        }

        return this.metricsHistory.filter(
            (metric) =>
                metric.timestamp >= timeRange.start &&
                metric.timestamp <= timeRange.end
        );
    }

    getLatestMetrics(): AggregatedMetrics | null {
        return this.metricsHistory[this.metricsHistory.length - 1] || null;
    }

    onAlert(callback: (alert: any) => void): void {
        this.alertCallbacks.push(callback);
    }

    stop(): void {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }
        this.metricsHistory = [];
        this.alertCallbacks = [];
    }
}

