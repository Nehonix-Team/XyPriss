import { ClusterManager } from "../../../cluster/cluster-manager";
import { BunClusterManager } from "../../../cluster/bun-cluster-manager";
import {
    ClusterManagerComponentDependencies,
    ClusterManagerComponentOptions,
} from "../../../types/components/ClusterMC.type";
import { logger } from "../../../../shared/logger/Logger";
import { BunIPCManager } from "../../../cluster/modules/BunIPCManager";

/**
 * Check if the current runtime supports clustering
 */
function isClusteringSupported(): boolean {
    // Bun doesn't fully support Node.js cluster module
    if (process.versions.bun) {
        return false;
    }

    // Check if cluster module is available
    try {
        const cluster = require("cluster");
        return typeof cluster.fork === "function";
    } catch {
        return false;
    } 
}

/**
 * ClusterManagerComponent - Handles all cluster-related operations for FastApi.ts
 * Manages cluster configuration, scaling, worker management, and IPC
 */
export class ClusterManagerComponent {
    protected readonly options: ClusterManagerComponentOptions;
    protected readonly dependencies: ClusterManagerComponentDependencies;
    private cluster?: ClusterManager;
    private bunCluster?: BunClusterManager;
    private ipcManager?: BunIPCManager;

    constructor(
        options: ClusterManagerComponentOptions,
        dependencies: ClusterManagerComponentDependencies
    ) {
        this.options = options;
        this.dependencies = dependencies;

        if (this.options.cluster?.enabled) {
            this.initializeCluster();
        }
    }

    /**
     * Initialize cluster manager
     */
    private initializeCluster(): void {
        if (!this.options.cluster?.enabled) return;

        // Check for cluster bypass environment variables
        if (
            process.env.DISABLE_CLUSTERING === "true" ||
            process.env.SINGLE_PROCESS === "true"
        ) {
            logger.info(
                "cluster",
                "Clustering disabled via environment variable, enabling single-process mode"
            );
            this._enableSingleProcessFallback();
            return;
        }

        // Prevent workers from creating their own clusters (fix recursive clustering)
        const clusterModule = require("cluster");
        if (
            clusterModule.isWorker ||
            process.env.CLUSTER_MODE === "true" ||
            process.env.NODE_ENV === "worker"
        ) {
            logger.debug(
                "cluster",
                "Running in worker mode - skipping cluster initialization"
            );
            return;
        }

        // Check if we're running in Bun
        if (process.versions.bun) {
            logger.info(
                "cluster",
                "Bun runtime detected. Using Bun-compatible cluster manager."
            );
            this.initializeBunCluster();
            return;
        }

        // Check if clustering is supported in current runtime
        if (!isClusteringSupported()) {
            logger.warn(
                "cluster",
                "Clustering not supported in current runtime. Disabling cluster functionality."
            );
            logger.debug(
                "cluster",
                `Debug: process.versions.bun = ${process.versions.bun}`
            );
            try {
                const cluster = require("cluster");
                logger.debug(
                    "cluster",
                    `Debug: cluster.fork type = ${typeof cluster.fork}`
                );
                logger.debug(
                    "cluster",
                    `Debug: cluster.isWorker = ${cluster.isWorker}`
                );
                logger.debug(
                    "cluster",
                    `Debug: cluster.isMaster = ${cluster.isMaster}`
                );
            } catch (error) {
                logger.debug(
                    "cluster",
                    `Debug: cluster require failed = ${error}`
                );
            }
            return;
        }

        logger.debug("cluster", "Initializing Node.js cluster manager...");

        this.cluster = new ClusterManager(this.options.cluster.config || {});

        // Add cluster methods to app immediately when cluster is configured
        this.addClusterMethods();

        logger.debug("cluster", "Node.js cluster manager initialized");
    }

