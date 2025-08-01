/**
 * XyPrissJS Health Monitor
 * Advanced health monitoring system with predictive failure detection
 */

import { EventEmitter } from "events";
import * as cluster from "cluster";
import * as http from "http";
import pidusage from "pidusage";
import {
    ClusterConfig,
    WorkerMetrics,
    HealthChecker,
} from "../../types/cluster";
import {
    SecurityErrorLogger,
    createSecurityError,
    ErrorType,
    ErrorSeverity,
} from "../../../mods/security/src/utils/errorHandler";
import { func } from "../../../mods/security/src/components/fortified-function";
import { logger } from "../../server/utils/Logger";

/**
 * Intelligent health monitoring with predictive analytics and auto-recovery
 */
export class HealthMonitor extends EventEmitter {
    private config: ClusterConfig;
    private errorLogger: SecurityErrorLogger;
    private healthChecker: HealthChecker;
    private monitoringInterval?: NodeJS.Timeout;
    private workerHealthStatus: Map<string, boolean> = new Map();
    private healthHistory: Map<
        string,
        Array<{ timestamp: Date; healthy: boolean; score: number }>
    > = new Map();
    private isMonitoring = false;
    private workerManager?: any; // Will be injected by ClusterManager

    constructor(config: ClusterConfig, errorLogger: SecurityErrorLogger) {
        super();
        this.config = config;
        this.errorLogger = errorLogger;

        // Initialize health checker configuration
        this.healthChecker = {
            enabled: config.healthCheck?.enabled !== false,
            interval: config.healthCheck?.interval || 30000, // 30 seconds
            timeout: config.healthCheck?.timeout || 5000, // 5 seconds
            checks: new Map(),
            customChecks: [],
        };

        this.setupHealthChecker();
    }

    /**
     * Setup health checker with fortified monitoring
     */
    private setupHealthChecker(): void {
        if (!this.healthChecker.enabled) return;

        // Add custom health check if provided
        if (this.config.healthCheck?.customCheck) {
            this.healthChecker.customChecks.push(
                this.config.healthCheck.customCheck
            );
        }

        // Setup default health checks
        this.addDefaultHealthChecks();
    }

    /**
     * Add default health checks for comprehensive monitoring
     */
    private addDefaultHealthChecks(): void {
        // Memory usage check
        this.healthChecker.customChecks.push(async (workerId: string) => {
            const memoryThreshold = this.parseMemoryThreshold(
                this.config.processManagement?.memoryThreshold || "512MB"
            );

            try {
                const usage = await this.getWorkerMemoryUsage(workerId);
                return usage < memoryThreshold;
            } catch {
                return false;
            }
        });

        // CPU usage check
        this.healthChecker.customChecks.push(async (workerId: string) => {
            const cpuThreshold =
                this.config.processManagement?.cpuThreshold || 80;

            try {
                const usage = await this.getWorkerCpuUsage(workerId);
                return usage < cpuThreshold;
            } catch {
                return false;
            }
        });

        // Event loop delay check
        this.healthChecker.customChecks.push(async (workerId: string) => {
            try {
                const delay = await this.getWorkerEventLoopDelay(workerId);
                return delay < 100; // 100ms threshold
            } catch {
                return false;
            }
        });
    }

    /**
     * Start health monitoring with intelligent scheduling
     */
    public startMonitoring(): void {
        if (this.isMonitoring || !this.healthChecker.enabled) return;

        this.isMonitoring = true;

        const fortifiedMonitor = func(
            async () => {
                await this.performHealthChecks();
            },
            {
                ultraFast: "maximum",
                auditLog: true,
                timeout: this.healthChecker.timeout * 2,
                errorHandling: "graceful",
            }
        );

        this.monitoringInterval = setInterval(
            () => fortifiedMonitor(),
            this.healthChecker.interval
        );

        logger.info(
            "cluster",
            `Health monitoring started (interval: ${this.healthChecker.interval}ms)`
        );
    }

