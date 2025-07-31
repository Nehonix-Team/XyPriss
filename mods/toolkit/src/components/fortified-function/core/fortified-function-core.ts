/**
 * XyPrissSecurity - Optimized Fortified Function Core (Minimal Architecture)
 * High-performance implementation with singleton pattern
 * Migrated from complex implementation to maintain architecture
 */

import { EventEmitter } from "events";
import {
    FortifiedFunctionOptions,
    FunctionStats,
    AuditEntry,
    TimingStats,
    PerformanceMetrics,
    OptimizationSuggestion,
    AnalyticsData,
    AnomalyDetection,
} from "../types/fortified-types";
import { fortifiedLogger } from "./fortified-logger";
import { fortifiedConfig } from "./fortified-config";
import { NehoID as ID } from "nehoid";

// Import mods
import { SecurityManager } from "./mods/security-manager";
import { CacheManager } from "./mods/cache-manager";
import { StatsManager } from "./mods/stats-manager";
import { MemoryManager } from "./mods/memory-manager";
import { ExecutionEngine } from "./mods/execution-engine";
import { ExecutionContextManager } from "./mods/execution-context";
import { ExecutionRouter } from "./mods/execution-router";
import { TimingManager } from "./mods/timing-manager";
import { ApiManager } from "./mods/api-manager";

// Import advanced components
import { SecurityHandler } from "../security/security-handler";
import { PerformanceMonitor } from "../performance/performance-monitor";
import { FuncExecutionEngine } from "../engines/execution-engine";
import { UltraFastEngine } from "../UFA/ultra-fast-engine";
import { UltraFastCache } from "../UFA/ultra-fast-cache";
import { UltraFastAllocator } from "../UFA/ultra-fast-allocator";

import { FortifiedUtils } from "../utils";

/**
 * Optimized Fortified Function - High-performance implementation
 * Uses singleton pattern for optimal resource utilization
 */
export class FortifiedFunctionCore<T extends any[], R> extends EventEmitter {
    private static instances = new Map<
        string,
        FortifiedFunctionCore<any, any>
    >();
    private static globalMetrics = {
        totalInstances: 0,
        totalExecutions: 0,
        totalCacheHits: 0,
        totalCacheMisses: 0,
        averageExecutionTime: 0,
    };

    private readonly functionId: string;
    private readonly originalFunction: (...args: T) => R | Promise<R>;
    private readonly options: Required<FortifiedFunctionOptions>;

    // Existing components
    private readonly securityManager: SecurityManager;
    private readonly executionContextManager: ExecutionContextManager;
    private readonly cacheManager: CacheManager<R>;
    private readonly statsManager: StatsManager;
    private readonly memoryManager: MemoryManager;
    private readonly executionEngine: ExecutionEngine;

    // New modular components for minimal architecture
    private readonly executionRouter: ExecutionRouter;
    private readonly timingManager: TimingManager;
    private readonly apiManager: ApiManager;

    // Advanced components
    private readonly securityHandler: SecurityHandler;
    private readonly performanceMonitor: PerformanceMonitor;
    private readonly funcExecutionEngine: FuncExecutionEngine;
    private isDestroyed = false;
    private cleanupInterval?: NodeJS.Timeout;

    // Ultra-fast performance components
    private readonly ultraFastEngine: UltraFastEngine;
    private readonly ultraFastCache: UltraFastCache<string, R>;
    private readonly ultraFastAllocator: UltraFastAllocator;
    private readonly functionSignature: string;

    // Performance tracking
    private executionCount = 0;
    private lastOptimizationCheck = 0;
    private readonly optimizationCheckInterval = 100; // Check every 100 executions

