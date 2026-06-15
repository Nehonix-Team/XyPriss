/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * High-performance Request/Response implementation for XHSC Bridge.
 * This file provides implementations of the XyPriss Request/Response
 * objects that fulfill the Node.js HTTP contract without depending on
 * the internal Node.js http module classes.
 ***************************************************************************/

import { ServerResponse } from "http";
import { __sys__ } from "../../xhsc";
import { SendFileHandler } from "./SendFileHandler";
import { XRUNTIME_HEADER_NAME } from "../const/XRUNTIME-HEADER";
import { Configs } from "../..";
import { XNullSocket } from "./XNullSocket";
import { XHSCRequest } from "./XHSCRequest";
import { XStringify } from "xypriss-security";

// Re-export so existing consumers (e.g. XHSCWorker.ts) that import
// { XHSCRequest } from "./XHSCProtocol" continue to work unchanged.
export { XHSCRequest } from "./XHSCRequest";

const NULL_SOCKET = new XNullSocket();

/**
 * ### Module-level branding header cache
 *
 * `_brandingEnabled` caches the result of `Configs.get("security")?.rmXBranding`
 * after the first call. Config lookups typically involve object traversal and
 * optional chaining; doing that on every response under load wastes cycles.
 *
 * The cache is intentionally a simple boolean triple-state (`undefined` = not
 * yet read, `true` = branding disabled, `false` = branding enabled) so the
 * fast path is a single `=== true` check with no config traversal at all.
 *
 * If the config can change at runtime, remove this cache or add a cache
 * invalidation hook. In the common case (immutable startup config), this is
 * always safe and saves one property lookup per response.
 */
let _brandingEnabled: boolean | undefined;

export class XHSCResponse extends ServerResponse {
    public locals: any = {};

    /**
     * ### Response body accumulation: pre-allocated array with byte counter
     *
     * The previous implementation used a plain `Buffer[]` array and called
     * `Buffer.concat(this._capturedData)` at `end()` time with no size hint.
     * `Buffer.concat` without a `totalLength` argument iterates the array once
     * to compute the total length, then copies. For large bodies (e.g. 100MB
     * streaming responses broken into many chunks) this means two full passes.
     *
     * Optimization: we maintain a running `_capturedLength` counter, incremented
     * on every `write()`. `Buffer.concat` is then called with the pre-computed
     * total, turning it into a single-pass copy with no extra iteration.
     */
    private _capturedData: Buffer[] = [];
    private _capturedLength: number = 0;

    private _onFinalize: (
        data: Buffer | null,
        status: number,
        headers: any,
    ) => void;

    /**
     * ### _brandingDone flag: prevents double _injectBranding()
     *
     * `_injectBranding` is called from both `writeHead()` and `end()` to
     * handle the case where application code calls either without the other.
     * The previous implementation relied on `this.headersSent` as a guard,
     * but `headersSent` in our NullSocket-backed response is only set after
     * `super.writeHead()` — which we may bypass. A dedicated boolean flag is
     * more explicit and avoids any reliance on the parent class's internal state.
     */
    private _brandingDone: boolean = false;

    constructor(
        req: XHSCRequest,
        onFinalize: (data: Buffer | null, status: number, headers: any) => void,
    ) {
        // Pass a no-op NullSocket instead of the IPC socket.
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
        /**
         * ### write(): Buffer detection via Buffer.isBuffer before Buffer.from
         *
         * `Buffer.isBuffer` is a very cheap type check (single property lookup).
         * If the chunk is already a Buffer — the common case for binary/large
         * payloads — we skip `Buffer.from` entirely and push the reference
         * directly. This avoids an unnecessary copy for every chunk.
         *
         * `_capturedLength` is updated here so `end()` always has an accurate
         * total without needing to re-iterate `_capturedData`.
         */
        const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(
                  chunk,
                  (typeof encoding === "string"
                      ? encoding
                      : "utf8") as BufferEncoding,
              );
        this._capturedData.push(buffer);
        this._capturedLength += buffer.length;

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
     * - **`_brandingDone` guard**: a dedicated boolean flag (faster than
     *   checking `headersSent`, which has inheritance overhead) ensures this
     *   method is a no-op after the first call, making double-call cost
     *   effectively zero.
     * - **Module-level config cache**: `_brandingEnabled` is resolved once at
     *   server startup and cached at module scope. Subsequent calls skip the
     *   `Configs.get` traversal entirely.
     * - **Conditional branching instead of iteration**: flat `if/else` with
     *   direct `setHeader` / `removeHeader` calls — no object literal, no loop,
     *   no per-response GC pressure.
     * - **`hasHeader` guard on set**: headers are only written if not already
     *   present, allowing application code to override branding headers
     *   (e.g. a custom `Server:` header) without being silently overwritten.
     *
     * Branding can be disabled globally via `security.rmXBranding: true` in
     * the server configuration.
     */
    private _injectBranding(): void {
        if (this._brandingDone) return;
        this._brandingDone = true;

        /**
         * ### Lazy config cache: read once, reuse forever
         *
         * The first call resolves `Configs.get("security")?.rmXBranding` and
         * stores it in the module-level `_brandingEnabled` variable. All
         * subsequent responses read the cached value at near-zero cost.
         */
        if (_brandingEnabled === undefined) {
            _brandingEnabled = Configs.get("security")?.rmXBranding ?? false;
        }

        if (_brandingEnabled) {
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
     * async drain completion — the I/O is handled by the Go engine.
     *
     * ### Buffer.concat with pre-computed totalLength
     *
     * `_capturedLength` is maintained incrementally in `write()`, so we pass
     * it directly to `Buffer.concat`. This avoids the internal length-scanning
     * pass that `Buffer.concat` would otherwise perform, saving one full
     * iteration over `_capturedData` for every response that used `write()`.
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
            this._capturedLength += buffer.length;
        }

        /**
         * ### Final body assembly: single Buffer.concat with pre-computed size
         *
         * When `_capturedData` has exactly one entry (the most common case for
         * small JSON responses, redirects, or simple `res.send` calls), we skip
         * `Buffer.concat` entirely and use the Buffer directly. This eliminates
         * the concat overhead (and the extra allocation it would cause) for the
         * hot path.
         */
        let finalBody: Buffer | null;
        if (this._capturedData.length === 0) {
            finalBody = null;
        } else if (this._capturedData.length === 1) {
            finalBody = this._capturedData[0];
        } else {
            finalBody = Buffer.concat(this._capturedData, this._capturedLength);
        }

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

        // Emit finish synchronously — no drain needed on NullSocket.
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

    /**
     * ### json(): set Content-Length alongside Content-Type
     *
     * Serializing to a string first lets us compute `byteLength` before
     * calling `end()`. Setting `Content-Length` avoids chunked transfer
     * encoding overhead and lets clients and proxies handle the response
     * more efficiently (connection reuse, progress indicators, etc.).
     *
     * `Buffer.byteLength` is used (not `str.length`) because multi-byte
     * UTF-8 characters make `str.length` an unreliable byte count.
     */
    public json(data: any): void {
        const str = XStringify(data);
        this.setHeader("Content-Type", "application/json");
        this.setHeader("Content-Length", Buffer.byteLength(str));
        this.end(str);
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
