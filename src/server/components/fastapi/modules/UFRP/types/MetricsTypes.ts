/**
 * XyPrissJS - Metrics Types
 */

import { CacheStats } from "./CacheTypes";
import { PerformanceStats } from "./PerformanceTypes";
import { SecurityStats } from "./SecurityTypes";
import { TaskStats } from "./TaskTypes";
import { WorkerStats } from "./WorkerTypes";

export interface AggregatedMetrics {
    timestamp: number;
    cache: CacheStats;
    performance: PerformanceStats;
    security: SecurityStats;
    tasks: TaskStats;
    workers: WorkerStats;
    system: {
        uptime: number;
        memory: {
            total: number;
            used: number;
            free: number;
        };
        cpu: {
            usage: number;
            cores: number;
        };
    };
}

export interface MetricsConfig {
    enabled: boolean;
    collectionInterval: number;
    retentionPeriod: number;
    alertThresholds: {
        errorRate: number;
        responseTime: number;
        memoryUsage: number;
        cpuUsage: number;
    };
}

