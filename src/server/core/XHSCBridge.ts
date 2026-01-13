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
        this.logger.info("server", "XHSC Bridge initializing...");

        // 1. Cleanup old socket
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }

        // 2. Start IPC Server (Node.js listens for Rust)
        this.server = net.createServer((socket) => {
            this.handleConnection(socket);
        });

        await new Promise<void>((resolve) => {
            this.server!.listen(this.socketPath, () => {
                this.logger.debug(
                    "server",
                    `Bridge IPC listening on ${this.socketPath}`
                );
                resolve();
            });
        });

        // 3. Start Rust Server in background and wait for it to be ready
        await this.startRustEngine(port, host);
    }

    private startRustEngine(port: number, host: string): Promise<void> {
        this.logger.info("server", "Starting XHSC engine...");
        return new Promise((resolve, reject) => {
            const binPath = (this.runner as any).binaryPath;
            let isResolved = false;

            // Extract settings from app config
            const configs = (this.app as any).configs;
            const timeoutMs =
                configs?.requestManagement?.timeout?.defaultTimeout || 30000;
            const timeoutSec = Math.floor(timeoutMs / 1000);
            const maxBodySize =
                configs?.requestManagement?.payload?.maxBodySize || 10485760; // 10MB default

            // Fix for Rust SocketAddr parsing (does not support "localhost")
            const rustHost = host === "localhost" ? "127.0.0.1" : host;

            const child = spawn(
                binPath,
                [
                    "server",
                    "start",
                    "--port",
                    port.toString(),
                    "--host",
                    rustHost,
                    "--ipc",
                    this.socketPath,
                    "--timeout",
                    timeoutSec.toString(),
                    "--max-body-size",
                    maxBodySize.toString(),
                ],

                {
                    stdio: ["ignore", "pipe", "pipe"],
                    detached: true,
                    env: { ...process.env, NO_COLOR: "1" },
                }
            );

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

                // Regex for Rust tracing logs
                const rustLogRegex =
                    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(INFO|WARN|ERROR)\s+ThreadId\(\d+\)\s+\d+:\s+(.*)$/;
                const match = line.match(rustLogRegex);
                let message = line;
                let level = isError ? "ERROR" : "INFO";

                if (match) {
                    level = match[2];
                    message = match[3];
                }

                // Check for startup success
                if (
                    !isResolved &&
                    message.includes("XHSC Edition listening on")
                ) {
                    isResolved = true;
                    resolve();
                }

                if (level === "ERROR") {
                    this.logger.error("server", `[XHSC] ${message}`);
                } else if (level === "WARN") {
                    this.logger.warn("server", `[XHSC] ${message}`);
                } else {
                    // INFO logs processing
                    if (
                        message.includes("launched on port") ||
                        message.includes("Initializing XHSC") ||
                        message.includes("XHSC Edition listening on")
                    ) {
                        this.logger.info("server", `[XHSC] ${message}`);
                    } else {
                        // Suppress other INFO logs to debug
                        this.logger.debug("server", `[XHSC] ${message}`);
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

    private handleConnection(socket: net.Socket): void {
        let buffer = Buffer.alloc(0);

        socket.on("data", async (data) => {
            buffer = Buffer.concat([buffer, data]);

            // Protocol: 4 bytes BE size + JSON payload
            while (buffer.length >= 4) {
                const size = buffer.readUInt32BE(0);
                if (buffer.length >= 4 + size) {
                    const payload = buffer.slice(4, 4 + size);
                    buffer = buffer.slice(4 + size);

                    try {
                        const message = JSON.parse(payload.toString());

                        if (message.type === "Request") {
                            await this.dispatchToApp(message.payload, socket);
                        } else if (message.type === "SyncRoutesHandshake") {
                            await this.handleSyncRoutes(socket);
                        } else {
                            this.logger.warn(
                                "server",
                                `Bridge received unknown message type: ${message.type}`
                            );
                        }
                    } catch (e) {
                        this.logger.error(
                            "server",
                            "Bridge payload parse error",
                            e
                        );
                    }
                } else {
                    break;
                }
            }
        });
    }

    private async handleSyncRoutes(socket: net.Socket): Promise<void> {
        this.logger.info(
            "server",
            "Bridge: Syncing routes with Rust engine..."
        );

        const httpServer = (this.app as any).httpServer;
        if (!httpServer) {
            this.logger.error(
                "server",
                "Bridge: Could not find httpServer in app"
            );
            return;
        }

        const rawRoutes = httpServer.getRoutes();
        const routes = rawRoutes
            .filter((r: any) => typeof r.path === "string") // matchit in Rust likes strings
            .map((r: any) => ({
                method: r.method,
                path: r.path.replace(/:([a-zA-Z0-9_$]+)/g, "{$1}"),
                target: r.target || "js",
                file_path: r.filePath,
            }));

        this.logger.debug(
            "server",
            `Bridge: Sending ${routes.length} routes to Rust`
        );

        const resPayload = Buffer.from(JSON.stringify(routes));
        const resSize = Buffer.alloc(4);
        resSize.writeUInt32BE(resPayload.length, 0);

        socket.write(resSize);
        socket.write(resPayload);
    }

    private async dispatchToApp(
        payload: any,
        ipcSocket: net.Socket
    ): Promise<void> {
        const { id, method, url } = payload;

        this.logger.debug(
            "server",
            `Bridge: Dispatching request ${method} ${url} (ID: ${id})`
        );

        // 1. Create Real Request Implementation
        const req = new XHSCRequest(payload, ipcSocket);
        (req as any).app = this.app;

        // 2. Create Real Response Implementation
        let responseSent = false;
        const res = new XHSCResponse(req, (bodyData, statusCode, headers) => {
            if (responseSent) return;
            responseSent = true;

            const response = {
                id,
                status: statusCode,
                headers: headers,
                body: bodyData ? Array.from(bodyData) : null,
            };

            const resPayload = Buffer.from(JSON.stringify(response));
            const resSize = Buffer.alloc(4);
            resSize.writeUInt32BE(resPayload.length, 0);

            ipcSocket.write(resSize);
            ipcSocket.write(resPayload);
        });

        // Execute through the app's HTTP server logic
        try {
            const httpServer = (this.app as any).httpServer;
            if (httpServer) {
                // Ensure the request and response are ready for middleware
                await httpServer.handleRequest(req as any, res as any);
            } else {
                (res as any).statusCode = 500;
                res.end("Internal Server Error: App not initialized");
            }
        } catch (err) {
            this.logger.error("server", `Bridge dispatch error: ${err}`);
            if (!responseSent) {
                (res as any).statusCode = 500;
                res.end("Internal Server Error");
            }
        }
    }

    public stop(): void {
        if (this.rustPid) {
            this.logger.info(
                "server",
                `Bridge: Stopping XHSC engine (${this.rustPid})...`
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

