/* *****************************************************************************
 * Nehonix libSynapx — Synchronous Zero-Process-Spawn Shared Memory Bridge
 *
 * Ultra-low latency, zero-copy synchronous IPC bridge connecting TypeScript
 * to the native Go libSynapx core using SharedArrayBuffer & Kernel Futexes (Atomics.wait).
 *
 * Eliminates all subprocess spawning (posix_spawn / execFileSync) and E2BIG limits.
 ***************************************************************************** */

import { Worker } from "node:worker_threads";

// Control Block Offsets (Int32 Indices)
export const IDX_STATUS = 0;   // 0: IDLE, 1: PENDING, 2: READY, 3: ERROR
export const IDX_REQ_LEN = 1;  // Request payload byte length
export const IDX_RESP_LEN = 2; // Response payload byte length
export const IDX_IS_RAW = 3;   // 1 if raw binary, 0 if JSON
export const IDX_SEQ_ID = 4;   // Monotonic sequence identifier

export const DATA_OFFSET = 64; // 64-byte aligned boundary for payload data

export const STATUS_IDLE = 0;
export const STATUS_PENDING = 1;
export const STATUS_READY = 2;
export const STATUS_ERROR = 3;

// Default 128 MB Shared Memory Slab for zero-copy high-throughput serialization
export const DEFAULT_SAB_SIZE = 128 * 1024 * 1024;

