/**
 * XyPrissJS - Worker Pool Manager Module
 * Manages worker threads for CPU and I/O intensive tasks
 */

import {
    WorkerPoolConfig,
    WorkerStats,
    WorkerPoolLimits,
} from "./types/WorkerTypes";
import { TaskInfo } from "./types/TaskTypes";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { join } from "path";

export class WorkerPoolManager {
    private config: WorkerPoolConfig;
    private cpuWorkers: Worker[];
    private ioWorkers: Worker[];
    private stats: WorkerStats;
    private taskQueue: Map<string, TaskInfo[]>;
    private workerLoads: Map<Worker, number>; // Track active tasks per worker
    private workerLastUsed: Map<Worker, number>; // Track last usage time for round-robin fallback

    constructor(config: Partial<WorkerPoolConfig> = {}) {
        this.config = {
            cpu: {
                min: 1,
                max: Math.max(1, cpus().length - 1),
            },
            io: {
                min: 2,
                max: 4,
            },
            maxConcurrentTasks: 100,
            ...config,
        };

        this.cpuWorkers = [];
        this.ioWorkers = [];
        this.taskQueue = new Map();
        this.workerLoads = new Map();
        this.workerLastUsed = new Map();
        this.stats = {
            cpuWorkers: 0,
            ioWorkers: 0,
            activeTasks: 0,
            queuedTasks: 0,
            maxTasks: this.config.maxConcurrentTasks,
            totalExecuted: 0,
            avgExecutionTime: 0,
        };

        this.initializeWorkers();
    }

    private initializeWorkers(): void {
        // Initialize CPU workers
        for (let i = 0; i < this.config.cpu.min; i++) {
            this.createWorker("cpu");
        }

        // Initialize I/O workers
        for (let i = 0; i < this.config.io.min; i++) {
            this.createWorker("io");
        }
    }

    private createWorker(type: "cpu" | "io"): void {
        try {
            const workerPath =
                type === "cpu"
                    ? join(__dirname, "workers", "cpu-worker.js")
                    : join(__dirname, "workers", "io-worker.js");

            const worker = new Worker(workerPath, {
                workerData: { type },
            });

            worker.on("message", (result) => {
                this.handleWorkerResult(result);
            });

            worker.on("error", (error) => {
                console.error(`Worker error: ${error.message}`);
                this.handleWorkerError(worker, type);
            });

            worker.on("exit", (code) => {
                if (code !== 0) {
                    console.error(`Worker exited with code ${code}`);
                    this.handleWorkerExit(worker, type);
                }
            });

            if (type === "cpu") {
                this.cpuWorkers.push(worker);
                this.stats.cpuWorkers++;
            } else {
                this.ioWorkers.push(worker);
                this.stats.ioWorkers++;
            }

            // Initialize worker load tracking
            this.workerLoads.set(worker, 0);
            this.workerLastUsed.set(worker, 0);
        } catch (error) {
            console.error(`Failed to create ${type} worker:`, error);
            // Don't throw error, just log it to prevent breaking the entire system
        }
    }

    private handleWorkerResult(result: {
        taskId: string;
        executionTime: number;
        workerId?: number; // Optional worker ID to identify which worker completed the task
    }): void {
        this.stats.activeTasks--;
        this.stats.totalExecuted++;

        // Update average execution time
        this.stats.avgExecutionTime =
            (this.stats.avgExecutionTime * (this.stats.totalExecuted - 1) +
                result.executionTime) /
            this.stats.totalExecuted;

        // Update worker load tracking if worker ID is provided
        if (result.workerId !== undefined) {
            const worker = [...this.cpuWorkers, ...this.ioWorkers].find(
                (w) => (w as any).threadId === result.workerId
            );
            if (worker) {
                const currentLoad = this.workerLoads.get(worker) || 0;
                this.workerLoads.set(worker, Math.max(0, currentLoad - 1));
            }
        } else {
            // Fallback: Decrease load for all workers with active tasks
            for (const [worker, load] of this.workerLoads.entries()) {
                if (load > 0) {
                    this.workerLoads.set(worker, load - 1);
                    break; // Only decrease one worker's load
                }
            }
        }

        // Process next task in queue
        this.processNextTask();
    }

    private handleWorkerError(worker: Worker, type: "cpu" | "io"): void {
        const workers = type === "cpu" ? this.cpuWorkers : this.ioWorkers;
        const index = workers.indexOf(worker);
        if (index !== -1) {
            workers.splice(index, 1);
            this.stats[type === "cpu" ? "cpuWorkers" : "ioWorkers"]--;

            // Clean up worker tracking
            this.workerLoads.delete(worker);
            this.workerLastUsed.delete(worker);

            // Create new worker if below minimum
            if (workers.length < this.config[type].min) {
                this.createWorker(type);
            }
        }
    }

