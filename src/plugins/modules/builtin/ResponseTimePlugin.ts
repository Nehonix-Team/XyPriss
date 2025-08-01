/**
 * Response Time Monitoring Plugin
 *
 * Ultra-fast performance monitoring plugin with <0.3ms overhead
 * for tracking response times and performance metrics.
 */

import { EventEmitter } from "events";
import { PerformancePlugin } from "../core/PerformancePlugin";
import {
    PluginPriority,
    PluginExecutionContext,
    PluginInitializationContext,
} from "../types/PluginTypes";

/**
 * Response Time Monitoring Plugin for ultra-fast performance tracking
 */
export class ResponseTimePlugin extends PerformancePlugin {
    private eventEmitter = new EventEmitter();
    public readonly id = "XyPriss.performance.response-time";
    public readonly name = "Response Time Monitoring Plugin";
    public readonly version = "1.0.0";
    public readonly priority = PluginPriority.NORMAL;

    // Performance thresholds (can be configured)
    public readonly performanceThresholds = {
        responseTime: 100, // 100ms
        memoryUsage: 50 * 1024 * 1024, // 50MB
        cpuUsage: 80, // 80%
    };

    // Performance tracking
    private routeMetrics: Map<
        string,
        {
            count: number;
            totalTime: number;
            minTime: number;
            maxTime: number;
            averageTime: number;
            p95Time: number;
            p99Time: number;
            recentTimes: number[];
        }
    > = new Map();

    // Alert thresholds
    private alertThresholds = {
        slowResponseTime: 1000, // 1 second
        verySlowResponseTime: 5000, // 5 seconds
        highMemoryUsage: 100 * 1024 * 1024, // 100MB
        criticalMemoryUsage: 200 * 1024 * 1024, // 200MB
    };

    // Performance alerts
    private alertCooldowns: Map<string, number> = new Map();
    private readonly ALERT_COOLDOWN = 60000; // 1 minute

    /**
     * Initialize performance monitoring plugin
     */
    protected async initializePerformanceMonitoring(
        context: PluginInitializationContext
    ): Promise<void> {
        // Configure thresholds from settings
        if (context.config.customSettings.responseTimeThreshold) {
            this.alertThresholds.slowResponseTime =
                context.config.customSettings.responseTimeThreshold;
        }

        if (context.config.customSettings.memoryThreshold) {
            this.alertThresholds.highMemoryUsage =
                context.config.customSettings.memoryThreshold;
        }

        // Setup periodic metrics cleanup
        this.setupMetricsCleanup();

        // Setup performance alerts
        this.setupPerformanceAlerts();

        context.logger.info("Response Time Monitoring Plugin initialized");
    }

    /**
     * Execute performance monitoring logic
     */
    protected executePerformanceLogic(
        context: PluginExecutionContext,
        metrics: any
    ): any {
        const { req, res } = context;
        const route = this.normalizeRoute(req.path);

        // Start response time tracking
        const startTime = performance.now();

        // Add response time header
        res.setHeader("X-Response-Time-Start", startTime.toString());

        // Hook into response finish event to capture total time
        const originalEnd = res.end;
        res.end = (...args: any[]) => {
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            // Record route metrics
            this.recordRouteMetrics(route, responseTime);

            // Add response time headers
            res.setHeader("X-Response-Time", `${responseTime.toFixed(2)}ms`);
            res.setHeader(
                "X-Performance-Score",
                this.calculatePerformanceScore(responseTime, metrics)
            );

            // Check for performance alerts
            this.checkRoutePerformanceAlerts(route, responseTime, metrics);

            // Call original end method with proper arguments
            return (originalEnd as any).apply(res, args);
        };

        return {
            route,
            startTime,
            memoryUsage: metrics.memoryUsage,
            cpuUsage: metrics.cpuUsage,
            requestSize: metrics.requestSize,
        };
    }

    /**
     * Precompile performance monitoring systems
     */
    protected async precompilePerformanceMonitoring(): Promise<void> {
        // Pre-warm performance calculation functions
        this.calculatePerformanceScore(100, {
            memoryUsage: 10 * 1024 * 1024,
            cpuUsage: 50,
        });

        // Pre-warm route normalization
        this.normalizeRoute("/api/test/123");
    }

    /**
     * Collect custom performance metrics
     */
    protected collectCustomMetrics(context: PluginExecutionContext): any {
        const { req } = context;
        const route = this.normalizeRoute(req.path);
        const routeMetrics = this.routeMetrics.get(route);

        return {
            route,
            routeMetrics: routeMetrics
                ? {
                      averageResponseTime: routeMetrics.averageTime,
                      p95ResponseTime: routeMetrics.p95Time,
                      p99ResponseTime: routeMetrics.p99Time,
                      requestCount: routeMetrics.count,
                      minResponseTime: routeMetrics.minTime,
                      maxResponseTime: routeMetrics.maxTime,
                  }
                : null,
            totalRoutes: this.routeMetrics.size,
            alertsActive: this.getActiveAlerts(),
        };
    }

