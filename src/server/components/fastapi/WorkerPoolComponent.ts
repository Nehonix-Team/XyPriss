/**
 * WorkerPoolComponent - Delegated to Go (XHSC)
 * Manages task delegation to the Go-managed process pool.
 */

import { logger } from "../../../../shared/logger/Logger";
import { UltraFastApp } from "../../../types/types";
import { NehoID } from "nehoid";

export interface WorkerPoolComponentOptions {
    workerPool?: {
        enabled?: boolean;
        config?: any;
    };
}

export interface WorkerPoolComponentDependencies {
    app: UltraFastApp;
    serverOptions?: any;
}

/**
 * WorkerPoolComponent - Bridge to XHSC task delegation
 */
export class WorkerPoolComponent {
    protected readonly options: WorkerPoolComponentOptions;
    protected readonly dependencies: WorkerPoolComponentDependencies;
    private isXHSC: boolean = false;

    constructor(
        options: WorkerPoolComponentOptions,
        dependencies: WorkerPoolComponentDependencies,
    ) {
        this.options = options;
        this.dependencies = dependencies;
        this.isXHSC = dependencies.serverOptions?.server?.xhsc !== false;

        if (this.options.workerPool?.enabled) {
            this.initialize();
        }
    }

    private initialize(): void {
        logger.debug(
            "other",
            "Initializing WorkerPool delegation to XHSC (Go Core)...",
        );
        this.addWorkerPoolMethods();
    }

    private addWorkerPoolMethods(): void {
        const app = this.dependencies.app as any;

        // Add task execution method via IPC
        app.executeTask = (task: any): void => {
            if (this.isXHSC && process.env.XYPRISS_IPC_PATH) {
                // In worker mode, we send the task to Go via the global IPC handler
                // We'll assume the XHSCWorker instance is available or
                // we use a global sender.
                (app as any)._xhscWorker?.sendMessage({
                    type: "Task",
                    payload: task,
                });
            } else {
                logger.warn(
                    "cluster",
                    "WorkerPool task executed locally (XHSC disabled/Master)",
                );
                // Local execution fallback if needed, or just log
            }
        };

        app.getWorkerPoolStats = (): any => {
            return { type: "XHSC_MANAGED", status: "DELEGATED" };
        };

        app.executeCPUTask = (taskData: any, priority: number = 1): void => {
            const task = {
                id: NehoID.generate({ prefix: "cpu" }),
                type: "cpu",
                priority,
                workerType: "cpu",
                createdAt: Date.now(),
                data: taskData,
            };
            app.executeTask(task);
        };

        app.executeIOTask = (taskData: any, priority: number = 1): void => {
            const task = {
                id: NehoID.generate({ prefix: "io" }),
                type: "io",
                priority,
                workerType: "io",
                createdAt: Date.now(),
                data: taskData,
            };
            app.executeTask(task);
        };

        app.isWorkerPoolEnabled = (): boolean => true;

        logger.debug("other", "Worker pool delegated methods added to app");
    }

    public shutdown(): void {
        // delegated to Go
    }

    public start(): void {
        this.initialize();
    }
}

