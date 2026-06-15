/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * High-performance Request/Response implementation for XHSC Bridge.
 * This file provides REAL implementations of the XyPriss Request/Response
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

const NULL_SOCKET = new XNullSocket();

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


