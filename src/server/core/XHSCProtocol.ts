/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * High-performance Request/Response implementation for XHSC Bridge.
 * This file provides REAL implementations of the XyPriss Request/Response
 * objects that fulfill the Node.js HTTP contract without depending on
 * the internal Node.js http module classes.
 ***************************************************************************/

import { Readable, Writable } from "stream";

/**
 * Real implementation of XyPriss Request for XHSC.
 * Extends Readable to support stream-based body reading.
 */
export class XHSCRequest extends Readable {
    public method: string;
    public url: string;
    public headers: any;
    public query: any;
    public params: any;
    public body: any;
    public path: string;
    public originalUrl: string;
    public baseUrl: string = "";
    public socket: any;
    public httpVersion: string = "1.1";
    public httpVersionMajor: number = 1;
    public httpVersionMinor: number = 1;
    public app: any;

    // Express compatibility properties
    public ip: string;
    public ips: string[];
    public cookies: Record<string, string> = {};
    public protocol: string = "http";
    public secure: boolean = false;
    public hostname: string = "localhost";
    public subdomains: string[] = [];
    public fresh: boolean = true;
    public stale: boolean = false;
    public xhr: boolean = false;

    constructor(payload: any, socket?: any) {
        super();
        this.method = payload.method;
        this.url = payload.url;

        // Flatten and lowercase headers for Node.js compatibility
        this.headers = {};
        if (payload.headers) {
            for (const [key, value] of Object.entries(payload.headers)) {
                const lcKey = key.toLowerCase();
                const val = value as any;
                if (val && val.Single !== undefined) {
                    this.headers[lcKey] = val.Single;
                } else if (val && val.Multiple !== undefined) {
                    this.headers[lcKey] = val.Multiple;
                } else {
                    this.headers[lcKey] = val;
                }
            }
        }

        this.query = payload.query || {};
        this.params = payload.params || {};
        this.body = null; // Will be populated by body parser
        this.path = payload.url ? payload.url.split("?")[0] : "/";
        this.originalUrl = payload.url || "/";

        // Parse remote address and port
        const remoteParts = (payload.remote_addr || "127.0.0.1:0").split(":");
        this.ip = remoteParts[0];
        const remotePort = parseInt(remoteParts[1] || "0", 10);
        this.ips = [this.ip];

        // Parse local address and port
        const localParts = (payload.local_addr || "127.0.0.1:0").split(":");
        const localAddress = localParts[0];
        const localPort = parseInt(localParts[1] || "0", 10);

        // Extract hostname from headers
        if (this.headers && this.headers.host) {
            this.hostname = this.headers.host.split(":")[0];
        }

        // Real protocol detection
        if (this.headers) {
            this.protocol = this.headers["x-forwarded-proto"] || "http";
            this.secure = this.protocol === "https";

            // Real XHR detection
            this.xhr =
                (this.headers["x-requested-with"] || "").toLowerCase() ===
                "xmlhttprequest";

            // Real Cookies parsing
            if (this.headers.cookie) {
                this.cookies = this.parseCookies(this.headers.cookie);
            } else {
                this.cookies = {};
            }
        } else {
            this.protocol = "http";
            this.secure = false;
            this.xhr = false;
            this.cookies = {};
        }

        // Use the IPC socket as the underlying socket
        // We mask its properties to reflect the CLIENT context
        this.socket = socket || {
            destroy: () => {},
            end: () => {},
        };

        if (socket) {
            Object.defineProperties(this.socket, {
                remoteAddress: { get: () => this.ip, configurable: true },
                remotePort: { get: () => remotePort, configurable: true },
                localAddress: { get: () => localAddress, configurable: true },
                localPort: { get: () => localPort, configurable: true },
                encrypted: { get: () => this.secure, configurable: true },
            });
        }

        if (payload.body) {
            // Go serializes []byte as Base64 in JSON. We must decode it.
            try {
                if (typeof payload.body === "string") {
                    this.push(Buffer.from(payload.body, "base64"));
                } else {
                    this.push(Buffer.from(payload.body));
                }
            } catch (e) {
                this.push(Buffer.from(payload.body));
            }
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
 * Real implementation of XyPriss Response for XHSC.
 * Extends Writable to support stream-based response writing.
 */
export class XHSCResponse extends Writable {
    public statusCode: number = 200;
    public statusMessage: string = "OK";
    public headersSent: boolean = false;
    public locals: any = {};
    public socket: any;
    private _headers: Record<string, any> = {};
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
        super();
        this._onFinalize = onFinalize;
        this.socket = req.socket;

        // Compatibility with middleware that expects these properties
        (this as any).req = req;
    }

    public status(code: number): any {
        this.statusCode = code;
        return this;
    }

    public setHeader(name: string, value: any): any {
        if (this.headersSent) return this;
        this._headers[name.toLowerCase()] = value;
        return this;
    }

    public set(field: string | Record<string, any>, value?: any): any {
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
        return this._headers[name.toLowerCase()];
    }

    public getHeaders(): any {
        return { ...this._headers };
    }

    public hasHeader(name: string): boolean {
        return !!this._headers[name.toLowerCase()];
    }

    public removeHeader(name: string): void {
        delete this._headers[name.toLowerCase()];
    }

    public writeHead(
        statusCode: number,
        statusMessage?: any,
        headers?: any,
    ): any {
        if (this.headersSent) return this;

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
        if (!this.headersSent) {
            this.headersSent = true;
        }
        return super.write(chunk, encoding, callback);
    }

    _write(
        chunk: any,
        encoding: string,
        callback: (error?: Error | null) => void,
    ): void {
        const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk, encoding as BufferEncoding);
        this._capturedData.push(buffer);
        callback();
    }

    public end(chunk?: any, encoding?: any, callback?: any): any {
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

        if (!this.headersSent) {
            this.headersSent = true;
        }

        const finalBody =
            this._capturedData.length > 0
                ? Buffer.concat(this._capturedData)
                : null;
        this._onFinalize(finalBody, this.statusCode, this._headers);

        super.end();

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

    public send(data: any): void {
        if (typeof data === "object" && !Buffer.isBuffer(data)) {
            this.json(data);
        } else {
            this.end(data);
        }
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
    public async xLink(data: any): Promise<string> {
        console.log("data: ", data);
        throw new Error(
            "xLink() requires XEMS session middleware to be enabled. " +
                "Please set 'server.xems: true' in your server options.",
        );
    }
}