    private constructor(
        fn: (...args: T) => R | Promise<R>,
        options: Partial<FortifiedFunctionOptions> = {},
        functionId?: string
    ) {
        super();

        this.functionId = functionId || this.generateFunctionId();
        this.originalFunction = fn;

        // Get optimized configuration from config manager
        this.options = fortifiedConfig.createFunctionConfig(
            this.functionId,
            options
        );

        fortifiedLogger.debug(
            "CORE",
            `Creating optimized fortified function: ${this.functionId}`,
            {
                functionId: this.functionId,
                ultraFast: this.options.ultraFast,
                enableJIT: this.options.enableJIT,
                smartCaching: this.options.smartCaching,
            }
        );

        // Initialize performance components
        this.functionSignature = this.generateFunctionSignature(fn);
        this.ultraFastEngine = new UltraFastEngine(this.options);
        this.ultraFastCache = new UltraFastCache<string, R>(
            this.options.maxCacheSize,
            this.options.maxMemoryUsage
        );
        this.ultraFastAllocator = new UltraFastAllocator();

        // Initialize timing manager
        this.timingManager = new TimingManager(this.functionId);

        // Initialize existing components
        this.securityManager = new SecurityManager(this.options);
        this.statsManager = new StatsManager(this.options);
        this.memoryManager = new MemoryManager(this.options);
        this.executionContextManager = new ExecutionContextManager(
            this.options,
            this.securityManager
        );
        this.cacheManager = new CacheManager<R>(
            this.options,
            this.securityManager
        );
        this.executionEngine = new ExecutionEngine(
            this.options,
            this.securityManager
        );

        // Initialize advanced components
        this.securityHandler = new SecurityHandler();

        const cacheConfig = this.options.smartCaching
            ? {
                  strategy: this.options.cacheStrategy,
                  maxSize: this.options.maxCacheSize,
                  ttl: this.options.cacheTTL,
                  autoCleanup: this.options.autoCleanup,
                  compressionEnabled: false,
                  persistToDisk: false,
              }
            : undefined;

        this.performanceMonitor = new PerformanceMonitor(cacheConfig);
        this.funcExecutionEngine = new FuncExecutionEngine(
            this.securityHandler,
            this.performanceMonitor
        );

        // Initialize execution router after all dependencies are ready
        this.executionRouter = new ExecutionRouter(
            this.options,
            this.ultraFastEngine,
            this.ultraFastCache,
            this.performanceMonitor,
            this.functionSignature
        );

        // Initialize API manager
        this.apiManager = new ApiManager(
            this.functionId,
            this.statsManager,
            this.cacheManager,
            this.performanceMonitor,
            this.ultraFastCache,
            this.timingManager,
            this.options
        );

        // Configure ultra-fast mode
        if (this.options.ultraFast) {
            this.funcExecutionEngine.enableFastMode(
                this.options.ultraFast === "minimal"
                    ? "minimal"
                    : this.options.ultraFast === "maximum"
                    ? "maximum"
                    : "standard"
            );
        }

        // Setup event forwarding
        this.setupEventForwarding();

        // Setup automatic cleanup
        if (this.options.autoCleanup) {
            this.setupAutoCleanup();
        }

        // Update global metrics
        FortifiedFunctionCore.globalMetrics.totalInstances++;
    }

    private generateFunctionId(): string {
        return ID.generate({ prefix: "nehonix.function", size: 16 });
    }

