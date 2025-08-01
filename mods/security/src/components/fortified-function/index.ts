/***************************************************************************
 * XyPrissSecurity - Secure Array Types
 *
 * This file contains type definitions for the SecureArrayarchitecture
 *
 * @author Nehonix
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

/**
 * XyPrissSecurity - Fortified Functions (Modular Architecture)
 * Main entry point for the fortified function system
 */

// Export all types from the modular system
export type {
    FortifiedFunctionOptions,
    FunctionStats,
    AuditEntry,
    SecureExecutionContext,
    ExecutionEvent,
    CacheEntry,
    SecurityFlags,
    SmartCacheConfig,
    PerformanceMetrics,
    ExecutionPattern,
    OptimizationSuggestion,
    ThreatDetectionResult,
    AnalyticsData,
    AnomalyDetection,
    PredictiveAnalysis,
    EnhancedFortifiedFunction as FortifiedFunctionType,
} from "./core";

// Export main optimized class from modular system (migrated to minimal architecture)
export { FortifiedFunctionCore } from "./core";
export { FortifiedFunctionCore as OptimizedFortifiedFunction } from "./core"; // Backward compatibility

// Export legacy wrapper for backward compatibility
export { FortifiedFunction } from "./fortified-function";

// Export modular components for advanced usage
export * from "./engines";
export * from "./performance";
export * from "./security";
export * from "./utils";

// Import for factory function
import { FortifiedFunctionCore } from "./core";
import { FortifiedFunctionOptions, EnhancedFortifiedFunction } from "./core";

/**
 * Zero-Configuration Smart Function Factory - EXTREME PERFORMANCE EDITION
 *
 * Creates ultra-fast fortified functions with enterprise-grade security,
 * extreme performance optimization, and intelligent caching enabled by default.
 * Optimized for sub-millisecond execution times while maintaining security.
 *
 * @param fn - The function to be fortified with extreme performance capabilities
 * @param options - Optional configuration overrides (performance-first defaults)
 * @returns A fortified function with extreme performance and security features
 *
 * @example
 * ```typescript
 * import { func } from 'xypriss-security';
 *
 * // Zero configuration needed - extreme performance enabled by default
 * const ultraFastFunction = func(async (data: string) => {
 *     return processData(data);
 * });
 *
 * // Execute with sub-millisecond performance
 * const result = await ultraFastFunction('sensitive data');
 *
 * // Optional: Override specific settings if needed
 * const customFunction = func(myFunction, {
 *     ultraFast: "maximum",
 *     maxCacheSize: 10000,
 *     enableJIT: true
 * });
 *
 *
 * const syncFn = func((x: number) => x * 2); // Returns number
 * syncFn(5).toFixed(2); // Type inference works!

 * const asyncFn = func(async (x: number) => x * 2); // Returns Promise<number>
 * asyncFn(5).then((result) => result.toFixed(2)); // Type inference works!
 *
 * ```
 */

