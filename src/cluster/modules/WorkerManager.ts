/**
 * XyPrissJS Worker Manager
 * Production-ready worker process lifecycle management with advanced monitoring
 */

import * as cluster from "cluster";
import * as os from "os";
import { EventEmitter } from "events";
import pidusage from "pidusage";
import { ClusterConfig, WorkerMetrics, WorkerPool } from "../../types/cluster";
import {
    SecurityErrorLogger,
    createSecurityError,
    ErrorType,
    ErrorSeverity,
} from "../../../mods/security/src/utils/errorHandler";
import { func } from "../../../mods/security/src/components/fortified-function";
import { logger } from "../../../shared/logger/Logger";

/**
 * Production-grade worker process manager with intelligent lifecycle management
 */
export class WorkerManager extends EventEmitter {
    private readonly config: ClusterConfig;
    private readonly errorLogger: SecurityErrorLogger;
    private readonly workers = new Map<string, cluster.Worker>();
    private readonly workerMetrics = new Map<string, WorkerMetrics>();
    private readonly restartCounts = new Map<string, number>();
    private readonly lastRestartTime = new Map<string, Date>();
    private readonly workerPool: WorkerPool;
    private readonly monitoringInterval: NodeJS.Timeout;
    private isShuttingDown = false;
    private shutdownPromise: Promise<void> | null = null;

    constructor(config: ClusterConfig, errorLogger: SecurityErrorLogger) {
        super();

        if (!(cluster as any).isPrimary && !(cluster as any).isMaster) {
            throw new Error(
                "WorkerManager can only be instantiated in the primary process"
            );
        }

        this.config = config;
        this.errorLogger = errorLogger;

        // Initialize optimized worker pool
        const optimalWorkerCount = this.getOptimalWorkerCount();
        this.workerPool = {
            active: new Map(),
            pending: new Set(),
            draining: new Set(),
            dead: new Map(),
            maxSize: Math.min(
                optimalWorkerCount,
                this.config.autoScaling?.maxWorkers || 32
            ),
            currentSize: 0,
            targetSize: optimalWorkerCount,
        };

        this.setupClusterEventHandlers();
        this.monitoringInterval = this.setupWorkerMonitoring();

        // Handle process cleanup
        process.once("SIGTERM", () => this.gracefulShutdown());
        process.once("SIGINT", () => this.gracefulShutdown());
    }

    /**
     * Calculate optimal worker count with system resource consideration
     */
    private getOptimalWorkerCount(): number {
        const configWorkers = this.config.workers;
        const cpuCount = os.cpus().length;
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();

        if (typeof configWorkers === "number") {
            return Math.max(1, Math.min(configWorkers, cpuCount * 2));
        }

        if (configWorkers === "auto") {
            // Advanced auto-scaling based on system resources
            const memoryUtilization = 1 - freeMemory / totalMemory;

            let workerCount = cpuCount;

            // Scale down if memory usage is high
            if (memoryUtilization > 0.8) {
                workerCount = Math.ceil(cpuCount * 0.5);
            } else if (memoryUtilization > 0.6) {
                workerCount = Math.ceil(cpuCount * 0.75);
            }

            // Always reserve one CPU for the primary process
            return Math.max(1, Math.min(workerCount - 1, 16));
        }

        return Math.max(1, cpuCount - 1);
    }

    /**
     * Setup cluster event handlers with proper error handling
     */
    private setupClusterEventHandlers(): void {
        const safeHandler = (handler: (...args: any[]) => any) =>
            func(handler, {
                ultraFast: "maximum",
                auditLog: true,
                errorHandling: "graceful",
            });

        (cluster as any).on(
            "fork",
            safeHandler((worker: cluster.Worker) => {
                this.handleWorkerEvent("fork", worker);
            })
        );

        (cluster as any).on(
            "online",
            safeHandler((worker: cluster.Worker) => {
                this.handleWorkerEvent("online", worker);
            })
        );

        (cluster as any).on(
            "listening",
            safeHandler((worker: cluster.Worker, address: any) => {
                this.handleWorkerEvent("listening", worker);
            })
        );

        (cluster as any).on(
            "disconnect",
            safeHandler((worker: cluster.Worker) => {
                this.handleWorkerEvent("disconnect", worker);
            })
        );

        (cluster as any).on(
            "exit",
            safeHandler(
                (worker: cluster.Worker, code: number, signal: string) => {
                    this.handleWorkerEvent("exit", worker, code, signal);
                }
            )
        );

        // Handle worker messages for IPC communication
        (cluster as any).on(
            "message",
            safeHandler((worker: cluster.Worker, message: any) => {
                this.handleWorkerMessage(worker, message);
            })
        );
    }

    /**
     * Setup optimized real-time worker monitoring
     */
    private setupWorkerMonitoring(): NodeJS.Timeout {
        return setInterval(async () => {
            if (this.isShuttingDown) return;

            try {
                await this.updateWorkerMetrics();
                this.performHealthChecks();
                this.optimizeWorkerPool();
            } catch (error: any) {
                const securityError = createSecurityError(
                    `Worker monitoring failed: ${error.message}`,
                    ErrorType.INTERNAL,
                    ErrorSeverity.MEDIUM,
                    "WORKER_MONITORING_ERROR",
                    { operation: "worker_monitoring" }
                );
                this.errorLogger.logError(securityError);
            }
        }, this.config.monitoring?.metricsInterval || 5000);
    }

