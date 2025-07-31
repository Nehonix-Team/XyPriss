/**
 * XyPrissSecurity - Optimization Engine
 * Intelligent performance optimization and adaptive tuning
 */

import {
    FortifiedFunctionOptions,
    PerformanceMetrics,
    OptimizationSuggestion,
    ThreatDetectionResult,
} from "../types/types";
import { memoryManager } from "../../../utils/memory";

export class OptimizationEngine {
    private adaptiveSettings = new Map<string, any>();
    private performanceBaseline: PerformanceMetrics | null = null;
    private optimizationHistory: Array<{
        timestamp: Date;
        optimization: string;
        beforeMetrics: PerformanceMetrics;
        afterMetrics?: PerformanceMetrics;
        improvement: number;
    }> = [];

    // Call frequency tracking
    private callFrequencyMap = new Map<
        string,
        {
            count: number;
            firstCall: number;
            lastCall: number;
            intervals: number[];
        }
    >();

    // Parameter pattern tracking
    private parameterPatterns = new Map<
        string,
        {
            frequency: number;
            lastSeen: number;
            variations: Set<string>;
            suspiciousCount: number;
        }
    >();

    /**
     * Optimize function options based on performance data
     */
    public optimizeOptions(
        currentOptions: Required<FortifiedFunctionOptions>,
        metrics: PerformanceMetrics,
        suggestions: OptimizationSuggestion[]
    ): Partial<FortifiedFunctionOptions> {
        const optimizations: Partial<FortifiedFunctionOptions> = {};

        // Apply high-priority suggestions first
        const highPrioritySuggestions = suggestions.filter(
            (s) => s.priority === "high" || s.priority === "critical"
        );

        for (const suggestion of highPrioritySuggestions) {
            const optimization = this.applySuggestion(
                suggestion,
                currentOptions,
                metrics
            );
            Object.assign(optimizations, optimization);
        }

        // Adaptive timeout optimization
        if (currentOptions.adaptiveTimeout) {
            optimizations.timeout = this.optimizeTimeout(
                metrics,
                currentOptions.timeout
            );
        }

        // Smart cache optimization
        if (currentOptions.smartCaching) {
            const cacheOptimizations = this.optimizeCacheSettings(
                metrics,
                currentOptions
            );
            Object.assign(optimizations, cacheOptimizations);
        }

        // Memory optimization
        if (currentOptions.smartMemoryManagement) {
            const memoryOptimizations = this.optimizeMemorySettings(
                metrics,
                currentOptions
            );
            Object.assign(optimizations, memoryOptimizations);
        }

        // Retry strategy optimization
        if (currentOptions.intelligentRetry) {
            const retryOptimizations = this.optimizeRetryStrategy(
                metrics,
                currentOptions
            );
            Object.assign(optimizations, retryOptimizations);
        }

        return optimizations;
    }

    /**
     * Adaptive timeout calculation based on execution patterns
     */
    public optimizeTimeout(
        metrics: PerformanceMetrics,
        currentTimeout: number
    ): number {
        const { executionTime, errorRate } = metrics;

        // If execution time is consistently much lower than timeout, reduce it
        if (executionTime < currentTimeout * 0.3 && errorRate < 0.05) {
            return Math.max(executionTime * 2, 5000); // At least 5 seconds
        }

        // If we're getting timeouts (high error rate), increase timeout
        if (errorRate > 0.1) {
            return Math.min(currentTimeout * 1.5, 120000); // Max 2 minutes
        }

        // Adaptive adjustment based on recent performance
        const adaptiveTimeout = executionTime * 3; // 3x average execution time
        return Math.max(Math.min(adaptiveTimeout, 60000), 5000); // Between 5s and 60s
    }

    /**
     * Optimize cache settings based on performance
     */
    public optimizeCacheSettings(
        metrics: PerformanceMetrics,
        currentOptions: Required<FortifiedFunctionOptions>
    ): Partial<FortifiedFunctionOptions> {
        const optimizations: Partial<FortifiedFunctionOptions> = {};

        // Adjust cache size based on hit rate and memory usage
        if (metrics.cacheHitRate < 0.5 && metrics.memoryUsage < 0.7) {
            // Low hit rate but memory available - increase cache size
            optimizations.maxCacheSize = Math.min(
                (currentOptions.maxCacheSize || 1000) * 1.5,
                5000
            );
        } else if (metrics.cacheHitRate > 0.8 && metrics.memoryUsage > 0.8) {
            // High hit rate but memory pressure - optimize cache strategy
            optimizations.cacheStrategy = "lru"; // More memory efficient
        }

        // Adjust TTL based on access patterns
        if (metrics.cacheHitRate > 0.7) {
            // High hit rate - can afford longer TTL
            optimizations.cacheTTL = Math.min(
                (currentOptions.cacheTTL || 300000) * 1.2,
                600000
            );
        } else if (metrics.cacheHitRate < 0.3) {
            // Low hit rate - shorter TTL for fresher data
            optimizations.cacheTTL = Math.max(
                (currentOptions.cacheTTL || 300000) * 0.8,
                60000
            );
        }

        return optimizations;
    }

