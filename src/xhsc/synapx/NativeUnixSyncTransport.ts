/* *****************************************************************************
 * Nehonix libSynapx — XyPrss Native Synchronous Unix Domain Socket Transport (XNatSUDT) (bun:ffi)
 *
 * Ultra-low latency synchronous IPC transport directly invoking POSIX libc
 * socket/connect/send/recv syscalls without Worker threads, postMessage, or futex hops.
 *
 * Security invariants:
 * - XSA-SYNAPX-001: Immediate zero-scrubbing of TX/RX buffers after every call.
 * - XSA-XESS-021: Uses frozen JSON/Uint8Array primordials against prototype pollution.
 * - XSA-XESS-027: Hardened with native ES private fields.
 * - Automatic graceful fallback to Worker SharedArrayBuffer bridge on Node.js/Windows.
 ***************************************************************************** */

import {
    _JSONParse,
    _JSONStringify,
    _Uint8ArrayFill,
} from "../../utils/CorePathCheck";

const MAGIC_BYTE = 0x53; // 'S'
const MSG_HANDSHAKE = 0x01;
const MSG_HANDSHAKE_ACK = 0x02;
const MSG_CALL = 0x03;
const MSG_RESPONSE = 0x04;
const MSG_ERROR = 0xff;

const DEFAULT_BUF_SIZE = 64 * 1024; // 64 KB reusable slab (auto-grows for large payloads)
const MAX_UNIX_PATH_LEN = 104;

interface LibcSymbols {
    socket: (domain: number, type: number, protocol: number) => number;
    connect: (fd: number, addr: any, addrlen: number) => number;
    send: (fd: number, buf: any, len: number, flags: number) => number | bigint;
    recv: (fd: number, buf: any, len: number, flags: number) => number | bigint;
    setsockopt: (
        fd: number,
        level: number,
        optname: number,
        optval: any,
        optlen: number,
    ) => number;
    close: (fd: number) => number;
}

interface FfiRuntime {
    symbols: LibcSymbols;
    ptr: (buf: ArrayBufferView, offset?: number) => any;
    isLinux: boolean;
    msgFlags: number;
    solSocket: number;
    soRcvTimeo: number;
    soSndTimeo: number;
}

let cachedFfi: FfiRuntime | null | undefined = undefined;

function loadFfiRuntime(): FfiRuntime | null {
    if (cachedFfi !== undefined) {
        return cachedFfi;
    }

    if (typeof (globalThis as any).Bun === "undefined") {
        cachedFfi = null;
        return null;
    }

    const platform = process.platform;
    if (platform !== "linux" && platform !== "darwin") {
        cachedFfi = null;
        return null;
    }

    try {
        // Dynamic require keeps TypeScript/Node.js bundles completely clean
        const bunFfi = require("bun:ffi");
        const { dlopen, FFIType, ptr } = bunFfi;
        const isLinux = platform === "linux";
        const libName = isLinux ? "libc.so.6" : "libSystem.B.dylib";

        const lib = dlopen(libName, {
            socket: {
                args: [FFIType.i32, FFIType.i32, FFIType.i32],
                returns: FFIType.i32,
            },
            connect: {
                args: [FFIType.i32, FFIType.ptr, FFIType.u32],
                returns: FFIType.i32,
            },
            send: {
                args: [FFIType.i32, FFIType.ptr, FFIType.u64, FFIType.i32],
                returns: FFIType.i64,
            },
            recv: {
                args: [FFIType.i32, FFIType.ptr, FFIType.u64, FFIType.i32],
                returns: FFIType.i64,
            },
            setsockopt: {
                args: [
                    FFIType.i32,
                    FFIType.i32,
                    FFIType.i32,
                    FFIType.ptr,
                    FFIType.u32,
                ],
                returns: FFIType.i32,
            },
            close: { args: [FFIType.i32], returns: FFIType.i32 },
        });

        cachedFfi = {
            symbols: lib.symbols as LibcSymbols,
            ptr,
            isLinux,
            // MSG_NOSIGNAL (0x4000) on Linux prevents SIGPIPE crash if daemon closes socket
            msgFlags: isLinux ? 0x4000 : 0,
            solSocket: isLinux ? 1 : 0xffff,
            soRcvTimeo: isLinux ? 20 : 0x1006,
            soSndTimeo: isLinux ? 21 : 0x1005,
        };
        return cachedFfi;
    } catch {
        cachedFfi = null;
        return null;
    }
}

