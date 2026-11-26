/* *****************************************************************************
 * Nehonix libSynapx — Synchronous Zero-Process-Spawn Shared Memory Bridge
 *
 * Ultra-low latency, zero-copy synchronous IPC bridge connecting TypeScript
 * to the native Go libSynapx core using SharedArrayBuffer & Kernel Futexes (Atomics.wait).
 *
 * Eliminates all subprocess spawning (posix_spawn / execFileSync) and E2BIG limits.
 ***************************************************************************** */

import { Worker } from "node:worker_threads";
import {
    _JSONParse,
    _JSONStringify,
    _Uint8ArrayFill,
} from "../../utils/CorePathCheck";
import {
    getVerifiedCallerInfo,
    isImmediateInternalEngineCall,
} from "../../utils/ProjectDiscovery";
import { XNatSUDT } from "./NativeUnixSyncTransport";

// Control Block Offsets (Int32 Indices)
export const IDX_STATUS = 0;   // 0: IDLE, 1: PENDING, 2: READY, 3: ERROR
export const IDX_REQ_LEN = 1;  // Request payload byte length
export const IDX_RESP_LEN = 2; // Response payload byte length
export const IDX_IS_RAW = 3;   // 1 if raw binary, 0 if JSON
export const IDX_SEQ_ID = 4;   // Monotonic sequence identifier

export const DATA_OFFSET = 64; // 64-byte aligned boundary for payload data
export const FRAME_OFFSET = DATA_OFFSET - 6; // 6-byte binary frame header directly preceding payload

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
const FRAME_OFFSET = 58;

const STATUS_PENDING = 1;
const STATUS_READY = 2;
const STATUS_ERROR = 3;

let socket = null;
let rxChunks = [];
let rxBytesTotal = 0;
let isHandshaked = false;
let pendingDispatch = false;

function wakeWithError(errMsg) {
    if (Atomics.load(int32, IDX_STATUS) !== STATUS_PENDING) return;
    const errBuf = Buffer.from(JSON.stringify({ id: 1, ok: false, err: errMsg }));
    uint8.set(errBuf, DATA_OFFSET);
    Atomics.store(int32, IDX_RESP_LEN, errBuf.length);
    Atomics.store(int32, IDX_STATUS, STATUS_ERROR);
    Atomics.notify(int32, IDX_STATUS, 1);
}

function flushDispatch() {
    if (!socket || socket.destroyed || !isHandshaked) return;
    const reqLen = Atomics.load(int32, IDX_REQ_LEN);
    // Zero-copy write: 6-byte header was written at FRAME_OFFSET (58..63) by main thread
    const frameSlice = uint8.subarray(FRAME_OFFSET, DATA_OFFSET + reqLen);
    socket.write(frameSlice);
}

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
    rxChunks = [];
    rxBytesTotal = 0;
    socket = net.createConnection(socketPath, () => {
        try { socket.setNoDelay(true); } catch {}
        const hsPayload = Buffer.from(JSON.stringify({
            sessionHash: sessionHash || "",
            token: authToken || "",
            clientPid: process.pid,
        }));
        const frame = Buffer.allocUnsafe(6 + hsPayload.length);
        frame.writeUInt8(0x53, 0); // 'S'
        frame.writeUInt8(0x01, 1); // MSG_HANDSHAKE
        frame.writeUInt32BE(hsPayload.length, 2);
        hsPayload.copy(frame, 6);
        socket.write(frame);
    });

    socket.on("data", (chunk) => {
        // Fast path: complete single-frame response on hot path (0 allocations)
        if (rxBytesTotal === 0 && isHandshaked && chunk.length >= 6 && chunk[0] === 0x53) {
            const type = chunk[1];
            const len = ((chunk[2] << 24) | (chunk[3] << 16) | (chunk[4] << 8) | chunk[5]) >>> 0;
            if (chunk.length === 6 + len && (type === 0x04 || type === 0xff)) {
                uint8.set(chunk.subarray(6, 6 + len), DATA_OFFSET);
                Atomics.store(int32, IDX_RESP_LEN, len);
                Atomics.store(int32, IDX_STATUS, type === 0x04 ? STATUS_READY : STATUS_ERROR);
                Atomics.notify(int32, IDX_STATUS, 1);
                return;
            }
        }

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
                    if (pendingDispatch) {
                        pendingDispatch = false;
                        flushDispatch();
                    }
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
        wakeWithError("libSynapx socket error: " + err.message);
    });

    socket.on("close", () => {
        isHandshaked = false;
        wakeWithError("libSynapx socket closed unexpectedly");
    });
}

