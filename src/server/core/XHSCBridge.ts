import * as net from "node:net";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { initializeLogger, Logger } from "../../../shared/logger/Logger";
import { XyPrissRunner } from "../../sys/XyPrissRunner";
import { XyprissApp } from "./XyprissApp";
import { XHSCRequest, XHSCResponse } from "./XHSCProtocol";
import { Configs } from "../../config";
import { XHSCWorker } from "../../xhs/cluster/XHSCWorker";

/**
 * XHSCBridge - The high-performance bridge between Rust (XHSC) and Node.js.
 * Handles the IPC communication via Unix Domain Sockets.
 */
export class XHSCBridge {
    private socketPath: string;
    private server: net.Server | null = null;
    private runner: XyPrissRunner;
    private isServerRunning: boolean = false;
    private rustPid: number | null = null;
    private logger: Logger;

    constructor(private app: XyprissApp, logger?: Logger, socketPath?: string) {
        this.runner = new XyPrissRunner(process.cwd());
        this.socketPath = socketPath || this.defaultSocketPath();
        this.logger =
            logger ||
            (app as any).logger ||
            initializeLogger(Configs.get("logging"));
    }

    private defaultSocketPath(): string {
        const socketName = `xhsc-${Math.random()
            .toString(36)
            .substring(7)}.sock`;
        return path.join(os.tmpdir(), socketName);
    }

    /**
     * Start the XHSC Rust engine and the IPC bridge.
     */
    public async start(
        port: number = 3000,
        host: string = "127.0.0.1"
    ): Promise<void> {
        // 0. Check if we are a worker spawned by Rust
        if (process.env.XYPRISS_WORKER_ID) {
            this.logger.info(
                "cluster",
                `Worker ${process.env.XYPRISS_WORKER_ID} starting...`
            );
            const worker = new XHSCWorker(this.app);
            await worker.connect();
            return;
        }

        this.logger.info("server", "XHSC Bridge initializing...");

        // 1. Cleanup old socket
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }

        // 2. Logic for starting Rust Engine
        await this.startRustEngine(port, host);

        // 3. If not in clustering mode, this process acts as the single worker.
        // We need to connect to the Rust IPC Server we just started.
        const clusterConfig = Configs.get("cluster");

