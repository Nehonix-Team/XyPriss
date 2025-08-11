/**
 * XyPrissJS - Task Types
 */

export interface TaskInfo {
    id: string;
    type:
        | "read"
        | "write"
        | "validate"
        | "delete"
        | "process"
        | "calculate"
        | "analyze"
        | "crypto"
        | "transform";
    priority: number;
    workerType: "cpu" | "io";
    createdAt: number;
    data: any; // Made more flexible to support different task data structures
}

export interface TaskStats {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    avgExecutionTime: number;
    tasksByType: Record<string, number>;
    tasksByPriority: Record<number, number>;
}

