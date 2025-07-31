/**
 * XyPrissSecurity - Fortified Function Types
 * Type definitions for the fortified function system
 */

import { SecureBuffer } from "../..";
import { FortifiedFunction } from "../fortified-function";

export interface FortifiedFunctionOptions {
    // **ULTRA-FAST OPTIMIZATION: Performance mode**
    ultraFast?: boolean | "minimal" | "standard" | "maximum" | undefined;

    // Security Options
    autoEncrypt?: boolean;
    secureParameters?: (string | number)[];
    parameterValidation?: boolean;
    memoryWipeDelay?: number;
    stackTraceProtection?: boolean;
    smartSecurity?: boolean;
    threatDetection?: boolean;

    // Performance Options
    memoize?: boolean;
    /**
     * Timeout in milliseconds. Default is 14 seconds.
     */
    timeout?: number;
    retries?: number;
    maxRetryDelay?: number;
    smartCaching?: boolean;
    cacheStrategy?: "lru" | "lfu" | "adaptive";
    cacheTTL?: number;
    maxCacheSize?: number;
    errorHandling?: "graceful";
    precompile?: boolean;
    optimizeExecution?: boolean;

    // **EXTREME PERFORMANCE OPTIONS**
    enableJIT?: boolean; // Just-In-Time compilation for hot functions
    enableSIMD?: boolean; // Single Instruction Multiple Data optimizations
    enableWebAssembly?: boolean; // WebAssembly acceleration for critical paths
    memoryOptimization?: "none" | "standard" | "aggressive"; // Memory optimization level
    enableVectorization?: boolean; // Vector operations for bulk processing
    enableParallelExecution?: boolean; // Parallel execution for independent operations
    enableZeroCopy?: boolean; // Zero-copy operations where possible
    enableNativeOptimizations?: boolean; // Platform-specific native optimizations
    jitThreshold?: number; // Number of executions before JIT compilation
    simdThreshold?: number; // Data size threshold for SIMD operations

    // Smart Actions
    autoTuning?: boolean;
    predictiveAnalytics?: boolean;
    adaptiveTimeout?: boolean;
    intelligentRetry?: boolean;
    anomalyDetection?: boolean;
    performanceRegression?: boolean;

    // Monitoring Options
    auditLog?: boolean;
    performanceTracking?: boolean;
    debugMode?: boolean;
    detailedMetrics?: boolean;

    // Memory Management
    memoryPool?: boolean;
    maxMemoryUsage?: number;
    autoCleanup?: boolean;
    smartMemoryManagement?: boolean;
    memoryPressureHandling?: boolean;
}

export interface FunctionStats {
    executionCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    memoryUsage: number;
    cacheHits: number;
    cacheMisses: number;
    errorCount: number;
    lastExecuted: Date;
    securityEvents: number;
    // Performance timing data
    timingStats?: TimingStats;
}

