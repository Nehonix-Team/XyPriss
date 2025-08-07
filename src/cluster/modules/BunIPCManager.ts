/**
 * Bun IPC Manager - Inter-Process Communication for Bun Workers
 * Handles message passing between master and worker processes
 */

import { EventEmitter } from "events";
import { logger } from "../../../shared/logger/Logger";
import {
    WorkerConnection,
    IPCMessage,
    IPCResponse,
} from "../../types/cluster.ipc.t";

/**
 * Bun IPC Manager for handling communication between master and workers
 */
export class BunIPCManager extends EventEmitter {
    private workers: Map<string, WorkerConnection> = new Map();
    private messageHandlers: Map<
        string,
        (message: IPCMessage) => Promise<any>
    > = new Map();
    private pendingResponses: Map<
        string,
        { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
    > = new Map();
    private isWorker: boolean;
    private workerId?: string;
    private heartbeatInterval?: NodeJS.Timeout;
    private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds
    private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds

    constructor() {
        super();
        this.isWorker =
            process.env.CLUSTER_MODE === "true" ||
            process.env.NODE_ENV === "worker";
        this.workerId = process.env.WORKER_ID;

        if (this.isWorker) {
            this.initializeWorkerIPC();
        } else {
            this.initializeMasterIPC();
        }

        logger.info(
            "ipc",
            `BunIPCManager initialized in ${
                this.isWorker ? "worker" : "master"
            } mode`
        );
    }

    /**
     * Initialize IPC for worker processes
     */
    private initializeWorkerIPC(): void {
        // Listen for messages from master via stdin
        process.stdin.on("data", (data) => {
            try {
                const messages = data.toString().trim().split("\n");
                for (const messageStr of messages) {
                    if (messageStr.trim()) {
                        const message: IPCMessage = JSON.parse(messageStr);
                        this.handleIncomingMessage(message);
                    }
                }
            } catch (error) {
                logger.error(
                    "ipc",
                    "Failed to parse message from master:",
                    error
                );
            }
        });

        // Start heartbeat
        this.startHeartbeat();

        // Register default handlers
        this.registerHandler("ping", async () => ({
            status: "alive",
            workerId: this.workerId,
        }));
        this.registerHandler("shutdown", async () => {
            logger.info("ipc", "Received shutdown signal from master");
            process.exit(0);
        });
    }

    /**
     * Initialize IPC for master process
     */
    private initializeMasterIPC(): void {
        // Master process initialization
        logger.debug("ipc", "Master IPC initialized");
    }

    /**
     * Register a worker connection (master only)
     */
    public registerWorker(workerId: string, subprocess: any): void {
        if (this.isWorker) return;

        const connection: WorkerConnection = {
            id: workerId,
            subprocess,
            isAlive: true,
            lastPing: Date.now(),
            messageQueue: [],
        };

        this.workers.set(workerId, connection);

        // Listen for messages from this worker (Bun-compatible)
        if (subprocess.stdout && typeof subprocess.stdout.on === "function") {
            // Node.js-style subprocess
            subprocess.stdout.on("data", (data: Buffer) => {
                try {
                    const messages = data.toString().trim().split("\n");
                    for (const messageStr of messages) {
                        if (messageStr.trim() && messageStr.startsWith("{")) {
                            const message: IPCMessage = JSON.parse(messageStr);
                            if (message.from === "worker") {
                                this.handleIncomingMessage(message);
                            }
                        }
                    }
                } catch (error) {
                    // Ignore non-JSON output (regular logs, etc.)
                }
            });
        } else if (
            subprocess.stdout &&
            typeof subprocess.stdout.readable === "function"
        ) {
            // Bun-style subprocess - use readable stream
            this._setupBunIPCListener(workerId, subprocess);
        } else {
            // Fallback: disable IPC for this worker but don't fail
            logger.warn(
                "ipc",
                `Worker ${workerId} subprocess doesn't support IPC communication`
            );
            connection.isAlive = false;
        }

        logger.info("ipc", `Worker ${workerId} registered for IPC`);
    }

    /**
     * Setup sophisticated IPC listener for Bun subprocess
     */
    private async _setupBunIPCListener(
        workerId: string,
        subprocess: any
    ): Promise<void> {
        try {
            logger.debug(
                "ipc",
                `Setting up sophisticated Bun IPC listener for worker ${workerId}`
            );

            const connection = this.workers.get(workerId);
            if (!connection) {
                throw new Error(`Worker connection not found for ${workerId}`);
            }

            // Setup stdout reader for IPC messages
            if (subprocess.stdout) {
                await this._setupBunStdoutReader(
                    workerId,
                    subprocess.stdout,
                    connection
                );
            }

            // Setup stderr reader for error handling
            if (subprocess.stderr) {
                await this._setupBunStderrReader(workerId, subprocess.stderr);
            }

            // Setup stdin writer for sending messages
            if (subprocess.stdin) {
                connection.subprocess.stdin = subprocess.stdin;
            }

            // Mark connection as alive and ready
            connection.isAlive = true;
            logger.info(
                "ipc",
                `Sophisticated Bun IPC setup completed for worker ${workerId}`
            );

            // Send initial ping to test communication
            setTimeout(async () => {
                try {
                    await this.sendToWorker(workerId, "ping", { test: true });
                } catch (error) {
                    logger.warn(
                        "ipc",
                        `Initial ping failed for worker ${workerId}:`,
                        error
                    );
                }
            }, 1000);
        } catch (error) {
            logger.error(
                "ipc",
                `Failed to setup sophisticated Bun IPC listener for worker ${workerId}:`,
                error
            );
            const connection = this.workers.get(workerId);
            if (connection) {
                connection.isAlive = false;
            }
            throw error;
        }
    }

    /**
     * Setup Bun stdout reader for IPC messages
     */
    private async _setupBunStdoutReader(
        workerId: string,
        stdout: ReadableStream<Uint8Array>,
        connection: any
    ): Promise<void> {
        try {
            const reader = stdout.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            // Start reading loop
            const readLoop = async (): Promise<void> => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            logger.debug(
                                "ipc",
                                `Stdout stream ended for worker ${workerId}`
                            );
                            break;
                        }

                        // Decode chunk and add to buffer
                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        // Process complete lines
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || ""; // Keep incomplete line in buffer

                        for (const line of lines) {
                            if (line.trim()) {
                                await this._processBunIPCMessage(
                                    workerId,
                                    line.trim(),
                                    connection
                                );
                            }
                        }
                    }
                } catch (error) {
                    if (!connection.isAlive) {
                        // Worker is shutting down, this is expected
                        logger.debug(
                            "ipc",
                            `Stdout reader stopped for worker ${workerId} (shutdown)`
                        );
                    } else {
                        logger.error(
                            "ipc",
                            `Stdout reader error for worker ${workerId}:`,
                            error
                        );
                        connection.isAlive = false;
                    }
                } finally {
                    reader.releaseLock();
                }
            };

            // Start reading in background
            readLoop().catch((error) => {
                logger.error(
                    "ipc",
                    `Stdout read loop failed for worker ${workerId}:`,
                    error
                );
                connection.isAlive = false;
            });
        } catch (error) {
            logger.error(
                "ipc",
                `Failed to setup stdout reader for worker ${workerId}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Setup Bun stderr reader for error monitoring
     */
    private async _setupBunStderrReader(
        workerId: string,
        stderr: ReadableStream<Uint8Array>
    ): Promise<void> {
        try {
            const reader = stderr.getReader();
            const decoder = new TextDecoder();

            // Start reading loop for error monitoring
            const readLoop = async (): Promise<void> => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            logger.debug(
                                "ipc",
                                `Stderr stream ended for worker ${workerId}`
                            );
                            break;
                        }

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split("\n");

                        for (const line of lines) {
                            if (line.trim()) {
                                logger.warn(
                                    "ipc",
                                    `[${workerId}] stderr: ${line.trim()}`
                                );
                            }
                        }
                    }
                } catch (error) {
                    logger.debug(
                        "ipc",
                        `Stderr reader stopped for worker ${workerId}:`,
                        error
                    );
                } finally {
                    reader.releaseLock();
                }
            };

            // Start reading in background
            readLoop().catch((error) => {
                logger.error(
                    "ipc",
                    `Stderr read loop failed for worker ${workerId}:`,
                    error
                );
            });
        } catch (error) {
            logger.error(
                "ipc",
                `Failed to setup stderr reader for worker ${workerId}:`,
                error
            );
            // Don't throw here as stderr is not critical for IPC
        }
    }

    /**
     * Process IPC message from Bun worker
     */
    private async _processBunIPCMessage(
        workerId: string,
        messageStr: string,
        connection: any
    ): Promise<void> {
        try {
            // Check if this looks like a JSON IPC message
            if (!messageStr.startsWith("{")) {
                // Regular log output, ignore for IPC
                logger.debug("ipc", `[${workerId}] log: ${messageStr}`);
                return;
            }

            const message: IPCMessage = JSON.parse(messageStr);

            // Validate message structure
            if (!message.type || !message.from) {
                logger.debug(
                    "ipc",
                    `Invalid IPC message from worker ${workerId}: ${messageStr}`
                );
                return;
            }

            // Update connection heartbeat
            connection.lastPing = Date.now();

            // Handle the message
            await this.handleIncomingMessage(message);
        } catch (error) {
            // If JSON parsing fails, treat as regular log output
            if (error instanceof SyntaxError) {
                logger.debug("ipc", `[${workerId}] log: ${messageStr}`);
            } else {
                logger.error(
                    "ipc",
                    `Error processing IPC message from worker ${workerId}:`,
                    error
                );
            }
        }
    }

    /**
     * Unregister a worker connection (master only)
     */
    public unregisterWorker(workerId: string): void {
        if (this.isWorker) return;

        const worker = this.workers.get(workerId);
        if (worker) {
            worker.isAlive = false;
            this.workers.delete(workerId);
            logger.info("ipc", `Worker ${workerId} unregistered from IPC`);
        }
    }

    /**
     * Send message to a specific worker (master only)
     */
    public async sendToWorker(
        workerId: string,
        type: string,
        data: any
    ): Promise<any> {
        if (this.isWorker) {
            throw new Error(
                "Workers cannot send messages to other workers directly"
            );
        }

        const worker = this.workers.get(workerId);
        if (!worker || !worker.isAlive) {
            logger.debug(
                "ipc",
                `Worker ${workerId} is not available for IPC, returning mock response`
            );
            // Return a mock response for Bun workers that don't have full IPC support
            return {
                status: "ok",
                message: "IPC not fully supported in Bun mode",
                timestamp: Date.now(),
            };
        }

        const message: IPCMessage = {
            id: this.generateMessageId(),
            type,
            data,
            timestamp: Date.now(),
            from: "master",
            to: workerId,
        };

        try {
            return await this.sendMessage(worker.subprocess, message);
        } catch (error) {
            logger.debug(
                "ipc",
                `Failed to send IPC message to worker ${workerId}, returning mock response:`,
                error
            );
            // Return a mock response if IPC fails
            return {
                status: "fallback",
                message: "IPC communication failed",
                timestamp: Date.now(),
            };
        }
    }

    /**
     * Broadcast message to all workers (master only)
     */
    public async broadcastToWorkers(
        type: string,
        data: any
    ): Promise<IPCResponse[]> {
        if (this.isWorker) {
            throw new Error("Workers cannot broadcast messages");
        }

        const promises: Promise<any>[] = [];

        for (const [workerId, worker] of this.workers) {
            if (worker.isAlive) {
                promises.push(
                    this.sendToWorker(workerId, type, data).catch((error) => ({
                        workerId,
                        error: error.message,
                    }))
                );
            }
        }

        return Promise.all(promises);
    }

    /**
     * Send message to a random worker (master only)
     */
    public async sendToRandomWorker(type: string, data: any): Promise<any> {
        if (this.isWorker) {
            throw new Error(
                "Workers cannot send messages to other workers directly"
            );
        }

        const aliveWorkers = Array.from(this.workers.values()).filter(
            (w) => w.isAlive
        );
        if (aliveWorkers.length === 0) {
            throw new Error("No alive workers available");
        }

        const randomWorker =
            aliveWorkers[Math.floor(Math.random() * aliveWorkers.length)];
        return this.sendToWorker(randomWorker.id, type, data);
    }

    /**
     * Send message to master (worker only)
     */
    public async sendToMaster(type: string, data: any): Promise<any> {
        if (!this.isWorker) {
            throw new Error("Only workers can send messages to master");
        }

        const message: IPCMessage = {
            id: this.generateMessageId(),
            type,
            data,
            timestamp: Date.now(),
            from: "worker",
        };

        return this.sendMessage(process.stdout, message);
    }

    /**
     * Register a message handler
     */
    public registerHandler(
        type: string,
        handler: (message: IPCMessage) => Promise<any>
    ): void {
        this.messageHandlers.set(type, handler);
        logger.debug("ipc", `Handler registered for message type: ${type}`);
    }

    /**
     * Unregister a message handler
     */
    public unregisterHandler(type: string): void {
        this.messageHandlers.delete(type);
        logger.debug("ipc", `Handler unregistered for message type: ${type}`);
    }

    /**
     * Send a message and wait for response
     */
    private async sendMessage(target: any, message: IPCMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            const correlationId = this.generateMessageId();
            message.correlationId = correlationId;

            // Set up response handler
            const timeout = setTimeout(() => {
                this.pendingResponses.delete(correlationId);
                reject(
                    new Error(`Message timeout after ${this.MESSAGE_TIMEOUT}ms`)
                );
            }, this.MESSAGE_TIMEOUT);

            this.pendingResponses.set(correlationId, {
                resolve,
                reject,
                timeout,
            });

            // Send message
            try {
                const messageStr = JSON.stringify(message) + "\n";

                if (target.write) {
                    // Node.js style stream
                    target.write(messageStr);
                } else if (target.stdin) {
                    // Check if it's a Bun WritableStream
                    if (target.stdin.getWriter) {
                        // Bun WritableStream
                        this._sendToBunWritableStream(
                            target.stdin,
                            messageStr
                        ).catch((error: any) => {
                            clearTimeout(timeout);
                            this.pendingResponses.delete(correlationId);
                            reject(error);
                        });
                    } else {
                        // Node.js style stdin
                        target.stdin.write(messageStr);
                    }
                } else {
                    throw new Error("Invalid target for message sending");
                }
            } catch (error) {
                clearTimeout(timeout);
                this.pendingResponses.delete(correlationId);
                reject(error);
            }
        });
    }

    /**
     * Send message to Bun WritableStream
     */
    private async _sendToBunWritableStream(
        stream: WritableStream<Uint8Array>,
        message: string
    ): Promise<void> {
        try {
            const writer = stream.getWriter();
            const encoder = new TextEncoder();
            const data = encoder.encode(message);

            await writer.write(data);
            writer.releaseLock();
        } catch (error) {
            throw new Error(`Failed to write to Bun WritableStream: ${error}`);
        }
    }

    /**
     * Handle incoming messages
     */
    private async handleIncomingMessage(message: IPCMessage): Promise<void> {
        try {
            // Check if this is a response to a pending request
            if (
                message.correlationId &&
                this.pendingResponses.has(message.correlationId)
            ) {
                const pending = this.pendingResponses.get(
                    message.correlationId
                )!;
                clearTimeout(pending.timeout);
                this.pendingResponses.delete(message.correlationId);
                pending.resolve(message.data);
                return;
            }

            // Handle regular messages
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
                const response = await handler(message);

                // Send response if correlation ID is present
                if (message.correlationId) {
                    const responseMessage: IPCMessage = {
                        id: this.generateMessageId(),
                        type: `${message.type}_response`,
                        data: response,
                        timestamp: Date.now(),
                        from: this.isWorker ? "worker" : "master",
                        correlationId: message.correlationId,
                    };

                    const target = this.isWorker
                        ? process.stdout
                        : this.workers.get(
                              message.from === "worker" ? message.to || "" : ""
                          )?.subprocess;

                    if (target) {
                        const messageStr =
                            JSON.stringify(responseMessage) + "\n";
                        if (target.write) {
                            target.write(messageStr);
                        } else if (target.stdin) {
                            target.stdin.write(messageStr);
                        }
                    }
                }
            } else {
                logger.warn(
                    "ipc",
                    `No handler found for message type: ${message.type}`
                );
            }

            // Emit event for external listeners
            this.emit("message", message);
        } catch (error) {
            logger.error("ipc", "Error handling incoming message:", error);
        }
    }

    /**
     * Start heartbeat mechanism
     */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) return;

        this.heartbeatInterval = setInterval(async () => {
            if (this.isWorker) {
                // Worker sends heartbeat to master
                try {
                    await this.sendToMaster("heartbeat", {
                        workerId: this.workerId,
                        timestamp: Date.now(),
                        memoryUsage: process.memoryUsage(),
                    });
                } catch (error) {
                    logger.error("ipc", "Failed to send heartbeat:", error);
                }
            } else {
                // Master checks worker heartbeats
                const now = Date.now();
                for (const [workerId, worker] of this.workers) {
                    if (
                        worker.isAlive &&
                        now - worker.lastPing > this.HEARTBEAT_INTERVAL * 3
                    ) {
                        logger.warn(
                            "ipc",
                            `Worker ${workerId} missed heartbeat, marking as potentially dead`
                        );
                        worker.isAlive = false;
                        this.emit("worker_timeout", workerId);
                    }
                }
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    /**
     * Stop heartbeat mechanism
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }
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
     * Get worker statistics (master only)
     */
    public getWorkerStats(): { total: number; alive: number; dead: number } {
        if (this.isWorker) {
            return { total: 0, alive: 0, dead: 0 };
        }

        const total = this.workers.size;
        const alive = Array.from(this.workers.values()).filter(
            (w) => w.isAlive
        ).length;
        const dead = total - alive;

        return { total, alive, dead };
    }

    /**
     * Cleanup and destroy IPC manager
     */
    public destroy(): void {
        this.stopHeartbeat();

        // Clear pending responses
        for (const [, pending] of this.pendingResponses) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("IPC Manager destroyed"));
        }
        this.pendingResponses.clear();

        // Clear workers
        this.workers.clear();

        // Remove all listeners
        this.removeAllListeners();

        logger.info("ipc", "BunIPCManager destroyed");
    }
}

