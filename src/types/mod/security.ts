/**
 * @fileoverview Security-related type definitions for XyPrissJS Express integration
 *
 * This module contains all security-related types including authentication,
 * authorization, encryption, and security policies.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

/**
 * Security configuration levels.
 *
 * Predefined security levels that automatically configure
 * appropriate security measures:
 * - basic: Essential security features
 * - enhanced: Additional security layers
 * - maximum: All security features enabled
 */
export type SecurityLevel = "basic" | "enhanced" | "maximum";

/**
 * CSRF Protection Configuration
 *
 * Protects against Cross-Site Request Forgery attacks by requiring tokens.
 * Can be enabled/disabled or configured with custom options.
 *
 * @example Enable with defaults:
 * ```typescript
 * csrf: true
 * ```
 *
 * @example Disable:
 * ```typescript
 * csrf: false
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * csrf: {
 *   cookieName: '__Host-csrf-token',
 *   cookieOptions: {
 *     httpOnly: true,
 *     sameSite: 'strict',
 *     secure: process.env.NODE_ENV === 'production'
 *   }
 * }
 * ```
 */
export interface CSRFConfig {
    /** CSRF token cookie name */
    cookieName?: string;

    /** CSRF token cookie options */
    cookieOptions?: {
        httpOnly?: boolean;
        sameSite?: boolean | "lax" | "strict" | "none";
        secure?: boolean;
    };
}

/**
 * Helmet Security Headers Configuration
 *
 * Sets various HTTP headers to help protect against common attacks.
 * Can be enabled/disabled or configured with custom header options.
 *
 * @example Enable with defaults:
 * ```typescript
 * helmet: true
 * ```
 *
 * @example Custom CSP:
 * ```typescript
 * helmet: {
 *   contentSecurityPolicy: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'", "'unsafe-inline'"]
 *     }
 *   },
 *   hsts: { maxAge: 31536000 }
 * }
 * ```
 */
export interface HelmetConfig {
    /** Content Security Policy configuration */
    contentSecurityPolicy?: {
        directives: {
            defaultSrc?: string[];
            scriptSrc?: string[];
        };
    };

    /** HTTP Strict Transport Security configuration */
    hsts?: {
        maxAge: number;
    };
}

/**
 * XSS Protection Configuration
 *
 * Protects against Cross-Site Scripting attacks by sanitizing input.
 * Can be enabled/disabled or configured with custom sanitization rules.
 *
 * @example Enable with defaults:
 * ```typescript
 * xss: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * xss: {
 *   blockOnDetection: true,
 *   customPatterns: [/custom-pattern/g],
 *   whitelist: { a: ['href', 'title'] }
 * }
 * ```
 */
export interface XSSConfig {
    /** Block requests on XSS detection */
    blockOnDetection?: boolean;

    /** Custom XSS patterns to detect */
    customPatterns?: RegExp[];

    /** Whitelist of allowed tags and attributes */
    whitelist?: {
        [tag: string]: string[];
    };
}

/**
 * SQL Injection Protection Configuration
 *
 * Detects and prevents SQL injection attacks in request data.
 * Can be enabled/disabled or configured with custom detection rules.
 *
 * @example Enable with defaults:
 * ```typescript
 * sqlInjection: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * sqlInjection: {
 *   blockOnDetection: true,
 *   riskThreshold: 'medium',
 *   customPatterns: [/custom-sql-pattern/g]
 * }
 * ```
 */
export interface SQLInjectionConfig {
    /** Block requests on SQL injection detection */
    blockOnDetection?: boolean;

    /** Risk threshold for SQL injection detection */
    riskThreshold?: "low" | "medium" | "high";

    /** Custom SQL injection patterns to detect */
    customPatterns?: RegExp[];
}

/**
 * Compression Configuration
 *
 * Response compression to reduce bandwidth and improve performance.
 * Can be enabled/disabled or configured with custom compression settings.
 *
 * @example Enable with defaults:
 * ```typescript
 * compression: true
 * ```
 *
 * @example Custom compression:
 * ```typescript
 * compression: {
 *   level: 6, // compression level (1-9)
 *   threshold: 1024, // minimum response size to compress
 *   filter: (req, res) => {
 *     // custom filter logic
 *     return /json|text|javascript|css/.test(res.get('Content-Type'));
 *   }
 * }
 * ```
 */
export interface CompressionConfig {
    /** Compression level (1-9) */
    level?: number;

    /** Minimum response size to compress (in bytes) */
    threshold?: number;

