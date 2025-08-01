/**
 * XyPrissJS Metrics Collector
 * Advanced performance metrics collection and analysis for cluster monitoring
 */

import { EventEmitter } from "events";
import * as os from "os";
import {
    ClusterConfig,
    WorkerMetrics,
    ClusterMetrics,
    MetricsSnapshot,
} from "../../types/cluster";
import { func } from "../../../mods/security/src/components/fortified-function";
import { logger } from "../../server/utils/Logger";

/**
 * Comprehensive metrics collector with real-time monitoring and analytics
 */
export class MetricsCollector extends EventEmitter {
    private config: ClusterConfig;
    private workerMetrics: Map<string, WorkerMetrics> = new Map();
    private metricsHistory: Map<string, MetricsSnapshot[]> = new Map();
    private clusterMetrics: ClusterMetrics;
    private collectionInterval?: NodeJS.Timeout;
    private isCollecting = false;
    private startTime = Date.now();
    private workerManager?: any; // Will be injected by ClusterManager

    constructor(config: ClusterConfig) {
        super();
        this.config = config;

        // Initialize cluster metrics
        this.clusterMetrics = this.initializeClusterMetrics();

        // Setup metrics collection
        this.setupMetricsCollection();
    }

    /**
     * Initialize cluster metrics structure
     */
    private initializeClusterMetrics(): ClusterMetrics {
        return {
            totalWorkers: 0,
            activeWorkers: 0,
            deadWorkers: 0,
            restarting: 0,
            totalRequests: 0,
            requestsPerSecond: 0,
            averageResponseTime: 0,
            totalErrors: 0,
            errorRate: 0,
            resources: {
                totalCpu: 0,
                totalMemory: 0,
                peakCpu: 0,
                peakMemory: 0,
                availableMemory: os.totalmem(),
                totalConnections: 0,
            },
            workers: [],
            uptime: 0,
            loadBalance: {
                strategy: this.config.loadBalancing?.strategy || "round-robin",
                distribution: {},
                efficiency: 100,
            },
            healthOverall: {
                status: "healthy",
                healthyWorkers: 0,
                unhealthyWorkers: 0,
                averageHealthScore: 100,
            },
        };
    }

    /**
     * Setup metrics collection with intelligent scheduling
     */
    private setupMetricsCollection(): void {
        const enabled = this.config.monitoring?.enabled !== false;
        const interval = this.config.monitoring?.metricsInterval || 60000; // 1 minute

        if (enabled) {
            this.startCollection(interval);
        }
    }

    /**
     * Start metrics collection
     */
    public startCollection(interval: number = 60000): void {
        if (this.isCollecting) return;

        this.isCollecting = true;

        const fortifiedCollector = func(
            async () => {
                await this.collectMetrics();
            },
            {
                ultraFast: "maximum",
                auditLog: false, // High frequency operation
                timeout: 30000,
                errorHandling: "graceful",
            }
        );

        this.collectionInterval = setInterval(() => {
            fortifiedCollector().catch((error) => {
                console.error("Metrics collection error:", error);
            });
        }, interval);

        logger.info(
            "cluster",
            `Metrics collection started (interval: ${interval}ms)`
        );
    }

