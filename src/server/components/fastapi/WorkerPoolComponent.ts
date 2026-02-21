/**
 * WorkerPoolComponent - Integrates WorkerPoolManager with XyPriss server
 * Manages worker threads for CPU and I/O intensive tasks
 */

import { WorkerPoolManager } from "./modules/UFRP/WorkerPoolManager";
import {
    WorkerPoolConfig,
    WorkerStats,
} from "./modules/UFRP/types/WorkerTypes";
import { TaskInfo } from "./modules/UFRP/types/TaskTypes";
import { logger } from "../../../../shared/logger/Logger";
import { UltraFastApp } from "../../../types/types";
import { NehoID } from "nehoid";

export interface WorkerPoolComponentOptions {
    workerPool?: {
        enabled?: boolean;
        config?: Partial<WorkerPoolConfig>;
    };
}

export interface WorkerPoolComponentDependencies {
    app: UltraFastApp;
    serverOptions?: any;
}

/** 
 * WorkerPoolComponent - Handles worker thread management for the server
 */
export class WorkerPoolComponent {
    protected readonly options: WorkerPoolComponentOptions;
    protected readonly dependencies: WorkerPoolComponentDependencies;
    private workerPool?: WorkerPoolManager;
    private isEnabled: boolean = false;

    constructor(
        options: WorkerPoolComponentOptions,
        dependencies: WorkerPoolComponentDependencies
    ) {
        this.options = options;
        this.dependencies = dependencies;

        if (this.options.workerPool?.enabled) {
            this.initializeWorkerPool();
        }
    }

    /**
     * Initialize worker pool manager
     */
    private initializeWorkerPool(): void {
        try {
            logger.debug("other", "Initializing WorkerPoolManager...");

            // Check if worker threads are supported
            if (!this.isWorkerThreadsSupported()) {
                logger.warn(
                    "other",
                    "Worker threads not supported in current runtime. Disabling worker pool functionality."
                );
                return;
            }

            // Create worker pool with configuration
            this.workerPool = new WorkerPoolManager(
                this.options.workerPool?.config || {}
            );

            this.isEnabled = true;

            // Add worker pool methods to app
            this.addWorkerPoolMethods();

            logger.debug("other", "WorkerPoolManager initialized successfully");
        } catch (error: any) {
            logger.error(
                "other",
                `Failed to initialize WorkerPoolManager: ${error.message}`
            );
            this.isEnabled = false;
        }
    }

    /**
     * Check if worker threads are supported
     */
    private isWorkerThreadsSupported(): boolean {
        try {
            // Try to require worker_threads
            require("worker_threads");
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Add worker pool methods to the app
     */
    private addWorkerPoolMethods(): void {
        if (!this.workerPool || !this.dependencies.app) {
            return;
        }

        const app = this.dependencies.app as any;

        // Add worker pool execution method
        app.executeTask = (task: TaskInfo): void => {
            if (this.workerPool) {
                this.workerPool.executeTask(task);
            } else {
                throw new Error("Worker pool not available");
            }
        };

        // Add worker pool stats method
        app.getWorkerPoolStats = (): WorkerStats | null => {
            return this.workerPool ? this.workerPool.getStats() : null;
        };

        // Add worker pool configuration update method
        app.updateWorkerPoolConfig = (
            config: Partial<WorkerPoolConfig>
        ): void => {
            if (this.workerPool) {
                this.workerPool.updateConfig(config);
            }
        };

        // Add worker pool shutdown method
        app.shutdownWorkerPool = (): void => {
            if (this.workerPool) {
                this.workerPool.shutdown();
                this.isEnabled = false;
            }
        };

        // Add convenience methods for common task types
        app.executeCPUTask = (taskData: any, priority: number = 1): void => {
            if (this.workerPool) {
                // Determine task type based on the data structure
                let taskType: TaskInfo["type"] = "process";
                if (taskData.body?.operation) {
                    const operation = taskData.body.operation;
                    // Map operation to valid task types
                    if (
                        [
                            "calculate",
                            "analyze",
                            "crypto",
                            "transform",
                        ].includes(operation)
                    ) {
                        taskType = operation as TaskInfo["type"];
                    }
                }

                const task: TaskInfo = {
                    id: NehoID.generate({ prefix: "cpu" }),
                    type: taskType,
                    priority,
                    workerType: "cpu",
                    createdAt: Date.now(),
                    data: taskData.body?.data || taskData,
                };
                this.workerPool.executeTask(task);
            }
        };

        app.executeIOTask = (taskData: any, priority: number = 1): void => {
            if (this.workerPool) {
                const task: TaskInfo = {
                    id: `io-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 11)}`,
                    type: "read",
                    priority,
                    workerType: "io",
                    createdAt: Date.now(),
                    data: taskData,
                };
                this.workerPool.executeTask(task);
            }
        };

        // Add worker pool status check
        app.isWorkerPoolEnabled = (): boolean => {
            return this.isEnabled && !!this.workerPool;
        };

        logger.debug("other", "Worker pool methods added to app");
    }

    /**
     * Get worker pool manager instance
     */
    public getWorkerPool(): WorkerPoolManager | undefined {
        return this.workerPool;
    }

    /**
     * Get worker pool statistics
     */
    public getStats(): WorkerStats | null {
        return this.workerPool ? this.workerPool.getStats() : null;
    }

    /**
     * Check if worker pool is enabled and available
     */
    public isAvailable(): boolean {
        return this.isEnabled && !!this.workerPool;
    }

    /**
     * Execute a task using the worker pool
     */
    public executeTask(task: TaskInfo): void {
        if (!this.workerPool) {
            throw new Error("Worker pool not available");
        }
        this.workerPool.executeTask(task);
    }

    /**
     * Update worker pool configuration
     */
    public updateConfig(config: Partial<WorkerPoolConfig>): void {
        if (this.workerPool) {
            this.workerPool.updateConfig(config);
        }
    }

    /**
     * Shutdown worker pool
     */
    public shutdown(): void {
        if (this.workerPool) {
            logger.debug("other", "Shutting down WorkerPoolManager...");
            this.workerPool.shutdown();
            this.workerPool = undefined;
            this.isEnabled = false;
            logger.debug("other", "WorkerPoolManager shut down successfully");
        }
    }

    /**
     * Start worker pool (if not already started)
     */
    public start(): void {
        if (!this.isEnabled && this.options.workerPool?.enabled) {
            this.initializeWorkerPool();
        }
    }

    /**
     * Get worker pool configuration
     */
    public getConfig(): WorkerPoolConfig | null {
        return this.workerPool ? (this.workerPool as any).config : null;
    }
}

