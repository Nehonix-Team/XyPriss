/**
 * Centralized Logger for FastApi.ts Server
 * Provides granular control over logging output with enhanced robustness
 */
import { LogLevel, LogComponent, LogType, LogBuffer, LogEntry } from "../types";
import { ServerOptions } from "../../src/types/types";

export class Logger {
    private config: ServerOptions["logging"];
    private static instance: Logger;
    private buffer!: LogBuffer;
    private flushTimer?: NodeJS.Timeout;
    private isDisposed = false;
    private logQueue: LogEntry[] = [];
    private isProcessingQueue = false;
    private errorCount = 0;
    private lastErrorTime = 0;
    private suppressedComponents = new Set<LogComponent>();

    constructor(config?: ServerOptions["logging"]) {
        const defaultConfig = {
            enabled: true,
            level: "info" as const,
            components: {
                server: true,
                cache: true,
                cluster: true,
                performance: true,
                fileWatcher: true,
                plugins: true,
                security: true,
                monitoring: true,
                routes: true,
                userApp: true,
                console: false, // Console interception system logs (can be verbose)
                ipc: true, // Inter-process communication logs
                memory: true, // Memory monitoring and detection logs
                lifecycle: true, // Server lifecycle management logs
                routing: true, // Fast routing system logs
                middleware: true,
                router: true,
                typescript: true,
                acpes: true,
                other: true,
            },
            types: {
                startup: true,
                warnings: true,
                errors: true,
                performance: true,
                debug: false,
                hotReload: true,
                portSwitching: true,
                lifecycle: true,
            },
            format: {
                timestamps: false,
                colors: true,
                prefix: true,
                compact: false,
                includeMemory: false,
                includeProcessId: false,
                maxLineLength: 0, // 0 = no limit
            },
            buffer: {
                enabled: false,
                maxSize: 1000,
                flushInterval: 5000,
                autoFlush: true,
            },
            errorHandling: {
                maxErrorsPerMinute: 100,
                suppressRepeatedErrors: true,
                suppressAfterCount: 5,
                resetSuppressionAfter: 300000, // 5 minutes
            },
        };

        this.config = this.deepMerge(defaultConfig, config || {});
        this.initializeBuffer();
        this.setupErrorHandling();
    }

    /**
     * Initialize log buffer system
     */
    private initializeBuffer(): void {
        this.buffer = {
            entries: [],
            maxSize: this.config?.buffer?.maxSize || 1000,
            flushInterval: this.config?.buffer?.flushInterval || 5000,
            lastFlush: Date.now(),
        };

        if (this.config?.buffer?.enabled && this.config?.buffer?.autoFlush) {
            this.startAutoFlush();
        }
    }

    /**
     * Setup error handling and recovery mechanisms
     */
    private setupErrorHandling(): void {
        // Reset error count periodically
        setInterval(() => {
            this.errorCount = 0;
            this.lastErrorTime = 0;

            // Reset suppressed components if enough time has passed
            const resetTime =
                this.config?.errorHandling?.resetSuppressionAfter || 300000;
            if (Date.now() - this.lastErrorTime > resetTime) {
                this.suppressedComponents.clear();
            }
        }, 60000); // Every minute

        // Handle uncaught exceptions gracefully
        if (typeof process !== "undefined") {
            process.on("uncaughtException", (error) => {
                this.emergencyLog(
                    "error",
                    "server",
                    "Uncaught Exception",
                    error.message,
                    error.stack
                );
            });

            process.on("unhandledRejection", (reason, promise) => {
                this.emergencyLog(
                    "error",
                    "server",
                    "Unhandled Promise Rejection",
                    reason,
                    promise
                );
            });
        }
    }

    /**
     * Emergency logging that bypasses normal filtering
     */
    private emergencyLog(
        level: LogLevel,
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        try {
            const timestamp = new Date().toISOString();
            const formatted = `[EMERGENCY] ${timestamp} [${component.toUpperCase()}] ${message}`;
            console.error(formatted, ...args);
        } catch (error) {
            // Last resort - write to stderr directly
            if (typeof process !== "undefined" && process.stderr) {
                process.stderr.write(`[LOGGER_FAILURE] ${message}\n`);
            }
        }
    }