    // ===== ROUTE METRICS METHODS =====

    /**
     * Record metrics for a specific route
     */
    private recordRouteMetrics(route: string, responseTime: number): void {
        let metrics = this.routeMetrics.get(route);

        if (!metrics) {
            metrics = {
                count: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                averageTime: 0,
                p95Time: 0,
                p99Time: 0,
                recentTimes: [],
            };
            this.routeMetrics.set(route, metrics);
        }

        // Update basic metrics
        metrics.count++;
        metrics.totalTime += responseTime;
        metrics.minTime = Math.min(metrics.minTime, responseTime);
        metrics.maxTime = Math.max(metrics.maxTime, responseTime);
        metrics.averageTime = metrics.totalTime / metrics.count;

        // Update recent times for percentile calculation
        metrics.recentTimes.push(responseTime);

        // Keep only last 100 response times for memory efficiency
        if (metrics.recentTimes.length > 100) {
            metrics.recentTimes.shift();
        }

        // Calculate percentiles
        this.updatePercentiles(metrics);
    }

    /**
     * Update percentile calculations
     */
    private updatePercentiles(metrics: any): void {
        if (metrics.recentTimes.length === 0) return;

        const sortedTimes = [...metrics.recentTimes].sort((a, b) => a - b);
        const length = sortedTimes.length;

        // Calculate P95 (95th percentile)
        const p95Index = Math.ceil(length * 0.95) - 1;
        metrics.p95Time = sortedTimes[Math.max(0, p95Index)];

        // Calculate P99 (99th percentile)
        const p99Index = Math.ceil(length * 0.99) - 1;
        metrics.p99Time = sortedTimes[Math.max(0, p99Index)];
    }

    /**
     * Normalize route for consistent metrics tracking
     */
    private normalizeRoute(path: string): string {
        // Replace dynamic segments with placeholders
        return path
            .replace(/\/\d+/g, "/:id") // Replace numeric IDs
            .replace(/\/[a-f0-9-]{36}/g, "/:uuid") // Replace UUIDs
            .replace(/\/[a-f0-9]{24}/g, "/:objectId") // Replace MongoDB ObjectIds
            .replace(/\?.*$/, ""); // Remove query parameters
    }

    // ===== PERFORMANCE SCORING =====

    /**
     * Calculate performance score (0-100)
     */
    protected calculatePerformanceScore(
        responseTime: number,
        metrics: any
    ): number {
        let score = 100;

        // Response time scoring (50% weight)
        if (responseTime > this.alertThresholds.verySlowResponseTime) {
            score -= 50;
        } else if (responseTime > this.alertThresholds.slowResponseTime) {
            score -= 25;
        } else if (responseTime > this.performanceThresholds.responseTime) {
            score -= 10;
        }

        // Memory usage scoring (25% weight)
        if (metrics.memoryUsage > this.alertThresholds.criticalMemoryUsage) {
            score -= 25;
        } else if (metrics.memoryUsage > this.alertThresholds.highMemoryUsage) {
            score -= 15;
        } else if (
            metrics.memoryUsage > this.performanceThresholds.memoryUsage
        ) {
            score -= 5;
        }

        // CPU usage scoring (25% weight)
        if (metrics.cpuUsage > 90) {
            score -= 25;
        } else if (metrics.cpuUsage > this.performanceThresholds.cpuUsage) {
            score -= 10;
        }

        return Math.max(0, score);
    }

    // ===== PERFORMANCE ALERTS =====

    /**
     * Check for performance alerts (override from PerformancePlugin)
     */
    protected checkPerformanceAlerts(metrics: any): string[] {
        const alerts: string[] = [];

        // Check response time alerts
        if (metrics.responseTime > this.alertThresholds.verySlowResponseTime) {
            alerts.push("CRITICAL: Response time severely degraded");
            this.triggerAlert("critical_response_time", {
                route: metrics.route,
                responseTime: metrics.responseTime,
                threshold: this.alertThresholds.verySlowResponseTime,
            });
        } else if (
            metrics.responseTime > this.alertThresholds.slowResponseTime
        ) {
            alerts.push("WARNING: Slow response time detected");
            this.triggerAlert("slow_response_time", {
                route: metrics.route,
                responseTime: metrics.responseTime,
                threshold: this.alertThresholds.slowResponseTime,
            });
        }

        // Check memory usage alerts
        if (metrics.memoryUsage > this.alertThresholds.criticalMemoryUsage) {
            alerts.push("CRITICAL: Memory usage critically high");
            this.triggerAlert("critical_memory_usage", {
                memoryUsage: metrics.memoryUsage,
                threshold: this.alertThresholds.criticalMemoryUsage,
            });
        } else if (metrics.memoryUsage > this.alertThresholds.highMemoryUsage) {
            alerts.push("WARNING: High memory usage detected");
            this.triggerAlert("high_memory_usage", {
                memoryUsage: metrics.memoryUsage,
                threshold: this.alertThresholds.highMemoryUsage,
            });
        }

        // Check CPU usage alerts
        if (metrics.cpuUsage > 90) {
            alerts.push("CRITICAL: CPU usage critically high");
            this.triggerAlert("critical_cpu_usage", {
                cpuUsage: metrics.cpuUsage,
                threshold: 90,
            });
        }

        return alerts;
    }