    /**
     * Optimize memory settings based on usage patterns
     */
    public optimizeMemorySettings(
        metrics: PerformanceMetrics,
        currentOptions: Required<FortifiedFunctionOptions>
    ): Partial<FortifiedFunctionOptions> {
        const optimizations: Partial<FortifiedFunctionOptions> = {};
        const memoryStats = memoryManager.getStats();

        // Adjust memory limits based on system pressure
        if (memoryStats.pressure > 0.8) {
            // High memory pressure - reduce limits
            optimizations.maxMemoryUsage = Math.max(
                currentOptions.maxMemoryUsage * 0.8,
                50 * 1024 * 1024 // Minimum 50MB
            );
            optimizations.memoryWipeDelay = 0; // Immediate cleanup
        } else if (
            memoryStats.pressure < 0.5 &&
            metrics.memoryUsage > currentOptions.maxMemoryUsage * 0.8
        ) {
            // Low system pressure but high function usage - increase limits
            optimizations.maxMemoryUsage = Math.min(
                currentOptions.maxMemoryUsage * 1.2,
                500 * 1024 * 1024 // Maximum 500MB
            );
        }

        return optimizations;
    }

    /**
     * Optimize retry strategy based on error patterns
     */
    public optimizeRetryStrategy(
        metrics: PerformanceMetrics,
        currentOptions: Required<FortifiedFunctionOptions>
    ): Partial<FortifiedFunctionOptions> {
        const optimizations: Partial<FortifiedFunctionOptions> = {};

        // Adjust retry count based on error rate
        if (metrics.errorRate > 0.2) {
            // High error rate - increase retries
            optimizations.retries = Math.min(currentOptions.retries + 1, 5);
            optimizations.maxRetryDelay = Math.min(
                currentOptions.maxRetryDelay * 1.2,
                10000
            );
        } else if (metrics.errorRate < 0.05) {
            // Low error rate - reduce retries for faster failure
            optimizations.retries = Math.max(currentOptions.retries - 1, 0);
            optimizations.maxRetryDelay = Math.max(
                currentOptions.maxRetryDelay * 0.8,
                1000
            );
        }

        return optimizations;
    }

    /**
     * Detect security threats based on execution patterns
     */
    public detectThreats(
        executionContext: any,
        metrics: PerformanceMetrics
    ): ThreatDetectionResult {
        const threats: string[] = [];
        const recommendations: string[] = [];
        let threatLevel: ThreatDetectionResult["threatLevel"] = "none";
        let blocked = false;

        // Detect unusual execution patterns
        if (metrics.executionTime > 30000) {
            // More than 30 seconds
            threats.push(
                "Potential DoS attack - extremely long execution time"
            );
            threatLevel = "medium";
            recommendations.push("Enable execution timeout limits");
        }

        // Detect memory exhaustion attempts
        if (metrics.memoryUsage > 200 * 1024 * 1024) {
            // More than 200MB
            threats.push("Potential memory exhaustion attack");
            threatLevel = "high";
            recommendations.push("Enable memory usage limits");
        }

        // Detect rapid successive calls (potential brute force)
        const rapidCallsDetected = this.detectRapidCalls(executionContext);
        if (rapidCallsDetected) {
            threats.push(
                "Potential brute force attack - rapid successive calls"
            );
            threatLevel = "high";
            blocked = true;
            recommendations.push("Implement rate limiting");
        }

        // Detect suspicious parameter patterns
        const suspiciousParams =
            this.detectSuspiciousParameters(executionContext);
        if (suspiciousParams) {
            threats.push("Suspicious parameter patterns detected");
            threatLevel = threatLevel === "none" ? "low" : threatLevel;
            recommendations.push(
                "Enable parameter validation and sanitization"
            );
        }

        return {
            threatLevel,
            threats,
            recommendations,
            blocked,
        };
    }

