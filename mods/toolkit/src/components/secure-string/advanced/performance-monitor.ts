/**
 * Performance Monitor Module
 * Provides performance monitoring and optimization for SecureString operations
 */

/**
 * Performance metrics for operations
 */
import { performance as nodePerformance } from "perf_hooks";

export interface PerformanceMetrics {
    operationType: string;
    startTime: number;
    endTime: number;
    duration: number;
    memoryBefore: number;
    memoryAfter: number;
    memoryDelta: number;
    cpuUsage?: number;
    operationSize: number;
    throughput: number;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
    totalOperations: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalMemoryUsed: number;
    averageMemoryUsage: number;
    operationBreakdown: Record<string, number>;
    throughputStats: {
        average: number;
        peak: number;
        current: number;
    };
    recommendations: string[];
}

/**
 * Performance benchmark result
 */
export interface BenchmarkResult {
    operation: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    operationsPerSecond: number;
    memoryEfficiency: number;
    scalabilityScore: number;
    recommendations: string[];
}

/**
 * Performance monitor for SecureString operations
 */
export class PerformanceMonitor {
    private static metrics: PerformanceMetrics[] = [];
    private static isMonitoring: boolean = false;
    private static maxMetricsHistory: number = 1000;

    /**
     * Starts performance monitoring
     */
    static startMonitoring(): void {
        this.isMonitoring = true;
        this.metrics = [];
    }

    /**
     * Stops performance monitoring
     */
    static stopMonitoring(): void {
        this.isMonitoring = false;
    }

