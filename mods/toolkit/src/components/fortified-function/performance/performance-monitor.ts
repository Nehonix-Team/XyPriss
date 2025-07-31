/**
 * XyPrissSecurity - Enhanced Performance Monitor
 * Advanced performance tracking with smart caching and analytics
 */

import {
    FunctionStats,
    SecureExecutionContext,
    AuditEntry,
    CacheEntry,
    PerformanceMetrics,
    SmartCacheConfig,
} from "../types/types";
import { SmartCache } from "../smart-cache";
import { memoryManager } from "../../../utils/memory";
import { AnalyticsEngine } from "../engines/analytics-engine";

export class PerformanceMonitor {
    private readonly stats: FunctionStats;
    private readonly auditLog: AuditEntry[] = [];
    private readonly smartCache: SmartCache<string, any>;
    private readonly analyticsEngine: AnalyticsEngine;
    private readonly performanceHistory: PerformanceMetrics[] = [];
    private lastCleanupTime = Date.now();

    constructor(cacheConfig?: Partial<SmartCacheConfig>) {
        this.stats = {
            executionCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            memoryUsage: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errorCount: 0,
            lastExecuted: new Date(),
            securityEvents: 0,
        };

        this.smartCache = new SmartCache(cacheConfig);
        this.analyticsEngine = new AnalyticsEngine();
    }

    /**
     * Update execution statistics
     */
    public updateStats(
        context: SecureExecutionContext,
        success: boolean
    ): void {
        const executionTime = performance.now() - context.startTime;

        this.stats.executionCount++;
        this.stats.totalExecutionTime += executionTime;
        this.stats.averageExecutionTime =
            this.stats.totalExecutionTime / this.stats.executionCount;
        this.stats.lastExecuted = new Date();
        this.stats.memoryUsage = this.getCurrentMemoryUsage();

        if (!success) {
            this.stats.errorCount++;
        }

        // Update audit entry
        context.auditEntry.executionTime = executionTime;
        context.auditEntry.success = success;
        context.auditEntry.memoryUsage = this.stats.memoryUsage;
    }

    /**
     * Add entry to audit log
     */
    public addAuditEntry(entry: AuditEntry): void {
        this.auditLog.push(entry);

        // Limit audit log size
        if (this.auditLog.length > 1000) {
            this.auditLog.splice(0, 100);
        }
    }

    /**
     * Increment security events counter
     */
    public incrementSecurityEvents(): void {
        this.stats.securityEvents++;
    }

    /**
     * Record cache hit
     */
    public recordCacheHit(): void {
        this.stats.cacheHits++;
    }

    /**
     * Record cache miss
     */
    public recordCacheMiss(): void {
        this.stats.cacheMisses++;
    }

    /**
     * Get cached result with smart caching
     */
    public getCachedResult<R>(key: string): R | null {
        return this.smartCache.get(key);
    }

    /**
     * Cache result with smart management
     */
    public cacheResult<R>(key: string, result: R, ttl?: number): void {
        this.smartCache.set(key, result, ttl);
    }

    /**
     * Clear cache
     */
    public clearCache(): void {
        this.smartCache.clear();
    }

    /**
     * Clean up old cache entries with smart cleanup
     */
    public cleanupOldCacheEntries(maxAge: number = 300000): void {
        // Smart cache handles this automatically, but we can trigger manual cleanup
        const memoryStats = memoryManager.getStats();
        if (memoryStats.pressure > 0.7) {
            this.smartCache.handleMemoryPressure("medium");
        } else if (memoryStats.pressure > 0.5) {
            this.smartCache.handleMemoryPressure("low");
        }
        this.lastCleanupTime = Date.now();
    }

    /**
     * Get current statistics
     */
    public getStats(): FunctionStats {
        return { ...this.stats };
    }

    /**
     * Get audit log
     */
    public getAuditLog(): AuditEntry[] {
        return [...this.auditLog];
    }

    /**
     * Clear audit log
     */
    public clearAuditLog(): void {
        this.auditLog.length = 0;
    }

    /**
     * Get current memory usage
     */
    private getCurrentMemoryUsage(): number {
        return process.memoryUsage?.()?.heapUsed || 0;
    }

    /**
     * Get enhanced cache statistics
     */
    public getCacheStats() {
        const smartCacheStats = this.smartCache.getStats();
        return {
            ...smartCacheStats,
            totalHits: this.stats.cacheHits,
            totalMisses: this.stats.cacheMisses,
        };
    }

    /**
     * Update performance metrics with analytics
     */
    public updatePerformanceMetrics(metrics: PerformanceMetrics): void {
        this.performanceHistory.push(metrics);

        // Limit history size
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.splice(
                0,
                this.performanceHistory.length - 100
            );
        }

        // Update analytics
        this.analyticsEngine.updatePerformanceMetrics(metrics);

        // Adapt cache strategy based on performance
        this.smartCache.adaptStrategy(metrics);
    }

    /**
     * Get analytics data
     */
    public getAnalyticsData() {
        return this.analyticsEngine.getAnalyticsData();
    }

    /**
     * Get optimization suggestions
     */
    public getOptimizationSuggestions() {
        return this.analyticsEngine.generateOptimizationSuggestions();
    }

    /**
     * Warm cache with predicted entries
     */
    public warmCache(): void {
        const patterns = this.analyticsEngine.getExecutionPatterns();
        const predictions = this.analyticsEngine.predictNextExecutions();

        // Warm cache with high-value patterns that have actual cached values
        const warmingData = patterns
            .slice(0, 10) // Top 10 patterns
            .map((pattern) => {
                // Try to get existing cached value for this pattern
                const existingValue = this.smartCache.get(
                    pattern.parametersHash
                );

                return {
                    key: pattern.parametersHash,
                    value: existingValue, // Use actual cached value if available
                    priority: pattern.cacheWorthiness,
                };
            })
            .filter((item) => item.value !== null); // Only warm with actual values

        // Only warm cache if we have actual values to cache
        if (warmingData.length > 0) {
            this.smartCache.warmCache(warmingData);
        }

        // Map predictions to the correct format
        const mappedPredictions = predictions.map((p) => ({
            key: p.parametersHash,
            probability: p.probability,
        }));
        this.smartCache.preloadPredictedEntries(mappedPredictions);
    }

    /**
     * Handle memory pressure intelligently
     */
    public handleMemoryPressure(level: "low" | "medium" | "high"): void {
        this.smartCache.handleMemoryPressure(level);

        if (level === "high") {
            // Aggressive cleanup
            this.auditLog.splice(0, Math.floor(this.auditLog.length * 0.5));
            this.performanceHistory.splice(
                0,
                Math.floor(this.performanceHistory.length * 0.5)
            );
        } else if (level === "medium") {
            // Moderate cleanup
            this.auditLog.splice(0, Math.floor(this.auditLog.length * 0.25));
        }
    }

    /**
     * Get performance trends
     */
    public getPerformanceTrends(): PerformanceMetrics[] {
        return [...this.performanceHistory];
    }

    /**
     * Detect anomalies in current execution
     */
    public detectAnomalies(auditEntry: AuditEntry) {
        this.analyticsEngine.analyzeExecution(auditEntry);
        return this.analyticsEngine.getAnalyticsData().anomalies;
    }

    /**
     * Destroy and cleanup resources
     */
    public destroy(): void {
        this.smartCache.destroy();
        this.analyticsEngine.clearAnalytics();
        this.auditLog.length = 0;
        this.performanceHistory.length = 0;
    }
}

