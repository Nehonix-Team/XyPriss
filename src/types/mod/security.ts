import helmet from "helmet";
import {
    BrowserOnlyConfig,
    TerminalOnlyConfig,
} from "../../middleware/built-in/security";

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
 * XyRS - XyPriss Request Signature Configuration
 *
 * Validates request signatures using the XP-Request-Sig header.
 * Provides API authentication by requiring a secret signature on all requests.
 *
 * @example Enable with secret:
 * ```typescript
 * requestSignature: {
 *   secret: "my-secret-api-key"
 * }
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * requestSignature: {
 *   secret: "my-secret-api-key",
 *   errorMessage: "API key required",
 *   statusCode: 403,
 *   caseSensitive: false
 * }
 * ```
 */
export interface RequestSignatureConfig {
    /** The secret value that must match the XP-Request-Sig header */
    secret: string;

    /** Custom error message for blocked requests */
    errorMessage?: string;

    /** HTTP status code for blocked requests */
    statusCode?: number;

    /** Enable debug logging */
    debug?: boolean;

    /** Case-sensitive comparison */
    caseSensitive?: boolean;

    /** Trim whitespace from header value */
    trimValue?: boolean;
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
    contentSecurityPolicy?:
        | {
              /** CSP directives - flexible configuration allowing any CSP directive */
              directives?: Record<string, string | string[]>;
          }
        | boolean;

    /** HTTP Strict Transport Security configuration */
    hsts?: {
        maxAge: number;
        includeSubDomains?: boolean;
        preload?: boolean;
    };

    /** Cross-Origin Embedder Policy */
    crossOriginEmbedderPolicy?:
        | boolean
        | { policy: "require-corp" | "credentialless" };

    /** Cross-Origin Opener Policy */
    crossOriginOpenerPolicy?:
        | boolean
        | {
              policy:
                  | "same-origin"
                  | "same-origin-allow-popups"
                  | "unsafe-none";
          };

    /** Cross-Origin Resource Policy */
    crossOriginResourcePolicy?:
        | boolean
        | { policy: "same-origin" | "same-site" | "cross-origin" };

    /** DNS Prefetch Control */
    dnsPrefetchControl?: boolean | { allow: boolean };

    /** Frameguard (X-Frame-Options) */
    frameguard?:
        | boolean
        | { action: "deny" | "sameorigin" | "allow-from"; domain?: string };

    /** Hide Powered By header */
    hidePoweredBy?: boolean | { setTo?: string };

    /** IE No Open */
    ieNoOpen?: boolean;

    /** No Sniff */
    noSniff?: boolean;

    /** Origin Agent Cluster */
    originAgentCluster?: boolean;

    /** Permitted Cross Domain Policies */
    permittedCrossDomainPolicies?:
        | boolean
        | {
              permittedPolicies:
                  | "none"
                  | "master-only"
                  | "by-content-type"
                  | "all";
          };

    /** Referrer Policy */
    referrerPolicy?: boolean | { policy: string | string[] };

    /** XSS Filter */
    xssFilter?: boolean;
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

    /** Enable contextual analysis to reduce false positives */
    contextualAnalysis?: boolean;

    /** Strict mode - more aggressive detection */
    strictMode?: boolean;

    /** Log detected attempts */
    logAttempts?: boolean;

    /** False positive threshold (0-1) */
    falsePositiveThreshold?: number;
}

/**
 * Path Traversal Protection Configuration
 *
 * Detects and prevents directory traversal attacks while allowing legitimate file paths.
 *
 * @example Enable with defaults:
 * ```typescript
 * pathTraversal: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * pathTraversal: {
 *   blockOnDetection: true,
 *   allowedPaths: ['/uploads/', '/public/'],
 *   allowedExtensions: ['.jpg', '.png', '.pdf'],
 *   maxDepth: 3
 * }
 * ```
 */
export interface PathTraversalConfig {
    /** Block requests on path traversal detection */
    blockOnDetection?: boolean;

    /** Allowed base paths */
    allowedPaths?: string[];

    /** Allowed file extensions */
    allowedExtensions?: string[];

    /** Maximum allowed path depth */
    maxDepth?: number;

    /** Strict mode */
    strictMode?: boolean;

    /** Log detected attempts */
    logAttempts?: boolean;

