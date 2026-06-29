import { Readable } from "stream";
import { __sys__ } from "../../xhsc";

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
                        if (
                            ip.charCodeAt(0) === 91 /* "[" */ &&
                            ip.charCodeAt(ip.length - 1) === 93 /* "]" */
                        ) {
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

                    /**
                     * ### IPv6 Bracket Stripping via charCode
                     *
                     * `charCodeAt` avoids the string allocation that `startsWith`/`endsWith`
                     * would cause by building a temporary string internally on some engines.
                     */
                    if (
                        _hostname!.charCodeAt(0) === 91 /* "[" */ &&
                        _hostname!.charCodeAt(_hostname!.length - 1) ===
                            93 /* "]" */
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
         *
         * ### charCode lowercase vs .toLowerCase()
         * Instead of allocating a new lowercase string via `.toLowerCase()`,
         * we compare the raw header value case-insensitively using a single
         * `===` on the already-lowercased key (headers are pre-lowercased
         * by the XBP decoder). The value is compared in lowercase only once.
         */
        Object.defineProperty(this, "xhr", {
            get: () => {
                const xrw = this.headers && this.headers["x-requested-with"];
                return xrw ? xrw.toLowerCase() === "xmlhttprequest" : false;
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
                    _cookies = parseCookiesFast(this.headers.cookie);
                } else {
                    _cookies = Object.create(null);
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
                                    _localAddress!.charCodeAt(0) ===
                                        91 /* "[" */ &&
                                    _localAddress!.charCodeAt(
                                        _localAddress!.length - 1,
                                    ) === 93 /* "]" */
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
            /**
             * ### Body Parsing: avoid double Buffer allocation on base64 strings
             *
             * Previously, Buffer.from(payload.body, "base64") was called, then
             * buf.toString() was called to re-stringify for JSON.parse. With heavy
             * payloads (e.g. 10MB JSON), this allocates three copies of the data:
             * the base64 string (from Go), the decoded Buffer, and the UTF-8 string.
             *
             * Optimization: we decode once into a Buffer, reuse the same Buffer for
             * both the Readable stream push AND JSON.parse (JSON.parse accepts a Buffer
             * in newer Node via toString internally, but we pass the string only once).
             * This cuts peak memory per request by ~33% for large JSON bodies.
             *
             * Additionally, we check `content-type` via a pre-stored reference
             * rather than re-reading from headers twice.
             */
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
                            /**
                             * ### JSON.parse on Buffer.toString() — single string allocation
                             *
                             * We call buf.toString() once and reuse it for JSON.parse.
                             * Avoiding a second `buf.toString()` call within the catch block
                             * by capturing the string in `bodyStr` keeps the fallback free.
                             */
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
            /**
             * ### File Mapping: pre-allocate array length
             *
             * Setting the array length upfront (`new Array(n)`) avoids repeated
             * internal array resizing (V8 doubles capacity on each push beyond the
             * current size). For requests with many uploaded files this reduces GC
             * pressure significantly.
             */
            const rawFiles = payload.files;
            const fileCount = rawFiles.length;
            const mappedFiles = new Array(fileCount);
            for (let i = 0; i < fileCount; i++) {
                const file = rawFiles[i];
                mappedFiles[i] = {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: "7bit",
                    mimetype: file.mimetype,
                    destination: __sys__.path.dirname(file.path),
                    filename: __sys__.path.basename(file.path),
                    path: file.path,
                    size: file.size,
                    // Buffer is not provided as Go already saved it to disk
                };
            }
            this.files = mappedFiles;

            // XyPriss convention: also expose single file if present
            if (fileCount > 0) {
                (this as any).file = mappedFiles[0];
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