    /**
     * Generate function signature for optimization
     */
    private generateFunctionSignature(
        fn: (...args: T) => R | Promise<R>
    ): string {
        const fnString = fn.toString();
        let hash = 0;
        for (let i = 0; i < fnString.length; i++) {
            const char = fnString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return `fn_${Math.abs(hash).toString(36)}`;
    }

    /**
     * Setup automatic cleanup
     */
    private setupAutoCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.performanceMonitor.cleanupOldCacheEntries(300000); // 5 minutes

            // Smart cache warming if predictive analytics is enabled
            if (this.options.predictiveAnalytics) {
                this.warmCache();
            }

            // Auto-apply optimization suggestions if auto-tuning is enabled
            if (this.options.autoTuning) {
                this.autoApplyOptimizations();
            }
        }, 60000); // Check every minute
    }

    /**
     * Factory method with singleton pattern for optimal resource usage
     */
    public static create<T extends any[], R>(
        fn: (...args: T) => R | Promise<R>,
        options: Partial<FortifiedFunctionOptions> = {},
        functionId?: string
    ): FortifiedFunctionCore<T, R> {
        const id = functionId || FortifiedFunctionCore.generateFunctionId(fn);

        // Check if instance already exists
        if (FortifiedFunctionCore.instances.has(id)) {
            const existing = FortifiedFunctionCore.instances.get(id)!;
            fortifiedLogger.debug("CORE", `Reusing existing instance: ${id}`);
            return existing as FortifiedFunctionCore<T, R>;
        }

        // Create new instance
        const instance = new FortifiedFunctionCore(fn, options, id);
        FortifiedFunctionCore.instances.set(id, instance);

        fortifiedLogger.debug("CORE", `Created new optimized instance: ${id}`, {
            totalInstances: FortifiedFunctionCore.globalMetrics.totalInstances,
        });

        return instance;
    }

    /**
     * Get existing instance by ID
     */
    public static getInstance<T extends any[], R>(
        functionId: string
    ): FortifiedFunctionCore<T, R> | null {
        return (
            (FortifiedFunctionCore.instances.get(
                functionId
            ) as FortifiedFunctionCore<T, R>) || null
        );
    }

    /**
     * Get all active instances
     */
    public static getAllInstances(): FortifiedFunctionCore<any, any>[] {
        return Array.from(FortifiedFunctionCore.instances.values());
    }

    /**
     * Get global performance metrics
     */
    public static getGlobalMetrics() {
        return { ...FortifiedFunctionCore.globalMetrics };
    }

    /**
     * Generate unique function ID
     */
    private static generateFunctionId(fn: Function): string {
        const fnString = fn.toString();
        let hash = 0;
        for (let i = 0; i < fnString.length; i++) {
            const char = fnString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }

        /**`ff_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}` */
        return `ff_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
    }

    /**
     * Get function ID
     */
    public getFunctionId(): string {
        return this.functionId;
    }

    /**
     * Get current configuration
     */
    public getConfiguration(): Required<FortifiedFunctionOptions> {
        return { ...this.options };
    }

    /**
     * Execute with extreme performance optimizations
     */
    public async execute(...args: T): Promise<R> {
        if (this.isDestroyed) {
            throw new Error(
                `Cannot execute destroyed fortified function: ${this.functionId}.`
            );
        }

        this.executionCount++;
        this.apiManager.incrementExecutionCount();
        const startTime = performance.now();

        fortifiedLogger.debug(
            "CORE",
            `Executing function: ${this.functionId}`,
            {
                functionId: this.functionId,
                executionCount: this.executionCount,
                args: this.options.debugMode ? args : "[hidden]",
            }
        );

        try {
            let result: R;

            // Route to appropriate execution path based on optimization level
            if (
                this.options.ultraFast === "maximum" ||
                this.options.enableJIT
            ) {
                result = await this.executeWithUltraFastEngine(...args);
            } else if (this.options.ultraFast === "minimal") {
                result = await this.executeUltraFast(...args);
            } else {
                result = await this.executeStandard(...args);
            }

            const executionTime = performance.now() - startTime;

            // Update global metrics
            FortifiedFunctionCore.globalMetrics.averageExecutionTime =
                (FortifiedFunctionCore.globalMetrics.averageExecutionTime *
                    (FortifiedFunctionCore.globalMetrics.totalExecutions - 1) +
                    executionTime) /
                FortifiedFunctionCore.globalMetrics.totalExecutions;

            // Periodic optimization check
            if (
                this.executionCount - this.lastOptimizationCheck >=
                this.optimizationCheckInterval
            ) {
                this.performOptimizationCheck();
                this.lastOptimizationCheck = this.executionCount;
            }

            fortifiedLogger.debug(
                "CORE",
                `Execution completed: ${this.functionId}`,
                {
                    functionId: this.functionId,
                    executionTime,
                    executionCount: this.executionCount,
                }
            );

            return result;
        } catch (error) {
            const executionTime = performance.now() - startTime;

            fortifiedLogger.error(
                "CORE",
                `Execution failed: ${this.functionId}`,
                {
                    functionId: this.functionId,
                    executionTime,
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            );

            throw error;
        }
    }

    /**
     * Execute with ultra-fast engine (delegated to ExecutionRouter)
     */
    private async executeWithUltraFastEngine(...args: T): Promise<R> {
        return await this.executionRouter.executeWithUltraFastEngine(
            this.originalFunction,
            args,
            this.options,
            this.functionId,
            FortifiedFunctionCore.globalMetrics
        );
    }

    /**
     * Ultra-fast execution (delegated to ExecutionRouter)
     */
    private async executeUltraFast(...args: T): Promise<R> {
        return await this.executionRouter.executeUltraFast(
            this.originalFunction,
            args,
            this.options,
            FortifiedFunctionCore.globalMetrics
        );
    }

    /**
     * Standard execution with full security and monitoring (using existing components)
     */
    private async executeStandard(...args: T): Promise<R> {
        // Use the existing execution path
        const executionId = FortifiedUtils.generateExecutionId();
        const context =
            await this.executionContextManager.createSecureExecutionContext(
                executionId,
                args
            );

        try {
            // Check memoization cache using existing cache manager
            const cachedResult = await this.cacheManager.getCachedResult(
                args,
                executionId
            );
            if (cachedResult !== null) {
                this.statsManager.recordCacheHit();
                FortifiedFunctionCore.globalMetrics.totalCacheHits++;
                return cachedResult;
            }
            this.statsManager.recordCacheMiss();
            FortifiedFunctionCore.globalMetrics.totalCacheMisses++;

            // Execute with security and monitoring using existing execution engine
            const result = await this.executionEngine.executeWithSecurity(
                this.originalFunction,
                context,
                args
            );

            // Cache result if memoization is enabled
            await this.cacheManager.cacheResult(args, result, executionId);

            // Update statistics
            this.statsManager.updateStats(context, true);

            // Schedule cleanup
            this.executionContextManager.scheduleCleanup(context);

            return result;
        } catch (error) {
            this.statsManager.handleExecutionError(context, error as Error);
            this.executionContextManager.scheduleCleanup(context);
            throw error;
        }
    }

    /**
     * Perform optimization check (delegated to ApiManager)
     */
    private performOptimizationCheck(): void {
        const stats = this.apiManager.getStats();
        if (stats.executionCount >= 10 && this.options.autoTuning) {
            const optimized = this.apiManager.autoApplyOptimizations();
            if (optimized) {
                this.emit("auto_optimization_applied", {
                    type: "cache_size_increased",
                    functionId: this.functionId,
                });
            }
        }
    }

    // ===== PUBLIC API METHODS (Delegated to ApiManager) =====

    public getStats(): FunctionStats {
        return this.apiManager.getStats();
    }
    public getAuditLog(): AuditEntry[] {
        return this.apiManager.getAuditLog();
    }
    public getCacheStats() {
        return this.apiManager.getCacheStats();
    }
    public getAnalyticsData(): AnalyticsData {
        return this.apiManager.getAnalyticsData();
    }
    public getOptimizationSuggestions(): OptimizationSuggestion[] {
        return this.apiManager.getOptimizationSuggestions();
    }
    public getPerformanceTrends(): PerformanceMetrics[] {
        return this.apiManager.getPerformanceTrends();
    }
    public detectAnomalies(): AnomalyDetection[] {
        return this.apiManager.detectAnomalies();
    }

    public clearCache(): void {
        this.apiManager.clearCache();
        this.emit("cache_cleared", { functionId: this.functionId });
    }

    public warmCache(): void {
        this.apiManager.warmCache();
        this.emit("cache_warmed", { functionId: this.functionId });
    }

    public handleMemoryPressure(level: "low" | "medium" | "high"): void {
        this.apiManager.handleMemoryPressure(level);
        this.emit("memory_pressure_handled", {
            level,
            functionId: this.functionId,
        });
    }

    /**
     * Set up event forwarding from components
     */
    private setupEventForwarding(): void {
        // Forward events from security manager
        this.securityManager.on("parameter_encrypted", (data) =>
            this.emit("parameter_encrypted", data)
        );
        this.securityManager.on("encryption_error", (data) =>
            this.emit("encryption_error", data)
        );

        // Forward events from cache manager
        this.cacheManager.on("cache_hit", (data) =>
            this.emit("cache_hit", data)
        );
        this.cacheManager.on("cache_miss", (data) =>
            this.emit("cache_miss", data)
        );
        this.cacheManager.on("cache_cleared", () => this.emit("cache_cleared"));

        // Forward events from stats manager
        this.statsManager.on("stats_updated", (data) =>
            this.emit("stats_updated", data)
        );
        this.statsManager.on("execution_failed", (data) =>
            this.emit("execution_failed", data)
        );

        // Forward events from execution context manager
        this.executionContextManager.on("context_created", (data) =>
            this.emit("context_created", data)
        );
        this.executionContextManager.on("context_cleaned", (data) =>
            this.emit("context_cleaned", data)
        );

        // Forward events from execution engine
        this.executionEngine.on("execution_success", (data) =>
            this.emit("execution_success", data)
        );
        this.executionEngine.on("execution_error", (data) =>
            this.emit("execution_error", data)
        );
    }

    /**
     * Auto-apply optimizations (delegated to ApiManager)
     */
    private autoApplyOptimizations(): void {
        const optimized = this.apiManager.autoApplyOptimizations();
        if (optimized) {
            this.emit("auto_optimization_applied", {
                type: "cache_size_increased",
                functionId: this.functionId,
            });
        }
    }

    /**
     * Get detailed metrics (delegated to components)
     */
    public getDetailedMetrics() {
        if (!this.options.detailedMetrics) return null;

        return {
            stats: this.getStats(),
            cacheStats: this.getCacheStats(),
            analytics: this.getAnalyticsData(),
            suggestions: this.getOptimizationSuggestions(),
            trends: this.getPerformanceTrends(),
            anomalies: this.detectAnomalies(),
            functionId: this.functionId,
            globalMetrics: FortifiedFunctionCore.getGlobalMetrics(),
        };
    }

    /**
     * Update function options dynamically
     */
    public updateOptions(newOptions: Partial<FortifiedFunctionOptions>): void {
        if (this.isDestroyed) {
            throw new Error(
                `Cannot update options on destroyed function: ${this.functionId}`
            );
        }

        Object.assign(this.options, newOptions);
        this.emit("options_updated", {
            functionId: this.functionId,
            newOptions,
        });
    }

    /**
     * Performance timing methods (delegated to TimingManager)
     */
    public startTimer(label: string, metadata?: Record<string, any>): void {
        this.timingManager.startTimer(label, metadata);
    }

    public endTimer(
        label: string,
        additionalMetadata?: Record<string, any>
    ): number {
        return this.timingManager.endTimer(label, additionalMetadata);
    }

    public measureDelay(startPoint: string, endPoint: string): number {
        return this.timingManager.measureDelay(startPoint, endPoint);
    }

    public async timeFunction<U>(
        label: string,
        fn: () => U | Promise<U>,
        metadata?: Record<string, any>
    ): Promise<{ result: U; duration: number }> {
        return await this.timingManager.timeFunction(label, fn, metadata);
    }

    public getTimingStats(): TimingStats {
        return this.timingManager.getTimingStats();
    }

    public clearTimings(): void {
        this.timingManager.clearTimings();
    }

    public getMeasurementsByPattern(pattern: RegExp): any[] {
        return this.timingManager.getMeasurementsByPattern(pattern);
    }

    public isTimerActive(label: string): boolean {
        return this.timingManager.isTimerActive(label);
    }

    public getActiveTimers(): string[] {
        return this.timingManager.getActiveTimers();
    }

    // ===== ADDITIONAL API METHODS (Delegated to ApiManager) =====

    public clearAuditLog(): void {
        this.apiManager.clearAuditLog();
    }
    public getActiveExecutionsCount(): number {
        return this.apiManager.getActiveExecutionsCount();
    }
    public getUltraFastMetrics(): any {
        return this.apiManager.getUltraFastMetrics();
    }
    public optimizePerformance(): void {
        this.apiManager.optimizePerformance();
    }

    /**
     * Enhanced destroy method with comprehensive cleanup
     */
    public destroy(): void {
        if (this.isDestroyed) return;

        fortifiedLogger.info(
            "CORE",
            `Destroying optimized fortified function: ${this.functionId}`
        );

        // Clean up new modular components
        this.executionRouter.destroy();
        this.timingManager.destroy();
        this.apiManager.destroy();

        // Clean up existing components
        this.executionContextManager.destroy();
        this.cacheManager.destroy();
        this.statsManager.destroy();
        this.memoryManager.destroy();
        this.executionEngine.destroy();
        this.securityManager.destroy();

        // Clean up advanced components
        this.performanceMonitor.destroy();
        this.ultraFastEngine.destroy();
        this.ultraFastCache.destroy();
        this.ultraFastAllocator.destroy();

        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Remove from global instances
        FortifiedFunctionCore.instances.delete(this.functionId);
        FortifiedFunctionCore.globalMetrics.totalInstances--;

        // Mark as destroyed
        this.isDestroyed = true;

        this.emit("destroyed", { functionId: this.functionId });
        this.removeAllListeners();

        fortifiedLogger.info(
            "CORE",
            `Destroyed optimized fortified function: ${this.functionId}`
        );
    }

    /**
     * Destroy all instances (cleanup utility)
     */
    public static destroyAll(): void {
        const instances = Array.from(FortifiedFunctionCore.instances.values());
        for (const instance of instances) {
            instance.destroy();
        }

        fortifiedLogger.info(
            "CORE",
            `Destroyed all ${instances.length} optimized fortified function instances`
        );
    }

    /**
     * Get instance count
     */
    public static get instancesSize(): number {
        return FortifiedFunctionCore.instances.size;
    }
}

