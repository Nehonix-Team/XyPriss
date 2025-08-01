/**
 * Key Derivation Logger
 * Professional logging system for key derivation operations
 */

import { KeyDerivationLoggerConfig, KeyDerivationMetrics, AlgorithmBackend, KeyDerivationAlgorithm } from "./keys-types";

/**
 * Log levels for key derivation operations
 */
export enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}

/**
 * Log entry structure
 */
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    component: string;
    message: string;
    data?: any;
    metrics?: KeyDerivationMetrics;
    stackTrace?: string;
}

/**
 * Performance-optimized logger for key derivation operations
 */
export class KeyDerivationLogger {
    private static instance: KeyDerivationLogger;
    private config: KeyDerivationLoggerConfig;
    private logEntries: LogEntry[] = [];
    private metricsBuffer: KeyDerivationMetrics[] = [];

    private constructor(config?: Partial<KeyDerivationLoggerConfig>) {
        this.config = {
            enabled: process.env.NODE_ENV === "development",
            level: "info",
            includeMetrics: true,
            includeStackTrace: false,
            maxLogEntries: 1000,
            ...config
        };
    }

    /**
     * Get singleton instance
     */
    public static getInstance(config?: Partial<KeyDerivationLoggerConfig>): KeyDerivationLogger {
        if (!KeyDerivationLogger.instance) {
            KeyDerivationLogger.instance = new KeyDerivationLogger(config);
        } else if (config) {
            KeyDerivationLogger.instance.updateConfig(config);
        }
        return KeyDerivationLogger.instance;
    }

    /**
     * Update logger configuration
     */
    public updateConfig(config: Partial<KeyDerivationLoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if logging is enabled for a specific level
     */
    private shouldLog(level: LogLevel): boolean {
        if (!this.config.enabled) return false;

        const levels = ["debug", "info", "warn", "error"];
        const currentLevelIndex = levels.indexOf(this.config.level);
        const requestedLevelIndex = levels.indexOf(level);

        return requestedLevelIndex >= currentLevelIndex;
    }

    /**
     * Add log entry to buffer
     */
    private addLogEntry(level: LogLevel, component: string, message: string, data?: any, metrics?: KeyDerivationMetrics): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            component,
            message,
            data,
            metrics: this.config.includeMetrics ? metrics : undefined,
            stackTrace: this.config.includeStackTrace ? new Error().stack : undefined
        };

        this.logEntries.push(entry);

        // Maintain buffer size
        if (this.logEntries.length > this.config.maxLogEntries) {
            this.logEntries.shift();
        }

        // Output to console in development
        if (process.env.NODE_ENV === "development") {
            this.outputToConsole(entry);
        }
    }

    /**
     * Output log entry to console with formatting
     */
    private outputToConsole(entry: LogEntry): void {
        const timestamp = new Date(entry.timestamp).toISOString();
        const prefix = `[${timestamp}] [Keys:${entry.component}]`;
        const message = `${prefix} ${entry.message}`;

        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(message, entry.data || "");
                break;
            case LogLevel.INFO:
                console.info(message, entry.data || "");
                break;
            case LogLevel.WARN:
                console.warn(message, entry.data || "");
                break;
            case LogLevel.ERROR:
                console.error(message, entry.data || "");
                break;
        }

        // Log metrics if available
        if (entry.metrics && this.config.includeMetrics) {
            console.debug(`${prefix} Metrics:`, {
                algorithm: entry.metrics.algorithm,
                backend: entry.metrics.backend,
                executionTime: `${entry.metrics.executionTime}ms`,
                memoryUsage: `${Math.round(entry.metrics.memoryUsage / 1024)}KB`,
                success: entry.metrics.success
            });
        }
    }

    /**
     * Log debug message
     */
    public debug(component: string, message: string, data?: any): void {
        this.addLogEntry(LogLevel.DEBUG, component, message, data);
    }

    /**
     * Log info message
     */
    public info(component: string, message: string, data?: any): void {
        this.addLogEntry(LogLevel.INFO, component, message, data);
    }

    /**
     * Log warning message
     */
    public warn(component: string, message: string, data?: any): void {
        this.addLogEntry(LogLevel.WARN, component, message, data);
    }

    /**
     * Log error message
     */
    public error(component: string, message: string, error?: any): void {
        this.addLogEntry(LogLevel.ERROR, component, message, error);
    }

    /**
     * Log algorithm fallback
     */
    public logFallback(fromAlgorithm: KeyDerivationAlgorithm, toAlgorithm: KeyDerivationAlgorithm, reason: string): void {
        this.warn("Fallback", `Algorithm fallback: ${fromAlgorithm} → ${toAlgorithm}`, { reason });
    }

    /**
     * Log performance metrics
     */
    public logMetrics(metrics: KeyDerivationMetrics): void {
        this.metricsBuffer.push(metrics);
        
        if (metrics.success) {
            this.debug("Performance", `Key derivation completed`, {
                algorithm: metrics.algorithm,
                backend: metrics.backend,
                time: `${metrics.executionTime}ms`,
                memory: `${Math.round(metrics.memoryUsage / 1024)}KB`
            });
        } else {
            this.error("Performance", `Key derivation failed`, {
                algorithm: metrics.algorithm,
                backend: metrics.backend,
                error: metrics.errorMessage
            });
        }
    }

    /**
     * Log algorithm selection
     */
    public logAlgorithmSelection(algorithm: KeyDerivationAlgorithm, backend: AlgorithmBackend, reason: string): void {
        this.debug("Selection", `Selected algorithm: ${algorithm} with backend: ${backend}`, { reason });
    }

    /**
     * Log environment detection
     */
    public logEnvironmentDetection(environment: string, capabilities: any): void {
        this.info("Environment", `Detected environment: ${environment}`, capabilities);
    }

    /**
     * Get recent log entries
     */
    public getLogEntries(count?: number): LogEntry[] {
        const entries = this.logEntries.slice();
        return count ? entries.slice(-count) : entries;
    }

    /**
     * Get performance metrics
     */
    public getMetrics(): KeyDerivationMetrics[] {
        return this.metricsBuffer.slice();
    }

    /**
     * Clear log entries and metrics
     */
    public clear(): void {
        this.logEntries.length = 0;
        this.metricsBuffer.length = 0;
    }

    /**
     * Get logger statistics
     */
    public getStats(): {
        totalEntries: number;
        entriesByLevel: Record<LogLevel, number>;
        metricsCount: number;
        averageExecutionTime: number;
    } {
        const entriesByLevel = {
            [LogLevel.DEBUG]: 0,
            [LogLevel.INFO]: 0,
            [LogLevel.WARN]: 0,
            [LogLevel.ERROR]: 0
        };

        this.logEntries.forEach(entry => {
            entriesByLevel[entry.level]++;
        });

        const successfulMetrics = this.metricsBuffer.filter(m => m.success);
        const averageExecutionTime = successfulMetrics.length > 0
            ? successfulMetrics.reduce((sum, m) => sum + m.executionTime, 0) / successfulMetrics.length
            : 0;

        return {
            totalEntries: this.logEntries.length,
            entriesByLevel,
            metricsCount: this.metricsBuffer.length,
            averageExecutionTime
        };
    }
}

/**
 * Global logger instance
 */
export const keyLogger = KeyDerivationLogger.getInstance();
