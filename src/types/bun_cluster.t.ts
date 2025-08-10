import { BunWorker } from ".";

/**
 * Security configuration for cluster operations
 */
export interface SecurityConfig {
    maxRestartAttempts: number;
    restartWindow: number; // ms
    maxMemoryPerWorker: number; // bytes
    allowedSignals: NodeJS.Signals[];
    processTimeout: number; // ms
    enableResourceLimits: boolean;
}

/**
 * Worker performance tracking
 */
export interface WorkerPerformance {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    lastRequestTime: number;
    cpuUsage: number;
    memoryUsage: number;
}

/**
 * Enhanced Bun worker with security and performance tracking
 */
export interface EnhancedBunWorker extends BunWorker {
    securityToken: string;
    performance: WorkerPerformance;
    resourceLimits: {
        maxMemory: number;
        maxCpu: number;
    };
    restartHistory: Array<{
        timestamp: number;
        reason: string;
        exitCode?: number;
    }>;
}
