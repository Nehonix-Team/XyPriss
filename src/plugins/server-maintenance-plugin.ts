/**
 * Server Maintenance Plugin
 *
 * Automatically detects issues and performs server maintenance in the background
 * Features:
 * - Error detection and analysis
 * - Memory leak detection
 * - Log cleanup and rotation
 * - Performance degradation detection
 * - Automatic health checks
 * - Resource optimization
 */

import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { __sys__ } from "../index";
import {
    MaintenanceIssue,
    HealthMetrics,
    MaintenanceConfig,
} from "./types/index";

export class ServerMaintenancePlugin extends EventEmitter {
    private config: Required<MaintenanceConfig>;
    private issues: MaintenanceIssue[] = [];
    private healthHistory: HealthMetrics[] = [];
    private maintenanceTimer?: NodeJS.Timeout;
    private app: any;
    private logger: any;
    private startTime = Date.now();
    private errorCount = 0;
    private requestCount = 0;
    private responseTimes: number[] = [];
    private activeConnections = 0;
    private server: any;

    constructor(config: MaintenanceConfig = {}) {
        super();

        this.config = {
            enabled: true,
            checkInterval: 30000, // 30 seconds
            errorThreshold: 5, // 5% error rate
            memoryThreshold: 85, // 80% memory usage
            responseTimeThreshold: 1000, // 1 second
            logRetentionDays: 7,
            maxLogFileSize: 10 * 1024 * 1024, // 10MB
            autoCleanup: true,
            autoRestart: false,
            onIssueDetected: () => {},
            onMaintenanceComplete: () => {},
            ...config,
        };
    }

    /**
     * Initialize the plugin
     */
    public initialize(app: any, logger: any): void {
        if (!this.config.enabled) return;

        this.app = app;
        this.logger = logger;

        // Install monitoring middleware
        this.installMonitoringMiddleware();

        // Setup connection tracking
        this.setupConnectionTracking();

        // Start background maintenance
        this.startBackgroundMaintenance();

        // Setup error handlers
        this.setupErrorHandlers();

        this.logger.info("plugins", "Server Maintenance Plugin initialized");
    }

    /**
     * Install middleware to monitor requests
     */
    private installMonitoringMiddleware(): void {
        this.app.use((req: any, res: any, next: any) => {
            const startTime = Date.now();
            this.requestCount++;

            // Override res.end to capture metrics
            const originalEnd = res.end.bind(res);
            res.end = (...args: any[]) => {
                const responseTime = Date.now() - startTime;
                this.responseTimes.push(responseTime);

                // Keep only last 1000 response times
                if (this.responseTimes.length > 1000) {
                    this.responseTimes = this.responseTimes.slice(-1000);
                }

                if (res.statusCode >= 400) {
                    this.errorCount++;
                }

                return originalEnd(...args);
            };

            next();
        });
    }

    /**
     * Setup connection tracking
     */
    private setupConnectionTracking(): void {
        // Try to get server reference from app
        if (this.app && this.app.server) {
            this.server = this.app.server;
        } else if (this.app && this.app.start) {
            // Hook into the listen method to capture server
            const originalListen = this.app.start.bind(this.app);
            this.app.start = (...args: any[]) => {
                const server = originalListen(...args);
                this.server = server;
                this.setupServerConnectionTracking(server);
                return server;
            };
        }

        // If we already have a server, set up tracking
        if (this.server) {
            this.setupServerConnectionTracking(this.server);
        }
    }

    /**
     * Setup server connection event tracking
     */
    private setupServerConnectionTracking(server: any): void {
        if (!server || !server.on) return;

        server.on("connection", () => {
            this.activeConnections++;
        });

        server.on("close", () => {
            this.activeConnections = Math.max(0, this.activeConnections - 1);
        });

        // For HTTP/HTTPS servers, also track when connections end
        server.on("clientError", () => {
            this.activeConnections = Math.max(0, this.activeConnections - 1);
        });
    }

    /**
     * Setup error handlers
     */
    private setupErrorHandlers(): void {
        // Uncaught exception handler
        process.on("uncaughtException", (error) => {
            this.reportIssue({
                type: "error",
                category: "errors",
                message: `Uncaught exception: ${error.message}`,
                severity: 9,
                timestamp: new Date(),
                details: { stack: error.stack },
                resolved: false,
            });
        });

        // Unhandled rejection handler
        process.on("unhandledRejection", (reason, promise) => {
            this.reportIssue({
                type: "error",
                category: "errors",
                message: `Unhandled rejection: ${reason}`,
                severity: 8,
                timestamp: new Date(),
                details: { promise },
                resolved: false,
            });
        });
    }

