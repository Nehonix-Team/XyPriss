/**
 * Performance Timer for FortifiedFunction
 * Tracks execution delays and measures performance between specific points
 */

export interface TimingMeasurement {
    label: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export interface TimingStats {
    totalMeasurements: number;
    completedMeasurements: number;
    activeMeasurements: number;
    measurements: TimingMeasurement[];
    summary: {
        totalDuration: number;
        averageDuration: number;
        minDuration: number;
        maxDuration: number;
        slowestOperation: string;
        fastestOperation: string;
    };
}

export class PerformanceTimer {
    private measurements = new Map<string, TimingMeasurement>();
    private completedMeasurements: TimingMeasurement[] = [];
    private executionId: string;
    private ultraFastMode: boolean;

    constructor(executionId: string, ultraFastMode: boolean = false) {
        this.executionId = executionId;
        this.ultraFastMode = ultraFastMode;
    }

    /**
     * Start timing a specific operation
     */
    public startTimer(label: string, metadata?: Record<string, any>): void {
        if (this.ultraFastMode) {
            // In ultra-fast mode, use minimal overhead timing
            this.measurements.set(label, {
                label,
                startTime: performance.now(),
                metadata
            });
            return;
        }

        const measurement: TimingMeasurement = {
            label,
            startTime: performance.now(),
            metadata: {
                executionId: this.executionId,
                timestamp: new Date().toISOString(),
                ...metadata
            }
        };

        this.measurements.set(label, measurement);
    }

    /**
     * End timing for a specific operation
     */
    public endTimer(label: string, additionalMetadata?: Record<string, any>): number {
        const measurement = this.measurements.get(label);
        if (!measurement) {
            console.warn(`Timer '${label}' was not started`);
            return 0;
        }

        const endTime = performance.now();
        const duration = endTime - measurement.startTime;

        // Complete the measurement
        measurement.endTime = endTime;
        measurement.duration = duration;
        
        if (additionalMetadata && measurement.metadata) {
            Object.assign(measurement.metadata, additionalMetadata);
        }

        // Move to completed measurements
        this.completedMeasurements.push(measurement);
        this.measurements.delete(label);

        if (!this.ultraFastMode) {
            console.log(`${label}: ${duration.toFixed(2)}ms`);
        }

        return duration;
    }

    /**
     * Measure a delay between two points (convenience method)
     */
    public measureDelay(startPoint: string, endPoint: string): number {
        const startMeasurement = this.completedMeasurements.find(m => m.label === startPoint);
        const endMeasurement = this.completedMeasurements.find(m => m.label === endPoint);

        if (!startMeasurement || !endMeasurement) {
            console.warn(`Cannot measure delay between '${startPoint}' and '${endPoint}' - measurements not found`);
            return 0;
        }

        if (!startMeasurement.endTime || !endMeasurement.startTime) {
            console.warn(`Cannot measure delay - incomplete measurements`);
            return 0;
        }

        return endMeasurement.startTime - startMeasurement.endTime;
    }

    /**
     * Time a function execution
     */
    public async timeFunction<T>(
        label: string, 
        fn: () => T | Promise<T>,
        metadata?: Record<string, any>
    ): Promise<{ result: T; duration: number }> {
        this.startTimer(label, metadata);
        
        try {
            const result = await fn();
            const duration = this.endTimer(label, { success: true });
            return { result, duration };
        } catch (error) {
            const duration = this.endTimer(label, { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            throw error;
        }
    }

    /**
     * Get current timing statistics
     */
    public getStats(): TimingStats {
        const allMeasurements = [...this.completedMeasurements];
        const completedOnly = this.completedMeasurements.filter(m => m.duration !== undefined);
        
        if (completedOnly.length === 0) {
            return {
                totalMeasurements: allMeasurements.length,
                completedMeasurements: 0,
                activeMeasurements: this.measurements.size,
                measurements: allMeasurements,
                summary: {
                    totalDuration: 0,
                    averageDuration: 0,
                    minDuration: 0,
                    maxDuration: 0,
                    slowestOperation: '',
                    fastestOperation: ''
                }
            };
        }

        const durations = completedOnly.map(m => m.duration!);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const averageDuration = totalDuration / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        
        const slowestOp = completedOnly.find(m => m.duration === maxDuration);
        const fastestOp = completedOnly.find(m => m.duration === minDuration);

        return {
            totalMeasurements: allMeasurements.length,
            completedMeasurements: completedOnly.length,
            activeMeasurements: this.measurements.size,
            measurements: allMeasurements,
            summary: {
                totalDuration,
                averageDuration,
                minDuration,
                maxDuration,
                slowestOperation: slowestOp?.label || '',
                fastestOperation: fastestOp?.label || ''
            }
        };
    }

    /**
     * Get measurements by pattern
     */
    public getMeasurementsByPattern(pattern: RegExp): TimingMeasurement[] {
        return this.completedMeasurements.filter(m => pattern.test(m.label));
    }

    /**
     * Clear all measurements
     */
    public clear(): void {
        this.measurements.clear();
        this.completedMeasurements = [];
    }

    /**
     * Get active timers
     */
    public getActiveTimers(): string[] {
        return Array.from(this.measurements.keys());
    }

    /**
     * Check if a timer is active
     */
    public isTimerActive(label: string): boolean {
        return this.measurements.has(label);
    }

    /**
     * Get timing summary for audit logs
     */
    public getAuditSummary(): Record<string, any> {
        const stats = this.getStats();
        return {
            executionId: this.executionId,
            totalMeasurements: stats.totalMeasurements,
            totalDuration: stats.summary.totalDuration,
            averageDuration: stats.summary.averageDuration,
            slowestOperation: stats.summary.slowestOperation,
            fastestOperation: stats.summary.fastestOperation,
            measurements: stats.measurements.map(m => ({
                label: m.label,
                duration: m.duration,
                success: m.metadata?.success
            }))
        };
    }
}