class NativeUnixSyncTransport {
    #ffi: FfiRuntime;
    #socketPath: string;
    #sessionHash: string;
    #authToken: string;
    #fd: number = -1;
    #txBuf: Buffer;
    #rxBuf: Buffer;
    #hdrBuf: Buffer;

    private constructor(
        ffi: FfiRuntime,
        socketPath: string,
        sessionHash: string,
        authToken: string,
    ) {
        this.#ffi = ffi;
        this.#socketPath = socketPath;
        this.#sessionHash = sessionHash;
        this.#authToken = authToken;
        this.#txBuf = Buffer.allocUnsafe(DEFAULT_BUF_SIZE);
        this.#rxBuf = Buffer.allocUnsafe(DEFAULT_BUF_SIZE);
        this.#hdrBuf = Buffer.allocUnsafe(6);
    }

    public static tryCreate(
        socketPath: string,
        sessionHash: string,
        authToken: string,
    ): NativeUnixSyncTransport | null {
        if (!socketPath || socketPath.startsWith("\\\\.\\pipe\\")) {
            return null;
        }
        if (Buffer.byteLength(socketPath, "utf8") >= MAX_UNIX_PATH_LEN) {
            return null;
        }
        const ffi = loadFfiRuntime();
        if (!ffi) {
            return null;
        }
        return new NativeUnixSyncTransport(
            ffi,
            socketPath,
            sessionHash,
            authToken,
        );
    }