    private handleWorkerExit(worker: Worker, type: "cpu" | "io"): void {
        this.handleWorkerError(worker, type);
    }

    /**
     * Find the least busy worker from the given worker pool
     * Uses intelligent load balancing considering:
     * - Current active task count per worker
     * - Last usage time for round-robin fallback
     * - Worker availability and health
     */
    private findLeastBusyWorker(workers: Worker[]): Worker {
        if (workers.length === 0) {
            throw new Error("No workers available");
        }

        if (workers.length === 1) {
            return workers[0];
        }

        // Find worker with minimum load
        let leastBusyWorker = workers[0];
        let minLoad = this.workerLoads.get(leastBusyWorker) || 0;

        for (const worker of workers) {
            const currentLoad = this.workerLoads.get(worker) || 0;

            if (currentLoad < minLoad) {
                minLoad = currentLoad;
                leastBusyWorker = worker;
            } else if (currentLoad === minLoad) {
                // If loads are equal, use the worker that was used least recently
                const currentWorkerLastUsed =
                    this.workerLastUsed.get(worker) || 0;
                const leastBusyWorkerLastUsed =
                    this.workerLastUsed.get(leastBusyWorker) || 0;

                if (currentWorkerLastUsed < leastBusyWorkerLastUsed) {
                    leastBusyWorker = worker;
                }
            }
        }

        // Update last used time
        this.workerLastUsed.set(leastBusyWorker, Date.now());

        return leastBusyWorker;
    }

    executeTask(task: TaskInfo): void {
        if (this.stats.activeTasks >= this.config.maxConcurrentTasks) {
            // Queue task if at capacity
            const queue = this.taskQueue.get(task.workerType) || [];
            queue.push(task);
            this.taskQueue.set(task.workerType, queue);
            this.stats.queuedTasks++;
            return;
        }

        const workers =
            task.workerType === "cpu" ? this.cpuWorkers : this.ioWorkers;
        if (workers.length === 0) {
            throw new Error(`No ${task.workerType} workers available`);
        }

        // Find least busy worker using intelligent load balancing
        const worker = this.findLeastBusyWorker(workers);

        // Update worker load tracking
        const currentLoad = this.workerLoads.get(worker) || 0;
        this.workerLoads.set(worker, currentLoad + 1);

        // Send task to the selected worker
        worker.postMessage({ task });
        this.stats.activeTasks++;
    }

    private processNextTask(): void {
        if (this.stats.queuedTasks === 0) return;

        // Process tasks from both queues
        ["cpu", "io"].forEach((type) => {
            const queue = this.taskQueue.get(type) || [];
            if (
                queue.length > 0 &&
                this.stats.activeTasks < this.config.maxConcurrentTasks
            ) {
                const task = queue.shift()!;
                this.taskQueue.set(type, queue);
                this.stats.queuedTasks--;
                this.executeTask(task);
            }
        });
    }

    getStats(): WorkerStats {
        return { ...this.stats };
    }

    updateConfig(config: Partial<WorkerPoolConfig>): void {
        this.config = { ...this.config, ...config };
        this.stats.maxTasks = this.config.maxConcurrentTasks;

        // Adjust worker pools if needed
        this.adjustWorkerPools();
    }

    private adjustWorkerPools(): void {
        // Adjust CPU workers
        while (this.cpuWorkers.length < this.config.cpu.min) {
            this.createWorker("cpu");
        }
        while (this.cpuWorkers.length > this.config.cpu.max) {
            const worker = this.cpuWorkers.pop()!;
            this.workerLoads.delete(worker);
            this.workerLastUsed.delete(worker);
            worker.terminate();
            this.stats.cpuWorkers--;
        }

        // Adjust I/O workers
        while (this.ioWorkers.length < this.config.io.min) {
            this.createWorker("io");
        }
        while (this.ioWorkers.length > this.config.io.max) {
            const worker = this.ioWorkers.pop()!;
            this.workerLoads.delete(worker);
            this.workerLastUsed.delete(worker);
            worker.terminate();
            this.stats.ioWorkers--;
        }
    }

    shutdown(): void {
        // Terminate all workers
        [...this.cpuWorkers, ...this.ioWorkers].forEach((worker) => {
            worker.terminate();
        });

        // Clear all tracking data
        this.cpuWorkers = [];
        this.ioWorkers = [];
        this.taskQueue.clear();
        this.workerLoads.clear();
        this.workerLastUsed.clear();

        this.stats = {
            cpuWorkers: 0,
            ioWorkers: 0,
            activeTasks: 0,
            queuedTasks: 0,
            maxTasks: this.config.maxConcurrentTasks,
            totalExecuted: 0,
            avgExecutionTime: 0,
        };
    }
}

