/**
 * Inter-Process Communication Types for Cluster Service
 * Defines interfaces and types for IPC between master and worker processes
 */

/**
 * IPC Message interface for communication between master and workers
 */
export interface IPCMessage {
    id: string;
    type: string;
    data: any;
    timestamp: number;
    from: "master" | "worker";
    to?: string; // Specific worker ID, or undefined for broadcast
    correlationId?: string; // For request-response patterns
}

/**
 * IPC Response interface for request-response communication
 */
export interface IPCResponse {
    id: string;
    correlationId: string;
    success: boolean;
    data?: any;
    error?: string;
    timestamp: number;
}

/**
 * Worker connection information for IPC management
 */
export interface WorkerConnection {
    id: string;
    subprocess: any; // Bun subprocess or Node.js worker
    isAlive: boolean;
    lastPing: number;
    messageQueue: IPCMessage[];
}

/**
 * IPC Configuration options
 */
export interface IPCConfig {
    enabled?: boolean;
    broadcast?: boolean;
    timeout?: number; // Message timeout in milliseconds
    heartbeatInterval?: number; // Heartbeat interval in milliseconds
    maxMessageSize?: string; // Maximum message size (e.g., "1MB")
    compression?: boolean; // Enable message compression
    encryption?: boolean; // Enable message encryption
    retryAttempts?: number; // Number of retry attempts for failed messages
    retryDelay?: number; // Delay between retry attempts
}

/**
 * IPC Statistics for monitoring
 */
export interface IPCStats {
    totalMessages: number;
    successfulMessages: number;
    failedMessages: number;
    averageResponseTime: number;
    activeConnections: number;
    messageQueue: number;
    lastActivity: number;
}

/**
 * IPC Event types
 */
export interface IPCEvents {
    message: (message: IPCMessage) => void;
    response: (response: IPCResponse) => void;
    worker_connected: (workerId: string) => void;
    worker_disconnected: (workerId: string) => void;
    worker_timeout: (workerId: string) => void;
    message_timeout: (messageId: string) => void;
    error: (error: Error) => void;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: IPCMessage) => Promise<any>;

/**
 * Standard IPC message types used by the cluster system
 */
export const IPC_MESSAGE_TYPES = {
    // System messages
    PING: "ping",
    PONG: "pong",
    HEARTBEAT: "heartbeat",
    SHUTDOWN: "shutdown",
    RESTART: "restart",

    // Application messages
    APP_MESSAGE: "app_message",
    BROADCAST: "broadcast",
    TASK: "task",
    RESULT: "result",

    // Health and monitoring
    HEALTH_CHECK: "health_check",
    METRICS_REQUEST: "metrics_request",
    METRICS_RESPONSE: "metrics_response",
    STATUS_UPDATE: "status_update",

    // Configuration
    CONFIG_UPDATE: "config_update",
    CONFIG_REQUEST: "config_request",

    // Error handling
    ERROR: "error",
    WARNING: "warning",

    // Load balancing
    LOAD_REPORT: "load_report",
    CAPACITY_UPDATE: "capacity_update",

    // Custom application messages
    CUSTOM: "custom",
} as const;

/**
 * IPC message type union
 */
export type IPCMessageType =
    (typeof IPC_MESSAGE_TYPES)[keyof typeof IPC_MESSAGE_TYPES];

/**
 * IPC Error types
 */
export class IPCError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = "IPCError";
    }
}

export class IPCTimeoutError extends IPCError {
    constructor(messageId: string, timeout: number) {
        super(
            `IPC message ${messageId} timed out after ${timeout}ms`,
            "IPC_TIMEOUT",
            { messageId, timeout }
        );
        this.name = "IPCTimeoutError";
    }
}

export class IPCConnectionError extends IPCError {
    constructor(workerId: string, reason: string) {
        super(
            `IPC connection error for worker ${workerId}: ${reason}`,
            "IPC_CONNECTION_ERROR",
            { workerId, reason }
        );
        this.name = "IPCConnectionError";
    }
}

/**
 * Default IPC configuration values
 */
export const DEFAULT_IPC_CONFIG: Required<IPCConfig> = {
    enabled: true,
    broadcast: true,
    timeout: 30000, // 30 seconds
    heartbeatInterval: 15000, // 15 seconds
    maxMessageSize: "1MB",
    compression: false,
    encryption: false,
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
};

/**
 * IPC limits and constraints
 */
export const IPC_LIMITS = {
    MAX_MESSAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_QUEUE_SIZE: 1000,
    MAX_WORKERS: 100,
    MAX_TIMEOUT: 300000, // 5 minutes
    MIN_TIMEOUT: 1000, // 1 second
    MAX_HEARTBEAT_INTERVAL: 60000, // 1 minute
    MIN_HEARTBEAT_INTERVAL: 1000, // 1 second
    MAX_RETRY_ATTEMPTS: 10,
    MAX_RETRY_DELAY: 30000, // 30 seconds
} as const;