    /** Custom filter function for compression */
    filter?: (req: any, res: any) => boolean;
}

/**
 * HTTP Parameter Pollution Protection Configuration
 *
 * Prevents HTTP Parameter Pollution attacks by handling duplicate parameters.
 * Can be enabled/disabled or configured with custom parameter handling.
 *
 * @example Enable with defaults:
 * ```typescript
 * hpp: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * hpp: {
 *   whitelist: ['tags', 'categories'], // allow arrays for these params
 *   checkQuery: true,
 *   checkBody: true
 * }
 * ```
 */
export interface HPPConfig {
    /** Whitelist of allowed parameters for arrays */
    whitelist?: string[];

    /** Check query parameters for duplicates */
    checkQuery?: boolean;

    /** Check body parameters for duplicates */
    checkBody?: boolean;
}

/**
 * MongoDB Injection Protection Configuration
 *
 * Sanitizes MongoDB queries to prevent NoSQL injection attacks.
 * Can be enabled/disabled or configured with custom sanitization rules.
 *
 * @example Enable with defaults:
 * ```typescript
 * mongoSanitize: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * mongoSanitize: {
 *   replaceWith: '_',
 *   onSanitize: ({ req, key }) => {
 *     console.warn(`Sanitized MongoDB key: ${key} from ${req.ip}`);
 *   }
 * }
 * ```
 */
export interface MongoSanitizeConfig {
    /** Replacement character for sanitized keys */
    replaceWith?: string;

    /** Custom callback function for sanitization */
    onSanitize?: (options: { req: any; key: string }) => void;
}

/**
 * Request Logging Configuration
 *
 * HTTP request logging using Morgan middleware.
 * Can be enabled/disabled or configured with custom logging formats.
 *
 * @example Enable with defaults:
 * ```typescript
 * morgan: true
 * ```
 *
 * @example Custom logging format:
 * ```typescript
 * morgan: {
 *   format: 'combined',
 *   skip: (req, res) => res.statusCode < 400,
 *   stream: customStream
 * }
 * ```
 */
export interface MorganConfig {
    /** Logging format for Morgan */
    format?: string;

    /** Custom skip function for logging */
    skip?: (req: any, res: any) => boolean;

    /** Custom stream for logging output */
    stream?: any;
}

/**
 * Slow Down Configuration
 *
 * Progressive delays for rate limiting to prevent abuse.
 * Can be enabled/disabled or configured with custom delay patterns.
 *
 * @example Enable with defaults:
 * ```typescript
 * slowDown: true
 * ```
 *
 * @example Custom slow down:
 * ```typescript
 * slowDown: {
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   delayAfter: 100, // delay after 100 requests
 *   delayMs: (used, req) => {
 *     const delayAfter = req.slowDown?.limit || 100;
 *     return (used - delayAfter) * 500; // 500ms per request over limit
 *   }
 * }
 * ```
 */
export interface SlowDownConfig {
    /** Time window for slow down (in milliseconds) */
    windowMs?: number;

    /** Number of requests before delay starts */
    delayAfter?: number;

    /** Custom delay function */
    delayMs?: (used: number, req: any) => number;
}

/**
 * Security Configuration Interface
 *
 * Defines comprehensive security settings for XyPriss applications.
 * Each security feature can be enabled/disabled or configured with detailed options.
 *
 * @example
 * ```typescript
 * const securityConfig: SecurityConfig = {
 *   level: 'enhanced',
 *   helmet: {
 *     contentSecurityPolicy: {
 *       directives: { defaultSrc: ["'self'"] }
 *     }
 *   },
 *   cors: {
 *     origin: 'https://myapp.com',
 *     credentials: true
 *   },
 *   bruteForce: {
 *     windowMs: 15 * 60 * 1000,
 *     max: 100
 *   }
 * };
 * ```
 */
export interface SecurityConfig {
    /** Security level preset */
    level?: SecurityLevel;

    /**
     * CSRF Protection Configuration
     *
     * Protects against Cross-Site Request Forgery attacks by requiring tokens.
     * Can be enabled/disabled or configured with custom options.
     *
     * @example Enable with defaults:
     * ```typescript
     * csrf: true
     * ```
     *
     * @example Disable:
     * ```typescript
     * csrf: false
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * csrf: {
     *   cookieName: '__Host-csrf-token',
     *   cookieOptions: {
     *     httpOnly: true,
     *     sameSite: 'strict',
     *     secure: process.env.NODE_ENV === 'production'
     *   }
     * }
     * ```
     */
    csrf?: boolean | CSRFConfig;

