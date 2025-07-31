/**
 * XyPrissJS - Ultra-Fast Request Processor (Optimized Production Version)
 * High-performance request processing using existing XyPrissJS components
 */

import { Request, Response, NextFunction } from "express";
import * as os from "os";
import { createHash } from "crypto";

// Types
import type { RequestPattern } from "./modules/UFRP/types/RequestTypes";
import type {
    UltraFastProcessorConfig,
    LegacyProcessorOptions,
} from "./modules/UFRP/types/ConfigTypes";
import { TaskInfo } from "./modules/UFRP";

// Use existing XyPrissJS utilities with correct paths
import {
    readCache,
    writeCache,
    getCacheStats,
} from "../../../../mods/toolkit/src/components/cache/index";
import { PerformanceMonitor } from "../../../performance-monitor";
import { WorkerPool } from "./modules/UFRP/WorkerPool";
import {
    OptimizedRequestPattern,
    RequestContext,
} from "../../service/Reload/types/UFRP.type";

export class UltraFastRequestProcessor {
    private workerPool: WorkerPool;
    private performanceMonitor: PerformanceMonitor;
    private requestPatterns = new Map<string, OptimizedRequestPattern>();
    private activeRequests = new Map<string, RequestContext>();
    private circuitBreaker = new Map<
        string,
        { failures: number; lastFailure: number; isOpen: boolean }
    >();

    private stats = {
        cacheHits: 0,
        cacheMisses: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        totalResponseTime: 0,
        peakConcurrency: 0,
        currentConcurrency: 0,
    };

    private config: UltraFastProcessorConfig;
    private intervals: NodeJS.Timeout[] = [];
    private isShuttingDown = false;
    private readonly maxConcurrency: number;

    constructor(
        config?: Partial<UltraFastProcessorConfig> | LegacyProcessorOptions
    ) {
        this.config = this.createFinalConfig(config);
        this.maxConcurrency = this.config.workers?.maxConcurrentTasks || 1000;

        // Initialize optimized worker pool
        this.workerPool = new WorkerPool({
            cpu:
                this.config.workers?.cpu ||
                Math.max(2, Math.floor(os.cpus().length * 0.8)),
            io:
                this.config.workers?.io ||
                Math.max(4, Math.floor(os.cpus().length * 0.6)),
            maxConcurrentTasks: this.maxConcurrency,
        });

        // Initialize performance monitor with optimized settings
        this.performanceMonitor = new PerformanceMonitor({
            ...this.config.performance,
            // Note: bufferSize and sampleRate are handled internally by PerformanceMonitor
        });

        // Start optimized pattern analysis
        if (this.config.prediction?.enabled) {
            this.startOptimizedPatternAnalysis();
        }

        // Start cleanup processes
        this.startCleanupProcesses();
    }

    private createFinalConfig(
        config?: Partial<UltraFastProcessorConfig> | LegacyProcessorOptions
    ): UltraFastProcessorConfig {
        const isLegacy =
            config && ("cpuWorkers" in config || "ioWorkers" in config);

        if (isLegacy) {
            return this.convertLegacyConfig(config as LegacyProcessorOptions);
        }

        return this.createDefaultConfig(
            config as Partial<UltraFastProcessorConfig>
        );
    }

    private convertLegacyConfig(
        legacy: LegacyProcessorOptions
    ): UltraFastProcessorConfig {
        return {
            cache: {
                maxSize: legacy.maxCacheSize || 50000,
                defaultTTL: legacy.cacheTTL || 300000,
                enableCompression: legacy.enableCompression ?? true,
                compressionThreshold: 1024,
            },
            performance: {
                enabled: true,
                metrics: [
                    "cpu",
                    "memory",
                    "responseTime",
                    "requests",
                    "errors",
                ],
                interval: 10000, // Reduced frequency for production
                alerts: [],
            },
            workers: {
                cpu:
                    legacy.cpuWorkers ||
                    Math.max(2, Math.floor(os.cpus().length * 0.8)),
                io:
                    legacy.ioWorkers ||
                    Math.max(4, Math.floor(os.cpus().length * 0.6)),
                maxConcurrentTasks: legacy.maxConcurrentTasks || 1000,
            },
            prediction: {
                enabled: legacy.enablePrediction ?? true,
                patternRetentionTime: 1800000, // 30 minutes
                analysisInterval: 300000, // 5 minutes
                hotPatternThreshold: 50, // Increased threshold
            },
        };
    }

