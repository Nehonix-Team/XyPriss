/**
 * @fileoverview Monitoring-related type definitions for XyPrissJS Express integration
 *
 * This module contains all monitoring-related types including metrics,
 * health checks, alerting, and observability.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

/**
 * Monitoring configuration interface.
 *
 * Comprehensive configuration for system monitoring including
 * health checks, metrics collection, and alerting.
 *
 * @interface MonitoringConfig
 *
 * @example
 * ```typescript
 * const monitoringConfig: MonitoringConfig = {
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
export interface MonitoringConfig {
    /** Enable monitoring */
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
 * Health check configuration interface.
 *
 * Configuration for health check endpoints and monitoring.
 *
 * @interface HealthCheckConfig
 *
 * @example
 * ```typescript
 * const healthCheckConfig: HealthCheckConfig = {
 *   enabled: true,
 *   endpoint: '/health',
 *   interval: 30000, // 30 seconds
 *   timeout: 5000, // 5 seconds
 *   checks: [
 *     {
 *       name: 'database',
 *       check: async () => {
 *         await database.ping();
 *         return { status: 'healthy' };
 *       },
 *       timeout: 3000
 *     },
 *     {
 *       name: 'redis',
 *       check: async () => {
 *         await redis.ping();
 *         return { status: 'healthy' };
 *       },
 *       timeout: 2000
 *     }
 *   ]
 * };
 * ```
 */
export interface HealthCheckConfig {
    /** Enable health checks */
    enabled?: boolean;

    /** Health check endpoint path */
    endpoint?: string;

    /** Health check interval in milliseconds */
    interval?: number;

    /** Health check timeout in milliseconds */
    timeout?: number;

    /** Individual health checks */
    checks?: HealthCheck[];
}

/**
 * Individual health check interface.
 *
 * Definition for a single health check including
 * the check function and configuration.
 *
 * @interface HealthCheck
 *
 * @example
 * ```typescript
 * const databaseHealthCheck: HealthCheck = {
 *   name: 'database',
 *   description: 'PostgreSQL database connection',
 *   check: async () => {
 *     try {
 *       await db.query('SELECT 1');
 *       return {
 *         status: 'healthy',
 *         responseTime: 15,
 *         details: { connectionPool: 'active' }
 *       };
 *     } catch (error) {
 *       return {
 *         status: 'unhealthy',
 *         error: error.message
 *       };
 *     }
 *   },
 *   timeout: 5000,
 *   critical: true
 * };
 * ```
 */
export interface HealthCheck {
    /** Health check name */
    name: string;

    /** Health check description */
    description?: string;

    /** Health check function */
    check: () => Promise<HealthCheckResult>;

    /** Timeout for this check in milliseconds */
    timeout?: number;

    /** Whether this check is critical for overall health */
    critical?: boolean;
}

/**
 * Health check result interface.
 *
 * Result returned by individual health checks.
 *
 * @interface HealthCheckResult
 *
 * @example
 * ```typescript
 * const healthResult: HealthCheckResult = {
 *   status: 'healthy',
 *   responseTime: 25,
 *   details: {
 *     version: '1.2.3',
 *     uptime: 3600000,
 *     connections: 15
 *   },
 *   timestamp: new Date()
 * };
 * ```
 */
export interface HealthCheckResult {
    /** Health status */
    status: "healthy" | "unhealthy" | "degraded";

    /** Response time in milliseconds */
    responseTime?: number;

    /** Additional details */
    details?: Record<string, any>;

    /** Error message if unhealthy */
    error?: string;

    /** Result timestamp */
    timestamp?: Date;
}

/**
 * System metrics interface.
 *
 * Comprehensive system metrics for monitoring
 * and performance analysis.
 *
 * @interface SystemMetrics
 *
 * @example
 * ```typescript
 * const systemMetrics: SystemMetrics = {
 *   timestamp: new Date(),
 *   uptime: 3600000, // 1 hour
 *   memory: {
 *     used: 134217728, // 128MB
 *     total: 536870912, // 512MB
 *     percentage: 0.25,
 *     heap: {
 *       used: 67108864, // 64MB
 *       total: 134217728 // 128MB
 *     }
 *   },
 *   cpu: {
 *     usage: 0.35, // 35%
 *     loadAverage: [0.8, 0.9, 1.1]
 *   },
 *   requests: {
 *     total: 15420,
 *     perSecond: 25.7,
 *     perMinute: 1542,
 *     errors: 23,
 *     errorRate: 0.0015
 *   },
 *   cache: {
 *     hits: 12000,
 *     misses: 3420,
 *     hitRate: 0.78,
 *     size: 52428800 // 50MB
 *   },
 *   network: {
 *     bytesIn: 1048576000, // 1GB
 *     bytesOut: 2097152000, // 2GB
 *     connectionsActive: 150,
 *     connectionsTotal: 15420
 *   }
 * };
 * ```
 */
export interface SystemMetrics {
    /** Metrics timestamp */
    timestamp: Date;

    /** System uptime in milliseconds */
    uptime: number;

    /** Memory metrics */
    memory: {
        /** Used memory in bytes */
        used: number;

        /** Total memory in bytes */
        total: number;

        /** Memory usage percentage (0-1) */
        percentage: number;

        /** Heap memory metrics */
        heap: {
            /** Used heap memory in bytes */
            used: number;

            /** Total heap memory in bytes */
            total: number;
        };
    };

    /** CPU metrics */
    cpu: {
        /** CPU usage percentage (0-1) */
        usage: number;

        /** Load average [1min, 5min, 15min] */
        loadAverage: [number, number, number];
    };

