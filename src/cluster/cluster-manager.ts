/**
 * XyPrissJS Cluster Manager
 *  cluster management for Express applications with advanced monitoring
 */

import * as os from "os";
import { EventEmitter } from "events";
import {
    ClusterConfig,
    RobustClusterManager,
    ClusterMetrics,
    WorkerMetrics,
    ClusterState,
    ClusterEvents,
    PersistenceConfig,
    PersistentClusterState,
} from "../types/cluster";
import { WorkerManager } from "./modules/WorkerManager";
import { HealthMonitor } from "./modules/HealthMonitor";
import { LoadBalancer } from "./modules/strategy/LoadBalancer";
import { IPCManager } from "./modules/IPCManager";
import { MetricsCollector } from "./modules/MetricsCollector";
import { AutoScaler } from "./modules/AutoScaler";
import { ClusterPersistenceManager } from "./modules/ClusterPersistenceManager";
import {
    SecurityErrorLogger,
    createSecurityError,
    ErrorType,
    ErrorSeverity,
} from "../../mods/security/src/utils/errorHandler";
import { DEFAULT_CLUSTER_CONFIGS } from "../server/const/Cluster.config";
import { logger } from "../../shared/logger/Logger";
import clusterModule from "cluster";

/** 
 *  cluster manager with comprehensive monitoring and auto-scaling
 */
