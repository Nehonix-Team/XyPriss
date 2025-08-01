import {
    MonitoringManagerDependencies,
    MonitoringManagerOptions,
} from "../../../types/components/MonitoringM.type";
import { logger } from "../../../../shared/logger/Logger";

/**
 * MonitoringManager - Handles all monitoring and health check endpoints for FastApi.ts
 * Manages health checks, performance monitoring, and statistics collection
 */
export class MonitoringManager {
    protected readonly options: MonitoringManagerOptions;
    protected readonly dependencies: MonitoringManagerDependencies;

    constructor(
        options: MonitoringManagerOptions,
        dependencies: MonitoringManagerDependencies
    ) {
        this.options = options;
        this.dependencies = dependencies;
    }

    /**
     * Add all monitoring endpoints to the Express app
     */
    public addMonitoringEndpoints(): void {
        if (!this.options.monitoring?.enabled) return;

        logger.debug("monitoring", "Adding monitoring endpoints...");

        const basePoint = "/XyPriss";

        this.addHealthCheckEndpoint(basePoint);
        this.addCacheStatisticsEndpoint(basePoint);
        this.addOptimizationMonitoringEndpoints(basePoint);

        // logger.debug( "monitoring","Monitoring endpoints added");
    }

    /**
     * Add health check endpoint
     */
    private addHealthCheckEndpoint(basePoint: string): void {
        this.dependencies.app.get(basePoint + "/health", async (req, res) => {
            try {
                const health = this.dependencies.cacheManager.getCacheHealth();
                const stats =
                    await this.dependencies.cacheManager.getCacheStats();

                const healthStatus = {
                    status: health.status,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    cache: {
                        connected: health.details.redisConnected || true,
                        hitRate: stats.memory.hitRate,
                        memoryUsage: stats.memory.memoryUsage?.percentage || 0,
                        operations: stats.performance.totalOperations,
                    },
                    performance: {
                        averageResponseTime:
                            stats.performance.averageResponseTime,
                        totalOperations: stats.performance.totalOperations,
                        networkLatency: stats.performance.networkLatency,
                    },
                };

                const statusCode =
                    health.status === "healthy"
                        ? 200
                        : health.status === "degraded"
                        ? 200
                        : 503;

                res.status(statusCode).json(healthStatus);
            } catch (error: any) {
                res.status(503).json({
                    status: "unhealthy",
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
            }
        });
    }

    /**
     * Add cache statistics endpoint
     */
    private addCacheStatisticsEndpoint(basePoint: string): void {
        this.dependencies.app.get(
            basePoint + "/health/cache",
            async (req, res) => {
                try {
                    const stats =
                        await this.dependencies.cacheManager.getCacheStats();
                    res.json({
                        timestamp: new Date().toISOString(),
                        cache: stats,
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get cache statistics",
                        message: error.message,
                    });
                }
            }
        );
    }

    /**
     * Add optimization monitoring endpoints
     */
    private addOptimizationMonitoringEndpoints(basePoint: string): void {
        // Performance optimization statistics endpoint
        this.dependencies.app.get(
            basePoint + "/performance/optimization",
            async (_req, res) => {
                try {
                    const performanceStats =
                        this.dependencies.performanceManager.getPerformanceStats();

                    res.json({
                        timestamp: new Date().toISOString(),
                        ...performanceStats,
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get optimization statistics",
                        message: error.message,
                    });
                }
            }
        );

        // Real-time performance metrics endpoint
        this.dependencies.app.get(
            basePoint + "/performance/realtime",
            async (_req, res) => {
                try {
                    const realtimeMetrics =
                        this.dependencies.performanceManager.getRealTimeMetrics(
                            50
                        );

                    res.json({
                        timestamp: new Date().toISOString(),
                        realtime: realtimeMetrics,
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get real-time performance metrics",
                        message: error.message,
                    });
                }
            }
        );

        // Optimization control endpoint
        this.dependencies.app.post(
            basePoint + "/performance/control",
            async (req, res) => {
                try {
                    const { action } = req.body;

                    switch (action) {
                        case "enable":
                            this.dependencies.performanceManager.setOptimizationEnabled(
                                true
                            );
                            res.json({
                                success: true,
                                message: "Performance optimization enabled",
                                enabled:
                                    this.dependencies.performanceManager.isOptimizationEnabled(),
                            });
                            break;

                        case "disable":
                            this.dependencies.performanceManager.setOptimizationEnabled(
                                false
                            );
                            res.json({
                                success: true,
                                message: "Performance optimization disabled",
                                enabled:
                                    this.dependencies.performanceManager.isOptimizationEnabled(),
                            });
                            break;

                        case "reset-stats":
                            this.dependencies.performanceManager.resetOptimizationStats();
                            res.json({
                                success: true,
                                message: "Performance statistics reset",
                            });
                            break;

                        default:
                            res.status(400).json({
                                error: "Invalid action. Use 'enable', 'disable', or 'reset-stats'",
                            });
                    }
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to control optimization",
                        message: error.message,
                    });
                }
            }
        );

        // Performance recommendations endpoint
        this.dependencies.app.get(
            basePoint + "/performance/recommendations",
            async (_req, res) => {
                try {
                    const recommendations =
                        this.dependencies.performanceManager.getPerformanceRecommendations();

                    res.json({
                        timestamp: new Date().toISOString(),
                        recommendations,
                        count: recommendations.length,
                    });
                } catch (error: any) {
                    res.status(500).json({
                        error: "Failed to get performance recommendations",
                        message: error.message,
                    });
                }
            }
        );
    }