    /**
     * Auto-tune performance based on historical data
     */
    public autoTunePerformance(
        currentOptions: Required<FortifiedFunctionOptions>,
        historicalMetrics: PerformanceMetrics[]
    ): Partial<FortifiedFunctionOptions> {
        if (historicalMetrics.length < 10) {
            return {}; // Need sufficient data for tuning
        }

        const optimizations: Partial<FortifiedFunctionOptions> = {};

        // Calculate performance trends
        const avgExecutionTime = this.calculateAverage(
            historicalMetrics,
            "executionTime"
        );
        const avgMemoryUsage = this.calculateAverage(
            historicalMetrics,
            "memoryUsage"
        );
        const avgCacheHitRate = this.calculateAverage(
            historicalMetrics,
            "cacheHitRate"
        );
        const avgErrorRate = this.calculateAverage(
            historicalMetrics,
            "errorRate"
        );

        // Set baseline if not exists
        if (!this.performanceBaseline) {
            this.performanceBaseline = {
                executionTime: avgExecutionTime,
                memoryUsage: avgMemoryUsage,
                cpuUsage: 0,
                cacheHitRate: avgCacheHitRate,
                errorRate: avgErrorRate,
                throughput: 0,
                latency: avgExecutionTime,
            };
        }

        // Auto-tune based on performance regression
        const currentPerformance =
            historicalMetrics[historicalMetrics.length - 1];
        const performanceRegression =
            this.detectPerformanceRegression(currentPerformance);

        if (performanceRegression) {
            // Revert to more conservative settings
            optimizations.timeout = Math.min(
                currentOptions.timeout * 1.2,
                60000
            );
            optimizations.maxCacheSize = Math.max(
                (currentOptions.maxCacheSize || 1000) * 0.8,
                100
            );
            optimizations.retries = Math.max(currentOptions.retries - 1, 0);
        } else {
            // Performance is good, can be more aggressive
            if (avgCacheHitRate > 0.8) {
                optimizations.maxCacheSize = Math.min(
                    (currentOptions.maxCacheSize || 1000) * 1.1,
                    2000
                );
            }
            if (avgErrorRate < 0.05) {
                optimizations.timeout = Math.max(
                    currentOptions.timeout * 0.9,
                    5000
                );
            }
        }

        return optimizations;
    }

    /**
     * Get optimization recommendations
     */
    public getOptimizationRecommendations(
        metrics: PerformanceMetrics,
        currentOptions: Required<FortifiedFunctionOptions>
    ): OptimizationSuggestion[] {
        const recommendations: OptimizationSuggestion[] = [];

        // Cache recommendations
        if (metrics.cacheHitRate < 0.5) {
            recommendations.push({
                type: "cache",
                priority: "high",
                description:
                    "Low cache hit rate. Consider increasing cache size or adjusting strategy.",
                expectedImprovement: (0.7 - metrics.cacheHitRate) * 100,
                implementation:
                    'Increase maxCacheSize or change cacheStrategy to "adaptive"',
            });
        }

        // Performance recommendations
        if (metrics.executionTime > currentOptions.timeout * 0.8) {
            recommendations.push({
                type: "timeout",
                priority: "medium",
                description: "Execution time approaching timeout limit.",
                expectedImprovement: 20,
                implementation:
                    "Enable adaptiveTimeout or increase timeout value",
            });
        }

        // Memory recommendations
        if (metrics.memoryUsage > currentOptions.maxMemoryUsage * 0.8) {
            recommendations.push({
                type: "memory",
                priority: "medium",
                description: "High memory usage detected.",
                expectedImprovement: 25,
                implementation:
                    "Enable smartMemoryManagement or increase maxMemoryUsage",
            });
        }

        return recommendations;
    }

    /**
     * Private helper methods
     */
    private applySuggestion(
        suggestion: OptimizationSuggestion,
        currentOptions: Required<FortifiedFunctionOptions>,
        metrics: PerformanceMetrics
    ): Partial<FortifiedFunctionOptions> {
        const optimization: Partial<FortifiedFunctionOptions> = {};

        switch (suggestion.type) {
            case "cache":
                if (suggestion.description.includes("cache size")) {
                    optimization.maxCacheSize = Math.min(
                        (currentOptions.maxCacheSize || 1000) * 1.5,
                        5000
                    );
                }
                if (suggestion.description.includes("strategy")) {
                    optimization.cacheStrategy = "adaptive";
                }
                break;
            case "timeout":
                optimization.adaptiveTimeout = true;
                break;
            case "memory":
                optimization.smartMemoryManagement = true;
                optimization.memoryPressureHandling = true;
                break;
            case "security":
                optimization.threatDetection = true;
                optimization.smartSecurity = true;
                break;
        }

        return optimization;
    }