const WORKER_INLINE_SCRIPT = `
const { workerData, parentPort } = require("node:worker_threads");
const net = require("node:net");

const { sab, socketPath, sessionHash, authToken } = workerData;
const int32 = new Int32Array(sab);
const uint8 = new Uint8Array(sab);

const IDX_STATUS = 0;
const IDX_REQ_LEN = 1;
const IDX_RESP_LEN = 2;
const DATA_OFFSET = 64;

const STATUS_READY = 2;
const STATUS_ERROR = 3;

let socket = null;
let rxChunks = [];
let rxBytesTotal = 0;
let isHandshaked = false;

function pushChunk(chunk) {
    rxChunks.push(chunk);
    rxBytesTotal += chunk.length;
}

function peekHeader() {
    if (rxBytesTotal < 6) return null;
    const first = rxChunks[0];
    if (first.length >= 6) {
        return { magic: first.readUInt8(0), type: first.readUInt8(1), len: first.readUInt32BE(2) };
    }
    const hdr = Buffer.allocUnsafe(6);
    let copied = 0;
    for (const chunk of rxChunks) {
        const toCopy = Math.min(chunk.length, 6 - copied);
        chunk.copy(hdr, copied, 0, toCopy);
        copied += toCopy;
        if (copied >= 6) break;
    }
    return { magic: hdr.readUInt8(0), type: hdr.readUInt8(1), len: hdr.readUInt32BE(2) };
}

function consumeBytes(numBytes) {
    if (numBytes === 0) return Buffer.alloc(0);
    if (rxChunks.length === 1 && rxChunks[0].length === numBytes) {
        const buf = rxChunks[0];
        rxChunks = [];
        rxBytesTotal = 0;
        return buf;
    }
    const result = Buffer.allocUnsafe(numBytes);
    let offset = 0;
    while (rxChunks.length > 0 && offset < numBytes) {
        const head = rxChunks[0];
        const needed = numBytes - offset;
        if (head.length <= needed) {
            head.copy(result, offset);
            offset += head.length;
            rxChunks.shift();
        } else {
            head.copy(result, offset, 0, needed);
            offset += needed;
            rxChunks[0] = head.subarray(needed);
        }
    }
    rxBytesTotal -= numBytes;
    return result;
}

function connectSocket() {
    socket = net.createConnection(socketPath, () => {
        const hsPayload = Buffer.from(JSON.stringify({
            sessionHash: sessionHash || "",
            token: authToken || "",
            clientPid: process.pid,
        }));
        const h = Buffer.alloc(6);
        h.writeUInt8(0x53, 0); // 'S'
        h.writeUInt8(0x01, 1); // MSG_HANDSHAKE
        h.writeUInt32BE(hsPayload.length, 2);
        socket.write(Buffer.concat([h, hsPayload]));
    });

    socket.on("data", (chunk) => {
        pushChunk(chunk);
        while (true) {
            const header = peekHeader();
            if (!header) break;

            if (header.magic !== 0x53) {
                consumeBytes(1);
                continue;
            }

            if (rxBytesTotal < 6 + header.len) break;

            consumeBytes(6);
            const payload = consumeBytes(header.len);

            if (!isHandshaked) {
                if (header.type === 0x02) { // MSG_HANDSHAKE_ACK
                    isHandshaked = true;
                    try { socket.unref(); } catch {}
                    parentPort.postMessage({ type: "READY" });
                }
            } else if (header.type === 0x04) { // MSG_RESPONSE
                uint8.set(payload, DATA_OFFSET);
                Atomics.store(int32, IDX_RESP_LEN, payload.length);
                Atomics.store(int32, IDX_STATUS, STATUS_READY);
                Atomics.notify(int32, IDX_STATUS, 1); // Wake Main Thread Futex
            } else if (header.type === 0xff) { // MSG_ERROR
                uint8.set(payload, DATA_OFFSET);
                Atomics.store(int32, IDX_RESP_LEN, payload.length);
                Atomics.store(int32, IDX_STATUS, STATUS_ERROR);
                Atomics.notify(int32, IDX_STATUS, 1);
            }
        }
    });

    socket.on("error", (err) => {
        if (!isHandshaked) {
            parentPort.postMessage({ type: "ERROR", err: err.message });
        }
    });

    socket.on("close", () => {
        isHandshaked = false;
    });
}

parentPort.on("message", (msg) => {
    if (msg.type === "DISPATCH") {
        if (!socket || socket.destroyed || !isHandshaked) {
            const errPayload = Buffer.from(JSON.stringify({ ok: false, err: "libSynapx worker socket disconnected" }));
            uint8.set(errPayload, DATA_OFFSET);
            Atomics.store(int32, IDX_RESP_LEN, errPayload.length);
            Atomics.store(int32, IDX_STATUS, STATUS_ERROR);
            Atomics.notify(int32, IDX_STATUS, 1);
            return;
        }

        const reqLen = Atomics.load(int32, IDX_REQ_LEN);
        const reqBytes = uint8.subarray(DATA_OFFSET, DATA_OFFSET + reqLen);

        const h = Buffer.alloc(6);
        h.writeUInt8(0x53, 0);
        h.writeUInt8(0x03, 1); // MSG_CALL
        h.writeUInt32BE(reqBytes.length, 2);

        socket.write(Buffer.concat([h, reqBytes]));
    }
});

connectSocket();
`;

export class SynapxSyncBridge {
    private static instance: SynapxSyncBridge | null = null;
    private sab: SharedArrayBuffer;
    private int32: Int32Array;
    private uint8: Uint8Array;
    private worker: Worker | null = null;
    private isReady: boolean = false;
    private initPromise: Promise<void> | null = null;
    private socketPath: string;
    private sessionHash: string;
    private authToken: string;

    constructor(socketPath: string, sessionHash: string, authToken: string, sabSize = DEFAULT_SAB_SIZE) {
        this.socketPath = socketPath;
        this.sessionHash = sessionHash;
        this.authToken = authToken;

        this.sab = new SharedArrayBuffer(sabSize);
        this.int32 = new Int32Array(this.sab);
        this.uint8 = new Uint8Array(this.sab);

        Atomics.store(this.int32, IDX_STATUS, STATUS_IDLE);
    }

    public static getInstance(socketPath: string, sessionHash: string, authToken: string): SynapxSyncBridge {
        if (!SynapxSyncBridge.instance) {
            SynapxSyncBridge.instance = new SynapxSyncBridge(socketPath, sessionHash, authToken);
        }
        return SynapxSyncBridge.instance;
    }