    /**
     * Stop metrics collection
     */
    public stopCollection(): void {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = undefined;
        }
        this.isCollecting = false;
        logger.info("cluster", "Metrics collection stopped");
    }

    /**
     * Collect comprehensive metrics from all workers
     */
    private async collectMetrics(): Promise<void> {
        try {
            // Update cluster uptime
            this.clusterMetrics.uptime = Date.now() - this.startTime;

            // Collect system metrics
            await this.collectSystemMetrics();

            // Collect worker metrics
            await this.collectWorkerMetrics();

            // Calculate aggregated metrics
            this.calculateAggregatedMetrics();

            // Update health status
            this.updateHealthStatus();

            // Store metrics snapshot
            this.storeMetricsSnapshot();

            // Emit metrics update event
            this.emit("metrics:updated", this.clusterMetrics);
        } catch (error: any) {
            console.error("Error collecting metrics:", error);
        }
    }

    /**
     * Collect system-level metrics
     */
    private async collectSystemMetrics(): Promise<void> {
        // CPU metrics
        const cpus = os.cpus();
        const totalCpu = this.calculateCpuUsage();

        this.clusterMetrics.resources.totalCpu = totalCpu;
        if (totalCpu > this.clusterMetrics.resources.peakCpu) {
            this.clusterMetrics.resources.peakCpu = totalCpu;
        }

        // Memory metrics
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        this.clusterMetrics.resources.totalMemory = usedMemory;
        this.clusterMetrics.resources.availableMemory = freeMemory;

        if (usedMemory > this.clusterMetrics.resources.peakMemory) {
            this.clusterMetrics.resources.peakMemory = usedMemory;
        }
    }

    /**
     * Collect metrics from individual workers
     */
    private async collectWorkerMetrics(): Promise<void> {
        const workers = Array.from(this.workerMetrics.values());

        // Update worker counts
        this.clusterMetrics.totalWorkers = workers.length;
        this.clusterMetrics.activeWorkers = workers.filter(
            (w) =>
                w.health.status === "healthy" || w.health.status === "warning"
        ).length;
        this.clusterMetrics.deadWorkers = workers.filter(
            (w) => w.health.status === "dead"
        ).length;

        // Update workers array in cluster metrics
        this.clusterMetrics.workers = [...workers];

        // Collect custom metrics if configured
        if (this.config.monitoring?.customMetrics) {
            await this.collectCustomMetrics(workers);
        }
    }

    /**
     * Collect custom metrics defined in configuration
     */
    private async collectCustomMetrics(
        workers: WorkerMetrics[]
    ): Promise<void> {
        const customMetrics = this.config.monitoring?.customMetrics;
        if (!customMetrics) return;

        for (const worker of workers) {
            for (const [metricName, metricFunction] of Object.entries(
                customMetrics
            )) {
                try {
                    const value = metricFunction(worker.workerId);
                    // Store custom metric (could be extended to store in worker metrics)
                    logger.info(
                        "cluster",
                        `Custom metric ${metricName} for ${worker.workerId}: ${value}`
                    );
                } catch (error) {
                    console.error(
                        `Error collecting custom metric ${metricName}:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Calculate aggregated metrics across all workers
     */
    private calculateAggregatedMetrics(): void {
        const workers = this.clusterMetrics.workers;

        if (workers.length === 0) return;

        // Calculate totals
        this.clusterMetrics.totalRequests = workers.reduce(
            (sum, w) => sum + w.requests.total,
            0
        );
        this.clusterMetrics.totalErrors = workers.reduce(
            (sum, w) => sum + w.requests.errors,
            0
        );
        this.clusterMetrics.resources.totalConnections = workers.reduce(
            (sum, w) => sum + w.network.connections,
            0
        );

        // Calculate averages
        const totalResponseTime = workers.reduce(
            (sum, w) => sum + w.requests.averageResponseTime,
            0
        );
        this.clusterMetrics.averageResponseTime =
            totalResponseTime / workers.length;

        const totalRequestsPerSecond = workers.reduce(
            (sum, w) => sum + w.requests.perSecond,
            0
        );
        this.clusterMetrics.requestsPerSecond = totalRequestsPerSecond;

        // Calculate error rate
        this.clusterMetrics.errorRate =
            this.clusterMetrics.totalRequests > 0
                ? (this.clusterMetrics.totalErrors /
                      this.clusterMetrics.totalRequests) *
                  100
                : 0;

        // Update load balance distribution
        this.updateLoadBalanceMetrics(workers);
    }

    /**
     * Update load balance metrics
     */
    private updateLoadBalanceMetrics(workers: WorkerMetrics[]): void {
        const distribution: { [workerId: string]: number } = {};

        workers.forEach((worker) => {
            distribution[worker.workerId] = worker.requests.total;
        });

        this.clusterMetrics.loadBalance.distribution = distribution;

        // Calculate load balance efficiency
        const requestCounts = Object.values(distribution);
        if (requestCounts.length > 0) {
            const average =
                requestCounts.reduce((sum, count) => sum + count, 0) /
                requestCounts.length;
            const variance =
                requestCounts.reduce(
                    (sum, count) => sum + Math.pow(count - average, 2),
                    0
                ) / requestCounts.length;
            const standardDeviation = Math.sqrt(variance);
            const coefficientOfVariation =
                average > 0 ? standardDeviation / average : 0;

            this.clusterMetrics.loadBalance.efficiency = Math.max(
                0,
                100 - coefficientOfVariation * 100
            );
        }
    }

    /**
     * Update overall health status
     */
    private updateHealthStatus(): void {
        const workers = this.clusterMetrics.workers;

        if (workers.length === 0) {
            this.clusterMetrics.healthOverall.status = "critical";
            return;
        }

        const healthyWorkers = workers.filter(
            (w) => w.health.status === "healthy"
        ).length;
        const unhealthyWorkers = workers.length - healthyWorkers;

        this.clusterMetrics.healthOverall.healthyWorkers = healthyWorkers;
        this.clusterMetrics.healthOverall.unhealthyWorkers = unhealthyWorkers;

        // Calculate average health score
        const totalHealthScore = workers.reduce(
            (sum, w) => sum + w.health.healthScore,
            0
        );
        this.clusterMetrics.healthOverall.averageHealthScore =
            totalHealthScore / workers.length;

        // Determine overall status
        const healthyPercentage = (healthyWorkers / workers.length) * 100;

        if (healthyPercentage >= 80) {
            this.clusterMetrics.healthOverall.status = "healthy";
        } else if (healthyPercentage >= 50) {
            this.clusterMetrics.healthOverall.status = "degraded";
        } else {
            this.clusterMetrics.healthOverall.status = "critical";
        }
    }

    /**
     * Store metrics snapshot for historical analysis
     */
    private storeMetricsSnapshot(): void {
        const snapshot: MetricsSnapshot = {
            timestamp: new Date(),
            cpu: this.clusterMetrics.resources.totalCpu,
            memory: this.clusterMetrics.resources.totalMemory,
            requests: this.clusterMetrics.totalRequests,
            errors: this.clusterMetrics.totalErrors,
            responseTime: this.clusterMetrics.averageResponseTime,
        };

        // Store cluster-level snapshot
        if (!this.metricsHistory.has("cluster")) {
            this.metricsHistory.set("cluster", []);
        }

        const clusterHistory = this.metricsHistory.get("cluster")!;
        clusterHistory.push(snapshot);

        // Keep only last 1000 snapshots
        if (clusterHistory.length > 1000) {
            clusterHistory.splice(0, clusterHistory.length - 1000);
        }
    }

    /**
     * Calculate CPU usage percentage
     */
    private calculateCpuUsage(): number {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalTick += (cpu.times as any)[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;

        return 100 - ~~((100 * idle) / total);
    }

    /**
     * Update worker metrics
     */
    public updateWorkerMetrics(
        workerId: string,
        metrics: Partial<WorkerMetrics>
    ): void {
        const existing = this.workerMetrics.get(workerId);

        if (existing) {
            // Merge with existing metrics
            const updated = { ...existing, ...metrics };
            this.workerMetrics.set(workerId, updated);
        } else {
            // Create new metrics entry
            const newMetrics: WorkerMetrics = {
                workerId,
                pid: 0,
                uptime: 0,
                restarts: 0,
                cpu: { usage: 0, average: 0, peak: 0 },
                memory: {
                    usage: 0,
                    peak: 0,
                    percentage: 0,
                    heapUsed: 0,
                    heapTotal: 0,
                    external: 0,
                },
                network: {
                    connections: 0,
                    bytesReceived: 0,
                    bytesSent: 0,
                    connectionsPerSecond: 0,
                },
                requests: {
                    total: 0,
                    perSecond: 0,
                    errors: 0,
                    averageResponseTime: 0,
                    p95ResponseTime: 0,
                    p99ResponseTime: 0,
                    activeRequests: 0,
                    queuedRequests: 0,
                },
                health: {
                    status: "healthy",
                    lastCheck: new Date(),
                    consecutiveFailures: 0,
                    healthScore: 100,
                },
                gc: { collections: 0, timeSpent: 0, averageTime: 0 },
                eventLoop: { delay: 0, utilization: 0 },
                ...metrics,
            };

            this.workerMetrics.set(workerId, newMetrics);
        }
    }

    /**
     * Remove worker metrics
     */
    public removeWorkerMetrics(workerId: string): void {
        this.workerMetrics.delete(workerId);
        this.metricsHistory.delete(workerId);
    }

    /**
     * Get current cluster metrics
     */
    public getClusterMetrics(): ClusterMetrics {
        return { ...this.clusterMetrics };
    }

    /**
     * Get worker metrics by ID
     */
    public getWorkerMetrics(workerId: string): WorkerMetrics | null {
        return this.workerMetrics.get(workerId) || null;
    }

    /**
     * Get aggregated metrics summary
     */
    public getAggregatedMetrics(): {
        cpu: number;
        memory: number;
        requests: number;
        errors: number;
        responseTime: number;
    } {
        return {
            cpu: this.clusterMetrics.resources.totalCpu,
            memory: this.clusterMetrics.resources.totalMemory,
            requests: this.clusterMetrics.totalRequests,
            errors: this.clusterMetrics.totalErrors,
            responseTime: this.clusterMetrics.averageResponseTime,
        };
    }

    /**
     * Export metrics in different formats
     */
    public async exportMetrics(
        format: "json" | "prometheus" | "csv" = "json"
    ): Promise<string> {
        switch (format) {
            case "json":
                return JSON.stringify(this.clusterMetrics, null, 2);
            case "prometheus":
                return this.exportPrometheusFormat();
            case "csv":
                return this.exportCSVFormat();
            default:
                return JSON.stringify(this.clusterMetrics, null, 2);
        }
    }

    /**
     * Export metrics in Prometheus format
     */
    private exportPrometheusFormat(): string {
        const metrics = this.clusterMetrics;
        const lines: string[] = [];

        lines.push(`# HELP cluster_workers_total Total number of workers`);
        lines.push(`# TYPE cluster_workers_total gauge`);
        lines.push(`cluster_workers_total ${metrics.totalWorkers}`);

        lines.push(`# HELP cluster_requests_total Total number of requests`);
        lines.push(`# TYPE cluster_requests_total counter`);
        lines.push(`cluster_requests_total ${metrics.totalRequests}`);

        lines.push(`# HELP cluster_errors_total Total number of errors`);
        lines.push(`# TYPE cluster_errors_total counter`);
        lines.push(`cluster_errors_total ${metrics.totalErrors}`);

        lines.push(
            `# HELP cluster_response_time_avg Average response time in milliseconds`
        );
        lines.push(`# TYPE cluster_response_time_avg gauge`);
        lines.push(`cluster_response_time_avg ${metrics.averageResponseTime}`);

        return lines.join("\n");
    }

    /**
     * Export metrics in CSV format
     */
    private exportCSVFormat(): string {
        const metrics = this.clusterMetrics;
        const headers = [
            "timestamp",
            "total_workers",
            "active_workers",
            "total_requests",
            "total_errors",
            "error_rate",
            "avg_response_time",
            "cpu_usage",
            "memory_usage",
        ];

        const row = [
            new Date().toISOString(),
            metrics.totalWorkers,
            metrics.activeWorkers,
            metrics.totalRequests,
            metrics.totalErrors,
            metrics.errorRate.toFixed(2),
            metrics.averageResponseTime.toFixed(2),
            metrics.resources.totalCpu.toFixed(2),
            metrics.resources.totalMemory,
        ];

        return headers.join(",") + "\n" + row.join(",");
    }

    /**
     * Get metrics history
     */
    public getMetricsHistory(workerId?: string): MetricsSnapshot[] {
        const key = workerId || "cluster";
        return this.metricsHistory.get(key) || [];
    }

    /**
     * Set worker manager reference for integration
     */
    public setWorkerManager(workerManager: any): void {
        this.workerManager = workerManager;
    }

    /**
     * Restore historical metrics data from persistent storage
     */
    public restoreHistoricalData(
        historicalData: Array<{
            timestamp: Date;
            cpu: number;
            memory: number;
            requests: number;
            errors: number;
            responseTime: number;
        }>
    ): void {
        // Restore cluster-level historical data
        if (!this.metricsHistory.has("cluster")) {
            this.metricsHistory.set("cluster", []);
        }

        const clusterHistory = this.metricsHistory.get("cluster")!;

        // Convert historical data to MetricsSnapshot format
        const snapshots: MetricsSnapshot[] = historicalData.map((data) => ({
            timestamp: new Date(data.timestamp),
            cpu: data.cpu,
            memory: data.memory,
            requests: data.requests,
            errors: data.errors,
            responseTime: data.responseTime,
        }));

        // Merge with existing data, avoiding duplicates
        const existingTimestamps = new Set(
            clusterHistory.map((s) => s.timestamp.getTime())
        );
        const newSnapshots = snapshots.filter(
            (s) => !existingTimestamps.has(s.timestamp.getTime())
        );

        clusterHistory.push(...newSnapshots);

        // Sort by timestamp and keep only last 1000 entries
        clusterHistory.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        if (clusterHistory.length > 1000) {
            clusterHistory.splice(0, clusterHistory.length - 1000);
        }

        logger.info(
            "cluster",
            `Restored ${newSnapshots.length} historical metrics snapshots`
        );
    }

    /**
     * Restore worker-specific historical data
     */
    public restoreWorkerHistoricalData(
        workerHistory: Map<
            string,
            Array<{
                timestamp: Date;
                cpu: number;
                memory: number;
                requests: number;
                errors: number;
                responseTime: number;
            }>
        >
    ): void {
        for (const [workerId, workerData] of workerHistory.entries()) {
            if (!this.metricsHistory.has(workerId)) {
                this.metricsHistory.set(workerId, []);
            }

            const workerHistoryArray = this.metricsHistory.get(workerId)!;

            // Convert to MetricsSnapshot format
            const snapshots: MetricsSnapshot[] = workerData.map((data) => ({
                timestamp: new Date(data.timestamp),
                cpu: data.cpu,
                memory: data.memory,
                requests: data.requests,
                errors: data.errors,
                responseTime: data.responseTime,
            }));

            // Merge with existing data, avoiding duplicates
            const existingTimestamps = new Set(
                workerHistoryArray.map((s) => s.timestamp.getTime())
            );
            const newSnapshots = snapshots.filter(
                (s) => !existingTimestamps.has(s.timestamp.getTime())
            );

            workerHistoryArray.push(...newSnapshots);

            // Sort by timestamp and keep only last 1000 entries
            workerHistoryArray.sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );
            if (workerHistoryArray.length > 1000) {
                workerHistoryArray.splice(0, workerHistoryArray.length - 1000);
            }
        }

        logger.info(
            "cluster",
            `Restored historical data for ${workerHistory.size} workers`
        );
    }

    /**
     * Export current metrics for persistence
     */
    public exportMetricsForPersistence(): {
        clusterMetrics: ClusterMetrics;
        historicalData: Array<{
            timestamp: Date;
            cpu: number;
            memory: number;
            requests: number;
            errors: number;
            responseTime: number;
        }>;
        workerHistory: Map<
            string,
            Array<{
                timestamp: Date;
                cpu: number;
                memory: number;
                requests: number;
                errors: number;
                responseTime: number;
            }>
        >;
    } {
        return {
            clusterMetrics: this.clusterMetrics,
            historicalData: this.metricsHistory.get("cluster") || [],
            workerHistory: new Map(
                Array.from(this.metricsHistory.entries()).filter(
                    ([key]) => key !== "cluster"
                )
            ),
        };
    }
}

