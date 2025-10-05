/**
 * Performance Profiler
 *
 * High-precision performance monitoring system for FastApi.ts optimization.
 * Measures performance metrics with minimal overhead (<0.01ms per measurement).
 */

import { performance } from "perf_hooks"; 
import { PerformanceMetrics, PerformanceStats } from "../../types/perfomance";
import { logger } from "../../../shared/logger/Logger";
import { Request, Response } from "../ServerFactory";

export class PerformanceProfiler {
    private metrics: PerformanceMetrics[] = [];
    private activeRequests: Map<string, Partial<PerformanceMetrics>> =
        new Map();
    private readonly maxMetricsHistory = 10000;
    private readonly measurementOverhead: number;

    constructor() {
        // Measure our own overhead
        this.measurementOverhead = this.calibrateMeasurementOverhead();
        logger.debug(
            "performance",
            `Performance measurement overhead: ${this.measurementOverhead.toFixed(
                4
            )}ms`
        );
    }

    /**
     * Start measuring a request
     */
    public startMeasurement(req: Request): string {
        const requestId = this.generateRequestId();
        const startTime = performance.now();

        const metric: Partial<PerformanceMetrics> = {
            requestId,
            timestamp: Date.now(),
            route: req.route?.path || req.path,
            method: req.method,
            totalTime: startTime, // Store start time temporarily
            cacheHit: false,
            cacheLayer: "miss",
            memoryUsed: process.memoryUsage().heapUsed,
            gcTriggered: false,
            requestType: "standard", // Default, will be updated
            optimizationPath: "none",
            targetMet: false,
            optimizationGain: 0,
        };

        this.activeRequests.set(requestId, metric);
        return requestId;
    }

    /**
     * Complete measurement
     */
    public completeMeasurement(
        requestId: string,
        res: Response
    ): PerformanceMetrics | null {
        const metric = this.activeRequests.get(requestId);
        if (!metric || !metric.totalTime) {
            return null;
        }

        // Calculate total time
        const endTime = performance.now();
        const totalTime = endTime - metric.totalTime - this.measurementOverhead;

        // Check if target was met
        const targetMet = this.checkTargetMet(metric.requestType!, totalTime);

        // Calculate optimization gain (compared to baseline)
        const optimizationGain = this.calculateOptimizationGain(
            metric.requestType!,
            totalTime
        );

        // Final memory check
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDelta = finalMemory - (metric.memoryUsed || 0);

        const completedMetric: PerformanceMetrics = {
            ...(metric as PerformanceMetrics),
            totalTime,
            memoryUsed: memoryDelta,
            targetMet,
            optimizationGain,
        };

        // Store metric
        this.storeMetric(completedMetric);

        // Clean up
        this.activeRequests.delete(requestId);

        return completedMetric;
    }

    /**
     * Set request classification
     */
    public setRequestType(
        requestId: string,
        type: "ultra-fast" | "fast" | "standard",
        path: string
    ): void {
        const metric = this.activeRequests.get(requestId);
        if (metric) {
            metric.requestType = type;
            metric.optimizationPath = path;
        }
    }

    /**
     * Mark cache operation
     */
    public markCacheOperation(
        requestId: string,
        hit: boolean,
        layer: "L1" | "L2" | "L3" | "miss",
        time: number
    ): void {
        const metric = this.activeRequests.get(requestId);
        if (metric) {
            metric.cacheTime = time;
            metric.cacheHit = hit;
            metric.cacheLayer = layer;
        }
    }