    /**
     * Initialize Bun cluster manager
     */
    private initializeBunCluster(): void {
        logger.debug("cluster", "Initializing Bun cluster manager...");

        // Get base port from server options or default
        const basePort =
            (this.dependencies.serverOptions as any)?.server?.port || 8085;

        this.bunCluster = new BunClusterManager(
            this.options.cluster?.config || {},
            basePort,
            this.dependencies.serverOptions // Pass full server options to workers
        );

        // Initialize IPC manager for Bun workers
        this.ipcManager = new BunIPCManager();

        // Connect IPC manager to cluster manager
        this.bunCluster.setIPCManager(this.ipcManager);

        // Add Bun cluster methods to app
        this.addBunClusterMethods();

        logger.debug("cluster", "Bun cluster manager initialized");
    }

    /**
     * Get cluster manager instance
     */
    public getCluster(): ClusterManager | undefined {
        return this.cluster;
    }

    /**
     * Get Bun cluster manager instance
     */
    public getBunCluster(): BunClusterManager | undefined {
        return this.bunCluster;
    }

    /**
     * Check if cluster is enabled
     */
    public isClusterEnabled(): boolean {
        // If cluster is configured as enabled
        if (this.options.cluster?.enabled === true) {
            // Master process: check if cluster manager exists
            if (this.cluster !== undefined || this.bunCluster !== undefined) {
                return true;
            }

            // Worker process: check if we're running in cluster mode
            const clusterModule = require("cluster");
            if (
                clusterModule.isWorker ||
                process.env.CLUSTER_MODE === "true" ||
                process.env.NODE_ENV === "worker"
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Add cluster management methods to the Express app
     */
    private addClusterMethods(): void {
        if (!this.cluster) return;

        logger.debug("cluster", "Adding cluster methods to app...");

        // Cluster scaling methods
        this.dependencies.app.scaleUp = async (count: number = 1) => {
            return await this.cluster!.scaleUp(count);
        };

        this.dependencies.app.scaleDown = async (count: number = 1) => {
            return await this.cluster!.scaleDown(count);
        };

        this.dependencies.app.autoScale = async () => {
            return await this.cluster!.autoScale();
        };

        // Cluster information methods
        this.dependencies.app.getClusterMetrics = async () => {
            return await this.cluster!.getMetrics();
        };

        this.dependencies.app.getClusterHealth = async () => {
            return await this.cluster!.checkHealth();
        };

        this.dependencies.app.getAllWorkers = () => {
            return this.cluster!.getAllWorkers();
        };

        this.dependencies.app.getOptimalWorkerCount = async () => {
            return await this.cluster!.getOptimalWorkerCount();
        };

        // Cluster management methods
        this.dependencies.app.restartCluster = async () => {
            return await this.cluster!.restart();
        };

        this.dependencies.app.stopCluster = async (
            graceful: boolean = true
        ) => {
            return await this.cluster!.stop(graceful);
        };

        // IPC methods
        this.dependencies.app.broadcastToWorkers = async (message: any) => {
            return await this.cluster!.broadcast(message);
        };

        this.dependencies.app.sendToRandomWorker = async (message: any) => {
            return await this.cluster!.sendToRandomWorker(message);
        };

        //  logger.debug(
        //                 "cluster","Cluster methods added to app");
    }

    /**
     * Add Bun cluster management methods to the Express app
     */
    private addBunClusterMethods(): void {
        if (!this.bunCluster) return;

        logger.debug("cluster", "Adding Bun cluster methods to app...");

        // Cluster scaling methods
        this.dependencies.app.scaleUp = async (count: number = 1) => {
            return await this.bunCluster!.scaleUp(count);
        };

        this.dependencies.app.scaleDown = async (count: number = 1) => {
            return await this.bunCluster!.scaleDown(count);
        };

        this.dependencies.app.autoScale = async () => {
            // Simple auto-scaling logic for Bun
            const metrics = await this.bunCluster!.getMetrics();
            const activeWorkers = this.bunCluster!.getActiveWorkers();

            if (activeWorkers.length < 2 && metrics.cpuUsage > 80) {
                await this.bunCluster!.scaleUp(1);
            } else if (activeWorkers.length > 1 && metrics.cpuUsage < 30) {
                await this.bunCluster!.scaleDown(1);
            }
        };

        // Cluster information methods
        this.dependencies.app.getClusterMetrics = async () => {
            return await this.bunCluster!.getMetrics();
        };

        this.dependencies.app.getClusterHealth = async () => {
            return await this.bunCluster!.checkHealth();
        };

        this.dependencies.app.getAllWorkers = () => {
            return this.bunCluster!.getAllWorkers();
        };

        this.dependencies.app.getOptimalWorkerCount = async () => {
            // Simple calculation for Bun
            const cpuCount = navigator.hardwareConcurrency || 4;
            return Math.max(1, cpuCount - 1);
        };

        // Cluster management methods
        this.dependencies.app.restartCluster = async () => {
            await this.bunCluster!.stop(true);
            await this.bunCluster!.start();
        };

        this.dependencies.app.stopCluster = async (
            graceful: boolean = true
        ) => {
            return await this.bunCluster?.stop(graceful);
        };

        // IPC methods using BunIPCManager
        this.dependencies.app.broadcastToWorkers = async (
            message: any
        ): Promise<void> => {
            if (!this.ipcManager) {
                throw new Error("IPC Manager not initialized");
            }
            logger.info("cluster", "Broadcasting to Bun workers:", message);
            try {
                await this.ipcManager.broadcastToWorkers(
                    "app_message",
                    message
                );
                logger.debug("cluster", "Broadcast completed successfully");
            } catch (error) {
                logger.error("cluster", "Failed to broadcast message:", error);
                throw error;
            }
        };

        this.dependencies.app.sendToRandomWorker = async (
            message: any
        ): Promise<void> => {
            if (!this.ipcManager) {
                throw new Error("IPC Manager not initialized");
            }
            logger.info("cluster", "Sending to random Bun worker:", message);
            try {
                await this.ipcManager.sendToRandomWorker(
                    "app_message",
                    message
                );
                logger.debug(
                    "cluster",
                    "Message sent to random worker successfully"
                );
            } catch (error) {
                logger.error(
                    "cluster",
                    "Failed to send message to random worker:",
                    error
                );
                throw error;
            }
        };

        logger.debug("cluster", "Bun cluster methods added to app");
    }

    /**
     * Setup Bun cluster event handlers
     */
    private setupBunClusterEventHandlers(): void {
        if (!this.bunCluster) return;

        logger.debug("cluster", "Setting up Bun cluster event handlers...");

        this.bunCluster.on("cluster:started", (data) => {
            logger.info(
                "cluster",
                `Bun cluster started with ${data.workerCount} workers`
            );
        });

        this.bunCluster.on("worker:started", (data) => {
            logger.info(
                "cluster",
                `Bun worker ${data.workerId} started on port ${data.port}`
            );
        });

        this.bunCluster.on("worker:stopped", (data) => {
            logger.info("cluster", `Bun worker ${data.workerId} stopped`);
        });

        this.bunCluster.on("worker:exit", (data) => {
            logger.warn(
                "cluster",
                `Bun worker ${data.workerId} exited with code ${data.exitCode}`
            );
        });

        this.bunCluster.on("metrics:collected", (metrics) => {
            logger.debug("cluster", "Bun cluster metrics collected:", metrics);
        });

        this.bunCluster.on("cluster:stopped", () => {
            logger.info("cluster", "Bun cluster stopped");
        });

        logger.debug("cluster", "Bun cluster event handlers setup complete");
    }

    /**
     * Add cluster monitoring endpoints
     */
    public addClusterMonitoringEndpoints(basePoint: string): void {
        if (!this.cluster || !this.options.cluster?.enabled) return;

        // Cluster health endpoint
        this.dependencies.app.get(
            basePoint + "/health/cluster",
            async (_req, res) => {
                try {
                    const clusterHealth = await this.cluster!.checkHealth();
                    const clusterMetrics = await this.cluster!.getMetrics();

                    res.json({
                        timestamp: new Date().toISOString(),
                        cluster: {
                            health: clusterHealth,
                            metrics: clusterMetrics,
                            workers: this.cluster!.getAllWorkers(),
                        },
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get cluster statistics",
                        message: error.message,
                    });
                }
            }
        );

        // Cluster scaling endpoint
        this.dependencies.app.post(
            basePoint + "/cluster/scale",
            async (req, res) => {
                try {
                    const { action, count = 1 } = req.body;

                    if (action === "up") {
                        await this.cluster!.scaleUp(count);
                        res.json({
                            success: true,
                            message: `Scaled up by ${count} workers`,
                            workers: this.cluster!.getAllWorkers().length,
                        });
                    } else if (action === "down") {
                        await this.cluster!.scaleDown(count);
                        res.json({
                            success: true,
                            message: `Scaled down by ${count} workers`,
                            workers: this.cluster!.getAllWorkers().length,
                        });
                    } else if (action === "auto") {
                        await this.cluster!.autoScale();
                        res.json({
                            success: true,
                            message: "Auto-scaling triggered",
                            workers: this.cluster!.getAllWorkers().length,
                        });
                    } else {
                        res.status(400).json({
                            error: "Invalid action. Use 'up', 'down', or 'auto'",
                        });
                    }
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to scale cluster",
                        message: error.message,
                    });
                }
            }
        );

        // Cluster restart endpoint
        this.dependencies.app.post(
            basePoint + "/cluster/restart",
            async (_req, res) => {
                try {
                    await this.cluster!.restart();
                    res.json({
                        success: true,
                        message: "Cluster restart initiated",
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to restart cluster",
                        message: error.message,
                    });
                }
            }
        );

        // Cluster broadcast endpoint
        this.dependencies.app.post(
            basePoint + "/cluster/broadcast",
            async (req, res) => {
                try {
                    const { message } = req.body;
                    await this.cluster!.broadcast(message);
                    res.json({
                        success: true,
                        message: "Message broadcasted to all workers",
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to broadcast message",
                        message: error.message,
                    });
                }
            }
        );
    }

    /**
     * Setup cluster event handlers
     */
    public setupClusterEventHandlers(): void {
        if (!this.cluster) return;

        // Handle worker events
        this.cluster.on("worker:started", (workerId: string, pid: number) => {
            logger.debug("cluster", `Started worker ${workerId} (PID: ${pid})`);
        });

        this.cluster.on(
            "worker:died",
            (workerId: string, code: number, signal: string) => {
                logger.debug(
                    "cluster",
                    `Worker ${workerId} died (code: ${code}, signal: ${signal})`
                );
            }
        );

        this.cluster.on(
            "worker:restarted",
            (workerId: string, reason: string) => {
                logger.debug(
                    "cluster",
                    `Worker ${workerId} restarted (reason: ${reason})`
                );
            }
        );

        // Handle scaling events
        this.cluster.on(
            "cluster:scaled",
            (action: string, workerCount: number) => {
                logger.debug(
                    "cluster",
                    `Cluster ${action}: now running ${workerCount} workers`
                );
            }
        );

        // Handle health events
        this.cluster.on("health:status", (status: any) => {
            if (status.status === "critical") {
                logger.warn(
                    "cluster",
                    `Cluster health critical: ${status.message}`
                );
            }
        });
    }

    /**
     * Start cluster manager
     */
    public async startCluster(): Promise<void> {
        // Handle Bun cluster
        if (this.bunCluster) {
            try {
                logger.debug("cluster", "Starting Bun cluster...");
                await this.bunCluster.start();
                this.setupBunClusterEventHandlers();
                logger.debug("cluster", "Bun cluster started successfully");
            } catch (error: any) {
                logger.error(
                    "cluster",
                    "Failed to start Bun cluster:",
                    error.message
                );

                // Fallback: disable clustering and continue in single-process mode
                logger.warn(
                    "cluster",
                    "Attempting fallback to single-process mode..."
                );
                try {
                    await this._enableSingleProcessFallback();
                    logger.info(
                        "cluster",
                        "Successfully fell back to single-process mode"
                    );
                } catch (fallbackError: any) {
                    logger.error(
                        "cluster",
                        "Fallback mode also failed:",
                        fallbackError.message
                    );
                    throw error; // Throw original error
                }
                return;
            }
        }

        // Handle Node.js cluster
        if (!this.cluster) return;

        try {
            logger.debug("cluster", "Starting Node.js cluster...");
            await this.cluster.start();
            this.setupClusterEventHandlers();
            logger.debug("cluster", "Node.js cluster started successfully");
        } catch (error: any) {
            logger.error(
                "cluster",
                "Failed to start Node.js cluster:",
                error.message
            );
            throw error;
        }
    }

    /**
     * Enable single-process fallback mode
     */
    private async _enableSingleProcessFallback(): Promise<void> {
        logger.info("cluster", "Enabling single-process fallback mode");

        // Disable clustering by setting cluster references to null
        this.bunCluster = undefined;
        this.cluster = undefined;

        // Update app methods to work in single-process mode
        this.dependencies.app.broadcastToWorkers = async (
            message: any
        ): Promise<void> => {
            logger.debug(
                "cluster",
                "Single-process mode: broadcast ignored",
                message
            );
            // In single-process mode, there are no workers to broadcast to
        };

        this.dependencies.app.sendToRandomWorker = async (
            message: any
        ): Promise<void> => {
            logger.debug(
                "cluster",
                "Single-process mode: sendToRandomWorker ignored",
                message
            );
            // In single-process mode, there are no workers to send to
        };

        // Update cluster management methods to no-ops
        this.dependencies.app.restartCluster = async () => {
            logger.warn(
                "cluster",
                "Single-process mode: cluster restart not available"
            );
            throw new Error(
                "Cluster restart not available in single-process mode"
            );
        };

        this.dependencies.app.stopCluster = async () => {
            logger.warn(
                "cluster",
                "Single-process mode: cluster stop not available"
            );
            throw new Error(
                "Cluster stop not available in single-process mode"
            );
        };

        logger.info(
            "cluster",
            "Single-process fallback mode enabled successfully"
        );
    }

    /**
     * Stop cluster manager
     */
    public async stopCluster(graceful: boolean = true): Promise<void> {
        // Handle Bun cluster
        if (this.bunCluster) {
            try {
                logger.debug("cluster", "Stopping Bun cluster...");
                await this.bunCluster.stop(graceful);
                logger.debug("cluster", "Bun cluster stopped successfully");
            } catch (error: any) {
                logger.error(
                    "cluster",
                    "Failed to stop Bun cluster:",
                    error.message
                );
                throw error;
            }
            return;
        }

        // Handle Node.js cluster
        if (!this.cluster) return;

        try {
            logger.debug("cluster", "Stopping Node.js cluster...");
            await this.cluster.stop(graceful);
            logger.debug("cluster", "Cluster stopped successfully");
        } catch (error: any) {
            logger.error("cluster", "Failed to stop cluster:", error.message);
            throw error;
        }
    }

    /**
     * Get cluster statistics
     */
    public async getClusterStats(): Promise<any> {
        if (!this.cluster) {
            return {
                enabled: false,
                message: "Cluster not enabled",
            };
        }

        try {
            const health = await this.cluster.checkHealth();
            const metrics = await this.cluster.getMetrics();
            const workers = this.cluster.getAllWorkers();

            return {
                enabled: true,
                health,
                metrics,
                workers: {
                    total: workers.length,
                    active: workers.filter((w) => w.health.status === "healthy")
                        .length,
                    list: workers,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            return {
                enabled: true,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Check if running in master or worker process
     */
    public isMainProcess(): boolean {
        return process.env.NODE_ENV !== "worker";
    }

    /**
     * Get cluster configuration
     */
    public getClusterConfig(): any {
        return {
            enabled: this.isClusterEnabled(),
            config: this.options.cluster?.config || {},
            isMainProcess: this.isMainProcess(),
        };
    }
}

