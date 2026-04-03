/**
 * @fileoverview Performance-related type definitions for XyPriss integration
 *
 * This module contains all performance-related types including monitoring,
 * optimization, metrics, and configuration.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

/**
 * Performance configuration interface.
 *
 * Comprehensive configuration for performance monitoring,
 * optimization, and metrics collection.
 *
 * @interface PerformanceConfig
 *
 * @example
 * ```typescript
 * const perfConfig: PerformanceConfig = {
 *   enabled: true,
 *   metrics: ['response_time', 'memory_usage', 'cpu_usage'],
 *   interval: 30000, // 30 seconds
 *   alerts: [
 *     {
 *       metric: 'response_time',
 *       threshold: 1000, // 1 second
 *       action: 'log',
 *       cooldown: 300000 // 5 minutes
 *     }
 *   ],
 *   dashboard: true,
 *   export: {
 *     custom: (metrics) => {
 *       console.log('Custom metrics export:', metrics);
 *     }
 *   }
 * };
 * ```
 */
export interface PerformanceConfig {
    /** Enable performance monitoring */
    enabled?: boolean;

    /** Metrics to collect */
    metrics?: string[];

    /** Collection interval in milliseconds */
    interval?: number;

    /** Alert configurations */
    alerts?: AlertConfig[];

    /** Enable performance dashboard */
    dashboard?: boolean;

    /** Export configuration */
    export?: {
        /** Custom export function */
        custom?: (metrics: any) => void;
    };
}

/**
 * Alert configuration interface.
 *
 * Configuration for performance alerts including thresholds,
 * actions, and cooldown periods.
 *
 * @interface AlertConfig
 *
 * @example
 * ```typescript
 * const alertConfig: AlertConfig = {
 *   metric: 'memory_usage',
 *   threshold: 0.85, // 85%
 *   action: 'webhook',
 *   target: 'https://alerts.example.com/webhook',
 *   cooldown: 600000 // 10 minutes
 * };
 * ```
 */
export interface AlertConfig {
    /** Metric name to monitor */
    metric: string;

    /** Threshold value that triggers alert */
    threshold: number;

    /** Action to take when alert triggers */
    action: "log" | "email" | "webhook" | "custom";

    /** Target for the action (email, webhook URL, etc.) */
    target?: string;

    /** Cooldown period in milliseconds */
    cooldown?: number;
}

/**
 * Performance optimization configuration interface.
 *
 * Configuration for various performance optimization features
 * including caching, compression, and request processing.
 *
 * @interface PerformanceOptimizationConfig
 *
 * @example
 * ```typescript
 * const optimizationConfig: PerformanceOptimizationConfig = {
 *   compression: true,
 *   batchSize: 100,
 *   connectionPooling: true,
 *   asyncWrite: true,
 *   prefetch: true,
 *   workers: {
 *     cpu: 4,
 *     io: 8
 *   },
 *   optimizationEnabled: true,
 *   requestClassification: true,
 *   predictivePreloading: true,
 *   aggressiveCaching: true,
 *   parallelProcessing: true,
 *   preCompilerEnabled: true,
 *   learningPeriod: 300000, // 5 minutes
 *   optimizationThreshold: 1000,
 *   aggressiveOptimization: true,
 *   maxCompiledRoutes: 500,
 *   optimizedRulesEnabled: true,
 *   staticRouteOptimization: true,
 *   patternRecognitionEnabled: true,
 *   cacheWarmupEnabled: true,
 *   warmupOnStartup: true,
 *   precomputeCommonResponses: true
 * };
 * ```
 */
export interface PerformanceOptimizationConfig {
    /** Enable engine-level optimizations (default: true) */
    enabled?: boolean;

    /**
     * Execution batch size for bulk operations.
     * Higher values improve throughput but may increase latency.
     * @default 100
     */
    batchSize?: number;

    /**
     * Enable high-performance connection pooling.
     * DRAMATICALLY improves performance for high-concurrency workloads.
     * @default true
     */
    connectionPooling?: boolean;

    /**
     * Enable Engine Intelligence (Pattern Recognition).
     * Enables smart resource management, GC hints, and predictive optimizations.
     * @default false
     */
    intelligence?: boolean;

    /**
     * Pre-allocate system resources at startup.
     * Prevents resource contention during peak loads.
     * @default false
     */
    preAllocate?: boolean;
}

/**
 * Performance metrics interface.
 *
 * Real-time performance metrics for monitoring and
 * optimization purposes.
 *
 * @interface PerformanceMetrics
 *
 * @example
 * ```typescript
 * const metrics: PerformanceMetrics = {
 *   responseTime: {
 *     average: 45.2,
 *     min: 12.1,
 *     max: 156.8,
 *     p95: 89.3,
 *     p99: 134.7
 *   },
 *   throughput: {
 *     requestsPerSecond: 1250,
 *     requestsPerMinute: 75000
 *   },
 *   memory: {
 *     used: 134217728, // 128MB
 *     total: 536870912, // 512MB
 *     percentage: 0.25
 *   },
 *   cpu: {
 *     usage: 0.35, // 35%
 *     loadAverage: [0.8, 0.9, 1.1]
 *   },
 *   cache: {
 *     hitRate: 0.85,
 *     missRate: 0.15,
 *     size: 67108864 // 64MB
 *   },
 *   errors: {
 *     rate: 0.002, // 0.2%
 *     count: 15
 *   }
 * };
 * ```
 */
