/**
 * XyPrissJS - UFRP Core Module
 * Integrates all UFRP modules into a cohesive middleware
 */

import { Request, Response, NextFunction } from "express";
import { UFRPConfig } from "./types/ConfigTypes";
import { CacheManager } from "./CacheManager";
import { ConfigManager } from "./ConfigManager";
import { MetricsCollector } from "./MetricsCollector";
import { PerformanceTracker } from "./PerformanceTracker";
import { RequestAnalyzer } from "./RequestAnalyzer";
import { SecurityManager } from "./SecurityManager";
import { TaskManager } from "./TaskManager";
import { WorkerPoolManager } from "./WorkerPoolManager";

export class UFRPCore {
    private config: UFRPConfig;
    private cacheManager: CacheManager;
    private configManager: ConfigManager;
    private metricsCollector: MetricsCollector;
    private performanceTracker: PerformanceTracker;
    private requestAnalyzer: RequestAnalyzer;
    private securityManager: SecurityManager;
    private taskManager: TaskManager;
    private workerPoolManager: WorkerPoolManager;

    constructor(config: Partial<UFRPConfig> = {}) {
        this.configManager = new ConfigManager(config);
        this.config = this.configManager.getConfig();

        this.cacheManager = new CacheManager(this.config.cache);
        this.metricsCollector = new MetricsCollector(this.config.metrics);
        this.performanceTracker = new PerformanceTracker(
            this.config.performance
        );
        this.requestAnalyzer = new RequestAnalyzer(this.config.prediction);
        this.securityManager = new SecurityManager(this.config.security);
        this.taskManager = new TaskManager();
        this.workerPoolManager = new WorkerPoolManager(this.config.workers);

        // Set up metrics collection
        this.setupMetricsCollection();
    }

    private setupMetricsCollection(): void {
        setInterval(async () => {
            this.metricsCollector.collectMetrics(
                await this.cacheManager.getStats(),
                this.performanceTracker.getStats(),
                this.securityManager.getStats(),
                this.taskManager.getStats(),
                this.workerPoolManager.getStats()
            );
        }, this.config.metrics.collectionInterval);
    }

    getMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
        return async (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();

            try {
                // Security validation
                const securityCheck =
                    await this.securityManager.validateRequest(req);
                if (!securityCheck.valid) {
                    res.status(400).json({ error: securityCheck.reason });
                    return;
                }

                // Check cache
                const cacheKey = this.cacheManager.generateCacheKey(req);
                const cachedResponse = await this.cacheManager.get(cacheKey);
                if (cachedResponse) {
                    res.json(cachedResponse);
                    return;
                }

                // Create task
                const task = this.taskManager.createTask(
                    req,
                    this.determineTaskType(req),
                    this.calculateTaskPriority(req)
                );

                // Analyze request pattern
                this.requestAnalyzer.analyzeRequest(
                    req.method,
                    req.path,
                    Date.now() - startTime
                );

                // Track performance (use recordMetric instead of trackRequest)
                this.performanceTracker.recordMetric(
                    "responseTime",
                    Date.now() - startTime
                );

                // Execute task
                this.workerPoolManager.executeTask(task);

                // Continue to next middleware
                next();
            } catch (error) {
                console.error("UFRP Error:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        };
    }

    private determineTaskType(
        req: Request
    ): "read" | "write" | "validate" | "delete" | "process" {
        switch (req.method) {
            case "GET":
            case "HEAD":
                return "read";
            case "POST":
            case "PUT":
            case "PATCH":
                return req.path.includes("/validate") ? "validate" : "write";
            case "DELETE":
                return "delete";
            default:
                return "process";
        }
    }

    private calculateTaskPriority(req: Request): number {
        let priority = 1; // Default priority

        // Higher priority for certain paths
        if (req.path.includes("/api/auth") || req.path.includes("/health")) {
            priority = 0; // Highest priority
        } else if (req.path.includes("/api/admin")) {
            priority = 0;
        } else if (req.method === "GET") {
            priority = 1; // Medium priority for reads
        } else if (req.method === "POST" || req.method === "PUT") {
            priority = 2; // Lower priority for writes
        } else {
            priority = 3; // Lowest priority for other operations
        }

        // Adjust based on content type
        if (req.headers["content-type"]?.includes("application/json")) {
            priority = Math.max(0, priority - 1);
        }

        return priority;
    }

    getMetrics(): any {
        return this.metricsCollector.getLatestMetrics();
    }

    updateConfig(config: Partial<UFRPConfig>): void {
        this.configManager.updateConfig(config);
        this.config = this.configManager.getConfig();

        // Update module configs
        this.cacheManager.updateConfig(this.config.cache);
        this.performanceTracker.updateConfig(this.config.performance);
        this.requestAnalyzer.updateConfig(this.config.prediction);
        this.securityManager.updateConfig(this.config.security);
        this.workerPoolManager.updateConfig(this.config.workers);
    }

    shutdown(): void {
        this.workerPoolManager.shutdown();
    }
}