    private createDefaultConfig(
        override?: Partial<UltraFastProcessorConfig>
    ): UltraFastProcessorConfig {
        const cpuCount = os.cpus().length;
        const defaults: UltraFastProcessorConfig = {
            cache: {
                maxSize: 50000,
                defaultTTL: 300000,
                enableCompression: true,
                compressionThreshold: 1024,
            },
            performance: {
                enabled: true,
                metrics: [
                    "cpu",
                    "memory",
                    "responseTime",
                    "requests",
                    "errors",
                ],
                interval: 10000,
                alerts: [],
            },
            workers: {
                cpu: Math.max(2, Math.floor(cpuCount * 0.8)),
                io: Math.max(4, Math.floor(cpuCount * 0.6)),
                maxConcurrentTasks: 1000,
            },
            prediction: {
                enabled: true,
                patternRetentionTime: 1800000,
                analysisInterval: 300000,
                hotPatternThreshold: 50,
            },
        };

        return this.deepMerge(defaults, override || {});
    }

    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        for (const key in source) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    private startOptimizedPatternAnalysis(): void {
        const interval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.analyzeRequestPatterns();
                this.updateCircuitBreakers();
            }
        }, this.config.prediction?.analysisInterval || 300000);

        this.intervals.push(interval);
    }

    private startCleanupProcesses(): void {
        // Pattern cleanup
        const patternCleanup = setInterval(() => {
            if (!this.isShuttingDown) {
                this.cleanupOldPatterns();
            }
        }, 600000); // Every 10 minutes

        // Active requests cleanup (for orphaned requests)
        const requestCleanup = setInterval(() => {
            if (!this.isShuttingDown) {
                this.cleanupOrphanedRequests();
            }
        }, 60000); // Every minute

        this.intervals.push(patternCleanup, requestCleanup);
    }

    private analyzeRequestPatterns(): void {
        const now = Date.now();
        const patterns = Array.from(this.requestPatterns.entries());

        for (const [patternKey, pattern] of patterns) {
            const timeSpan = Math.max(1, (now - pattern.lastSeen) / 60000);
            pattern.frequency = pattern.count / timeSpan;
            pattern.priority = this.calculateOptimizedPriority(pattern);

            // Update success rate
            pattern.successRate =
                pattern.count > 0
                    ? ((pattern.count - pattern.errorCount) / pattern.count) *
                      100
                    : 100;
        }

        // Prune low-priority patterns to manage memory
        this.prunePatterns(patterns);
    }

    private calculateOptimizedPriority(
        pattern: OptimizedRequestPattern
    ): number {
        const now = Date.now();
        const recency = Math.max(1, (now - pattern.lastSeen) / 60000);
        const frequency = pattern.frequency || 1;
        const speed = 1000 / Math.max(pattern.avgResponseTime, 1);
        const reliability = pattern.successRate / 100;
        const resourceEfficiency =
            1 /
            Math.max(
                pattern.resourceUsage.cpu + pattern.resourceUsage.memory,
                1
            );

        return (
            (pattern.count *
                frequency *
                speed *
                reliability *
                resourceEfficiency) /
            recency
        );
    }

    private prunePatterns(patterns: [string, OptimizedRequestPattern][]): void {
        const maxPatterns = 10000; // Limit memory usage
        if (patterns.length <= maxPatterns) return;

        // Sort by priority (ascending) and remove lowest priority patterns
        patterns.sort((a, b) => a[1].priority - b[1].priority);
        const toRemove = patterns.slice(0, patterns.length - maxPatterns);

        for (const [key] of toRemove) {
            this.requestPatterns.delete(key);
        }
    }

    private updateCircuitBreakers(): void {
        const now = Date.now();
        const resetTime = 60000; // 1 minute

        for (const [pattern, breaker] of this.circuitBreaker.entries()) {
            if (breaker.isOpen && now - breaker.lastFailure > resetTime) {
                breaker.isOpen = false;
                breaker.failures = 0;
            }
        }
    }

    private cleanupOldPatterns(): void {
        const now = Date.now();
        const retentionTime =
            this.config.prediction?.patternRetentionTime || 1800000;
        let cleaned = 0;

        for (const [patternKey, pattern] of this.requestPatterns.entries()) {
            if (now - pattern.lastSeen > retentionTime) {
                this.requestPatterns.delete(patternKey);
                cleaned++;
            }
        }

        // Also cleanup circuit breakers
        for (const [pattern, breaker] of this.circuitBreaker.entries()) {
            if (now - breaker.lastFailure > retentionTime) {
                this.circuitBreaker.delete(pattern);
            }
        }
    }

    private cleanupOrphanedRequests(): void {
        const now = Date.now();
        const maxAge = 300000; // 5 minutes

        for (const [reqId, context] of this.activeRequests.entries()) {
            if (now - context.startTime > maxAge) {
                this.activeRequests.delete(reqId);
                this.stats.currentConcurrency = Math.max(
                    0,
                    this.stats.currentConcurrency - 1
                );
            }
        }
    }

    public middleware() {
        return async (
            req: Request,
            res: Response,
            next: NextFunction
        ): Promise<void> => {
            if (this.isShuttingDown) {
                res.status(503).json({ error: "Service shutting down" });
                return;
            }

            // Check concurrency limit
            if (this.stats.currentConcurrency >= this.maxConcurrency) {
                res.status(429).json({ error: "Too many concurrent requests" });
                return;
            }

            const requestId = this.generateRequestId();
            const startTime = Date.now();
            const context: RequestContext = {
                startTime,
                cacheKey: this.generateOptimizedCacheKey(req),
                pattern: this.generatePattern(req),
                priority: this.calculateRequestPriority(req),
                workerType: this.determineWorkerType(req),
                taskType: this.determineTaskType(req),
            };

            this.activeRequests.set(requestId, context);
            this.stats.currentConcurrency++;
            this.stats.totalRequests++;
            this.stats.peakConcurrency = Math.max(
                this.stats.peakConcurrency,
                this.stats.currentConcurrency
            );

            try {
                // Check circuit breaker
                if (this.isCircuitOpen(context.pattern)) {
                    throw new Error("Circuit breaker open");
                }

                // Try cache first
                const cachedResult = await this.tryCache(context.cacheKey);
                if (cachedResult) {
                    await this.sendCachedResponse(
                        res,
                        cachedResult,
                        requestId,
                        context
                    );
                    return;
                }

                // Process request
                const result = await this.processOptimizedRequest(req, context);

                // Cache result if successful
                if (result && !res.headersSent) {
                    await this.cacheResult(context.cacheKey, result);
                    await this.sendProcessedResponse(
                        res,
                        result,
                        requestId,
                        context
                    );
                } else if (!res.headersSent) {
                    // If we couldn't process the request, pass it to the next middleware
                    next();
                    return;
                }

                this.recordSuccess(context, Date.now() - startTime);
            } catch (error) {
                this.recordFailure(context, error, Date.now() - startTime);
                if (!res.headersSent) {
                    this.sendErrorResponse(res, error, requestId);
                }
            } finally {
                this.activeRequests.delete(requestId);
                this.stats.currentConcurrency = Math.max(
                    0,
                    this.stats.currentConcurrency - 1
                );
            }
        };
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 11)}`;
    }

    private generateOptimizedCacheKey(req: Request): string {
        // More efficient cache key generation
        const keyParts = [
            req.method,
            req.path,
            req.headers["content-type"] || "",
        ];

        // Only include query params for GET requests
        if (req.method === "GET" && Object.keys(req.query).length > 0) {
            keyParts.push(JSON.stringify(req.query));
        }

        return createHash("sha256")
            .update(keyParts.join("|"))
            .digest("base64url"); // More URL-safe encoding
    }

    private async tryCache(cacheKey: string): Promise<any> {
        try {
            const result = await readCache(cacheKey);
            if (
                result &&
                typeof result === "object" &&
                Object.keys(result).length > 0
            ) {
                this.stats.cacheHits++;
                return result;
            }
        } catch (error) {
            // Cache miss or error, continue with processing
        }

        this.stats.cacheMisses++;
        return null;
    }

    private async processOptimizedRequest(
        req: Request,
        context: RequestContext
    ): Promise<any> {
        const task: TaskInfo = {
            id: this.generateRequestId(),
            type: context.taskType,
            priority: context.priority,
            workerType: context.workerType,
            createdAt: Date.now(),
            data: {
                method: req.method,
                path: req.path,
                query: req.query,
                body: req.body,
                headers: this.sanitizeHeaders(req.headers),
            },
        };

        // TODO: Implement actual request processing logic
        // For now, return null to pass control to next middleware
        return null;
    }

    private createTimeoutPromise(ms: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), ms);
        });
    }

    private async cacheResult(cacheKey: string, result: any): Promise<void> {
        try {
            await writeCache(cacheKey, result, {
                ttl: this.config.cache?.defaultTTL || 300000,
            });
        } catch (error) {
            // Log cache write errors but don't fail the request
            console.warn("Cache write failed:", error);
        }
    }

    private async sendCachedResponse(
        res: Response,
        result: any,
        requestId: string,
        context: RequestContext
    ): Promise<void> {
        const responseTime = Date.now() - context.startTime;
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Response-Time", `${responseTime}ms`);
        res.setHeader("X-Request-ID", requestId);
        res.json(result);
    }

    private async sendProcessedResponse(
        res: Response,
        result: any,
        requestId: string,
        context: RequestContext
    ): Promise<void> {
        const responseTime = Date.now() - context.startTime;
        res.setHeader("X-Cache", "MISS");
        res.setHeader("X-Response-Time", `${responseTime}ms`);
        res.setHeader("X-Request-ID", requestId);
        res.json(result);
    }

    private sendErrorResponse(
        res: Response,
        error: any,
        requestId: string
    ): void {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            error: error.message || "Internal server error",
            requestId,
            timestamp: Date.now(),
        });
    }

    private isCircuitOpen(pattern: string): boolean {
        const breaker = this.circuitBreaker.get(pattern);
        return breaker?.isOpen || false;
    }

    private recordSuccess(context: RequestContext, responseTime: number): void {
        this.stats.successfulRequests++;
        this.stats.totalResponseTime += responseTime;
        this.stats.avgResponseTime =
            this.stats.totalResponseTime / this.stats.totalRequests;

        this.updateRequestPattern(context, responseTime, true);
    }

    private recordFailure(
        context: RequestContext,
        error: any,
        responseTime: number
    ): void {
        this.stats.failedRequests++;
        this.stats.totalResponseTime += responseTime;
        this.stats.avgResponseTime =
            this.stats.totalResponseTime / this.stats.totalRequests;

        this.updateRequestPattern(context, responseTime, false);
        this.updateCircuitBreaker(context.pattern);
    }

    private updateRequestPattern(
        context: RequestContext,
        responseTime: number,
        success: boolean
    ): void {
        const pattern =
            this.requestPatterns.get(context.pattern) ||
            this.createNewPattern(context);

        pattern.count++;
        pattern.lastSeen = Date.now();
        pattern.avgResponseTime = this.updateAverage(
            pattern.avgResponseTime,
            responseTime,
            pattern.count
        );

        if (!success) {
            pattern.errorCount++;
            pattern.lastErrorTime = Date.now();
        }

        pattern.successRate =
            ((pattern.count - pattern.errorCount) / pattern.count) * 100;
        pattern.priority = this.calculateOptimizedPriority(pattern);

        this.requestPatterns.set(context.pattern, pattern);
    }

    private createNewPattern(context: RequestContext): OptimizedRequestPattern {
        return {
            count: 0,
            lastSeen: 0,
            avgResponseTime: 0,
            priority: 0,
            method: context.pattern.split(":")[0],
            path: context.pattern.split(":")[1],
            frequency: 0,
            trend: "stable",
            successRate: 100,
            errorCount: 0,
            peakUsage: 0,
            resourceUsage: { cpu: 0, memory: 0 },
        };
    }

    private updateCircuitBreaker(pattern: string): void {
        const breaker = this.circuitBreaker.get(pattern) || {
            failures: 0,
            lastFailure: 0,
            isOpen: false,
        };

        breaker.failures++;
        breaker.lastFailure = Date.now();

        if (breaker.failures >= 5) {
            // Open circuit after 5 failures
            breaker.isOpen = true;
        }

        this.circuitBreaker.set(pattern, breaker);
    }

    private determineTaskType(req: Request): TaskInfo["type"] {
        if (req.path.includes("/validate") || req.path.includes("/verify"))
            return "validate";

        switch (req.method) {
            case "GET":
            case "HEAD":
                return "read";
            case "POST":
            case "PUT":
            case "PATCH":
                return "write";
            case "DELETE":
                return "delete";
            default:
                return "process";
        }
    }

    private calculateRequestPriority(req: Request): number {
        let priority = 5; // Default priority

        // Critical paths get highest priority
        if (req.path.includes("/health") || req.path.includes("/status")) {
            priority = 0;
        } else if (req.path.includes("/auth") || req.path.includes("/login")) {
            priority = 1;
        } else if (req.path.includes("/api/admin")) {
            priority = 2;
        } else if (req.method === "GET") {
            priority = 3;
        } else if (req.method === "POST" || req.method === "PUT") {
            priority = 4;
        }

        // Adjust based on content type
        if (req.headers["content-type"]?.includes("application/json")) {
            priority = Math.max(0, priority - 1);
        }

        return priority;
    }

    private determineWorkerType(req: Request): "cpu" | "io" {
        // CPU-intensive operations
        const cpuPaths = [
            "/validate",
            "/compute",
            "/transform",
            "/encrypt",
            "/hash",
            "/compress",
        ];
        if (cpuPaths.some((path) => req.path.includes(path))) {
            return "cpu";
        }

        // Default to I/O for database, file system, network operations
        return "io";
    }

    private generatePattern(req: Request): string {
        return [
            req.method,
            req.route?.path || req.path,
            req.headers["content-type"] || "",
        ].join(":");
    }

    private updateAverage(
        currentAvg: number,
        newValue: number,
        count: number
    ): number {
        return (currentAvg * (count - 1) + newValue) / count;
    }

    private sanitizeHeaders(headers: any): Record<string, string> {
        const sanitized: Record<string, string> = {};
        const allowedHeaders = [
            "content-type",
            "accept",
            "authorization",
            "user-agent",
            "x-forwarded-for",
            "x-real-ip",
            "accept-encoding",
        ];

        for (const key of allowedHeaders) {
            if (headers[key]) {
                sanitized[key] = String(headers[key]);
            }
        }
        return sanitized;
    }

    public getStats() {
        const performanceMetrics = this.performanceMonitor.getMetrics();
        const patternStats = this.getOptimizedPatternStats();
        const workerPoolStats = this.workerPool.getStats();
        const cacheStats = getCacheStats();

        return {
            cache: {
                hits: this.stats.cacheHits,
                misses: this.stats.cacheMisses,
                hitRate:
                    this.stats.totalRequests > 0
                        ? (this.stats.cacheHits / this.stats.totalRequests) *
                          100
                        : 0,
                stats: cacheStats,
            },
            requests: {
                total: this.stats.totalRequests,
                successful: this.stats.successfulRequests,
                failed: this.stats.failedRequests,
                successRate:
                    this.stats.totalRequests > 0
                        ? (this.stats.successfulRequests /
                              this.stats.totalRequests) *
                          100
                        : 0,
                avgResponseTime: this.stats.avgResponseTime,
                currentConcurrency: this.stats.currentConcurrency,
                peakConcurrency: this.stats.peakConcurrency,
            },
            patterns: patternStats,
            performance: performanceMetrics,
            workerPool: workerPoolStats,
            circuitBreakers: {
                total: this.circuitBreaker.size,
                open: Array.from(this.circuitBreaker.values()).filter(
                    (b) => b.isOpen
                ).length,
            },
            memory: {
                activeRequests: this.activeRequests.size,
                patterns: this.requestPatterns.size,
                circuitBreakers: this.circuitBreaker.size,
            },
        };
    }

    private getOptimizedPatternStats() {
        const now = Date.now();
        const activePatterns = Array.from(this.requestPatterns.values()).filter(
            (pattern) => now - pattern.lastSeen < 600000
        );

        const hotPatterns = activePatterns.filter(
            (p) =>
                p.priority > (this.config.prediction?.hotPatternThreshold || 50)
        );

        return {
            totalPatterns: this.requestPatterns.size,
            activePatterns: activePatterns.length,
            hotPatterns: hotPatterns.length,
            avgSuccessRate:
                activePatterns.length > 0
                    ? activePatterns.reduce(
                          (sum, p) => sum + p.successRate,
                          0
                      ) / activePatterns.length
                    : 100,
            avgResponseTime:
                activePatterns.length > 0
                    ? activePatterns.reduce(
                          (sum, p) => sum + p.avgResponseTime,
                          0
                      ) / activePatterns.length
                    : 0,
            topPatterns: hotPatterns
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 10)
                .map((p) => ({
                    method: p.method,
                    path: p.path,
                    priority: p.priority,
                    successRate: p.successRate,
                    avgResponseTime: p.avgResponseTime,
                    frequency: p.frequency,
                })),
        };
    }

    public async destroy(): Promise<void> {
        this.isShuttingDown = true;

        try {
            // Wait for active requests to complete (with timeout)
            const maxWaitTime = 30000; // 30 seconds
            const checkInterval = 100;
            let waited = 0;

            while (this.activeRequests.size > 0 && waited < maxWaitTime) {
                await new Promise((resolve) =>
                    setTimeout(resolve, checkInterval)
                );
                waited += checkInterval;
            }

            // Clear all intervals
            this.intervals.forEach((interval) => clearInterval(interval));
            this.intervals = [];

            // Stop performance monitor
            this.performanceMonitor.stop();

            // Note: WorkerPool doesn't require explicit shutdown as it doesn't create actual worker threads

            // Clear all maps
            this.requestPatterns.clear();
            this.activeRequests.clear();
            this.circuitBreaker.clear();

            console.log("UltraFastRequestProcessor shutdown complete");
        } catch (error) {
            console.error("Error during shutdown:", error);
        }
    }
}