    /**
     * Helmet Security Headers Configuration
     *
     * Sets various HTTP headers to help protect against common attacks.
     * Can be enabled/disabled or configured with custom header options.
     *
     * @example Enable with defaults:
     * ```typescript
     * helmet: true
     * ```
     *
     * @example Custom CSP:
     * ```typescript
     * helmet: {
     *   contentSecurityPolicy: {
     *     directives: {
     *       defaultSrc: ["'self'"],
     *       scriptSrc: ["'self'", "'unsafe-inline'"]
     *     }
     *   },
     *   hsts: { maxAge: 31536000 }
     * }
     * ```
     */
    helmet?: boolean | HelmetConfig;

    /**
     * XSS Protection Configuration
     *
     * Protects against Cross-Site Scripting attacks by sanitizing input.
     * Can be enabled/disabled or configured with custom sanitization rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * xss: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * xss: {
     *   blockOnDetection: true,
     *   customPatterns: [/custom-pattern/g],
     *   whitelist: { a: ['href', 'title'] }
     * }
     * ```
     */
    xss?: boolean | XSSConfig;

    /**
     * SQL Injection Protection Configuration
     *
     * Detects and prevents SQL injection attacks in request data.
     * Can be enabled/disabled or configured with custom detection rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * sqlInjection: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * sqlInjection: {
     *   blockOnDetection: true,
     *   riskThreshold: 'medium',
     *   customPatterns: [/custom-sql-pattern/g]
     * }
     * ```
     */
    sqlInjection?: boolean | SQLInjectionConfig;

    /**
     * Brute Force Protection Configuration
     *
     * Rate limiting to prevent brute force attacks on authentication endpoints.
     * Can be enabled/disabled or configured with custom rate limiting rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * bruteForce: true
     * ```
     *
     * @example Custom rate limiting:
     * ```typescript
     * bruteForce: {
     *   windowMs: 15 * 60 * 1000, // 15 minutes
     *   max: 100, // limit each IP to 100 requests per windowMs
     *   message: 'Too many requests, please try again later.',
     *   standardHeaders: true
     * }
     * ```
     */
    bruteForce?: boolean | RateLimitConfig;

    /**
     * CORS Configuration
     *
     * Cross-Origin Resource Sharing settings for API access control.
     * Can be enabled/disabled or configured with custom CORS policies.
     *
     * @example Enable with defaults:
     * ```typescript
     * cors: true
     * ```
     *
     * @example Custom CORS policy:
     * ```typescript
     * cors: {
     *   origin: ['https://myapp.com', 'https://admin.myapp.com'],
     *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
     *   allowedHeaders: ['Content-Type', 'Authorization'],
     *   credentials: true,
     *   maxAge: 86400
     * }
     * ```
     */
    cors?: boolean | CORSConfig;

    /**
     * Compression Configuration
     *
     * Response compression to reduce bandwidth and improve performance.
     * Can be enabled/disabled or configured with custom compression settings.
     *
     * @example Enable with defaults:
     * ```typescript
     * compression: true
     * ```
     *
     * @example Custom compression:
     * ```typescript
     * compression: {
     *   level: 6, // compression level (1-9)
     *   threshold: 1024, // minimum response size to compress
     *   filter: (req, res) => {
     *     // custom filter logic
     *     return /json|text|javascript|css/.test(res.get('Content-Type'));
     *   }
     * }
     * ```
     */
    compression?: boolean | CompressionConfig;

    /**
     * HTTP Parameter Pollution Protection Configuration
     *
     * Prevents HTTP Parameter Pollution attacks by handling duplicate parameters.
     * Can be enabled/disabled or configured with custom parameter handling.
     *
     * @example Enable with defaults:
     * ```typescript
     * hpp: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * hpp: {
     *   whitelist: ['tags', 'categories'], // allow arrays for these params
     *   checkQuery: true,
     *   checkBody: true
     * }
     * ```
     */
    hpp?: boolean | HPPConfig;

    /**
     * MongoDB Injection Protection Configuration
     *
     * Sanitizes MongoDB queries to prevent NoSQL injection attacks.
     * Can be enabled/disabled or configured with custom sanitization rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * mongoSanitize: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * mongoSanitize: {
     *   replaceWith: '_',
     *   onSanitize: ({ req, key }) => {
     *     console.warn(`Sanitized MongoDB key: ${key} from ${req.ip}`);
     *   }
     * }
     * ```
     */
    mongoSanitize?: boolean | MongoSanitizeConfig;