    /**
     * Get comprehensive monitoring statistics
     */
    public getMonitoringStats(): any {
        try {
            return {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                performance:
                    this.dependencies.performanceManager.getPerformanceStats(),
                cache: {
                    health: this.dependencies.cacheManager.getCacheHealth(),
                    // Note: getCacheStats() is async, so we can't include it here
                },
            };
        } catch (error: any) {
            logger.error(
                "monitoring",
                "Failed to get monitoring stats:",
                error.message
            );
            return {
                error: "Failed to get monitoring statistics",
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Check overall system health
     */
    public async getSystemHealth(): Promise<any> {
        try {
            const cacheHealth = this.dependencies.cacheManager.getCacheHealth();
            const cacheStats =
                await this.dependencies.cacheManager.getCacheStats();
            const performanceStats =
                this.dependencies.performanceManager.getPerformanceStats();

            // Determine overall health status
            let overallStatus = "healthy";
            const issues: string[] = [];

            // Check cache health
            if (cacheHealth.status !== "healthy") {
                overallStatus = "degraded";
                issues.push(`Cache status: ${cacheHealth.status}`);
            }

            // Check performance metrics
            if (performanceStats.optimization.profiler.avgResponseTime > 100) {
                overallStatus = "degraded";
                issues.push("High average response time");
            }

            // Check optimization failure rate
            const optimizationStats =
                this.dependencies.performanceManager.getOptimizationStats();
            const failureRate =
                optimizationStats.optimizationFailures /
                Math.max(optimizationStats.totalRequests, 1);
            if (failureRate > 0.1) {
                overallStatus = "degraded";
                issues.push("High optimization failure rate");
            }

            return {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                issues,
                details: {
                    cache: cacheHealth,
                    performance: performanceStats.optimization.profiler,
                    optimization: optimizationStats,
                },
            };
        } catch (error: any) {
            return {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                error: error.message,
                issues: ["System health check failed"],
            };
        }
    }

    /**
     * Generate health check report
     */
    public async generateHealthReport(): Promise<any> {
        try {
            const systemHealth = await this.getSystemHealth();
            const monitoringStats = this.getMonitoringStats();
            const recommendations =
                this.dependencies.performanceManager.getPerformanceRecommendations();

            return {
                timestamp: new Date().toISOString(),
                reportType: "health-check",
                systemHealth,
                statistics: monitoringStats,
                recommendations,
                summary: {
                    overallStatus: systemHealth.status,
                    totalIssues: systemHealth.issues.length,
                    totalRecommendations: recommendations.length,
                    uptime: process.uptime(),
                },
            };
        } catch (error: any) {
            return {
                timestamp: new Date().toISOString(),
                reportType: "health-check",
                error: "Failed to generate health report",
                message: error.message,
            };
        }
    }

    /**
     * Check if monitoring is enabled
     */
    public isMonitoringEnabled(): boolean {
        return this.options.monitoring?.enabled === true;
    }

    /**
     * Get monitoring configuration
     */
    public getMonitoringConfig(): any {
        return {
            enabled: this.isMonitoringEnabled(),
            detailed: this.options.monitoring?.detailed || false,
            alertThresholds: this.options.monitoring?.alertThresholds,
        };
    }
}

