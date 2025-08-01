import { UltraFastApp, ServerOptions } from "../../../types/types";
import { ClusterManager } from "../../../cluster/cluster-manager";
import {
    ClusterManagerComponentDependencies,
    ClusterManagerComponentOptions,
} from "../../../types/components/ClusterMC.type";
import { logger } from "../../../../shared/logger/Logger";

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

        // Check if clustering is supported in current runtime
        if (!isClusteringSupported()) {
            logger.warn(
                "cluster",
                "Clustering not supported in current runtime (Bun detected). Disabling cluster functionality."
            );
            return;
        }

        logger.debug("cluster", "Initializing cluster manager...");

        this.cluster = new ClusterManager(this.options.cluster.config || {});

        // Add cluster methods to app immediately when cluster is configured
        this.addClusterMethods();

        logger.debug("cluster", "Cluster manager initialized");
    }

    /**
     * Get cluster manager instance
     */
    public getCluster(): ClusterManager | undefined {
        return this.cluster;
    }

    /**
     * Check if cluster is enabled
     */
    public isClusterEnabled(): boolean {
        return this.options.cluster?.enabled === true;
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
     * Add cluster monitoring endpoints
     */
    public addClusterMonitoringEndpoints(basePoint: string): void {
        if (!this.cluster || !this.options.cluster?.enabled) return;

        // Cluster health endpoint
        this.dependencies.app.get(
            basePoint + "/health/cluster",
            async (req, res) => {
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
            async (req, res) => {
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
        if (!this.cluster) return;

        try {
            logger.debug("cluster", "Starting cluster...");
            await this.cluster.start();
            this.setupClusterEventHandlers();
            logger.debug("cluster", "Cluster started successfully");
        } catch (error: any) {
            logger.error("cluster", "Failed to start cluster:", error.message);
            throw error;
        }
    }

    /**
     * Stop cluster manager
     */
    public async stopCluster(graceful: boolean = true): Promise<void> {
        if (!this.cluster) return;

        try {
            logger.debug("cluster", "Stopping cluster...");
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

