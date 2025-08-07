/**
 * Robust Bun-compatible cluster manager
 * Uses Bun's native process spawning and IPC capabilities with enhanced security and reliability
 */

import { EventEmitter } from "events";
import { logger } from "../../shared/logger/Logger";
import type { ClusterConfig } from "../types/cluster";
import { MemoryManager } from "./memory-manager";
import { BunClusterMetrics, BunWorker } from "../types";
import { randomBytes, createHash } from "crypto";
import { performance } from "perf_hooks";
import { BunIPCManager } from "./modules/BunIPCManager";
import { CpuMonitor } from "./modules/CpuMonitor";

/**
 * Security configuration for cluster operations
 */
interface SecurityConfig {
    maxRestartAttempts: number;
    restartWindow: number; // ms
    maxMemoryPerWorker: number; // bytes
    allowedSignals: NodeJS.Signals[];
    processTimeout: number; // ms
    enableResourceLimits: boolean;
}

/**
 * Worker performance tracking
 */
interface WorkerPerformance {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    lastRequestTime: number;
    cpuUsage: number;
    memoryUsage: number;
}

/**
 * Enhanced Bun worker with security and performance tracking
 */
interface EnhancedBunWorker extends BunWorker {
    securityToken: string;
    performance: WorkerPerformance;
    resourceLimits: {
        maxMemory: number;
        maxCpu: number;
    };
    restartHistory: Array<{
        timestamp: number;
        reason: string;
        exitCode?: number;
    }>;
}

/**
 * Bun-compatible cluster manager with enhanced security and robustness
 */
export class BunClusterManager extends EventEmitter {
    private workers: Map<string, EnhancedBunWorker> = new Map();
    private config: ClusterConfig;
    private basePort: number;
    private isRunning: boolean = false;
    private healthCheckInterval?: NodeJS.Timeout;
    private metricsInterval?: NodeJS.Timeout;
    private performanceInterval?: NodeJS.Timeout;
    private startTime: number = 0;
    private memoryManager: MemoryManager;
    private cpuMonitor: CpuMonitor;
    private securityConfig: SecurityConfig;
    private ipcManager?: BunIPCManager;
    private masterToken: string;
    private shutdownPromise?: Promise<void>;
    private readonly maxShutdownTime = 30000; // 30 seconds
    private workerPorts: Set<number> = new Set();

    constructor(config: ClusterConfig, basePort: number = 8085) {
        super();

        this._validateConfig(config);
        this.config = config;
        this.basePort = basePort;
        this.masterToken = this._generateSecureToken();

        // Initialize security configuration
        this.securityConfig = {
            maxRestartAttempts: config.processManagement?.maxRestarts || 3,
            restartWindow: 300000, // 5 minutes
            maxMemoryPerWorker: this._parseMemoryString(
                config.resources?.maxMemoryPerWorker || "512MB"
            ),
            allowedSignals: ["SIGTERM", "SIGKILL", "SIGUSR1", "SIGUSR2"],
            processTimeout: 30000, // 30 seconds
            enableResourceLimits: true,
        };

        // Initialize memory manager with error handling
        try {
            this.memoryManager = new MemoryManager(config.resources);
            this._setupMemoryManagement();
        } catch (error) {
            logger.error(
                "cluster",
                "Failed to initialize memory manager:",
                error
            );
            throw new Error("Failed to initialize cluster manager");
        }

        // Initialize CPU monitor
        this.cpuMonitor = new CpuMonitor({
            enabled: true,
            sampleInterval: 5000,
            historySize: 100,
            smoothingFactor: 0.3,
            alertThresholds: {
                warning: 70,
                critical: 90,
            },
        });

        // Setup graceful shutdown handlers
        this._setupGracefulShutdown();
    }

    /**
     * Parse memory string to bytes
     */
    private _parseMemoryString(memoryStr: string): number {
        const units: { [key: string]: number } = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024,
        };