    /** Request metrics */
    requests: {
        /** Total requests processed */
        total: number;

        /** Requests per second */
        perSecond: number;

        /** Requests per minute */
        perMinute: number;

        /** Total errors */
        errors: number;

        /** Error rate (0-1) */
        errorRate: number;
    };

    /** Cache metrics */
    cache: {
        /** Cache hits */
        hits: number;

        /** Cache misses */
        misses: number;

        /** Cache hit rate (0-1) */
        hitRate: number;

        /** Cache size in bytes */
        size: number;
    };

    /** Network metrics */
    network: {
        /** Bytes received */
        bytesIn: number;

        /** Bytes sent */
        bytesOut: number;

        /** Active connections */
        connectionsActive: number;

        /** Total connections handled */
        connectionsTotal: number;
    };
}

/**
 * Alert configuration interface.
 *
 * Configuration for system alerts including conditions,
 * actions, and notification settings.
 *
 * @interface AlertConfig
 *
 * @example
 * ```typescript
 * const alertConfig: AlertConfig = {
 *   name: 'high-memory-usage',
 *   description: 'Alert when memory usage exceeds 85%',
 *   condition: {
 *     metric: 'memory.percentage',
 *     operator: '>',
 *     threshold: 0.85,
 *     duration: 300000 // 5 minutes
 *   },
 *   actions: [
 *     {
 *       type: 'webhook',
 *       target: 'https://alerts.example.com/webhook',
 *       payload: {
 *         severity: 'warning',
 *         service: 'XyPrissjs-server'
 *       }
 *     },
 *     {
 *       type: 'email',
 *       target: 'admin@example.com',
 *       subject: 'High Memory Usage Alert'
 *     }
 *   ],
 *   cooldown: 900000, // 15 minutes
 *   enabled: true
 * };
 * ```
 */
export interface AlertConfig {
    /** Alert name */
    name: string;

    /** Alert description */
    description?: string;

    /** Alert condition */
    condition: AlertCondition;

    /** Actions to take when alert triggers */
    actions: AlertAction[];

    /** Cooldown period in milliseconds */
    cooldown?: number;

    /** Whether alert is enabled */
    enabled?: boolean;
}

/**
 * Alert condition interface.
 *
 * Defines the condition that triggers an alert.
 *
 * @interface AlertCondition
 *
 * @example
 * ```typescript
 * const condition: AlertCondition = {
 *   metric: 'requests.errorRate',
 *   operator: '>',
 *   threshold: 0.05, // 5%
 *   duration: 180000 // 3 minutes
 * };
 * ```
 */
export interface AlertCondition {
    /** Metric path (dot notation) */
    metric: string;

    /** Comparison operator */
    operator: ">" | "<" | ">=" | "<=" | "==" | "!=";

    /** Threshold value */
    threshold: number;

    /** Duration condition must be met in milliseconds */
    duration?: number;
}

/**
 * Alert action interface.
 *
 * Defines an action to take when an alert is triggered.
 *
 * @interface AlertAction
 *
 * @example
 * ```typescript
 * const webhookAction: AlertAction = {
 *   type: 'webhook',
 *   target: 'https://alerts.example.com/webhook',
 *   payload: {
 *     alert: 'high-cpu-usage',
 *     severity: 'critical',
 *     timestamp: new Date().toISOString()
 *   },
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *     'Content-Type': 'application/json'
 *   }
 * };
 * ```
 */
export interface AlertAction {
    /** Action type */
    type: "webhook" | "email" | "log" | "custom";

    /** Target for the action */
    target: string;

    /** Payload to send */
    payload?: Record<string, any>;

    /** Headers for webhook actions */
    headers?: Record<string, string>;

    /** Subject for email actions */
    subject?: string;
}

/**
 * Observability configuration interface.
 *
 * Configuration for observability features including
 * tracing, logging, and metrics export.
 *
 * @interface ObservabilityConfig
 *
 * @example
 * ```typescript
 * const observabilityConfig: ObservabilityConfig = {
 *   tracing: {
 *     enabled: true,
 *     samplingRate: 0.1, // 10%
 *     exporter: 'jaeger',
 *     endpoint: 'http://jaeger:14268/api/traces'
 *   },
 *   metrics: {
 *     enabled: true,
 *     interval: 30000,
 *     exporter: 'prometheus',
 *     endpoint: '/metrics'
 *   },
 *   logging: {
 *     structured: true,
 *     level: 'info',
 *     correlationId: true
 *   }
 * };
 * ```
 */
export interface ObservabilityConfig {
    /** Distributed tracing configuration */
    tracing?: {
        /** Enable tracing */
        enabled?: boolean;

        /** Sampling rate (0-1) */
        samplingRate?: number;

        /** Trace exporter type */
        exporter?: "jaeger" | "zipkin" | "otlp";

        /** Exporter endpoint */
        endpoint?: string;
    };

    /** Metrics export configuration */
    metrics?: {
        /** Enable metrics export */
        enabled?: boolean;

        /** Export interval in milliseconds */
        interval?: number;

        /** Metrics exporter type */
        exporter?: "prometheus" | "statsd" | "custom";

        /** Exporter endpoint */
        endpoint?: string;
    };

    /** Structured logging configuration */
    logging?: {
        /** Enable structured logging */
        structured?: boolean;

        /** Log level */
        level?: "debug" | "info" | "warn" | "error";

        /** Include correlation IDs */
        correlationId?: boolean;
    };
}

