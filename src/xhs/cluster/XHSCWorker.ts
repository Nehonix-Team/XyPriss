import * as net from "node:net";
import { initializeLogger, Logger } from "../../../shared/logger/Logger";
import { Configs } from "../../config";
import { XyprissApp } from "../../server/core/XyprissApp";
import { XHSCRequest, XHSCResponse } from "../../server/core/XHSCProtocol";
import { SUPPORTED_HTTP_METHODS } from "../../server/const/http";

/**
 * XHSCWorker - A Node.js worker instance that connects to the Go (XHSC) IPC server.
 * This is used when XyPriss is running in Clustering mode managed by Go.
 */
export class XHSCWorker {
    private socket: net.Socket | null = null;
    private logger: Logger;
    private workerId: string;
    private ipcPath: string;

    constructor(private app: XyprissApp) {
        this.logger =
            (app as any).logger || initializeLogger(Configs.get("logging"));
        this.workerId = process.env.XYPRISS_WORKER_ID || "unknown";
        this.ipcPath = process.env.XYPRISS_IPC_PATH || "";
    }

    /**
     * Connect to the Go IPC Server and start handling requests.
     */
    public async connect(): Promise<void> {
        if (!this.ipcPath) {
            throw new Error("XYPRISS_IPC_PATH environment variable is not set");
        }

        this.logger.info(
            "cluster",
            `Worker ${this.workerId} connecting to XHSC IPC.`,
        );

        this.logger.debug(
            "cluster",
            `Worker ${this.workerId} connecting to XHSC IPC at ${this.ipcPath}...`,
        );

        return new Promise((resolve, reject) => {
            let retries = 0;
            const maxRetries = 10;
            const retryDelay = 200;

            const tryConnect = () => {
                this.socket = net.connect(this.ipcPath, () => {
                    this.logger.info(
                        "cluster",
                        `Worker ${this.workerId} connected to XHSC`,
                    );
                    // Expose this worker to the app for delegation
                    (this.app as any)._xhscWorker = this;
                    this.register();
                    resolve();
                });

                this.socket.on("error", (err: any) => {
                    if (err.code === "ENOENT" && retries < maxRetries) {
                        retries++;
                        this.logger.debug(
                            "cluster",
                            `Worker ${this.workerId} IPC socket not ready, retrying in ${retryDelay}ms... (${retries}/${maxRetries})`,
                        );
                        setTimeout(tryConnect, retryDelay);
                        return;
                    }
                    this.logger.error(
                        "cluster",
                        `Worker ${this.workerId} IPC error: ${err.message}`,
                    );
                    reject(err);
                });

                this.socket.on("close", () => {
                    this.logger.warn(
                        "cluster",
                        `Worker ${this.workerId} IPC connection closed`,
                    );
                    process.exit(1); // Exit so Go can respawn us
                });

                this.handleData();
            };

            tryConnect();
        });
    }

    private register(): void {
        const message = {
            type: "RegisterWorker",
            payload: { id: this.workerId },
        };
        this.sendMessage(message);
        this.syncRoutes();
    }


    private syncRoutes(): void {
        const httpServer = (this.app as any).httpServer;
        if (!httpServer) return;

        const routes = httpServer.getRoutes();
        const payload = routes.map((r: any) => ({
            method: r.method,
            path: typeof r.path === "string" ? r.path : r.path.source,
            target: r.target || "worker",
            file_path: r.filePath,
        }));

        // Add catch-all routes for any unhandled paths to be sent to Node.js 404 handler
        // This ensures NotFoundHandler.ts can handle unknown routes even with XHSC engine
        const notFoundCfg = Configs.get("notFound");
        if (notFoundCfg?.enabled !== false) {
            for (const method of SUPPORTED_HTTP_METHODS) {
                payload.push({
                    method: method,
                    path: "/(.*)", // Catch-all regex pattern
                    target: "worker",
                    file_path: "",
                });
            }
            this.logger.debug(
                "cluster",
                `Worker ${this.workerId}: Synced 404 catch-all routes for handled methods`,
            );
        }

        this.sendMessage({
            type: "SyncRoutes",
            payload: payload,
        });
    }

    private handleData(): void {
        let buffer = Buffer.alloc(0);

        this.socket!.on("data", async (data: Buffer) => {
            buffer = Buffer.concat([buffer, data]);

            while (buffer.length >= 4) {
                const size = buffer.readUInt32BE(0);
                if (buffer.length >= 4 + size) {
                    const payload = buffer.slice(4, 4 + size);
                    buffer = buffer.slice(4 + size);

                    try {
                        const message = JSON.parse(payload.toString());
                        if (message.type === "Request") {
                            await this.dispatchToApp(message.payload);
                        } else if (message.type === "Ping") {
                            this.sendMessage({ type: "Pong", payload: {} });
                        } else if (message.type === "ForceGC") {
                            this.logger.info(
                                "cluster",
                                `Worker ${this.workerId} received ForceGC signal`,
                            );
                            if (global.gc) {
                                global.gc();
                                this.logger.info(
                                    "cluster",
                                    `Worker ${this.workerId} executed GC`,
                                );
                            } else {
                                this.logger.warn(
                                    "cluster",
                                    `Worker ${this.workerId} ignores ForceGC (GC not exposed)`,
                                );
                            }
                        }
                    } catch (e) {
                        this.logger.error(
                            "cluster",
                            "Worker payload parse error",
                            e,
                        );
                    }
                } else {
                    break;
                }
            }
        });
    }

    private async dispatchToApp(payload: any): Promise<void> {
        const { id, method, url } = payload;

        this.logger.debug(
            "cluster",
            `Worker ${this.workerId}: Handling ${method} ${url} (ID: ${id})`,
        );

        // Create Real Request Implementation
        const req = new XHSCRequest(payload, this.socket!);
        (req as any).app = this.app;

        // Create Real Response Implementation
        const res = new XHSCResponse(req, (bodyData, statusCode, headers) => {
            const response = {
                type: "Response",
                payload: {
                    id,
                    status: statusCode,
                    headers: headers,
                    body: bodyData ? Array.from(bodyData) : null,
                },
            };
            this.sendMessage(response);
        });

        try {
            const httpServer = (this.app as any).httpServer;
            if (httpServer) {
                await httpServer.handleRequest(req as any, res as any);
            } else {
                (res as any).statusCode = 500;
                res.end("Worker Error: App not initialized");
            }
        } catch (err) {
            this.logger.error("cluster", `Worker handling error: ${err}`);
        }
    }

    private sendMessage(message: any): void {
        const payload = Buffer.from(JSON.stringify(message));
        const size = Buffer.alloc(4);
        size.writeUInt32BE(payload.length, 0);

        if (this.socket && !this.socket.destroyed) {
            this.socket.write(size);
            this.socket.write(payload);
        }
    }
}

