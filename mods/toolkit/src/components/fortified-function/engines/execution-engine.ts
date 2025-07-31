/**
 * XyPrissSecurity - Ultra-Fast Optimized Execution Engine
 * Achieves execution with preserved security features
 */

import { EventEmitter } from "events";
import {
    SecureExecutionContext,
    FortifiedFunctionOptions,
} from "../types/types";
import { SecurityHandler } from "../security/security-handler";
import { PerformanceMonitor } from "../performance/performance-monitor";
// Cache functionality will be provided externally or use fallback
const createOptimalCache = () => new Map();
type SecureCacheAdapter = any;
import { generateSafeCacheKey } from "../serializer/safe-serializer";
import { NehoID } from "nehoid";
import { createSecureArray } from "../../secure-array";
import {
    FUNCTION_CACHE,
    HASH_CACHE,
    EXECUTION_CACHE,
    CONTEXT_POOL,
    ID_POOL,
    BUFFER_POOL,
    STACK_SANITIZE_REGEX,
    PARAM_HASH_REGEX,
} from "../const/exec.const";

export class FuncExecutionEngine extends EventEmitter {
    private readonly securityHandler: SecurityHandler;
    private readonly performanceMonitor: PerformanceMonitor;
    private readonly activeExecutions = new Map<
        string,
        SecureExecutionContext
    >();
    private ultraFastCache?: SecureCacheAdapter;
    private cacheInitialized = false;

    // **ULTRA-FAST OPTIMIZATION: Hot path optimizations**
    private executionCounter = 0;
    private lastCleanup = 0;
    private readonly cleanupInterval = 10000; // 10s

    // **PERFORMANCE MODES**
    private fastMode = true;
    private securityLevel: "minimal" | "standard" | "maximum" = "standard";

    // **ULTRA-FAST OPTIMIZATION: Pre-allocated performance tracking**
    private readonly performanceStats = {
        totalExecutions: 0,
        cacheHits: 0,
        averageTime: 0,
        lastExecutionTime: 0,
    };

    // **ULTRA-FAST OPTIMIZATION: Batch operations**
    private readonly pendingCleanups: string[] = [];
    private cleanupTimer?: NodeJS.Timeout;

