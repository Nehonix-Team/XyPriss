/**
 * XyPrissSecurity - Fortified Function Logger
 * Specialized logging system for fortified function operations
 */

import {
    PerformanceMetrics,
    AuditEntry,
    OptimizationSuggestion,
} from "../types/fortified-types";

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    CRITICAL = 4,
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: string;
    message: string;
    metadata?: Record<string, any>;
    executionId?: string;
    performanceData?: Partial<PerformanceMetrics>;
}

/**
 * High-performance logger optimized for fortified function operations
 */
export class FortifiedLogger {
    private static instance: FortifiedLogger;
    private logBuffer: LogEntry[] = [];
    private readonly maxBufferSize = 1000;
    private readonly flushInterval = 5000; // 5 seconds
    private flushTimer?: NodeJS.Timeout;
    private currentLogLevel = LogLevel.INFO;
    private metricsBuffer: PerformanceMetrics[] = [];
    private auditBuffer: AuditEntry[] = [];

    private constructor() {
        this.setupAutoFlush();
    }

    public static getInstance(): FortifiedLogger {
        if (!FortifiedLogger.instance) {
            FortifiedLogger.instance = new FortifiedLogger();
        }
        return FortifiedLogger.instance;
    }

    /**
     * Set the minimum log level
     */
    public setLogLevel(level: LogLevel): void {
        this.currentLogLevel = level;
    }

    /**
     * Log a debug message
     */
    public debug(
        category: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.DEBUG, category, message, metadata);
    }

    /**
     * Log an info message
     */
    public info(
        category: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.INFO, category, message, metadata);
    }

    /**
     * Log a warning message
     */
    public warn(
        category: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.WARN, category, message, metadata);
    }

    /**
     * Log an error message
     */
    public error(
        category: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.ERROR, category, message, metadata);
    }

    /**
     * Log a critical message
     */
    public critical(
        category: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.CRITICAL, category, message, metadata);
    }

    /**
     * Log performance metrics
     */
    public logMetrics(metrics: PerformanceMetrics, executionId?: string): void {
        this.metricsBuffer.push(metrics);

        this.log(LogLevel.DEBUG, "PERFORMANCE", "Metrics recorded", {
            executionTime: metrics.executionTime,
            memoryUsage: metrics.memoryUsage,
            cacheHitRate: metrics.cacheHitRate,
            executionId,
        });

        // Keep buffer size manageable
        if (this.metricsBuffer.length > this.maxBufferSize) {
            this.metricsBuffer = this.metricsBuffer.slice(
                -this.maxBufferSize / 2
            );
        }
    }

    /**
     * Log audit entry
     */
    public logAudit(entry: AuditEntry): void {
        this.auditBuffer.push(entry);

        this.log(LogLevel.INFO, "AUDIT", "Execution audited", {
            executionId: entry.executionId,
            success: entry.success,
            executionTime: entry.executionTime,
            memoryUsage: entry.memoryUsage,
        });

        // Keep buffer size manageable
        if (this.auditBuffer.length > this.maxBufferSize) {
            this.auditBuffer = this.auditBuffer.slice(-this.maxBufferSize / 2);
        }
    }

    /**
     * Log optimization suggestion
     */
    public logOptimization(suggestion: OptimizationSuggestion): void {
        this.log(LogLevel.INFO, "OPTIMIZATION", suggestion.description, {
            type: suggestion.type,
            priority: suggestion.priority,
            expectedImprovement: suggestion.expectedImprovement,
            implementation: suggestion.implementation,
        });
    }

    /**
     * Log execution event
     */
    public logExecution(
        executionId: string,
        event: string,
        duration?: number,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.DEBUG, "EXECUTION", event, {
            executionId,
            duration,
            ...metadata,
        });
    }

    /**
     * Log cache operation
     */
    public logCache(
        operation: "hit" | "miss" | "set" | "evict" | "clear",
        key: string,
        metadata?: Record<string, any>
    ): void {
        this.log(LogLevel.DEBUG, "CACHE", `Cache ${operation}`, {
            key: key.substring(0, 16) + "...",
            operation,
            ...metadata,
        });
    }

    /**
     * Core logging method
     */
    private log(
        level: LogLevel,
        category: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        if (level < this.currentLogLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: performance.now(),
            level,
            category,
            message,
            metadata,
        };

        this.logBuffer.push(entry);

        // Immediate console output for errors and critical messages
        if (level >= LogLevel.ERROR) {
            this.outputToConsole(entry);
        }

        // Auto-flush if buffer is getting full
        if (this.logBuffer.length >= this.maxBufferSize) {
            this.flush();
        }
    }

    /**
     * Output log entry to console
     */
    private outputToConsole(entry: LogEntry): void {
        const levelName = LogLevel[entry.level];
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = `[${timestamp}] [${levelName}] [${entry.category}] ${entry.message}`;

        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(message, entry.metadata);
                break;
            case LogLevel.INFO:
                console.info(message, entry.metadata);
                break;
            case LogLevel.WARN:
                console.warn(message, entry.metadata);
                break;
            case LogLevel.ERROR:
                console.error(message, entry.metadata);
                break;
            case LogLevel.CRITICAL:
                console.error(`🚨 CRITICAL: ${message}`, entry.metadata);
                break;
        }
    }

    /**
     * Flush log buffer
     */
    public flush(): void {
        if (this.logBuffer.length === 0) {
            return;
        }

        // Wemight send logs to a service
        // For now, we'll just output to console for non-error levels
        this.logBuffer
            .filter((entry) => entry.level < LogLevel.ERROR)
            .forEach((entry) => this.outputToConsole(entry));

        this.logBuffer = [];
    }

    /**
     * Setup automatic flushing
     */
    private setupAutoFlush(): void {
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    /**
     * Get recent metrics
     */
    public getRecentMetrics(count = 10): PerformanceMetrics[] {
        return this.metricsBuffer.slice(-count);
    }

    /**
     * Get recent audit entries
     */
    public getRecentAuditEntries(count = 10): AuditEntry[] {
        return this.auditBuffer.slice(-count);
    }

    /**
     * Get recent log entries
     */
    public getRecentLogs(count = 50): LogEntry[] {
        return this.logBuffer.slice(-count);
    }

    /**
     * Clear all buffers
     */
    public clear(): void {
        this.logBuffer = [];
        this.metricsBuffer = [];
        this.auditBuffer = [];
    }

    /**
     * Destroy logger and cleanup
     */
    public destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flush();
        this.clear();
    }
}

// Export singleton instance
export const fortifiedLogger = FortifiedLogger.getInstance();