export class ClusterManager
    extends EventEmitter
    implements RobustClusterManager
{
    private config: ClusterConfig;
    private state: ClusterState = "initializing";
    private workerManager: WorkerManager;
    private healthMonitor: HealthMonitor;
    private loadBalancer: LoadBalancer;
    private ipcManager: IPCManager;
    private metricsCollector: MetricsCollector;
    private autoScaler: AutoScaler;
    private persistenceManager?: ClusterPersistenceManager;
    private errorLogger: SecurityErrorLogger;
    private startTime: Date = new Date();
    private isShuttingDown = false;
    private serverFactory?: () => Promise<void>;

    constructor(config: ClusterConfig = {}) {
        super();

        // Apply intelligent defaults
        this.config = this.applyDefaults(config);

        // Initialize components with fortified security
        this.errorLogger = new SecurityErrorLogger();
        this.workerManager = new WorkerManager(this.config, this.errorLogger);
        this.healthMonitor = new HealthMonitor(this.config, this.errorLogger);
        this.loadBalancer = new LoadBalancer(this.config);
        this.ipcManager = new IPCManager(this.config, this.errorLogger);
        this.metricsCollector = new MetricsCollector(this.config);
        this.autoScaler = new AutoScaler(this.config, this.errorLogger);

        // Initialize persistence manager if configured
        if (this.config.persistence?.enabled && this.config.persistence.type) {
            this.persistenceManager = new ClusterPersistenceManager(
                this.config.persistence as PersistenceConfig
            );
        }

        // Setup component integrations
        this.setupComponentIntegrations();

        // Setup event forwarding
        this.setupEventForwarding();

        // Setup error handling
        this.setupErrorHandling();
    }

    /**
     * Apply intelligent defaults to cluster configuration
     */
    private applyDefaults(config: ClusterConfig): ClusterConfig {
        const defaults: ClusterConfig = DEFAULT_CLUSTER_CONFIGS;

        return this.mergeDeep(defaults, config);
    }

    /**
     * Deep merge configuration objects
     */
    private mergeDeep(target: any, source: any): any {
        const result = { ...target };

        for (const key in source) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                result[key] = this.mergeDeep(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Setup component integrations for cross-component communication
     */
    private setupComponentIntegrations(): void {
        // Integrate IPC Manager with Worker Manager
        this.ipcManager.setWorkerManager(this.workerManager);

        // Setup auto-scaler with worker manager and metrics collector integration
        this.autoScaler.setWorkerManager(this.workerManager);
        this.autoScaler.setMetricsCollector(this.metricsCollector);

        // Setup metrics collector with worker manager integration
        this.metricsCollector.setWorkerManager(this.workerManager);

        // Setup health monitor with worker manager integration
        this.healthMonitor.setWorkerManager(this.workerManager);

        // Setup load balancer with IPC manager integration
        this.loadBalancer.setIPCManager(this.ipcManager);
    }

    /**
     * Setup event forwarding between components
     */
    private setupEventForwarding(): void {
        // Forward worker manager events
        this.workerManager.on("worker:started", (workerId, pid) => {
            this.emit("worker:started", workerId, pid);
        });

        this.workerManager.on("worker:died", (workerId, code, signal) => {
            this.emit("worker:died", workerId, code, signal);
        });

        this.workerManager.on("worker:restarted", (workerId, reason) => {
            this.emit("worker:restarted", workerId, reason);
        });

        // Forward health monitor events
        this.healthMonitor.on("worker:health:warning", (workerId, metrics) => {
            this.emit("worker:health:warning", workerId, metrics);
        });

        this.healthMonitor.on("worker:health:critical", (workerId, metrics) => {
            this.emit("worker:health:critical", workerId, metrics);
        });

        // Forward auto-scaler events
        this.autoScaler.on("cluster:scaled", (action, newWorkerCount) => {
            this.emit("cluster:scaled", action, newWorkerCount);
        });

        this.autoScaler.on(
            "scaling:triggered",
            (reason, currentWorkers, targetWorkers) => {
                this.emit(
                    "scaling:triggered",
                    reason,
                    currentWorkers,
                    targetWorkers
                );
            }
        );

        // Forward load balancer events
        this.loadBalancer.on("loadbalancer:updated", (strategy, weights) => {
            this.emit("loadbalancer:updated", strategy, weights);
        });

        // Forward IPC events
        this.ipcManager.on("ipc:message", (from, to, message) => {
            this.emit("ipc:message", from, to, message);
        });

        this.ipcManager.on("ipc:broadcast", (from, message) => {
            this.emit("ipc:broadcast", from, message);
        });

        // Forward metrics events
        this.metricsCollector.on("metrics:updated", (metrics) => {
            this.updateClusterState(metrics);
        });
    }

    /**
     * Setup comprehensive error handling
     */
    private setupErrorHandling(): void {
        // Handle uncaught exceptions
        process.on("uncaughtException", (error) => {
            const securityError = createSecurityError(
                `Uncaught exception in cluster manager: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.CRITICAL,
                "CLUSTER_UNCAUGHT_EXCEPTION",
                { operation: "cluster_manager" }
            );
            this.errorLogger.logError(securityError);

            if (this.config.errorHandling?.uncaughtException === "restart") {
                this.handleCriticalError("uncaught_exception");
            }
        });

        // Handle unhandled rejections
        process.on("unhandledRejection", (reason) => {
            const securityError = createSecurityError(
                `Unhandled rejection in cluster manager: ${reason}`,
                ErrorType.INTERNAL,
                ErrorSeverity.CRITICAL,
                "CLUSTER_UNHANDLED_REJECTION",
                { operation: "cluster_manager" }
            );
            this.errorLogger.logError(securityError);

            if (this.config.errorHandling?.unhandledRejection === "restart") {
                this.handleCriticalError("unhandled_rejection");
            }
        });
    }

    /**
     * Update cluster state based on metrics
     */
    private updateClusterState(metrics: ClusterMetrics): void {
        // Update state based on cluster health
        if (metrics.healthOverall.status === "critical") {
            this.state = "degraded";
        } else if (metrics.activeWorkers === 0) {
            this.state = "stopped";
        } else if (this.state === "initializing" || this.state === "starting") {
            this.state = "running";
        }
    }

    /**
     * Handle critical errors with recovery strategies
     */
    private async handleCriticalError(errorType: string): Promise<void> {
        logger.error("cluster", `Critical error detected: ${errorType}`);

        try {
            // Attempt graceful recovery
            await this.restart();
        } catch (error) {
            logger.error(
                "cluster",
                "Failed to recover from critical error:",
                error
            );
            process.exit(1);
        }
    }

    // ===== CORE CLUSTER MANAGEMENT METHODS =====

    /**
     * Start the cluster with intelligent worker management
     */
    public async start(): Promise<void> {
        if (this.state === "running") {
            logger.debug("cluster", "Cluster is already running");
            return;
        }

        this.state = "starting";

        try {
            // logger.debug( "cluster","Starting cluster...");

            // Determine if we're in master or worker process

            if (clusterModule.isMaster) {
                logger.debug("cluster", "Starting as cluster master process");

                // Start monitoring components
                this.healthMonitor.startMonitoring();
                this.metricsCollector.startCollection();

                // Start workers
                await this.workerManager.startWorkers();

                // Update auto-scaler with initial worker count
                const workerCount =
                    this.workerManager.getActiveWorkers().length;
                this.autoScaler.updateWorkerCount(workerCount);

                // Setup graceful shutdown
                this.setupGracefulShutdown();

                logger.debug(
                    "cluster",
                    `Cluster master started with ${workerCount} workers`
                );
            } else {
                logger.debug("cluster", `Worker ${process.pid} started`);

                // Worker-specific initialization
                this.setupWorkerProcess();
            }

            this.state = "running";
            // logger.debug( "cluster","XyPrissJS cluster started successfully");
        } catch (error: any) {
            this.state = "error";
            const securityError = createSecurityError(
                `Cluster start failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.CRITICAL,
                "CLUSTER_START_ERROR",
                { operation: "start" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Setup worker process initialization
     */
    private setupWorkerProcess(): void {
        // Set worker environment
        process.env.WORKER_ID =
            process.env.WORKER_ID || process.pid?.toString() || "unknown";
        process.env.NODE_ENV = "worker";

        // Setup worker-specific error handling
        process.on("uncaughtException", (error) => {
            logger.error("cluster", "Worker uncaught exception:", error);
            process.exit(1);
        });

        process.on("unhandledRejection", (reason, promise) => {
            logger.error(
                "cluster",
                "Worker unhandled rejection at:",
                promise,
                "reason:",
                reason
            );
            process.exit(1);
        });

        // Send ready signal to master
        if (process.send) {
            process.send({
                type: "worker_ready",
                workerId: process.env.WORKER_ID,
                pid: process.pid,
            });
        }
    }

    /**
     * Setup graceful shutdown handling
     */
    private setupGracefulShutdown(): void {
        const gracefulShutdown = async (signal: string) => {
            logger.debug(
                "cluster",
                `Received ${signal}, starting graceful shutdown...`
            );
            try {
                await this.stop();
                process.exit(0);
            } catch (error) {
                logger.error(
                    "cluster",
                    "Error during graceful shutdown:",
                    error
                );
                process.exit(1);
            }
        };

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    }

    /**
     * Stop the cluster gracefully or forcefully
     */
    public async stop(graceful: boolean = true): Promise<void> {
        if (this.state === "stopped" || this.state === "stopping") {
            logger.debug("cluster", "Cluster is already stopped or stopping");
            return;
        }

        this.state = "stopping";

        try {
            logger.debug(
                "cluster",
                `Stopping cluster ${graceful ? "gracefully" : "forcefully"}...`
            );

            // Stop monitoring
            this.healthMonitor.stopMonitoring();
            this.metricsCollector.stopCollection();
            this.autoScaler.stopScaling();

            // Stop all workers
            await this.workerManager.stopAllWorkers(graceful);

            // Close persistence manager
            await this.closePersistenceManager();

            this.state = "stopped";
            logger.debug("cluster", "Cluster stopped successfully");
        } catch (error: any) {
            this.state = "error";
            const securityError = createSecurityError(
                `Cluster stop failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "CLUSTER_STOP_ERROR",
                { operation: "stop" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Restart the cluster or specific worker
     */
    public async restart(workerId?: string): Promise<void> {
        if (workerId) {
            // Restart specific worker using WorkerManager
            try {
                logger.debug("cluster", `Restarting worker ${workerId}...`);

                // Use WorkerManager to restart the specific worker
                const newWorkerId = await this.replaceWorker(workerId);

                this.emit("worker:restarted", newWorkerId, "manual_restart");
                logger.debug(
                    "cluster",
                    `Worker ${workerId} restarted as ${newWorkerId}`
                );
            } catch (error: any) {
                const securityError = createSecurityError(
                    `Failed to restart worker ${workerId}: ${error.message}`,
                    ErrorType.INTERNAL,
                    ErrorSeverity.HIGH,
                    "WORKER_RESTART_ERROR",
                    { operation: "restart_worker" }
                );
                this.errorLogger.logError(securityError);
                throw error;
            }
        } else {
            // Restart entire cluster
            try {
                logger.debug("cluster", "Restarting entire cluster...");
                await this.stop(true);
                await new Promise((resolve) => setTimeout(resolve, 2000)); // Brief pause
                await this.start();
                logger.debug("cluster", "Cluster restarted successfully");
            } catch (error: any) {
                const securityError = createSecurityError(
                    `Failed to restart cluster: ${error.message}`,
                    ErrorType.INTERNAL,
                    ErrorSeverity.CRITICAL,
                    "CLUSTER_RESTART_ERROR",
                    { operation: "restart_cluster" }
                );
                this.errorLogger.logError(securityError);
                throw error;
            }
        }
    }

    /**
     * Pause cluster operations
     */
    public async pause(): Promise<void> {
        if (this.state !== "running") {
            throw new Error("Cannot pause cluster: not running");
        }

        this.state = "paused";

        // Pause monitoring
        this.healthMonitor.stopMonitoring();
        this.autoScaler.disable();

        logger.debug("cluster", "Cluster paused");
    }

    /**
     * Resume cluster operations
     */
    public async resume(): Promise<void> {
        if (this.state !== "paused") {
            throw new Error("Cannot resume cluster: not paused");
        }

        this.state = "running";

        // Resume monitoring
        this.healthMonitor.startMonitoring();
        this.autoScaler.enable();

        logger.debug("cluster", "Cluster resumed");
    }

    // ===== WORKER MANAGEMENT METHODS =====

    /**
     * Add new worker to the cluster
     */
    public async addWorker(): Promise<string> {
        const workers = this.workerManager.getActiveWorkers();
        const maxWorkers = this.config.autoScaling?.maxWorkers || 8;

        if (workers.length >= maxWorkers) {
            throw new Error("Cannot add worker: maximum worker limit reached");
        }

        try {
            // Use WorkerManager to actually start a worker
            const workerId = await this.workerManager.startSingleWorker();

            // Update auto-scaler with new worker count
            this.autoScaler.updateWorkerCount(workers.length + 1);

            this.emit("worker:started", workerId, 0);
            return workerId;
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to add worker: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "WORKER_ADD_ERROR",
                { operation: "add_worker" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Remove worker from the cluster
     */
    public async removeWorker(
        workerId: string,
        graceful: boolean = true
    ): Promise<void> {
        const workers = this.workerManager.getActiveWorkers();
        const minWorkers = this.config.autoScaling?.minWorkers || 1;

        if (workers.length <= minWorkers) {
            throw new Error(
                "Cannot remove worker: minimum worker limit reached"
            );
        }

        try {
            // Use WorkerManager to actually stop the worker
            await this.workerManager.stopSingleWorker(workerId, graceful);

            // Update auto-scaler with new worker count
            this.autoScaler.updateWorkerCount(workers.length - 1);

            this.emit(
                "worker:died",
                workerId,
                0,
                graceful ? "SIGTERM" : "SIGKILL"
            );
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to remove worker ${workerId}: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.HIGH,
                "WORKER_REMOVE_ERROR",
                { operation: "remove_worker" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Replace worker with a new one
     */
    public async replaceWorker(workerId: string): Promise<string> {
        logger.debug("cluster", `Replacing worker ${workerId}...`);

        // Start new worker first
        const newWorkerId = await this.addWorker();

        // Wait for new worker to be ready
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Remove old worker
        await this.removeWorker(workerId, true);

        return newWorkerId;
    }

    /**
     * Get worker by ID
     */
    public getWorker(workerId: string): WorkerMetrics | null {
        return this.workerManager.getWorker(workerId);
    }

    /**
     * Get all workers
     */
    public getAllWorkers(): WorkerMetrics[] {
        return this.workerManager.getActiveWorkers();
    }

    /**
     * Get active workers
     */
    public getActiveWorkers(): WorkerMetrics[] {
        return this.workerManager
            .getActiveWorkers()
            .filter(
                (w) =>
                    w.health.status === "healthy" ||
                    w.health.status === "warning"
            );
    }

    /**
     * Get unhealthy workers
     */
    public getUnhealthyWorkers(): WorkerMetrics[] {
        return this.workerManager
            .getActiveWorkers()
            .filter(
                (w) =>
                    w.health.status === "critical" || w.health.status === "dead"
            );
    }

    // ===== HEALTH MONITORING METHODS =====

    /**
     * Check health of specific worker or all workers
     */
    public async checkHealth(workerId?: string): Promise<boolean> {
        if (workerId) {
            return await this.healthMonitor.checkWorkerHealth(workerId);
        } else {
            await this.healthMonitor.performHealthChecks();
            const healthStatus = this.healthMonitor.getHealthStatus();
            return Object.values(healthStatus).every((healthy) => healthy);
        }
    }

    /**
     * Get health status of all workers
     */
    public async getHealthStatus(): Promise<{ [workerId: string]: boolean }> {
        return this.healthMonitor.getHealthStatus();
    }

    /**
     * Run comprehensive health check
     */
    public async runHealthCheck(): Promise<void> {
        await this.healthMonitor.performHealthChecks();
    }

    // ===== METRICS AND MONITORING METHODS =====

    /**
     * Get comprehensive cluster metrics
     */
    public async getMetrics(): Promise<ClusterMetrics> {
        return this.metricsCollector.getClusterMetrics();
    }

    /**
     * Get metrics for specific worker
     */
    public async getWorkerMetrics(
        workerId: string
    ): Promise<WorkerMetrics | null> {
        return this.metricsCollector.getWorkerMetrics(workerId);
    }

    /**
     * Get aggregated metrics summary
     */
    public async getAggregatedMetrics(): Promise<{
        cpu: number;
        memory: number;
        requests: number;
        errors: number;
        responseTime: number;
    }> {
        return this.metricsCollector.getAggregatedMetrics();
    }

    /**
     * Start monitoring systems
     */
    public startMonitoring(): void {
        this.healthMonitor.startMonitoring();
        this.metricsCollector.startCollection();
        logger.debug("cluster", "Monitoring systems started");
    }

    /**
     * Stop monitoring systems
     */
    public stopMonitoring(): void {
        this.healthMonitor.stopMonitoring();
        this.metricsCollector.stopCollection();
        logger.debug("cluster", "Monitoring systems stopped");
    }

    /**
     * Export metrics in specified format
     */
    public async exportMetrics(
        format: "json" | "prometheus" | "csv" = "json"
    ): Promise<string> {
        return await this.metricsCollector.exportMetrics(format);
    }

    // ===== SCALING METHODS =====

    /**
     * Scale up by adding workers
     */
    public async scaleUp(count: number = 1): Promise<void> {
        await this.autoScaler.scaleUp(count);
    }

    /**
     * Scale down by removing workers
     */
    public async scaleDown(count: number = 1): Promise<void> {
        await this.autoScaler.scaleDown(count);
    }

    /**
     * Perform auto-scaling evaluation
     */
    public async autoScale(): Promise<void> {
        await this.autoScaler.autoScale();
    }

    /**
     * Get optimal worker count
     */
    public async getOptimalWorkerCount(): Promise<number> {
        return await this.autoScaler.getOptimalWorkerCount();
    }

    // ===== LOAD BALANCING METHODS =====

    /**
     * Update load balancing strategy
     */
    public async updateLoadBalancingStrategy(
        strategy: string,
        options?: any
    ): Promise<void> {
        await this.loadBalancer.updateStrategy(strategy, options);
    }

    /**
     * Get load balance status
     */
    public async getLoadBalanceStatus(): Promise<{
        [workerId: string]: number;
    }> {
        const status = this.loadBalancer.getLoadBalanceStatus();
        return status.connections;
    }

    /**
     * Redistribute load across workers
     */
    public async redistributeLoad(): Promise<void> {
        await this.loadBalancer.redistributeLoad();
    }

    // ===== IPC METHODS =====

    /**
     * Send message to specific worker
     */
    public async sendToWorker(workerId: string, message: any): Promise<void> {
        await this.ipcManager.sendToWorker(workerId, message);
    }

    /**
     * Send message to all workers
     */
    public async sendToAllWorkers(message: any): Promise<void> {
        await this.ipcManager.sendToAllWorkers(message);
    }

    /**
     * Broadcast message to all workers
     */
    public async broadcast(message: any): Promise<void> {
        await this.ipcManager.broadcast(message);
    }

    /**
     * Send message to random worker
     */
    public async sendToRandomWorker(message: any): Promise<void> {
        await this.ipcManager.sendToRandomWorker(message);
    }

    /**
     * Send message to least loaded worker
     */
    public async sendToLeastLoadedWorker(message: any): Promise<void> {
        await this.ipcManager.sendToLeastLoadedWorker(message);
    }

    /**
     * Select worker for request using load balancing strategy
     */
    public selectWorkerForRequest(
        workers: WorkerMetrics[],
        request?: any
    ): string {
        return this.loadBalancer.selectWorkerForRequest(workers, request);
    }

    // /**
    //  * Get worker metrics for load balancing
    //  */
    // public getWorkerMetrics(): WorkerMetrics[] {
    //     return this.getAllWorkers();
    // }

    // ===== EVENT HANDLING METHODS =====

    /**
     * Register event handler
     */
    public addListener<K extends keyof ClusterEvents>(
        event: K,
        handler: ClusterEvents[K]
    ): this {
        return super.on(event as string, handler as any);
    }

    /**
     * Remove event handler
     */
    public removeListener<K extends keyof ClusterEvents>(
        event: K,
        handler: ClusterEvents[K]
    ): this {
        return super.off(event as string, handler as any);
    }

    /**
     * Emit cluster event
     */
    public emitEvent<K extends keyof ClusterEvents>(
        event: K,
        ...args: Parameters<ClusterEvents[K]>
    ): boolean {
        return super.emit(event as string, ...args);
    }

    // ===== STATE MANAGEMENT METHODS =====

    /**
     * Save cluster state
     */
    public async saveState(): Promise<void> {
        try {
            // Create comprehensive persistent state
            const persistentState: PersistentClusterState = {
                state: this.state,
                config: this.config,
                workers: this.workerManager
                    .getActiveWorkers()
                    .map((worker) => ({
                        id: worker.workerId,
                        pid: worker.pid,
                        status:
                            worker.health.status === "healthy"
                                ? ("running" as const)
                                : ("stopped" as const),
                        startTime: worker.lastRestart || new Date(),
                        restarts: worker.restarts,
                        metrics: worker,
                    })),
                metrics: this.metricsCollector.exportMetricsForPersistence(),
                loadBalancer: {
                    strategy:
                        this.config.loadBalancing?.strategy || "round-robin",
                    weights: {},
                    distribution: {},
                    historicalTrends: {
                        requestsPerMinute: [],
                        averageResponseTimes: [],
                        errorRates: [],
                    },
                },
                timestamp: new Date(),
                version: "1.0.0",
            };

            // Save to persistent storage
            await this.saveClusterStateToPersistentStorage(persistentState);
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to save cluster state: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.MEDIUM,
                "CLUSTER_STATE_SAVE_ERROR",
                { operation: "save_state" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Restore cluster state
     */
    public async restoreState(): Promise<void> {
        try {
            // Restore from persistent storage
            const savedState =
                await this.loadClusterStateFromPersistentStorage();

            if (savedState) {
                await this.applyRestoredState(savedState);
                logger.debug(
                    "cluster",
                    " Cluster state restored from persistent storage"
                );
            } else {
                logger.debug(
                    "cluster",
                    "No saved cluster state found, starting fresh"
                );
            }
            // if (savedState) {
            //     await this.applyRestoredState(savedState);
            // }
        } catch (error: any) {
            const securityError = createSecurityError(
                `Failed to restore cluster state: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.MEDIUM,
                "CLUSTER_STATE_RESTORE_ERROR",
                { operation: "restore_state" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Get current cluster state
     */
    public async getState(): Promise<ClusterState> {
        return this.state;
    }

    /**
     * Export cluster configuration
     */
    public async exportConfiguration(): Promise<ClusterConfig> {
        return { ...this.config };
    }

    // ===== UTILITY METHODS =====

    /**
     * Check if cluster is healthy
     */
    public isHealthy(): boolean {
        const activeWorkers = this.getActiveWorkers();
        const totalWorkers = this.getAllWorkers();

        if (totalWorkers.length === 0) return false;

        const healthyPercentage =
            (activeWorkers.length / totalWorkers.length) * 100;
        return healthyPercentage >= 70; // 70% threshold
    }

    /**
     * Get load balance score
     */
    public getLoadBalance(): number {
        return this.loadBalancer.getLoadDistributionEfficiency();
    }

    /**
     * Get recommended worker count
     */
    public getRecommendedWorkerCount(): number {
        const cpuCount = os.cpus().length;
        const currentLoad = this.getActiveWorkers().length;

        // Simple recommendation based on CPU cores and current load (but we'll enhance it later (maybe) @xana do it)
        return Math.max(1, Math.min(cpuCount - 1, currentLoad));
    }

    /**
     * Get cluster efficiency score
     */
    public getClusterEfficiency(): number {
        const loadBalanceEfficiency = this.getLoadBalance();
        const healthScore = this.isHealthy() ? 100 : 50;
        const utilizationScore = this.calculateUtilizationScore();

        return (loadBalanceEfficiency + healthScore + utilizationScore) / 3;
    }

    /**
     * Calculate utilization score
     */
    private calculateUtilizationScore(): number {
        const workers = this.getActiveWorkers();
        if (workers.length === 0) return 0;

        const avgCpu =
            workers.reduce((sum, w) => sum + w.cpu.usage, 0) / workers.length;
        const avgMemory =
            workers.reduce((sum, w) => sum + w.memory.percentage, 0) /
            workers.length;

        // Optimal utilization is around 60-70%
        const optimalCpu = 65;
        const optimalMemory = 65;

        const cpuScore = 100 - Math.abs(avgCpu - optimalCpu);
        const memoryScore = 100 - Math.abs(avgMemory - optimalMemory);

        return (cpuScore + memoryScore) / 2;
    }

    // ===== ADVANCED FEATURES =====

    /**
     * Enable profiling for worker
     */
    public async enableProfiling(workerId: string): Promise<void> {
        logger.debug("cluster", `Enabling profiling for worker ${workerId}`);
        await this.sendToWorker(workerId, { type: "enable_profiling" });
    }

    /**
     * Disable profiling for worker
     */
    public async disableProfiling(workerId: string): Promise<void> {
        logger.debug("cluster", `Disabling profiling for worker ${workerId}`);
        await this.sendToWorker(workerId, { type: "disable_profiling" });
    }

    /**
     * Take heap snapshot of worker
     */
    public async takeHeapSnapshot(workerId: string): Promise<string> {
        const snapshotPath = `/tmp/heap-snapshot-${workerId}-${Date.now()}.heapsnapshot`;
        logger.debug(
            "cluster",
            `Taking heap snapshot for worker ${workerId}: ${snapshotPath}`
        );

        await this.sendToWorker(workerId, {
            type: "take_heap_snapshot",
            path: snapshotPath,
        });

        return snapshotPath;
    }

    /**
     * Enable debug mode for worker
     */
    public async enableDebugMode(
        workerId: string,
        port?: number
    ): Promise<void> {
        const debugPort = port || 9229;
        logger.debug(
            "cluster",
            `Enabling debug mode for worker ${workerId} on port ${debugPort}`
        );

        await this.sendToWorker(workerId, {
            type: "enable_debug",
            port: debugPort,
        });
    }

    /**
     * Disable debug mode for worker
     */
    public async disableDebugMode(workerId: string): Promise<void> {
        logger.debug("cluster", `Disabling debug mode for worker ${workerId}`);
        await this.sendToWorker(workerId, { type: "disable_debug" });
    }

    // ===== ROLLING UPDATES =====

    /**
     * Perform rolling update
     */
    public async performRollingUpdate(
        updateFn: () => Promise<void>
    ): Promise<void> {
        logger.debug("cluster", "Starting rolling update...");

        const workers = this.getAllWorkers();
        const maxUnavailable =
            this.config.advanced?.deployment?.maxUnavailable || 1;

        for (let i = 0; i < workers.length; i += maxUnavailable) {
            const batch = workers.slice(i, i + maxUnavailable);

            // Drain workers in batch
            for (const worker of batch) {
                await this.drainWorker(worker.workerId);
            }

            // Perform update
            await updateFn();

            // Replace workers
            for (const worker of batch) {
                await this.replaceWorker(worker.workerId);
            }

            // Wait for new workers to be ready
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        logger.debug("cluster", "Rolling update completed");
    }

    /**
     * Drain worker connections
     */
    public async drainWorker(workerId: string): Promise<void> {
        logger.debug("cluster", `Draining worker ${workerId}...`);

        await this.sendToWorker(workerId, { type: "drain_connections" });

        // Wait for connections to drain
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    // ===== CIRCUIT BREAKER =====

    /**
     * Check if circuit breaker is open
     */
    public isCircuitOpen(workerId?: string): boolean {
        if (workerId) {
            const worker = this.getWorker(workerId);
            return worker ? worker.health.consecutiveFailures >= 5 : false;
        }

        // Check overall cluster circuit breaker
        const unhealthyWorkers = this.getUnhealthyWorkers();
        const totalWorkers = this.getAllWorkers();

        return (
            totalWorkers.length > 0 &&
            unhealthyWorkers.length / totalWorkers.length > 0.5
        );
    }

    /**
     * Reset circuit breaker
     */
    public async resetCircuitBreaker(workerId?: string): Promise<void> {
        if (workerId) {
            logger.debug(
                "cluster",
                `Resetting circuit breaker for worker ${workerId}`
            );
            await this.sendToWorker(workerId, {
                type: "reset_circuit_breaker",
            });
        } else {
            logger.debug("cluster", "Resetting cluster circuit breaker");
            // Reset all worker circuit breakers
            const workers = this.getAllWorkers();
            for (const worker of workers) {
                await this.sendToWorker(worker.workerId, {
                    type: "reset_circuit_breaker",
                });
            }
        }
    }

    // ===== CLEANUP METHODS =====

    /**
     * Cleanup cluster resources
     */
    public async cleanup(): Promise<void> {
        logger.debug("cluster", "Cleaning up cluster resources...");

        await this.stop(true);

        // Cleanup monitoring
        this.healthMonitor.stopMonitoring();
        this.metricsCollector.stopCollection();
        this.autoScaler.stopScaling();

        logger.debug("cluster", "Cluster cleanup completed");
    }

    /**
     * Force cleanup cluster resources
     */
    public async forceCleanup(): Promise<void> {
        logger.debug("cluster", "Force cleaning up cluster resources...");

        await this.stop(false);

        // Force cleanup
        this.removeAllListeners();

        logger.debug("cluster", "Force cleanup completed");
    }

    // ===== PERSISTENCE METHODS =====

    /**
     * Save cluster state to persistent storage
     */
    private async saveClusterStateToPersistentStorage(
        clusterState: PersistentClusterState
    ): Promise<void> {
        if (!this.persistenceManager) {
            // Fallback: emit event for external handling
            this.emit("cluster:state:saved", clusterState);
            return;
        }

        try {
            await this.persistenceManager.saveClusterState(clusterState);
        } catch (error: any) {
            logger.warn(
                "cluster",
                `Failed to save cluster state: ${error.message}`
            );
            // Emit event as fallback
            this.emit("cluster:state:saved", clusterState);
        }
    }

    /**
     * Load cluster state from persistent storage
     */
    private async loadClusterStateFromPersistentStorage(): Promise<PersistentClusterState | null> {
        if (!this.persistenceManager) {
            // Fallback: emit event for external handling
            this.emit("cluster:state:restore_requested");
            return null;
        }

        try {
            return await this.persistenceManager.loadClusterState();
        } catch (error: any) {
            logger.warn(
                "cluster",
                `Failed to load cluster state: ${error.message}`
            );
            return null;
        }
    }

    /**
     * Apply restored cluster state
     */
    private async applyRestoredState(
        savedState: PersistentClusterState
    ): Promise<void> {
        try {
            if (savedState.workers) {
                // Restore worker configurations
                for (const workerState of savedState.workers) {
                    if (workerState.status === "running") {
                        // Try to reconnect to existing worker or spawn new one
                        await this.restoreOrSpawnWorker(workerState);
                    }
                }
            }

            if (savedState.config) {
                // Apply saved configuration (merge with current)
                this.config = { ...this.config, ...savedState.config };
            }

            if (savedState.metrics) {
                // Restore metrics using the MetricsCollector
                if (savedState.metrics.historicalData) {
                    this.metricsCollector.restoreHistoricalData(
                        savedState.metrics.historicalData
                    );
                }

                if (savedState.metrics.workerHistory) {
                    this.metricsCollector.restoreWorkerHistoricalData(
                        savedState.metrics.workerHistory
                    );
                }

                logger.debug(
                    "cluster",
                    "✔ Restored metrics from persistent storage"
                );
            }
        } catch (error: any) {
            logger.warn(
                "cluster",
                `Failed to apply restored state: ${error.message}`
            );
        }
    }

    /**
     * Restore or spawn worker from saved state
     */
    private async restoreOrSpawnWorker(workerState: any): Promise<void> {
        try {
            // Check if worker process still exists
            const existingWorker = this.workerManager.getWorker(workerState.id);

            if (!existingWorker) {
                // Worker doesn't exist, spawn a new one
                logger.debug(
                    "cluster",
                    `Spawning new worker to replace ${workerState.id}`
                );
                await this.addWorker();
            } else {
                logger.debug(
                    "cluster",
                    `Worker ${workerState.id} already exists and running`
                );
            }
        } catch (error: any) {
            logger.warn(
                "cluster",
                `Failed to restore worker ${workerState.id}: ${error.message}`
            );
        }
    }

    /**
     * Get persistence manager statistics
     */
    public getPersistenceStats(): any {
        if (!this.persistenceManager) {
            return { enabled: false, type: "none" };
        }

        return this.persistenceManager.getStats();
    }

    /**
     * Close persistence manager
     */
    private async closePersistenceManager(): Promise<void> {
        if (this.persistenceManager) {
            await this.persistenceManager.close();
        }
    }
}

