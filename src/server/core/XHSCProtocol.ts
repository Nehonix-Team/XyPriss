/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * High-performance Request/Response implementation for XHSC Bridge.
 * This file provides REAL implementations of the XyPriss Request/Response
 * objects that fulfill the Node.js HTTP contract without depending on
 * the internal Node.js http module classes.
 ***************************************************************************/

import { Readable, Writable } from "stream";
import { ServerResponse } from "http";
import { __sys__ } from "../../xhsc";
import { SendFileHandler } from "./SendFileHandler";
import { XRUNTIME_HEADER_NAME } from "../const/XRUNTIME-HEADER";
import { Configs } from "../..";

/**
 * Real implementation of XyPriss Request for XHSC.
 * Extends Readable to support stream-based body reading.
 */
/**
 * **XHSC High-Performance Request Object**
 *
 * A real implementation of the XyPriss HTTP Request object, built to bridge
 * binary IPC data received from the Go XHSC engine into a Node.js-compatible
 * `IncomingMessage`-like interface — without depending on the native `http`
 * module's internal classes.
 *
 * ### Performance Strategy
 * Most HTTP frameworks construct all request properties eagerly on every
 * incoming request, regardless of whether the application code will ever
 * access them. For many high-throughput routes (e.g. health checks, CSRF
 * token endpoints), properties like `ip`, `hostname`, `protocol`, and
 * `cookies` are never read.
 *
 * This class defers that work using `Object.defineProperty` lazy getters:
 * - Properties are only computed the **first time** they are accessed.
 * - Computed values are cached in closure-scoped variables (`_ip`, `_hostname`,
 *   `_cookies`, etc.) for subsequent reads at zero cost.
 * - Properties that are never accessed cost **zero CPU time** and zero
 *   extra memory beyond the closure variable declaration.
 *
 * ### Header Parsing
 * The `decodeXbpRequest` decoder (in `xbp.ts`) already lowercases header
 * keys during binary frame parsing. The header iteration here is therefore
 * a simple structural unwrapping of the XBP `{ Single: value }` envelope,
 * with no redundant `toLowerCase()` pass.
 */
export class XHSCRequest extends Readable {
    public method: string;
    public url: string;
    public id: string;
    public headers: any;
    public query: any;
    public params: any;
    public body: any;
    public files: any[] = [];
    public path: string;
    public originalUrl: string;
    public baseUrl: string = "";
    public socket: any;
    public httpVersion: string = "1.1";
    public httpVersionMajor: number = 1;
    public httpVersionMinor: number = 1;
    public app: any;

    // Express compatibility properties
    public ip!: string;
    public ips!: string[];
    public cookies!: Record<string, string>;
    public protocol!: string;
    public secure!: boolean;
    public hostname!: string;
    public subdomains: string[] = [];
    public fresh: boolean = true;
    public stale: boolean = false;
    public xhr!: boolean;

