/**
 * XyPrissJS Performance Monitor
 * Real-time performance monitoring and optimization
 */

import { PerformanceConfig } from "./types/types";

export class PerformanceMonitor {
    private config: Required<PerformanceConfig>;
    private metrics: any = {};
    private alerts: any[] = [];
    private interval: NodeJS.Timeout | null = null;

    constructor(config: PerformanceConfig = {}) {
        this.config = {
            enabled: true,
            metrics: ["cpu", "memory", "responseTime", "requests", "errors"],
            interval: 5000,
            alerts: [],
            dashboard: false,
            export: {},
            ...config,
        };

        this.initializeMetrics();

        if (this.config.enabled) {
            this.startMonitoring();
        }
    }

    private initializeMetrics(): void {
        this.metrics = {
            requests: { total: 0, perSecond: 0, lastCount: 0 },
            responses: { total: 0, average: 0, min: Infinity, max: 0 },
            errors: { total: 0, rate: 0 },
            memory: { used: 0, total: 0, percentage: 0 },
            cpu: { usage: 0 },
            uptime: 0,
            timestamp: Date.now(),
        };
    }

    public getMiddleware() {
        return (req: any, res: any, next: any) => {
            if (!this.config.enabled) {
                return next();
            }

            const startTime = process.hrtime.bigint();
            this.metrics.requests.total++;

            res.on("finish", () => {
                const duration =
                    Number(process.hrtime.bigint() - startTime) / 1000000;

                // Update response metrics
                this.metrics.responses.total++;
                this.metrics.responses.min = Math.min(
                    this.metrics.responses.min,
                    duration
                );
                this.metrics.responses.max = Math.max(
                    this.metrics.responses.max,
                    duration
                );
                this.metrics.responses.average =
                    (this.metrics.responses.average *
                        (this.metrics.responses.total - 1) +
                        duration) /
                    this.metrics.responses.total;

                // Track errors
                if (res.statusCode >= 400) {
                    this.metrics.errors.total++;
                }

                // Add performance headers
                res.set("X-Response-Time", `${duration.toFixed(2)}ms`);
            });

            next();
        };
    }

    private startMonitoring(): void {
        this.interval = setInterval(() => {
            this.collectMetrics();
            this.checkAlerts();

            if (this.config.export.custom) {
                this.config.export.custom(this.metrics);
            }
        }, this.config.interval);
    }

    private collectMetrics(): void {
        // Memory metrics
        const memUsage = process.memoryUsage();
        this.metrics.memory = {
            used: Math.round(memUsage.heapUsed / 1024 / 1024),
            total: Math.round(memUsage.heapTotal / 1024 / 1024),
            percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        };

        // CPU metrics (simplified) but we can use external lib (if exist)
        this.metrics.cpu.usage = process.cpuUsage();

        // Request rate
        const requestDiff =
            this.metrics.requests.total - this.metrics.requests.lastCount;
        this.metrics.requests.perSecond =
            requestDiff / (this.config.interval / 1000);
        this.metrics.requests.lastCount = this.metrics.requests.total;

        // Error rate
        this.metrics.errors.rate =
            this.metrics.requests.total > 0
                ? (this.metrics.errors.total / this.metrics.requests.total) *
                  100
                : 0;

        // Uptime
        this.metrics.uptime = process.uptime();
        this.metrics.timestamp = Date.now();
    }

    private checkAlerts(): void {
        for (const alert of this.config.alerts) {
            const value = this.getMetricValue(alert.metric);

            if (value > alert.threshold) {
                const alertData = {
                    metric: alert.metric,
                    value,
                    threshold: alert.threshold,
                    timestamp: Date.now(),
                    action: alert.action,
                };
            }
        }
    }

    private getMetricValue(metric: string): number {
        switch (metric) {
            case "memory":
                return this.metrics.memory.percentage;
            case "cpu":
                return this.metrics.cpu.usage;
            case "responseTime":
                return this.metrics.responses.average;
            case "errorRate":
                return this.metrics.errors.rate;
            case "requestRate":
                return this.metrics.requests.perSecond;
            default:
                return 0;
        }
    }

    public getMetrics(): any {
        return {
            ...this.metrics,
            alerts: this.alerts.slice(-10), // Last 10 alerts
        };
    }

    public getHealthStatus(): any {
        const health = {
            status: "healthy",
            checks: {
                memory:
                    this.metrics.memory.percentage < 80 ? "healthy" : "warning",
                responseTime:
                    this.metrics.responses.average < 1000
                        ? "healthy"
                        : "warning",
                errorRate: this.metrics.errors.rate < 5 ? "healthy" : "warning",
            },
            uptime: this.metrics.uptime,
            timestamp: Date.now(),
        };

        // Determine overall status
        const hasWarnings = Object.values(health.checks).includes("warning");
        health.status = hasWarnings ? "warning" : "healthy";

        return health;
    }

    public stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

export class ClusterManager {
    private config: any;
    private workers: any[] = [];

    constructor(config: any) {
        this.config = config;
    }

    async start(serverFactory: () => Promise<void>): Promise<void> {
        if (require("cluster").isMaster) {
            console.log(
                ` Starting cluster with ${this.config.workers} workers...`
            );

            for (let i = 0; i < this.config.workers; i++) {
                const worker = require("cluster").fork();
                this.workers.push(worker);
            }

            require("cluster").on("exit", (worker: any) => {
                console.log(
                    ` Worker ${worker.process.pid} died, restarting...`
                );
                const newWorker = require("cluster").fork();
                const index = this.workers.indexOf(worker);
                if (index > -1) {
                    this.workers[index] = newWorker;
                }
            });
        } else {
            await serverFactory();
        }
    }

    async stop(): Promise<void> {
        if (require("cluster").isMaster) {
            for (const worker of this.workers) {
                worker.kill();
            }
        }
    }
}

