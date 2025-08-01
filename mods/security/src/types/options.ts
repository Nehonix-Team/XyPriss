/**
 * Options for secure token generation
 */
export interface SecureTokenOptions {
    /**
     * Length of the token to generate
     * @default 32
     */
    length?: number;

    /**
     * Include uppercase letters in the token
     * @default true
     */
    includeUppercase?: boolean;

    /**
     * Include lowercase letters in the token
     * @default true
     */
    includeLowercase?: boolean;

    /**
     * Include numbers in the token
     * @default true
     */
    includeNumbers?: boolean;

    /**
     * Include symbols in the token
     * @default false
     */
    includeSymbols?: boolean;

    /**
     * Exclude similar characters that can be confused (like 1, l, I, 0, O)
     * @default false
     */
    excludeSimilarCharacters?: boolean;

    /**
     * Entropy level for token generation
     * @default 'high'
     */
    entropy?: "standard" | "high" | "maximum";
}

/**
 * Options for hashing operations
 */
export interface HashOptions {
    /**
     * Hashing algorithm to use
     * @default 'sha256'
     */
    algorithm?: "sha256" | "sha512" | "sha3" | "blake3";

    /**
     * Number of iterations for the hash
     * @default 1
     */
    iterations?: number;

    /**
     * Salt to use for the hash
     * If not provided, a random salt will be generated
     */
    salt?: string | Uint8Array;

    /**
     * Application-specific pepper to add to the hash
     */
    pepper?: string;

    /**
     * Output format for the hash
     * @default 'hex'
     */
    outputFormat?: "hex" | "base64" | "base58" | "buffer";
}

/**
 * Options for key derivation
 */
export interface KeyDerivationOptions {
    /**
     * Algorithm to use for key derivation
     * @default 'pbkdf2'
     */
    algorithm?: "pbkdf2" | "scrypt" | "argon2";

    /**
     * Number of iterations for key derivation
     * @default 100000
     */
    iterations?: number;

    /**
     * Salt to use for key derivation
     * If not provided, a random salt will be generated
     */
    salt?: Uint8Array;

    /**
     * Key length in bytes
     * @default 32
     */
    keyLength?: number;

    /**
     * Hash function to use with PBKDF2
     * @default 'sha256'
     */
    hashFunction?: "sha256" | "sha512";
}

/**
 * Options for API key generation
 */
export interface APIKeyOptions {
    /**
     * Prefix for the API key
     */
    prefix?: string;

    /**
     * Include timestamp in the API key
     * @default true
     */
    includeTimestamp?: boolean;

    /**
     * Length of the random part of the API key
     * @default 24
     */
    randomPartLength?: number;

    /**
     * Separator character for API key parts
     * @default '_'
     */
    separator?: string;
}

/**
 * Options for session token generation
 */
export interface SessionTokenOptions {
    /**
     * Include user identifier in the token
     */
    userId?: string;

    /**
     * Include IP address in the token
     */
    ipAddress?: string;

    /**
     * Include user agent in the token
     */
    userAgent?: string;

    /**
     * Token expiration time in seconds
     * @default 86400 (24 hours)
     */
    expiresIn?: number;
}

/**
 * Options for middleware integration
 */
export interface MiddlewareOptions {
    /**
     * Enable CSRF protection
     * @default true
     */
    csrfProtection?: boolean;

    /**
     * Enable secure headers
     * @default true
     */
    secureHeaders?: boolean;

    /**
     * Maximum requests per minute
     * @default 100
     */
    maxRequestsPerMinute?: number;

    /**
     * Secret for token generation
     * If not provided, a random secret will be generated
     */
    tokenSecret?: string;

    /**
     * Name of the CSRF cookie
     * @default 'xypriss_csrf'
     */
    cookieName?: string;

    /**
     * Name of the CSRF header
     * @default 'X-CSRF-Token'
     */
    headerName?: string;

    /**
     * Enable rate limiting
     * @default true
     */
    rateLimit?: boolean;

    /**
     * Paths to exclude from CSRF protection
     * @default ['/api/health', '/api/status']
     */
    excludePaths?: string[];

    /**
     * Whether to log requests
     * @default true
     */
    logRequests?: boolean;

    /**
     * Logger to use
     * @default console
     */
    logger?: Console;

    /**
     * Content Security Policy header value
     * @default "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'"
     */
    contentSecurityPolicy?: string;

    /**
     * Generate request ID for each request
     * @default true
     */
    generateRequestId?: boolean;

    /**
     * Add security headers to responses
     * @default true
     */
    addSecurityHeaders?: boolean;

    /**
     * Rate limiting configuration
     */
    rateLimiting?: {
        /**
         * Time window in milliseconds
         * @default 900000 (15 minutes)
         */
        windowMs?: number;

        /**
         * Maximum number of requests per window
         * @default 100
         */
        max?: number;
    };
}