    /** False positive threshold (0-1) */
    falsePositiveThreshold?: number;
}

/**
 * Command Injection Protection Configuration
 *
 * Detects and prevents OS command injection attacks with context awareness.
 *
 * @example Enable with defaults:
 * ```typescript
 * commandInjection: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * commandInjection: {
 *   blockOnDetection: true,
 *   contextualAnalysis: true,
 *   allowedCommands: ['git', 'npm']
 * }
 * ```
 */
export interface CommandInjectionConfig {
    /** Block requests on command injection detection */
    blockOnDetection?: boolean;

    /** Enable contextual analysis */
    contextualAnalysis?: boolean;

    /** Allowed commands (whitelist) */
    allowedCommands?: string[];

    /** Strict mode */
    strictMode?: boolean;

    /** Log detected attempts */
    logAttempts?: boolean;

    /** False positive threshold (0-1) */
    falsePositiveThreshold?: number;
}

/**
 * XXE (XML External Entity) Protection Configuration
 *
 * Prevents XXE attacks in XML parsing.
 *
 * @example Enable with defaults:
 * ```typescript
 * xxe: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * xxe: {
 *   blockOnDetection: true,
 *   allowDTD: false,
 *   allowExternalEntities: false
 * }
 * ```
 */
export interface XXEConfig {
    /** Block requests on XXE detection */
    blockOnDetection?: boolean;

    /** Allow DTD declarations */
    allowDTD?: boolean;

    /** Allow external entities */
    allowExternalEntities?: boolean;

    /** Maximum entity expansions */
    maxEntityExpansions?: number;

    /** Strict mode */
    strictMode?: boolean;

    /** Log detected attempts */
    logAttempts?: boolean;
}

/**
 * LDAP Injection Protection Configuration
 *
 * Detects and prevents LDAP injection attacks.
 *
 * @example Enable with defaults:
 * ```typescript
 * ldapInjection: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * ldapInjection: {
 *   blockOnDetection: true,
 *   strictMode: true
 * }
 * ```
 */
export interface LDAPInjectionConfig {
    /** Block requests on LDAP injection detection */
    blockOnDetection?: boolean;

    /** Strict mode */
    strictMode?: boolean;

    /** Log detected attempts */
    logAttempts?: boolean;