    #applySocketTimeout(fd: number, timeoutMs: number): void {
        const secs = Math.max(1, Math.ceil(timeoutMs / 1000));
        // 64-bit POSIX struct timeval { int64 tv_sec; int64 tv_usec; }
        const tv = new BigInt64Array(2);
        tv[0] = BigInt(secs);
        tv[1] = 0n;
        const tvBytes = new Uint8Array(tv.buffer);
        this.#ffi.symbols.setsockopt(
            fd,
            this.#ffi.solSocket,
            this.#ffi.soRcvTimeo,
            this.#ffi.ptr(tvBytes),
            16,
        );
        this.#ffi.symbols.setsockopt(
            fd,
            this.#ffi.solSocket,
            this.#ffi.soSndTimeo,
            this.#ffi.ptr(tvBytes),
            16,
        );
    }

    #sendAll(fd: number, buf: Uint8Array, totalLen: number): boolean {
        let offset = 0;
        const { symbols, ptr, msgFlags } = this.#ffi;
        while (offset < totalLen) {
            const n = Number(
                symbols.send(fd, ptr(buf, offset), totalLen - offset, msgFlags),
            );
            if (n <= 0) {
                return false;
            }
            offset += n;
        }
        return true;
    }

    #recvExact(fd: number, buf: Uint8Array, totalLen: number): boolean {
        let offset = 0;
        const { symbols, ptr } = this.#ffi;
        while (offset < totalLen) {
            const n = Number(
                symbols.recv(fd, ptr(buf, offset), totalLen - offset, 0),
            );
            if (n <= 0) {
                return false;
            }
            offset += n;
        }
        return true;
    }

    #connectAndHandshake(timeoutMs: number): boolean {
        this.close();

        const { symbols, ptr, isLinux } = this.#ffi;
        // AF_UNIX = 1, SOCK_STREAM = 1
        const fd = symbols.socket(1, 1, 0);
        if (fd < 0) {
            return false;
        }

        const pathBytes = Buffer.from(this.#socketPath, "utf8");
        const sockaddr = new Uint8Array(110);
        if (isLinux) {
            // Linux struct sockaddr_un { uint16 sun_family; char sun_path[108]; }
            sockaddr[0] = 1; // AF_UNIX
            sockaddr[1] = 0;
        } else {
            // macOS struct sockaddr_un { uint8 sun_len; uint8 sun_family; char sun_path[104]; }
            sockaddr[0] = 2 + pathBytes.length + 1;
            sockaddr[1] = 1; // AF_UNIX
        }
        sockaddr.set(pathBytes, 2);

        const addrLen = 2 + pathBytes.length + 1;
        const rc = symbols.connect(fd, ptr(sockaddr), addrLen);
        if (rc !== 0) {
            symbols.close(fd);
            return false;
        }

        this.#applySocketTimeout(fd, timeoutMs);

        // Perform mandatory Zero-Trust libSynapx handshake
        const hsJson = _JSONStringify({
            sessionHash: this.#sessionHash || "",
            token: this.#authToken || "",
            clientPid: process.pid,
        });
        const hsLen = Buffer.byteLength(hsJson, "utf8");
        const hsFrame = Buffer.allocUnsafe(6 + hsLen);
        hsFrame.writeUInt8(MAGIC_BYTE, 0);
        hsFrame.writeUInt8(MSG_HANDSHAKE, 1);
        hsFrame.writeUInt32BE(hsLen, 2);
        hsFrame.write(hsJson, 6, hsLen, "utf8");

        const sent = this.#sendAll(fd, hsFrame, 6 + hsLen);
        _Uint8ArrayFill(hsFrame, 0, 0, hsFrame.length);
        if (!sent) {
            symbols.close(fd);
            return false;
        }

        if (!this.#recvExact(fd, this.#hdrBuf, 6)) {
            symbols.close(fd);
            return false;
        }

        const magic = this.#hdrBuf[0];
        const msgType = this.#hdrBuf[1];
        const respLen = this.#hdrBuf.readUInt32BE(2);

        if (magic !== MAGIC_BYTE || msgType !== MSG_HANDSHAKE_ACK) {
            symbols.close(fd);
            return false;
        }

        if (respLen > 0) {
            const ackBuf =
                respLen <= this.#rxBuf.length
                    ? this.#rxBuf
                    : Buffer.allocUnsafe(respLen);
            const ok = this.#recvExact(fd, ackBuf, respLen);
            _Uint8ArrayFill(ackBuf, 0, 0, respLen);
            if (!ok) {
                symbols.close(fd);
                return false;
            }
        }

        this.#fd = fd;
        return true;
    }

    public callSync<T = any>(
        module: string,
        action: string,
        args: any[] = [],
        opts: Record<string, any> = {},
        timeoutMs = 5000,
    ): T {
        const stringArgs = Array.isArray(args) ? args.map(String) : [];
        const jsonStr = _JSONStringify({
            id: 1,
            mod: module,
            action,
            args: stringArgs,
            opts: opts || {},
        });
        const reqLen = Buffer.byteLength(jsonStr, "utf8");
        const frameLen = 6 + reqLen;

        const tx =
            frameLen <= this.#txBuf.length
                ? this.#txBuf
                : Buffer.allocUnsafe(frameLen);
        tx.writeUInt8(MAGIC_BYTE, 0);
        tx.writeUInt8(MSG_CALL, 1);
        tx.writeUInt32BE(reqLen, 2);
        tx.write(jsonStr, 6, reqLen, "utf8");

        let rx: Buffer = this.#rxBuf;
        let respLen = 0;

        try {
            // Up to 2 attempts: 1st reuses persistent socket; 2nd transparently reconnects if stale
            let msgType = 0;
            let ioSuccess = false;

            for (let attempt = 0; attempt < 2; attempt++) {
                if (this.#fd < 0) {
                    if (!this.#connectAndHandshake(timeoutMs)) {
                        throw new Error(
                            `libSynapx: FFI socket connect failed [${module}.${action}]`,
                        );
                    }
                }

                if (!this.#sendAll(this.#fd, tx, frameLen)) {
                    this.close();
                    continue;
                }

                if (!this.#recvExact(this.#fd, this.#hdrBuf, 6)) {
                    this.close();
                    continue;
                }

                if (this.#hdrBuf[0] !== MAGIC_BYTE) {
                    this.close();
                    continue;
                }

                msgType = this.#hdrBuf[1];
                respLen = this.#hdrBuf.readUInt32BE(2);

                if (respLen > rx.length) {
                    rx = Buffer.allocUnsafe(respLen);
                }

                if (respLen > 0 && !this.#recvExact(this.#fd, rx, respLen)) {
                    this.close();
                    continue;
                }

                ioSuccess = true;
                break;
            }

            if (!ioSuccess) {
                throw new Error(
                    `libSynapx: FFI synchronous RPC failed [${module}.${action}]`,
                );
            }

            const parsed = _JSONParse(rx.toString("utf8", 0, respLen));
            if (msgType === MSG_ERROR || !parsed.ok) {
                throw new Error(
                    parsed.err ||
                        `libSynapx [${module}.${action}] execution failed`,
                );
            }

            return parsed.data as T;
        } finally {
            // XSA-SYNAPX-001: Scrub plaintext TX/RX buffers immediately
            _Uint8ArrayFill(tx, 0, 0, frameLen);
            if (respLen > 0) {
                _Uint8ArrayFill(rx, 0, 0, respLen);
            }
        }
    }

    public close(): void {
        if (this.#fd >= 0) {
            try {
                this.#ffi.symbols.close(this.#fd);
            } catch {}
            this.#fd = -1;
        }
    }
}

export { NativeUnixSyncTransport as XNatSUDT };

