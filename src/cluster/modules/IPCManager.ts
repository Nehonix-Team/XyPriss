/**
 * XyPrissJS IPC Manager
 * Secure inter-process communication with encryption and message queuing
 */

import { EventEmitter } from "events";
import * as cluster from "cluster";
import * as crypto from "crypto";
import * as msgpack from "msgpack-lite";
import stringify from "fast-json-stable-stringify";
import { ClusterConfig } from "../../types/cluster";
import {
    SecurityErrorLogger,
    createSecurityError,
    ErrorType,
    ErrorSeverity,
} from "../../../mods/security/src/utils/errorHandler";
import { func } from "../../../mods/security/src/components/fortified-function";
import { logger } from "../../server/utils/Logger";

interface IPCMessage {
    id: string;
    type: string;
    from: string;
    to: string | "broadcast";
    data: any;
    timestamp: number;
    encrypted?: boolean;
    signature?: string;
}

interface MessageQueue {
    messages: IPCMessage[];
    maxSize: number;
    timeout: number;
}

/**
 * Secure IPC manager with encryption, message queuing, and broadcast capabilities
 */
export class IPCManager extends EventEmitter {
    private config: ClusterConfig;
    private errorLogger: SecurityErrorLogger;
    private messageQueues: Map<string, MessageQueue> = new Map();
    private encryptionKey: string;
    private isEnabled: boolean;
    private messageHandlers: Map<
        string,
        (data: any, workerId: string) => void
    > = new Map();
    private pendingMessages: Map<
        string,
        { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
    > = new Map();
    private workerManager?: any; // Will be injected by ClusterManager

    constructor(config: ClusterConfig, errorLogger: SecurityErrorLogger) {
        super();
        this.config = config;
        this.errorLogger = errorLogger;
        this.isEnabled = config.ipc?.enabled !== false;

        // Generate encryption key for secure IPC
        this.encryptionKey = this.generateEncryptionKey();

        if (this.isEnabled) {
            this.setupIPC();
        }
    }

    /**
     * Setup IPC with security and message handling
     */
    private setupIPC(): void {
        // Setup message handlers from config
        if (this.config.ipc?.events) {
            Object.entries(this.config.ipc.events).forEach(
                ([eventName, handler]) => {
                    this.messageHandlers.set(eventName, handler);
                }
            );
        }

        // Setup cluster message handling
        this.setupClusterMessageHandling();

        // Initialize message queues for workers
        this.initializeMessageQueues();

        logger.info(
            "cluster",
            "IPC Manager initialized with secure communication"
        );
    }

    /**
     * Setup cluster message handling with fortified security
     */
    private setupClusterMessageHandling(): void {
        const fortifiedHandler = func(
            async (worker: cluster.Worker, message: any) => {
                await this.handleIncomingMessage(worker, message);
            },
            {
                ultraFast: "maximum",
                auditLog: true,
                errorHandling: "graceful",
            }
        );

        // Handle messages from workers (master process)
        if (process.env.NODE_ENV !== "worker") {
            // Setup proper cluster event handling for master process
            const clusterModule = require("cluster");

            // Listen for messages from all workers
            clusterModule.on(
                "message",
                (worker: cluster.Worker, message: any) => {
                    fortifiedHandler(worker, message);
                }
            );

            // Setup worker lifecycle event handlers
            clusterModule.on("fork", (worker: cluster.Worker) => {
                worker.on("message", (message: any) => {
                    fortifiedHandler(worker, message);
                });
            });
        }

        // Handle messages from master (worker process)
        if (process.env.NODE_ENV === "worker") {
            process.on("message", (message) => {
                // Create worker object with proper identification
                const workerObj = {
                    id:
                        process.env.WORKER_ID ||
                        process.pid?.toString() ||
                        "unknown",
                    process: { pid: process.pid },
                    isDead: () => false,
                } as unknown as cluster.Worker;

                fortifiedHandler(workerObj, message);
            });
        }
    }

    /**
     * Initialize message queues for workers
     */
    private initializeMessageQueues(): void {
        const queueConfig = this.config.ipc?.messageQueue || {};
        const maxSize = queueConfig.maxSize || 1000;
        const timeout = queueConfig.timeout || 30000;

        // Create default queue
        this.messageQueues.set("default", {
            messages: [],
            maxSize,
            timeout,
        });
    }

    /**
     * Handle incoming IPC messages with security validation
     */
    private async handleIncomingMessage(
        worker: cluster.Worker | null,
        message: any
    ): Promise<void> {
        try {
            // Skip Node.js internal cluster messages
            if (this.isNodeInternalMessage(message)) {
                return; // Silently ignore internal messages
            }

            // Deserialize message first
            const deserializedMessage = this.deserializeMessage(message);

            // Validate message structure
            if (!this.isValidIPCMessage(deserializedMessage)) {
                // Only log if it looks like it might be our message format
                if (this.looksLikeXyPrissMessage(deserializedMessage)) {
                    // Debug logging to understand what messages are failing
                    if (process.env.DEBUG_IPC) {
                        logger.info("cluster", "Invalid XyPrissJS message:", {
                            original: message,
                            deserialized: deserializedMessage,
                            hasId: !!deserializedMessage?.id,
                            hasType: !!deserializedMessage?.type,
                            hasFrom: !!deserializedMessage?.from,
                            hasTo: !!deserializedMessage?.to,
                            hasTimestamp: !!deserializedMessage?.timestamp,
                        });
                    }
                    throw new Error("Invalid IPC message structure");
                }
                return; // Silently ignore non-XyPrissJS messages
            }

            const ipcMessage = deserializedMessage as IPCMessage;

            // Decrypt message if encrypted
            if (ipcMessage.encrypted && this.config.security?.encryptIPC) {
                ipcMessage.data = this.decryptMessage(ipcMessage.data);
            }

            // Verify message signature if security is enabled
            if (this.config.security?.encryptIPC && ipcMessage.signature) {
                if (!this.verifyMessageSignature(ipcMessage)) {
                    throw new Error("Message signature verification failed");
                }
            }

            // Handle different message types
            await this.processMessage(ipcMessage, worker);
        } catch (error: any) {
            // Only log errors for messages that look like they should be ours
            const deserializedMessage = this.deserializeMessage(message);
            if (this.looksLikeXyPrissMessage(deserializedMessage)) {
                const securityError = createSecurityError(
                    `IPC message handling failed: ${error.message}`,
                    ErrorType.INTERNAL,
                    ErrorSeverity.MEDIUM,
                    "IPC_MESSAGE_ERROR",
                    { operation: "ipc_message_handling" }
                );
                this.errorLogger.logError(securityError);
            }
        }
    }

    /**
     * Process IPC message based on type
     */
    private async processMessage(
        message: IPCMessage,
        worker: cluster.Worker | null
    ): Promise<void> {
        switch (message.type) {
            case "request":
                await this.handleRequest(message, worker);
                break;
            case "response":
                await this.handleResponse(message);
                break;
            case "broadcast":
                await this.handleBroadcast(message);
                break;
            case "event":
                await this.handleEvent(message);
                break;
            default:
                console.warn(`Unknown IPC message type: ${message.type}`);
        }

        // Emit IPC event
        this.emit("ipc:message", message.from, message.to, message.data);
    }

    /**
     * Handle request messages
     */
    private async handleRequest(
        message: IPCMessage,
        _worker: cluster.Worker | null
    ): Promise<void> {
        const handler = this.messageHandlers.get(message.data.event);

        if (handler) {
            try {
                const result = handler(message.data.payload, message.from);

                // Send response back
                await this.sendResponse(message.from, message.id, result);
            } catch (error: any) {
                await this.sendResponse(message.from, message.id, {
                    error: error.message,
                });
            }
        } else {
            await this.sendResponse(message.from, message.id, {
                error: "No handler found",
            });
        }
    }

    /**
     * Handle response messages
     */
    private async handleResponse(message: IPCMessage): Promise<void> {
        const pending = this.pendingMessages.get(message.id);

        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingMessages.delete(message.id);

            if (message.data.error) {
                pending.reject(new Error(message.data.error));
            } else {
                pending.resolve(message.data.result);
            }
        }
    }