export interface PerformanceMetrics {
    /** Response time metrics */
    responseTime: {
        /** Average response time in milliseconds */
        average: number;

        /** Minimum response time in milliseconds */
        min: number;

        /** Maximum response time in milliseconds */
        max: number;

        /** 95th percentile response time */
        p95: number;

        /** 99th percentile response time */
        p99: number;
    };

    /** Throughput metrics */
    throughput: {
        /** Requests per second */
        requestsPerSecond: number;

        /** Requests per minute */
        requestsPerMinute: number;
    };

    /** Memory usage metrics */
    memory: {
        /** Used memory in bytes */
        used: number;

        /** Total available memory in bytes */
        total: number;

        /** Memory usage percentage (0-1) */
        percentage: number;
    };

    /** CPU usage metrics */
    cpu: {
        /** CPU usage percentage (0-1) */
        usage: number;

        /** Load average [1min, 5min, 15min] */
        loadAverage: [number, number, number];
    };

    /** Cache performance metrics */
    cache: {
        /** Cache hit rate (0-1) */
        hitRate: number;

        /** Cache miss rate (0-1) */
        missRate: number;

        /** Cache size in bytes */
        size: number;
    };

    /** Error metrics */
    errors: {
        /** Error rate (0-1) */
        rate: number;

        /** Total error count */
        count: number;
    };
}

/**
 * Performance monitoring configuration interface.
 *
 * Configuration for performance monitoring including
 * health checks, metrics collection, and alerting.
 *
 * @interface PerformanceMonitoringConfig
 *
 * @example
 * ```typescript
 * const monitoringConfig: PerformanceMonitoringConfig = {
 *   enabled: true,
 *   healthChecks: true,
 *   metrics: true,
 *   detailed: true,
 *   alertThresholds: {
 *     memoryUsage: 0.85,
 *     hitRate: 0.7,
 *     errorRate: 0.05,
 *     latency: 1000
 *   }
 * };
 * ```
 */
export interface PerformanceMonitoringConfig {
    /** Enable performance monitoring */
    enabled?: boolean;

    /** Enable health checks */
    healthChecks?: boolean;

    /** Enable metrics collection */
    metrics?: boolean;

    /** Enable detailed monitoring */
    detailed?: boolean;

    /** Alert thresholds */
    alertThresholds?: {
        /** Memory usage threshold (0-1) */
        memoryUsage?: number;

        /** Cache hit rate threshold (0-1) */
        hitRate?: number;

        /** Error rate threshold (0-1) */
        errorRate?: number;

        /** Latency threshold in milliseconds */
        latency?: number;
    };
}

/**
 * Performance profiler configuration interface.
 *
 * Configuration for performance profiling including
 * sampling rates and output options.
 *
 * @interface PerformanceProfilerConfig
 *
 * @example
 * ```typescript
 * const profilerConfig: PerformanceProfilerConfig = {
 *   enabled: true,
 *   samplingRate: 0.1, // 10% of requests
 *   includeStackTrace: true,
 *   maxSamples: 10000,
 *   outputFormat: 'json',
 *   outputPath: './performance-profiles'
 * };
 * ```
 */
export interface PerformanceProfilerConfig {
    /** Enable performance profiling */
    enabled?: boolean;

    /** Sampling rate (0-1) */
    samplingRate?: number;

    /** Include stack traces in profiles */
    includeStackTrace?: boolean;

    /** Maximum number of samples to keep */
    maxSamples?: number;

    /** Output format for profiles */
    outputFormat?: "json" | "csv" | "binary";

    /** Output path for profile files */
    outputPath?: string;
}

/**
 * Performance benchmark interface.
 *
 * Structure for performance benchmark results
 * and comparisons.
 *
 * @interface PerformanceBenchmark
 *
 * @example
 * ```typescript
 * const benchmark: PerformanceBenchmark = {
 *   name: 'API Response Time',
 *   baseline: 50.0,
 *   current: 45.2,
 *   improvement: 0.096, // 9.6% improvement
 *   timestamp: new Date(),
 *   samples: 1000,
 *   confidence: 0.95
 * };
 * ```
 */
export interface PerformanceBenchmark {
    /** Benchmark name */
    name: string;

    /** Baseline performance value */
    baseline: number;

    /** Current performance value */
    current: number;

    /** Performance improvement (positive) or regression (negative) */
    improvement: number;

    /** Benchmark timestamp */
    timestamp: Date;

    /** Number of samples used */
    samples: number;

    /** Statistical confidence level */
    confidence: number;
}

