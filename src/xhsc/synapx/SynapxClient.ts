/* *****************************************************************************
 * Nehonix libSynapx — TypeScript Client
 *
 * High-performance, persistent Zero-Trust IPC client connecting XyPriss
 * to the Go libSynapx engine over isolated Unix Domain Sockets / Named Pipes.
 ***************************************************************************** */

import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync, spawn } from "node:child_process";

import { SynapxSyncBridge } from "./SynapxSyncBridge";
import { Platform } from "../utils/Platform";
import { Discovery } from "../utils/Discovery";
import { getInternalSignature } from "../../server/const/XHSC_SIGNATURE";
import { XessIpcClient } from "../api/env/XessIpcClient";

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
    private rxChunks: Buffer[] = [];
    private rxBytesTotal: number = 0;
    private socketPath: string;
    private sessionHash: string;
    private authToken: string;
    private syncBridge: SynapxSyncBridge | null = null;

    /**
     * Appends a newly received socket chunk to the internal accumulator.
     */
    private pushChunk(chunk: Buffer): void {
        this.rxChunks.push(chunk);
        this.rxBytesTotal += chunk.length;
    }

    /**
     * Peeks at the framing header without mutating or eagerly concatenating the chunk buffer.
     */
    private peekHeader(): { magic: number; msgType: number; length: number } | null {
        if (this.rxBytesTotal < HEADER_SIZE) return null;
        const first = this.rxChunks[0];
        if (first.length >= HEADER_SIZE) {
            return {
                magic: first.readUInt8(0),
                msgType: first.readUInt8(1),
                length: first.readUInt32BE(2),
            };
        }
        const hdr = Buffer.allocUnsafe(HEADER_SIZE);
        let copied = 0;
        for (const chunk of this.rxChunks) {
            const toCopy = Math.min(chunk.length, HEADER_SIZE - copied);
            chunk.copy(hdr, copied, 0, toCopy);
            copied += toCopy;
            if (copied >= HEADER_SIZE) break;
        }
        return {
            magic: hdr.readUInt8(0),
            msgType: hdr.readUInt8(1),
            length: hdr.readUInt32BE(2),
        };
    }

    /**
     * Consumes exactly numBytes from the front of the chunk list in a single fast copy.
     */
    private consumeBytes(numBytes: number): Buffer {
        if (numBytes === 0) return Buffer.alloc(0);
        if (this.rxChunks.length === 1 && this.rxChunks[0].length === numBytes) {
            const buf = this.rxChunks[0];
            this.rxChunks = [];
            this.rxBytesTotal = 0;
            return buf;
        }

        const result = Buffer.allocUnsafe(numBytes);
        let offset = 0;

        while (this.rxChunks.length > 0 && offset < numBytes) {
            const head = this.rxChunks[0];
            const needed = numBytes - offset;

            if (head.length <= needed) {
                head.copy(result, offset);
                offset += head.length;
                this.rxChunks.shift();
            } else {
                head.copy(result, offset, 0, needed);
                offset += needed;
                this.rxChunks[0] = head.subarray(needed);
            }
        }

        this.rxBytesTotal -= numBytes;
        return result;
    }

    /**
     * Resynchronizes stream by advancing past corrupt bytes to the next magic byte.
     */
    private discardUntilMagic(): boolean {
        while (this.rxChunks.length > 0) {
            const head = this.rxChunks[0];
            const idx = head.indexOf(MAGIC_BYTE);
            if (idx !== -1) {
                if (idx > 0) {
                    this.consumeBytes(idx);
                }
                return true;
            } else {
                this.rxBytesTotal -= head.length;
                this.rxChunks.shift();
            }
        }
        return false;
    }

    constructor(customSocketPath?: string) {
        const sessionDir =
            process.env.XYPRISS_USER_TMP || process.env.XESS_SESSION_TMP || "";

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

    private lastDaemonSpawnTime: number = 0;

    private resolveBinary(): string {
        const envPath = Discovery.getFromEnv("XYPRISS_XHSC_PATH");
        if (envPath) return envPath;

        const osPart = Platform.getOsPart();
        const archPart = Platform.getArchPart();
        const suffix = Platform.getBinarySuffix();

        const goBinName = `xhsc-${osPart}-${archPart}${suffix}`;
        const genericBinName = osPart === "windows" ? "xhsc.exe" : "xhsc";
        const candidates = [goBinName, genericBinName];

        const searchBases: string[] = [];
        const scriptDir = Discovery.getScriptDir();
        if (scriptDir) searchBases.push(scriptDir);
        searchBases.push(process.cwd());

        const resolved = Discovery.resolveBinary(candidates, searchBases);
        if (resolved) return resolved;

        return genericBinName;
    }

    /**
     * Ensures the confined xhsc background daemon is spawned inside the libXESS sandbox
     * if the IPC socket is not yet accessible.
     */
    public ensureDaemon(): void {
        if (this.isAvailable()) {
            return;
        }

        const sessionDir =
            process.env.XYPRISS_USER_TMP || process.env.XESS_SESSION_TMP;
        if (!sessionDir) {
            return;
        }

        if (Date.now() - this.lastDaemonSpawnTime < 3000) {
            return;
        }
        this.lastDaemonSpawnTime = Date.now();

        const binPath = this.resolveBinary();
        if (!binPath) {
            return;
        }

        const internalSig = getInternalSignature();
        let sessionKey = "";
        try {
            sessionKey = XessIpcClient.getActiveSessionKey();
        } catch {}

        try {
            const child = spawn(binPath, ["daemon", process.cwd()], {
                detached: true,
                stdio: "ignore",
                env: {
                    ...process.env,
                    ...(sessionKey ? { XYPRISS_XESS_SESSION_KEY: sessionKey } : {}),
                    ...(internalSig ? { XYPRISS_INTERNAL_TOKEN: internalSig } : {}),
                    NO_COLOR: "1",
                },
            });
            let childExited = false;
            child.on("exit", () => {
                childExited = true;
            });
            child.on("error", () => {
                childExited = true;
            });
            child.unref();

            // Wait for socket to appear (up to 1500ms)
            const start = Date.now();
            while (Date.now() - start < 1500) {
                if (this.isAvailable() || childExited) {
                    break;
                }
                try {
                    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
                } catch {
                    const t = Date.now() + 20;
                    while (Date.now() < t) {}
                }
            }
        } catch {
            // Silently allow fallback
        }
    }

    /**
     * Connects to the libSynapx server and performs the Zero-Trust handshake.
     */
    public async connect(): Promise<void> {
        if (this.socket && !this.socket.destroyed && this.isHandshakeComplete) {
            return;
        }

        if (!this.isAvailable()) {
            this.ensureDaemon();
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
                this.pushChunk(chunk);

                while (true) {
                    const header = this.peekHeader();
                    if (!header) return;

                    if (header.magic !== MAGIC_BYTE) {
                        clearTimeout(timeout);
                        this.onData = originalOnData;
                        return reject(
                            new Error(
                                "libSynapx: Invalid magic byte in handshake response",
                            ),
                        );
                    }

                    if (this.rxBytesTotal < HEADER_SIZE + header.length) {
                        return; // Wait for full frame
                    }

                    this.consumeBytes(HEADER_SIZE);
                    const payloadBuf = this.consumeBytes(header.length);

                    clearTimeout(timeout);
                    this.onData = originalOnData;

                    if (header.msgType === MSG_HANDSHAKE_ACK) {
                        try {
                            const ack = JSON.parse(payloadBuf.toString("utf8"));
                            if (ack.auth) {
                                this.sessionKey = ack.sessionKey || "";
                                try { this.socket?.unref(); } catch {}
                                return resolve();
                            }
                            return reject(
                                new Error(
                                    `libSynapx: Handshake unauthorized: ${ack.err || "unknown"}`,
                                ),
                            );
                        } catch (e: any) {
                            return reject(e);
                        }
                    } else {
                        return reject(
                            new Error(
                                `libSynapx: Expected HandshakeAck (0x02), received 0x${header.msgType.toString(16)}`,
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
        this.pushChunk(chunk);

        while (true) {
            const header = this.peekHeader();
            if (!header) break;

            if (header.magic !== MAGIC_BYTE) {
                this.consumeBytes(1);
                this.discardUntilMagic();
                continue;
            }

            if (this.rxBytesTotal < HEADER_SIZE + header.length) {
                break; // Incomplete packet, wait for more data
            }

            this.consumeBytes(HEADER_SIZE);
            const payloadBuf = this.consumeBytes(header.length);

            this.dispatchIncomingFrame(header.msgType, payloadBuf);
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
                                new Error(
                                    resp.err || "libSynapx operation failed",
                                ),
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
     * Executes a multiplexed RPC call over the persistent private channel with full args and options descriptors.
     */
    public async call<T = any>(
        module: string,
        action: string,
        args: any[] = [],
        opts: Record<string, any> = {},
        timeoutMs: number = 60000,
    ): Promise<T> {
        await this.connect();

        const stringArgs = Array.isArray(args)
            ? args.map((a) => String(a))
            : [];
        const id = ++this.seqId;
        const callPayload = Buffer.from(
            JSON.stringify({
                id,
                mod: module,
                action,
                args: stringArgs,
                opts: opts || {},
            }),
        );

        const effectiveTimeout = typeof opts?.timeout === "number" ? opts.timeout : timeoutMs;

        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingCalls.delete(id);
                reject(
                    new Error(
                        `libSynapx: Call timed out after ${effectiveTimeout}ms [${module}.${action}]`,
                    ),
                );
            }, effectiveTimeout);

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
     * Synchronous RPC via ultra-fast SharedArrayBuffer Futex Bridge (Path 1)
     * with transparent automatic fallback to stdin pipe subprocess on edge platforms.
     */
    public callSync<T = any>(
        module: string,
        action: string,
        args: any[] = [],
        opts: Record<string, any> = {},
    ): T {
        if (!this.socketPath || !fs.existsSync(this.socketPath)) {
            this.ensureDaemon();
            if (!this.socketPath || !fs.existsSync(this.socketPath)) {
                throw new Error(
                    `libSynapx: socket '${this.socketPath || "unknown"}' not found or active daemon is offline`,
                );
            }
        }

        try {
            if (!this.syncBridge) {
                this.syncBridge = SynapxSyncBridge.getInstance(
                    this.socketPath,
                    this.sessionHash,
                    this.authToken,
                );
            }
            return this.syncBridge.callSync<T>(module, action, args, opts);
        } catch {
            // Resilient fallback to stdin subprocess pipeline
            return this.callSyncSubprocess<T>(module, action, args, opts);
        }
    }

    /**
     * Subprocess-based synchronous fallback pipeline (streaming via stdin to prevent E2BIG).
     */
    public callSyncSubprocess<T = any>(
        module: string,
        action: string,
        args: any[] = [],
        opts: Record<string, any> = {},
    ): T {
        const stringArgs = Array.isArray(args)
            ? args.map((a) => String(a))
            : [];
        const script = `
const net = require("net");
const fs = require("fs");
const sock = process.argv[1];
const hash = process.argv[2] || "";
const token = process.argv[3] || "";

let inputData = "";
try {
    inputData = fs.readFileSync(0, "utf8");
} catch {}

const req = JSON.parse(inputData || "{}");
const mod = req.mod;
const act = req.action;
const args = req.args || [];
const opts = req.opts || {};

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
                const call = Buffer.from(JSON.stringify({ id: 1, mod: mod, action: act, args: args, opts: opts }));
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
setTimeout(() => process.exit(1), 5000);
`;
        const inputPayload = JSON.stringify({
            mod: module,
            action,
            args: stringArgs,
            opts: opts || {},
        });

        const output = execFileSync(
            process.execPath,
            [
                "-e",
                script,
                this.socketPath,
                this.sessionHash,
                this.authToken,
            ],
            {
                input: inputPayload,
                encoding: "utf8",
                timeout: 5000,
                maxBuffer: 100 * 1024 * 1024,
                stdio: ["pipe", "pipe", "pipe"],
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
        if (this.syncBridge) {
            this.syncBridge.destroy();
            this.syncBridge = null;
        }
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
        this.rxChunks = [];
        this.rxBytesTotal = 0;
    }
}

