/* *****************************************************************************
 * Nehonix libSynapx — TypeScript Client
 *
 * High-performance, persistent Zero-Trust IPC client connecting XyPriss
 * to the Go libSynapx engine over isolated Unix Domain Sockets / Named Pipes.
 ***************************************************************************** */

import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// Protocol Constants (matching libSynapx Go wire format)
export const MAGIC_BYTE = 0x53; // 'S'
export const MSG_HANDSHAKE = 0x01;
export const MSG_HANDSHAKE_ACK = 0x02;
export const MSG_CALL = 0x03;
export const MSG_RESPONSE = 0x04;
export const MSG_STREAM_CHUNK = 0x05;
export const MSG_STREAM_END = 0x06;
export const MSG_PING = 0x07;
export const MSG_PONG = 0x08;
export const MSG_ERROR = 0xff;

export const HEADER_SIZE = 6;

export interface SynapxResponse<T = any> {
    id: number;
    ok: boolean;
    data?: T;
    err?: string;
    payload?: string;
}

export interface PendingRequest {
    resolve: (val: any) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
}

/**
 * **SynapxClient**
 *
 * Persistent, multiplexed IPC client connecting TypeScript to the Go libSynapx core.
 */
export class SynapxClient {
    private static instance: SynapxClient | null = null;
    private socket: net.Socket | null = null;
    private connectingPromise: Promise<void> | null = null;
    private isHandshakeComplete: boolean = false;
    private sessionKey: string = "";
    private seqId: number = 0;
    private pendingCalls: Map<number, PendingRequest> = new Map();
    private rxBuffer: Buffer = Buffer.alloc(0);
    private socketPath: string;
    private sessionHash: string;
    private authToken: string;

    constructor(customSocketPath?: string) {
        const sessionDir =
            process.env.XYPRISS_USER_TMP ||
            process.env.XESS_SESSION_TMP ||
            "";

        this.sessionHash =
            process.env.XYPRISS_SESSION_HASH ||
            (sessionDir ? path.basename(sessionDir) : "");

        this.authToken =
            process.env.XYPRISS_INTERNAL_TOKEN ||
            process.env.XYPRISS_XESS_AUTH_TOKEN ||
            "";

        this.socketPath =
            customSocketPath ||
            (sessionDir ? path.join(sessionDir, "synapx.sock") : "");
    }

    /**
     * Singleton instance accessor bound to the active process session.
     */
    public static getInstance(socketPath?: string): SynapxClient {
        if (!SynapxClient.instance) {
            SynapxClient.instance = new SynapxClient(socketPath);
        }
        return SynapxClient.instance;
    }

    public getSocketPath(): string {
        return this.socketPath;
    }

    public isAvailable(): boolean {
        if (!this.socketPath) return false;
        try {
            return fs.existsSync(this.socketPath);
        } catch {
            return false;
        }
    }

    /**
     * Connects to the libSynapx server and performs the Zero-Trust handshake.
     */
    public async connect(): Promise<void> {
        if (this.socket && !this.socket.destroyed && this.isHandshakeComplete) {
            return;
        }

        if (this.connectingPromise) {
            return this.connectingPromise;
        }

        this.connectingPromise = new Promise<void>((resolve, reject) => {
            if (!this.socketPath) {
                return reject(
                    new Error(
                        "libSynapx: No active session socket path configured (XYPRISS_USER_TMP is unset)",
                    ),
                );
            }

            const client = net.createConnection(this.socketPath, () => {
                this.socket = client;
                this.performHandshake()
                    .then(() => {
                        this.isHandshakeComplete = true;
                        resolve();
                    })
                    .catch((err) => {
                        this.destroy();
                        reject(err);
                    });
            });

            client.on("data", (chunk: Buffer) => this.onData(chunk));

            client.on("error", (err: Error) => {
                if (!this.isHandshakeComplete) {
                    reject(err);
                }
                this.destroy();
            });

            client.on("close", () => {
                this.destroy();
            });
        }).finally(() => {
            this.connectingPromise = null;
        });

        return this.connectingPromise;
    }

    /**
     * Writes a framed packet to the socket.
     */
    private writeFrame(msgType: number, payload: Buffer): void {
        if (!this.socket || this.socket.destroyed) {
            throw new Error("libSynapx: socket is not connected");
        }

        const header = Buffer.alloc(HEADER_SIZE);
        header.writeUInt8(MAGIC_BYTE, 0);
        header.writeUInt8(msgType, 1);
        header.writeUInt32BE(payload.length, 2);

        this.socket.write(Buffer.concat([header, payload]));
    }

