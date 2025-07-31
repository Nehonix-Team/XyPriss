/**
 * XyPrissJS - Task Manager Module
 * Manages task prioritization and execution
 */

import { NehoID } from "nehoid";
import { TaskInfo, TaskStats } from "./types/TaskTypes";
import { Request } from "express";

type TaskType = "read" | "write" | "validate" | "delete" | "process";

export class TaskManager {
    private tasks: Map<string, TaskInfo>;
    private stats: TaskStats;

    constructor() {
        this.tasks = new Map();
        this.stats = {
            totalTasks: 0,
            activeTasks: 0,
            completedTasks: 0,
            avgExecutionTime: 0,
            tasksByType: {},
            tasksByPriority: {},
        };
    }

    createTask(req: Request, type: TaskType, priority: number): TaskInfo {
        const task: TaskInfo = {
            id: this.generateTaskId(),
            type,
            priority,
            workerType: this.determineWorkerType(req),
            createdAt: Date.now(),
            data: {
                method: req.method,
                path: req.path,
                query: req.query,
                body: req.body,
                headers: this.sanitizeHeaders(req.headers),
            },
        };

        this.tasks.set(task.id, task);
        this.updateStats(task);
        return task;
    }

    private generateTaskId(): string {
        return NehoID.generate({ prefix: "task" });
    }

    private determineWorkerType(req: Request): "cpu" | "io" {
        // Determine if task is CPU or I/O intensive based on request characteristics
        const isCPUIntensive =
            req.method === "POST" ||
            req.method === "PUT" ||
            req.path.includes("/compute") ||
            req.path.includes("/process");

        return isCPUIntensive ? "cpu" : "io";
    }

    private sanitizeHeaders(
        headers: Record<string, string | string[] | undefined>
    ): Record<string, string> {
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined) {
                sanitized[key] = Array.isArray(value)
                    ? value.join(", ")
                    : value;
            }
        }
        return sanitized;
    }

    private updateStats(task: TaskInfo): void {
        this.stats.totalTasks++;
        this.stats.activeTasks++;

        // Update tasks by type
        this.stats.tasksByType[task.type] =
            (this.stats.tasksByType[task.type] || 0) + 1;

        // Update tasks by priority
        const priorityRange = Math.floor(task.priority / 10) * 10;
        this.stats.tasksByPriority[priorityRange] =
            (this.stats.tasksByPriority[priorityRange] || 0) + 1;
    }

    completeTask(taskId: string, executionTime: number): void {
        const task = this.tasks.get(taskId);
        if (task) {
            this.stats.activeTasks--;
            this.stats.completedTasks++;

            // Update average execution time
            this.stats.avgExecutionTime =
                (this.stats.avgExecutionTime * (this.stats.completedTasks - 1) +
                    executionTime) /
                this.stats.completedTasks;

            this.tasks.delete(taskId);
        }
    }

    getTask(taskId: string): TaskInfo | undefined {
        return this.tasks.get(taskId);
    }

    getActiveTasks(): TaskInfo[] {
        return Array.from(this.tasks.values());
    }

    getTasksByPriority(minPriority: number, maxPriority: number): TaskInfo[] {
        return Array.from(this.tasks.values())
            .filter(
                (task) =>
                    task.priority >= minPriority && task.priority <= maxPriority
            )
            .sort((a, b) => b.priority - a.priority);
    }

    getTasksByType(type: TaskType): TaskInfo[] {
        return Array.from(this.tasks.values())
            .filter((task) => task.type === type)
            .sort((a, b) => b.priority - a.priority);
    }

    getStats(): TaskStats {
        return { ...this.stats };
    }

    reset(): void {
        this.tasks.clear();
        this.stats = {
            totalTasks: 0,
            activeTasks: 0,
            completedTasks: 0,
            avgExecutionTime: 0,
            tasksByType: {},
            tasksByPriority: {},
        };
    }
}

