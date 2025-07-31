/**
 * XyPrissJS - Worker Pool
 * Manages worker threads for CPU and I/O intensive tasks
 */

import { WorkerPoolConfig } from "./types/workerpool.types";

export class WorkerPool {
    private cpuWorkers: number;
    private ioWorkers: number;
    private maxTasks: number;
    private activeTasks = 0;
    private taskQueue: Array<() => Promise<any>> = [];

    constructor(config: WorkerPoolConfig) {
        this.cpuWorkers = config.cpu;
        this.ioWorkers = config.io;
        this.maxTasks = config.maxConcurrentTasks;
    }

    async execute<T>(
        task: () => Promise<T>,
        type: "cpu" | "io" = "io"
    ): Promise<T> {
        if (this.activeTasks >= this.maxTasks) {
            return new Promise((resolve, reject) => {
                this.taskQueue.push(async () => {
                    try {
                        const result = await task();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }

        this.activeTasks++;
        try {
            const result = await task();
            return result;
        } finally {
            this.activeTasks--;
            if (this.taskQueue.length > 0) {
                const nextTask = this.taskQueue.shift();
                if (nextTask) {
                    setImmediate(() => nextTask());
                }
            }
        }
    }

    getStats() {
        return {
            cpuWorkers: this.cpuWorkers,
            ioWorkers: this.ioWorkers,
            activeTasks: this.activeTasks,
            queuedTasks: this.taskQueue.length,
            maxTasks: this.maxTasks,
        };
    }
}