        if (!clusterConfig?.enabled) {
            this.logger.info(
                "cluster",
                "Single process mode: Connecting to XHSC IPC..."
            );
            process.env.XYPRISS_WORKER_ID = "master";
            process.env.XYPRISS_IPC_PATH = this.socketPath;

            const worker = new XHSCWorker(this.app);
            await worker.connect();
        }
    }

    private startRustEngine(port: number, host: string): Promise<void> {
        this.logger.info("server", "Starting XHSC engine...");
        return new Promise((resolve, reject) => {
            const binPath = (this.runner as any).binaryPath;
            let isResolved = false;

            // Extract settings from app config
            const clconf = Configs.get("cluster");
            const rmconf = Configs.get("requestManagement");

            const timeoutMs = rmconf?.timeout?.defaultTimeout || 30000;
            const timeoutSec = Math.floor(timeoutMs / 1000);
            const maxBodySize = rmconf?.payload?.maxBodySize || 10485760; // 10MB default

            // Fix for Rust SocketAddr parsing (does not support "localhost")
            const rustHost = host === "localhost" ? "127.0.0.1" : host;

            const args = [
                "server",
                "start",
                "--port",
                port.toString(),
                "--host",
                rustHost,
                "--ipc",
                this.socketPath,
            ];

            // Calculate the maximum possible timeout from all defined routes
            const routes = rmconf?.timeout?.routes || {};
            const routeTimeouts = Object.values(routes) as number[];
            const maxTimeoutMs = Math.max(timeoutMs, ...routeTimeouts, 0);
            const maxTimeoutSec = Math.ceil(maxTimeoutMs / 1000);

            if (rmconf?.timeout?.enabled !== false) {
                // We add a 2-second buffer to the Rust timeout to ensure Node.js
                // always has the chance to trigger its own onTimeout handlers first.
                const gatewayTimeout = maxTimeoutSec + 2;
                args.push("--timeout", gatewayTimeout.toString());
            } else {
                // If explicitly disabled, we pass 0.
                // NOTE: We updated the Rust core to treat 0 as infinite.
                args.push("--timeout", "0");
            }

            if (maxBodySize) {
                args.push("--max-body-size", maxBodySize.toString());
            }

            // Concurrency settings
            if (rmconf?.concurrency) {
                if (rmconf.concurrency.maxConcurrentRequests !== undefined) {
                    args.push(
                        "--max-concurrent-requests",
                        rmconf.concurrency.maxConcurrentRequests.toString()
                    );
                }
                if (rmconf.concurrency.maxPerIP !== undefined) {
                    args.push(
                        "--max-per-ip",
                        rmconf.concurrency.maxPerIP.toString()
                    );
                }
                if (rmconf.concurrency.maxQueueSize !== undefined) {
                    args.push(
                        "--max-queue-size",
                        rmconf.concurrency.maxQueueSize.toString()
                    );
                }
                if (rmconf.concurrency.queueTimeout !== undefined) {
                    args.push(
                        "--queue-timeout",
                        rmconf.concurrency.queueTimeout.toString()
                    );
                }
            }

            // Payload settings (Native)
            if (rmconf?.payload?.maxUrlLength) {
                args.push(
                    "--max-url-length",
                    rmconf.payload.maxUrlLength.toString()
                );
            }

            // Resilience settings (Circuit Breaker)
            if (rmconf?.resilience?.circuitBreaker) {
                const cb = rmconf.resilience.circuitBreaker;
                if (cb.enabled) {
                    args.push("--breaker-enabled");
                }
                if (cb.failureThreshold) {
                    args.push(
                        "--breaker-threshold",
                        cb.failureThreshold.toString()
                    );
                }
                if (cb.resetTimeout) {
                    args.push(
                        "--breaker-timeout",
                        Math.ceil(cb.resetTimeout / 1000).toString()
                    );
                }
            }

            // Resilience settings (Retry)
            if (rmconf?.resilience?.retryEnabled) {
                args.push(
                    "--retry-max",
                    (rmconf.resilience.maxRetries || 3).toString()
                );
                args.push(
                    "--retry-delay",
                    (rmconf.resilience.retryDelay || 100).toString()
                );
            }

            // Cluster settings
            if (clconf?.enabled) {
                args.push("--cluster");

                let workers = clconf?.workers;
                if (workers === "auto") {
                    workers = 0; // Rust handles 0 as auto
                }
                args.push("--cluster-workers", (workers || 0).toString());

                const respawn = clconf?.autoRespawn !== false;
                if (respawn) args.push("--cluster-respawn", "true");

                // Entry point detection
                const entryPoint = clconf?.entryPoint || process.argv[1];
                if (entryPoint) {
                    args.push("--entry-point", entryPoint);
                }

                if (clconf?.strategy) {
                    args.push("--cluster-strategy", clconf.strategy);
                }

                if (clconf?.resources?.maxMemory) {
                    let memMB = 0;
                    const mem = clconf.resources.maxMemory;
                    if (typeof mem === "number") {
                        memMB = mem;
                    } else {
                        const match = mem.match(/^(\d+)(MB|GB)?$/i);
                        if (match) {
                            memMB = parseInt(match[1]);
                            if (match[2]?.toUpperCase() === "GB") memMB *= 1024;
                        }
                    }
                    if (memMB > 0) {
                        args.push("--cluster-max-memory", memMB.toString());
                    }
                }

                if (clconf?.resources?.maxCpu) {
                    args.push(
                        "--cluster-max-cpu",
                        clconf.resources.maxCpu.toString()
                    );
                }
            }

            // Network Quality settings
            if (rmconf?.networkQuality?.enabled) {
                args.push("--quality-enabled");
                if (rmconf.networkQuality.rejectOnPoorConnection) {
                    args.push("--quality-reject-poor");
                }
                if (rmconf.networkQuality.minBandwidth) {
                    args.push(
                        "--quality-min-bw",
                        rmconf.networkQuality.minBandwidth.toString()
                    );
                }
                if (rmconf.networkQuality.maxLatency) {
                    args.push(
                        "--quality-max-lat",
                        rmconf.networkQuality.maxLatency.toString()
                    );
                }
            }

            this.logger.debug(
                "server",
                `Starting XHSC engine with args: ${args.join(" ")}`
            );
            const child = spawn(binPath, args, {
                stdio: ["ignore", "pipe", "pipe"],
                detached: true,
                env: { ...process.env, NO_COLOR: "1" },
            });

            // Buffer for handling split processing of chunks
            let stdoutBuffer = "";
            let stderrBuffer = "";

            this.rustPid = child.pid || null;
            this.logger.debug(
                "server",
                `XHSC Engine spawned with PID: ${this.rustPid}`
            );

            const processLog = (line: string, isError: boolean) => {
                if (!line.trim()) return;

                // Strip ALL ANSI escape codes (more robust regex)
                const cleanLine = line
                    .replace(
                        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
                        ""
                    )
                    .trim();

                // Regex for Rust tracing logs: handles optional ThreadId and source info
                const rustLogRegex =
                    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(INFO|WARN|ERROR)\s+(?:ThreadId\(\d+\)\s+)?(?:[\w\d_.-]+:\s+)?(?:[\/\w\d_.-]+:\d+:\s+)?(.*)$/;

                const match = cleanLine.match(rustLogRegex);
                let message = cleanLine;
                let level = isError ? "ERROR" : "INFO";

                if (match) {
                    level = match[2];
                    message = match[3];
                }

                // Internal Level Detection for Workers
                if (message.includes("[Worker ")) {
                    const upperMsg = message.toUpperCase();
                    // Detect custom levels in worker logs
                    if (
                        upperMsg.includes("[ERROR]") ||
                        upperMsg.includes("ERROR:")
                    ) {
                        level = "ERROR";
                    } else if (
                        upperMsg.includes("[WARN]") ||
                        upperMsg.includes("WARNING:") ||
                        upperMsg.includes("[SECURITY]")
                    ) {
                        level = "WARN";
                    }
                }

                // Check for startup success
                if (
                    !isResolved &&
                    message.includes("XHSC Edition listening on")
                ) {
                    isResolved = true;
                    resolve();
                }

                const prefix = "[XHSC]";
                const formattedMsg = message.startsWith("[")
                    ? message
                    : `${prefix} ${message}`;

                if (level === "ERROR") {
                    this.logger.error("server", formattedMsg);
                } else if (level === "WARN") {
                    this.logger.warn("server", formattedMsg);
                } else {
                    if (
                        message.includes("listening on") ||
                        message.includes("Worker ") ||
                        message.includes("worker_id=") ||
                        !match
                    ) {
                        this.logger.info("server", formattedMsg);
                    } else {
                        this.logger.debug("server", formattedMsg);
                    }
                }
            };

            const handleData = (data: any, isError: boolean) => {
                let buffer = isError ? stderrBuffer : stdoutBuffer;
                buffer += data.toString();

                const lines = buffer.split("\n");
                // Keep the last incomplete line in the buffer
                const lastLine = lines.pop() || "";

                if (isError) stderrBuffer = lastLine;
                else stdoutBuffer = lastLine;

                lines.forEach((line) => processLog(line, isError));
            };

            child.on("error", (err) => {
                this.logger.error(
                    "server",
                    `Failed to spawn XHSC Engine: ${err.message}`
                );
                if (!isResolved) {
                    isResolved = true;
                    reject(err);
                }
            });

            child.stdout?.on("data", (data) => handleData(data, false));
            child.stderr?.on("data", (data) => handleData(data, true));

            child.on("close", (code) => {
                if (code !== 0 && code !== null) {
                    // Process remaining buffers
                    if (stdoutBuffer) processLog(stdoutBuffer, false);
                    if (stderrBuffer) processLog(stderrBuffer, true);

                    this.logger.error(
                        "server",
                        `XHSC Engine exited with code ${code}`
                    );
                    this.isServerRunning = false;

                    if (!isResolved) {
                        isResolved = true;
                        // Check if it was an EADDRINUSE error
                        const combinedOutput = stdoutBuffer + stderrBuffer;
                        const error: any = new Error(
                            `XHSC Engine exited with code ${code}`
                        );
                        if (
                            combinedOutput.includes("Address already in use") ||
                            combinedOutput.includes("os error 98")
                        ) {
                            error.code = "EADDRINUSE";
                            error.address = host;
                            error.port = port;
                        }
                        reject(error);
                    }
                }
            });

            // Detach process but keep streams active
            child.unref();
            this.isServerRunning = true;
        });
    }

    private handleConnection(_socket: net.Socket): void {
        // Legacy: Handle connection is now managed by XHSCWorker
    }

    public stop(): void {
        if (this.rustPid) {
            this.logger.info(
                "server",
                `Bridge: Stopping XHSC engine (P${this.rustPid})...`
            );
            try {
                // Direct kill is more reliable during rapid shutdown than spawning a new process
                process.kill(this.rustPid, "SIGTERM");

                // Keep a small delay to allow the OS to process the signal before the main thread dies
                // (though process.kill is synchronous in terms of sending the signal)
            } catch (e: any) {
                // If the process is already gone, ESRCH is thrown. That's fine.
                if (e.code !== "ESRCH") {
                    this.logger.error(
                        "server",
                        "Bridge: Failed to stop XHSC engine",
                        e
                    );
                }
            }
        }

        if (this.server) {
            this.logger.debug("server", "Bridge: Stopping Node.js server...");
            this.server.close();
        }
        if (fs.existsSync(this.socketPath)) {
            try {
                this.logger.info("server", "Bridge: Removing IPC socket...");
                fs.unlinkSync(this.socketPath);
            } catch (e) {
                // Ignore unlink errors
            }
        }
        this.isServerRunning = false;
    }
}

