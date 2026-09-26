/**
 * Configuration options for XEMS (XyPriss Entry Management System).
 *
 * XEMS is a high-security, hardware-bound encrypted persistence engine and session manager
 * powered by a native Go sidecar. It enforces AES-256-GCM encryption for in-memory and on-disk
 * data with zero raw data exposure in the Node.js V8 JavaScript heap.
 *
 * @see https://xypriss.nehonix.com/docs/security/xems/tutorial
 */
export type XemsTypes = XemsDisabledOptions | XemsEnabledOptions;

/**
 * Explicitly disabled XEMS configuration.
 * Useful for auxiliary worker processes or micro-services not managing user sessions.
 */
export interface XemsDisabledOptions extends XemsBaseOptions {
    /**
     * Set to `false` to disable the XEMS sidecar and session tracking.
     */
    enable: false;

    /**
     * Optional path when disabled.
     */
    path?: string;

    /**
     * Optional encryption secret when disabled.
     */
    secret?: string;
}

/**
 * Active XEMS configuration with mandatory encrypted vault settings.
 */
export interface XemsEnabledOptions extends XemsBaseOptions {
    /**
     * Whether XEMS is enabled for this server instance (defaults to `true`).
     */
    enable?: true;

    /**
     * Absolute or relative path to the encrypted vault file (with `.xems` extension).
     *
     * @security-architecture
     * The master key is derived via `SHA-256(HWID || Secret || AbsoluteVaultPath)`.
     * If the `.xems` file is copied to another machine or moved to another folder on the
     * same machine, AES-256-GCM decryption will mathematically fail, preventing vault extraction.
     *
     * @example
     * ```typescript
     * path: __sys__.vars.get("xems.data.path") // e.g. path.resolve(process.cwd(), "vault.xems")
     * ```
     */
    path: string;

    /**
     * Mandatory 32-byte (256-bit) encryption secret key.
     *
     * Combined with the machine's hardware identifier (HWID) and the vault's absolute filesystem path
     * to derive the AES-256-GCM AEAD encryption key.
     *
     * @important Must contain at least 32 characters / bytes.
     * @example
     * ```typescript
     * secret: __sys__.__env__.getStrict("XEMS_SECRET")
     * ```
     */
    secret: string;
}

/**
 * Common configurable options for XEMS session management and engine behaviors.
 */
export interface XemsBaseOptions {
    /**
     * Isolated storage namespace (Sandbox partition).
     *
     * All keys and sessions inside this sandbox are logically isolated from other sandboxes
     * and use separate AEAD additional authenticated data (AAD).
     *
     * @default "xypriss.internal.session.xems"
     */
    sandbox?: string;

    /**
     * Default Time-to-Live (TTL) duration for stored records and user sessions.
     * Accepts natural duration strings such as `"15m"`, `"1h"`, `"2d"`, `"7d"`.
     *
     * @important XEMS enforces a HARD RETENTION LIMIT of 7 days (`"7d"`). Any value exceeding 7 days will be automatically capped.
     * @default "7d"
     * @example `"30m"`, `"2h"`, `"7d"`
     */
    ttl?: string;

    /**
     * Name of the HttpOnly cookie used for session tracking in web browsers.
     *
     * @default "xems_token"
     * @example "__Secure-sid", "xems_session"
     */
    cookieName?: string;

    /**
     * Name of the HTTP response/request header used for session tracking (for REST/GraphQL/Mobile API clients).
     *
     * @default "x-xypriss-token"
     */
    headerName?: string;

    /**
     * Automatic session token rotation strategy (Anti-Session Hijacking & Anti-Replay).
     *
     * - `false`: No automatic rotation (token remains constant throughout session lifespan).
     * - `true` or `"request"`: Rotate on every HTTP request.
     * - `"sec"` / `"10s"` / `"30s"`: Rotate every X seconds.
     * - `"minute"` / `"1m"` / `"5m"`: Sliding time-window rotation (Recommended for SPAs).
     * - `"hour"` / `"1h"`: Rotate every hour.
     *
     * @recommended For modern SPAs (React, Vue, Vite) with concurrent background requests, use `"1m"` or `"5m"`.
     * @default false
     */
    autoRotation?:
        | boolean
        | "request"
        | "sec"
        | "minute"
        | "hour"
        | "day"
        | string;

    /**
     * Property name on the XyPriss `req` object where decoded session data will be attached.
     *
     * @default "session"
     * @example "session" -> Accessible via `req.session`
     */
    attachTo?: string;

    /**
     * Sidecar hardware resource allocations.
     */
    resources?: {
        /**
         * Cache memory buffer size in MB reserved for high-throughput memory indexing.
         * @default 64
         */
        cacheSize?: number;
    };

    /**
     * Security and scope attributes for the session `Set-Cookie` header.
     */
    cookieOptions?: CookieOptions;

    /**
     * Transition grace period (in milliseconds) for rotated session tokens.
     *
     * When a token is rotated ($T_0 \to T_1$), the previous token ($T_0$) remains temporarily
     * valid for read-only access during this grace period. Any concurrent requests in flight
     * will succeed and automatically receive the new active token ($T_1$).
     *
     * @maximum 55000 (55 seconds maximum security cap)
     * @default 15000 (15 seconds)
     */
    gracePeriod?: number;
}

/**
 * Cookie configuration attributes adhering to RFC 6265 specifications.
 */
export interface CookieOptions {
    /**
     * Prevents client-side JavaScript access (`document.cookie`), mitigating XSS cookie theft.
     * @default true
     */
    httpOnly?: boolean;

    /**
     * Ensures the cookie is only transmitted over encrypted HTTPS connections.
     * @default true
     */
    secure?: boolean;

    /**
     * Controls whether the cookie is sent with cross-site requests to mitigate CSRF attacks.
     * - `"Strict"`: Cookie is only sent in a first-party context.
     * - `"Lax"`: Cookie is sent when navigating to the origin site.
     * - `"None"`: Cookie is sent in all contexts (Requires `secure: true`).
     * @default "Strict"
     */
    sameSite?: "Strict" | "Lax" | "None";

    /**
     * URI path that must exist in the requested URL for the browser to send the Cookie header.
     * @default "/"
     */
    path?: string;

    /**
     * Specifies allowed hosts to receive the cookie (e.g., `".nehonix.com"` for all subdomains).
     */
    domain?: string;

    /**
     * Number of milliseconds until the cookie expires (relative to the current time).
     */
    maxAge?: number;

    /**
     * The absolute expiration date of the cookie.
     */
    expires?: Date;

    /**
     * Cryptographic tamper-proofing flag (HMAC-SHA256 signature).
     * @default false
     */
    signed?: boolean;
}