    /**
     * Start background maintenance checks
     */
    private startBackgroundMaintenance(): void {
        this.maintenanceTimer = setInterval(async () => {
            try {
                await this.performMaintenanceCheck();
            } catch (error) {
                this.logger.error(
                    "plugins",
                    "Maintenance check failed:",
                    error
                );
            }
        }, this.config.checkInterval);
    }

    /**
     * Perform comprehensive maintenance check
     */
    private async performMaintenanceCheck(): Promise<void> {
        const metrics = await this.collectHealthMetrics();
        this.healthHistory.push(metrics);

        // Keep only last 100 health records
        if (this.healthHistory.length > 100) {
            this.healthHistory = this.healthHistory.slice(-100);
        }

        // Check for issues
        this.checkMemoryUsage(metrics);
        this.checkErrorRate(metrics);
        this.checkResponseTime(metrics);
        this.checkLogFiles();

        // Perform automatic cleanup if enabled
        if (this.config.autoCleanup) {
            this.performAutomaticCleanup();
        }

        this.emit("health_check", metrics);
    }

    /**
     * Collect current health metrics using CrossPlatformMemory CLI
     */
    private async collectHealthMetrics(): Promise<HealthMetrics> {
        // Get system memory info using SysApi
        let memoryInfo;
        try {
            const sysMem = __sys__.$memory();
            memoryInfo = {
                totalMemory: sysMem.total,
                usedMemory: sysMem.used,
                availableMemory: sysMem.available,
                usagePercentage: sysMem.usage_percent,
            };
        } catch (error) {
            // Fallback to process memory if SysApi fails
            const memUsage = process.memoryUsage();
            memoryInfo = {
                totalMemory: memUsage.heapTotal + memUsage.external,
                usedMemory: memUsage.heapUsed,
                availableMemory: memUsage.heapTotal - memUsage.heapUsed,
                usagePercentage:
                    (memUsage.heapUsed /
                        (memUsage.heapTotal + memUsage.external)) *
                    100,
            };
        }

        const avgResponseTime =
            this.responseTimes.length > 0
                ? this.responseTimes.reduce((a, b) => a + b, 0) /
                  this.responseTimes.length
                : 0;

        const p95ResponseTime =
            this.responseTimes.length > 0
                ? this.responseTimes.sort((a, b) => a - b)[
                      Math.floor(this.responseTimes.length * 0.95)
                  ]
                : 0;

        const errorRate =
            this.requestCount > 0
                ? (this.errorCount / this.requestCount) * 100
                : 0;

        return {
            memoryUsage: {
                used: memoryInfo.usedMemory,
                total: memoryInfo.totalMemory,
                percentage: memoryInfo.usagePercentage,
                trend: this.calculateMemoryTrend(),
            },
            cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
            errorRate,
            responseTime: {
                average: avgResponseTime,
                p95: p95ResponseTime,
                trend: this.calculateResponseTimeTrend(),
            },
            activeConnections: this.activeConnections, // Real active connections count
            uptime: Date.now() - this.startTime,
        };
    }

    /**
     * Calculate memory usage trend
     */
    private calculateMemoryTrend(): "increasing" | "stable" | "decreasing" {
        if (this.healthHistory.length < 3) return "stable";

        const recent = this.healthHistory.slice(-3);
        const trend =
            recent[2].memoryUsage.percentage - recent[0].memoryUsage.percentage;

        if (trend > 5) return "increasing";
        if (trend < -5) return "decreasing";
        return "stable";
    }

    /**
     * Calculate response time trend
     */
    private calculateResponseTimeTrend(): "improving" | "stable" | "degrading" {
        if (this.healthHistory.length < 3) return "stable";

        const recent = this.healthHistory.slice(-3);
        const trend =
            recent[2].responseTime.average - recent[0].responseTime.average;

        if (trend > 100) return "degrading";
        if (trend < -100) return "improving";
        return "stable";
    }

