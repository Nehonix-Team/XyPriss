import {
    RequestPattern,
    TaskInfo,
} from "../../../components/fastapi/modules/UFRP";

// Optimized interfaces
export interface OptimizedRequestPattern extends RequestPattern {
    successRate: number;
    errorCount: number;
    lastErrorTime?: number;
    peakUsage: number;
    resourceUsage: {
        cpu: number;
        memory: number;
    };
}

export interface RequestContext {
    startTime: number;
    cacheKey: string;
    pattern: string;
    priority: number;
    workerType: "cpu" | "io";
    taskType: TaskInfo["type"];
}