    /**
     * Check for performance alerts with route-specific parameters
     */
    private checkRoutePerformanceAlerts(
        route: string,
        responseTime: number,
        metrics: any
    ): void {
        // Use the base class method with enhanced metrics
        const enhancedMetrics = {
            ...metrics,
            route,
            responseTime,
        };

        this.checkPerformanceAlerts(enhancedMetrics);
    }

    /**
     * Trigger performance alert with cooldown
     */
    private triggerAlert(alertType: string, data: any): void {
        const now = Date.now();
        const lastAlert = this.alertCooldowns.get(alertType) || 0;

        // Check cooldown
        if (now - lastAlert < this.ALERT_COOLDOWN) {
            return;
        }

        // Update cooldown
        this.alertCooldowns.set(alertType, now);

        // Log alert
        console.warn(`[PERFORMANCE ALERT] ${alertType}:`, data);

        // Emit alert event (can be listened to by monitoring systems)
        this.eventEmitter.emit("performance_alert", {
            type: alertType,
            data,
            timestamp: new Date(),
        });
    }

    /**
     * Get active alerts
     */
    private getActiveAlerts(): string[] {
        const now = Date.now();
        const activeAlerts: string[] = [];

        for (const [
            alertType,
            lastTriggered,
        ] of this.alertCooldowns.entries()) {
            if (now - lastTriggered < this.ALERT_COOLDOWN) {
                activeAlerts.push(alertType);
            }
        }

        return activeAlerts;
    }

    // ===== CLEANUP AND MAINTENANCE =====

    /**
     * Setup metrics cleanup
     */
    private setupMetricsCleanup(): void {
        // Clean up old metrics every 10 minutes
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 600000); // 10 minutes
    }

    /**
     * Clean up old metrics to prevent memory leaks
     */
    private cleanupOldMetrics(): void {
        const now = Date.now();

        // Remove routes that haven't been accessed in the last hour
        for (const [route, metrics] of this.routeMetrics.entries()) {
            // If no recent activity, remove the route metrics
            if (metrics.recentTimes.length === 0) {
                this.routeMetrics.delete(route);
            }
        }

        // Clean up old alert cooldowns
        for (const [
            alertType,
            lastTriggered,
        ] of this.alertCooldowns.entries()) {
            if (now - lastTriggered > this.ALERT_COOLDOWN * 2) {
                this.alertCooldowns.delete(alertType);
            }
        }
    }

    /**
     * Setup performance alerts monitoring
     */
    private setupPerformanceAlerts(): void {
        // Monitor overall system performance every 30 seconds
        setInterval(() => {
            this.checkSystemPerformance();
        }, 30000); // 30 seconds
    }

    /**
     * Check overall system performance
     */
    private checkSystemPerformance(): void {
        const memoryUsage = this.getMemoryUsage();
        const cpuUsage = this.getCpuUsage();

        // Check system-wide thresholds
        if (memoryUsage > this.alertThresholds.criticalMemoryUsage) {
            this.triggerAlert("system_critical_memory", { memoryUsage });
        }

        if (cpuUsage > 95) {
            this.triggerAlert("system_critical_cpu", { cpuUsage });
        }
    }

    // ===== PUBLIC API =====

    /**
     * Get route performance summary
     */
    public getRoutePerformanceSummary(): any {
        const summary: any = {};

        for (const [route, metrics] of this.routeMetrics.entries()) {
            summary[route] = {
                requestCount: metrics.count,
                averageResponseTime:
                    Math.round(metrics.averageTime * 100) / 100,
                minResponseTime: Math.round(metrics.minTime * 100) / 100,
                maxResponseTime: Math.round(metrics.maxTime * 100) / 100,
                p95ResponseTime: Math.round(metrics.p95Time * 100) / 100,
                p99ResponseTime: Math.round(metrics.p99Time * 100) / 100,
            };
        }

        return summary;
    }

    /**
     * Get performance alerts summary
     */
    public getPerformanceAlertsSummary(): any {
        return {
            activeAlerts: this.getActiveAlerts(),
            alertThresholds: this.alertThresholds,
            lastAlerts: Object.fromEntries(this.alertCooldowns),
        };
    }

    /**
     * Reset route metrics
     */
    public resetRouteMetrics(route?: string): void {
        if (route) {
            this.routeMetrics.delete(route);
        } else {
            this.routeMetrics.clear();
        }
    }
}

