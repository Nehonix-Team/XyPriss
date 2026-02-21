/**
 * Interface representing XEMS (XyPriss Encrypted Memory Store) configurations.
 * XEMS is a specialized temporary database with high-security features.
 */
export interface XemsTypes {
    /**
     * Whether XEMS is enabled for this server instance.
     */
    enable?: boolean;

    /**
     * The default isolated storage namespace (Sandbox).
     */
    sandbox?: string;

    /**
     * Default Time-to-Live for stored records (e.g., "15m", "1h", "2d").
     * @important XEMS enforces a HARD GLOBAL LIMIT of 5 days. Any value exceeding "5d" will be capped.
     */
    ttl?: string;

    /**
     * Name of the HttpOnly cookie used for session tracking.
     */
    cookieName?: string;

    /**
     * Name of the HTTP header used for session tracking (for API callers).
     */
    headerName?: string;

    /**
     * Whether to automatically rotate tokens on every request.
     * Core of the "Moving Target Defense" strategy.
     */
    autoRotation?: boolean;

    /**
     * Property on the request object where session data will be attached (default: "session").
     */
    attachTo?: string;

    /**
     * Persistent storage configuration.
     */
    persistence?: {
        /**
         * Whether to persist data to disk in an encrypted vault.
         */
        enabled: boolean;

        /**
         * Path to the encrypted vault file.
         */
        path?: string;

        /**
         * Mandatory 32-byte (256-bit) encryption secret.
         * Used in combination with hardware ID for vault encryption.
         */
        secret: string;

        /**
         * Resource allocation for the XEMS sidecar.
         */
        resources?: {
            /** Cache size in MB (reserved for indexing performance) */
            cacheSize?: number;
        };
    };

    /**
     * Security options for the HttpOnly cookie.
     */
    cookieOptions?: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: string;
    };

    /**
     * Grace period for rotated sessions.
     * Duration in milliseconds for which the old token remains valid for READ access after rotation.
     * Prevents race conditions with simultaneous requests.
     * @maximum 55000 (55 seconds)
     */
    gracePeriod?: number;
}

