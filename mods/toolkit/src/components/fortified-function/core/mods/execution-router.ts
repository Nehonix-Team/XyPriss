/**
 * Execution Router - Modular component for routing execution to appropriate engines
 * Part of the minimal modular architecture
 */

import { FortifiedFunctionOptions } from "../../types/fortified-types";
import { UltraFastEngine } from "../../UFA/ultra-fast-engine";
import { UltraFastCache } from "../../UFA/ultra-fast-cache";
import { PerformanceMonitor } from "../../performance/performance-monitor";
import { generateSafeCacheKey } from "../../serializer/safe-serializer";
import { fortifiedLogger } from "../fortified-logger";

export class ExecutionRouter {
    private readonly ultraFastEngine: UltraFastEngine;
    private readonly ultraFastCache: UltraFastCache<string, any>;
    private readonly performanceMonitor: PerformanceMonitor;
    private readonly functionSignature: string;

    constructor(
        options: Required<FortifiedFunctionOptions>,
        ultraFastEngine: UltraFastEngine,
        ultraFastCache: UltraFastCache<string, any>,
        performanceMonitor: PerformanceMonitor,
        functionSignature: string
    ) {
        this.ultraFastEngine = ultraFastEngine;
        this.ultraFastCache = ultraFastCache;
        this.performanceMonitor = performanceMonitor;
        this.functionSignature = functionSignature;
    }

    /**
     * Execute with ultra-fast engine and all optimizations
     */
    async executeWithUltraFastEngine<T extends any[], R>(
        originalFunction: (...args: T) => R | Promise<R>,
        args: T,
        options: Required<FortifiedFunctionOptions>,
        functionId: string,
        globalMetrics: any
    ): Promise<R> {
        const startTime = performance.now();

        // Check ultra-fast cache first
        if (options.memoize || options.smartCaching) {
            const cacheKey = this.generateOptimizedCacheKey(args);
            const cached = this.ultraFastCache.get(cacheKey);

            if (cached !== null) {
                globalMetrics.totalCacheHits++;
                return cached;
            }
            globalMetrics.totalCacheMisses++;
        }

        // For simple operations, bypass engine overhead
        const fnString = originalFunction.toString();
        const isSimpleOperation =
            fnString.length < 100 &&
            !fnString.includes("await") &&
            !fnString.includes("Promise");

        let result: R | Promise<R>;

        if (isSimpleOperation && !options.enableJIT) {
            // Ultra-fast path: Direct execution for simple operations
            result = originalFunction(...args);
        } else {
            // Optimized path: Use ultra-fast engine for complex operations
            result = this.ultraFastEngine.executeLightning(
                originalFunction,
                args,
                this.functionSignature
            );
        }

        // Resolve promise if needed
        const resolvedResult = result instanceof Promise ? await result : result;

        // Cache result with prediction
        if (options.memoize || options.smartCaching) {
            const cacheKey = this.generateOptimizedCacheKey(args);
            this.ultraFastCache.set(cacheKey, resolvedResult, options.cacheTTL);
        }

        return resolvedResult;
    }

    /**
     * Ultra-fast execution: Bypass all overhead for maximum performance
     */
    async executeUltraFast<T extends any[], R>(
        originalFunction: (...args: T) => R | Promise<R>,
        args: T,
        options: Required<FortifiedFunctionOptions>,
        globalMetrics: any
    ): Promise<R> {
        // Ultra-fast: Direct execution with minimal cache check
        if (options.memoize) {
            const cacheKey = generateSafeCacheKey(args, "ultrafast");
            const cached = this.performanceMonitor.getCachedResult<R>(cacheKey);

            if (cached !== null) {
                globalMetrics.totalCacheHits++;
                return cached;
            }
            globalMetrics.totalCacheMisses++;

            // Execute function directly
            const result = await originalFunction(...args);

            // Simple cache store
            this.performanceMonitor.cacheResult(cacheKey, result, options.cacheTTL);

            return result;
        }

        // Ultra-fast: Direct execution without any overhead
        return await originalFunction(...args);
    }

    /**
     * Generate optimized cache key
     */
    private generateOptimizedCacheKey<T extends any[]>(args: T): string {
        return `${this.functionSignature}:${generateSafeCacheKey(args, "optimized")}`;
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        // Cleanup handled by individual components
        fortifiedLogger.debug("EXECUTION_ROUTER", "Execution router destroyed");
    }
}
