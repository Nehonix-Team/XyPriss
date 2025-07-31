/**
 * API Manager - Handles all public API methods for the core
 * Part of the minimal modular architecture
 */

import {
    FunctionStats,
    AuditEntry,
    AnalyticsData,
    OptimizationSuggestion,
    PerformanceMetrics,
    AnomalyDetection,
    FortifiedFunctionOptions,
} from "../../types/fortified-types";
import { StatsManager } from "./stats-manager";
import { CacheManager } from "./cache-manager";
import { PerformanceMonitor } from "../../performance/performance-monitor";
import { UltraFastCache } from "../../UFA/ultra-fast-cache";
import { TimingManager } from "./timing-manager";
import { fortifiedLogger } from "../fortified-logger";

export class ApiManager {
    private readonly functionId: string;
    private readonly statsManager: StatsManager;
    private readonly cacheManager: CacheManager<any>;
    private readonly performanceMonitor: PerformanceMonitor;
    private readonly ultraFastCache: UltraFastCache<string, any>;
    private readonly timingManager: TimingManager;
    private readonly options: Required<FortifiedFunctionOptions>;
    private executionCount: number = 0;

    constructor(
        functionId: string,
        statsManager: StatsManager,
        cacheManager: CacheManager<any>,
        performanceMonitor: PerformanceMonitor,
        ultraFastCache: UltraFastCache<string, any>,
        timingManager: TimingManager,
        options: Required<FortifiedFunctionOptions>
    ) {
        this.functionId = functionId;
        this.statsManager = statsManager;
        this.cacheManager = cacheManager;
        this.performanceMonitor = performanceMonitor;
        this.ultraFastCache = ultraFastCache;
        this.timingManager = timingManager;
        this.options = options;
    }

    /**
     * Update execution count
     */
    incrementExecutionCount(): void {
        this.executionCount++;
    }

    /**
     * Get function statistics (combining both existing and new stats)
     */
    getStats(): FunctionStats {
        const existingStats = this.statsManager.getStats();
        const performanceStats = this.performanceMonitor.getStats();

        return {
            ...existingStats,
            ...performanceStats,
            executionCount: this.executionCount,
            functionId: this.functionId,
            timingStats: this.timingManager.getTimingStats(),
        } as FunctionStats;
    }

    /**
     * Get audit log (combining both systems)
     */
    getAuditLog(): AuditEntry[] {
        const existingAudit = this.statsManager.getAuditLog();
        const performanceAudit = this.performanceMonitor.getAuditLog();
        return [...existingAudit, ...performanceAudit];
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.performanceMonitor.getCacheStats();
    }

    /**
     * Clear cache (both systems)
     */
    clearCache(): void {
        this.cacheManager.clearCache();
        this.performanceMonitor.clearCache();
        this.ultraFastCache.clear();
        fortifiedLogger.info(
            "CACHE",
            `Cache cleared for function: ${this.functionId}`
        );
    }

    /**
     * Get analytics data
     */
    getAnalyticsData(): AnalyticsData {
        return this.performanceMonitor.getAnalyticsData();
    }

    /**
     * Get optimization suggestions
     */
    getOptimizationSuggestions(): OptimizationSuggestion[] {
        return this.performanceMonitor.getOptimizationSuggestions();
    }

    /**
     * Get performance trends
     */
    getPerformanceTrends(): PerformanceMetrics[] {
        return this.performanceMonitor.getPerformanceTrends();
    }

    /**
     * Detect anomalies
     */
    detectAnomalies(): AnomalyDetection[] {
        if (this.options.anomalyDetection) {
            const auditLog = this.performanceMonitor.getAuditLog();
            const latestEntry = auditLog[auditLog.length - 1];
            if (latestEntry) {
                return this.performanceMonitor.detectAnomalies(latestEntry);
            }
        }
        return [];
    }

    /**
     * Warm cache
     */
    warmCache(): void {
        if (this.options.smartCaching) {
            this.performanceMonitor.warmCache();
        }
    }

    /**
     * Handle memory pressure
     */
    handleMemoryPressure(level: "low" | "medium" | "high"): void {
        if (this.options.memoryPressureHandling) {
            this.performanceMonitor.handleMemoryPressure(level);
        }
    }

    /**
     * Get detailed metrics
     */
    getDetailedMetrics(globalMetrics: any) {
        if (!this.options.detailedMetrics) return null;

        return {
            stats: this.getStats(),
            cacheStats: this.getCacheStats(),
            analytics: this.getAnalyticsData(),
            suggestions: this.getOptimizationSuggestions(),
            trends: this.getPerformanceTrends(),
            anomalies: this.detectAnomalies(),
            functionId: this.functionId,
            globalMetrics,
        };
    }

    /**
     * Auto-apply optimizations
     */
    autoApplyOptimizations(): boolean {
        if (this.options.autoTuning) {
            const cacheStats = this.getCacheStats();
            if (cacheStats.hitRate < 0.5 && this.options.maxCacheSize < 5000) {
                this.options.maxCacheSize = Math.min(
                    this.options.maxCacheSize * 1.5,
                    5000
                );
                return true; // Optimization applied
            }
        }
        return false; // No optimization applied
    }

    /**
     * Clear audit log
     */
    clearAuditLog(): void {
        this.statsManager.clearAuditLog?.();
        this.performanceMonitor.clearAuditLog?.();
        fortifiedLogger.info(
            "AUDIT",
            `Audit log cleared for function: ${this.functionId}`
        );
    }

    /**
     * Get active executions count
     */
    getActiveExecutionsCount(): number {
        return this.executionCount; // Simple implementation using current execution count
    }

    /**
     * Get ultra-fast component metrics
     */
    getUltraFastMetrics(): any {
        return {
            cacheSize: this.ultraFastCache.size,
            cacheHitRate: this.getCacheStats().hitRate,
            functionId: this.functionId,
            executionCount: this.executionCount,
        };
    }

    /**
     * Optimize performance by applying recommended settings
     */
    optimizePerformance(): void {
        const suggestions = this.getOptimizationSuggestions();
        let optimizationsApplied = 0;

        for (const suggestion of suggestions) {
            if (
                suggestion.priority === "high" ||
                suggestion.priority === "critical"
            ) {
                this.autoApplyOptimizations();
                optimizationsApplied++;
            }
        }

        fortifiedLogger.info(
            "OPTIMIZATION",
            `Applied ${optimizationsApplied} performance optimizations for function: ${this.functionId}`
        );
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        fortifiedLogger.debug(
            "API",
            `API manager destroyed for function: ${this.functionId}`
        );
    }
}

