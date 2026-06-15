import { Readable, Writable } from "stream";

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