    /**
     * Request Logging Configuration
     *
     * HTTP request logging using Morgan middleware.
     * Can be enabled/disabled or configured with custom logging formats.
     *
     * @example Enable with defaults:
     * ```typescript
     * morgan: true
     * ```
     *
     * @example Custom logging format:
     * ```typescript
     * morgan: {
     *   format: 'combined',
     *   skip: (req, res) => res.statusCode < 400,
     *   stream: customStream
     * }
     * ```
     */
    morgan?: boolean | MorganConfig;

    /**
     * Slow Down Configuration
     *
     * Progressive delays for rate limiting to prevent abuse.
     * Can be enabled/disabled or configured with custom delay patterns.
     *
     * @example Enable with defaults:
     * ```typescript
     * slowDown: true
     * ```
     *
     * @example Custom slow down:
     * ```typescript
     * slowDown: {
     *   windowMs: 15 * 60 * 1000, // 15 minutes
     *   delayAfter: 100, // delay after 100 requests
     *   delayMs: (used, req) => {
     *     const delayAfter = req.slowDown?.limit || 100;
     *     return (used - delayAfter) * 500; // 500ms per request over limit
     *   }
     * }
     * ```
     */
    slowDown?: boolean | SlowDownConfig;

    /** Encryption configuration */
    encryption?: EncryptionConfig;

    /** Authentication configuration */
    authentication?: AuthenticationConfig;
}

/**
 * Encryption configuration interface.
 *
 * Settings for data encryption including algorithm
 * selection and key management.
 *
 * @interface EncryptionConfig
 *
 * @example
 * ```typescript
 * const encryptionConfig: EncryptionConfig = {
 *   algorithm: 'aes-256-gcm',
 *   keySize: 256
 * };
 * ```
 */
export interface EncryptionConfig {
    /** Encryption algorithm to use */
    algorithm?: string;

    /** Key size in bits */
    keySize?: number;
}

/**
 * Authentication configuration interface.
 *
 * Configuration for various authentication methods
 * including JWT and session-based authentication.
 *
 * @interface AuthenticationConfig
 *
 * @example
 * ```typescript
 * const authConfig: AuthenticationConfig = {
 *   jwt: {
 *     secret: 'your-jwt-secret',
 *     expiresIn: '24h',
 *     algorithm: 'HS256',
 *     issuer: 'your-app',
 *     audience: 'your-users'
 *   },
 *   session: {
 *     secret: 'your-session-secret',
 *     name: 'sessionId',
 *     cookie: {
 *       maxAge: 86400000, // 24 hours
 *       secure: true,
 *       httpOnly: true,
 *       sameSite: 'strict'
 *     }
 *   }
 * };
 * ```
 */
export interface AuthenticationConfig {
    /** JWT authentication configuration */
    jwt?: JWTConfig;

    /** Session authentication configuration */
    session?: SessionConfig;
}

/**
 * JWT (JSON Web Token) configuration interface.
 *
 * Configuration for JWT-based authentication including
 * signing algorithms and token validation.
 *
 * @interface JWTConfig
 *
 * @example
 * ```typescript
 * const jwtConfig: JWTConfig = {
 *   secret: 'your-256-bit-secret',
 *   expiresIn: '24h',
 *   algorithm: 'HS256',
 *   issuer: 'your-application',
 *   audience: 'your-users'
 * };
 * ```
 */
export interface JWTConfig {
    /** Secret key for signing tokens */
    secret: string;

    /** Token expiration time (e.g., '24h', '7d', '30m') */
    expiresIn?: string;

    /** Signing algorithm */
    algorithm?: string;

    /** Token issuer */
    issuer?: string;

    /** Token audience */
    audience?: string;
}

/**
 * Session configuration interface.
 *
 * Configuration for session-based authentication including
 * cookie settings and storage options.
 *
 * @interface SessionConfig
 *
 * @example
 * ```typescript
 * const sessionConfig: SessionConfig = {
 *   secret: 'your-session-secret',
 *   name: 'connect.sid',
 *   cookie: {
 *     maxAge: 86400000, // 24 hours
 *     secure: true,
 *     httpOnly: true,
 *     sameSite: 'strict'
 *   },
 *   store: 'redis'
 * };
 * ```
 */
export interface SessionConfig {
    /** Secret for signing session cookies */
    secret: string;

    /** Session cookie name */
    name?: string;

    /** Cookie configuration */
    cookie?: SessionCookieConfig;