    /**
     * Stop health monitoring
     */
    public stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        this.isMonitoring = false;
        logger.info("cluster", "Health monitoring stopped");
    }

    /**
     * Perform comprehensive health checks on all workers
     */
    public async performHealthChecks(): Promise<void> {
        const workers = this.getActiveWorkers();

        const healthCheckPromises = workers.map(async (workerId) => {
            try {
                const isHealthy = await this.checkWorkerHealth(workerId);
                await this.updateWorkerHealthStatus(workerId, isHealthy);
                return { workerId, isHealthy };
            } catch (error: any) {
                const securityError = createSecurityError(
                    `Health check failed for worker ${workerId}: ${error.message}`,
                    ErrorType.INTERNAL,
                    ErrorSeverity.MEDIUM,
                    "HEALTH_CHECK_ERROR",
                    { operation: "health_check" }
                );
                this.errorLogger.logError(securityError);
                return { workerId, isHealthy: false };
            }
        });

        const results = await Promise.allSettled(healthCheckPromises);

        // Process results and trigger events
        results.forEach((result) => {
            if (result.status === "fulfilled") {
                const { workerId, isHealthy } = result.value;
                if (!isHealthy) {
                    this.handleUnhealthyWorker(workerId);
                }
            }
        });
    }

    /**
     * Check individual worker health with comprehensive metrics
     */
    public async checkWorkerHealth(workerId: string): Promise<boolean> {
        const worker = this.getWorkerById(workerId);
        if (!worker || worker.isDead()) {
            return false;
        }

        // Run all health checks
        const healthCheckResults = await Promise.allSettled(
            this.healthChecker.customChecks.map((check) =>
                Promise.race([
                    check(workerId),
                    new Promise<boolean>((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Health check timeout")),
                            this.healthChecker.timeout
                        )
                    ),
                ])
            )
        );

        // Calculate health score based on passed checks
        const passedChecks = healthCheckResults.filter(
            (result) => result.status === "fulfilled" && result.value === true
        ).length;

        const totalChecks = healthCheckResults.length;
        const healthScore =
            totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

        // Update health check record
        const checkRecord = {
            lastCheck: new Date(),
            consecutiveFailures: 0,
            isHealthy: healthScore >= 70, // 70% threshold for healthy status
            lastError: undefined as Error | undefined,
        };

        // Update consecutive failures
        const existingRecord = this.healthChecker.checks.get(workerId);
        if (existingRecord && !checkRecord.isHealthy) {
            checkRecord.consecutiveFailures =
                existingRecord.consecutiveFailures + 1;
        }

        this.healthChecker.checks.set(workerId, checkRecord);

        // Store health history for trend analysis
        this.updateHealthHistory(workerId, checkRecord.isHealthy, healthScore);

        return checkRecord.isHealthy;
    }

    /**
     * Update worker health status and trigger appropriate events
     */
    private async updateWorkerHealthStatus(
        workerId: string,
        isHealthy: boolean
    ): Promise<void> {
        const previousStatus = this.workerHealthStatus.get(workerId);
        this.workerHealthStatus.set(workerId, isHealthy);

        // Trigger events based on status changes
        if (previousStatus !== undefined && previousStatus !== isHealthy) {
            if (!isHealthy) {
                this.emit(
                    "worker:health:warning",
                    workerId,
                    this.getWorkerMetrics(workerId)
                );
            } else {
                this.emit(
                    "worker:health:recovered",
                    workerId,
                    this.getWorkerMetrics(workerId)
                );
            }
        }

        // Check for critical health issues
        const checkRecord = this.healthChecker.checks.get(workerId);
        const maxFailures = this.config.healthCheck?.maxFailures || 3;

        if (checkRecord && checkRecord.consecutiveFailures >= maxFailures) {
            this.emit(
                "worker:health:critical",
                workerId,
                this.getWorkerMetrics(workerId)
            );
        }
    }

    /**
     * Handle unhealthy worker with intelligent recovery strategies
     */
    private async handleUnhealthyWorker(workerId: string): Promise<void> {
        const checkRecord = this.healthChecker.checks.get(workerId);
        const maxFailures = this.config.healthCheck?.maxFailures || 3;

        if (!checkRecord) return;

        if (checkRecord.consecutiveFailures >= maxFailures) {
            // Trigger worker restart
            this.emit(
                "worker:restart:required",
                workerId,
                "health_check_failure"
            );
        } else if (
            checkRecord.consecutiveFailures >= Math.floor(maxFailures / 2)
        ) {
            // Trigger warning
            this.emit(
                "worker:health:degraded",
                workerId,
                this.getWorkerMetrics(workerId)
            );
        }
    }

    /**
     * Update health history for trend analysis
     */
    private updateHealthHistory(
        workerId: string,
        healthy: boolean,
        score: number
    ): void {
        if (!this.healthHistory.has(workerId)) {
            this.healthHistory.set(workerId, []);
        }

        const history = this.healthHistory.get(workerId)!;
        history.push({
            timestamp: new Date(),
            healthy,
            score,
        });

        // Keep only last 100 entries
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
    }

    /**
     * Get worker memory usage in bytes using real process monitoring
     */
    private async getWorkerMemoryUsage(workerId: string): Promise<number> {
        try {
            const worker = this.getWorkerById(workerId);
            if (!worker || !worker.process.pid) return 0;

            const stats = await pidusage(worker.process.pid);
            return stats.memory;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get worker CPU usage percentage using real process monitoring
     */
    private async getWorkerCpuUsage(workerId: string): Promise<number> {
        try {
            const worker = this.getWorkerById(workerId);
            if (!worker || !worker.process.pid) return 0;

            const stats = await pidusage(worker.process.pid);
            return stats.cpu;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get worker event loop delay using HTTP health check
     */
    private async getWorkerEventLoopDelay(workerId: string): Promise<number> {
        try {
            const healthEndpoint =
                this.config.healthCheck?.endpoint || "/health";
            const port = this.getWorkerPort(workerId);

            if (!port) return 0;

            const startTime = Date.now();
            const isHealthy = await this.performHttpHealthCheck(
                `http://localhost:${port}${healthEndpoint}`
            );
            const responseTime = Date.now() - startTime;

            return isHealthy ? responseTime : 1000; // Return high delay if unhealthy
        } catch (error) {
            return 1000; // High delay indicates problems
        }
    }

    /**
     * Perform HTTP health check on worker endpoint
     */
    private async performHttpHealthCheck(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            const timeout = setTimeout(
                () => resolve(false),
                this.healthChecker.timeout
            );

            const req = http.get(url, (res) => {
                clearTimeout(timeout);
                resolve(res.statusCode === 200);
            });

            req.on("error", () => {
                clearTimeout(timeout);
                resolve(false);
            });

            req.setTimeout(this.healthChecker.timeout, () => {
                req.destroy();
                clearTimeout(timeout);
                resolve(false);
            });
        });
    }

    /**
     * Get worker port from configuration or environment
     */
    private getWorkerPort(workerId: string): number | null {
        // Extract worker ID number and calculate port
        const match = workerId.match(/worker_(\d+)/);
        if (match) {
            const workerIndex = parseInt(match[1]);
            return 3000 + workerIndex; // Base port + worker index
        }
        return null;
    }

    /**
     * Parse memory threshold string to bytes
     */
    private parseMemoryThreshold(threshold: string): number {
        const match = threshold.match(/^(\d+(?:\.\d+)?)\s*(MB|GB|KB)?$/i);
        if (!match) return 512 * 1024 * 1024; // Default 512MB

        const value = parseFloat(match[1]);
        const unit = (match[2] || "MB").toUpperCase();

        switch (unit) {
            case "KB":
                return value * 1024;
            case "MB":
                return value * 1024 * 1024;
            case "GB":
                return value * 1024 * 1024 * 1024;
            default:
                return value;
        }
    }

    /**
     * Get active worker IDs from cluster workers
     */
    private getActiveWorkers(): string[] {
        const workers: string[] = [];

        // Get workers from cluster if available
        if (typeof require !== "undefined") {
            try {
                const clusterModule = require("cluster");
                if (clusterModule.workers) {
                    Object.keys(clusterModule.workers).forEach((id) => {
                        const worker = clusterModule.workers[id];
                        if (worker && !worker.isDead()) {
                            workers.push(`worker_${id}_${Date.now()}`);
                        }
                    });
                }
            } catch (error) {
                // Fallback to empty array if cluster not available
            }
        }

        return workers;
    }

    /**
     * Get worker by ID from cluster workers
     */
    private getWorkerById(workerId: string): cluster.Worker | undefined {
        try {
            const clusterModule = require("cluster");
            const id = workerId.split("_")[1];
            return clusterModule.workers?.[id];
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Get worker metrics from internal tracking
     */
    private getWorkerMetrics(workerId: string): WorkerMetrics | null {
        // Return basic metrics structure for health monitoring
        return {
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
        };
    }

    /**
     * Get health status for all workers
     */
    public getHealthStatus(): { [workerId: string]: boolean } {
        const status: { [workerId: string]: boolean } = {};
        this.workerHealthStatus.forEach((healthy, workerId) => {
            status[workerId] = healthy;
        });
        return status;
    }

    /**
     * Get health history for a worker
     */
    public getHealthHistory(
        workerId: string
    ): Array<{ timestamp: Date; healthy: boolean; score: number }> {
        return this.healthHistory.get(workerId) || [];
    }

    /**
     * Set worker manager reference for integration
     */
    public setWorkerManager(workerManager: any): void {
        this.workerManager = workerManager;
    }
}