    /**
     * Creates an `XHSCRequest` from a decoded IPC payload.
     *
     * @param payload - The raw decoded request object from the Go XHSC engine.
     *   Contains `method`, `url`, `id`, `headers` (XBP envelope), `query`,
     *   `params`, `body` (base64 string or Buffer), `remote_addr`, `local_addr`,
     *   and optionally `files` and `upload_errors`.
     * @param socket - The underlying Unix Domain Socket connection to the Go
     *   engine. Used to populate `req.socket` so middleware expecting a real
     *   socket object (e.g. for `remoteAddress`) will function correctly.
     */
    constructor(payload: any, socket?: any) {
        super();
        this.method = payload.method;
        this.url = payload.url;
        this.id = payload.id;

        // Flatten and lowercase headers for Node.js compatibility
        this.headers = {};
        if (payload.headers) {
            const h = payload.headers;
            for (const key in h) {
                const val = h[key];
                if (val && val.Single !== undefined) {
                    this.headers[key] = val.Single;
                } else if (val && val.Multiple !== undefined) {
                    this.headers[key] = val.Multiple;
                } else {
                    this.headers[key] = val;
                }
            }
        }

        this.query = payload.query || {};
        this.params = payload.params || {};
        this.body = null;

        let reqPath = payload.url ? payload.url.split("?")[0] : "/";
        if (reqPath.length > 1 && reqPath.endsWith("/")) {
            reqPath = reqPath.slice(0, -1);
        }
        this.path = reqPath;
        this.originalUrl = payload.url || "/";

        /**
         * ### Lazy IP Resolution
         *
         * Parsing `remote_addr` is non-trivial: it must handle IPv4 (`1.2.3.4:port`),
         * IPv6 with brackets (`[::1]:port`), and comma-separated proxy chains
         * (`X-Forwarded-For` style). This block defers that work until `req.ip`
         * or `req.ips` is first accessed. On routes that never read the client IP
         * (e.g. static assets, CSRF token generation), this block is never executed.
         */
        let _ip: string | undefined;
        let _ips: string[] | undefined;
        let _remotePort = 0;

        Object.defineProperty(this, "ips", {
            get: () => {
                if (_ips) return _ips;
                const remoteAddrStr = payload.remote_addr || "127.0.0.1:0";
                if (remoteAddrStr.includes(",")) {
                    _ips = remoteAddrStr
                        .split(",")
                        .map((i: string) => i.trim())
                        .filter(Boolean);
                    _ip = _ips![0];
                } else {
                    const lastColon = remoteAddrStr.lastIndexOf(":");
                    if (lastColon !== -1) {
                        let ip = remoteAddrStr.substring(0, lastColon);
                        if (ip.startsWith("[") && ip.endsWith("]")) {
                            ip = ip.substring(1, ip.length - 1);
                        }
                        _ip = ip;
                    } else {
                        _ip = remoteAddrStr;
                    }
                    _remotePort =
                        lastColon !== -1
                            ? parseInt(
                                  remoteAddrStr.substring(lastColon + 1) || "0",
                                  10,
                              )
                            : 0;
                    _ips = [_ip as string];
                }
                return _ips;
            },
            configurable: true,
        });

        Object.defineProperty(this, "ip", {
            get: () => {
                if (!_ip) {
                    const _ = this.ips;
                }
                return _ip;
            },
            configurable: true,
        });

        /**
         * ### Lazy Local Address Resolution
         *
         * The local server address (`local_addr`) is almost never needed by
         * application code. Its parsing (IPv6 bracket stripping, port splitting)
         * is deferred to the `socket.localAddress` getter and only executed if
         * that property is actually read.
         */
        let _localAddress: string | undefined;
        let _localPort = 0;

        /**
         * ### Lazy Hostname Resolution
         *
         * Parses the `Host` header to extract the bare hostname, stripping the
         * optional port suffix and handling IPv6 bracketed addresses.
         * Defaults to `"localhost"` if the header is absent.
         */
        let _hostname: string | undefined;
        Object.defineProperty(this, "hostname", {
            get: () => {
                if (_hostname !== undefined) return _hostname;
                if (this.headers && this.headers.host) {
                    const host = this.headers.host;
                    const lastHostColon = host.lastIndexOf(":");
                    if (lastHostColon !== -1 && host.includes("]")) {
                        // IPv6 with port: [::1]:8080 or [::1]
                        const ClosingBracket = host.lastIndexOf("]");
                        if (
                            ClosingBracket !== -1 &&
                            lastHostColon > ClosingBracket
                        ) {
                            _hostname = host.substring(0, lastHostColon);
                        } else {
                            _hostname = host;
                        }
                    } else if (lastHostColon !== -1) {
                        // IPv4 or hostname with port: strip the port suffix
                        _hostname = host.substring(0, lastHostColon);
                    } else {
                        _hostname = host;
                    }

                    if (
                        _hostname!.startsWith("[") &&
                        _hostname!.endsWith("]")
                    ) {
                        _hostname = _hostname!.substring(
                            1,
                            _hostname!.length - 1,
                        );
                    }
                } else {
                    _hostname = "localhost";
                }
                return _hostname;
            },
            configurable: true,
        });

        /**
         * ### Lazy Protocol Detection
         *
         * Reads `x-forwarded-proto` from headers. Only computed on first access.
         * Drives `req.secure` (whether the original connection was HTTPS)
         * without requiring an additional property lookup.
         */
        Object.defineProperty(this, "protocol", {
            get: () => {
                return (
                    (this.headers && this.headers["x-forwarded-proto"]) ||
                    "http"
                );
            },
            configurable: true,
        });

        Object.defineProperty(this, "secure", {
            get: () => {
                return this.protocol === "https";
            },
            configurable: true,
        });

        /**
         * ### Lazy XHR Detection
         *
         * Checks the `x-requested-with` header for `XMLHttpRequest`.
         * Deferred because the vast majority of requests are not XHR,
         * and checking this header costs a string comparison.
         */
        Object.defineProperty(this, "xhr", {
            get: () => {
                return (
                    this.headers &&
                    (this.headers["x-requested-with"] || "").toLowerCase() ===
                        "xmlhttprequest"
                );
            },
            configurable: true,
        });

        /**
         * ### Lazy Cookie Parsing
         *
         * `Cookie` header parsing (splitting on `;`, decoding URI components)
         * is one of the more expensive string operations per request.
         * It is deferred until `req.cookies` is first accessed and cached
         * for all subsequent reads within the same request lifecycle.
         */
        let _cookies: Record<string, string> | undefined;
        Object.defineProperty(this, "cookies", {
            get: () => {
                if (_cookies) return _cookies;
                if (this.headers && this.headers.cookie) {
                    _cookies = this.parseCookies(this.headers.cookie);
                } else {
                    _cookies = {};
                }
                return _cookies;
            },
            configurable: true,
        });

        /**
         * ### Socket Property Masking
         *
         * The underlying socket is the Unix Domain Socket connecting Node.js to the
         * Go XHSC engine. We must mask its properties (`remoteAddress`, `localPort`,
         * etc.) to expose the **client's** network address rather than the IPC pipe
         * address, so that downstream middleware (rate limiters, loggers, etc.)
         * sees correct values.
         *
         * All socket properties are also lazy: they delegate to the same
         * closure-scoped variables above, ensuring a single parse for both
         * `req.ip` and `req.socket.remoteAddress`.
         */
        this.socket = socket || {
            destroy: () => {},
            end: () => {},
        };

        if (socket) {
            Object.defineProperties(this.socket, {
                remoteAddress: { get: () => this.ip, configurable: true },
                remotePort: {
                    get: () => {
                        const _ = this.ips;
                        return _remotePort;
                    },
                    configurable: true,
                },
                localAddress: {
                    get: () => {
                        if (!_localAddress) {
                            const localAddr =
                                payload.local_addr || "127.0.0.1:0";
                            const lastLocalColon = localAddr.lastIndexOf(":");
                            if (lastLocalColon !== -1) {
                                _localAddress = localAddr.substring(
                                    0,
                                    lastLocalColon,
                                );
                                if (
                                    _localAddress!.startsWith("[") &&
                                    _localAddress!.endsWith("]")
                                ) {
                                    _localAddress = _localAddress!.substring(
                                        1,
                                        _localAddress!.length - 1,
                                    );
                                }
                                _localPort = parseInt(
                                    localAddr.substring(lastLocalColon + 1) ||
                                        "0",
                                    10,
                                );
                            } else {
                                _localAddress = localAddr;
                            }
                        }
                        return _localAddress;
                    },
                    configurable: true,
                },
                localPort: {
                    get: () => {
                        const _ = this.socket.localAddress;
                        return _localPort;
                    },
                    configurable: true,
                },
                encrypted: { get: () => this.secure, configurable: true },
            });
        }

        if (payload.body) {
            // Go serializes []byte as Base64 in JSON. We must decode it.
            try {
                if (typeof payload.body === "string") {
                    const buf = Buffer.from(payload.body, "base64");
                    this.push(buf);
                    // Also try to parse as JSON for req.body if it's not a stream-only use case
                    const contentType = this.headers["content-type"] || "";
                    if (
                        contentType.includes("application/json") ||
                        contentType.includes(
                            "application/x-www-form-urlencoded",
                        ) ||
                        contentType.includes("multipart/form-data")
                    ) {
                        try {
                            this.body = JSON.parse(buf.toString());
                        } catch (e) {
                            this.body = buf.toString();
                        }
                    }
                } else {
                    const buf = Buffer.from(payload.body);
                    this.push(buf);
                    this.body = buf;
                }
            } catch (e) {
                const buf = Buffer.from(payload.body);
                this.push(buf);
                this.body = buf;
            }
        }

        // Handle native Go uploads
        if (payload.files && Array.isArray(payload.files)) {
            this.files = payload.files.map((file: any) => ({
                fieldname: file.fieldname,
                originalname: file.originalname,
                encoding: "7bit",
                mimetype: file.mimetype,
                destination: __sys__.path.dirname(file.path),
                filename: __sys__.path.basename(file.path),
                path: file.path,
                size: file.size,
                // Buffer is not provided as Go already saved it to disk
            }));

            // XyPriss convention: also expose single file if present
            if (this.files.length > 0) {
                (this as any).file = this.files[0];
            }
        }

        if (payload.upload_errors) {
            (this as any).uploadErrors = payload.upload_errors;
        }

        this.push(null); // End stream
    }

