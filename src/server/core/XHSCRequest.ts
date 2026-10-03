import { Readable } from "stream";
import { __sys__ } from "../../xhsc";

class XHSCSocketWrapper {
    private _localAddress: string = "";
    private _localPort: number = 0;

    constructor(
        private readonly _req: XHSCRequest,
        private readonly _payload: any,
        private readonly _rawSocket: any,
    ) {}

    public get remoteAddress(): string {
        return this._req.ip;
    }

    public get remotePort(): number {
        const _ = this._req.ips;
        return (this._req as any)._remotePort || 0;
    }

    public get localAddress(): string {
        if (!this._localAddress) {
            const localAddr: string = this._payload?.local_addr || "127.0.0.1:0";
            const lastLocalColon = localAddr.lastIndexOf(":");
            if (lastLocalColon !== -1) {
                let addr = localAddr.substring(0, lastLocalColon);
                if (
                    addr.charCodeAt(0) === 91 /* "[" */ &&
                    addr.charCodeAt(addr.length - 1) === 93 /* "]" */
                ) {
                    addr = addr.substring(1, addr.length - 1);
                }
                this._localAddress = addr || "127.0.0.1";
                this._localPort = parseInt(localAddr.substring(lastLocalColon + 1) || "0", 10);
            } else {
                this._localAddress = localAddr || "127.0.0.1";
            }
        }
        return this._localAddress || "127.0.0.1";
    }

    public get localPort(): number {
        if (!this._localAddress) {
            const _ = this.localAddress;
        }
        return this._localPort;
    }

    public get encrypted(): boolean {
        return this._req.secure;
    }

    public destroy(err?: any): void {
        if (this._rawSocket?.destroy) this._rawSocket.destroy(err);
    }

    public end(): void {
        if (this._rawSocket?.end) this._rawSocket.end();
    }
}

const NULL_SOCKET_WRAPPER = {
    remoteAddress: "127.0.0.1",
    remotePort: 0,
    localAddress: "127.0.0.1",
    localPort: 0,
    encrypted: false,
    destroy: () => {},
    end: () => {},
};

function attachGetHelper(obj: Record<string, any>): any {
    if (!obj) obj = {};
    if (!obj._get) {
        Object.defineProperty(obj, "_get", {
            enumerable: false,
            configurable: true,
            writable: true,
            value: function (key: string, defaultValue?: any) {
                const val = this[key];
                return val !== undefined ? val : defaultValue;
            },
        });
    }
    return obj;
}

