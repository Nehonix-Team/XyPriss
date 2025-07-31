/**
 * XyPrissJS - Ultra-Fast Request Processor (UFRP)
 * Main module exports
 */

// Core components
export { UFRPCore } from "./UFRPCore";
export { ConfigManager } from "./ConfigManager";
export { CacheManager } from "./CacheManager";
export { MetricsCollector } from "./MetricsCollector";
export { PerformanceTracker } from "./PerformanceTracker";
export { RequestAnalyzer } from "./RequestAnalyzer";
export { SecurityManager } from "./SecurityManager";
export { TaskManager } from "./TaskManager";
export { WorkerPoolManager } from "./WorkerPoolManager";

// Export all types
export * from "./types";

// Export types
export type { UFRPConfig, LegacyConfig } from "./types/ConfigTypes";
export type { CacheConfig, CacheStats } from "./types/CacheTypes";
export type { MetricsConfig, AggregatedMetrics } from "./types/MetricsTypes";
export type {
    PerformanceConfig,
    PerformanceStats,
} from "./types/PerformanceTypes";
export type {
    AnalyzerConfig,
    RequestPattern,
    PatternStats,
} from "./types/RequestTypes";

export { SecurityConfig, SecurityStats } from "./types/SecurityTypes";

export { TaskInfo, TaskStats } from "./types/TaskTypes";

export { WorkerPoolConfig, WorkerStats } from "./types/WorkerTypes";