    /**
     * Check memory usage
     */
    private checkMemoryUsage(metrics: HealthMetrics): void {
        if (metrics.memoryUsage.percentage > this.config.memoryThreshold) {
            this.reportIssue({
                type: "warning",
                category: "memory",
                message: `High memory usage: ${metrics.memoryUsage.percentage.toFixed(
                    1
                )}%`,
                severity: 7,
                timestamp: new Date(),
                details: metrics.memoryUsage,
                resolved: false,
            });
        }

        if (
            metrics.memoryUsage.trend === "increasing" &&
            metrics.memoryUsage.percentage > 60
        ) {
            this.reportIssue({
                type: "warning",
                category: "memory",
                message:
                    "Memory usage is consistently increasing - possible memory leak",
                severity: 8,
                timestamp: new Date(),
                details: metrics.memoryUsage,
                resolved: false,
            });

            // Trigger automatic memory optimization
            this.performMemoryOptimization();
        }
    }

    /**
     * Check error rate
     */
    private checkErrorRate(metrics: HealthMetrics): void {
        if (metrics.errorRate > this.config.errorThreshold) {
            this.reportIssue({
                type: "error",
                category: "errors",
                message: `High error rate: ${metrics.errorRate.toFixed(1)}%`,
                severity: 8,
                timestamp: new Date(),
                details: {
                    errorRate: metrics.errorRate,
                    errorCount: this.errorCount,
                    requestCount: this.requestCount,
                },
                resolved: false,
            });
        }
    }

    /**
     * Check response time
     */
    private checkResponseTime(metrics: HealthMetrics): void {
        if (metrics.responseTime.average > this.config.responseTimeThreshold) {
            this.reportIssue({
                type: "warning",
                category: "performance",
                message: `Slow response time: ${metrics.responseTime.average.toFixed(
                    0
                )}ms average`,
                severity: 6,
                timestamp: new Date(),
                details: metrics.responseTime,
                resolved: false,
            });
        }

        if (metrics.responseTime.trend === "degrading") {
            this.reportIssue({
                type: "warning",
                category: "performance",
                message: "Response times are degrading",
                severity: 7,
                timestamp: new Date(),
                details: metrics.responseTime,
                resolved: false,
            });
        }
    }