    /**
     * Performs initial zero-trust handshake.
     */
    private async performHandshake(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("libSynapx: Handshake timed out"));
            }, 3000);

            const hsPayload = Buffer.from(
                JSON.stringify({
                    sessionHash: this.sessionHash,
                    token: this.authToken,
                    clientPid: process.pid,
                }),
            );

            // Temporarily intercept handshake response frame
            const originalOnData = this.onData;
            this.onData = (chunk: Buffer) => {
                this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);

                while (this.rxBuffer.length >= HEADER_SIZE) {
                    if (this.rxBuffer.readUInt8(0) !== MAGIC_BYTE) {
                        clearTimeout(timeout);
                        this.onData = originalOnData;
                        return reject(
                            new Error("libSynapx: Invalid magic byte in handshake response"),
                        );
                    }

                    const msgType = this.rxBuffer.readUInt8(1);
                    const length = this.rxBuffer.readUInt32BE(2);

                    if (this.rxBuffer.length < HEADER_SIZE + length) {
                        return; // Wait for full frame
                    }

                    const payloadBuf = this.rxBuffer.subarray(
                        HEADER_SIZE,
                        HEADER_SIZE + length,
                    );
                    this.rxBuffer = this.rxBuffer.subarray(HEADER_SIZE + length);

                    clearTimeout(timeout);
                    this.onData = originalOnData;

                    if (msgType === MSG_HANDSHAKE_ACK) {
                        try {
                            const ack = JSON.parse(payloadBuf.toString("utf8"));
                            if (ack.auth) {
                                this.sessionKey = ack.sessionKey || "";
                                return resolve();
                            }
                            return reject(
                                new Error(`libSynapx: Handshake unauthorized: ${ack.err || "unknown"}`),
                            );
                        } catch (e: any) {
                            return reject(e);
                        }
                    } else {
                        return reject(
                            new Error(
                                `libSynapx: Expected HandshakeAck (0x02), received 0x${msgType.toString(16)}`,
                            ),
                        );
                    }
                }
            };

            try {
                this.writeFrame(MSG_HANDSHAKE, hsPayload);
            } catch (err) {
                clearTimeout(timeout);
                this.onData = originalOnData;
                reject(err);
            }
        });
    }

    /**
     * Processes incoming streamed chunks from the socket.
     */
    private onData(chunk: Buffer): void {
        this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);

        while (this.rxBuffer.length >= HEADER_SIZE) {
            if (this.rxBuffer.readUInt8(0) !== MAGIC_BYTE) {
                // Out of sync: purge until next magic byte or discard
                const nextMagic = this.rxBuffer.indexOf(MAGIC_BYTE, 1);
                if (nextMagic !== -1) {
                    this.rxBuffer = this.rxBuffer.subarray(nextMagic);
                } else {
                    this.rxBuffer = Buffer.alloc(0);
                }
                continue;
            }

            const msgType = this.rxBuffer.readUInt8(1);
            const length = this.rxBuffer.readUInt32BE(2);

            if (this.rxBuffer.length < HEADER_SIZE + length) {
                break; // Incomplete packet, wait for more data
            }

            const payloadBuf = this.rxBuffer.subarray(
                HEADER_SIZE,
                HEADER_SIZE + length,
            );
            this.rxBuffer = this.rxBuffer.subarray(HEADER_SIZE + length);

            this.dispatchIncomingFrame(msgType, payloadBuf);
        }
    }

    /**
     * Routes decoded incoming packets to pending call promises.
     */
    private dispatchIncomingFrame(msgType: number, payloadBuf: Buffer): void {
        switch (msgType) {
            case MSG_RESPONSE: {
                try {
                    const resp: SynapxResponse = JSON.parse(
                        payloadBuf.toString("utf8"),
                    );
                    const pending = this.pendingCalls.get(resp.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingCalls.delete(resp.id);
                        if (resp.ok) {
                            pending.resolve(resp.data);
                        } else {
                            pending.reject(
                                new Error(resp.err || "libSynapx operation failed"),
                            );
                        }
                    }
                } catch {}
                break;
            }
            case MSG_PONG:
                break;
            case MSG_ERROR: {
                try {
                    const errObj = JSON.parse(payloadBuf.toString("utf8"));
                    const errMsg = errObj.error || "libSynapx protocol error";
                    for (const [id, pending] of this.pendingCalls.entries()) {
                        clearTimeout(pending.timeout);
                        pending.reject(new Error(errMsg));
                    }
                    this.pendingCalls.clear();
                } catch {}
                break;
            }
        }
    }

    /**
     * Executes a multiplexed RPC call over the persistent private channel.
     */
    public async call<T = any>(
        module: string,
        action: string,
        args: string[] = [],
        timeoutMs: number = 10000,
    ): Promise<T> {
        await this.connect();

        const id = ++this.seqId;
        const callPayload = Buffer.from(
            JSON.stringify({
                id,
                mod: module,
                action,
                args,
            }),
        );

        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingCalls.delete(id);
                reject(
                    new Error(
                        `libSynapx: Call timed out after ${timeoutMs}ms [${module}.${action}]`,
                    ),
                );
            }, timeoutMs);

            this.pendingCalls.set(id, {
                resolve,
                reject,
                timeout,
            });

            try {
                this.writeFrame(MSG_CALL, callPayload);
            } catch (err: any) {
                clearTimeout(timeout);
                this.pendingCalls.delete(id);
                reject(err);
            }
        });
    }

    /**
     * Synchronous RPC fallback for legacy synchronous APIs via lightweight direct C-level execFileSync helper.
     */
    public callSync<T = any>(
        module: string,
        action: string,
        args: string[] = [],
    ): T {
        if (!this.socketPath) {
            throw new Error("libSynapx: socket path not configured");
        }

        const script = `
const net = require("net");
const sock = process.argv[1];
const mod = process.argv[2];
const act = process.argv[3];
const args = JSON.parse(process.argv[4] || "[]");
const hash = process.argv[5] || "";
const token = process.argv[6] || "";

const client = net.createConnection(sock, () => {
    // 1. Handshake
    const hs = Buffer.from(JSON.stringify({ sessionHash: hash, token: token, clientPid: process.pid }));
    const h1 = Buffer.alloc(6);
    h1.writeUInt8(0x53, 0);
    h1.writeUInt8(0x01, 1);
    h1.writeUInt32BE(hs.length, 2);
    client.write(Buffer.concat([h1, hs]));
});

let buf = Buffer.alloc(0);
let handshaked = false;

client.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 6) {
        if (buf.readUInt8(0) !== 0x53) { process.exit(1); }
        const type = buf.readUInt8(1);
        const len = buf.readUInt32BE(2);
        if (buf.length < 6 + len) return;
        const payload = buf.subarray(6, 6 + len);
        buf = buf.subarray(6 + len);

        if (!handshaked) {
            if (type === 0x02) {
                handshaked = true;
                const call = Buffer.from(JSON.stringify({ id: 1, mod: mod, action: act, args: args }));
                const h2 = Buffer.alloc(6);
                h2.writeUInt8(0x53, 0);
                h2.writeUInt8(0x03, 1);
                h2.writeUInt32BE(call.length, 2);
                client.write(Buffer.concat([h2, call]));
            } else { process.exit(1); }
        } else {
            if (type === 0x04) {
                process.stdout.write(payload);
                client.end();
                process.exit(0);
            } else { process.exit(1); }
        }
    }
});
setTimeout(() => process.exit(1), 3000);
`;
        const output = execFileSync(
            process.execPath,
            [
                "-e",
                script,
                this.socketPath,
                module,
                action,
                JSON.stringify(args),
                this.sessionHash,
                this.authToken,
            ],
            {
                encoding: "utf8",
                timeout: 3000,
                stdio: ["ignore", "pipe", "pipe"],
            },
        );

        const parsed = JSON.parse(output.trim());
        if (!parsed.ok) {
            throw new Error(parsed.err || "libSynapx call failed");
        }
        return parsed.data as T;
    }

    private destroy(): void {
        this.isHandshakeComplete = false;
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.destroy();
            this.socket = null;
        }
        for (const [id, pending] of this.pendingCalls.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("libSynapx: socket disconnected"));
        }
        this.pendingCalls.clear();
        this.rxBuffer = Buffer.alloc(0);
    }
}