parentPort.on("message", (msg) => {
    if (msg.type === "DISPATCH") {
        if (!socket || socket.destroyed) {
            pendingDispatch = true;
            connectSocket();
            return;
        }
        if (!isHandshaked) {
            pendingDispatch = true;
            return;
        }
        flushDispatch();
    }
});

connectSocket();
`;

export class SynapxSyncBridge {
    private static instance: SynapxSyncBridge | null = null;
    private sab!: SharedArrayBuffer;
    private int32!: Int32Array;
    private uint8!: Uint8Array;
    /**
     * @see XSA-XESS-027 Hardened with native ES private fields against prototype hooking
     */
    #worker: Worker | null = null;
    #isReady: boolean = false;
    #initPromise: Promise<void> | null = null;
    #socketPath: string;
    #sessionHash: string;
    #authToken: string;
    #sabSize: number;
    #sabBuf!: Buffer;
    #sabAllocated: boolean = false;
    #nativeTransport: XNatSUDT | null = null;

    constructor(
        socketPath: string,
        sessionHash: string,
        authToken: string,
        sabSize = DEFAULT_SAB_SIZE,
    ) {
        this.#socketPath = socketPath;
        this.#sessionHash = sessionHash;
        this.#authToken = authToken;
        this.#sabSize = sabSize;

        // Fast-path: direct synchronous POSIX Unix socket via bun:ffi (no Worker, no postMessage, no 128MB SAB)
        this.#nativeTransport = XNatSUDT.tryCreate(
            socketPath,
            sessionHash,
            authToken,
        );
        if (!this.#nativeTransport) {
            this.#ensureSabAllocated();
        }
    }

    #ensureSabAllocated(): void {
        if (this.#sabAllocated) return;
        this.sab = new SharedArrayBuffer(this.#sabSize);
        this.int32 = new Int32Array(this.sab);
        this.uint8 = new Uint8Array(this.sab);
        this.#sabBuf = Buffer.from(this.sab);
        Atomics.store(this.int32, IDX_STATUS, STATUS_IDLE);
        this.#sabAllocated = true;
    }

    public static getInstance(
        socketPath: string,
        sessionHash: string,
        authToken: string,
    ): SynapxSyncBridge {
        if (!SynapxSyncBridge.instance) {
            SynapxSyncBridge.instance = new SynapxSyncBridge(
                socketPath,
                sessionHash,
                authToken,
            );
        }
        return SynapxSyncBridge.instance;
    }

    public init(): Promise<void> {
        if (this.#nativeTransport) {
            return Promise.resolve();
        }
        this.#ensureSabAllocated();
        if (this.#isReady && this.#worker) {
            return Promise.resolve();
        }
        if (this.#initPromise) {
            return this.#initPromise;
        }

        this.#initPromise = new Promise<void>((resolve, reject) => {
            try {
                this.#worker = new Worker(WORKER_INLINE_SCRIPT, {
                    eval: true,
                    workerData: {
                        sab: this.sab,
                        socketPath: this.#socketPath,
                        sessionHash: this.#sessionHash,
                        authToken: this.#authToken,
                    },
                });
                try {
                    this.#worker.unref();
                } catch {}

                this.#worker.on("message", (msg) => {
                    if (msg.type === "READY") {
                        this.#isReady = true;
                        resolve();
                    } else if (msg.type === "ERROR") {
                        reject(
                            new Error(
                                msg.err ||
                                    "Failed to initialize libSynapx sync worker",
                            ),
                        );
                    }
                });

                this.#worker.on("error", (err) => {
                    this.#isReady = false;
                    reject(err);
                });

                this.#worker.on("exit", (code) => {
                    this.#isReady = false;
                    this.#worker = null;
                });
            } catch (err) {
                reject(err);
            }
        });

        return this.#initPromise;
    }

    public isInitialized(): boolean {
        return this.#isReady && this.#worker !== null;
    }

    /**
     * Executes a synchronous RPC call over shared memory and kernel futex.
     *
     * @see XSA-XESS-021 In-transit secret protection via frozen JSON/Uint8 primordials
     * @see XSA-XESS-022 Caller verification to prevent raw SynapxSyncBridge RPC from untrusted callers
     * @see XSA-XESS-027 Hardened with native ES private fields against prototype hooking
     */
    public callSync<T = any>(
        module: string,
        action: string,
        args: any[] = [],
        opts: Record<string, any> = {},
        timeoutMs = 5000,
    ): T {
        const callerInfo = getVerifiedCallerInfo();
        if (callerInfo.isUntrusted || !isImmediateInternalEngineCall()) {
            throw new Error("libSynapx: Unauthorized caller for bridge");
        }

        // Fast-path: native POSIX synchronous Unix socket (bun:ffi)
        if (this.#nativeTransport) {
            try {
                return this.#nativeTransport.callSync<T>(
                    module,
                    action,
                    args,
                    opts,
                    timeoutMs,
                );
            } catch (err: any) {
                const msg = String(err?.message || "");
                // Propagate genuine daemon application/security errors directly; only fallback on transport failure
                if (
                    !msg.includes("FFI socket connect failed") &&
                    !msg.includes("FFI synchronous RPC failed")
                ) {
                    throw err;
                }
                // Disable broken native transport and fall back cleanly to Worker SAB bridge
                this.#nativeTransport.close();
                this.#nativeTransport = null;
            }
        }

        this.#ensureSabAllocated();

        if (!this.#isReady || !this.#worker) {
            // Lazy synchronous initialization if called before explicit init()
            try {
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

        const jsonStr = _JSONStringify(payloadObj);
        const maxPayloadLen = this.sab.byteLength - DATA_OFFSET;
        const reqLen = Buffer.byteLength(jsonStr, "utf8");
        if (reqLen > maxPayloadLen) {
            throw new Error(
                `libSynapx: Payload exceeds SharedArrayBuffer capacity (${this.sab.byteLength} bytes)`,
            );
        }

        // 1. Zero-copy write: 6-byte binary header at FRAME_OFFSET + UTF-8 payload at DATA_OFFSET
        this.#sabBuf.writeUInt8(0x53, FRAME_OFFSET);
        this.#sabBuf.writeUInt8(0x03, FRAME_OFFSET + 1); // MSG_CALL
        this.#sabBuf.writeUInt32BE(reqLen, FRAME_OFFSET + 2);
        this.#sabBuf.write(jsonStr, DATA_OFFSET, reqLen, "utf8");

        Atomics.store(this.int32, IDX_REQ_LEN, reqLen);
        Atomics.store(this.int32, IDX_STATUS, STATUS_PENDING);

        // 2. Dispatch event to background worker thread
        this.#worker?.postMessage({ type: "DISPATCH" });

        // 3. Put Main Thread to sleep on Linux Kernel Futex (0% CPU Burn)
        const waitStatus = Atomics.wait(
            this.int32,
            IDX_STATUS,
            STATUS_PENDING,
            timeoutMs,
        );
        if (waitStatus === "timed-out") {
            Atomics.store(this.int32, IDX_STATUS, STATUS_IDLE);
            _Uint8ArrayFill(this.uint8, 0, FRAME_OFFSET, DATA_OFFSET + reqLen);
            throw new Error(
                `libSynapx: callSync timed out after ${timeoutMs}ms [${module}.${action}]`,
            );
        }

        // 4. Thread awoken by kernel! Read response directly from shared memory (zero-copy)
        const status = Atomics.load(this.int32, IDX_STATUS);
        const respLen = Atomics.load(this.int32, IDX_RESP_LEN);
        const totalUsedLen = Math.max(reqLen, respLen);

        Atomics.store(this.int32, IDX_STATUS, STATUS_IDLE);

        let parsed: any;
        try {
            parsed = _JSONParse(
                this.#sabBuf.toString(
                    "utf8",
                    DATA_OFFSET,
                    DATA_OFFSET + respLen,
                ),
            );
        } catch (e: any) {
            throw new Error(
                `libSynapx: Failed to decode response JSON: ${e.message}`,
            );
        } finally {
            /**
             * Ref: XSA-SYNAPX-001 (SharedArrayBuffer Memory Scrubbing)
             * Overwrite shared memory with zeros immediately following response consumption.
             * Prevents plaintext credential retention across the SharedArrayBuffer lifecycle.
             *
             * @see XSA-XESS-021 - Uses frozen _Uint8ArrayFill primordial to prevent interception
             */
            _Uint8ArrayFill(
                this.uint8,
                0,
                FRAME_OFFSET,
                DATA_OFFSET + totalUsedLen,
            );
            Atomics.store(this.int32, IDX_REQ_LEN, 0);
            Atomics.store(this.int32, IDX_RESP_LEN, 0);
        }

        if (status === STATUS_ERROR || !parsed.ok) {
            throw new Error(
                parsed.err ||
                    `libSynapx [${module}.${action}] execution failed`,
            );
        }

        return parsed.data as T;
    }

    public destroy(): void {
        this.#isReady = false;
        if (this.#nativeTransport) {
            this.#nativeTransport.close();
            this.#nativeTransport = null;
        }
        if (this.#worker) {
            this.#worker.terminate();
            this.#worker = null;
        }
        this.#initPromise = null;
        SynapxSyncBridge.instance = null;
    }
}



