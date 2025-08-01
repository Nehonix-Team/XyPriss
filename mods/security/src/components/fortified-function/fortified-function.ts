/**
 * XyPrissSecurity - Legacy Fortified Function Wrapper
 * Backward compatibility wrapper that delegates to the optimized modular system
 */

import { EventEmitter } from "events";
import {
    FortifiedFunctionOptions,
    FunctionStats,
    AuditEntry,
    TimingStats,
} from "./types/fortified-types";
import { FortifiedFunctionCore } from "./core/fortified-function-core";

/**
 * Legacy Fortified Function - Backward compatibility wrapper
 * Delegates to the optimized modular system while maintaining the same API
 */
export class FortifiedFunction<T extends any[], R> extends EventEmitter {
    private readonly optimizedInstance: FortifiedFunctionCore<T, R>;

    constructor(
        fn: (...args: T) => R | Promise<R>,
        options: FortifiedFunctionOptions = {}
    ) {
        super();

        // Create optimized instance and delegate to it
        this.optimizedInstance = FortifiedFunctionCore.create(fn, options);

        // Forward all events from the optimized instance
        this.optimizedInstance.on("execution_success", (data) =>
            this.emit("execution_success", data)
        );
        this.optimizedInstance.on("execution_error", (data) =>
            this.emit("execution_error", data)
        );
        this.optimizedInstance.on("execution_failed", (data) =>
            this.emit("execution_failed", data)
        );
        this.optimizedInstance.on("context_created", (data) =>
            this.emit("context_created", data)
        );
        this.optimizedInstance.on("context_cleaned", (data) =>
            this.emit("context_cleaned", data)
        );
        this.optimizedInstance.on("cache_hit", (data) =>
            this.emit("cache_hit", data)
        );
        this.optimizedInstance.on("cache_cleared", (data) =>
            this.emit("cache_cleared", data)
        );
        this.optimizedInstance.on("cache_warmed", (data) =>
            this.emit("cache_warmed", data)
        );
        this.optimizedInstance.on("memory_pressure_handled", (data) =>
            this.emit("memory_pressure_handled", data)
        );
        this.optimizedInstance.on("auto_optimization_applied", (data) =>
            this.emit("auto_optimization_applied", data)
        );
        this.optimizedInstance.on("options_updated", (data) =>
            this.emit("options_updated", data)
        );
        this.optimizedInstance.on("destroyed", (data) =>
            this.emit("destroyed", data)
        );
    }

    // ===== DELEGATED METHODS =====

    /**
     * Execute the function with all optimizations
     */
    public async execute(...args: T): Promise<R> {
        return this.optimizedInstance.execute(...args);
    }

    /**
     * Get function statistics
     */
    public getStats(): FunctionStats {
        return this.optimizedInstance.getStats();
    }

    /**
     * Get audit log
     */
    public getAuditLog(): AuditEntry[] {
        return this.optimizedInstance.getAuditLog();
    }

    /**
     * Get cache statistics
     */
    public getCacheStats() {
        return this.optimizedInstance.getCacheStats();
    }

    /**
     * Clear cache
     */
    public clearCache(): void {
        this.optimizedInstance.clearCache();
    }

    /**
     * Clear audit log
     */
    public clearAuditLog(): void {
        this.optimizedInstance.clearAuditLog();
    }

    /**
     * Get active executions count
     */
    public getActiveExecutionsCount(): number {
        return this.optimizedInstance.getActiveExecutionsCount();
    }

    /**
     * Get analytics data
     */
    public getAnalyticsData() {
        return this.optimizedInstance.getAnalyticsData();
    }

    /**
     * Get optimization suggestions
     */
    public getOptimizationSuggestions() {
        return this.optimizedInstance.getOptimizationSuggestions();
    }

    /**
     * Get performance trends
     */
    public getPerformanceTrends() {
        return this.optimizedInstance.getPerformanceTrends();
    }

    /**
     * Warm cache
     */
    public warmCache(): void {
        this.optimizedInstance.warmCache();
    }

    /**
     * Handle memory pressure
     */
    public handleMemoryPressure(level: "low" | "medium" | "high"): void {
        this.optimizedInstance.handleMemoryPressure(level);
    }

    /**
     * Detect anomalies
     */
    public detectAnomalies() {
        return this.optimizedInstance.detectAnomalies();
    }

    /**
     * Get detailed metrics
     */
    public getDetailedMetrics() {
        return this.optimizedInstance.getDetailedMetrics();
    }

    /**
     * Get ultra-fast component metrics
     */
    public getUltraFastMetrics(): any {
        return this.optimizedInstance.getUltraFastMetrics();
    }

    /**
     * Update function options dynamically
     */
    public updateOptions(newOptions: Partial<FortifiedFunctionOptions>): void {
        this.optimizedInstance.updateOptions(newOptions);
    }

    /**
     * Optimize performance by applying recommended settings
     */
    public optimizePerformance(): void {
        this.optimizedInstance.optimizePerformance();
    }

    // ===== PERFORMANCE TIMING METHODS =====

    /**
     * Start timing a specific operation
     */
    public startTimer(label: string, metadata?: Record<string, any>): void {
        this.optimizedInstance.startTimer(label, metadata);
    }

    /**
     * End timing for a specific operation
     */
    public endTimer(
        label: string,
        additionalMetadata?: Record<string, any>
    ): number {
        return this.optimizedInstance.endTimer(label, additionalMetadata);
    }

    /**
     * Measure delay between two points
     */
    public measureDelay(startPoint: string, endPoint: string): number {
        return this.optimizedInstance.measureDelay(startPoint, endPoint);
    }

    /**
     * Time a function execution
     */
    public async timeFunction<U>(
        label: string,
        fn: () => U | Promise<U>,
        metadata?: Record<string, any>
    ): Promise<{ result: U; duration: number }> {
        return this.optimizedInstance.timeFunction(label, fn, metadata);
    }

    /**
     * Get timing statistics
     */
    public getTimingStats(): TimingStats {
        return this.optimizedInstance.getTimingStats();
    }

    /**
     * Clear all timing measurements
     */
    public clearTimings(): void {
        this.optimizedInstance.clearTimings();
    }

    /**
     * Get measurements by pattern
     */
    public getMeasurementsByPattern(pattern: RegExp): any[] {
        return this.optimizedInstance.getMeasurementsByPattern(pattern);
    }

    /**
     * Check if a timer is active
     */
    public isTimerActive(label: string): boolean {
        return this.optimizedInstance.isTimerActive(label);
    }

    /**
     * Get active timers
     */
    public getActiveTimers(): string[] {
        return this.optimizedInstance.getActiveTimers();
    }

    // ===== CLEANUP AND DESTRUCTION =====

    /**
     * Destroy and clean up all resources
     */
    public destroy(): void {
        this.optimizedInstance.destroy();
        this.removeAllListeners();
    }
}