export function func<T extends any[], F extends (...args: T) => any>(
    fn: F,
    options: Partial<FortifiedFunctionOptions> = {}
): EnhancedFortifiedFunction<T, ReturnType<F>> {
    // Use the optimized modular system
    const fortifiedFunction = FortifiedFunctionCore.create(fn, {
        // EXTREME PERFORMANCE DEFAULTS
        ultraFast: "maximum",
        autoEncrypt: false, // Disabled for maximum speed, enable if needed
        smartCaching: true,
        predictiveAnalytics: false, // Disabled for speed, enable for analytics
        detailedMetrics: false, // Disabled for speed, enable for monitoring
        enableJIT: true, // NEW: Enable JIT compilation
        enableSIMD: true, // NEW: Enable SIMD optimizations
        enableWebAssembly: true, // NEW: Enable WebAssembly acceleration
        memoryOptimization: "aggressive", // NEW: Aggressive memory optimization
        cacheStrategy: "adaptive", // Adaptive caching for best performance
        maxCacheSize: 5000, // Larger cache for better hit rates
        cacheTTL: 600000, // 10 minutes for better cache utilization
        ...options,
    });

    const enhancedFunc = ((...args: T): ReturnType<F> => {
        return fortifiedFunction.execute(...args) as ReturnType<F>;
    }) as EnhancedFortifiedFunction<T, ReturnType<F>>;

    Object.assign(enhancedFunc, {
        getStats: () => fortifiedFunction.getStats(),
        getAnalyticsData: () => fortifiedFunction.getAnalyticsData(),
        getOptimizationSuggestions: () =>
            fortifiedFunction.getOptimizationSuggestions(),
        getPerformanceTrends: () => fortifiedFunction.getPerformanceTrends(),
        detectAnomalies: () => fortifiedFunction.detectAnomalies(),
        getDetailedMetrics: () => fortifiedFunction.getDetailedMetrics(),
        clearCache: () => fortifiedFunction.clearCache(),
        getCacheStats: () => ({
            hits: fortifiedFunction.getStats().cacheHits,
            misses: fortifiedFunction.getStats().cacheMisses,
            size: fortifiedFunction.getCacheStats().size || 0,
        }),
        warmCache: async (args: T[]) => {
            for (const argSet of args) {
                await fortifiedFunction.execute(...argSet);
            }
        },
        handleMemoryPressure: (level: "low" | "medium" | "high") =>
            fortifiedFunction.handleMemoryPressure(level),
        optimizePerformance: () => {
            fortifiedFunction.warmCache();
            const suggestions = fortifiedFunction.getOptimizationSuggestions();
            suggestions
                .filter(
                    (s) => s.priority === "high" || s.priority === "critical"
                )
                .forEach(() => fortifiedFunction.warmCache());
        },
        updateOptions: (newOptions: Partial<FortifiedFunctionOptions>) =>
            fortifiedFunction.updateOptions(newOptions),
        getConfiguration: () => ({ ...options }),
        startTimer: (label: string, metadata?: Record<string, any>) =>
            fortifiedFunction.startTimer(label, metadata),
        endTimer: (label: string, additionalMetadata?: Record<string, any>) =>
            fortifiedFunction.endTimer(label, additionalMetadata),
        measureDelay: (startPoint: string, endPoint: string) =>
            fortifiedFunction.measureDelay(startPoint, endPoint),
        timeFunction: <U>(
            label: string,
            fn: () => U | Promise<U>,
            metadata?: Record<string, any>
        ) => fortifiedFunction.timeFunction(label, fn, metadata),
        getTimingStats: () => fortifiedFunction.getTimingStats(),
        clearTimings: () => fortifiedFunction.clearTimings(),
        _fortified: fortifiedFunction,
    });

    return enhancedFunc;
}

/**
 * Create a fortified function with full access to smart analytics and optimization
 * Provides complete access to performance metrics, analytics, and optimization features
 *
 * @example
 * ```typescript
 * import { createFortifiedFunction } from 'xypriss-security';
 *
 * const fortified = createFortifiedFunction(myFunction, {
 *     autoEncrypt: true,
 *     smartCaching: true,
 *     predictiveAnalytics: true,
 *     detailedMetrics: true
 * });
 *
 * // Execute
 * const result = await fortified.execute('data');
 *
 * // Access enhanced analytics
 * const analytics = fortified.getAnalyticsData();
 * const suggestions = fortified.getOptimizationSuggestions();
 * const trends = fortified.getPerformanceTrends();
 * const anomalies = fortified.detectAnomalies();
 *
 * // Smart actions
 * fortified.warmCache();
 * fortified.handleMemoryPressure('medium');
 *
 * // Get comprehensive metrics
 * const detailedMetrics = fortified.getDetailedMetrics();
 *
 * // Clean up when done
 * fortified.destroy();
 * ```
 */
export function createFortifiedFunction<T extends any[], R>(
    fn: (...args: T) => R | Promise<R>,
    options: Partial<FortifiedFunctionOptions> = {}
): FortifiedFunctionCore<T, R> {
    return FortifiedFunctionCore.create(fn, options);
}

// Export default as the factory function
export default func;