    constructor(
        securityHandler: SecurityHandler,
        performanceMonitor: PerformanceMonitor
    ) {
        super();
        this.securityHandler = securityHandler;
        this.performanceMonitor = performanceMonitor;

        // **ULTRA-FAST: Initialize everything synchronously**
        this.initializeFastCache();
        this.preAllocateResources();
        this.startOptimizationLoop();
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Pre-allocate all resources**
     */
    private preAllocateResources(): void {
        // Pre-generate 500 execution IDs for zero-allocation
        const ID_POOL = createSecureArray([] as string[]);

        const b = NehoID.batch({
            count: 500,
            parallel: true,
            ensureUnique: true,
            format: "nano",
        });
        ID_POOL.pushAll(b);

        // Pre-allocate 200 contexts
        for (let i = 0; i < 200; i++) {
            CONTEXT_POOL.push(this.createFastContext());
        }

        // Pre-allocate 100 buffer maps
        for (let i = 0; i < 100; i++) {
            BUFFER_POOL.push(new Map());
        }
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Start background optimization loop**
     */
    private startOptimizationLoop(): void {
        setInterval(() => {
            this.optimizeMemory();
            this.processPendingCleanups();
        }, 5000);
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Memory optimization**
     */
    private optimizeMemory(): void {
        const now = performance.now();

        // Only run expensive cleanup every 10 seconds
        if (now - this.lastCleanup > this.cleanupInterval) {
            // Batch cleanup old executions
            const toDelete: string[] = [];
            for (const [id, context] of this.activeExecutions) {
                if (now - context.startTime > 30000) {
                    // 30s old
                    toDelete.push(id);
                }
            }

            toDelete.forEach((id) => {
                const context = this.activeExecutions.get(id);
                if (context) {
                    this.returnContextToPool(context);
                    this.activeExecutions.delete(id);
                }
            });

            this.lastCleanup = now;
        }

        // Maintain pool sizes
        while (CONTEXT_POOL.length < 50) {
            CONTEXT_POOL.push(this.createFastContext());
        }

        while (ID_POOL.length < 100) {
            ID_POOL.push(`exec_${Date.now()}_${Math.random()}`);
        }
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Process pending cleanups in batches**
     */
    private processPendingCleanups(): void {
        if (this.pendingCleanups.length === 0) return;

        const batch = this.pendingCleanups.splice(0, 10); // Process 10 at a time
        batch.forEach((id) => {
            const context = this.activeExecutions.get(id);
            if (context) {
                this.returnContextToPool(context);
                this.activeExecutions.delete(id);
            }
        });
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Fast cache initialization (sync)**
     */
    private initializeFastCache(): void {
        // Initialize cache without async operations for maximum speed
        try {
            this.ultraFastCache = createOptimalCache(); // Fallback cache without config

            this.cacheInitialized = true;
        } catch (error) {
            console.warn("Fast cache init failed:", error);
            this.cacheInitialized = false;
        }
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Create minimal context**
     */
    private createFastContext(): SecureExecutionContext {
        return {
            executionId: "",
            encryptedParameters: new Map(),
            secureBuffers: new Map(),
            startTime: 0,
            memorySnapshot: 0,
            auditEntry: {
                timestamp: new Date(),
                executionId: "",
                parametersHash: "",
                executionTime: 0,
                memoryUsage: 0,
                success: false,
                securityFlags: [],
            },
        };
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Get context from pool (zero allocation)**
     */
    private getPooledContext(): SecureExecutionContext {
        let context = CONTEXT_POOL.pop();
        if (!context) {
            context = this.createFastContext();
        }

        // Reset context with minimal operations
        context.executionId =
            ID_POOL.pop() || `exec_${++this.executionCounter}`;
        context.startTime = performance.now();
        context.memorySnapshot = 0; // Skip memory calculation for speed
        context.encryptedParameters.clear();
        context.secureBuffers.clear();
        context.auditEntry.executionId = context.executionId;
        context.auditEntry.success = false;
        context.auditEntry.securityFlags.length = 0;
        context.auditEntry.timestamp = new Date();

        return context;
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Return context to pool**
     */
    private returnContextToPool(context: SecureExecutionContext): void {
        if (CONTEXT_POOL.length < 200) {
            // Clean sensitive data
            context.encryptedParameters.clear();
            context.secureBuffers.clear();

            // Return ID to pool
            if (ID_POOL.length < 500) {
                ID_POOL.push(context.executionId);
            }

            CONTEXT_POOL.push(context);
        }
    }

    /**
     * **ULTRA-FAST: Lightning-fast execution (<4ms target)**
     */
    public async executeLightning<T extends any[], R>(
        fn: (...args: T) => R | Promise<R>,
        args: T,
        options: Required<FortifiedFunctionOptions>
    ): Promise<R> {
        const startTime = performance.now();

        // **ULTRA-FAST: Check execution cache first (most likely path)**
        if (options.memoize) {
            const cacheKey = this.generateFastCacheKey(args, fn.name);
            const cached = EXECUTION_CACHE.get(cacheKey);
            if (cached !== undefined) {
                this.performanceStats.cacheHits++;
                this.performanceStats.lastExecutionTime =
                    performance.now() - startTime;
                return cached;
            }
        }

        // **ULTRA-FAST: Skip context creation for minimal security**
        let result: R;
        if (this.securityLevel === "minimal") {
            // Direct execution - fastest path
            result = await fn(...args);
        } else {
            // Standard execution with minimal overhead
            const context = this.getPooledContext();
            this.activeExecutions.set(context.executionId, context);

            try {
                // Execute with minimal security checks
                result = await this.executeWithMinimalSecurity(
                    fn,
                    args,
                    context,
                    options
                );
                context.auditEntry.success = true;
            } catch (error) {
                context.auditEntry.success = false;
                context.auditEntry.errorMessage = (error as Error).message;
                throw error;
            } finally {
                // Schedule cleanup (non-blocking)
                this.scheduleAsyncCleanup(context.executionId);
            }
        }

        // **ULTRA-FAST: Cache result if successful**
        if (options.memoize && result !== undefined) {
            const cacheKey = this.generateFastCacheKey(args, fn.name);
            EXECUTION_CACHE.set(cacheKey, result);

            // Prevent cache from growing too large
            if (EXECUTION_CACHE.size > 1000) {
                const firstKey = EXECUTION_CACHE.keys().next().value;
                if (firstKey !== undefined) {
                    EXECUTION_CACHE.delete(firstKey);
                }
            }
        }

        // **ULTRA-FAST: Update performance stats**
        this.performanceStats.totalExecutions++;
        this.performanceStats.lastExecutionTime = performance.now() - startTime;
        this.performanceStats.averageTime =
            (this.performanceStats.averageTime *
                (this.performanceStats.totalExecutions - 1) +
                this.performanceStats.lastExecutionTime) /
            this.performanceStats.totalExecutions;

        return result;
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Minimal security execution**
     */
    private async executeWithMinimalSecurity<T extends any[], R>(
        fn: (...args: T) => R | Promise<R>,
        args: T,
        context: SecureExecutionContext,
        options: Required<FortifiedFunctionOptions>
    ): Promise<R> {
        // **SECURITY PRESERVED: Parameter hashing (cached)**
        if (options.parameterValidation) {
            // Use safe serialization to handle circular references
            const argsStr = generateSafeCacheKey(args, "hash");
            let hash = HASH_CACHE.get(argsStr);
            if (!hash) {
                hash = await this.securityHandler.hashParameters(args);
                HASH_CACHE.set(argsStr, hash);

                // Prevent hash cache from growing too large
                if (HASH_CACHE.size > 500) {
                    const firstKey = HASH_CACHE.keys().next().value;
                    if (firstKey !== undefined) {
                        HASH_CACHE.delete(firstKey);
                    }
                }
            }
            context.auditEntry.parametersHash = hash;
        }

        // **SECURITY PRESERVED: Timeout protection**
        if (options.timeout > 0) {
            return await Promise.race([
                fn(...args),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(`Timeout after ${options.timeout}ms`)
                            ),
                        options.timeout
                    )
                ),
            ]);
        }

        // **ULTRA-FAST: Direct execution**
        return await fn(...args);
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Fast cache key generation**
     */
    private generateFastCacheKey<T extends any[]>(
        args: T,
        fnName: string
    ): string {
        // Use safe serialization to handle circular references while maintaining speed
        const safeCacheKey = generateSafeCacheKey(args, fnName);
        return safeCacheKey.substring(0, 50 + fnName.length + 1); // Keep reasonable length
    }

    /**
     * **ULTRA-FAST OPTIMIZATION: Non-blocking cleanup scheduling**
     */
    private scheduleAsyncCleanup(executionId: string): void {
        this.pendingCleanups.push(executionId);

        // Process cleanups in next tick to avoid blocking
        if (!this.cleanupTimer) {
            this.cleanupTimer = setTimeout(() => {
                this.processPendingCleanups();
                this.cleanupTimer = undefined;
            }, 0);
        }
    }

    /**
     * **COMPATIBILITY: Maintain existing interface**
     */
    public async createSecureExecutionContext<T extends any[]>(
        args: T,
        options: Required<FortifiedFunctionOptions>
    ): Promise<SecureExecutionContext> {
        const context = this.getPooledContext();

        if (options.parameterValidation) {
            context.auditEntry.parametersHash =
                await this.securityHandler.hashParameters(args);
        }

        this.activeExecutions.set(context.executionId, context);
        this.emit("context_created", { executionId: context.executionId });

        return context;
    }

    /**
     * **COMPATIBILITY: execution with performance optimizations**
     */
    public async executeWithSecurity<T extends any[], R>(
        fn: (...args: T) => R | Promise<R>,
        _context: SecureExecutionContext,
        args: T,
        options: Required<FortifiedFunctionOptions>
    ): Promise<R> {
        // Route to lightning-fast execution for best performance
        return await this.executeLightning(fn, args, options);
    }

    /**
     * **PERFORMANCE MONITORING: Get comprehensive stats**
     */
    public getPerformanceStats(): any {
        return {
            ...this.performanceStats,
            cacheHitRate:
                this.performanceStats.cacheHits /
                this.performanceStats.totalExecutions,
            poolSizes: {
                contexts: CONTEXT_POOL.length,
                ids: ID_POOL.length,
                buffers: BUFFER_POOL.length,
                hashCache: HASH_CACHE.size,
                executionCache: EXECUTION_CACHE.size,
            },
            activeExecutions: this.activeExecutions.size,
            pendingCleanups: this.pendingCleanups.length,
            securityLevel: this.securityLevel,
            fastMode: this.fastMode,
        };
    }

    /**
     * **SECURITY CONFIGURATION: Enable different security levels**
     */
    public setSecurityLevel(level: "minimal" | "standard" | "maximum"): void {
        this.securityLevel = level;
        console.log(`Security level set to: ${level}`);
    }

    /**
     * **CACHE MANAGEMENT: Clear all caches**
     */
    public clearAllCaches(): void {
        EXECUTION_CACHE.clear();
        HASH_CACHE.clear();
        FUNCTION_CACHE.clear();
        console.log("All caches cleared");
    }

    /**
     * **COMPATIBILITY: Legacy methods**
     */
    public enableFastMode(
        level: "minimal" | "standard" | "maximum" = "minimal"
    ): void {
        this.fastMode = true;
        this.securityLevel = level;
    }

    public handleExecutionComplete(
        context: SecureExecutionContext,
        success: boolean,
        error?: Error,
        _options?: Required<FortifiedFunctionOptions>
    ): void {
        // Update performance stats
        this.performanceMonitor.updateStats(context, success);

        if (!success && error) {
            context.auditEntry.errorMessage = error.message;
        }

        // Schedule non-blocking cleanup
        this.scheduleAsyncCleanup(context.executionId);
    }

    public getActiveExecutionsCount(): number {
        return this.activeExecutions.size;
    }

    public cleanupAllExecutions(): void {
        this.activeExecutions.forEach((_, id) => {
            this.scheduleAsyncCleanup(id);
        });
    }

    public async destroy(): Promise<void> {
        // Clear all caches and pools
        this.clearAllCaches();
        CONTEXT_POOL.length = 0;
        ID_POOL.length = 0;
        BUFFER_POOL.length = 0;

        if (this.ultraFastCache) {
            await this.ultraFastCache.disconnect();
        }
    }
}

