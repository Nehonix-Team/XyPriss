/**
 * XyPrissJS - Worker Types
 * Type definitions for worker pool management
 */

export interface WorkerPoolLimits {
    min: number;
    max: number;
}

export interface WorkerPoolConfig {
    cpu: WorkerPoolLimits;
    io: WorkerPoolLimits;
    maxConcurrentTasks: number;
}

export interface WorkerStats {
    cpuWorkers: number;
    ioWorkers: number;
    activeTasks: number;
    queuedTasks: number;
    maxTasks: number;
    totalExecuted: number;
    avgExecutionTime: number;
}

