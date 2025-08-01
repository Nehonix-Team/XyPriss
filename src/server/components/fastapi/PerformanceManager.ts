import { PerformanceProfiler } from "../../optimization/PerformanceProfiler";
import { ExecutionPredictor } from "../../optimization/ExecutionPredictor";
import { RequestPreCompiler } from "../../optimization/RequestPreCompiler";
import { UltraFastExpressOptimizer } from "../../optimization/UltraFastOptimizer";
import {
    PerformanceManagerDependencies,
    PerformanceManagerOptions,
} from "../../../types/components/PerfomanceMonitory.type";
import { logger } from "../../../../shared/logger/Logger";

/**
 * PerformanceManager - Handles all performance optimization for FastApi.ts
 * Manages profiling, prediction, compilation, and optimization statistics
 */
export class PerformanceManager {
    protected readonly options: PerformanceManagerOptions;
    protected readonly dependencies: PerformanceManagerDependencies;

    private performanceProfiler!: PerformanceProfiler;
    private executionPredictor!: ExecutionPredictor;
    private requestPreCompiler!: RequestPreCompiler;
    private ultraFastOptimizer?: UltraFastExpressOptimizer;
    private optimizationEnabled = true;
    private optimizationStats = {
        totalRequests: 0,
        ultraFastRequests: 0,
        fastRequests: 0,
        standardRequests: 0,
        optimizationFailures: 0,
        avgOptimizationOverhead: 0,
    };

    constructor(
        options: PerformanceManagerOptions,
        dependencies: PerformanceManagerDependencies
    ) {
        this.options = options;
        this.dependencies = dependencies;

        this.initializePerformanceComponents();
        this.addPerformanceMethodsToApp();
    }

    /**
     * Initialize performance optimization components
     */
    private initializePerformanceComponents(): void {
        logger.debug(
            "performance",
            "Initializing performance optimization components..."
        );

        // Initialize performance profiler
        this.performanceProfiler = new PerformanceProfiler();

        // Initialize execution predictor
        this.executionPredictor = new ExecutionPredictor();

        // Initialize request pre-compiler
        this.requestPreCompiler = new RequestPreCompiler(
            this.dependencies.cacheManager.getCache(),
            {
                enabled: this.options.performance?.preCompilerEnabled !== false,
                learningPeriod:
                    this.options.performance?.learningPeriod || 60000, // 1 minute for faster learning
                optimizationThreshold:
                    this.options.performance?.optimizationThreshold || 1, // Optimize after just 1 request
                maxCompiledRoutes:
                    this.options.performance?.maxCompiledRoutes || 1000,
                aggressiveOptimization:
                    this.options.performance?.aggressiveOptimization !== false, // Default to aggressive
                predictivePreloading:
                    this.options.performance?.predictivePreloading !== false, // Default to enabled
                // System info for library-agnostic responses
                systemInfo: {
                    serviceName:
                        this.options.server?.serviceName ||
                        "FastApi.ts Service",
                    version: this.options.server?.version || "1.0.0",
                    environment:
                        this.options.env ||
                        process.env.NODE_ENV ||
                        "development",
                    customHealthData:
                        this.options.performance?.customHealthData,
                    customStatusData:
                        this.options.performance?.customStatusData,
                },
            }
        );

        // Initialize UltraFastOptimizer if enabled
        if (this.isUltraFastOptimizerEnabled()) {
            this.ultraFastOptimizer = new UltraFastExpressOptimizer(
                this.getUltraFastOptimizerConfig()
            );
        }

        logger.debug(
            "performance",
            "Performance optimization components initialized"
        );
    }

    /**
     * Add performance-related methods to the Express app
     */
    private addPerformanceMethodsToApp(): void {
        // Request pre-compiler access
        this.dependencies.app.getRequestPreCompiler = () => {
            return this.requestPreCompiler;
        };
    }

    /**
     * Check if UltraFastOptimizer should be enabled
     */
    private isUltraFastOptimizerEnabled(): boolean {
        const config = this.options.performance?.optimizationEnabled ?? true;
        return config;
    }

    /**
     * Get UltraFastOptimizer configuration
     */
    private getUltraFastOptimizerConfig() {
        const config = this.options.performance?.optimizationEnabled;

        if (typeof config === "boolean" || !config) {
            // Use default configuration
            return {
                cache: {
                    enabled: true,
                    defaultTTL: 60000,
                    maxSize: 1000,
                    maxMemoryMB: 100,
                },
                performance: {
                    enablePrecompilation: true,
                    asyncTimeout: 5000,
                },
                monitoring: {
                    enabled: true,
                    logInterval: 30000,
                },
            };
        }

        // Use provided configuration with defaults (config is object here)
        const objConfig = config as any; // Type assertion to handle union type
        return {
            cache: {
                enabled: true,
                defaultTTL: 60000,
                maxSize: 1000,
                maxMemoryMB: 100,
                ...(objConfig.cache || {}),
            },
            performance: {
                enablePrecompilation: true,
                asyncTimeout: 5000,
            },
            monitoring: {
                enabled: true,
                logInterval: 30000,
                onStats: objConfig.monitoring?.metricsCallback,
                ...(objConfig.monitoring || {}),
            },
        };
    }

    /**
     * Get performance profiler instance
     */
    public getPerformanceProfiler(): PerformanceProfiler {
        return this.performanceProfiler;
    }