    /**
     * Records a performance metric
     */
    static recordMetric(
        operationType: string,
        startTime: number,
        endTime: number,
        operationSize: number = 0,
        memoryBefore: number = 0,
        memoryAfter: number = 0
    ): void {
        if (!this.isMonitoring) return;

        const duration = endTime - startTime;
        const memoryDelta = memoryAfter - memoryBefore;
        const throughput = operationSize > 0 ? operationSize / duration : 0;

        const metric: PerformanceMetrics = {
            operationType,
            startTime,
            endTime,
            duration,
            memoryBefore,
            memoryAfter,
            memoryDelta,
            operationSize,
            throughput,
        };

        this.metrics.push(metric);

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.maxMetricsHistory);
        }
    }

    /**
     * Gets performance statistics
     */
    static getStats(): PerformanceStats {
        if (this.metrics.length === 0) {
            return this.getEmptyStats();
        }

        const durations = this.metrics.map((m) => m.duration);
        const memoryUsages = this.metrics.map((m) => Math.abs(m.memoryDelta));
        const throughputs = this.metrics
            .map((m) => m.throughput)
            .filter((t) => t > 0);

        const operationBreakdown: Record<string, number> = {};
        for (const metric of this.metrics) {
            operationBreakdown[metric.operationType] =
                (operationBreakdown[metric.operationType] || 0) + 1;
        }

        const averageDuration =
            durations.reduce((a, b) => a + b, 0) / durations.length;
        const averageMemoryUsage =
            memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
        const averageThroughput =
            throughputs.length > 0
                ? throughputs.reduce((a, b) => a + b, 0) / throughputs.length
                : 0;

        return {
            totalOperations: this.metrics.length,
            averageDuration,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            totalMemoryUsed: memoryUsages.reduce((a, b) => a + b, 0),
            averageMemoryUsage,
            operationBreakdown,
            throughputStats: {
                average: averageThroughput,
                peak: throughputs.length > 0 ? Math.max(...throughputs) : 0,
                current:
                    throughputs.length > 0
                        ? throughputs[throughputs.length - 1]
                        : 0,
            },
            recommendations: this.generateRecommendations(
                averageDuration,
                averageMemoryUsage,
                operationBreakdown,
                this.metrics.length
            ),
        };
    }

    /**
     * Benchmarks a specific operation
     */
    static async benchmark(
        operation: () => Promise<any> | any,
        operationName: string,
        iterations: number = 100,
        warmupIterations: number = 10
    ): Promise<BenchmarkResult> {
        // Warmup
        for (let i = 0; i < warmupIterations; i++) {
            await operation();
        }

        // Benchmark
        const times: number[] = [];
        const memoryUsages: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const memoryBefore = this.getMemoryUsage();

            const perf =
                typeof performance !== "undefined"
                    ? performance
                    : nodePerformance;
            const startTime = perf.now();
            await operation();

            const endTime = performance.now();
            const memoryAfter = this.getMemoryUsage();

            times.push(endTime - startTime);
            memoryUsages.push(memoryAfter - memoryBefore);
        }

        const totalTime = times.reduce((a, b) => a + b, 0);
        const averageTime = totalTime / iterations;
        const operationsPerSecond = 1000 / averageTime;
        const averageMemoryUsage =
            memoryUsages.reduce((a, b) => a + b, 0) / iterations;

        // Calculate efficiency metrics
        const memoryEfficiency = this.calculateMemoryEfficiency(memoryUsages);
        const scalabilityScore = this.calculateScalabilityScore(times);

        return {
            operation: operationName,
            iterations,
            totalTime,
            averageTime,
            operationsPerSecond,
            memoryEfficiency,
            scalabilityScore,
            recommendations: this.generateBenchmarkRecommendations(
                averageTime,
                memoryEfficiency,
                scalabilityScore
            ),
        };
    }

    /**
     * Profiles memory usage during operation
     */
    static async profileMemory<T>(
        operation: () => Promise<T> | T,
        samplingInterval: number = 10
    ): Promise<{
        result: T;
        memoryProfile: Array<{ timestamp: number; usage: number }>;
        peakUsage: number;
        averageUsage: number;
    }> {
        const memoryProfile: Array<{ timestamp: number; usage: number }> = [];
        let isRunning = true;

        // Start memory sampling
        const samplingPromise = (async () => {
            while (isRunning) {
                memoryProfile.push({
                    timestamp: Date.now(),
                    usage: this.getMemoryUsage(),
                });
                await this.sleep(samplingInterval);
            }
        })();

        // Execute operation
        const result = await operation();
        isRunning = false;
        await samplingPromise;

        const usages = memoryProfile.map((p) => p.usage);
        const peakUsage = Math.max(...usages);
        const averageUsage = usages.reduce((a, b) => a + b, 0) / usages.length;

        return {
            result,
            memoryProfile,
            peakUsage,
            averageUsage,
        };
    }

    /**
     * Measures operation with automatic metric recording
     */
    static async measure<T>(
        operation: () => Promise<T> | T,
        operationType: string,
        operationSize: number = 0
    ): Promise<T> {
        const memoryBefore = this.getMemoryUsage();
        const startTime = performance.now();

        try {
            const result = await operation();
            const endTime = performance.now();
            const memoryAfter = this.getMemoryUsage();

            this.recordMetric(
                operationType,
                startTime,
                endTime,
                operationSize,
                memoryBefore,
                memoryAfter
            );

            return result;
        } catch (error) {
            const endTime = performance.now();
            const memoryAfter = this.getMemoryUsage();

            this.recordMetric(
                `${operationType}_ERROR`,
                startTime,
                endTime,
                operationSize,
                memoryBefore,
                memoryAfter
            );

            throw error;
        }
    }

    /**
     * Gets recent metrics for a specific operation type
     */
    static getMetricsForOperation(
        operationType: string,
        limit: number = 50
    ): PerformanceMetrics[] {
        return this.metrics
            .filter((m) => m.operationType === operationType)
            .slice(-limit);
    }

    /**
     * Clears all metrics
     */
    static clearMetrics(): void {
        this.metrics = [];
    }

    /**
     * Exports metrics to JSON
     */
    static exportMetrics(): string {
        return JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                metrics: this.metrics,
                stats: this.getStats(),
            },
            null,
            2
        );
    }

    /**
     * Analyzes performance trends
     */
    static analyzeTrends(operationType?: string): {
        trend: "improving" | "degrading" | "stable";
        confidence: number;
        analysis: string;
    } {
        const relevantMetrics = operationType
            ? this.metrics.filter((m) => m.operationType === operationType)
            : this.metrics;

        if (relevantMetrics.length < 10) {
            return {
                trend: "stable",
                confidence: 0,
                analysis: "Insufficient data for trend analysis",
            };
        }

        // Analyze last 20% vs first 20% of metrics
        const sampleSize = Math.floor(relevantMetrics.length * 0.2);
        const earlyMetrics = relevantMetrics.slice(0, sampleSize);
        const recentMetrics = relevantMetrics.slice(-sampleSize);

        const earlyAvg =
            earlyMetrics.reduce((sum, m) => sum + m.duration, 0) /
            earlyMetrics.length;
        const recentAvg =
            recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
            recentMetrics.length;

        const change = (recentAvg - earlyAvg) / earlyAvg;
        const confidence = Math.min(1, sampleSize / 10);

        let trend: "improving" | "degrading" | "stable";
        let analysis: string;

        if (Math.abs(change) < 0.05) {
            trend = "stable";
            analysis = "Performance has remained relatively stable";
        } else if (change < 0) {
            trend = "improving";
            analysis = `Performance has improved by ${Math.abs(
                change * 100
            ).toFixed(1)}%`;
        } else {
            trend = "degrading";
            analysis = `Performance has degraded by ${Math.abs(
                change * 100
            ).toFixed(1)}%`;
        }

        return { trend, confidence, analysis };
    }

    /**
     * Helper methods
     */
    private static getMemoryUsage(): number {
        if (typeof performance !== "undefined" && "memory" in performance) {
            return (performance as any).memory?.usedJSHeapSize ?? 0;
        }
        if (typeof process !== "undefined" && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private static calculateMemoryEfficiency(memoryUsages: number[]): number {
        const maxUsage = Math.max(...memoryUsages.map(Math.abs));
        const avgUsage =
            memoryUsages.reduce((a, b) => a + Math.abs(b), 0) /
            memoryUsages.length;

        if (maxUsage === 0) return 1;
        return 1 - avgUsage / maxUsage;
    }

    private static calculateScalabilityScore(times: number[]): number {
        if (times.length < 2) return 1;

        // Calculate coefficient of variation (lower is better for scalability)
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance =
            times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) /
            times.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / mean;

        // Convert to 0-1 score (1 is best)
        return Math.max(0, 1 - coefficientOfVariation);
    }

    private static generateRecommendations(
        averageDuration: number,
        averageMemoryUsage: number,
        operationBreakdown: Record<string, number>,
        totalOperations: number
    ): string[] {
        const recommendations: string[] = [];

        if (averageDuration > 100) {
            recommendations.push(
                "Consider optimizing operations - average duration is high"
            );
        }

        if (averageMemoryUsage > 1000000) {
            recommendations.push(
                "High memory usage detected - consider memory optimization"
            );
        }

        const cryptoOps = operationBreakdown["hash"] || 0;

        if (cryptoOps / totalOperations > 0.5) {
            recommendations.push(
                "High cryptographic operation usage - consider caching results"
            );
        }

        return recommendations;
    }

    private static generateBenchmarkRecommendations(
        averageTime: number,
        memoryEfficiency: number,
        scalabilityScore: number
    ): string[] {
        const recommendations: string[] = [];

        if (averageTime > 50) {
            recommendations.push(
                "Operation time is high - consider optimization"
            );
        }

        if (memoryEfficiency < 0.7) {
            recommendations.push(
                "Memory efficiency is low - review memory usage patterns"
            );
        }

        if (scalabilityScore < 0.8) {
            recommendations.push(
                "Performance variability is high - investigate consistency issues"
            );
        }

        return recommendations;
    }

    private static getEmptyStats(): PerformanceStats {
        return {
            totalOperations: 0,
            averageDuration: 0,
            minDuration: 0,
            maxDuration: 0,
            totalMemoryUsed: 0,
            averageMemoryUsage: 0,
            operationBreakdown: {},
            throughputStats: {
                average: 0,
                peak: 0,
                current: 0,
            },
            recommendations: [],
        };
    }
}

