/**
 * Performance Monitoring Utilities for XyPrissSecurity
 * Monitor and optimize cryptographic operations performance
 */

export interface PerformanceMetrics {
    operationName: string;
    startTime: bigint;
    endTime?: bigint;
    duration?: number; // milliseconds
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    keySize?: number;
    dataSize?: number;
    algorithm?: string;
    success: boolean;
    errorType?: string;
}

export interface PerformanceBenchmark {
    operation: string;
    algorithm: string;
    keySize: number;
    dataSize: number;
    iterations: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    memoryPeak: number;
    recommendations: string[];
}

/**
 * Performance monitor for cryptographic operations
 */
export class CryptoPerformanceMonitor {
    private metrics: PerformanceMetrics[] = [];
    private activeOperations: Map<string, PerformanceMetrics> = new Map();
    private benchmarks: Map<string, PerformanceBenchmark> = new Map();

    /**
     * Start monitoring an operation
     */
    startOperation(
        operationId: string,
        operationName: string,
        metadata?: {
            keySize?: number;
            dataSize?: number;
            algorithm?: string;
        }
    ): void {
        const metric: PerformanceMetrics = {
            operationName,
            startTime: process.hrtime.bigint(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            success: false,
            ...metadata,
        };

        this.activeOperations.set(operationId, metric);
    }

    /**
     * End monitoring an operation
     */
    endOperation(
        operationId: string,
        success: boolean = true,
        errorType?: string
    ): PerformanceMetrics | null {
        const metric = this.activeOperations.get(operationId);
        if (!metric) {
            console.warn(`No active operation found for ID: ${operationId}`);
            return null;
        }

        metric.endTime = process.hrtime.bigint();
        metric.duration = Number(metric.endTime - metric.startTime) / 1_000_000; // Convert to milliseconds
        metric.success = success;
        metric.errorType = errorType;

        // Calculate memory and CPU usage
        const currentMemory = process.memoryUsage();
        const currentCpu = process.cpuUsage(metric.cpuUsage);

        metric.memoryUsage = {
            rss: currentMemory.rss - (metric.memoryUsage?.rss || 0),
            heapTotal:
                currentMemory.heapTotal - (metric.memoryUsage?.heapTotal || 0),
            heapUsed:
                currentMemory.heapUsed - (metric.memoryUsage?.heapUsed || 0),
            external:
                currentMemory.external - (metric.memoryUsage?.external || 0),
            arrayBuffers:
                currentMemory.arrayBuffers -
                (metric.memoryUsage?.arrayBuffers || 0),
        };

        metric.cpuUsage = currentCpu;

        this.metrics.push(metric);
        this.activeOperations.delete(operationId);

        return metric;
    }

    /**
     * Get performance statistics for an operation type
     */
    getOperationStats(operationName: string): {
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        avgDuration: number;
        minDuration: number;
        maxDuration: number;
        successRate: number;
        avgMemoryUsage: number;
    } {
        const operationMetrics = this.metrics.filter(
            (m) => m.operationName === operationName
        );

        if (operationMetrics.length === 0) {
            return {
                totalOperations: 0,
                successfulOperations: 0,
                failedOperations: 0,
                avgDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                successRate: 0,
                avgMemoryUsage: 0,
            };
        }

        const successful = operationMetrics.filter((m) => m.success);
        const durations = operationMetrics.map((m) => m.duration || 0);
        const memoryUsages = operationMetrics.map(
            (m) => m.memoryUsage?.heapUsed || 0
        );

        return {
            totalOperations: operationMetrics.length,
            successfulOperations: successful.length,
            failedOperations: operationMetrics.length - successful.length,
            avgDuration:
                durations.reduce((a, b) => a + b, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            successRate: (successful.length / operationMetrics.length) * 100,
            avgMemoryUsage:
                memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        };
    }

    /**
     * Benchmark a cryptographic operation
     */
    async benchmarkOperation<T>(
        operationName: string,
        operation: () => Promise<T>,
        iterations: number = 100,
        metadata?: {
            algorithm?: string;
            keySize?: number;
            dataSize?: number;
        }
    ): Promise<PerformanceBenchmark> {
        const results: number[] = [];
        let successCount = 0;
        let maxMemory = 0;
        const recommendations: string[] = [];

        console.log(
            `Starting benchmark for ${operationName} (${iterations} iterations)...`
        );

        for (let i = 0; i < iterations; i++) {
            const operationId = `benchmark_${operationName}_${i}`;

            try {
                this.startOperation(operationId, operationName, metadata);
                await operation();
                const metric = this.endOperation(operationId, true);

                if (metric) {
                    results.push(metric.duration || 0);
                    successCount++;
                    maxMemory = Math.max(
                        maxMemory,
                        metric.memoryUsage?.heapUsed || 0
                    );
                }
            } catch (error) {
                this.endOperation(operationId, false, (error as Error).name);
            }
        }

        const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
        const minDuration = Math.min(...results);
        const maxDuration = Math.max(...results);
        const successRate = (successCount / iterations) * 100;

        // Generate performance recommendations
        if (avgDuration > 1000) {
            recommendations.push(
                "Operation is slow - consider optimizing algorithm or key size"
            );
        }
        if (successRate < 95) {
            recommendations.push(
                "Low success rate detected - investigate error causes"
            );
        }
        if (maxMemory > 100 * 1024 * 1024) {
            // 100MB
            recommendations.push(
                "High memory usage detected - consider memory optimization"
            );
        }
        if (metadata?.keySize && metadata.keySize > 4096) {
            recommendations.push(
                "Large key size may impact performance - consider if necessary"
            );
        }

        const benchmark: PerformanceBenchmark = {
            operation: operationName,
            algorithm: metadata?.algorithm || "unknown",
            keySize: metadata?.keySize || 0,
            dataSize: metadata?.dataSize || 0,
            iterations,
            avgDuration,
            minDuration,
            maxDuration,
            successRate,
            memoryPeak: maxMemory,
            recommendations,
        };

        const benchmarkKey = `${operationName}_${metadata?.algorithm}_${metadata?.keySize}`;
        this.benchmarks.set(benchmarkKey, benchmark);

        return benchmark;
    }

    /**
     * Get performance recommendations based on collected metrics
     */
    getPerformanceRecommendations(): string[] {
        const recommendations: string[] = [];
        const stats = new Map<string, any>();

        // Collect stats for each operation type
        const operationTypes = [
            ...new Set(this.metrics.map((m) => m.operationName)),
        ];
        for (const opType of operationTypes) {
            stats.set(opType, this.getOperationStats(opType));
        }

        // Analyze and generate recommendations
        for (const [operation, stat] of stats.entries()) {
            if (stat.successRate < 95) {
                recommendations.push(
                    `${operation}: Low success rate (${stat.successRate.toFixed(
                        1
                    )}%) - investigate errors`
                );
            }
            if (stat.avgDuration > 1000) {
                recommendations.push(
                    `${operation}: Slow performance (${stat.avgDuration.toFixed(
                        1
                    )}ms avg) - consider optimization`
                );
            }
            if (stat.avgMemoryUsage > 50 * 1024 * 1024) {
                // 50MB
                recommendations.push(
                    `${operation}: High memory usage (${(
                        stat.avgMemoryUsage /
                        1024 /
                        1024
                    ).toFixed(1)}MB avg) - optimize memory usage`
                );
            }
        }

        // General recommendations
        if (this.metrics.length > 1000) {
            recommendations.push(
                "Large number of operations recorded - consider clearing old metrics"
            );
        }

        return recommendations;
    }

    /**
     * Clear old metrics to prevent memory leaks
     */
    clearOldMetrics(maxAge: number = 3600000): void {
        // 1 hour default
        const cutoff = Date.now() - maxAge;
        this.metrics = this.metrics.filter((metric) => {
            const metricTime = Number(metric.startTime) / 1_000_000; // Convert to milliseconds
            return metricTime > cutoff;
        });
    }

    /**
     * Export metrics for external analysis
     */
    exportMetrics(): {
        metrics: PerformanceMetrics[];
        benchmarks: PerformanceBenchmark[];
        summary: Record<string, any>;
    } {
        const summary: Record<string, any> = {};
        const operationTypes = [
            ...new Set(this.metrics.map((m) => m.operationName)),
        ];

        for (const opType of operationTypes) {
            summary[opType] = this.getOperationStats(opType);
        }

        return {
            metrics: this.metrics,
            benchmarks: Array.from(this.benchmarks.values()),
            summary,
        };
    }

    /**
     * Monitor system resources
     */
    getSystemResourceUsage(): {
        memory: NodeJS.MemoryUsage;
        cpu: NodeJS.CpuUsage;
        uptime: number;
        loadAverage: number[];
    } {
        return {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime(),
            loadAverage: require("os").loadavg(),
        };
    }

    /**
     * Performance-aware operation wrapper
     */
    async monitoredOperation<T>(
        operationName: string,
        operation: () => Promise<T>,
        metadata?: {
            algorithm?: string;
            keySize?: number;
            dataSize?: number;
        }
    ): Promise<T> {
        const operationId = `${operationName}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

        try {
            this.startOperation(operationId, operationName, metadata);
            const result = await operation();
            this.endOperation(operationId, true);
            return result;
        } catch (error) {
            this.endOperation(operationId, false, (error as Error).name);
            throw error;
        }
    }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new CryptoPerformanceMonitor();

/**
 * Decorator for automatic performance monitoring
 */
export function monitored(operationName?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const opName =
            operationName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            return globalPerformanceMonitor.monitoredOperation(opName, () =>
                originalMethod.apply(this, args)
            );
        };

        return descriptor;
    };
}

