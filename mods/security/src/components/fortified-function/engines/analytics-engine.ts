/**
 * XyPrissSecurity - Analytics Engine
 * Predictive analytics and pattern recognition for intelligent optimization
 */

import {
    ExecutionPattern,
    PerformanceMetrics,
    AnomalyDetection,
    PredictiveAnalysis,
    AnalyticsData,
    OptimizationSuggestion,
    AuditEntry,
} from "../types/types";

export class AnalyticsEngine {
    private executionPatterns = new Map<string, ExecutionPattern>();
    private performanceHistory: PerformanceMetrics[] = [];
    private anomalies: AnomalyDetection[] = [];
    private predictions: PredictiveAnalysis[] = [];
    private readonly maxHistorySize = 1000;
    private readonly anomalyThreshold = 2; // Standard deviations

    /**
     * Analyze execution patterns and update predictions
     */
    public analyzeExecution(auditEntry: AuditEntry): void {
        this.updateExecutionPattern(auditEntry);
        this.detectAnomalies(auditEntry);
        this.updatePredictions();
    }

    /**
     * Get execution patterns for cache warming
     */
    public getExecutionPatterns(): ExecutionPattern[] {
        return Array.from(this.executionPatterns.values()).sort(
            (a, b) => b.cacheWorthiness - a.cacheWorthiness
        );
    }

    /**
     * Predict next executions for preloading
     */
    public predictNextExecutions(): Array<{
        parametersHash: string;
        probability: number;
    }> {
        const now = new Date();
        const predictions: Array<{
            parametersHash: string;
            probability: number;
        }> = [];

        for (const pattern of this.executionPatterns.values()) {
            if (pattern.predictedNextExecution) {
                const timeDiff =
                    pattern.predictedNextExecution.getTime() - now.getTime();

                // If predicted execution is within next 5 minutes
                if (timeDiff > 0 && timeDiff < 300000) {
                    const probability = this.calculateExecutionProbability(
                        pattern,
                        timeDiff
                    );
                    predictions.push({
                        parametersHash: pattern.parametersHash,
                        probability,
                    });
                }
            }
        }

        return predictions.sort((a, b) => b.probability - a.probability);
    }

    /**
     * Detect performance anomalies
     */
    public detectPerformanceAnomalies(
        metrics: PerformanceMetrics
    ): AnomalyDetection[] {
        const newAnomalies: AnomalyDetection[] = [];

        // Check execution time anomaly
        const avgExecutionTime = this.getAverageMetric("executionTime");
        const executionTimeStdDev = this.getStandardDeviation("executionTime");

        if (
            Math.abs(metrics.executionTime - avgExecutionTime) >
            executionTimeStdDev * this.anomalyThreshold
        ) {
            newAnomalies.push({
                type: "performance",
                severity: this.calculateSeverity(
                    metrics.executionTime,
                    avgExecutionTime,
                    executionTimeStdDev
                ),
                description: `Execution time anomaly detected: ${
                    metrics.executionTime
                }ms vs average ${avgExecutionTime.toFixed(2)}ms`,
                timestamp: new Date(),
                metrics: {
                    executionTime: metrics.executionTime,
                    average: avgExecutionTime,
                },
            });
        }

        // Check memory usage anomaly
        const avgMemoryUsage = this.getAverageMetric("memoryUsage");
        const memoryStdDev = this.getStandardDeviation("memoryUsage");

        if (
            Math.abs(metrics.memoryUsage - avgMemoryUsage) >
            memoryStdDev * this.anomalyThreshold
        ) {
            newAnomalies.push({
                type: "memory",
                severity: this.calculateSeverity(
                    metrics.memoryUsage,
                    avgMemoryUsage,
                    memoryStdDev
                ),
                description: `Memory usage anomaly detected: ${
                    metrics.memoryUsage
                } bytes vs average ${avgMemoryUsage.toFixed(0)} bytes`,
                timestamp: new Date(),
                metrics: {
                    memoryUsage: metrics.memoryUsage,
                    average: avgMemoryUsage,
                },
            });
        }

        // Check error rate anomaly
        if (metrics.errorRate > 0.1) {
            // More than 10% error rate
            newAnomalies.push({
                type: "error",
                severity: metrics.errorRate > 0.5 ? "high" : "medium",
                description: `High error rate detected: ${(
                    metrics.errorRate * 100
                ).toFixed(1)}%`,
                timestamp: new Date(),
                metrics: { errorRate: metrics.errorRate },
            });
        }

        this.anomalies.push(...newAnomalies);
        this.limitAnomaliesHistory();

        return newAnomalies;
    }

