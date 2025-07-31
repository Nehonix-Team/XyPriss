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
 * Main security configuration interface.
 *
 * Comprehensive security configuration including authentication,
 * encryption, and various security features.
 *
 * @interface SecurityConfig
 *
 * @example
 * ```typescript
 * const securityConfig: SecurityConfig = {
 *   level: 'enhanced',
 *   csrf: true,
 *   helmet: true,
 *   xss: true,
 *   sqlInjection: true,
 *   bruteForce: true,
 *   encryption: {
 *     algorithm: 'aes-256-gcm',
 *     keySize: 256
 *   },
 *   authentication: {
 *     jwt: {
 *       secret: 'your-secret-key',
 *       expiresIn: '24h',
 *       algorithm: 'HS256'
 *     }
 *   }
 * };
 * ```
 */
export interface SecurityConfig {
    /** Security level preset */
    level?: SecurityLevel;

    /** Enable CSRF protection */
    csrf?: boolean;

    /** Enable Helmet.js security headers */
    helmet?: boolean;

    /** Enable XSS protection */
    xss?: boolean;

    /** Enable SQL injection protection */
    sqlInjection?: boolean;

    /** Enable brute force protection */
    bruteForce?: boolean;

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
 * @interface CORSConfig
 *
 * @example
 * ```typescript
 * const corsConfig: CORSConfig = {
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization'],
 *   credentials: true
 * };
 * ```
 */
export interface CORSConfig {
    /** Allowed origins */
    origin?: string | string[] | boolean;

    /** Allowed HTTP methods */
    methods?: string[];

    /** Allowed headers */
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

