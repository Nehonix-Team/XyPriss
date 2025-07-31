/**
 * XyPrissJS - Configuration Types
 * Type definitions for UFRP configuration
 */

import { CacheConfig } from "./CacheTypes";
import { PerformanceConfig } from "./PerformanceTypes";
import { WorkerPoolConfig } from "./WorkerTypes";
import { AnalyzerConfig } from "./RequestTypes";
import { SecurityConfig } from "./SecurityTypes";
import { MetricsConfig } from "./MetricsTypes";

export interface UFRPConfig {
    cache: CacheConfig;
    performance: PerformanceConfig;
    workers: WorkerPoolConfig;
    prediction: AnalyzerConfig;
    security: SecurityConfig;
    metrics: MetricsConfig;
}

export interface LegacyConfig {
    cacheSize: number;
    maxWorkers: number;
    securityLevel: "low" | "medium" | "high";
    enableMetrics: boolean;
}

export interface UltraFastProcessorConfig {
    cache?: {
        maxSize?: number;
        enableCompression?: boolean;
        compressionThreshold?: number;
        defaultTTL?: number;
    };
    performance?: {
        enabled?: boolean;
        metrics?: string[];
        interval?: number;
        alerts?: any[];
    };
    workers?: {
        cpu?: number;
        io?: number;
        maxConcurrentTasks?: number;
    };
    prediction?: {
        enabled?: boolean;
        patternRetentionTime?: number;
        analysisInterval?: number;
        hotPatternThreshold?: number;
    };
}

// Legacy interface for backward compatibility
export interface LegacyProcessorOptions {
    cpuWorkers?: number;
    ioWorkers?: number;
    maxCacheSize?: number;
    enablePrediction?: boolean;
    cacheTTL?: number;
    enableCompression?: boolean;
    maxConcurrentTasks?: number;
}