    _read() {}

    public async getApp(): Promise<any> {
        return this.app;
    }

    public destroy(error?: Error): any {
        super.destroy(error);
        return this;
    }

    public setTimeout(msecs: number, callback?: () => void): any {
        if (callback) callback();
        return this;
    }

    public get(name: string): string | undefined {
        const lcName = name.toLowerCase();
        return this.headers[lcName];
    }

    public header(name: string): string | undefined {
        return this.get(name);
    }

    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};
        cookieHeader.split(";").forEach((pair) => {
            const [key, value] = pair.split("=").map((s) => s.trim());
            if (key && value) {
                cookies[key] = decodeURIComponent(value);
            }
        });
        return cookies;
    }
}

/**
 * A no-op socket substitute for XHSCResponse.
 *
 * `ServerResponse` requires a socket-like object to be passed at construction
 * time. Previously, the real Unix Domain Socket (the IPC connection to the Go
 * engine) was passed here. That caused a critical correctness bug: when
 * `super.end()` was called, Node.js wrote raw HTTP response headers and body
 * directly into the XBP binary IPC stream, corrupting the protocol framing and
 * blocking every in-flight request until the 30-second Go-side timeout fired.
 *
 * This class replaces the real socket with a no-op object. Node.js internal
 * stream machinery writes into it freely, but all bytes are silently discarded.
 * Actual response delivery is handled exclusively by `_onFinalize`, which
 * encodes and sends a correct XBP frame back to the Go engine.
 */
