import * as net from "node:net";
import { initializeLogger, Logger } from "../../shared/logger/Logger";
import { decodeXbpRequest, encodeXbpResponse } from "./xbp";
import { Configs } from "../../ConfigurationManager";
import { XyprissApp } from "../../server/core/XyprissApp";
import { XHSCRequest, XHSCResponse } from "../../server/core/XHSCProtocol";
import { SUPPORTED_HTTP_METHODS } from "../../server/const/http";
import { XStatic } from "../../server/components/static/XStatic";

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
            `Worker ${this.workerId} connecting to XHSC.`,
        );

        this.logger.debug(
            "cluster",
            `Worker ${this.workerId} connecting to XHSC at ${this.ipcPath}...`,
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

        // Include fast-path static routes registered by XStatic
        let staticRoutes: any[] = [];
        try {
            staticRoutes = (XStatic as any)._routesToSync || [];
        } catch (e) {
            // Ignore if XStatic is not loaded
        }
        
        for (const route of staticRoutes) {
            payload.push({
                method: "GET",
                path: route.goRoutePath,
                target: "static",
                file_path: route.resolvedDir,
            });
            this.logger.debug(
                "cluster",
                `Worker ${this.workerId}: Synced fast-path static route to Go: ${route.goRoutePath} -> ${route.resolvedDir}`
            );
        }

        this.sendMessage({
            type: "SyncRoutes",
            payload: payload,
        });
    }

    private handleData(): void {
        let buffers: Buffer[] = [];
        let totalLength = 0;

        this.socket!.on("data", (data: Buffer) => {
            buffers.push(data);
            totalLength += data.length;

            while (totalLength >= 4) {
                // Peek at the first 4 bytes across buffers without full concatenation if possible
                let size = 0;
                if (buffers[0].length >= 4) {
                    size = buffers[0].readUInt32BE(0);
                } else {
                    // Force concat only if the 4-byte header spans multiple chunks
                    const headBuffer = Buffer.concat(buffers, totalLength);
                    buffers = [headBuffer];
                    size = headBuffer.readUInt32BE(0);
                }

                if (totalLength >= 4 + size) {
                    // We have a full frame. Ensure it's contiguous.
                    if (buffers.length > 1) {
                        buffers = [Buffer.concat(buffers, totalLength)];
                    }
                    const payload = buffers[0].subarray(4, 4 + size);
                    
                    // Keep the remaining part
                    const remaining = buffers[0].subarray(4 + size);
                    if (remaining.length > 0) {
                        buffers = [remaining];
                        totalLength = remaining.length;
                    } else {
                        buffers = [];
                        totalLength = 0;
                    }

                    try {
                        if (payload.length > 0 && payload[0] === 0x01) {
                            // Binary XBP Request
                            const reqPayload = decodeXbpRequest(payload);
                            this.dispatchToApp(reqPayload, true).catch((err) => {
                                this.logger.error("cluster", `Worker dispatch error: ${err}`);
                            });
                        } else {
                            const message = JSON.parse(payload as unknown as string);
                            if (message.type === "Request") {
                                this.dispatchToApp(message.payload, false).catch((err) => {
                                    this.logger.error("cluster", `Worker dispatch error: ${err}`);
                                });
                            } else if (message.type === "Ping") {
                                this.sendMessage({ type: "Pong", payload: {} });
                            } else if (message.type === "ForceGC") {
                                if (global.gc) global.gc();
                            }
                        }
                    } catch (e) {
                        this.logger.error("cluster", "Worker payload parse error", e);
                    }
                } else {
                    // Need more data
                    break;
                }
            }
        });
    }

    private async dispatchToApp(payload: any, isBinary: boolean = false): Promise<void> {
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
            if (isBinary) {
                const buf = encodeXbpResponse(id, statusCode, headers, bodyData);
                if (this.socket && !this.socket.destroyed) {
                    const headerBuf = Buffer.allocUnsafe(4);
                    headerBuf.writeUInt32BE(buf.length, 0);
                    this.socket.write(headerBuf);
                    this.socket.write(buf);
                }
            } else {
                const response = {
                    type: "Response",
                    payload: {
                        id,
                        status: statusCode,
                        headers: headers,
                        body: bodyData ? bodyData.toString("base64") : null,
                    },
                };
                this.sendMessage(response);
            }
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
        const payloadStr = JSON.stringify(message);
        const payloadLen = Buffer.byteLength(payloadStr);
        const buf = Buffer.allocUnsafe(4 + payloadLen);
        buf.writeUInt32BE(payloadLen, 0);
        buf.write(payloadStr, 4);

        if (this.socket && !this.socket.destroyed) {
            this.socket.write(buf);
        }
    }

    /**
     * Delegate a static file response to the Go (XHSC) engine.
     * This uses zero-copy streaming via sendfile() in Go.
     */
    public delegateStatic(
        requestId: string,
        filePath: string,
        options?: any,
    ): void {
        const message = {
            type: "XStatic",
            payload: {
                id: requestId,
                path: filePath,
                options: options || {},
            },
        };
        this.sendMessage(message);
    }
}