    /**
     * Generate optimization suggestions
     */
    public generateOptimizationSuggestions(): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];

        // Cache optimization suggestions
        const cacheHitRate = this.getAverageMetric("cacheHitRate");
        if (cacheHitRate < 0.5) {
            suggestions.push({
                type: "cache",
                priority: "high",
                description:
                    "Low cache hit rate detected. Consider increasing cache size or adjusting TTL.",
                expectedImprovement: (0.7 - cacheHitRate) * 100,
                implementation: "Increase maxCacheSize or cacheTTL in options",
            });
        }

        // Timeout optimization
        const avgExecutionTime = this.getAverageMetric("executionTime");
        const maxExecutionTime = Math.max(
            ...this.performanceHistory.map((m) => m.executionTime)
        );

        if (maxExecutionTime > avgExecutionTime * 3) {
            suggestions.push({
                type: "timeout",
                priority: "medium",
                description:
                    "Some executions take significantly longer than average. Consider adaptive timeout.",
                expectedImprovement: 15,
                implementation: "Enable adaptiveTimeout option",
            });
        }

        // Memory optimization
        const avgMemoryUsage = this.getAverageMetric("memoryUsage");
        if (avgMemoryUsage > 50 * 1024 * 1024) {
            // 50MB
            suggestions.push({
                type: "memory",
                priority: "medium",
                description:
                    "High memory usage detected. Consider enabling smart memory management.",
                expectedImprovement: 25,
                implementation:
                    "Enable smartMemoryManagement and memoryPressureHandling options",
            });
        }

        // Security optimization
        const securityAnomalies = this.anomalies.filter(
            (a) => a.type === "security"
        ).length;
        if (securityAnomalies > 5) {
            suggestions.push({
                type: "security",
                priority: "high",
                description:
                    "Multiple security anomalies detected. Consider enabling threat detection.",
                expectedImprovement: 30,
                implementation:
                    "Enable threatDetection and smartSecurity options",
            });
        }

        return suggestions.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Get analytics data summary
     */
    public getAnalyticsData(): AnalyticsData {
        return {
            patterns: this.getExecutionPatterns(),
            trends: this.performanceHistory.slice(-100), // Last 100 entries
            anomalies: this.anomalies.slice(-50), // Last 50 anomalies
            predictions: this.predictions,
        };
    }

    /**
     * Update performance metrics history
     */
    public updatePerformanceMetrics(metrics: PerformanceMetrics): void {
        this.performanceHistory.push(metrics);

        // Limit history size
        if (this.performanceHistory.length > this.maxHistorySize) {
            this.performanceHistory.splice(
                0,
                this.performanceHistory.length - this.maxHistorySize
            );
        }

        // Detect anomalies in new metrics
        this.detectPerformanceAnomalies(metrics);
    }

    /**
     * Clear analytics data
     */
    public clearAnalytics(): void {
        this.executionPatterns.clear();
        this.performanceHistory.length = 0;
        this.anomalies.length = 0;
        this.predictions.length = 0;
    }

    /**
     * Private helper methods
     */
    private updateExecutionPattern(auditEntry: AuditEntry): void {
        const { parametersHash, executionTime } = auditEntry;

        let pattern = this.executionPatterns.get(parametersHash);

        if (!pattern) {
            pattern = {
                parametersHash,
                frequency: 0,
                averageExecutionTime: 0,
                lastExecuted: auditEntry.timestamp,
                cacheWorthiness: 0,
            };
            this.executionPatterns.set(parametersHash, pattern);
        }

        // Update pattern statistics
        pattern.frequency++;
        pattern.averageExecutionTime =
            (pattern.averageExecutionTime + executionTime) / 2;
        pattern.lastExecuted = auditEntry.timestamp;

        // Calculate cache worthiness (frequency * recency / execution time)
        const recency =
            1 /
            Math.max(1, (Date.now() - auditEntry.timestamp.getTime()) / 60000); // Minutes ago
        pattern.cacheWorthiness =
            (pattern.frequency * recency) /
            Math.max(1, pattern.averageExecutionTime / 1000);

        // Predict next execution based on frequency
        if (pattern.frequency > 2) {
            const avgInterval = this.calculateAverageInterval(parametersHash);
            if (avgInterval > 0) {
                pattern.predictedNextExecution = new Date(
                    Date.now() + avgInterval
                );
            }
        }
    }

    private calculateAverageInterval(parametersHash: string): number {
        // Calculate actual average time between executions based on historical data
        const pattern = this.executionPatterns.get(parametersHash);
        if (!pattern || pattern.frequency < 2) return 0;

        // Since PerformanceMetrics doesn't have timestamp, we need to track execution times differently
        // We'll use the pattern's lastExecuted and frequency to estimate intervals
        const now = Date.now();
        const lastExecutedTime = pattern.lastExecuted.getTime();
        const timeSinceLastExecution = now - lastExecutedTime;

        // If we have multiple executions, estimate based on frequency and time patterns
        if (pattern.frequency >= 3) {
            // Calculate estimated interval based on frequency over time
            // Assume the pattern has been active for at least the time since last execution
            const estimatedActiveTime = Math.max(
                timeSinceLastExecution,
                pattern.frequency * 60000
            ); // At least 1 minute per execution
            const avgInterval = estimatedActiveTime / (pattern.frequency - 1);

            // Apply smoothing to avoid extreme values
            const minInterval = 30000; // 30 seconds minimum
            const maxInterval = 7200000; // 2 hours maximum

            return Math.max(minInterval, Math.min(maxInterval, avgInterval));
        }

        // For patterns with only 2 executions, use a conservative estimate
        // based on the time since last execution and frequency
        const conservativeInterval = Math.max(
            timeSinceLastExecution / 2, // Half the time since last execution
            60000 // At least 1 minute
        );

        return Math.min(conservativeInterval, 3600000); // Cap at 1 hour
    }

    private detectAnomalies(auditEntry: AuditEntry): void {
        // Check for execution time anomalies
        const avgTime = this.getAverageExecutionTime(auditEntry.parametersHash);
        if (
            avgTime > 0 &&
            Math.abs(auditEntry.executionTime - avgTime) > avgTime * 2
        ) {
            this.anomalies.push({
                type: "performance",
                severity:
                    auditEntry.executionTime > avgTime * 3 ? "high" : "medium",
                description: `Execution time anomaly for ${
                    auditEntry.parametersHash
                }: ${auditEntry.executionTime}ms vs average ${avgTime.toFixed(
                    2
                )}ms`,
                timestamp: auditEntry.timestamp,
                metrics: {
                    executionTime: auditEntry.executionTime,
                    average: avgTime,
                },
            });
        }

        // Check for security anomalies
        if (auditEntry.securityFlags.length > 3) {
            this.anomalies.push({
                type: "security",
                severity: "medium",
                description: `Multiple security flags detected: ${auditEntry.securityFlags.join(
                    ", "
                )}`,
                timestamp: auditEntry.timestamp,
                metrics: { securityFlags: auditEntry.securityFlags.length },
            });
        }
    }

    private updatePredictions(): void {
        // Update predictions based on current patterns and trends
        this.predictions = [
            this.predictMetricTrend("executionTime"),
            this.predictMetricTrend("memoryUsage"),
            this.predictMetricTrend("cacheHitRate"),
        ].filter((p) => p.confidence > 0.5);
    }

    private predictMetricTrend(
        metric: keyof PerformanceMetrics
    ): PredictiveAnalysis {
        const recentValues = this.performanceHistory
            .slice(-10)
            .map((m) => m[metric]);
        const currentValue = recentValues[recentValues.length - 1] || 0;

        if (recentValues.length < 3) {
            return {
                metric,
                currentValue,
                predictedValue: currentValue,
                confidence: 0,
                timeframe: 300000, // 5 minutes
                trend: "stable",
            };
        }

        // Simple linear regression for trend prediction
        const trend = this.calculateTrend(recentValues);
        const predictedValue = currentValue + trend;
        const confidence = Math.min(0.9, recentValues.length / 10);

        return {
            metric,
            currentValue,
            predictedValue,
            confidence,
            timeframe: 300000, // 5 minutes
            trend:
                trend > 0.1
                    ? "increasing"
                    : trend < -0.1
                    ? "decreasing"
                    : "stable",
        };
    }

    private calculateTrend(values: number[]): number {
        if (values.length < 2) return 0;

        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    private getAverageExecutionTime(parametersHash: string): number {
        const pattern = this.executionPatterns.get(parametersHash);
        return pattern ? pattern.averageExecutionTime : 0;
    }

    private getAverageMetric(metric: keyof PerformanceMetrics): number {
        if (this.performanceHistory.length === 0) return 0;
        const sum = this.performanceHistory.reduce(
            (total, m) => total + m[metric],
            0
        );
        return sum / this.performanceHistory.length;
    }

    private getStandardDeviation(metric: keyof PerformanceMetrics): number {
        const avg = this.getAverageMetric(metric);
        const squaredDiffs = this.performanceHistory.map((m) =>
            Math.pow(m[metric] - avg, 2)
        );
        const avgSquaredDiff =
            squaredDiffs.reduce((sum, diff) => sum + diff, 0) /
            squaredDiffs.length;
        return Math.sqrt(avgSquaredDiff);
    }

    private calculateSeverity(
        value: number,
        average: number,
        stdDev: number
    ): "low" | "medium" | "high" {
        const deviations = Math.abs(value - average) / stdDev;
        if (deviations > 3) return "high";
        if (deviations > 2) return "medium";
        return "low";
    }

    private calculateExecutionProbability(
        pattern: ExecutionPattern,
        timeDiff: number
    ): number {
        // Higher frequency and closer predicted time = higher probability
        const frequencyScore = Math.min(1, pattern.frequency / 10);
        const timeScore = Math.max(0, 1 - timeDiff / 300000); // Closer to predicted time = higher score
        return (frequencyScore + timeScore) / 2;
    }

    private limitAnomaliesHistory(): void {
        if (this.anomalies.length > 100) {
            this.anomalies.splice(0, this.anomalies.length - 100);
        }
    }
}