/**
 * **XHSC High-Performance Request Object**
 *
 * Implementation of the XyPriss HTTP Request object, built to bridge
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

    public subdomains: string[] = [];
    public fresh: boolean = true;
    public stale: boolean = false;

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

        /**
         * ### Header Flattening: Object.create(null) for zero-prototype overhead
         *
         * Using `Object.create(null)` avoids the prototype chain lookup cost on
         * every property access (no `hasOwnProperty`, no inherited `toString`
         * shadowing). This is measurably faster in tight header-lookup loops
         * and also prevents prototype pollution attacks via header injection.
         */
        this.headers = Object.create(null);
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

        this.query = attachGetHelper(payload.query || {});
        this.params = attachGetHelper(payload.params || {});
        this.body = null;

        /**
         * ### Path Extraction: single-pass indexOf instead of split("?")
         *
         * `split("?")` always allocates a new array and potentially two strings.
         * `indexOf` + `substring` produces only one string and zero array allocation,
         * which matters at high request throughput where GC pressure compounds.
         */
        const qIdx = payload.url ? payload.url.indexOf("?") : -1;
        let reqPath =
            qIdx === -1 ? payload.url || "/" : payload.url.substring(0, qIdx);
        if (
            reqPath.length > 1 &&
            reqPath.charCodeAt(reqPath.length - 1) === 47 /* "/" */
        ) {
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
        this._payload = payload;
        this.socket = socket ? new XHSCSocketWrapper(this, payload, socket) : NULL_SOCKET_WRAPPER;

        if (payload.body) {
            try {
                if (typeof payload.body === "string") {
                    const buf = Buffer.from(payload.body, "base64");
                    this.push(buf);
                    const contentType: string =
                        this.headers["content-type"] || "";
                    if (
                        contentType.includes("application/json") ||
                        contentType.includes(
                            "application/x-www-form-urlencoded",
                        ) ||
                        contentType.includes("multipart/form-data")
                    ) {
                        try {
                            const bodyStr = buf.toString();
                            this.body = JSON.parse(bodyStr);
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
            const rawFiles = payload.files;
            const fileCount = rawFiles.length;
            const mappedFiles = new Array(fileCount);
            for (let i = 0; i < fileCount; i++) {
                const file = rawFiles[i];
                const mappedFile: any = {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: "7bit",
                    mimetype: file.mimetype,
                    destination: __sys__.path.dirname(file.path),
                    filename: __sys__.path.basename(file.path),
                    path: file.path,
                    size: file.size,
                };

                let _cachedBuffer: Buffer | undefined = undefined;
                Object.defineProperty(mappedFile, "buffer", {
                    get() {
                        if (_cachedBuffer !== undefined) {
                            return _cachedBuffer;
                        }
                        if (mappedFile.path) {
                            try {
                                if (__sys__.fs.exist(mappedFile.path)) {
                                    _cachedBuffer = __sys__.fs.readBytesSync(mappedFile.path);
                                    return _cachedBuffer;
                                }
                            } catch {}
                        }
                        return undefined;
                    },
                    set(val: Buffer | undefined) {
                        _cachedBuffer = val;
                    },
                    configurable: true,
                    enumerable: true,
                });

                mappedFiles[i] = mappedFile;
            }
            this.files = mappedFiles;

            if (fileCount > 0) {
                (this as any).file = mappedFiles[0];
            }
        }

        if (payload.upload_errors) {
            (this as any).uploadErrors = payload.upload_errors;
        }

        this.push(null); // End stream
    }

    private _payload: any;
    private _ip: string = "";
    private _ips?: string[];
    private _remotePort: number = 0;
    private _hostname: string = "";
    private _cookies?: Record<string, string>;

    public get ips(): string[] {
        if (this._ips !== undefined) return this._ips;
        const remoteAddrStr: string = this._payload?.remote_addr || "127.0.0.1:0";
        if (remoteAddrStr.includes(",")) {
            const parsedIps = remoteAddrStr
                .split(",")
                .map((i: string) => i.trim())
                .filter(Boolean);
            const validIps = parsedIps.length > 0 ? parsedIps : ["127.0.0.1"];
            this._ips = validIps;
            this._ip = validIps[0] || "127.0.0.1";
        } else {
            const lastColon = remoteAddrStr.lastIndexOf(":");
            let ip = "127.0.0.1";
            if (lastColon !== -1) {
                ip = remoteAddrStr.substring(0, lastColon);
                if (
                    ip.charCodeAt(0) === 91 /* "[" */ &&
                    ip.charCodeAt(ip.length - 1) === 93 /* "]" */
                ) {
                    ip = ip.substring(1, ip.length - 1);
                }
            } else {
                ip = remoteAddrStr;
            }
            this._ip = ip || "127.0.0.1";
            this._remotePort =
                lastColon !== -1
                    ? parseInt(
                          remoteAddrStr.substring(lastColon + 1) || "0",
                          10,
                      )
                    : 0;
            this._ips = [this._ip];
        }
        return this._ips ?? ["127.0.0.1"];
    }

    public get ip(): string {
        if (!this._ip) {
            const _ = this.ips;
        }
        return this._ip || "127.0.0.1";
    }

    public get hostname(): string {
        if (this._hostname) return this._hostname;
        if (this.headers && this.headers.host) {
            const host = this.headers.host;
            const lastHostColon = host.lastIndexOf(":");
            if (lastHostColon !== -1 && host.includes("]")) {
                const ClosingBracket = host.lastIndexOf("]");
                if (
                    ClosingBracket !== -1 &&
                    lastHostColon > ClosingBracket
                ) {
                    this._hostname = host.substring(0, lastHostColon);
                } else {
                    this._hostname = host;
                }
            } else if (lastHostColon !== -1) {
                this._hostname = host.substring(0, lastHostColon);
            } else {
                this._hostname = host;
            }

            if (
                this._hostname &&
                this._hostname.charCodeAt(0) === 91 /* "[" */ &&
                this._hostname.charCodeAt(this._hostname.length - 1) === 93 /* "]" */
            ) {
                this._hostname = this._hostname.substring(
                    1,
                    this._hostname.length - 1,
                );
            }
        } else {
            this._hostname = "localhost";
        }
        return this._hostname || "localhost";
    }

    public get protocol(): string {
        return (this.headers && this.headers["x-forwarded-proto"]) || "http";
    }

    public get secure(): boolean {
        return this.protocol === "https";
    }

    public get xhr(): boolean {
        const xrw = this.headers && this.headers["x-requested-with"];
        return xrw ? xrw.toLowerCase() === "xmlhttprequest" : false;
    }

    public get cookies(): Record<string, string> {
        if (this._cookies) return this._cookies;
        if (this.headers && this.headers.cookie) {
            this._cookies = parseCookiesFast(this.headers.cookie);
        } else {
            this._cookies = Object.create(null);
        }
        return this._cookies!;
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

    /**
     * ### get() / header(): no .toLowerCase() on every call
     *
     * Headers are already lowercased by the XBP decoder, so we only need to
     * lowercase the caller-supplied name. This is unavoidable but kept to a
     * single call per lookup.
     */
    public get(name: string): string | undefined {
        return this.headers[name.toLowerCase()];
    }

    public header(name: string): string | undefined {
        return this.get(name);
    }
}

/**
 * ### Module-level cookie parser: avoids per-request closure allocation
 *
 * The previous `parseCookies` was an instance method, which means V8 had to
 * resolve it through the prototype chain on every call. Extracting it as a
 * module-level function makes it a direct reference — no prototype traversal,
 * no closure capture of `this`.
 *
 * ### Algorithm: index-based scan instead of split("=") arrays
 *
 * The original implementation called `pair.split("=")` for every cookie pair.
 * For cookies with `=` signs in their value (e.g. base64), this also discards
 * everything after the first `=` because of array destructuring `[key, value]`.
 *
 * This implementation:
 * 1. Splits only on `";"` (unavoidable — one array total).
 * 2. For each pair, finds the `=` with `indexOf` and uses `substring` to extract
 *    key and value without allocating sub-arrays.
 * 3. Handles values containing `=` correctly (base64 cookie values are common).
 * 4. Uses `Object.create(null)` to avoid prototype overhead on the result map.
 *
 * @param cookieHeader - Raw `Cookie:` header string.
 * @returns A null-prototype object mapping cookie names to decoded values.
 */
function parseCookiesFast(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = Object.create(null);
    const pairs = cookieHeader.split(";");
    const len = pairs.length;
    for (let i = 0; i < len; i++) {
        const pair = pairs[i];
        const eqIdx = pair.indexOf("=");
        if (eqIdx === -1) continue;
        const key = pair.substring(0, eqIdx).trim();
        if (!key) continue;
        const val = pair.substring(eqIdx + 1).trim();
        try {
            cookies[key] = decodeURIComponent(val);
        } catch {
            /**
             * ### Malformed URI component: store raw value as fallback
             *
             * `decodeURIComponent` throws on invalid percent-encoded sequences.
             * Rather than dropping the cookie entirely (which could break auth
             * flows), we store the raw string. The application layer can decide
             * how to handle it.
             */
            cookies[key] = val;
        }
    }
    return cookies;
}