    /**
     * Start auto-flush timer for buffered logging
     */
    private startAutoFlush(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.buffer.flushInterval);
    }

    /**
     * Flush buffered log entries
     */
    public flush(): void {
        if (this.buffer.entries.length === 0) return;

        const entries = [...this.buffer.entries];
        this.buffer.entries = [];
        this.buffer.lastFlush = Date.now();

        entries.forEach((entry) => {
            this.writeLog(entry);
        });
    }

    /**
     * Get or create singleton instance
     */
    public static getInstance(config?: ServerOptions["logging"]): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        } else if (config) {
            Logger.instance.updateConfig(config);
        }
        return Logger.instance;
    }

    /**
     * Deep merge two objects
     */
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

    /**
     * Update logger configuration
     */
    public updateConfig(config: ServerOptions["logging"]): void {
        const oldConfig = this.config;
        this.config = this.deepMerge(this.config, config || {});

        // Restart buffer if configuration changed
        if (
            oldConfig?.buffer?.enabled !== this.config?.buffer?.enabled ||
            oldConfig?.buffer?.autoFlush !== this.config?.buffer?.autoFlush
        ) {
            this.initializeBuffer();
        }
    }

    /**
     * Get current logger configuration (for debugging)
     */
    public getConfig(): ServerOptions["logging"] {
        return this.config;
    }

    /**
     * Check if we should suppress this log due to error rate limiting
     */
    private shouldSuppressError(component: LogComponent): boolean {
        if (!this.config?.errorHandling?.suppressRepeatedErrors) return false;

        const maxErrors = this.config?.errorHandling?.maxErrorsPerMinute || 100;
        const suppressAfter =
            this.config?.errorHandling?.suppressAfterCount || 5;

        const now = Date.now();

        // Reset counter if more than a minute has passed
        if (now - this.lastErrorTime > 60000) {
            this.errorCount = 0;
            this.suppressedComponents.clear();
        }

        this.errorCount++;
        this.lastErrorTime = now;

        if (this.errorCount > maxErrors) {
            this.suppressedComponents.add(component);
            return true;
        }

        return this.suppressedComponents.has(component);
    }

    /**
     * Check if logging is enabled for a specific component and type
     */
    private shouldLog(
        level: LogLevel,
        component: LogComponent,
        type?: LogType,
        message?: string
    ): boolean {
        // Emergency bypass
        if (this.isDisposed) return false;

        // Master switch
        if (!this.config?.enabled) return false;

        // Check for error suppression
        if (level === "error" && this.shouldSuppressError(component)) {
            return false;
        }

        // Silent mode
        // if (this.config?.level === "silent") return false;

        // Always show errors unless silent or suppressed
        if (
            level === "error" &&
            this.config?.level &&
            this.config?.level !== "silent"
        ) {
            return true;
        }

        // Check component-specific level override
        const componentConfig = this.config?.componentLevels?.[component];
        let effectiveLevel = this.config?.level!;

        if (componentConfig) {
            if (typeof componentConfig === "string") {
                effectiveLevel = componentConfig;
            } else if (
                typeof componentConfig === "object" &&
                componentConfig.level
            ) {
                effectiveLevel = componentConfig.level;

                // Check pattern-based message filtering
                if (message && componentConfig.suppressPatterns) {
                    for (const pattern of componentConfig.suppressPatterns) {
                        if (typeof pattern === "string") {
                            if (message.includes(pattern)) {
                                return false;
                            }
                        } else if (pattern instanceof RegExp) {
                            if (pattern.test(message)) {
                                return false;
                            }
                        }
                    }
                }

                // Check component-specific type filtering
                if (
                    type &&
                    componentConfig.types &&
                    componentConfig.types[type] === false
                ) {
                    return false;
                }

                // Check if component is disabled
                if (componentConfig.enabled === false) {
                    return false;
                }
            }
        }

        // Check log level hierarchy
        const levels: LogLevel[] = [
            "error",
            "warn",
            "info",
            "debug",
            "verbose",
        ];
        const currentLevelIndex = levels.indexOf(effectiveLevel);
        const messageLevelIndex = levels.indexOf(level);

        if (messageLevelIndex > currentLevelIndex) return false;

        // Check component-specific settings (legacy support)
        if (
            this.config?.components &&
            this.config?.components[component] === false
        ) {
            return false;
        }

        // Check type-specific settings
        if (type && this.config?.types && this.config?.types[type] === false) {
            return false;
        }

        return true;
    }

    /**
     * Get memory usage information
     */
    private getMemoryInfo(): number | undefined {
        if (!this.config?.format?.includeMemory) return undefined;

        try {
            if (typeof process !== "undefined" && process.memoryUsage) {
                return Math.round(process.memoryUsage().heapUsed / 1024 / 1024); // MB
            }
        } catch (error) {
            // Ignore memory info errors
        }
        return undefined;
    }

    /**
     * Get process ID
     */
    private getProcessId(): number | undefined {
        if (!this.config?.format?.includeProcessId) return undefined;

        try {
            if (typeof process !== "undefined" && process.pid) {
                return process.pid;
            }
        } catch (error) {
            // Ignore process ID errors
        }
        return undefined;
    }

    /**
     * Truncate message if it exceeds max line length
     */
    private truncateMessage(message: string): string {
        const maxLength = this.config?.format?.maxLineLength || 0;
        if (maxLength === 0 || message.length <= maxLength) {
            return message;
        }

        return message.substring(0, maxLength - 3) + "...";
    }
    /**
     * Format log message
     */
    private formatMessage(
        level: LogLevel,
        component: LogComponent,
        message: string
    ): string {
        const clrs = {
            green: "\x1b[32m",
            red: "\x1b[31m",
            yellow: "\x1b[33m",
            blue: "\x1b[34m",
            cyan: "\x1b[36m",
            reset: "\x1b[0m",
            bold: "\x1b[1m",
            magenta: "\x1b[35m",
        };

        const colors = {
            error: clrs.red, // Red
            warn: clrs.yellow, // Yellow
            info: clrs.cyan, // Cyan
            debug: clrs.magenta, // Magenta
            verbose: clrs.bold, // White
            reset: "\x1b[0m", // Reset
            sys: clrs.green,
        };
        let formatted = message;

        if (this.config?.format?.prefix && !this.config?.format?.compact) {
            const prefix = `[${
                component === "server"
                    ? "SYSTEM".toUpperCase()
                    : component === "cache"
                    ? "SIMC".toUpperCase()
                    : component.toUpperCase()
            }]`;
            if (level === "silent") {
                formatted = `${prefix} ${message}`;
            } else {
                if (component === "server") {
                    const color = colors[level] || colors.info;
                    formatted = `${colors.sys}${prefix}${colors.reset} ${color}${message}${colors.reset}`;
                } else {
                    formatted = `${prefix} ${message}`;
                }
            }
        }

        if (this.config?.format?.timestamps) {
            const timestamp = new Date().toISOString();
            formatted = `${timestamp} ${formatted}`;
        }

        if (
            this.config?.format?.colors &&
            level !== "silent" &&
            typeof process !== "undefined" &&
            process.stdout?.isTTY
        ) {
            const color = colors[level] || colors.info;
            formatted = `${color}${formatted}${colors.reset}`;
        }

        return formatted;
    }

    /**
     * Write log entry to output
     */
    private writeLog(entry: LogEntry): void {
        try {
            if (this.config?.customLogger) {
                this.config.customLogger(
                    entry.level,
                    entry.component,
                    entry.message,
                    ...entry.args
                );
                return;
            }

            const formatted = this.formatMessage(
                entry.level,
                entry.component,
                entry.message
                // entry
            );

            switch (entry.level) {
                case "error":
                    console.error(formatted, ...entry.args);
                    break;
                case "warn":
                    console.warn(formatted, ...entry.args);
                    break;
                default:
                    console.log(formatted, ...entry.args);
                    break;
            }
        } catch (error) {
            this.emergencyLog("error", "server", "Logger write failed", error);
        }
    }

    /**
     * Process log queue
     */
    private processLogQueue(): void {
        if (this.isProcessingQueue || this.logQueue.length === 0) return;

        this.isProcessingQueue = true;

        try {
            while (this.logQueue.length > 0) {
                const entry = this.logQueue.shift()!;

                if (this.config?.buffer?.enabled) {
                    this.buffer.entries.push(entry);

                    if (this.buffer.entries.length >= this.buffer.maxSize) {
                        this.flush();
                    }
                } else {
                    this.writeLog(entry);
                }
            }
        } catch (error) {
            this.emergencyLog(
                "error",
                "server",
                "Log queue processing failed",
                error
            );
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Log a message
     */
    private log(
        level: LogLevel,
        component: LogComponent,
        type: LogType | undefined,
        message: string,
        ...args: any[]
    ): void {
        try {
            if (!this.shouldLog(level, component, type, message)) return;

            const entry: LogEntry = {
                timestamp: new Date(),
                level,
                component,
                type,
                message,
                args,
                processId: this.getProcessId(),
                memory: this.getMemoryInfo(),
            };

            this.logQueue.push(entry);

            // Process queue
            this.processLogQueue();
        } catch (error) {
            this.emergencyLog("error", "server", "Logging failed", error);
        }
    }

    // Public logging methods
    public error(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("error", component, "errors", message, ...args);
    }

    public warn(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("warn", component, "warnings", message, ...args);
    }

    public info(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, undefined, message, ...args);
    }

    public debug(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("debug", component, "debug", message, ...args);
    }

    public verbose(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("verbose", component, "debug", message, ...args);
    }

    public startup(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "startup", message, ...args);
    }

    public performance(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "performance", message, ...args);
    }

    public hotReload(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "hotReload", message, ...args);
    }

    public portSwitching(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "portSwitching", message, ...args);
    }

    public securityWarning(message: string, ...args: any[]): void {
        this.log("warn", "security", "warnings", message, ...args);
    }

    // Utility methods
    public isEnabled(): boolean {
        return this.config?.enabled || false;
    }

    public getLevel(): LogLevel {
        return this.config?.level || "info";
    }

    public isComponentEnabled(component: LogComponent): boolean {
        const componentConfig = this.config?.componentLevels?.[component];

        if (componentConfig && typeof componentConfig === "object") {
            return componentConfig.enabled !== false;
        }

        return this.config?.components?.[component] !== false;
    }

    public isTypeEnabled(type: LogType): boolean {
        return this.config?.types?.[type] !== false;
    }

    /**
     * Get logging statistics
     */
    public getStats(): {
        errorCount: number;
        lastErrorTime: number;
        suppressedComponents: string[];
        bufferSize: number;
        queueSize: number;
    } {
        return {
            errorCount: this.errorCount,
            lastErrorTime: this.lastErrorTime,
            suppressedComponents: Array.from(this.suppressedComponents),
            bufferSize: this.buffer.entries.length,
            queueSize: this.logQueue.length,
        };
    }

    /**
     * Clear suppressed components
     */
    public clearSuppression(): void {
        this.suppressedComponents.clear();
        this.errorCount = 0;
        this.lastErrorTime = 0;
    }

    /**
     * Dispose logger and cleanup resources
     */
    public dispose(): void {
        this.isDisposed = true;

        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }

        // Final flush
        this.flush();

        // Process remaining queue
        if (this.logQueue.length > 0) {
            this.logQueue.forEach((entry) => this.writeLog(entry));
            this.logQueue = [];
        }
    }

    /**
     * Create a child logger with component-specific configuration
     */
    public child(
        component: LogComponent,
        config?: Partial<ServerOptions["logging"]>
    ): Logger {
        const childConfig = this.deepMerge(this.config, config || {});
        return new Logger(childConfig);
    }
}

/**
 * Global logger instance
 */
export const logger = Logger.getInstance();

/**
 * Initialize logger with configuration
 */
export function initializeLogger(config?: ServerOptions["logging"]): Logger {
    return Logger.getInstance(config);
}

/**
 * Cleanup function for graceful shutdown
 */
export function cleanupLogger(): void {
    if (Logger.getInstance()) {
        Logger.getInstance().dispose();
    }
}

