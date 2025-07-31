/**
 * XyPrissJS - Task Types
 */

export interface TaskInfo {
    id: string;
    type: "read" | "write" | "validate" | "delete" | "process";
    priority: number;
    workerType: "cpu" | "io";
    createdAt: number;
    data: {
        method: string;
        path: string;
        query: any;
        body: any;
        headers: Record<string, string>;
    };
}

export interface TaskStats {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    avgExecutionTime: number;
    tasksByType: Record<string, number>;
    tasksByPriority: Record<number, number>;
}