    /** Session store type */
    store?: "memory" | "redis" | "custom";
}

/**
 * Session cookie configuration interface.
 *
 * Detailed configuration for session cookies including
 * security and expiration settings.
 *
 * @interface SessionCookieConfig
 *
 * @example
 * ```typescript
 * const cookieConfig: SessionCookieConfig = {
 *   maxAge: 86400000, // 24 hours
 *   secure: true,
 *   httpOnly: true,
 *   sameSite: 'strict'
 * };
 * ```
 */
export interface SessionCookieConfig {
    /** Cookie expiration time in milliseconds */
    maxAge?: number;

    /** Require HTTPS for cookie transmission */
    secure?: boolean;

    /** Prevent client-side JavaScript access */
    httpOnly?: boolean;

    /** SameSite cookie attribute */
    sameSite?: boolean | "lax" | "strict" | "none";
}

/**
 * SSL/TLS configuration interface.
 *
 * Configuration for SSL/TLS encryption including
 * certificates and security options.
 *
 * @interface SSLConfig
 *
 * @example
 * ```typescript
 * const sslConfig: SSLConfig = {
 *   key: fs.readFileSync('path/to/private-key.pem', 'utf8'),
 *   cert: fs.readFileSync('path/to/certificate.pem', 'utf8'),
 *   ca: fs.readFileSync('path/to/ca-certificate.pem', 'utf8'),
 *   passphrase: 'your-passphrase'
 * };
 * ```
 */
export interface SSLConfig {
    /** Private key for SSL certificate */
    key: string;

    /** SSL certificate */
    cert: string;

    /** Certificate Authority certificate */
    ca?: string;

    /** Passphrase for private key */
    passphrase?: string;
}

/**
 * CORS (Cross-Origin Resource Sharing) configuration interface.
 *
 * Configuration for CORS policies including allowed origins,
 * methods, and headers.
 *
 * By default, all headers are allowed to be developer-friendly.
 * You can restrict headers by specifying the allowedHeaders array.
 *
 * @interface CORSConfig
 *
 * @example
 * ```typescript
 * // Allow all headers (default - developer-friendly)
 * const corsConfig: CORSConfig = {
 *   origin: '*',
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   credentials: true
 * };
 *
 * // Restrict specific headers (production)
 * const restrictiveCorsConfig: CORSConfig = {
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization'],
 *   credentials: true
 * };
 * ```
 */
export interface CORSConfig {
    /** Allowed origins - can be string, array of strings, or boolean */
    origin?: string | string[] | boolean;

    /** Allowed HTTP methods */
    methods?: string[];

    /** 
     * Allowed headers - if not specified, all headers are allowed by default.
     * Specify this array to restrict which headers are allowed.
     */
    allowedHeaders?: string[];

    /** Allow credentials in CORS requests */
    credentials?: boolean;
}

/**
 * Rate limiting configuration interface.
 *
 * Configuration for rate limiting including time windows,
 * request limits, and custom messages.
 *
 * @interface RateLimitConfig
 *
 * @example
 * ```typescript
 * const rateLimitConfig: RateLimitConfig = {
 *   windowMs: 900000, // 15 minutes
 *   max: 100, // 100 requests per window
 *   message: 'Too many requests, please try again later',
 *   standardHeaders: true,
 *   legacyHeaders: false
 * };
 * ```
 */
export interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs?: number;

    /** Maximum requests per window */
    max?: number;

    /** Message to send when limit is exceeded */
    message?: string;

    /** Include standard rate limit headers */
    standardHeaders?: boolean;

    /** Include legacy rate limit headers */
    legacyHeaders?: boolean;
}

/**
 * Route-specific security configuration interface.
 *
 * Security settings that can be applied to individual
 * routes or route groups.
 *
 * @interface RouteSecurityConfig
 *
 * @example
 * ```typescript
 * const routeSecurityConfig: RouteSecurityConfig = {
 *   auth: true,
 *   roles: ['admin', 'moderator'],
 *   permissions: ['read:users', 'write:posts'],
 *   encryption: true,
 *   sanitization: true,
 *   validation: true
 * };
 * ```
 */
export interface RouteSecurityConfig {
    /** Require authentication */
    auth?: boolean;

    /** Required user roles */
    roles?: string[];

    /** Required permissions */
    permissions?: string[];

    /** Enable response encryption */
    encryption?: boolean;

    /** Enable input sanitization */
    sanitization?: boolean;

    /** Enable input validation */
    validation?: boolean;
}