    private detectRapidCalls(executionContext: any): boolean {
        // Track call frequency for rapid call detection
        const functionId = executionContext?.functionId || "unknown";
        const now = Date.now();

        let callData = this.callFrequencyMap.get(functionId);

        if (!callData) {
            // First call for this function
            callData = {
                count: 1,
                firstCall: now,
                lastCall: now,
                intervals: [],
            };
            this.callFrequencyMap.set(functionId, callData);
            return false;
        }

        // Update call data
        const interval = now - callData.lastCall;
        callData.intervals.push(interval);
        callData.count++;
        callData.lastCall = now;

        // Keep only recent intervals (last 10)
        if (callData.intervals.length > 10) {
            callData.intervals.shift();
        }

        // Detect rapid calls: more than 5 calls in last 1 second
        const recentCalls = callData.intervals.filter(
            (interval) => interval < 1000
        ).length;
        if (recentCalls >= 5) {
            return true;
        }

        // Detect sustained rapid calls: average interval < 200ms over last 5 calls
        if (callData.intervals.length >= 5) {
            const recentIntervals = callData.intervals.slice(-5);
            const avgInterval =
                recentIntervals.reduce((sum, interval) => sum + interval, 0) /
                recentIntervals.length;
            if (avgInterval < 200) {
                return true;
            }
        }

        return false;
    }

    private detectSuspiciousParameters(executionContext: any): boolean {
        // Analyze parameter patterns for suspicious behavior
        const parametersHash = executionContext?.parametersHash || "unknown";
        const parameters = executionContext?.parameters;

        if (!parameters) return false;

        const now = Date.now();
        let patternData = this.parameterPatterns.get(parametersHash);

        if (!patternData) {
            // First time seeing this parameter pattern
            patternData = {
                frequency: 1,
                lastSeen: now,
                variations: new Set([JSON.stringify(parameters)]),
                suspiciousCount: 0,
            };
            this.parameterPatterns.set(parametersHash, patternData);
            return false;
        }

        // Update pattern data
        patternData.frequency++;
        patternData.lastSeen = now;
        patternData.variations.add(JSON.stringify(parameters));

        // Detect suspicious patterns
        let suspicious = false;

        // 1. Too many variations for the same hash (hash collision or manipulation)
        if (patternData.variations.size > 10) {
            suspicious = true;
        }

        // 2. Extremely high frequency (potential DoS)
        if (patternData.frequency > 1000) {
            suspicious = true;
        }

        // 3. Check for common injection patterns in string parameters
        const paramString = JSON.stringify(parameters).toLowerCase();
        const injectionPatterns = [
            "script",
            "javascript:",
            "eval(",
            "function(",
            "select * from",
            "union select",
            "drop table",
            "../",
            "..\\",
            "file://",
            "http://",
            "https://",
        ];

        for (const pattern of injectionPatterns) {
            if (paramString.includes(pattern)) {
                suspicious = true;
                break;
            }
        }

        if (suspicious) {
            patternData.suspiciousCount++;
        }

        // Clean up old patterns (keep only patterns seen in last hour)
        const oneHourAgo = now - 3600000;
        for (const [hash, data] of this.parameterPatterns.entries()) {
            if (data.lastSeen < oneHourAgo) {
                this.parameterPatterns.delete(hash);
            }
        }

        return suspicious;
    }

    private calculateAverage(
        metrics: PerformanceMetrics[],
        field: keyof PerformanceMetrics
    ): number {
        const sum = metrics.reduce((total, metric) => total + metric[field], 0);
        return sum / metrics.length;
    }

    private detectPerformanceRegression(
        currentMetrics: PerformanceMetrics
    ): boolean {
        if (!this.performanceBaseline) return false;

        const executionTimeRegression =
            currentMetrics.executionTime >
            this.performanceBaseline.executionTime * 1.5;
        const memoryRegression =
            currentMetrics.memoryUsage >
            this.performanceBaseline.memoryUsage * 1.3;
        const cacheRegression =
            currentMetrics.cacheHitRate <
            this.performanceBaseline.cacheHitRate * 0.7;

        return executionTimeRegression || memoryRegression || cacheRegression;
    }

    /**
     * Clear optimization history
     */
    public clearHistory(): void {
        this.optimizationHistory.length = 0;
        this.performanceBaseline = null;
        this.adaptiveSettings.clear();
    }
}