    /**
     * Get execution predictor instance
     */
    public getExecutionPredictor(): ExecutionPredictor {
        return this.executionPredictor;
    }

    /**
     * Get request pre-compiler instance
     */
    public getRequestPreCompiler(): RequestPreCompiler {
        return this.requestPreCompiler;
    }

    /**
     * Get UltraFastOptimizer instance
     */
    public getUltraFastOptimizer(): UltraFastExpressOptimizer | undefined {
        return this.ultraFastOptimizer;
    }

    /**
     * Get optimization enabled status
     */
    public isOptimizationEnabled(): boolean {
        return this.optimizationEnabled;
    }

    /**
     * Set optimization enabled status
     */
    public setOptimizationEnabled(enabled: boolean): void {
        this.optimizationEnabled = enabled;
    }

    /**
     * Get optimization statistics
     */
    public getOptimizationStats(): any {
        return { ...this.optimizationStats };
    }

    /**
     * Update optimization statistics
     */
    public updateOptimizationStats(
        type: "total" | "ultra-fast" | "fast" | "standard" | "failure"
    ): void {
        switch (type) {
            case "total":
                this.optimizationStats.totalRequests++;
                break;
            case "ultra-fast":
                this.optimizationStats.ultraFastRequests++;
                break;
            case "fast":
                this.optimizationStats.fastRequests++;
                break;
            case "standard":
                this.optimizationStats.standardRequests++;
                break;
            case "failure":
                this.optimizationStats.optimizationFailures++;
                break;
        }
    }

    /**
     * Reset optimization statistics
     */
    public resetOptimizationStats(): void {
        this.optimizationStats = {
            totalRequests: 0,
            ultraFastRequests: 0,
            fastRequests: 0,
            standardRequests: 0,
            optimizationFailures: 0,
            avgOptimizationOverhead: 0,
        };
        this.performanceProfiler.clearMetrics();
    }

    /**
     * Get comprehensive performance statistics
     */
    public getPerformanceStats(): any {
        const profilerStats = this.performanceProfiler.getStats();
        const predictorStats = this.executionPredictor.getStats();
        const compilerStats = this.requestPreCompiler.getStats();
        const ultraFastStats = this.ultraFastOptimizer?.getStats();

        return {
            optimization: {
                enabled: this.optimizationEnabled,
                stats: this.optimizationStats,
                profiler: profilerStats,
                predictor: predictorStats,
                compiler: compilerStats,
                ultraFast: ultraFastStats,
                targetAchievement: {
                    ultraFastTarget: profilerStats.ultraFastTargetRate,
                    fastTarget: profilerStats.fastTargetRate,
                    overallSuccess: profilerStats.optimizationSuccessRate,
                    ultraFastOptimizationRate:
                        ultraFastStats?.optimizedRate || 0,
                },
            },
        };
    }

    /**
     * Get real-time performance metrics
     */
    public getRealTimeMetrics(limit: number = 50): any {
        const recentMetrics =
            this.performanceProfiler.getDetailedMetrics(limit);
        const currentStats = this.performanceProfiler.getStats();

        return {
            recentRequests: recentMetrics,
            currentPerformance: {
                p50: currentStats.p50ResponseTime,
                p95: currentStats.p95ResponseTime,
                p99: currentStats.p99ResponseTime,
                avgResponseTime: currentStats.avgResponseTime,
            },
            cachePerformance: {
                overallHitRate: currentStats.overallCacheHitRate,
                l1HitRate: currentStats.l1CacheHitRate,
                l2HitRate: currentStats.l2CacheHitRate,
                l3HitRate: currentStats.l3CacheHitRate,
            },
            optimizationEffectiveness: {
                ultraFastRequests: this.optimizationStats.ultraFastRequests,
                fastRequests: this.optimizationStats.fastRequests,
                standardRequests: this.optimizationStats.standardRequests,
                optimizationFailures:
                    this.optimizationStats.optimizationFailures,
            },
        };
    }

    /**
     * Analyze request performance and update patterns
     */
    public analyzeRequestPerformance(
        req: any,
        responseTime: number,
        cacheHit: boolean
    ): void {
        try {
            this.executionPredictor.updatePattern(req, responseTime, cacheHit);
            this.requestPreCompiler.analyzeRequest(req, null as any, () => {});
        } catch (error: any) {
            logger.warn(
                "performance",
                "Failed to analyze request performance:",
                error.message
            );
        }
    }

    /**
     * Get performance recommendations
     */
    public getPerformanceRecommendations(): string[] {
        const recommendations: string[] = [];
        const stats = this.getPerformanceStats();

        // Check ultra-fast target achievement
        if (stats.optimization.targetAchievement.ultraFastTarget < 0.8) {
            recommendations.push(
                "Consider enabling more aggressive caching for ultra-fast responses"
            );
        }

        // Check cache hit rates
        if (stats.optimization.profiler.overallCacheHitRate < 0.7) {
            recommendations.push(
                "Cache hit rate is low - consider adjusting cache TTL or warming strategies"
            );
        }

        // Check optimization failures
        if (
            this.optimizationStats.optimizationFailures >
            this.optimizationStats.totalRequests * 0.1
        ) {
            recommendations.push(
                "High optimization failure rate - review error logs and consider fallback strategies"
            );
        }

        // Check response times
        if (stats.optimization.profiler.avgResponseTime > 50) {
            recommendations.push(
                "Average response time is high - consider optimizing slow endpoints"
            );
        }

        return recommendations;
    }
}

