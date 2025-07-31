/**
 * Timing Manager - Modular component for performance timing
 * Part of the minimal modular architecture
 */

import { TimingStats } from "../../types/fortified-types";
import { PerformanceTimer } from "../../performance/performance-timer";
import { fortifiedLogger } from "../fortified-logger";

export class TimingManager {
    private performanceTimer: PerformanceTimer | null = null;
    private readonly functionId: string;

    constructor(functionId: string) {
        this.functionId = functionId;
    }

    /**
     * Initialize performance timer if needed
     */
    private initializeTimer(): void {
        if (!this.performanceTimer) {
            this.performanceTimer = new PerformanceTimer(
                `exec_${Date.now()}_${this.functionId}`,
                false
            );
        }
    }

    /**
     * Start timing a specific operation
     */
    startTimer(label: string, metadata?: Record<string, any>): void {
        this.initializeTimer();
        this.performanceTimer!.startTimer(label, metadata);
    }

    /**
     * End timing for a specific operation
     */
    endTimer(label: string, additionalMetadata?: Record<string, any>): number {
        if (!this.performanceTimer) {
            fortifiedLogger.warn(
                "TIMING",
                "Performance timer not initialized. Call startTimer first.",
                { functionId: this.functionId }
            );
            return 0;
        }
        return this.performanceTimer.endTimer(label, additionalMetadata);
    }

    /**
     * Measure delay between two points
     */
    measureDelay(startPoint: string, endPoint: string): number {
        if (!this.performanceTimer) {
            fortifiedLogger.warn(
                "TIMING",
                "Performance timer not initialized.",
                { functionId: this.functionId }
            );
            return 0;
        }
        return this.performanceTimer.measureDelay(startPoint, endPoint);
    }

    /**
     * Time a function execution
     */
    async timeFunction<U>(
        label: string,
        fn: () => U | Promise<U>,
        metadata?: Record<string, any>
    ): Promise<{ result: U; duration: number }> {
        this.initializeTimer();
        return await this.performanceTimer!.timeFunction(label, fn, metadata);
    }

    /**
     * Get timing statistics
     */
    getTimingStats(): TimingStats {
        if (!this.performanceTimer) {
            return {
                totalMeasurements: 0,
                completedMeasurements: 0,
                activeMeasurements: 0,
                measurements: [],
                summary: {
                    totalDuration: 0,
                    averageDuration: 0,
                    minDuration: 0,
                    maxDuration: 0,
                    slowestOperation: "",
                    fastestOperation: "",
                },
            };
        }
        return this.performanceTimer.getStats();
    }

    /**
     * Clear all timing measurements
     */
    clearTimings(): void {
        this.performanceTimer?.clear();
    }

    /**
     * Get measurements by pattern
     */
    getMeasurementsByPattern(pattern: RegExp): any[] {
        if (!this.performanceTimer) {
            return [];
        }
        return this.performanceTimer.getMeasurementsByPattern(pattern);
    }

    /**
     * Check if a timer is active
     */
    isTimerActive(label: string): boolean {
        if (!this.performanceTimer) {
            return false;
        }
        return this.performanceTimer.isTimerActive(label);
    }

    /**
     * Get active timers
     */
    getActiveTimers(): string[] {
        if (!this.performanceTimer) {
            return [];
        }
        return this.performanceTimer.getActiveTimers();
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.performanceTimer) {
            this.performanceTimer.clear();
            this.performanceTimer = null;
        }
        fortifiedLogger.debug("TIMING", `Timing manager destroyed for function: ${this.functionId}`);
    }
}