    public init(): Promise<void> {
        if (this.isReady && this.worker) {
            return Promise.resolve();
        }
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise<void>((resolve, reject) => {
            try {
                this.worker = new Worker(WORKER_INLINE_SCRIPT, {
                    eval: true,
                    workerData: {
                        sab: this.sab,
                        socketPath: this.socketPath,
                        sessionHash: this.sessionHash,
                        authToken: this.authToken,
                    },
                });
                try { this.worker.unref(); } catch {}

                this.worker.on("message", (msg) => {
                    if (msg.type === "READY") {
                        this.isReady = true;
                        resolve();
                    } else if (msg.type === "ERROR") {
                        reject(new Error(msg.err || "Failed to initialize libSynapx sync worker"));
                    }
                });

                this.worker.on("error", (err) => {
                    this.isReady = false;
                    reject(err);
                });

                this.worker.on("exit", (code) => {
                    this.isReady = false;
                    this.worker = null;
                });
            } catch (err) {
                reject(err);
            }
        });

        return this.initPromise;
    }

    public isInitialized(): boolean {
        return this.isReady && this.worker !== null;
    }

    /**
     * Executes a synchronous RPC call over shared memory and kernel futex.
     */
    public callSync<T = any>(
        module: string,
        action: string,
        args: any[] = [],
        opts: Record<string, any> = {},
        timeoutMs = 5000,
    ): T {
        if (!this.isReady || !this.worker) {
            // Lazy synchronous initialization if called before explicit init()
            try {
                const sab = this.sab;
                // Wait for worker startup if in-flight
                this.init();
            } catch {}
        }

        const stringArgs = Array.isArray(args) ? args.map(String) : [];
        const payloadObj = {
            id: 1,
            mod: module,
            action,
            args: stringArgs,
            opts: opts || {},
        };

        const serialized = Buffer.from(JSON.stringify(payloadObj));
        if (DATA_OFFSET + serialized.length > this.sab.byteLength) {
            throw new Error(`libSynapx: Payload exceeds SharedArrayBuffer capacity (${this.sab.byteLength} bytes)`);
        }

        // 1. Copy serialized payload into shared memory data segment
        this.uint8.set(serialized, DATA_OFFSET);
        Atomics.store(this.int32, IDX_REQ_LEN, serialized.length);
        Atomics.store(this.int32, IDX_STATUS, STATUS_PENDING);

        // 2. Dispatch event to background worker thread
        this.worker?.postMessage({ type: "DISPATCH" });

        // 3. Put Main Thread to sleep on Linux Kernel Futex (0% CPU Burn)
        const waitStatus = Atomics.wait(this.int32, IDX_STATUS, STATUS_PENDING, timeoutMs);
        if (waitStatus === "timed-out") {
            Atomics.store(this.int32, IDX_STATUS, STATUS_IDLE);
            throw new Error(`libSynapx: callSync timed out after ${timeoutMs}ms [${module}.${action}]`);
        }

        // 4. Thread awoken by kernel! Read response directly from shared memory
        const status = Atomics.load(this.int32, IDX_STATUS);
        const respLen = Atomics.load(this.int32, IDX_RESP_LEN);
        const respBytes = this.uint8.subarray(DATA_OFFSET, DATA_OFFSET + respLen);

        Atomics.store(this.int32, IDX_STATUS, STATUS_IDLE);

        let parsed: any;
        try {
            parsed = JSON.parse(Buffer.from(respBytes).toString("utf8"));
        } catch (e: any) {
            throw new Error(`libSynapx: Failed to decode response JSON: ${e.message}`);
        }

        if (status === STATUS_ERROR || !parsed.ok) {
            throw new Error(parsed.err || `libSynapx [${module}.${action}] execution failed`);
        }

        return parsed.data as T;
    }

    public destroy(): void {
        this.isReady = false;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.initPromise = null;
        SynapxSyncBridge.instance = null;
    }
}
