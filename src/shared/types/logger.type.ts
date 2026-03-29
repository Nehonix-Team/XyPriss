const LOG_LEVELS = [
    "silent",
    "error",
    "warn",
    "info",
    "debug",
    "verbose",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_COMPONENTS = [
    "middleware",
    "server",
    "cache",
    "cluster",
    "performance",
    "fileWatcher",
    "plugins",
    "security",
    "monitoring",
    "routes",
    "userApp",
    "typescript",
    "console",
    "other",
    "router",
    "acpes",
    "ipc",
    "memory",
    "lifecycle",
    "routing",
    "xems",
] as const;

export type LogComponent = (typeof LOG_COMPONENTS)[number];

const LOG_TYPES = [
    "startup",
    "warnings",
    "errors",
    "performance",
    "debug",
    "hotReload",
    "portSwitching",
    "lifecycle",
] as const;

export type LogType = (typeof LOG_TYPES)[number];

/**
 * Component-specific logging configuration
 */
export interface ComponentLogConfig {
    /** Enable/disable logging for this component */
    enabled?: boolean;

    /** Override log level for this component */
    level?: LogLevel;

    /** Component-specific type filtering */
    types?: Partial<Record<LogType, boolean>>;

    /** Custom formatter for this component */
    formatter?: (level: LogLevel, message: string, ...args: any[]) => string;

    /** Rate limiting for this component */
    rateLimit?: {
        /** Maximum logs per time window */
        maxLogs?: number;
        /** Time window in milliseconds */
        window?: number;
    };

    /** Pattern-based message filtering */
    suppressPatterns?: (string | RegExp)[];
}

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    component: LogComponent;
    type?: LogType;
    message: string;
    args: any[];
    processId?: number;
    memory?: number;
}

export interface LogBuffer {
    entries: LogEntry[];
    maxSize: number;
    flushInterval: number;
    lastFlush: number;
}