// Performance timing interfaces
export interface TimingMeasurement {
    label: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export interface TimingStats {
    totalMeasurements: number;
    completedMeasurements: number;
    activeMeasurements: number;
    measurements: TimingMeasurement[];
    summary: {
        totalDuration: number;
        averageDuration: number;
        minDuration: number;
        maxDuration: number;
        slowestOperation: string;
        fastestOperation: string;
    };
}

export interface AuditEntry {
    timestamp: Date;
    executionId: string;
    parametersHash: string;
    executionTime: number;
    memoryUsage: number;
    success: boolean;
    errorMessage?: string;
    securityFlags: string[];
}

export interface SecureExecutionContext {
    executionId: string;
    encryptedParameters: Map<string, string>;
    secureBuffers: Map<string, SecureBuffer>;
    startTime: number;
    memorySnapshot: number;
    auditEntry: AuditEntry;
}

export interface ExecutionEvent {
    executionId: string;
    timestamp: Date;
    type: "start" | "success" | "error" | "timeout" | "retry";
    data?: any;
}

export interface CacheEntry<R> {
    result: R;
    timestamp: number;
    accessCount: number;
    lastAccessed: Date;
    ttl?: number;
    priority?: number;
    size?: number;
    frequency?: number;
}

export interface SecurityFlags {
    encrypted: boolean;
    audited: boolean;
    memoryManaged: boolean;
    stackProtected: boolean;
}

// New interfaces for enhanced functionality
export interface SmartCacheConfig {
    strategy: "lru" | "lfu" | "adaptive";
    maxSize: number;
    ttl: number;
    autoCleanup: boolean;
    compressionEnabled: boolean;
    persistToDisk: boolean;
    adaptationThreshold?: number;
    memoryCheckInterval?: number;
    maxMemoryUsage?: number;
}

export interface PerformanceMetrics {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
    cacheHitRate: number;
    errorRate: number;
    throughput: number;
    latency: number;
}

export interface ExecutionPattern {
    parametersHash: string;
    frequency: number;
    averageExecutionTime: number;
    lastExecuted: Date;
    predictedNextExecution?: Date;
    cacheWorthiness: number;
}

export interface OptimizationSuggestion {
    type: "cache" | "timeout" | "retry" | "memory" | "security";
    priority: "low" | "medium" | "high" | "critical";
    description: string;
    expectedImprovement: number;
    implementation: string;
}

export interface ThreatDetectionResult {
    threatLevel: "none" | "low" | "medium" | "high" | "critical";
    threats: string[];
    recommendations: string[];
    blocked: boolean;
}

export interface AnalyticsData {
    patterns: ExecutionPattern[];
    trends: PerformanceMetrics[];
    anomalies: AnomalyDetection[];
    predictions: PredictiveAnalysis[];
}

export interface AnomalyDetection {
    type: "performance" | "memory" | "security" | "error";
    severity: "low" | "medium" | "high";
    description: string;
    timestamp: Date;
    metrics: Record<string, number>;
}

export interface PredictiveAnalysis {
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: number;
    trend: "increasing" | "decreasing" | "stable";
}

/**
 * Enhanced function type that provides access to FortifiedFunction methods
 * while maintaining the original function signature
 */
export interface EnhancedFortifiedFunction<T extends any[], R> {
    (...args: T): R;
    getStats(): any;
    getAnalyticsData(): any;
    getOptimizationSuggestions(): any[];
    getPerformanceTrends(): any;
    detectAnomalies(): any[];
    getDetailedMetrics(): any;
    clearCache(): void;
    getCacheStats(): { hits: number; misses: number; size: number };
    warmCache(args: T[]): Promise<void>;
    handleMemoryPressure(level: "low" | "medium" | "high"): void;
    optimizePerformance(): void;
    updateOptions(newOptions: Partial<FortifiedFunctionOptions>): void;
    getConfiguration(): Partial<FortifiedFunctionOptions>;
    startTimer(label: string, metadata?: Record<string, any>): void;
    endTimer(label: string, additionalMetadata?: Record<string, any>): void;
    measureDelay(startPoint: string, endPoint: string): number;
    timeFunction<U>(
        label: string,
        fn: () => U | Promise<U>,
        metadata?: Record<string, any>
    ): Promise<U>;
    getTimingStats(): any;
    clearTimings(): void;
    _fortified: FortifiedFunction<T, R>;
}

// ======================================= src\utils\fortified-function\ultra-fast-allocator.ts allocator types ========================

// Lightweight allocation metadata - only essential information
export interface AllocationMetadata {
    poolIndex: number;
    blockIndex: number;
    size: number;
}

// Optimized memory pool structure
export interface MemoryPool {
    buffer: ArrayBuffer;
    view: Uint8Array;
    allocated: Uint32Array; // Bitfield for allocated blocks (32 blocks per uint32)
    blockSize: number;
    totalBlocks: number;
    freeBlocks: number;
    nextFree: number;
    name: string;
}

// Pool configurations optimized for common allocation patterns
export const POOL_CONFIGS = [
    { name: "tiny", blockSize: 32, totalBlocks: 2048 }, // 64KB - small objects
    { name: "small", blockSize: 128, totalBlocks: 1024 }, // 128KB - common allocations
    { name: "medium", blockSize: 1024, totalBlocks: 512 }, // 512KB - medium objects
    { name: "large", blockSize: 4096, totalBlocks: 256 }, // 1MB - large objects
] as const;

// ======================================= allocator types ========================

// ======================================= src\utils\fortified-function\ultra-fast-cache.ts types ===========================

// **PERFORMANCE: Cache entry with prediction metadata**
export interface UltraFastCacheEntry<T> {
    value: T;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    accessPattern: number[]; // Last 5 access times (reduced from 10)
    predictedNextAccess: number;
    priority: number;
    size: number;
    compressed?: boolean;
    ttl?: number;
}

// **PERFORMANCE: Access pattern analysis**
export interface AccessPattern {
    key: string;
    frequency: number;
    periodicity: number;
    trend: "increasing" | "decreasing" | "stable";
    confidence: number;
}

// **PERFORMANCE: Cache statistics**
export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    predictions: number;
    correctPredictions: number;
    compressions: number;
    decompressions: number;
    totalOperations: number;
    avgAccessTime: number;
    hitRate: string;
    predictionAccuracy: string;
    cacheSize: number;
    memoryUsage: number;
    memoryUtilization: string;
    hotKeys: number;
    coldKeys: number;
    patterns: number;
}

export interface FortifiedFunctionOptions {
    // Security Options
    autoEncrypt?: boolean;
    secureParameters?: (string | number)[];
    memoryWipeDelay?: number;
    stackTraceProtection?: boolean;

    // Performance Options
    memoize?: boolean;
    timeout?: number;
    retries?: number;
    maxRetryDelay?: number;

    // Monitoring Options
    auditLog?: boolean;
    performanceTracking?: boolean;
    debugMode?: boolean;

    // Memory Management
    memoryPool?: boolean;
    maxMemoryUsage?: number;
    autoCleanup?: boolean;
}

export interface FunctionStats {
    executionCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    memoryUsage: number;
    cacheHits: number;
    cacheMisses: number;
    errorCount: number;
    lastExecuted: Date;
    securityEvents: number;
}

export interface AuditEntry {
    timestamp: Date;
    executionId: string;
    parametersHash: string;
    executionTime: number;
    memoryUsage: number;
    success: boolean;
    errorMessage?: string;
    securityFlags: string[];
}

export interface SecureExecutionContext {
    executionId: string;
    encryptedParameters: Map<string, string>;
    secureBuffers: Map<string, SecureBuffer>;
    startTime: number;
    memorySnapshot: number;
    auditEntry: AuditEntry;
}

export interface CacheEntry<R> {
    result: R;
    timestamp: number;
}

export interface ExecutionEvent {
    executionId: string;
    attempt?: number;
    error?: Error;
    cacheKey?: string;
    memoryUsage?: number;
}

export interface SecurityEvent {
    parameter: number;
    error: Error;
}

export interface CleanupEvent {
    executionId: string;
}

