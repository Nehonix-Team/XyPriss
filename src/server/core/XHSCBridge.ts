import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Logger } from "../../../shared/logger/Logger";
import { XyPrissRunner } from "../../sys/XyPrissRunner";
import { XyprissApp } from "./XyprissApp";

/**
 * XHSCBridge - The high-performance bridge between Rust (XHSC) and Node.js.
 * Handles the IPC communication via Unix Domain Sockets.
 */
export class XHSCBridge {
    private socketPath: string;
    private server: net.Server | null = null;
    private runner: XyPrissRunner;
    private isServerRunning: boolean = false;

    constructor(
        private app: XyprissApp,
        private logger: Logger,
        socketPath?: string
    ) {
        this.runner = new XyPrissRunner(process.cwd());
        this.socketPath = socketPath || this.defaultSocketPath();
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

        // 3. Start Rust Server in background
        this.startRustEngine(port, host);
    }

    private startRustEngine(port: number, host: string): void {
        // We use spawn for long-running process
        const { spawn } = require("node:child_process");
        const binPath = (this.runner as any).binaryPath; // Discovery logic

        const child = spawn(
            binPath,
            [
                "server",
                "start",
                "--port",
                port.toString(),
                "--host",
                host,
                "--ipc",
                this.socketPath,
            ],
            {
                stdio: "inherit",
                detached: true,
            }
        );

        child.unref();
        this.isServerRunning = true;
        this.logger.info(
            "server",
            `XHSC Engine (Rust) launched on port ${port}`
        );
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
                path: r.path,
                target: "js",
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
        socket: net.Socket
    ): Promise<void> {
        const { id, method, url, headers, query, params, body } = payload;

        this.logger.debug(
            "server",
            `Bridge: Dispatching request ${method} ${url} (ID: ${id})`
        );

        // 1. Create Mock Request
        const req: any = {
            method,
            url,
            headers,
            query,
            params,
            body: body ? Buffer.from(body) : undefined,
            path: url.split("?")[0],
            app: this.app,
            on: () => {}, // Mock event emitter if needed
            socket: { remoteAddress: "127.0.0.1" },
        };

        // 2. Create Mock Response
        let responseSent = false;
        const res: any = {
            statusCode: 200,
            headers: {},
            headersSent: false,
            locals: {},
            status(code: number) {
                this.statusCode = code;
                return this;
            },
            setHeader(name: string, value: string) {
                this.headers[name.toLowerCase()] = value;
                return this;
            },
            set(field: any, value?: any) {
                if (typeof field === "string") {
                    this.setHeader(field, value);
                } else {
                    for (const key in field) {
                        this.setHeader(key, field[key]);
                    }
                }
                return this;
            },
            send(data: any) {
                if (responseSent) return;
                this.finalize(data);
            },
            json(data: any) {
                if (responseSent) return;
                this.setHeader("Content-Type", "application/json");
                this.finalize(JSON.stringify(data));
            },
            finalize(bodyData: any) {
                responseSent = true;
                this.headersSent = true;

                const response = {
                    id,
                    status: this.statusCode,
                    headers: this.headers,
                    body: bodyData ? Buffer.from(bodyData).toJSON().data : null,
                };

                const resPayload = Buffer.from(JSON.stringify(response));
                const resSize = Buffer.alloc(4);
                resSize.writeUInt32BE(resPayload.length, 0);

                socket.write(resSize);
                socket.write(resPayload);
            },
            end(data: any) {
                this.send(data);
            },
        };

        // 3. Execute through the app's HTTP server logic
        try {
            const httpServer = (this.app as any).httpServer;
            if (httpServer) {
                // We bypass the real http.Server and use the internal handleRequest if possible
                // or we use a manual dispatch.
                // Since handleRequest is private in HttpServer, we might need a public method there.
                // For now, let's use the private method if it exists (hidden by TS but available in JS)
                await (httpServer as any).handleRequest(req, res);
            } else {
                res.status(500).send(
                    "Internal Server Error: App not initialized"
                );
            }
        } catch (err) {
            this.logger.error("server", `Bridge dispatch error: ${err}`);
            if (!responseSent) {
                res.status(500).send("Internal Server Error");
            }
        }
    }

    public stop(): void {
        if (this.server) {
            this.server.close();
        }
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
    }
}