    /**
     * Get current performance statistics
     */
    public getStats(): PerformanceStats {
        if (this.metrics.length === 0) {
            return this.getEmptyStats();
        }

        const recentMetrics = this.metrics.slice(-1000); // Last 1000 requests
        const responseTimes = recentMetrics
            .map((m) => m.totalTime)
            .sort((a, b) => a - b);

        const stats: PerformanceStats = {
            totalRequests: this.metrics.length,

            // Response time statistics
            p50ResponseTime: this.getPercentile(responseTimes, 0.5),
            p95ResponseTime: this.getPercentile(responseTimes, 0.95),
            p99ResponseTime: this.getPercentile(responseTimes, 0.99),
            avgResponseTime:
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,

            // Target achievement
            ultraFastTargetRate: this.calculateTargetRate(
                recentMetrics,
                "ultra-fast"
            ),
            fastTargetRate: this.calculateTargetRate(recentMetrics, "fast"),

            // Cache performance
            overallCacheHitRate: this.calculateCacheHitRate(recentMetrics),
            l1CacheHitRate: this.calculateCacheHitRate(recentMetrics, "L1"),
            l2CacheHitRate: this.calculateCacheHitRate(recentMetrics, "L2"),
            l3CacheHitRate: this.calculateCacheHitRate(recentMetrics, "L3"),

            // Memory performance
            avgMemoryUsage:
                recentMetrics.reduce((sum, m) => sum + m.memoryUsed, 0) /
                recentMetrics.length,
            gcFrequency:
                recentMetrics.filter((m) => m.gcTriggered).length /
                recentMetrics.length,

            // Optimization effectiveness
            optimizationSuccessRate:
                recentMetrics.filter((m) => m.targetMet).length /
                recentMetrics.length,
            avgOptimizationGain:
                recentMetrics.reduce((sum, m) => sum + m.optimizationGain, 0) /
                recentMetrics.length,
        };

        return stats;
    }

    /**
     * Get detailed metrics for analysis
     */
    public getDetailedMetrics(limit: number = 100): PerformanceMetrics[] {
        return this.metrics.slice(-limit);
    }

    /**
     * Clear metrics history
     */
    public clearMetrics(): void {
        this.metrics = [];
        this.activeRequests.clear();
    }

    // Private helper methods

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private calibrateMeasurementOverhead(): number {
        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            const tempStart = performance.now();
            const tempEnd = performance.now();
            const tempDiff = tempEnd - tempStart;
        }

        const end = performance.now();
        return (end - start) / iterations;
    }

    private checkTargetMet(
        type: "ultra-fast" | "fast" | "standard",
        totalTime: number
    ): boolean {
        switch (type) {
            case "ultra-fast":
                return totalTime <= 1.0;
            case "fast":
                return totalTime <= 5.0;
            case "standard":
                return totalTime <= 20.0;
            default:
                return false;
        }
    }

    private calculateOptimizationGain(
        type: "ultra-fast" | "fast" | "standard",
        totalTime: number
    ): number {
        // Baseline times (before optimization)
        const baselines = {
            "ultra-fast": 5.0, // Was 5ms, now targeting 1ms
            fast: 15.0, // Was 15ms, now targeting 5ms
            standard: 50.0, // Was 50ms, now targeting 20ms
        };

        const baseline = baselines[type];
        return Math.max(0, baseline - totalTime);
    }

    private storeMetric(metric: PerformanceMetrics): void {
        this.metrics.push(metric);

        // Maintain history limit
        if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.maxMetricsHistory);
        }
    }

    private getPercentile(sortedArray: number[], percentile: number): number {
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)] || 0;
    }

    private calculateTargetRate(
        metrics: PerformanceMetrics[],
        type: "ultra-fast" | "fast"
    ): number {
        const typeMetrics = metrics.filter((m) => m.requestType === type);
        if (typeMetrics.length === 0) return 0;

        const targetMet = typeMetrics.filter((m) => m.targetMet).length;
        return targetMet / typeMetrics.length;
    }

    private calculateCacheHitRate(
        metrics: PerformanceMetrics[],
        layer?: "L1" | "L2" | "L3"
    ): number {
        const relevantMetrics = layer
            ? metrics.filter((m) => m.cacheLayer === layer)
            : metrics;

        if (relevantMetrics.length === 0) return 0;

        const hits = relevantMetrics.filter((m) => m.cacheHit).length;
        return hits / relevantMetrics.length;
    }

    private getEmptyStats(): PerformanceStats {
        return {
            totalRequests: 0,
            p50ResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
            avgResponseTime: 0,
            ultraFastTargetRate: 0,
            fastTargetRate: 0,
            overallCacheHitRate: 0,
            l1CacheHitRate: 0,
            l2CacheHitRate: 0,
            l3CacheHitRate: 0,
            avgMemoryUsage: 0,
            gcFrequency: 0,
            optimizationSuccessRate: 0,
            avgOptimizationGain: 0,
        };
    }
}