    /**
     * Wait for worker to come online with timeout
     */
    private async waitForWorkerOnline(
        worker: cluster.Worker,
        workerId: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Worker ${workerId} startup timeout`));
            }, 15000); // 15 second startup timeout

            const cleanup = () => {
                clearTimeout(timeout);
                worker.removeListener("online", onOnline);
                worker.removeListener("error", onError);
                worker.removeListener("exit", onExit);
            };

            const onOnline = () => {
                cleanup();
                resolve();
            };

            const onError = (error: Error) => {
                cleanup();
                reject(error);
            };

            const onExit = (code: number, signal: string) => {
                cleanup();
                reject(
                    new Error(
                        `Worker ${workerId} exited during startup: code=${code}, signal=${signal}`
                    )
                );
            };

            worker.once("online", onOnline);
            worker.once("error", onError);
            worker.once("exit", onExit);
        });
    }

    /**
     * Graceful shutdown of all workers
     */
    public async gracefulShutdown(): Promise<void> {
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.shutdownPromise = this.performGracefulShutdown();
        return this.shutdownPromise;
    }

    /**
     * Perform the actual graceful shutdown
     */
    private async performGracefulShutdown(): Promise<void> {
        if (this.isShuttingDown) return;

        this.isShuttingDown = true;

        logger.info("cluster", "Starting graceful shutdown...");

        // Stop monitoring
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        // Stop accepting new requests
        this.emit("shutdown:started");

        const timeout =
            this.config.processManagement?.gracefulShutdownTimeout || 30000;
        const workers = Array.from(this.workers.values());

        if (workers.length === 0) {
            logger.info("cluster", "No workers to shutdown");
            return;
        }

        logger.info(
            "cluster",
            `Shutting down ${workers.length} workers with ${timeout}ms timeout`
        );

        // Phase 1: Signal workers to stop accepting new requests
        await this.signalWorkersToStopAccepting(workers);

        // Phase 2: Wait for workers to finish current requests
        await this.waitForWorkersToFinish(workers, timeout * 0.8);

        // Phase 3: Force shutdown remaining workers
        await this.forceShutdownRemainingWorkers(workers);

        logger.info("cluster", "Graceful shutdown completed");
    }

    /**
     * Signal workers to stop accepting new requests
     */
    private async signalWorkersToStopAccepting(
        workers: cluster.Worker[]
    ): Promise<void> {
        const promises = workers.map((worker) => {
            return new Promise<void>((resolve) => {
                try {
                    worker.send({ type: "shutdown", phase: "drain" });
                    // Give workers a moment to process the signal
                    setTimeout(resolve, 100);
                } catch (error) {
                    // Worker might be dead, continue
                    resolve();
                }
            });
        });

        await Promise.all(promises);
        logger.info("cluster", "Signaled workers to drain connections");
    }

    /**
     * Wait for workers to finish processing current requests
     */
    private async waitForWorkersToFinish(
        workers: cluster.Worker[],
        timeout: number
    ): Promise<void> {
        const startTime = Date.now();
        const activeWorkers = new Set(workers);

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;

                // Remove workers that have already exited
                Array.from(activeWorkers).forEach((worker) => {
                    if (worker.isDead()) {
                        activeWorkers.delete(worker);
                    }
                });

                // Check if all workers are done or timeout reached
                if (activeWorkers.size === 0 || elapsed >= timeout) {
                    clearInterval(checkInterval);
                    logger.info(
                        "cluster",
                        `Graceful phase completed: ${
                            workers.length - activeWorkers.size
                        }/${workers.length} workers finished`
                    );
                    resolve();
                }
            }, 500);

            // Start graceful disconnect
            Array.from(activeWorkers).forEach((worker) => {
                try {
                    worker.disconnect();
                } catch (error) {
                    // Worker might be dead, continue
                }
            });
        });
    }

    /**
     * Force shutdown any remaining workers
     */
    private async forceShutdownRemainingWorkers(
        workers: cluster.Worker[]
    ): Promise<void> {
        const remainingWorkers = workers.filter((worker) => !worker.isDead());

        if (remainingWorkers.length === 0) return;

        logger.warn(
            "cluster",
            `Force shutting down ${remainingWorkers.length} remaining workers`
        );

        const promises = remainingWorkers.map((worker) => {
            return new Promise<void>((resolve) => {
                const forceTimeout = setTimeout(() => {
                    try {
                        worker.kill("SIGKILL");
                    } catch (error) {
                        // Ignore errors
                    }
                    resolve();
                }, 5000);

                worker.once("exit", () => {
                    clearTimeout(forceTimeout);
                    resolve();
                });

                try {
                    worker.kill("SIGTERM");
                } catch (error) {
                    clearTimeout(forceTimeout);
                    resolve();
                }
            });
        });

        await Promise.all(promises);
    }

    /**
     * Stop all workers (legacy method for backward compatibility)
     */
    public async stopAllWorkers(graceful: boolean = true): Promise<void> {
        if (graceful) {
            return this.gracefulShutdown();
        } else {
            return this.forceShutdownAllWorkers();
        }
    }

    /**
     * Force shutdown all workers immediately
     */
    private async forceShutdownAllWorkers(): Promise<void> {
        this.isShuttingDown = true;

        const workers = Array.from(this.workers.values());
        const promises = workers.map((worker) => this.forceStopWorker(worker));

        await Promise.allSettled(promises);
    }

    /**
     * Force stop individual worker
     */
    private async forceStopWorker(worker: cluster.Worker): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                try {
                    worker.kill("SIGKILL");
                } catch (error) {
                    // Ignore errors
                }
                resolve();
            }, 2000);

            worker.once("exit", () => {
                clearTimeout(timer);
                resolve();
            });

            try {
                worker.kill("SIGTERM");
            } catch (error) {
                clearTimeout(timer);
                resolve();
            }
        });
    }

    /**
     * Get all active workers with enhanced filtering
     */
    public getActiveWorkers(): WorkerMetrics[] {
        return Array.from(this.workerPool.active.values()).filter(
            (metrics) => metrics.health.status !== "dead"
        );
    }

    /**
     * Get healthy workers only
     */
    public getHealthyWorkers(): WorkerMetrics[] {
        return this.getActiveWorkers().filter(
            (metrics) =>
                metrics.health.status === "healthy" &&
                metrics.health.healthScore >= 80
        );
    }

    /**
     * Get worker by ID with validation
     */
    public getWorker(workerId: string): WorkerMetrics | null {
        return this.workerMetrics.get(workerId) || null;
    }

    /**
     * Get comprehensive worker pool status
     */
    public getWorkerPool(): WorkerPool & {
        healthy: number;
        unhealthy: number;
        avgHealthScore: number;
        totalRestarts: number;
    } {
        const activeWorkers = this.getActiveWorkers();
        const healthy = activeWorkers.filter(
            (w) => w.health.status === "healthy"
        ).length;
        const unhealthy = activeWorkers.length - healthy;
        const avgHealthScore =
            activeWorkers.length > 0
                ? activeWorkers.reduce(
                      (sum, w) => sum + w.health.healthScore,
                      0
                  ) / activeWorkers.length
                : 0;
        const totalRestarts = Array.from(this.restartCounts.values()).reduce(
            (sum, count) => sum + count,
            0
        );

        return {
            ...this.workerPool,
            healthy,
            unhealthy,
            avgHealthScore: Math.round(avgHealthScore),
            totalRestarts,
        };
    }

    /**
     * Start a single worker with enhanced error handling
     */
    public async startSingleWorker(): Promise<string> {
        if (!(cluster as any).isPrimary && !(cluster as any).isMaster) {
            throw new Error("Cannot start worker from worker process");
        }

        if (this.isShuttingDown) {
            throw new Error("Cannot start worker during shutdown");
        }

        if (this.workerPool.currentSize >= this.workerPool.maxSize) {
            throw new Error(
                `Maximum worker limit reached (${this.workerPool.maxSize})`
            );
        }

        try {
            const worker = (cluster as any).fork();
            const workerId = this.getWorkerId(worker);

            // Wait for worker to come online
            await this.waitForWorkerOnline(worker, workerId);

            logger.info("cluster", `Started single worker: ${workerId}`);
            return workerId;
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to start single worker: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "SINGLE_WORKER_START_ERROR",
                { operation: "start_single_worker" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Stop a specific worker with enhanced control
     */
    public async stopSingleWorker(
        workerId: string,
        graceful: boolean = true
    ): Promise<void> {
        const worker = this.workers.get(workerId);
        if (!worker) {
            throw new Error(`Worker ${workerId} not found`);
        }

        if (worker.isDead()) {
            logger.warn("cluster", `Worker ${workerId} is already dead`);
            return;
        }

        const timeout =
            this.config.processManagement?.gracefulShutdownTimeout || 30000;

        try {
            if (graceful) {
                await this.gracefulStopWorker(worker, workerId, timeout);
            } else {
                await this.forceStopWorker(worker);
            }

            logger.info("cluster", `Stopped worker: ${workerId}`);
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to stop worker ${workerId}: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.MEDIUM,
                "SINGLE_WORKER_STOP_ERROR",
                { operation: "stop_single_worker" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Gracefully stop a single worker
     */
    private async gracefulStopWorker(
        worker: cluster.Worker,
        workerId: string,
        timeout: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                try {
                    worker.kill("SIGKILL");
                } catch (error) {
                    // Ignore errors
                }
                reject(new Error(`Worker ${workerId} graceful stop timeout`));
            }, timeout);

            worker.once("disconnect", () => {
                clearTimeout(timer);
                resolve();
            });

            worker.once("exit", () => {
                clearTimeout(timer);
                resolve();
            });

            try {
                // Signal worker to drain connections
                worker.send({ type: "shutdown", phase: "drain" });

                // Disconnect after a brief delay
                setTimeout(() => {
                    try {
                        worker.disconnect();
                    } catch (error) {
                        // Worker might have already disconnected
                    }
                }, 1000);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Scale worker pool to target size
     */
    public async scaleWorkers(targetSize: number): Promise<void> {
        if (!(cluster as any).isPrimary && !(cluster as any).isMaster) {
            throw new Error("Cannot scale workers from worker process");
        }

        if (this.isShuttingDown) {
            throw new Error("Cannot scale workers during shutdown");
        }

        const clampedTarget = Math.max(
            1,
            Math.min(targetSize, this.workerPool.maxSize)
        );
        const currentSize = this.workerPool.currentSize;

        if (clampedTarget === currentSize) {
            logger.info(
                "cluster",
                `Worker pool already at target size: ${currentSize}`
            );
            return;
        }

        logger.info(
            "cluster",
            `Scaling worker pool from ${currentSize} to ${clampedTarget} workers`
        );

        if (clampedTarget > currentSize) {
            // Scale up
            const workersToAdd = clampedTarget - currentSize;
            await this.startWorkers(workersToAdd);
        } else {
            // Scale down
            const workersToRemove = currentSize - clampedTarget;
            await this.scaleDownWorkers(workersToRemove);
        }

        this.workerPool.targetSize = clampedTarget;
        logger.info(
            "cluster",
            `Worker pool scaled to ${this.workerPool.currentSize} workers`
        );
    }

    /**
     * Scale down workers by removing the least healthy ones
     */
    private async scaleDownWorkers(count: number): Promise<void> {
        const activeWorkers = this.getActiveWorkers()
            .sort((a, b) => a.health.healthScore - b.health.healthScore) // Least healthy first
            .slice(0, count);

        const promises = activeWorkers.map((worker) =>
            this.stopSingleWorker(worker.workerId, true)
        );

        await Promise.allSettled(promises);
    }

    /**
     * Get comprehensive worker statistics
     */
    public getWorkerStats(): {
        total: number;
        active: number;
        healthy: number;
        warning: number;
        critical: number;
        dead: number;
        totalRequests: number;
        totalErrors: number;
        avgResponseTime: number;
        avgCpuUsage: number;
        avgMemoryUsage: number;
        totalRestarts: number;
    } {
        const workers = Array.from(this.workerMetrics.values());

        const stats = {
            total: workers.length,
            active: workers.filter((w) => w.health.status !== "dead").length,
            healthy: workers.filter((w) => w.health.status === "healthy")
                .length,
            warning: workers.filter((w) => w.health.status === "warning")
                .length,
            critical: workers.filter((w) => w.health.status === "critical")
                .length,
            dead: workers.filter((w) => w.health.status === "dead").length,
            totalRequests: workers.reduce(
                (sum, w) => sum + w.requests.total,
                0
            ),
            totalErrors: workers.reduce((sum, w) => sum + w.requests.errors, 0),
            avgResponseTime: 0,
            avgCpuUsage: 0,
            avgMemoryUsage: 0,
            totalRestarts: Array.from(this.restartCounts.values()).reduce(
                (sum, count) => sum + count,
                0
            ),
        };

        const activeWorkers = workers.filter((w) => w.health.status !== "dead");
        if (activeWorkers.length > 0) {
            stats.avgResponseTime = Math.round(
                activeWorkers.reduce(
                    (sum, w) => sum + w.requests.averageResponseTime,
                    0
                ) / activeWorkers.length
            );
            stats.avgCpuUsage = Math.round(
                activeWorkers.reduce((sum, w) => sum + w.cpu.usage, 0) /
                    activeWorkers.length
            );
            stats.avgMemoryUsage = Math.round(
                activeWorkers.reduce((sum, w) => sum + w.memory.percentage, 0) /
                    activeWorkers.length
            );
        }

        return stats;
    }

    /**
     * Send message to all workers
     */
    public broadcastToWorkers(message: any): void {
        this.workers.forEach((worker, workerId) => {
            try {
                if (!worker.isDead()) {
                    worker.send(message);
                }
            } catch (error) {
                logger.warn(
                    "cluster",
                    `Failed to send message to worker ${workerId}: ${error}`
                );
            }
        });
    }

    /**
     * Send message to a specific worker
     */
    public sendToWorker(workerId: string, message: any): boolean {
        const worker = this.workers.get(workerId);
        if (!worker || worker.isDead()) {
            return false;
        }

        try {
            worker.send(message);
            return true;
        } catch (error) {
            logger.warn(
                "cluster",
                `Failed to send message to worker ${workerId}: ${error}`
            );
            return false;
        }
    }

    /**
     * Clean up resources and stop monitoring
     */
    public async destroy(): Promise<void> {
        await this.gracefulShutdown();

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.removeAllListeners();
        this.workers.clear();
        this.workerMetrics.clear();
        this.restartCounts.clear();
        this.lastRestartTime.clear();

        logger.info("cluster", "WorkerManager destroyed");
    }

    /**
     * Handle worker IPC messages with enhanced processing
     */
    private handleWorkerMessage(worker: cluster.Worker, message: any): void {
        if (!message || typeof message !== "object") return;

        const workerId = this.getWorkerId(worker);

        try {
            switch (message.type) {
                case "metrics_update":
                    this.updateWorkerMetricsFromMessage(workerId, message.data);
                    break;
                case "health_check":
                    this.updateWorkerHealth(workerId, message.data);
                    break;
                case "request_stats":
                    this.updateRequestStats(workerId, message.data);
                    break;
                case "memory_warning":
                    this.handleMemoryWarning(workerId, message.data);
                    break;
                default:
                    // Emit for custom message handling
                    this.emit("worker:message", workerId, message);
            }
        } catch (error: any) {
            const securityError = createSecurityError(
                `Worker message processing failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.MEDIUM,
                "WORKER_MESSAGE_ERROR",
                { operation: "handle_worker_message" }
            );
            this.errorLogger.logError(securityError);
        }
    }

    /**
     * Update worker metrics using efficient batch processing
     */
    private async updateWorkerMetrics(): Promise<void> {
        const activeWorkers = Array.from(this.workers.entries());
        if (activeWorkers.length === 0) return;

        // Batch collect PIDs
        const pidMap = new Map<number, string>();
        activeWorkers.forEach(([workerId, worker]) => {
            if (worker.process?.pid) {
                pidMap.set(worker.process.pid, workerId);
            }
        });

        if (pidMap.size === 0) return;

        try {
            // Batch pidusage call for efficiency
            const pids = Array.from(pidMap.keys());
            const statsMap = await pidusage(pids);

            // Process stats in batch
            Object.entries(statsMap).forEach(([pidStr, stats]) => {
                const pid = parseInt(pidStr, 10);
                const workerId = pidMap.get(pid);

                if (workerId && stats) {
                    this.updateWorkerMetricsFromStats(workerId, stats);
                }
            });
        } catch (error: any) {
            // Handle partial failures gracefully
            logger.warn(
                "cluster",
                `Batch metrics collection failed: ${error.message}`
            );

            // Fallback to individual collection for critical workers
            await this.fallbackMetricsCollection(activeWorkers);
        }
    }

    /**
     * Fallback metrics collection for individual workers
     */
    private async fallbackMetricsCollection(
        workers: [string, cluster.Worker][]
    ): Promise<void> {
        const promises = workers.map(async ([workerId, worker]) => {
            try {
                if (!worker.process?.pid) return;

                const stats = await pidusage(worker.process.pid);
                this.updateWorkerMetricsFromStats(workerId, stats);
            } catch (error) {
                this.handleWorkerMetricsError(workerId);
            }
        });

        await Promise.allSettled(promises);
    }

    /**
     * Update worker metrics from pidusage stats
     */
    private updateWorkerMetricsFromStats(workerId: string, stats: any): void {
        const metrics = this.workerMetrics.get(workerId);
        if (!metrics) return;

        const now = Date.now();

        // Update CPU metrics with smoothing
        const prevCpuUsage = metrics.cpu.usage;
        metrics.cpu.usage = this.smoothValue(prevCpuUsage, stats.cpu, 0.3);
        metrics.cpu.average = metrics.cpu.average * 0.9 + stats.cpu * 0.1;
        metrics.cpu.peak = Math.max(metrics.cpu.peak, stats.cpu);

        // Update memory metrics
        metrics.memory.usage = stats.memory;
        metrics.memory.peak = Math.max(metrics.memory.peak, stats.memory);
        metrics.memory.percentage = (stats.memory / os.totalmem()) * 100;

        // Update uptime efficiently
        const worker = this.workers.get(workerId);
        if (worker?.process) {
            const startTime =
                (worker.process as any).spawndate?.getTime() ||
                this.lastRestartTime.get(workerId)?.getTime() ||
                now;
            metrics.uptime = now - startTime;
        }

        // Calculate health score
        this.calculateHealthScore(metrics);

        // Update last check
        metrics.health.lastCheck = new Date();
    }

    /**
     * Smooth value changes to avoid metric spikes
     */
    private smoothValue(
        oldValue: number,
        newValue: number,
        factor: number
    ): number {
        return oldValue * (1 - factor) + newValue * factor;
    }

    /**
     * Handle worker metrics collection errors
     */
    private handleWorkerMetricsError(workerId: string): void {
        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.health.status = "critical";
            metrics.health.consecutiveFailures++;

            // Consider worker dead if too many consecutive failures
            if (metrics.health.consecutiveFailures > 3) {
                this.emit("worker:unresponsive", workerId);
            }
        }
    }

    /**
     * Update worker metrics from IPC message
     */
    private updateWorkerMetricsFromMessage(workerId: string, data: any): void {
        const metrics = this.workerMetrics.get(workerId);
        if (!metrics || !data) return;

        // Safely merge metrics data
        if (data.requests && typeof data.requests === "object") {
            Object.assign(metrics.requests, data.requests);
        }
        if (data.network && typeof data.network === "object") {
            Object.assign(metrics.network, data.network);
        }
        if (data.gc && typeof data.gc === "object") {
            Object.assign(metrics.gc, data.gc);
        }
        if (data.eventLoop && typeof data.eventLoop === "object") {
            Object.assign(metrics.eventLoop, data.eventLoop);
        }
        if (data.memory && typeof data.memory === "object") {
            // Merge additional memory stats from worker
            Object.assign(metrics.memory, data.memory);
        }
    }

    /**
     * Update request statistics
     */
    private updateRequestStats(workerId: string, data: any): void {
        const metrics = this.workerMetrics.get(workerId);
        if (!metrics || !data) return;

        // Update request metrics with validation
        if (typeof data.total === "number") metrics.requests.total = data.total;
        if (typeof data.errors === "number")
            metrics.requests.errors = data.errors;
        if (typeof data.averageResponseTime === "number") {
            metrics.requests.averageResponseTime = data.averageResponseTime;
        }
        if (typeof data.activeRequests === "number") {
            metrics.requests.activeRequests = data.activeRequests;
        }
    }

    /**
     * Handle memory warning from worker
     */
    private handleMemoryWarning(workerId: string, data: any): void {
        const metrics = this.workerMetrics.get(workerId);
        if (!metrics) return;

        logger.warn(
            "cluster",
            `Memory warning from worker ${workerId}: ${data.message}`
        );

        metrics.health.status = "warning";

        // Consider restarting worker if memory usage is critical
        if (data.usage > 0.9) {
            this.emit("worker:memory_critical", workerId, data);
        }
    }

    /**
     * Update worker health from health check
     */
    private updateWorkerHealth(workerId: string, healthData: any): void {
        const metrics = this.workerMetrics.get(workerId);
        if (!metrics || !healthData) return;

        metrics.health.status = healthData.status || "healthy";
        metrics.health.lastCheck = new Date();
        metrics.health.healthScore = Math.max(
            0,
            Math.min(100, healthData.score || 100)
        );

        if (healthData.status === "healthy") {
            metrics.health.consecutiveFailures = 0;
        } else {
            metrics.health.consecutiveFailures++;
        }
    }

    /**
     * Calculate comprehensive health score
     */
    private calculateHealthScore(metrics: WorkerMetrics): void {
        let score = 100;

        // CPU utilization penalty
        if (metrics.cpu.usage > 90) score -= 30;
        else if (metrics.cpu.usage > 80) score -= 20;
        else if (metrics.cpu.usage > 60) score -= 10;

        // Memory utilization penalty
        if (metrics.memory.percentage > 95) score -= 40;
        else if (metrics.memory.percentage > 90) score -= 30;
        else if (metrics.memory.percentage > 70) score -= 15;

        // Error rate penalty
        if (metrics.requests.total > 0) {
            const errorRate =
                (metrics.requests.errors / metrics.requests.total) * 100;
            if (errorRate > 15) score -= 35;
            else if (errorRate > 10) score -= 25;
            else if (errorRate > 5) score -= 10;
        }

        // Response time penalty
        if (metrics.requests.averageResponseTime > 5000) score -= 25;
        else if (metrics.requests.averageResponseTime > 2000) score -= 15;
        else if (metrics.requests.averageResponseTime > 1000) score -= 5;

        // Event loop delay penalty
        if (metrics.eventLoop.delay > 100) score -= 20;
        else if (metrics.eventLoop.delay > 50) score -= 10;

        // Consecutive failures penalty
        score -= metrics.health.consecutiveFailures * 10;

        metrics.health.healthScore = Math.max(0, score);

        // Update health status based on score
        if (score >= 80) {
            metrics.health.status = "healthy";
        } else if (score >= 50) {
            metrics.health.status = "warning";
        } else {
            metrics.health.status = "critical";
        }
    }

    /**
     * Perform health checks and trigger actions
     */
    private performHealthChecks(): void {
        this.workerMetrics.forEach((metrics, workerId) => {
            // Check for unresponsive workers
            const timeSinceLastCheck =
                Date.now() - metrics.health.lastCheck.getTime();
            if (timeSinceLastCheck > 30000) {
                // 30 seconds
                metrics.health.status = "critical";
                metrics.health.consecutiveFailures++;
            }

            // Auto-restart critically unhealthy workers
            if (
                metrics.health.healthScore < 20 &&
                metrics.health.consecutiveFailures > 5 &&
                !this.isShuttingDown
            ) {
                this.emit("worker:auto_restart_needed", workerId);
                this.restartUnhealthyWorker(workerId);
            }
        });
    }

    /**
     * Optimize worker pool based on current load and health
     */
    private optimizeWorkerPool(): void {
        if (this.isShuttingDown) return;

        const activeWorkers = this.getActiveWorkers();
        const avgCpuUsage =
            activeWorkers.reduce((sum, w) => sum + w.cpu.usage, 0) /
            activeWorkers.length;
        const avgMemoryUsage =
            activeWorkers.reduce((sum, w) => sum + w.memory.percentage, 0) /
            activeWorkers.length;

        // Scale up if high utilization
        if (
            avgCpuUsage > 80 &&
            this.workerPool.currentSize < this.workerPool.maxSize
        ) {
            this.emit("worker:scale_up_needed");
        }

        // Scale down if low utilization (but keep minimum workers)
        else if (
            avgCpuUsage < 30 &&
            avgMemoryUsage < 50 &&
            this.workerPool.currentSize >
                Math.max(2, this.getOptimalWorkerCount() / 2)
        ) {
            this.emit("worker:scale_down_possible");
        }
    }

    /**
     * Restart unhealthy worker
     */
    private async restartUnhealthyWorker(workerId: string): Promise<void> {
        try {
            logger.warn("cluster", `Restarting unhealthy worker: ${workerId}`);
            await this.stopSingleWorker(workerId, false);
            await this.startSingleWorker();
        } catch (error: any) {
            logger.error(
                "cluster",
                `Failed to restart unhealthy worker ${workerId}: ${error.message}`
            );
        }
    }

    /**
     * Handle worker events with comprehensive monitoring
     */
    private async handleWorkerEvent(
        eventType: string,
        worker: cluster.Worker,
        code?: number,
        signal?: string
    ): Promise<void> {
        const workerId = this.getWorkerId(worker);

        try {
            switch (eventType) {
                case "fork":
                    await this.handleWorkerFork(workerId, worker);
                    break;
                case "online":
                    await this.handleWorkerOnline(workerId, worker);
                    break;
                case "listening":
                    await this.handleWorkerListening(workerId, worker);
                    break;
                case "disconnect":
                    await this.handleWorkerDisconnect(workerId, worker);
                    break;
                case "exit":
                    await this.handleWorkerExit(workerId, worker, code, signal);
                    break;
            }
        } catch (error: any) {
            const securityError = createSecurityError(
                `Worker event handling failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "WORKER_EVENT_ERROR",
                { operation: "handle_worker_event" }
            );
            this.errorLogger.logError(securityError);
        }
    }

    /**
     * Handle worker fork event
     */
    private async handleWorkerFork(
        workerId: string,
        worker: cluster.Worker
    ): Promise<void> {
        this.workers.set(workerId, worker);
        this.workerPool.pending.add(workerId);

        // Initialize comprehensive worker metrics
        const metrics: WorkerMetrics = {
            workerId,
            pid: worker.process.pid || 0,
            uptime: 0,
            restarts: this.restartCounts.get(workerId) || 0,
            lastRestart: this.lastRestartTime.get(workerId),
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

        this.workerMetrics.set(workerId, metrics);
        this.emit("worker:started", workerId, worker.process.pid || 0);

        logger.info(
            "cluster",
            `Worker ${workerId} forked with PID ${worker.process.pid}`
        );
    }

    /**
     * Handle worker online event
     */
    private async handleWorkerOnline(
        workerId: string,
        worker: cluster.Worker
    ): Promise<void> {
        this.workerPool.pending.delete(workerId);

        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.health.status = "healthy";
            this.workerPool.active.set(workerId, metrics);
            this.workerPool.currentSize++;
        }

        logger.info("cluster", `Worker ${workerId} is online`);
    }

    /**
     * Handle worker listening event
     */
    private async handleWorkerListening(
        workerId: string,
        worker: cluster.Worker
    ): Promise<void> {
        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.health.status = "healthy";
            metrics.health.lastCheck = new Date();
        }

        logger.info("cluster", `Worker ${workerId} is listening`);
    }

    /**
     * Handle worker disconnect event
     */
    private async handleWorkerDisconnect(
        workerId: string,
        worker: cluster.Worker
    ): Promise<void> {
        this.workerPool.active.delete(workerId);
        this.workerPool.draining.add(workerId);

        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.health.status = "critical";
        }

        logger.warn("cluster", `Worker ${workerId} disconnected`);
    }

    /**
     * Handle worker exit event with intelligent restart logic
     */
    private async handleWorkerExit(
        workerId: string,
        worker: cluster.Worker,
        code?: number,
        signal?: string
    ): Promise<void> {
        // Clean up worker references
        this.workers.delete(workerId);
        this.workerPool.active.delete(workerId);
        this.workerPool.pending.delete(workerId);
        this.workerPool.draining.delete(workerId);
        this.workerPool.currentSize = Math.max(
            0,
            this.workerPool.currentSize - 1
        );

        // Record death information
        this.workerPool.dead.set(workerId, {
            diedAt: new Date(),
            reason: signal ? `Signal: ${signal}` : `Exit code: ${code}`,
            exitCode: code,
            signal,
            restartCount: this.restartCounts.get(workerId) || 0,
        });

        // Update metrics
        const metrics = this.workerMetrics.get(workerId);
        if (metrics) {
            metrics.health.status = "dead";
        }

        this.emit("worker:died", workerId, code || 0, signal || "");

        logger.error(
            "cluster",
            `Worker ${workerId} exited with code ${code} and signal ${signal}`
        );

        // Attempt restart if conditions are met
        if (
            this.shouldRestartWorker(workerId, code, signal) &&
            !this.isShuttingDown
        ) {
            await this.restartWorker(workerId);
        }
    }

    /**
     * Enhanced worker restart decision logic
     */
    private shouldRestartWorker(
        workerId: string,
        code?: number,
        signal?: string
    ): boolean {
        const respawnConfig = this.config.processManagement?.respawn;
        if (respawnConfig === false) return false;

        const maxRestarts = this.config.processManagement?.maxRestarts || 5;
        const currentRestarts = this.restartCounts.get(workerId) || 0;

        if (currentRestarts >= maxRestarts) {
            logger.warn(
                "cluster",
                `Worker ${workerId} exceeded max restarts (${maxRestarts})`
            );
            return false;
        }

        // Don't restart on intentional shutdown
        if (
            signal === "SIGTERM" ||
            signal === "SIGINT" ||
            signal === "SIGKILL"
        ) {
            return false;
        }

        // Don't restart on successful exit
        if (code === 0) {
            return false;
        }

        // Check restart rate limiting
        const lastRestart = this.lastRestartTime.get(workerId);
        if (lastRestart) {
            const timeSinceRestart = Date.now() - lastRestart.getTime();
            const minRestartInterval = 10000; // 10 seconds minimum between restarts

            if (timeSinceRestart < minRestartInterval) {
                logger.warn(
                    "cluster",
                    `Worker ${workerId} restart rate limited`
                );
                return false;
            }
        }

        return true;
    }

    /**
     * Restart worker with exponential backoff
     */
    private async restartWorker(workerId: string): Promise<void> {
        const currentRestarts = this.restartCounts.get(workerId) || 0;
        const baseDelay = this.config.processManagement?.restartDelay || 1000;

        // Exponential backoff: delay = baseDelay * 2^restarts (max 30 seconds)
        const restartDelay = Math.min(
            baseDelay * Math.pow(2, currentRestarts),
            30000
        );

        // Update restart tracking
        this.restartCounts.set(workerId, currentRestarts + 1);
        this.lastRestartTime.set(workerId, new Date());

        logger.info(
            "cluster",
            `Restarting worker ${workerId} in ${restartDelay}ms (attempt ${
                currentRestarts + 1
            })`
        );

        // Wait for restart delay
        await new Promise((resolve) => setTimeout(resolve, restartDelay));

        try {
            // Fork new worker
            const newWorker = (cluster as any).fork();
            const newWorkerId = this.getWorkerId(newWorker);

            // Transfer restart history to new worker
            this.restartCounts.set(newWorkerId, currentRestarts + 1);
            this.lastRestartTime.set(newWorkerId, new Date());

            this.emit("worker:restarted", newWorkerId, workerId);

            logger.info(
                "cluster",
                `Successfully restarted worker ${workerId} as ${newWorkerId}`
            );
        } catch (error: any) {
            logger.error(
                "cluster",
                `Failed to restart worker ${workerId}: ${error.message}`
            );

            const securityError = createSecurityError(
                `Worker restart failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "WORKER_RESTART_ERROR",
                { operation: "restart_worker" }
            );
            this.errorLogger.logError(securityError);
        }
    }

    /**
     * Generate deterministic worker ID
     */
    private getWorkerId(worker: cluster.Worker): string {
        return `worker_${worker.id}_${worker.process.pid || "unknown"}`;
    }

    /**
     * Start workers with intelligent batching
     */
    public async startWorkers(count?: number): Promise<void> {
        if (!(cluster as any).isPrimary && !(cluster as any).isMaster) {
            throw new Error(
                "startWorkers can only be called from the primary process"
            );
        }

        const workerCount = count || this.workerPool.targetSize;
        const batchSize = Math.min(workerCount, 4); // Default batch size
        const startDelay = 200; // Default start delay

        logger.info(
            "cluster",
            `Starting ${workerCount} workers in batches of ${batchSize}`
        );

        for (let i = 0; i < workerCount; i += batchSize) {
            const batchPromises = [];
            const batchEnd = Math.min(i + batchSize, workerCount);

            // Start batch of workers
            for (let j = i; j < batchEnd; j++) {
                batchPromises.push(
                    this.startSingleWorkerInternal(j + 1, workerCount)
                );
            }

            // Wait for batch to complete
            await Promise.allSettled(batchPromises);

            // Delay between batches to avoid system overload
            if (batchEnd < workerCount) {
                await new Promise((resolve) => setTimeout(resolve, startDelay));
            }
        }

        logger.info(
            "cluster",
            `Successfully started ${this.workerPool.currentSize}/${workerCount} workers`
        );
    }

    /**
     * Internal method to start a single worker with enhanced error handling
     */
    private async startSingleWorkerInternal(
        workerNum: number,
        totalWorkers: number
    ): Promise<void> {
        try {
            const worker = (cluster as any).fork();
            const workerId = this.getWorkerId(worker);

            logger.info(
                "cluster",
                `Started worker ${workerNum}/${totalWorkers} (ID: ${workerId}, PID: ${worker.process.pid})`
            );

            // Wait for worker to come online with timeout
            await this.waitForWorkerOnline(worker, workerId);
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to start worker ${workerNum}: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "WORKER_START_ERROR",
                { operation: "start_worker" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }
}