    /**
     * Handle broadcast messages
     */
    private async handleBroadcast(message: IPCMessage): Promise<void> {
        const handler = this.messageHandlers.get(message.data.event);

        if (handler) {
            try {
                handler(message.data.payload, message.from);
            } catch (error: any) {
                console.error(`Broadcast handler error: ${error.message}`);
            }
        }

        this.emit("ipc:broadcast", message.from, message.data);
    }

    /**
     * Handle event messages
     */
    private async handleEvent(message: IPCMessage): Promise<void> {
        this.emit(message.data.event, message.data.payload, message.from);
    }

    /**
     * Send message to specific worker
     */
    public async sendToWorker(workerId: string, data: any): Promise<void> {
        if (!this.isEnabled) return;

        const message = this.createMessage("event", workerId, data);
        await this.deliverMessage(message);
    }

    /**
     * Send message to all workers
     */
    public async sendToAllWorkers(data: any): Promise<void> {
        if (!this.isEnabled) return;

        const message = this.createMessage("broadcast", "broadcast", data);
        await this.deliverMessage(message);
    }

    /**
     * Broadcast message to all workers
     */
    public async broadcast(data: any): Promise<void> {
        await this.sendToAllWorkers(data);
    }

    /**
     * Send message to random worker
     */
    public async sendToRandomWorker(data: any): Promise<void> {
        if (!this.isEnabled) return;

        const workers = this.getAvailableWorkers();
        if (workers.length === 0) {
            throw new Error("No available workers for message delivery");
        }

        const randomWorker =
            workers[Math.floor(Math.random() * workers.length)];
        await this.sendToWorker(randomWorker, data);
    }