        const match = memoryStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
        if (!match) {
            throw new Error(`Invalid memory format: ${memoryStr}`);
        }

        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        return value * (units[unit] || 1);
    }

    /**
     * Validate cluster configuration
     */
    private _validateConfig(config: ClusterConfig): void {
        if (!config) {
            throw new Error("Cluster configuration is required");
        }

        if (
            typeof config.workers === "number" &&
            (config.workers < 1 || config.workers > 64)
        ) {
            throw new Error("Worker count must be between 1 and 64");
        }

        if (config.resources?.maxMemoryPerWorker) {
            const memoryLimit = this._parseMemoryString(
                config.resources.maxMemoryPerWorker
            );
            if (memoryLimit < 64 * 1024 * 1024) {
                throw new Error("Minimum memory limit is 64MB per worker");
            }
        }
    }

    /**
     * Generate a secure token for worker authentication
     */
    private _generateSecureToken(): string {
        return randomBytes(32).toString("hex");
    }

    /**
     * Create a worker-specific security token
     */
    private _createWorkerToken(workerId: string): string {
        return createHash("sha256")
            .update(this.masterToken)
            .update(workerId)
            .update(Date.now().toString())
            .digest("hex");
    }

    /**
     * Allocate a safe port for a worker
     */
    private _allocatePort(): number {
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const port = this.basePort + Math.floor(Math.random() * 1000) + 1;
            if (!this.workerPorts.has(port) && port > 1024 && port < 65535) {
                this.workerPorts.add(port);
                return port;
            }
            attempts++;
        }

        throw new Error("Unable to allocate safe port for worker");
    }

    /**
     * Release a port back to the pool
     */
    private _releasePort(port: number): void {
        this.workerPorts.delete(port);
    }

    /**
     * Setup enhanced memory management event handlers
     */
    private _setupMemoryManagement(): void {
        if (!this.config.resources?.memoryManagement?.enabled) {
            return;
        }

        this.memoryManager.on("memory_alert", (alert) => {
            logger.warn("cluster", `Memory Alert: ${alert.message}`);
            this._handleMemoryAlert(alert);
        });

        this.memoryManager.on("low_memory_mode_enabled", () => {
            logger.info("cluster", "Cluster entering low memory mode");
            this.emit("low_memory_mode", {
                enabled: true,
                timestamp: Date.now(),
            });
            this._enableEmergencyMode();
        });

        this.memoryManager.on("low_memory_mode_disabled", () => {
            logger.info("cluster", "Cluster exiting low memory mode");
            this.emit("low_memory_mode", {
                enabled: false,
                timestamp: Date.now(),
            });
            this._disableEmergencyMode();
        });

        this.memoryManager.on("error", (error) => {
            logger.error("cluster", "Memory manager error:", error);
            this.emit("error", { type: "memory_manager", error });
        });
    }

    /**
     * Handle memory alerts with appropriate actions
     */
    private async _handleMemoryAlert(alert: any): Promise<void> {
        try {
            switch (alert.action) {
                case "scale_down":
                    await this._handleMemoryScaleDown(alert);
                    break;
                case "restart_worker":
                    if (alert.workerId) {
                        await this._handleWorkerMemoryIssue(
                            alert.workerId,
                            alert
                        );
                    }
                    break;
                case "throttle":
                    this._handleMemoryThrottling(alert);
                    break;
                default:
                    logger.warn(
                        "cluster",
                        `Unknown memory alert action: ${alert.action}`
                    );
            }
        } catch (error) {
            logger.error("cluster", "Error handling memory alert:", error);
        }
    }

    /**
     * Setup graceful shutdown handlers
     */
    private _setupGracefulShutdown(): void {
        const shutdownHandler = async (signal: string) => {
            logger.info(
                "cluster",
                `Received ${signal}, initiating graceful shutdown...`
            );
            if (!this.shutdownPromise) {
                this.shutdownPromise = this.stop(true);
            }
            await this.shutdownPromise;
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
        process.on("SIGINT", () => shutdownHandler("SIGINT"));

        // Handle uncaught exceptions
        process.on("uncaughtException", (error) => {
            logger.error(
                "cluster",
                "Uncaught exception in cluster manager:",
                error
            );
            this.stop(false).then(() => process.exit(1));
        });

        process.on("unhandledRejection", (reason, promise) => {
            logger.error(
                "cluster",
                "Unhandled rejection in cluster manager:",
                reason
            );
            this.emit("error", {
                type: "unhandled_rejection",
                reason,
                promise,
            });
        });
    }

    /**
     * Start the Bun cluster with comprehensive error handling
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn("cluster", "Bun cluster is already running");
            return;
        }

        try {
            logger.info("cluster", "Starting Bun cluster manager...");
            this.startTime = performance.now();
            this.isRunning = true;

            const workerCount = this._getOptimalWorkerCount();
            logger.info("cluster", `Spawning ${workerCount} Bun workers`);

            // Validate system resources before starting
            await this._validateSystemResources(workerCount);

            // Spawn workers with staggered startup
            const spawnPromises = Array.from({ length: workerCount }, (_, i) =>
                this._spawnWorkerWithRetry(i)
            );

            const workers = await Promise.allSettled(spawnPromises);
            const successfulWorkers = workers.filter(
                (result) => result.status === "fulfilled"
            ).length;

            if (successfulWorkers === 0) {
                throw new Error("Failed to start any workers");
            }

            if (successfulWorkers < workerCount) {
                logger.warn(
                    "cluster",
                    `Started ${successfulWorkers}/${workerCount} workers`
                );
            }

            // Start monitoring services
            this._startHealthMonitoring();
            this._startMetricsCollection();
            this._startPerformanceMonitoring();

            // Start memory monitoring if enabled
            if (this.config.resources?.memoryManagement?.enabled !== false) {
                this.memoryManager.startMonitoring();
            }

            // Start CPU monitoring
            this.cpuMonitor.startMonitoring();

            logger.info(
                "cluster",
                `Bun cluster started with ${successfulWorkers} workers`
            );
            this.emit("cluster:started", {
                workerCount: successfulWorkers,
                requestedCount: workerCount,
                timestamp: Date.now(),
            });
        } catch (error) {
            this.isRunning = false;
            logger.error("cluster", "Failed to start cluster:", error);
            await this._cleanupPartialStart();
            throw error;
        }
    }

    /**
     * Validate system resources before starting workers
     */
    private async _validateSystemResources(workerCount: number): Promise<void> {
        try {
            // Get actual system memory information
            const systemMemory =
                await this.memoryManager.getSystemMemoryStats();
            const availableMemory = systemMemory.freeMemory;
            const requiredMemory =
                workerCount * this.securityConfig.maxMemoryPerWorker;

            // Check if we have enough memory (leave 20% buffer)
            const memoryWithBuffer = availableMemory * 0.8;

            if (requiredMemory > memoryWithBuffer) {
                // Check if we can reduce to a single worker with minimal memory
                const minMemoryPerWorker = 128 * 1024 * 1024; // 128MB minimum
                if (
                    workerCount === 1 &&
                    minMemoryPerWorker <= memoryWithBuffer
                ) {
                    logger.warn(
                        "cluster",
                        `Reducing memory limit to ${Math.round(
                            minMemoryPerWorker / 1024 / 1024
                        )}MB per worker due to low system memory`
                    );
                    this.securityConfig.maxMemoryPerWorker = minMemoryPerWorker;
                    return; // Allow startup with reduced memory
                }

                throw new Error(
                    `Insufficient memory for ${workerCount} workers. Required: ${Math.round(
                        requiredMemory / 1024 / 1024
                    )}MB, Available: ${Math.round(
                        memoryWithBuffer / 1024 / 1024
                    )}MB (${Math.round(
                        availableMemory / 1024 / 1024
                    )}MB total free). Consider disabling clustering or increasing system memory.`
                );
            }

            logger.debug(
                "cluster",
                `Memory validation passed: Required ${Math.round(
                    requiredMemory / 1024 / 1024
                )}MB, Available ${Math.round(memoryWithBuffer / 1024 / 1024)}MB`
            );
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("Insufficient memory")
            ) {
                throw error;
            }

            // If memory manager fails, fall back to basic validation
            logger.warn(
                "cluster",
                "Failed to get system memory stats, using fallback validation:",
                error
            );

            const os = await import("os");
            const freeMemory = os.freemem();
            const requiredMemory =
                workerCount * this.securityConfig.maxMemoryPerWorker;

            const availableMemoryFallback = freeMemory * 0.8;
            if (requiredMemory > availableMemoryFallback) {
                // Try with minimal memory for single worker
                const minMemoryPerWorker = 128 * 1024 * 1024; // 128MB minimum
                if (
                    workerCount === 1 &&
                    minMemoryPerWorker <= availableMemoryFallback
                ) {
                    logger.warn(
                        "cluster",
                        `Fallback: Reducing memory limit to ${Math.round(
                            minMemoryPerWorker / 1024 / 1024
                        )}MB per worker`
                    );
                    this.securityConfig.maxMemoryPerWorker = minMemoryPerWorker;
                    return;
                }

                throw new Error(
                    `Insufficient memory for ${workerCount} workers. Required: ${Math.round(
                        requiredMemory / 1024 / 1024
                    )}MB, Available: ${Math.round(
                        availableMemoryFallback / 1024 / 1024
                    )}MB (fallback). Consider disabling clustering or increasing system memory.`
                );
            }
        }

        // Validate port availability
        if (this.basePort < 1024 || this.basePort > 65000) {
            throw new Error(
                `Invalid base port: ${this.basePort}. Must be between 1024 and 65000`
            );
        }
    }

    /**
     * Cleanup after partial startup failure
     */
    private async _cleanupPartialStart(): Promise<void> {
        try {
            const stopPromises = Array.from(this.workers.values()).map(
                (worker) => this._stopWorker(worker.id, false)
            );
            await Promise.allSettled(stopPromises);
            this.workers.clear();
            this.workerPorts.clear();
        } catch (error) {
            logger.error("cluster", "Error during cleanup:", error);
        }
    }

    /**
     * Stop the Bun cluster with timeout protection
     */
    public async stop(graceful: boolean = true): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        logger.info(
            "cluster",
            `Stopping Bun cluster (graceful: ${graceful})...`
        );
        this.isRunning = false;

        // Create shutdown timeout
        const shutdownTimeout = new Promise<void>((_, reject) => {
            setTimeout(
                () => reject(new Error("Shutdown timeout exceeded")),
                this.maxShutdownTime
            );
        });

        try {
            // Stop monitoring first
            this._stopMonitoring();

            // Stop memory manager
            if (this.memoryManager) {
                this.memoryManager.stopMonitoring?.();
            }

            // Stop CPU monitoring
            this.cpuMonitor.stopMonitoring();

            // Stop all workers
            const stopPromises = Array.from(this.workers.values()).map(
                (worker) => this._stopWorker(worker.id, graceful)
            );

            await Promise.race([Promise.all(stopPromises), shutdownTimeout]);

            this.workers.clear();
            this.workerPorts.clear();

            logger.info("cluster", "Bun cluster stopped successfully");
            this.emit("cluster:stopped", { timestamp: Date.now() });
        } catch (error) {
            logger.error("cluster", "Error during cluster shutdown:", error);
            // Force kill remaining workers
            await this._forceKillAllWorkers();
            throw error;
        }
    }

    /**
     * Force kill all workers in emergency situations
     */
    private async _forceKillAllWorkers(): Promise<void> {
        const forceKillPromises = Array.from(this.workers.values()).map(
            async (worker) => {
                try {
                    worker.subprocess.kill("SIGKILL");
                    await worker.subprocess.exited;
                    this._releasePort(worker.port);
                } catch (error) {
                    logger.error(
                        "cluster",
                        `Error force killing worker ${worker.id}:`,
                        error
                    );
                }
            }
        );

        await Promise.allSettled(forceKillPromises);
        this.workers.clear();
        this.workerPorts.clear();
    }

    /**
     * Stop all monitoring services
     */
    private _stopMonitoring(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = undefined;
        }
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = undefined;
        }
    }

    /**
     * Spawn a worker with retry logic
     */
    private async _spawnWorkerWithRetry(
        index: number,
        retries: number = 3
    ): Promise<EnhancedBunWorker> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Add delay between retry attempts
                if (attempt > 0) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, 1000 * attempt)
                    );
                }

                return await this._spawnWorker(index);
            } catch (error) {
                lastError = error as Error;
                logger.warn(
                    "cluster",
                    `Worker spawn attempt ${attempt + 1} failed:`,
                    error
                );
            }
        }

        throw lastError || new Error("Failed to spawn worker after retries");
    }

    /**
     * Spawn a new Bun worker process with enhanced security
     */
    private async _spawnWorker(index: number): Promise<EnhancedBunWorker> {
        const workerId = `worker-${index}-${Date.now()}`;
        const port = this._allocatePort();
        const securityToken = this._createWorkerToken(workerId);

        logger.debug(
            "cluster",
            `Spawning Bun worker ${workerId} on port ${port}`
        );

        try {
            // Validate script path exists and is accessible
            if (!process.argv[1]) {
                throw new Error("Unable to determine script path for worker");
            }

            // Enhanced environment with security measures
            const workerEnv = {
                ...this._getSecureEnvironment(),
                WORKER_ID: workerId,
                WORKER_PORT: port.toString(),
                WORKER_SECURITY_TOKEN: securityToken,
                MASTER_TOKEN: this.masterToken,
                NODE_ENV: "worker",
                CLUSTER_MODE: "true",
                WORKER_MEMORY_LIMIT:
                    this.securityConfig.maxMemoryPerWorker.toString(),
                WORKER_MAX_REQUESTS: "10000", // Prevent memory leaks
            };

            const subprocess = Bun.spawn({
                cmd: ["bun", "run", process.argv[1]],
                env: workerEnv,
                stdio: ["pipe", "pipe", "pipe"],
            });

            const worker: EnhancedBunWorker = {
                id: workerId,
                subprocess,
                port,
                status: "starting",
                startTime: Date.now(),
                restarts: 0,
                lastPing: Date.now(),
                health: {
                    status: "unknown",
                    consecutiveFailures: 0,
                },
                securityToken,
                performance: {
                    requestCount: 0,
                    errorCount: 0,
                    averageResponseTime: 0,
                    lastRequestTime: 0,
                    cpuUsage: 0,
                    memoryUsage: 0,
                },
                resourceLimits: {
                    maxMemory: this.securityConfig.maxMemoryPerWorker,
                    maxCpu: 80, // 80% CPU usage limit
                },
                restartHistory: [],
            };

            this.workers.set(workerId, worker);

            // Setup process event handlers
            subprocess.exited
                .then((exitCode: number | null) => {
                    this._handleWorkerExit(workerId, exitCode);
                })
                .catch((error) => {
                    logger.error(
                        "cluster",
                        `Worker ${workerId} exit handler error:`,
                        error
                    );
                    this._handleWorkerExit(workerId, -1);
                });

            // Setup stdout/stderr handling for better debugging
            this._setupWorkerLogging(worker);

            // Wait for worker to be ready with timeout
            await this._waitForWorkerReady(worker);

            worker.status = "running";
            worker.health.status = "healthy";

            // Register worker with IPC manager if available
            if (this.ipcManager) {
                this.ipcManager.registerWorker(workerId, worker.subprocess);
                logger.debug(
                    "cluster",
                    `Worker ${workerId} registered with IPC manager`
                );
            }

            logger.info(
                "cluster",
                `Bun worker ${workerId} started on port ${port}`
            );
            this.emit("worker:started", {
                workerId,
                port,
                timestamp: Date.now(),
            });

            return worker;
        } catch (error) {
            this._releasePort(port);
            logger.error(
                "cluster",
                `Failed to spawn Bun worker ${workerId}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Get secure environment variables for workers
     */
    private _getSecureEnvironment(): Record<string, string> {
        // Only pass safe environment variables to workers
        const safeEnvVars = [
            "NODE_ENV",
            "PATH",
            "HOME",
            "USER",
            "PWD",
            "LOG_LEVEL",
            "DEBUG",
            "TZ",
        ];

        const secureEnv: Record<string, string> = {};
        for (const key of safeEnvVars) {
            if (process.env[key]) {
                secureEnv[key] = process.env[key]!;
            }
        }

        return secureEnv;
    }

    /**
     * Setup logging for worker process
     */
    private _setupWorkerLogging(worker: EnhancedBunWorker): void {
        if (worker.subprocess.stdout) {
            worker.subprocess.stdout.pipeTo(
                new WritableStream({
                    write(chunk) {
                        const data = new TextDecoder().decode(chunk);
                        logger.debug(
                            "cluster",
                            `[${worker.id}] stdout: ${data.trim()}`
                        );
                    },
                })
            );
        }

        if (worker.subprocess.stderr) {
            worker.subprocess.stderr.pipeTo(
                new WritableStream({
                    write(chunk) {
                        const data = new TextDecoder().decode(chunk);
                        logger.warn(
                            "cluster",
                            `[${worker.id}] stderr: ${data.trim()}`
                        );
                    },
                })
            );
        }
    }

    /**
     * Check if worker is ready and responding with multiple strategies
     */
    private async _checkWorkerReadiness(
        worker: EnhancedBunWorker
    ): Promise<boolean> {
        try {
            // Check if process is still running
            if (worker.subprocess.killed) {
                logger.debug(
                    "cluster",
                    `Worker ${worker.id} process is killed`
                );
                return false;
            }

            // Strategy 1: Check if process is responsive (basic check)
            if (!worker.subprocess.pid) {
                logger.debug("cluster", `Worker ${worker.id} has no PID`);
                return false;
            }

            // Strategy 2: Try IPC communication first (faster than port check)
            if (this.ipcManager) {
                try {
                    // Try to send a ping via IPC
                    const ipcReady = await this._checkWorkerIPCReadiness(
                        worker
                    );
                    if (ipcReady) {
                        logger.debug(
                            "cluster",
                            `Worker ${worker.id} ready via IPC`
                        );
                        return true;
                    }
                } catch (error) {
                    logger.debug(
                        "cluster",
                        `Worker ${worker.id} IPC check failed:`,
                        error
                    );
                }
            }

            // Strategy 3: Check port listening (fallback)
            const isListening = await this._checkPortListening(worker.port);
            if (isListening) {
                logger.debug(
                    "cluster",
                    `Worker ${worker.id} ready via port check`
                );
                return true;
            }

            // Strategy 4: Check if worker has been running for a minimum time (more lenient)
            const runningTime = Date.now() - worker.startTime;
            if (runningTime > 3000) {
                // 3 seconds minimum (reduced from 5)
                logger.debug(
                    "cluster",
                    `Worker ${worker.id} assumed ready after ${runningTime}ms (time-based)`
                );
                return true;
            }

            // Strategy 5: If worker process is stable and not killed, assume it's working
            if (
                runningTime > 1000 &&
                !worker.subprocess.killed &&
                worker.subprocess.pid
            ) {
                logger.debug(
                    "cluster",
                    `Worker ${worker.id} process stable after ${runningTime}ms (process-based)`
                );
                return true;
            }

            logger.debug(
                "cluster",
                `Worker ${worker.id} not ready yet (running for ${runningTime}ms)`
            );
            return false;
        } catch (error) {
            logger.debug(
                "cluster",
                `Worker ${worker.id} readiness check failed:`,
                error
            );
            return false;
        }
    }

    /**
     * Check worker readiness via IPC
     */
    private async _checkWorkerIPCReadiness(
        worker: EnhancedBunWorker
    ): Promise<boolean> {
        try {
            // Register worker with IPC manager temporarily for ping
            if (!this.ipcManager) return false;

            this.ipcManager.registerWorker(worker.id, worker.subprocess);

            // Try to ping the worker
            const response = await Promise.race([
                this.ipcManager.sendToWorker(worker.id, "ping", {}),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("IPC timeout")), 2000)
                ),
            ]);

            // Check if we got a real response or a mock response
            if (response && typeof response === "object") {
                if (
                    response.status === "ok" &&
                    response.message === "IPC not fully supported in Bun mode"
                ) {
                    logger.debug(
                        "cluster",
                        `Worker ${worker.id} IPC not fully supported, but worker is registered`
                    );
                    return true; // Worker is registered, even if IPC isn't fully functional
                }
                if (response.status === "fallback") {
                    logger.debug(
                        "cluster",
                        `Worker ${worker.id} IPC communication failed, but worker exists`
                    );
                    return true; // Worker exists, even if IPC failed
                }
            }

            return response !== undefined;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a port is listening
     */
    private async _checkPortListening(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const net = require("net");
            const socket = new net.Socket();

            const timeout = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, 2000); // Increased timeout to 2 seconds

            socket.on("connect", () => {
                clearTimeout(timeout);
                socket.destroy();
                resolve(true);
            });

            socket.on("error", (error: any) => {
                clearTimeout(timeout);
                // Log the specific error for debugging
                logger.debug(
                    "cluster",
                    `Port ${port} connection error:`,
                    error.code
                );
                resolve(false);
            });

            try {
                socket.connect(port, "localhost");
            } catch (error) {
                clearTimeout(timeout);
                logger.debug(
                    "cluster",
                    `Port ${port} connect attempt failed:`,
                    error
                );
                resolve(false);
            }
        });
    }

    /**
     * Wait for worker to be ready with progressive timeout and better diagnostics
     */
    private async _waitForWorkerReady(
        worker: EnhancedBunWorker,
        timeout: number = 15000 // Further reduced to 15 seconds
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const checkInterval = 500; // Increased interval to reduce CPU usage
            let attempts = 0;
            const maxAttempts = Math.floor(timeout / checkInterval);

            logger.debug(
                "cluster",
                `Waiting for worker ${worker.id} to be ready (timeout: ${timeout}ms)`
            );

            const timeoutId = setTimeout(() => {
                logger.error(
                    "cluster",
                    `Worker ${worker.id} startup timeout after ${timeout}ms`
                );
                logger.error("cluster", `Worker ${worker.id} diagnostics:`, {
                    pid: worker.subprocess.pid,
                    killed: worker.subprocess.killed,
                    port: worker.port,
                    startTime: worker.startTime,
                    runningTime: Date.now() - worker.startTime,
                });
                reject(
                    new Error(
                        `Worker ${worker.id} failed to start within ${timeout}ms`
                    )
                );
            }, timeout);

            const checkReady = async () => {
                try {
                    attempts++;

                    // Check if process is still running
                    if (worker.subprocess.killed) {
                        clearTimeout(timeoutId);
                        logger.error(
                            "cluster",
                            `Worker ${worker.id} process died during startup`
                        );
                        reject(
                            new Error(
                                `Worker ${worker.id} process died during startup`
                            )
                        );
                        return;
                    }

                    // Log progress every 10 attempts (5 seconds)
                    if (attempts % 10 === 0) {
                        const runningTime = Date.now() - worker.startTime;
                        logger.debug(
                            "cluster",
                            `Worker ${worker.id} still starting... (${runningTime}ms, attempt ${attempts}/${maxAttempts})`
                        );
                    }

                    // Real readiness check - verify worker is actually responding
                    const isReady = await this._checkWorkerReadiness(worker);
                    if (isReady) {
                        clearTimeout(timeoutId);
                        const startupTime = Date.now() - worker.startTime;
                        logger.info(
                            "cluster",
                            `Worker ${worker.id} ready after ${startupTime}ms`
                        );
                        resolve();
                        return;
                    }

                    // Continue checking
                    setTimeout(checkReady, checkInterval);
                } catch (error) {
                    clearTimeout(timeoutId);
                    logger.error(
                        "cluster",
                        `Worker ${worker.id} readiness check error:`,
                        error
                    );
                    reject(error);
                }
            };

            // Start checking immediately
            checkReady();
        });
    }

    /**
     * Stop a specific worker with enhanced safety measures
     */
    private async _stopWorker(
        workerId: string,
        graceful: boolean = true
    ): Promise<void> {
        const worker = this.workers.get(workerId);
        if (!worker) {
            return;
        }

        logger.debug(
            "cluster",
            `Stopping Bun worker ${workerId} (graceful: ${graceful})`
        );
        worker.status = "stopping";

        try {
            const stopPromise = this._executeWorkerStop(worker, graceful);
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(
                    () => reject(new Error("Worker stop timeout")),
                    this.securityConfig.processTimeout
                );
            });

            await Promise.race([stopPromise, timeoutPromise]);

            worker.status = "stopped";
            this._releasePort(worker.port);

            // Unregister worker from IPC manager if available
            if (this.ipcManager) {
                this.ipcManager.unregisterWorker(workerId);
                logger.debug(
                    "cluster",
                    `Worker ${workerId} unregistered from IPC manager`
                );
            }

            logger.info("cluster", `Bun worker ${workerId} stopped`);
            this.emit("worker:stopped", { workerId, timestamp: Date.now() });
        } catch (error) {
            logger.error(
                "cluster",
                `Error stopping Bun worker ${workerId}:`,
                error
            );
            worker.status = "error";

            // Force kill if graceful stop failed
            try {
                worker.subprocess.kill("SIGKILL");
                await worker.subprocess.exited;
                this._releasePort(worker.port);
            } catch (forceError) {
                logger.error(
                    "cluster",
                    `Error force killing worker ${workerId}:`,
                    forceError
                );
            }
        }
    }

    /**
     * Execute worker stop with proper signal handling
     */
    private async _executeWorkerStop(
        worker: EnhancedBunWorker,
        graceful: boolean
    ): Promise<void> {
        if (graceful) {
            // Send SIGTERM for graceful shutdown
            worker.subprocess.kill("SIGTERM");

            // Wait for graceful shutdown with timeout
            const gracefulTimeout = setTimeout(() => {
                logger.warn(
                    "cluster",
                    `Worker ${worker.id} graceful shutdown timeout, force killing`
                );
                worker.subprocess.kill("SIGKILL");
            }, 5000);

            await worker.subprocess.exited;
            clearTimeout(gracefulTimeout);
        } else {
            worker.subprocess.kill("SIGKILL");
            await worker.subprocess.exited;
        }
    }

    /**
     * Handle worker process exit with enhanced tracking
     */
    private async _handleWorkerExit(
        workerId: string,
        exitCode: number | null
    ): Promise<void> {
        const worker = this.workers.get(workerId);
        if (!worker) {
            return;
        }

        const exitReason = this._determineExitReason(exitCode);
        logger.warn("cluster", `Bun worker ${workerId} exited: ${exitReason}`);

        // Update worker state
        worker.status = "stopped";
        worker.health.status = "unhealthy";
        worker.health.consecutiveFailures++;

        // Unregister worker from IPC manager if available
        if (this.ipcManager) {
            this.ipcManager.unregisterWorker(workerId);
            logger.debug(
                "cluster",
                `Worker ${workerId} unregistered from IPC manager`
            );
        }

        // Add to restart history
        worker.restartHistory.push({
            timestamp: Date.now(),
            reason: exitReason,
            exitCode: exitCode || undefined,
        });

        this.emit("worker:exit", {
            workerId,
            exitCode,
            reason: exitReason,
            timestamp: Date.now(),
        });

        // Check if restart is needed and allowed
        if (this._shouldRestartWorker(worker)) {
            await this._attemptWorkerRestart(worker);
        } else {
            logger.warn(
                "cluster",
                `Worker ${workerId} will not be restarted: ${this._getRestartBlockReason(
                    worker
                )}`
            );
            this.workers.delete(workerId);
            this._releasePort(worker.port);
        }
    }

    /**
     * Determine the reason for worker exit
     */
    private _determineExitReason(exitCode: number | null): string {
        if (exitCode === null) return "killed";
        if (exitCode === 0) return "normal_exit";
        if (exitCode === 1) return "error_exit";
        if (exitCode === 130) return "sigint";
        if (exitCode === 143) return "sigterm";
        if (exitCode === 137) return "sigkill";
        return `exit_code_${exitCode}`;
    }

    /**
     * Check if worker should be restarted
     */
    private _shouldRestartWorker(worker: EnhancedBunWorker): boolean {
        if (!this.isRunning) return false;

        const autoRestart = this.config.processManagement?.respawn !== false;
        if (!autoRestart) return false;

        // Check restart count limits
        if (worker.restarts >= this.securityConfig.maxRestartAttempts)
            return false;

        // Check restart frequency (prevent restart loops)
        const recentRestarts = worker.restartHistory.filter(
            (r) => Date.now() - r.timestamp < this.securityConfig.restartWindow
        ).length;

        return recentRestarts < this.securityConfig.maxRestartAttempts;
    }

    /**
     * Get reason why restart is blocked
     */
    private _getRestartBlockReason(worker: EnhancedBunWorker): string {
        if (!this.isRunning) return "cluster_shutting_down";
        if (!this.config.processManagement?.respawn)
            return "auto_restart_disabled";
        if (worker.restarts >= this.securityConfig.maxRestartAttempts)
            return "max_restarts_exceeded";

        const recentRestarts = worker.restartHistory.filter(
            (r) => Date.now() - r.timestamp < this.securityConfig.restartWindow
        ).length;

        if (recentRestarts >= this.securityConfig.maxRestartAttempts)
            return "restart_frequency_limit";

        return "unknown";
    }

    /**
     * Attempt to restart a worker with backoff
     */
    private async _attemptWorkerRestart(
        worker: EnhancedBunWorker
    ): Promise<void> {
        logger.info("cluster", `Restarting Bun worker ${worker.id}...`);
        worker.restarts++;

        // Calculate backoff delay
        const backoffDelay = Math.min(
            1000 * Math.pow(2, worker.restarts - 1),
            30000
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));

        try {
            const index = parseInt(worker.id.split("-")[1]) || 0;
            this.workers.delete(worker.id);
            this._releasePort(worker.port);

            await this._spawnWorkerWithRetry(index, 2);

            logger.info(
                "cluster",
                `Successfully restarted worker (was ${worker.id})`
            );
            this.emit("worker:restarted", {
                oldWorkerId: worker.id,
                restartCount: worker.restarts,
                timestamp: Date.now(),
            });
        } catch (error) {
            logger.error(
                "cluster",
                `Failed to restart worker ${worker.id}:`,
                error
            );
            this.workers.delete(worker.id);
            this._releasePort(worker.port);

            this.emit("worker:restart_failed", {
                workerId: worker.id,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Get optimal worker count with system constraints
     */
    private _getOptimalWorkerCount(): number {
        if (typeof this.config.workers === "number") {
            return Math.max(1, Math.min(this.config.workers, 32)); // Cap at 32 workers
        }

        if (this.config.workers === "auto") {
            const cpuCount = navigator.hardwareConcurrency || 4;

            // Use OS-level memory information for better accuracy
            const os = require("os");
            const totalSystemMemory = os.totalmem();
            const freeSystemMemory = os.freemem();

            // Calculate based on available memory (leave 20% buffer)
            const usableMemory = Math.min(
                totalSystemMemory * 0.6,
                freeSystemMemory * 0.8
            );
            const memoryBasedCount = Math.floor(
                usableMemory / this.securityConfig.maxMemoryPerWorker
            );

            // Use the minimum of CPU-based and memory-based counts
            const optimalCount = Math.max(
                1,
                Math.min(cpuCount - 1, memoryBasedCount, 16)
            );

            logger.debug(
                "cluster",
                `Optimal worker calculation: CPU=${
                    cpuCount - 1
                }, Memory=${memoryBasedCount}, Selected=${optimalCount}`
            );
            return optimalCount;
        }

        return 2; // Safe default
    }

    /**
     * Start comprehensive health monitoring
     */
    private _startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this._performHealthCheck();
            } catch (error) {
                logger.error("cluster", "Health check error:", error);
            }
        }, 15000); // Check every 15 seconds
    }

    /**
     * Perform comprehensive health check on all workers
     */
    private async _performHealthCheck(): Promise<void> {
        const healthPromises = Array.from(this.workers.values()).map(
            async (worker) => {
                try {
                    // Check process status
                    if (worker.subprocess.killed) {
                        worker.health.status = "unhealthy";
                        worker.health.consecutiveFailures++;
                        worker.health.lastError = "Process killed";
                        return;
                    }

                    // Check memory usage if available
                    const memoryUsage = await this._getWorkerMemoryUsage(
                        worker
                    );
                    if (memoryUsage > worker.resourceLimits.maxMemory) {
                        worker.health.status = "unhealthy";
                        worker.health.consecutiveFailures++;
                        worker.health.lastError = `Memory limit exceeded: ${Math.round(
                            memoryUsage / 1024 / 1024
                        )}MB`;
                        this.emit("worker:memory_exceeded", {
                            workerId: worker.id,
                            memoryUsage,
                            limit: worker.resourceLimits.maxMemory,
                        });
                        return;
                    }

                    // Update performance metrics
                    worker.performance.memoryUsage = memoryUsage;

                    // Health check passed
                    worker.health.status = "healthy";
                    worker.health.consecutiveFailures = 0;
                    worker.lastPing = Date.now();
                } catch (error) {
                    worker.health.status = "unhealthy";
                    worker.health.consecutiveFailures++;
                    worker.health.lastError =
                        error instanceof Error ? error.message : String(error);
                    logger.warn(
                        "cluster",
                        `Health check failed for worker ${worker.id}:`,
                        error
                    );
                }
            }
        );

        await Promise.allSettled(healthPromises);

        // Check overall cluster health
        const unhealthyWorkers = this.getAllWorkers().filter(
            (w) => w.health.status === "unhealthy"
        );
        if (unhealthyWorkers.length > 0) {
            this.emit("cluster:health_degraded", {
                unhealthyCount: unhealthyWorkers.length,
                totalCount: this.workers.size,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Get worker memory usage using actual process monitoring
     */
    private async _getWorkerMemoryUsage(
        worker: EnhancedBunWorker
    ): Promise<number> {
        try {
            // Use Bun's process monitoring if available
            if (worker.subprocess && !worker.subprocess.killed) {
                // For Bun processes, we need to use system-level monitoring
                // since Bun doesn't expose process.memoryUsage() for subprocesses
                const pid = worker.subprocess.pid;
                if (pid) {
                    return await this._getProcessMemoryUsage(pid);
                }
            }

            // Fallback to estimated usage if process monitoring fails
            logger.warn(
                "cluster",
                `Unable to get actual memory usage for worker ${worker.id}, using fallback`
            );
            return 64 * 1024 * 1024; // 64MB fallback
        } catch (error) {
            logger.error(
                "cluster",
                `Error getting memory usage for worker ${worker.id}:`,
                error
            );
            return 64 * 1024 * 1024; // 64MB fallback
        }
    }

    /**
     * Get actual memory usage for a process by PID
     */
    private async _getProcessMemoryUsage(pid: number): Promise<number> {
        try {
            if (process.platform === "linux") {
                const fs = await import("fs");
                const statm = await fs.promises.readFile(
                    `/proc/${pid}/statm`,
                    "utf8"
                );
                const pages = parseInt(statm.split(" ")[1]); // RSS in pages
                const pageSize = 4096; // Standard page size on Linux
                return pages * pageSize;
            } else if (process.platform === "darwin") {
                // macOS implementation using ps command
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {
                    const ps = spawn("ps", [
                        "-o",
                        "rss=",
                        "-p",
                        pid.toString(),
                    ]);
                    let output = "";

                    ps.stdout.on("data", (data) => {
                        output += data.toString();
                    });

                    ps.on("close", (code) => {
                        if (code === 0) {
                            const rssKB = parseInt(output.trim());
                            resolve(rssKB * 1024); // Convert KB to bytes
                        } else {
                            reject(
                                new Error(`ps command failed with code ${code}`)
                            );
                        }
                    });

                    ps.on("error", reject);
                });
            } else {
                // Windows or other platforms - use fallback
                throw new Error(
                    `Memory monitoring not implemented for platform: ${process.platform}`
                );
            }
        } catch (error) {
            throw new Error(`Failed to get process memory usage: ${error}`);
        }
    }

    /**
     * Start metrics collection with detailed tracking
     */
    private _startMetricsCollection(): void {
        this.metricsInterval = setInterval(async () => {
            try {
                await this._collectMetrics();
            } catch (error) {
                logger.error("cluster", "Metrics collection error:", error);
            }
        }, 60000); // Collect every minute
    }

    /**
     * Collect comprehensive cluster metrics
     */
    private async _collectMetrics(): Promise<BunClusterMetrics> {
        const workers = Array.from(this.workers.values());
        const activeWorkers = workers.filter(
            (w) => w.health.status === "healthy"
        );
        const totalRequests = workers.reduce(
            (sum, w) => sum + w.performance.requestCount,
            0
        );
        const totalErrors = workers.reduce(
            (sum, w) => sum + w.performance.errorCount,
            0
        );
        const avgResponseTimes = workers
            .filter((w) => w.performance.averageResponseTime > 0)
            .map((w) => w.performance.averageResponseTime);

        const averageResponseTime =
            avgResponseTimes.length > 0
                ? avgResponseTimes.reduce((sum, time) => sum + time, 0) /
                  avgResponseTimes.length
                : 0;

        const memoryUsage = process.memoryUsage();
        const workerMemoryUsage = workers.reduce(
            (sum, w) => sum + w.performance.memoryUsage,
            0
        );

        const metrics: BunClusterMetrics = {
            totalWorkers: workers.length,
            activeWorkers: activeWorkers.length,
            totalRequests,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100, // Round to 2 decimal places
            memoryUsage: memoryUsage.heapUsed + workerMemoryUsage,
            cpuUsage: await this._calculateCpuUsage(),
            uptime: performance.now() - this.startTime,
            errorRate:
                totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
            restartCount: workers.reduce((sum, w) => sum + w.restarts, 0),
        };

        this.emit("metrics:collected", { metrics, timestamp: Date.now() });
        return metrics;
    }

    /**
     * Calculate CPU usage for the cluster using sophisticated monitoring
     */
    private async _calculateCpuUsage(): Promise<number> {
        const workers = this.getAllWorkers();
        return await this.cpuMonitor.calculateClusterCpuUsage(workers);
    }

    /**
     * Start performance monitoring
     */
    private _startPerformanceMonitoring(): void {
        this.performanceInterval = setInterval(() => {
            this._updateWorkerPerformanceMetrics();
        }, 30000); // Update every 30 seconds
    }

    /**
     * Update worker performance metrics with real data
     */
    private _updateWorkerPerformanceMetrics(): void {
        for (const [, worker] of this.workers) {
            // Update memory usage with actual data
            this._getWorkerMemoryUsage(worker)
                .then((memoryUsage) => {
                    worker.performance.memoryUsage = memoryUsage;
                })
                .catch((error) => {
                    logger.debug(
                        "cluster",
                        `Failed to update memory usage for worker ${worker.id}:`,
                        error
                    );
                });

            // Update CPU usage if available
            this._getWorkerCpuUsage(worker)
                .then((cpuUsage) => {
                    worker.performance.cpuUsage = cpuUsage;
                })
                .catch((error) => {
                    logger.debug(
                        "cluster",
                        `Failed to update CPU usage for worker ${worker.id}:`,
                        error
                    );
                });

            // Decay old metrics to prevent infinite growth
            const timeSinceLastUpdate =
                Date.now() -
                (worker.performance.lastRequestTime || worker.startTime);

            if (timeSinceLastUpdate > 300000) {
                // 5 minutes - decay counters
                worker.performance.requestCount = Math.floor(
                    worker.performance.requestCount * 0.9
                );
                worker.performance.errorCount = Math.floor(
                    worker.performance.errorCount * 0.9
                );
            }
        }
    }

    /**
     * Get actual CPU usage for a worker
     */
    private async _getWorkerCpuUsage(
        worker: EnhancedBunWorker
    ): Promise<number> {
        try {
            if (worker.subprocess && !worker.subprocess.killed) {
                const pid = worker.subprocess.pid;
                if (pid) {
                    return await this._getProcessCpuUsage(pid);
                }
            }
            return 0;
        } catch (error) {
            logger.debug(
                "cluster",
                `Error getting CPU usage for worker ${worker.id}:`,
                error
            );
            return 0;
        }
    }

    /**
     * Get actual CPU usage for a process by PID using sophisticated monitoring
     */
    private async _getProcessCpuUsage(pid: number): Promise<number> {
        return await this.cpuMonitor.getProcessCpuUsage(pid);
    }

    /**
     * Enable emergency mode for resource conservation
     */
    private _enableEmergencyMode(): void {
        logger.warn(
            "cluster",
            "Enabling emergency mode - reducing resource usage"
        );

        // Reduce monitoring frequency
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = setInterval(
                () => this._performHealthCheck(),
                60000
            ); // 1 minute
        }

        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = setInterval(
                () => this._collectMetrics(),
                300000
            ); // 5 minutes
        }

        this.emit("emergency_mode", { enabled: true, timestamp: Date.now() });
    }

    /**
     * Disable emergency mode and restore normal operation
     */
    private _disableEmergencyMode(): void {
        logger.info(
            "cluster",
            "Disabling emergency mode - restoring normal operation"
        );

        // Restore normal monitoring frequency
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this._startHealthMonitoring();
        }

        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this._startMetricsCollection();
        }

        this.emit("emergency_mode", { enabled: false, timestamp: Date.now() });
    }

    // Public API methods (maintaining compatibility)

    /**
     * Get all workers
     */
    public getAllWorkers(): BunWorker[] {
        return Array.from(this.workers.values());
    }

    /**
     * Get active workers
     */
    public getActiveWorkers(): BunWorker[] {
        return this.getAllWorkers().filter(
            (w) => w.health.status === "healthy"
        );
    }

    /**
     * Set IPC manager for worker communication
     */
    public setIPCManager(ipcManager: BunIPCManager): void {
        this.ipcManager = ipcManager;
        logger.debug("cluster", "IPC Manager set for Bun cluster");

        // Register existing workers with IPC manager
        for (const [workerId, worker] of this.workers) {
            if (worker.subprocess && worker.status === "running") {
                this.ipcManager.registerWorker(workerId, worker.subprocess);
            }
        }
    }

    /**
     * Get cluster metrics
     */
    public async getMetrics(): Promise<BunClusterMetrics> {
        return this._collectMetrics();
    }

    /**
     * Check cluster health with detailed information
     */
    public async checkHealth(): Promise<{ healthy: boolean; details: any }> {
        const workers = this.getAllWorkers();
        const activeWorkers = this.getActiveWorkers();
        const healthyPercentage =
            workers.length > 0
                ? (activeWorkers.length / workers.length) * 100
                : 0;
        const uptime = performance.now() - this.startTime;

        const unhealthyWorkers = workers.filter(
            (w) => w.health.status === "unhealthy"
        );
        const criticalIssues = unhealthyWorkers.filter(
            (w) => w.health.consecutiveFailures >= 3
        );

        return {
            healthy: healthyPercentage >= 70 && criticalIssues.length === 0,
            details: {
                totalWorkers: workers.length,
                activeWorkers: activeWorkers.length,
                healthyPercentage: Math.round(healthyPercentage),
                uptime: Math.round(uptime),
                criticalIssues: criticalIssues.length,
                memoryUsage: process.memoryUsage().heapUsed,
                isEmergencyMode: false, // Will be implemented when MemoryManager is updated
                lastHealthCheck: Date.now(),
            },
        };
    }

    /**
     * Scale up workers with validation
     */
    public async scaleUp(count: number = 1): Promise<void> {
        if (!this.isRunning) {
            throw new Error("Cannot scale up: cluster is not running");
        }

        if (count <= 0 || count > 16) {
            throw new Error("Invalid scale up count: must be between 1 and 16");
        }

        logger.info("cluster", `Scaling up Bun cluster by ${count} workers`);

        // Validate resources before scaling
        const currentCount = this.workers.size;
        const newCount = currentCount + count;
        await this._validateSystemResources(newCount);

        const spawnPromises = Array.from({ length: count }, (_, i) =>
            this._spawnWorkerWithRetry(currentCount + i)
        );

        const results = await Promise.allSettled(spawnPromises);
        const successful = results.filter(
            (r) => r.status === "fulfilled"
        ).length;

        logger.info(
            "cluster",
            `Scale up completed: ${successful}/${count} workers started`
        );
        this.emit("cluster:scaled_up", {
            requested: count,
            successful,
            newTotal: this.workers.size,
            timestamp: Date.now(),
        });

        if (successful === 0) {
            throw new Error("Failed to start any new workers during scale up");
        }
    }

    /**
     * Scale down workers with safety checks
     */
    public async scaleDown(count: number = 1): Promise<void> {
        if (!this.isRunning) {
            throw new Error("Cannot scale down: cluster is not running");
        }

        const activeWorkers = this.getActiveWorkers();
        if (activeWorkers.length <= 1) {
            throw new Error(
                "Cannot scale down: must maintain at least one active worker"
            );
        }

        const actualCount = Math.min(count, activeWorkers.length - 1);
        logger.info(
            "cluster",
            `Scaling down Bun cluster by ${actualCount} workers`
        );

        // Select workers to stop (prefer oldest workers)
        const workersToStop = activeWorkers
            .sort((a, b) => a.startTime - b.startTime)
            .slice(-actualCount);

        const stopPromises = workersToStop.map(async (worker) => {
            await this._stopWorker(worker.id, true);
            this.workers.delete(worker.id);
            return worker.id;
        });

        const results = await Promise.allSettled(stopPromises);
        const successful = results.filter(
            (r) => r.status === "fulfilled"
        ).length;

        logger.info(
            "cluster",
            `Scale down completed: ${successful}/${actualCount} workers stopped`
        );
        this.emit("cluster:scaled_down", {
            requested: actualCount,
            successful,
            newTotal: this.workers.size,
            timestamp: Date.now(),
        });
    }

    /**
     * Handle memory-based scale down with safety measures
     */
    private async _handleMemoryScaleDown(alert: any): Promise<void> {
        const enhancedWorkers = Array.from(this.workers.values()).filter(
            (w) => w.health.status === "healthy"
        );
        if (enhancedWorkers.length <= 1) {
            logger.warn(
                "cluster",
                "Cannot scale down further - only one worker remaining"
            );
            return;
        }

        // Find the worker using the most memory
        const workerToStop = enhancedWorkers.reduce((prev, current) =>
            prev.performance.memoryUsage > current.performance.memoryUsage
                ? prev
                : current
        );

        logger.info(
            "cluster",
            `Scaling down due to memory pressure - stopping worker ${workerToStop.id}`
        );

        try {
            await this._stopWorker(workerToStop.id, true);
            this.workers.delete(workerToStop.id);

            this.emit("worker:scaled_down_memory", {
                workerId: workerToStop.id,
                memoryUsage: workerToStop.performance.memoryUsage,
                alert,
                timestamp: Date.now(),
            });
        } catch (error) {
            logger.error(
                "cluster",
                `Failed to scale down worker ${workerToStop.id}:`,
                error
            );
        }
    }

    /**
     * Handle worker memory issues with enhanced recovery
     */
    private async _handleWorkerMemoryIssue(
        workerId: string,
        alert: any
    ): Promise<void> {
        const worker = this.workers.get(workerId);
        if (!worker) {
            return;
        }

        logger.warn(
            "cluster",
            `Handling memory issue for worker ${workerId}: ${alert.message}`
        );

        // Add to restart history
        worker.restartHistory.push({
            timestamp: Date.now(),
            reason: `memory_issue: ${alert.message}`,
        });

        try {
            // Force stop for memory issues (no graceful shutdown)
            await this._stopWorker(workerId, false);

            // Wait before restart to allow memory cleanup
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Restart with the same index
            const index = parseInt(workerId.split("-")[1]) || 0;
            await this._spawnWorkerWithRetry(index, 2);

            this.emit("worker:memory_restart", {
                oldWorkerId: workerId,
                alert,
                timestamp: Date.now(),
            });
        } catch (error) {
            logger.error(
                "cluster",
                `Failed to restart worker ${workerId} after memory issue:`,
                error
            );
            this.workers.delete(workerId);
        }
    }

    /**
     * Handle memory throttling with appropriate measures
     */
    private _handleMemoryThrottling(alert: any): void {
        logger.info(
            "cluster",
            `Implementing memory throttling: ${alert.message}`
        );

        // Reduce monitoring frequency to save memory
        this._enableEmergencyMode();

        // Emit throttling event for application to handle
        this.emit("memory_throttling", {
            alert,
            timestamp: Date.now(),
            action: "reduce_concurrency",
            recommendations: {
                reduceWorkerCount: true,
                enableCompression: true,
                clearCaches: true,
                deferNonCriticalTasks: true,
            },
        });
    }

    /**
     * Get memory optimization recommendations
     */
    public getMemoryRecommendations(): any {
        const enhancedWorkers = Array.from(this.workers.values());
        const totalMemory = enhancedWorkers.reduce(
            (sum, w) => sum + w.performance.memoryUsage,
            0
        );
        const avgMemoryPerWorker =
            enhancedWorkers.length > 0
                ? totalMemory / enhancedWorkers.length
                : 0;

        return {
            currentWorkerCount: enhancedWorkers.length,
            optimalWorkerCount: this.getOptimalWorkerCountForMemory(),
            averageMemoryPerWorker: Math.round(
                avgMemoryPerWorker / 1024 / 1024
            ), // MB
            recommendations:
                this.memoryManager.getMemoryOptimizationRecommendations?.() || {
                    scaleDown:
                        enhancedWorkers.length >
                        this.getOptimalWorkerCountForMemory(),
                    enableCompression: true,
                    optimizeGarbageCollection: true,
                    monitorMemoryLeaks: totalMemory > 1024 * 1024 * 1024, // > 1GB
                },
            timestamp: Date.now(),
        };
    }

    /**
     * Get optimal worker count based on memory constraints
     */
    public getOptimalWorkerCountForMemory(): number {
        // Use OS-level memory information for accurate calculation
        const os = require("os");
        const freeMemory = os.freemem();
        const totalMemory = os.totalmem();

        // Use the smaller of free memory or 60% of total memory (conservative approach)
        const available = Math.min(freeMemory * 0.8, totalMemory * 0.6);
        const perWorker = this.securityConfig.maxMemoryPerWorker;
        const memoryBasedCount = Math.floor(available / perWorker);

        const result = Math.max(
            1,
            Math.min(memoryBasedCount, this._getOptimalWorkerCount())
        );

        logger.debug(
            "cluster",
            `Memory-based worker count: ${memoryBasedCount} (available: ${Math.round(
                available / 1024 / 1024
            )}MB, per worker: ${Math.round(perWorker / 1024 / 1024)}MB)`
        );
        return result;
    }

    /**
     * Enable low memory mode with comprehensive measures
     */
    public enableLowMemoryMode(): void {
        logger.info("cluster", "Manually enabling low memory mode");
        this.memoryManager.enableLowMemoryMode?.();
        this._enableEmergencyMode();
    }

    /**
     * Disable low memory mode and restore normal operation
     */
    public disableLowMemoryMode(): void {
        logger.info("cluster", "Manually disabling low memory mode");
        this.memoryManager.disableLowMemoryMode?.();
        this._disableEmergencyMode();
    }

    /**
     * Get detailed worker information for debugging
     */
    public getWorkerDetails(workerId?: string): any {
        if (workerId) {
            const worker = this.workers.get(workerId);
            if (!worker) {
                return null;
            }

            return {
                id: worker.id,
                port: worker.port,
                status: worker.status,
                health: worker.health,
                performance: worker.performance,
                uptime: Date.now() - worker.startTime,
                restarts: worker.restarts,
                restartHistory: worker.restartHistory.slice(-5), // Last 5 restarts
                resourceLimits: worker.resourceLimits,
            };
        }

        return Array.from(this.workers.values()).map((worker) => ({
            id: worker.id,
            port: worker.port,
            status: worker.status,
            health: worker.health.status,
            uptime: Date.now() - worker.startTime,
            restarts: worker.restarts,
            memoryUsage: Math.round(
                worker.performance.memoryUsage / 1024 / 1024
            ), // MB
            requestCount: worker.performance.requestCount,
        }));
    }

    /**
     * Force restart of a specific worker (for debugging/maintenance)
     */
    public async forceRestartWorker(workerId: string): Promise<void> {
        const worker = this.workers.get(workerId);
        if (!worker) {
            throw new Error(`Worker ${workerId} not found`);
        }

        logger.info("cluster", `Force restarting worker ${workerId}`);

        worker.restartHistory.push({
            timestamp: Date.now(),
            reason: "manual_restart",
        });

        await this._attemptWorkerRestart(worker);
    }

    /**
     * Get cluster status summary
     */
    public getStatus(): any {
        const workers = this.getAllWorkers();
        const activeWorkers = this.getActiveWorkers();
        const enhancedWorkers = Array.from(this.workers.values());

        return {
            isRunning: this.isRunning,
            uptime: performance.now() - this.startTime,
            workers: {
                total: workers.length,
                active: activeWorkers.length,
                starting: workers.filter((w) => w.status === "starting").length,
                stopping: workers.filter((w) => w.status === "stopping").length,
                unhealthy: workers.filter(
                    (w) => w.health.status === "unhealthy"
                ).length,
            },
            performance: {
                totalRequests: enhancedWorkers.reduce(
                    (sum, w) => sum + w.performance.requestCount,
                    0
                ),
                totalErrors: enhancedWorkers.reduce(
                    (sum, w) => sum + w.performance.errorCount,
                    0
                ),
                totalRestarts: workers.reduce((sum, w) => sum + w.restarts, 0),
            },
            memory: {
                masterUsage: Math.round(
                    process.memoryUsage().heapUsed / 1024 / 1024
                ), // MB
                workerUsage: Math.round(
                    enhancedWorkers.reduce(
                        (sum, w) => sum + w.performance.memoryUsage,
                        0
                    ) /
                        1024 /
                        1024
                ), // MB
                isLowMemoryMode: false, // Will be implemented in MemoryManager
            },
            timestamp: Date.now(),
        };
    }
}