    /**
     * Check log files
     */
    private checkLogFiles(): void {
        try {
            const logsDir = path.join(process.cwd(), "logs");
            if (!fs.existsSync(logsDir)) return;

            const files = fs.readdirSync(logsDir);
            for (const file of files) {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);

                // Check file size
                if (stats.size > this.config.maxLogFileSize) {
                    this.reportIssue({
                        type: "warning",
                        category: "logs",
                        message: `Large log file: ${file} (${(
                            stats.size /
                            1024 /
                            1024
                        ).toFixed(1)}MB)`,
                        severity: 4,
                        timestamp: new Date(),
                        details: { file, size: stats.size },
                        resolved: false,
                    });
                }

                // Check file age
                const ageInDays =
                    (Date.now() - stats.mtime.getTime()) /
                    (1000 * 60 * 60 * 24);
                if (ageInDays > this.config.logRetentionDays) {
                    this.reportIssue({
                        type: "info",
                        category: "logs",
                        message: `Old log file: ${file} (${ageInDays.toFixed(
                            1
                        )} days old)`,
                        severity: 2,
                        timestamp: new Date(),
                        details: { file, ageInDays },
                        resolved: false,
                    });
                }
            }
        } catch (error) {
            // Ignore log check errors
        }
    }

    /**
     * Perform memory optimization
     */
    private performMemoryOptimization(): void {
        const actions: string[] = [];

        // Force garbage collection if available
        if (global.gc) {
            const beforeMemory = process.memoryUsage().heapUsed;
            global.gc();
            const afterMemory = process.memoryUsage().heapUsed;
            const freed = beforeMemory - afterMemory;

            if (freed > 0) {
                actions.push(
                    `Freed ${(freed / 1024 / 1024).toFixed(
                        2
                    )}MB via garbage collection`
                );
            }
        }

        // Clear internal caches if memory usage is critical
        const currentMemory = process.memoryUsage();
        const memoryPercentage =
            (currentMemory.heapUsed / currentMemory.heapTotal) * 100;

        if (memoryPercentage > 85) {
            // Clear response time history to free memory
            if (this.responseTimes.length > 100) {
                this.responseTimes = this.responseTimes.slice(-100);
                actions.push("Cleared old response time history");
            }

            // Clear old health history
            if (this.healthHistory.length > 50) {
                this.healthHistory = this.healthHistory.slice(-50);
                actions.push("Cleared old health history");
            }

            // Clear resolved issues older than 1 hour
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            const oldIssuesCount = this.issues.length;
            this.issues = this.issues.filter(
                (issue) =>
                    !issue.resolved || issue.timestamp.getTime() > oneHourAgo
            );

            if (this.issues.length < oldIssuesCount) {
                actions.push(
                    `Cleared ${
                        oldIssuesCount - this.issues.length
                    } old resolved issues`
                );
            }
        }

        if (actions.length > 0) {
            this.logger.info(
                "plugins",
                `Memory optimization completed: ${actions.join(", ")}`
            );
            this.emit("memory_optimization", actions);
        }
    }

    /**
     * Perform automatic cleanup
     */
    private performAutomaticCleanup(): void {
        const actions: string[] = [];

        // Clean up old issues
        const oldIssues = this.issues.filter(
            (issue) =>
                Date.now() - issue.timestamp.getTime() > 24 * 60 * 60 * 1000 &&
                issue.resolved
        );

        if (oldIssues.length > 0) {
            this.issues = this.issues.filter(
                (issue) => !oldIssues.includes(issue)
            );
            actions.push(`Cleaned up ${oldIssues.length} old issues`);
        }

        // Force garbage collection if memory usage is high
        const latestMetrics = this.healthHistory[this.healthHistory.length - 1];
        if (latestMetrics && latestMetrics.memoryUsage.percentage > 70) {
            if (global.gc) {
                global.gc();
                actions.push("Forced garbage collection");
            }
        }

        // Clean up old log files
        this.cleanupOldLogs(actions);

        if (actions.length > 0) {
            this.logger.info(
                "plugins",
                `Automatic cleanup completed: ${actions.join(", ")}`
            );
            this.config.onMaintenanceComplete(actions);
            this.emit("maintenance_complete", actions);
        }
    }

    /**
     * Clean up old log files
     */
    private cleanupOldLogs(actions: string[]): void {
        try {
            const logsDir = path.join(process.cwd(), "logs");
            if (!fs.existsSync(logsDir)) return;

            const files = fs.readdirSync(logsDir);
            let cleanedFiles = 0;

            for (const file of files) {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                const ageInDays =
                    (Date.now() - stats.mtime.getTime()) /
                    (1000 * 60 * 60 * 24);

                if (ageInDays > this.config.logRetentionDays) {
                    fs.unlinkSync(filePath);
                    cleanedFiles++;
                }
            }

            if (cleanedFiles > 0) {
                actions.push(`Cleaned up ${cleanedFiles} old log files`);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    /**
     * Report a maintenance issue
     */
    private reportIssue(issue: MaintenanceIssue): void {
        this.issues.push(issue);

        // Keep only last 1000 issues
        if (this.issues.length > 1000) {
            this.issues = this.issues.slice(-1000);
        }

        this.logger.warn(
            "plugins",
            `Maintenance issue detected: ${issue.message}`
        );
        this.config.onIssueDetected(issue);
        this.emit("issue_detected", issue);

        // Check if critical restart is needed
        if (this.config.autoRestart && issue.severity >= 9) {
            this.logger.error(
                "plugins",
                "Critical issue detected - restart may be required"
            );
            this.emit("critical_issue", issue);
        }
    }

    /**
     * Get current health metrics
     */
    public getHealthMetrics(): HealthMetrics | null {
        return this.healthHistory[this.healthHistory.length - 1] || null;
    }

    /**
     * Get all issues
     */
    public getIssues(): MaintenanceIssue[] {
        return [...this.issues];
    }

    /**
     * Get unresolved issues
     */
    public getUnresolvedIssues(): MaintenanceIssue[] {
        return this.issues.filter((issue) => !issue.resolved);
    }

    /**
     * Resolve an issue
     */
    public resolveIssue(issueIndex: number): void {
        if (this.issues[issueIndex]) {
            this.issues[issueIndex].resolved = true;
            this.emit("issue_resolved", this.issues[issueIndex]);
        }
    }

    /**
     * Force maintenance check
     */
    public forceMaintenanceCheck(): void {
        this.performMaintenanceCheck();
    }

    /**
     * Destroy the plugin
     */
    public destroy(): void {
        if (this.maintenanceTimer) {
            clearInterval(this.maintenanceTimer);
        }
        this.issues = [];
        this.healthHistory = [];
        this.removeAllListeners();
    }
}