    /**
     * Send message to least loaded worker
     */
    public async sendToLeastLoadedWorker(data: any): Promise<void> {
        if (!this.isEnabled) return;

        const workers = this.getAvailableWorkers();
        if (workers.length === 0) {
            throw new Error("No available workers for message delivery");
        }

        // Find least loaded worker based on current metrics
        let leastLoadedWorker = workers[0];
        let lowestLoad = this.getWorkerLoad(leastLoadedWorker);

        for (const workerId of workers) {
            const load = this.getWorkerLoad(workerId);
            if (load < lowestLoad) {
                lowestLoad = load;
                leastLoadedWorker = workerId;
            }
        }

        await this.sendToWorker(leastLoadedWorker, data);
    }

    /**
     * Send request and wait for response
     */
    public async sendRequest(
        workerId: string,
        event: string,
        payload: any,
        timeout: number = 5000
    ): Promise<any> {
        if (!this.isEnabled) {
            throw new Error("IPC is disabled");
        }

        const message = this.createMessage("request", workerId, {
            event,
            payload,
        });

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingMessages.delete(message.id);
                reject(new Error("Request timeout"));
            }, timeout);

            this.pendingMessages.set(message.id, {
                resolve,
                reject,
                timeout: timeoutHandle,
            });

            this.deliverMessage(message).catch(reject);
        });
    }

    /**
     * Send response to request
     */
    private async sendResponse(
        workerId: string,
        requestId: string,
        result: any
    ): Promise<void> {
        const message = this.createMessage("response", workerId, { result });
        message.id = requestId; // Use same ID as request

        await this.deliverMessage(message);
    }

    /**
     * Create IPC message with security features
     */
    private createMessage(type: string, to: string, data: any): IPCMessage {
        const message: IPCMessage = {
            id: this.generateMessageId(),
            type,
            from:
                process.env.NODE_ENV !== "worker"
                    ? "master"
                    : `worker_${process.env.WORKER_ID || "unknown"}`,
            to,
            data,
            timestamp: Date.now(),
        };

        // Encrypt message if security is enabled
        if (this.config.security?.encryptIPC) {
            message.data = this.encryptMessage(message.data);
            message.encrypted = true;
            message.signature = this.signMessage(message);
        }

        return message;
    }

    /**
     * Deliver message to target using real cluster IPC
     */
    private async deliverMessage(message: IPCMessage): Promise<void> {
        try {
            // Serialize message using msgpack for better performance
            const serializedMessage = this.serializeMessage(message);

            if (message.to === "broadcast") {
                // Broadcast to all workers using real cluster API
                await this.broadcastToAllWorkers(serializedMessage);
            } else if (process.env.NODE_ENV !== "worker") {
                // Send from master to specific worker
                await this.sendToSpecificWorker(message.to, serializedMessage);
            } else {
                // Send from worker to master
                if (process.send) {
                    process.send(serializedMessage);
                } else {
                    throw new Error("Process.send not available in worker");
                }
            }
        } catch (error: any) {
            const securityError = createSecurityError(
                `Message delivery failed: ${error.message}`,
                ErrorType.INTERNAL,
                ErrorSeverity.MEDIUM,
                "IPC_DELIVERY_ERROR",
                { operation: "ipc_message_delivery" }
            );
            this.errorLogger.logError(securityError);
            throw error;
        }
    }

    /**
     * Broadcast message to all workers using real cluster API
     */
    private async broadcastToAllWorkers(serializedMessage: any): Promise<void> {
        try {
            const clusterModule = require("cluster");
            if (clusterModule.workers) {
                const broadcastPromises = Object.values(
                    clusterModule.workers
                ).map((worker: any) => {
                    return new Promise<void>((resolve) => {
                        if (worker && !worker.isDead() && worker.send) {
                            worker.send(
                                serializedMessage,
                                (error: Error | null) => {
                                    if (error) {
                                        console.warn(
                                            `Failed to send message to worker ${worker.id}:`,
                                            error.message
                                        );
                                    }
                                    resolve(); // Continue even if one worker fails
                                }
                            );
                        } else {
                            resolve();
                        }
                    });
                });

                await Promise.all(broadcastPromises);
            }
        } catch (error: any) {
            throw new Error(`Broadcast failed: ${error.message}`);
        }
    }

    /**
     * Send message to specific worker using real cluster API
     */
    private async sendToSpecificWorker(
        workerId: string,
        serializedMessage: any
    ): Promise<void> {
        try {
            const clusterModule = require("cluster");
            const id = workerId.replace("worker_", "").split("_")[0];
            const worker = clusterModule.workers?.[id];

            if (worker && !worker.isDead() && worker.send) {
                return new Promise<void>((resolve, reject) => {
                    worker.send(serializedMessage, (error: Error | null) => {
                        if (error) {
                            reject(
                                new Error(
                                    `Failed to send message to worker ${workerId}: ${error.message}`
                                )
                            );
                        } else {
                            resolve();
                        }
                    });
                });
            } else {
                throw new Error(
                    `Worker ${workerId} not found or not available`
                );
            }
        } catch (error: any) {
            throw new Error(`Send to worker failed: ${error.message}`);
        }
    }

    /**
     * Serialize message using msgpack for better performance
     */
    private serializeMessage(message: IPCMessage): any {
        try {
            // Use msgpack for binary serialization (more efficient than JSON)
            if ((this.config.ipc as any)?.serialization === "msgpack") {
                return {
                    ...message,
                    data: msgpack.encode(message.data),
                    _serialized: "msgpack",
                };
            } else {
                // Use stable JSON stringify for consistent serialization
                return {
                    ...message,
                    data: stringify(message.data),
                    _serialized: "json",
                };
            }
        } catch (error: any) {
            // Fallback to regular JSON
            return {
                ...message,
                data: JSON.stringify(message.data),
                _serialized: "json",
            };
        }
    }

    /**
     * Deserialize message data
     */
    private deserializeMessage(message: any): IPCMessage {
        try {
            if (message._serialized === "msgpack") {
                return {
                    ...message,
                    data: msgpack.decode(message.data),
                };
            } else {
                return {
                    ...message,
                    data: JSON.parse(message.data),
                };
            }
        } catch (error: any) {
            // Return as-is if deserialization fails
            return message;
        }
    }

    /**
     * Check if message is a Node.js internal cluster message
     */
    private isNodeInternalMessage(message: any): boolean {
        // Node.js cluster internal messages typically have these patterns
        if (!message || typeof message !== "object") {
            return true; // Ignore non-object messages
        }

        // Check for Node.js specific properties first
        if (
            message.cmd ||
            message.act ||
            message.NODE_UNIQUE_ID ||
            message.NODE_CHANNEL_FD
        ) {
            return true;
        }

        // Check for common Node.js cluster message types
        if (
            message.cmd === "NODE_CLUSTER" ||
            message.cmd === "NODE_HANDLE" ||
            message.cmd === "NODE_HANDLE_ACK" ||
            message.cmd === "NODE_HANDLE_NACK"
        ) {
            return true;
        }

        // Check for server/worker lifecycle messages
        if (
            typeof message === "object" &&
            (message.listening !== undefined ||
                message.disconnect !== undefined ||
                message.suicide !== undefined ||
                message.exitedAfterDisconnect !== undefined)
        ) {
            return true;
        }

        // Common Node.js cluster internal message patterns
        const internalPatterns = [
            '"cmd":', // Node.js cluster command messages
            '"act":', // Node.js cluster action messages
            "NODE_", // Node.js internal prefixes
            '"listening":', // Server listening events
            '"disconnect":', // Disconnect events
            '"suicide":', // Worker suicide flag
            '"exitedAfterDisconnect":', // Worker exit flag
        ];

        // Check if message has internal patterns
        const messageStr = JSON.stringify(message);
        for (const pattern of internalPatterns) {
            if (messageStr.includes(pattern)) {
                return true;
            }
        }

        // Check for messages that don't have our required structure
        // but might be valid Node.js messages
        if (
            !message.id &&
            !message.type &&
            !message.from &&
            !message.to &&
            !message._serialized
        ) {
            return true; // Likely a Node.js internal message
        }

        return false;
    }

    /**
     * Check if message looks like a XyPrissJS message
     */
    private looksLikeXyPrissMessage(message: any): boolean {
        if (!message || typeof message !== "object") {
            return false;
        }

        // Check for XyPrissJS cluster lifecycle messages (these are valid but incomplete)
        const clusterLifecycleTypes = [
            "worker_ready",
            "worker_started",
            "worker_stopped",
            "worker_error",
            "cluster_ready",
            "health_check",
            "metrics_update",
        ];

        if (message.type && clusterLifecycleTypes.includes(message.type)) {
            return false; // These are valid XyPrissJS messages but don't need full IPC structure
        }

        // Check if it has some XyPrissJS IPC message characteristics
        return (
            message.id ||
            message.from ||
            message.to ||
            message.timestamp ||
            message._serialized ||
            message.encrypted
        );
    }

    /**
     * Validate IPC message structure
     */
    private isValidIPCMessage(message: any): boolean {
        return (
            message &&
            typeof message.id === "string" &&
            typeof message.type === "string" &&
            typeof message.from === "string" &&
            typeof message.to === "string" &&
            typeof message.timestamp === "number"
        );
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 11)}`;
    }

    /**
     * Generate encryption key
     */
    private generateEncryptionKey(): string {
        return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Encrypt message data using modern crypto API
     */
    private encryptMessage(data: any): string {
        try {
            const algorithm = "aes-256-gcm";
            const key = crypto.scryptSync(this.encryptionKey, "salt", 32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(algorithm, key, iv);

            cipher.setAAD(Buffer.from("ipc-message", "utf8"));

            let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
            encrypted += cipher.final("hex");

            const authTag = cipher.getAuthTag();

            return JSON.stringify({
                encrypted,
                iv: iv.toString("hex"),
                authTag: authTag.toString("hex"),
            });
        } catch (error) {
            // Fallback to simple base64 encoding if encryption fails
            return Buffer.from(JSON.stringify(data)).toString("base64");
        }
    }

    /**
     * Decrypt message data using modern crypto API
     */
    private decryptMessage(encryptedData: string): any {
        try {
            const encryptedObj = JSON.parse(encryptedData);

            if (
                encryptedObj.encrypted &&
                encryptedObj.iv &&
                encryptedObj.authTag
            ) {
                const algorithm = "aes-256-gcm";
                const key = crypto.scryptSync(this.encryptionKey, "salt", 32);
                const iv = Buffer.from(encryptedObj.iv, "hex");
                const decipher = crypto.createDecipheriv(algorithm, key, iv);

                decipher.setAuthTag(Buffer.from(encryptedObj.authTag, "hex"));
                decipher.setAAD(Buffer.from("ipc-message", "utf8"));

                let decrypted = decipher.update(
                    encryptedObj.encrypted,
                    "hex",
                    "utf8"
                );
                decrypted += decipher.final("utf8");

                return JSON.parse(decrypted);
            } else {
                // Fallback: assume it's base64 encoded
                const decoded = Buffer.from(encryptedData, "base64").toString(
                    "utf8"
                );
                return JSON.parse(decoded);
            }
        } catch (error) {
            // If all else fails, try to parse as plain JSON
            try {
                return JSON.parse(encryptedData);
            } catch {
                return encryptedData;
            }
        }
    }

    /**
     * Sign message for integrity verification
     */
    private signMessage(message: IPCMessage): string {
        const messageString = JSON.stringify({
            id: message.id,
            type: message.type,
            from: message.from,
            to: message.to,
            timestamp: message.timestamp,
        });

        return crypto
            .createHmac("sha256", this.encryptionKey)
            .update(messageString)
            .digest("hex");
    }

    /**
     * Verify message signature
     */
    private verifyMessageSignature(message: IPCMessage): boolean {
        if (!message.signature) return false;

        const expectedSignature = this.signMessage(message);
        return crypto.timingSafeEqual(
            Buffer.from(message.signature, "hex"),
            Buffer.from(expectedSignature, "hex")
        );
    }

    /**
     * Register event handler
     */
    public registerHandler(
        event: string,
        handler: (data: any, workerId: string) => void
    ): void {
        this.messageHandlers.set(event, handler);
    }

    /**
     * Unregister event handler
     */
    public unregisterHandler(event: string): void {
        this.messageHandlers.delete(event);
    }

    /**
     * Set worker manager reference for integration
     */
    public setWorkerManager(workerManager: any): void {
        this.workerManager = workerManager;
    }

    /**
     * Get available workers from cluster
     */
    private getAvailableWorkers(): string[] {
        try {
            const clusterModule = require("cluster");
            if (clusterModule.workers) {
                return Object.values(clusterModule.workers)
                    .filter((worker: any) => worker && !worker.isDead())
                    .map((worker: any) => `worker_${worker.id}`);
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Get worker load score for load balancing
     */
    private getWorkerLoad(workerId: string): number {
        try {
            // If worker manager is available, get real metrics
            if (this.workerManager) {
                const worker = this.workerManager.getWorker(workerId);
                if (worker) {
                    // Calculate load based on CPU and memory usage
                    return (worker.cpu.usage + worker.memory.percentage) / 2;
                }
            }

            // Fallback: use random load to distribute evenly
            return Math.random() * 100;
        } catch (error) {
            return 50; // Default moderate load
        }
    }

    /**
     * Get IPC statistics
     */
    public getStats(): {
        enabled: boolean;
        messageQueues: number;
        pendingMessages: number;
        handlers: number;
        availableWorkers: number;
    } {
        return {
            enabled: this.isEnabled,
            messageQueues: this.messageQueues.size,
            pendingMessages: this.pendingMessages.size,
            handlers: this.messageHandlers.size,
            availableWorkers: this.getAvailableWorkers().length,
        };
    }
}