class NullSocket {
    writable = true;
    readable = false;
    destroyed = false;
    encrypted = false;
    remoteAddress = "127.0.0.1";
    remotePort = 0;
    localAddress = "127.0.0.1";
    localPort = 0;

    write(_data: any, _enc?: any, cb?: any): boolean {
        if (typeof _enc === "function") _enc();
        else if (typeof cb === "function") cb();
        return true;
    }
    end(_data?: any, _enc?: any, cb?: any): this {
        if (typeof _enc === "function") _enc();
        else if (typeof cb === "function") cb();
        return this;
    }
    destroy(): this {
        return this;
    }
    cork(): void {}
    uncork(): void {}
    setTimeout(_ms: number, _cb?: () => void): this {
        return this;
    }
    on(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    once(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    emit(_event: string, ..._args: any[]): boolean {
        return false;
    }
    removeListener(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    removeAllListeners(_event?: string): this {
        return this;
    }
    setMaxListeners(_n: number): this {
        return this;
    }
    getMaxListeners(): number {
        return 0;
    }
    listeners(_event: string): any[] {
        return [];
    }
    rawListeners(_event: string): any[] {
        return [];
    }
    listenerCount(_event: string): number {
        return 0;
    }
    eventNames(): string[] {
        return [];
    }
    prependListener(_event: string, _listener: (...args: any[]) => void): this {
        return this;
    }
    prependOnceListener(
        _event: string,
        _listener: (...args: any[]) => void,
    ): this {
        return this;
    }
    pipe<T>(_dest: T): T {
        return _dest;
    }
    unshift(_chunk: any): void {}
    pause(): this {
        return this;
    }
    resume(): this {
        return this;
    }
    isPaused(): boolean {
        return false;
    }
    setEncoding(_enc: string): this {
        return this;
    }
    read(_size?: number): any {
        return null;
    }
    ref(): this {
        return this;
    }
    unref(): this {
        return this;
    }
}

const NULL_SOCKET = new NullSocket();

export class XHSCResponse extends ServerResponse {
    public locals: any = {};
    private _capturedData: Buffer[] = [];
    private _onFinalize: (
        data: Buffer | null,
        status: number,
        headers: any,
    ) => void;

    constructor(
        req: XHSCRequest,
        onFinalize: (data: Buffer | null, status: number, headers: any) => void,
    ) {
        // Pass a no-op NullSocket instead of the real IPC socket.
        // See NullSocket JSDoc above for the full rationale.
        super({ socket: NULL_SOCKET, connection: NULL_SOCKET } as any);

        this._onFinalize = onFinalize;
        (this as any).req = req;
    }

    public status(code: number): any {
        this.statusCode = code;
        return this;
    }

    public setHeader(name: string, value: any): this {
        super.setHeader(name, value);
        return this;
    }

    public set(field: string | Record<string, any>, value?: any): this {
        if (typeof field === "object") {
            for (const key in field) {
                this.setHeader(key, field[key]);
            }
        } else {
            this.setHeader(field, value);
        }
        return this;
    }

    public getHeader(name: string): any {
        return super.getHeader(name);
    }

    public getHeaders(): any {
        return super.getHeaders();
    }

    public hasHeader(name: string): boolean {
        return super.hasHeader(name);
    }

    public removeHeader(name: string): void {
        super.removeHeader(name);
    }

    public writeHead(
        statusCode: number,
        statusMessage?: any,
        headers?: any,
    ): this {
        if (this.headersSent) return this;

        this._injectBranding();
        this.statusCode = statusCode;
        if (typeof statusMessage === "string") {
            this.statusMessage = statusMessage;
        } else if (typeof statusMessage === "object") {
            headers = statusMessage;
        }

        if (headers) {
            for (const key in headers) {
                this.setHeader(key, headers[key]);
            }
        }

        return this;
    }

    public write(chunk: any, encoding?: any, callback?: any): boolean {
        const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(
                  chunk,
                  (typeof encoding === "string"
                      ? encoding
                      : "utf8") as BufferEncoding,
              );
        this._capturedData.push(buffer);

        if (typeof encoding === "function") callback = encoding;
        if (typeof callback === "function") callback();
        return true;
    }

    /**
     * Injects or strips XyPriss branding headers before the response is finalized.
     *
     * Called automatically by both `writeHead()` and `end()` to ensure headers
     * are always applied regardless of which method the application uses to
     * terminate the response.
     *
     * ### Optimization Notes
     * - **Guard clause first**: the `headersSent` check is performed at the very
     *   top to bail out immediately on double-calls (e.g. when `writeHead` is
     *   called before `end`). This avoids any config lookup in the hot path.
     * - **Conditional branching instead of iteration**: the previous implementation
     *   built a `const XBHeaders = { ... }` object literal on every call and then
     *   iterated over it with a `for...in` loop. This allocates a new object and
     *   a closure per response. The refactored version uses a flat `if/else` with
     *   direct `setHeader` / `removeHeader` calls \u2014 no object, no loop, no GC.
     * - **`hasHeader` guard on set**: headers are only written if they are not
     *   already present, allowing application code to override branding headers
     *   (e.g. a custom `Server:` header) without being silently overwritten.
     *
     * Branding can be disabled globally via `security.rmXBranding: true` in
     * the server configuration.
     */
    private _injectBranding(): void {
        if (this.headersSent) return;
        const RMXB = Configs.get("security")?.rmXBranding;

        if (RMXB) {
            this.removeHeader("Server");
            this.removeHeader("X-XyPriss-Runtime");
            this.removeHeader("X-Powered-By");
            this.removeHeader("X-Runtime");
        } else {
            if (!this.hasHeader("Server"))
                this.setHeader("Server", "XyPriss/XHSC");
            if (!this.hasHeader("X-XyPriss-Runtime"))
                this.setHeader("X-XyPriss-Runtime", XRUNTIME_HEADER_NAME);
            if (!this.hasHeader("X-Powered-By"))
                this.setHeader("X-Powered-By", "XyPriss");
            if (!this.hasHeader("X-Runtime"))
                this.setHeader(
                    "X-Runtime",
                    "XyPriss - Hyper-System Core (XHSC)",
                );
        }
    }

    /**
     * Finalizes the response and signals the Go engine via `_onFinalize`.
     *
     * ### Architecture
     * `XHSCResponse` uses a `NullSocket` as its underlying socket, so
     * `super.end()` (the Node.js `ServerResponse` finalizer) would write
     * HTTP-framed bytes into a no-op buffer — harmless but unnecessary.
     * We bypass `super.end()` entirely and mark the stream as ended via
     * `Object.defineProperty`, which is the minimal correct operation.
     *
     * ### Why no `process.nextTick`
     * The previous implementation scheduled `this.emit("finish")` via
     * `process.nextTick`. Under 100+ concurrent requests, 100 nextTicks
     * queue up simultaneously, stalling the event loop for entire seconds
     * (observable as "0 req/s" samples in benchmarks). Emitting `finish`
     * synchronously is safe here because no downstream consumer depends on
     * async drain completion — the real I/O is handled by the Go engine.
     */
    public end(chunk?: any, encoding?: any, callback?: any): this {
        if ((this as any).writableEnded) return this;

        this._injectBranding();

        if (chunk && typeof chunk !== "function") {
            const buffer = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(
                      chunk,
                      (typeof encoding === "string"
                          ? encoding
                          : "utf8") as BufferEncoding,
                  );
            this._capturedData.push(buffer);
        }

        const finalBody =
            this._capturedData.length > 0
                ? Buffer.concat(this._capturedData)
                : null;

        // Mark stream as ended immediately (bypassing super.end() which is
        // unnecessary — the NullSocket absorbs any bytes it would write).
        Object.defineProperty(this, "writableEnded", {
            value: true,
            configurable: true,
        });
        Object.defineProperty(this, "finished", {
            value: true,
            configurable: true,
        });
        Object.defineProperty(this, "writableFinished", {
            value: true,
            configurable: true,
        });

        // Signal Go engine (status=0 means static delegation, >0 is a normal response).
        this._onFinalize(finalBody, this.statusCode, this.getHeaders());

        // Emit finish synchronously — no real drain needed on NullSocket.
        this.emit("finish");

        const actualCallback =
            typeof chunk === "function"
                ? chunk
                : typeof encoding === "function"
                  ? encoding
                  : callback;
        if (typeof actualCallback === "function") actualCallback();

        return this;
    }

    public json(data: any): void {
        this.setHeader("Content-Type", "application/json");
        this.end(JSON.stringify(data));
    }

    public success(message: string, data?: any): void {
        this.json({ success: true, message, data });
    }

    public send(data: any): void {
        if (typeof data === "object" && !Buffer.isBuffer(data)) {
            this.json(data);
        } else {
            this.end(data);
        }
    }

    /**
     * Send a file as the response.
     */
    public async sendFile(
        filePath: string,
        options?: import("../../types/httpServer.type").SendFileOptions,
    ): Promise<void> {
        const handler = new SendFileHandler(this as any);
        await handler.handle(filePath, options);
    }

    public xJson(data: any): void {
        this.json(data);
    }

    public redirect(url: string | number, altUrl?: string): void {
        let status = 302;
        let targetUrl = "";

        if (typeof url === "number") {
            status = url;
            targetUrl = altUrl || "";
        } else {
            targetUrl = url;
        }

        this.status(status);
        this.setHeader("Location", targetUrl);
        this.end();
    }

    public cookie(name: string, value: string, options?: any): any {
        // Implementation for cookies
        const cookieStr = `${name}=${value}`;
        this.setHeader("Set-Cookie", cookieStr);
        return this;
    }

    public clearCookie(name: string, options?: any): any {
        return this.cookie(name, "", { ...options, expires: new Date(0) });
    }

    public get(name: string): any {
        return this.getHeader(name);
    }

    /**
     * Initializes a secure XEMS session.
     * Overridden by XEMS Session Middleware if enabled.
     */
    public async xLink(
        data: any,
        options?:
            | { sandbox?: string; attachTo?: string; ttl?: string }
            | string,
    ): Promise<string> {
        throw new Error(
            "xLink() requires XEMS session middleware to be enabled. " +
                "Please set 'server.xems.enable: true' in your server options.",
        );
    }
}