    /** False positive threshold (0-1) */
    falsePositiveThreshold?: number;
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
 * Route pattern matching configuration for security rules
 */
export interface RoutePattern {
    /** Route path pattern (supports wildcards like /api/*, exact paths like /login, or regex) */
    path: string | RegExp;
    /** HTTP methods to apply this rule to (if not specified, applies to all methods) */
    methods?: string[];
}

/**
 * Security module route configuration
 * Allows selective application of security modules to specific routes
 */
export interface SecurityModuleRouteConfig {
    /** Routes to exclude from this security module */
    excludeRoutes?: (string | RegExp | RoutePattern)[];
    /** Routes to include for this security module (if specified, only these routes will be protected) */
    includeRoutes?: (string | RegExp | RoutePattern)[];
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
 *   },
 *   routeConfig: {
 *     pathTraversal: {
 *       excludeRoutes: ['/api/templates/*', '/api/content/*']
 *     }
 *   }
 * };
 * ```
 */
export interface SecurityConfig {
    /** Security level preset */
    level?: SecurityLevel;

    /**
     * Route-based security configuration
     * Allows you to selectively apply security modules to specific routes
     *
     * @example
     * ```typescript
     * routeConfig: {
     *   xss: {
     *     excludeRoutes: ['/api/safe-content/*']
     *   },
     *   pathTraversal: {
     *     excludeRoutes: ['/api/templates/*', { path: '/api/content/*', methods: ['POST'] }]
     *   },
     *   sqlInjection: {
     *     includeRoutes: ['/api/db/*', '/api/query/*']
     *   }
     * }
     * ```
     */
    routeConfig?: {
        xss?: SecurityModuleRouteConfig;
        sqlInjection?: SecurityModuleRouteConfig;
        pathTraversal?: SecurityModuleRouteConfig;
        commandInjection?: SecurityModuleRouteConfig;
        xxe?: SecurityModuleRouteConfig;
        ldapInjection?: SecurityModuleRouteConfig;
    };

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
     * Path Traversal Protection Configuration
     *
     * Detects and prevents directory traversal attacks while allowing legitimate file paths.
     * Can be enabled/disabled or configured with custom detection rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * pathTraversal: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * pathTraversal: {
     *   blockOnDetection: true,
     *   allowedPaths: ['/uploads/', '/public/'],
     *   allowedExtensions: ['.jpg', '.png', '.pdf'],
     *   maxDepth: 3
     * }
     * ```
     */
    pathTraversal?: boolean | PathTraversalConfig;

    /**
     * Command Injection Protection Configuration
     *
     * Detects and prevents OS command injection attacks with context awareness.
     * Can be enabled/disabled or configured with custom detection rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * commandInjection: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * commandInjection: {
     *   blockOnDetection: true,
     *   contextualAnalysis: true,
     *   allowedCommands: ['git', 'npm']
     * }
     * ```
     */
    commandInjection?: boolean | CommandInjectionConfig;

    /**
     * XXE (XML External Entity) Protection Configuration
     *
     * Prevents XXE attacks in XML parsing.
     * Can be enabled/disabled or configured with custom detection rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * xxe: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * xxe: {
     *   blockOnDetection: true,
     *   allowDTD: false,
     *   allowExternalEntities: false
     * }
     * ```
     */
    xxe?: boolean | XXEConfig;

    /**
     * LDAP Injection Protection Configuration
     *
     * Detects and prevents LDAP injection attacks.
     * Can be enabled/disabled or configured with custom detection rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * ldapInjection: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * ldapInjection: {
     *   blockOnDetection: true,
     *   strictMode: true
     * }
     * ```
     */
    ldapInjection?: boolean | LDAPInjectionConfig;

    /**
     * Brute Force Protection Configuration
     *
     * Specialized protection against brute force attacks on authentication endpoints.
     * More aggressive than general rate limiting, designed for login/password attempts.
     * Can be enabled/disabled or configured with custom protection rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * bruteForce: true
     * ```
     *
     * @example Custom brute force protection:
     * ```typescript
     * bruteForce: {
     *   windowMs: 15 * 60 * 1000, // 15 minutes
     *   max: 5, // only 5 attempts per window (stricter than rateLimit)
     *   message: 'Too many login attempts, account temporarily locked.',
     *   standardHeaders: true
     * }
     * ```
     */
    bruteForce?: boolean | RateLimitConfig;

    /**
     * Rate Limiting Configuration
     *
     * General rate limiting to prevent abuse and control request frequency.
     * Can be enabled/disabled or configured with custom rate limiting rules.
     *
     * @example Enable with defaults:
     * ```typescript
     * rateLimit: true
     * ```
     *
     * @example Custom rate limiting:
     * ```typescript
     * rateLimit: {
     *   windowMs: 15 * 60 * 1000, // 15 minutes
     *   max: 100, // limit each IP to 100 requests per windowMs
     *   message: 'Too many requests, please try again later.',
     *   standardHeaders: true
     * }
     * ```
     */
    rateLimit?: boolean | RateLimitConfig;

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

    /**
     * Browser-Only Protection Configuration
     *
     * Blocks non-browser requests (cURL, Postman, scripts) while allowing legitimate browser access.
     * Useful for APIs that should only be accessed through web browsers.
     *
     * @example Enable with defaults:
     * ```typescript
     * browserOnly: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * browserOnly: {
     *   requireSecFetch: true,
     *   blockAutomationTools: true,
     *   allowOriginRequests: true,
     *   errorMessage: "Browser access required"
     * }
     * ```
     */
    browserOnly?: boolean | BrowserOnlyConfig;

    /**
     * Terminal-Only Protection Configuration
     *
     * Blocks browser requests while allowing terminal/API tools.
     * Perfect for API-only endpoints or development tools.
     *
     * @example Enable with defaults:
     * ```typescript
     * terminalOnly: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * terminalOnly: {
     *   blockSecFetch: true,
     *   allowedTools: ["curl", "wget"],
     *   blockBrowserIndicators: true,
     *   debug: true
     * }
     * ```
     */
    terminalOnly?: boolean | TerminalOnlyConfig;

    /**
     * Mobile-Only Protection Configuration
     *
     * Blocks browser requests while allowing mobile app access.
     * Perfect for APIs that should only be accessed through mobile applications.
     *
     * @example Enable with defaults:
     * ```typescript
     * mobileOnly: true
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * mobileOnly: {
     *   blockBrowserIndicators: true,
     *   allowedPlatforms: ['ios', 'android'],
     *   requireMobileHeaders: true,
     *   customUserAgentPatterns: [/MyApp/i],
     *   errorMessage: "Mobile app access required"
     * }
     * ```
     */
    mobileOnly?: boolean | import("../../middleware/built-in/security/MobileOnlyProtector").MobileOnlyConfig;

    /**
     * Device Access Control Configuration
     *
     * Comprehensive device-based access control allowing multiple device types.
     * Enables fine-grained control over which devices can access your API.
     *
     * @example Allow only mobile apps:
     * ```typescript
     * deviceAccess: {
     *   mobileOnly: true
     * }
     * ```
     *
     * @example Allow mobile apps and browsers:
     * ```typescript
     * deviceAccess: {
     *   mobileOnly: true,
     *   browserOnly: true
     * }
     * ```
     *
     * @example Allow all except browsers:
     * ```typescript
     * deviceAccess: {
     *   mobileOnly: true,
     *   terminalOnly: true,
     *   browserOnly: false
     * }
     * ```
     */
    deviceAccess?: {
        /** Allow only browser requests */
        browserOnly?: boolean | BrowserOnlyConfig;

        /** Allow only terminal/API tool requests */
        terminalOnly?: boolean | TerminalOnlyConfig;

        /** Allow only mobile app requests */
        mobileOnly?: boolean | import("../../middleware/built-in/security/MobileOnlyProtector").MobileOnlyConfig;
    };

    /**
     * XyRS - XyPriss Request Signature Configuration
     *
     * Validates request signatures using the XP-Request-Sig header.
     * Provides API authentication by requiring a secret signature on all requests.
     *
     * @example Enable with secret:
     * ```typescript
     * requestSignature: {
     *   secret: "my-secret-api-key"
     * }
     * ```
     *
     * @example Custom configuration:
     * ```typescript
     * requestSignature: {
     *   secret: "my-secret-api-key",
     *   errorMessage: "API key required",
     *   statusCode: 403,
     *   caseSensitive: false
     * }
     * ```
     */
    requestSignature?: boolean | RequestSignatureConfig;
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
 * // Allow all origins (default - developer-friendly)
 * const corsConfig: CORSConfig = {
 *   origin: '*',
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   credentials: true
 * };
 *
 * // Restrict specific origins (production)
 * const restrictiveCorsConfig: CORSConfig = {
 *   origin: ['https://example.com', 'https://app.example.com'],
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization'],
 *   credentials: true
 * };
 *
 * // Advanced patterns with RegExp (powerful and flexible)
 * const advancedCorsConfig: CORSConfig = {
 *   origin: [
 *     /^localhost:\d+$/,           // localhost:3000, localhost:8080, etc.
 *     /^127\.0\.0\.1:\d+$/,        // 127.0.0.1:3000, etc.
 *     /^::1:\d+$/,                 // IPv6 localhost
 *     /\.test\.com$/,              // *.test.com
 *     'https://production.com'     // Exact match
 *   ],
 *   methods: ['GET', 'POST'],
 *   credentials: true
 * };
 * ```
 */
export interface CORSConfig {
    /** Allowed origins - can be string, RegExp, array of mixed types, or boolean */
    origin?: string | RegExp | (string | RegExp)[] | boolean;

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
 * // String message
 * const rateLimitConfig: RateLimitConfig = {
 *   windowMs: 900000, // 15 minutes
 *   max: 100, // 100 requests per window
 *   message: 'Too many requests, please try again later',
 *   standardHeaders: true,
 *   legacyHeaders: false
 * };
 *
 * // Object message (more flexible)
 * const rateLimitConfig: RateLimitConfig = {
 *   windowMs: 900000,
 *   max: 100,
 *   message: {
 *     error: 'Rate limit exceeded',
 *     message: 'Too many requests, please try again later',
 *     retryAfter: 900
 *   },
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

    /** Message to send when limit is exceeded (string or object) */
    message?: string | {
        error?: string;
        message?: string;
        retryAfter?: number;
        [key: string]: any;
    };

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

