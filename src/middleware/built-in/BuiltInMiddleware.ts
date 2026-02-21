/**
 * XyPriss Built-in Middleware
 * Wrappers around popular middleware libraries
 */

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression, { shouldCompress } from "xypriss-compression-pluging";
// Note: express-validator has complex import structure, simplified for now
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import morgan from "morgan";
import slowDown from "express-slow-down";
import ExpressBrute from "express-brute";
import multer from "multer";
import { doubleCsrf } from "csrf-csrf";
import { createWildcardOriginFunction } from "../../server/utils/wildcardMatcher";
import { mergeWithDefaults } from "../../utils/mergeWithDefaults";
import { RequestSignatureProtector } from "./security/RequestSignatureProtector";
import { RequestSignatureConfig } from "../../types/mod/security";
import { BrowserOnlyProtector } from "./security/BrowserOnlyProtector";
import { TerminalOnlyProtector } from "./security/TerminalOnlyProtector";
import { MobileOnlyProtector } from "./security/MobileOnlyProtector";
import { Logger } from "../../../shared/logger/Logger";

export interface BuiltInMiddlewareConfig {
    helmet?: any;
    cors?: any;
    rateLimit?: any;
    compression?: any;
    csrf?: any;
    validator?: any;
    hpp?: any;
    mongoSanitize?: any;
    xss?: any;
    morgan?: any;
    slowDown?: any;
    brute?: any;
    multer?: any;
    requestSignature?: any;
}

export class BuiltInMiddleware {
    /**
     * Get Helmet middleware for security headers
     */
    static helmet(options: Parameters<typeof helmet>[0] = {}) {
        const defaultOptions: Parameters<typeof helmet>[0] = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"],
                    fontSrc: ["'self'"],
                },
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: true,
            crossOriginResourcePolicy: { policy: "same-origin" },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: "deny" },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: false,
            },
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: false,
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            xssFilter: true,
        };

        // Handle CSP separately to avoid shallow merge issues
        let finalOptions: any = { ...defaultOptions };

        // If user provided CSP, handle it specially
        if (options.contentSecurityPolicy !== undefined) {
            if (options.contentSecurityPolicy === false) {
                // User explicitly disabled CSP
                finalOptions.contentSecurityPolicy = false;
            } else if (
                typeof options.contentSecurityPolicy === "object" &&
                options.contentSecurityPolicy !== null
            ) {
                finalOptions.contentSecurityPolicy = {
                    ...(defaultOptions.contentSecurityPolicy as any),
                    ...options.contentSecurityPolicy,
                };

                // Merge directives if provided
                if (options.contentSecurityPolicy.directives) {
                    // Normalize directive names to camelCase for Helmet compatibility
                    const normalizedUserDirectives: any = {};
                    for (const [key, value] of Object.entries(
                        options.contentSecurityPolicy.directives,
                    )) {
                        // Convert dash-case to camelCase (e.g., "script-src" -> "scriptSrc")
                        const camelKey = key.replace(/-([a-z])/g, (_, letter) =>
                            letter.toUpperCase(),
                        );
                        normalizedUserDirectives[camelKey] = value;
                    }

                    finalOptions.contentSecurityPolicy.directives = {
                        // Start with default directives
                        ...(defaultOptions.contentSecurityPolicy as any)
                            ?.directives,
                        // Override with normalized user directives
                        ...normalizedUserDirectives,
                    };
                }
            }
        }

        // Merge other options (excluding contentSecurityPolicy which we handled above)
        const { contentSecurityPolicy, ...otherOptions } = options;
        finalOptions = { ...finalOptions, ...otherOptions };

        return helmet(finalOptions as any);
    }

    /**
     * Get CORS middleware
     *
     * By default, allows all headers to be developer-friendly.
     * Developers can restrict headers via config if needed for production.
     *
     * Supports multiple origin matching patterns:
     * - Strings with wildcards: "localhost:*", "*.example.com"
     * - Regular expressions: /^localhost:\d+$/, /\.test\.com$/
     * - Mixed arrays: ["localhost:*", /^api\..*\.com$/, "production.com"]
     */
    static cors(options: Parameters<typeof cors>[0] = {}) {
        const defaultOptions = {
            origin: true,
            methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
            // Allow all headers by default - developers can restrict via config
            // This prevents CORS issues during development
            credentials: false,
            maxAge: 86400, // 24 hours
        };

        // mergeWithDefaults ensures user-provided keys always win (even falsy
        // values like `false` or `null`), and nested objects are deep-merged.
        // This also handles the credentials:true + origin:* incompatibility:
        // if the user sets credentials:true without an explicit origin, the
        // default origin:true (wildcard) would cause a browser CORS error.
        // mergeWithDefaults preserves the user's intent precisely.
        const config: any = mergeWithDefaults(defaultOptions, options as any);

        // ── Smart credentials/origin guard ────────────────────────────────────
        // Even after a correct merge, if credentials:true ended up with the
        // default origin:true (wildcard), switch to reflect-origin mode.
        // This covers the case where the user sets credentials:true but does
        // NOT provide an origin at all.
        const userProvidedOrigin =
            options != null && "origin" in (options as object);
        if (config.credentials === true && !userProvidedOrigin) {
            config.origin = (
                requestOrigin: string | undefined,
                callback: (err: Error | null, allow?: boolean | string) => void,
            ) => {
                callback(null, requestOrigin || false);
            };
        }

        // FIX: Normalize array properties to handle cases where arrays were converted to objects
        // This fixes the bug in multiServer mode where arrays become "[object Object]"

        // Helper function to normalize array-like values to comma-separated strings
        const normalizeToString = (value: any): string | undefined => {
            if (!value) return undefined;

            // If it's already a string, return it
            if (typeof value === "string") return value;

            // If it's an array, join with comma
            if (Array.isArray(value)) {
                return value.join(", ");
            }

            // If it's an object (arrays converted to objects), convert back to array first
            if (typeof value === "object") {
                const arrayValues = Object.values(value);
                return arrayValues.join(", ");
            }

            return undefined;
        };

        // Normalize methods
        if (config.methods) {
            const normalized = normalizeToString(config.methods);
            if (normalized) {
                config.methods = normalized;
            }
        }

        // Normalize allowedHeaders
        if (config.allowedHeaders) {
            const normalized = normalizeToString(config.allowedHeaders);
            if (normalized) {
                config.allowedHeaders = normalized;
            }
        }

        // Normalize exposedHeaders
        if (config.exposedHeaders) {
            const normalized = normalizeToString(config.exposedHeaders);
            if (normalized) {
                config.exposedHeaders = normalized;
            }
        }

        // Create a custom origin function that handles strings, RegExp, and wildcards
        if (Array.isArray(config.origin)) {
            const validOrigins = config.origin.filter(
                (origin: any): origin is string | RegExp =>
                    typeof origin === "string" || origin instanceof RegExp,
            );

            if (validOrigins.length > 0) {
                config.origin = this.createAdvancedOriginFunction(validOrigins);
            }
        }

        return cors(config);
    }

    /**
     * Create an advanced origin function that supports strings, RegExp, and wildcards
     */
    private static createAdvancedOriginFunction(origins: (string | RegExp)[]): (
        origin: string | undefined,
        // cors library accepts string | false | undefined as the second arg;
        // passing the exact origin string (instead of boolean true) is required
        // when credentials:true — otherwise cors emits "*" and browsers block it.
        callback: (err: Error | null, allow?: string | boolean) => void,
    ) => void {
        return (
            origin: string | undefined,
            callback: (err: Error | null, allow?: string | boolean) => void,
        ) => {
            try {
                // No Origin header (e.g. same-origin or curl without header) → allow
                if (!origin) {
                    return callback(null, false);
                }

                // Check each origin pattern
                for (const pattern of origins) {
                    if (typeof pattern === "string") {
                        // Handle string patterns (including wildcards)
                        if (this.matchesStringOrigin(origin, pattern)) {
                            // ✅ Return the actual origin string
                            return callback(null, origin);
                        }
                    } else if (pattern instanceof RegExp) {
                        // Handle RegExp patterns
                        if (pattern.test(origin)) {
                            return callback(null, origin);
                        }
                    }
                }

                // No pattern matched → deny
                return callback(null, false);
            } catch (error) {
                // On error, deny access
                return callback(error as Error, false);
            }
        };
    }

    /**
     * Check if an origin matches a string pattern (including wildcards)
     */
    private static matchesStringOrigin(
        origin: string,
        pattern: string,
    ): boolean {
        // Exact match
        if (pattern === origin) {
            return true;
        }

        // Handle wildcards
        if (pattern.includes("*")) {
            // Convert wildcard pattern to RegExp
            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
                .replace(/\*/g, ".*"); // Convert * to .*

            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(origin);
        }

        return false;
    }

    /**
     * Get Rate Limiting middleware
     */
    static rateLimit(options: Parameters<typeof rateLimit>[0] = {}) {
        const defaultOptions = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: {
                error: "Too many requests from this IP, please try again later.",
                retryAfter: "Please try again later.",
            },
            standardHeaders: true,
            legacyHeaders: false,
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);

        // Wrap handler to trigger hook
        const originalHandler = config.handler;
        config.handler = (req: any, res: any, next: any, options: any) => {
            const pluginManager = (req.app as any)?.pluginManager;
            const logger = (req.app as any)?.logger || Logger.getInstance();
            logger.debug(
                "middleware",
                `[RateLimit] Handler called. PluginManager found: ${!!pluginManager}`,
            );
            if (
                pluginManager &&
                typeof pluginManager.triggerRateLimit === "function"
            ) {
                logger.debug(
                    "middleware",
                    "[RateLimit] Triggering onRateLimit hook",
                );
                pluginManager.triggerRateLimit(
                    {
                        limit: options.limit,
                        current: options.current,
                        remaining: options.remaining,
                        resetTime: options.resetTime,
                    },
                    req,
                    res,
                );
            }

            if (originalHandler) {
                originalHandler(req, res, next, options as any);
            }
            res.status(options.statusCode).send(options.message);
        };

        const logger = Logger.getInstance();
        logger.debug(
            "middleware",
            `[RateLimit] Creating middleware with max: ${
                config.max
            }, windowMs: ${config.windowMs}, hasHandler: ${!!config.handler}`,
        );

        return rateLimit(config);
    }

    /**
     * Get Compression middleware
     */
    static compression(options: any = {}): any {
        const defaultOptions = {
            level: 6,
            threshold: 1024, // Only compress responses >= 1KB
            filter:
                options.filter ||
                ((req: any, res: any) => {
                    // Don't compress responses with this request header
                    if (req.headers["x-no-compression"]) {
                        return false;
                    }

                    // Import and use the library's filter function
                    return shouldCompress(req, res);
                }),
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return compression(config);
    }

    /**
     * CSRF protection middleware using csrf-csrf library
     */
    static csrf(
        options: Parameters<typeof doubleCsrf>[0] = {
            getSecret: () =>
                "e6ac40fffc5e9399eab10f5b84fcba2c923e7f74a73b76b56c11b722671eea5e",
            getSessionIdentifier: (req: any) => req.session.id,
        },
    ) {
        const defaultOptions = {
            cookieName: "__Host-psifi.x-csrf-token",
            cookieOptions: {
                httpOnly: true,
                sameSite: "strict",
                secure: process.env.NODE_ENV === "production",
                maxAge: 3600000, // 1 hour
            },
            size: 64,
            ignoredMethods: ["GET", "HEAD", "OPTIONS"],
            getTokenFromRequest: (req: any) => {
                return (
                    req.headers["x-csrf-token"] ||
                    req.body?._csrf ||
                    req.query?._csrf
                );
            },
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);

        const { doubleCsrfProtection } = doubleCsrf(config as any);

        // Return the protection middleware
        return doubleCsrfProtection;
    }

    /**
     * Get HPP (HTTP Parameter Pollution) protection middleware
     */
    static hpp(options: Parameters<typeof hpp>[0] = {}) {
        const defaultOptions = {
            whitelist: ["tags", "categories"], // Allow arrays for these parameters
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return hpp(config);
    }

    /**
     * Get MongoDB injection protection middleware
     */
    static mongoSanitize(options: Parameters<typeof mongoSanitize>[0] = {}) {
        const defaultOptions = {
            replaceWith: "_",
            onSanitize: (key: string, value: any) => {
                console.warn(
                    `[MongoSanitize] Sanitized key: ${key}, value: ${value}`,
                );
            },
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return mongoSanitize(config as any);
    }

    /**
     * Get XSS protection middleware
     */
    static xss(options: any = {}) {
        const defaultOptions = {
            whiteList: {
                a: ["href", "title"],
                b: [],
                i: [],
                strong: [],
                em: [],
            },
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);

        return (req: any, _res: any, next: any) => {
            // Sanitize request body
            if (req.body) {
                req.body = this.sanitizeObject(req.body, config);
            }

            // Sanitize query parameters
            if (req.query) {
                req.query = this.sanitizeObject(req.query, config);
            }

            next();
        };
    }

    /**
     * Get Morgan logging middleware
     */
    static morgan(options: Parameters<typeof morgan>[1] = {}) {
        const defaultFormat = (options as any).format || "combined";
        const defaultOptions = {
            skip: (_req: any, res: any) => res.statusCode < 400, // Only log errors by default
            stream: process.stdout,
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return morgan(defaultFormat, config);
    }

    /**
     * Get Slow Down middleware for progressive delays
     */
    static slowDown(options: Parameters<typeof slowDown>[0] = {}) {
        const defaultOptions = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            delayAfter: 2, // Allow 2 requests per windowMs without delay
            delayMs: 500, // Add 500ms delay per request after delayAfter
            maxDelayMs: 20000, // Maximum delay of 20 seconds
            skipFailedRequests: false,
            skipSuccessfulRequests: false,
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return slowDown(config);
    }

    /**
     * Get Express Brute middleware for brute force protection
     */
    static brute(
        options: ConstructorParameters<typeof ExpressBrute.MemoryStore>[0] = {
            prefix: "nehonix.xypriss.brute",
        },
    ) {
        const store = new ExpressBrute.MemoryStore();
        const defaultOptions: ConstructorParameters<typeof ExpressBrute>[0] = {
            freeRetries: 2,
            minWait: 5 * 60 * 1000, // 5 minutes
            maxWait: 60 * 60 * 1000, // 1 hour
            lifetime: 24 * 60 * 60, // 1 day (in seconds)
            failCallback: (
                _req: any,
                res: any,
                _next: any,
                nextValidRequestDate: Date,
            ) => {
                res.status(429).json({
                    error: "Too many failed attempts",
                    message:
                        "Account temporarily locked due to too many failed attempts",
                    nextValidRequestDate: nextValidRequestDate,
                });
            },
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        const bruteforce = new ExpressBrute(store, config);

        return bruteforce.prevent;
    }

    /**
     * Get Browser-Only middleware to block non-browser requests (like cURL)
     */
    static browserOnly(options: any = {}) {
        // Import the BrowserOnlyProtector dynamically to keep BuiltInMiddleware clean
        return new BrowserOnlyProtector(options as any).getMiddleware();
    }

    /**
     * Get Terminal-Only middleware to block browser requests (allows cURL and API tools)
     */
    static terminalOnly(options: any = {}) {
        // Import the TerminalOnlyProtector dynamically to keep BuiltInMiddleware clean
        return new TerminalOnlyProtector(options as any).getMiddleware();
    }

    /**
     * Get Mobile-Only middleware to block browser requests (allows mobile app access)
     */
    static mobileOnly(options: any = {}) {
        // Import the MobileOnlyProtector dynamically to keep BuiltInMiddleware clean
        return new MobileOnlyProtector(options as any).middleware();
    }

    /**
     * Get Multer middleware for file uploads
     */
    static multer(options: Parameters<typeof multer>[0] = {}) {
        const defaultOptions = {
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
                files: 5, // Maximum 5 files
            },
            fileFilter: (_req: any, file: any, cb: any) => {
                // Allow only specific file types
                const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
                const extname = allowedTypes.test(
                    file.originalname.toLowerCase(),
                );
                const mimetype = allowedTypes.test(file.mimetype);

                if (mimetype && extname) {
                    return cb(null, true);
                } else {
                    cb(
                        new Error(
                            "Invalid file type. Only images and documents are allowed.",
                        ),
                    );
                }
            },
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return multer(config);
    }

    /**
     * Get Request Signature middleware for API authentication
     */
    static requestSignature(options: RequestSignatureConfig) {
        const protector = new RequestSignatureProtector(options as any);
        return protector.getMiddleware();
    }

    /**
     * Get all default security middleware
     */
    static security(options: BuiltInMiddlewareConfig = {}) {
        return {
            helmet: this.helmet(options.helmet),
            cors: this.cors(options.cors),
            rateLimit: this.rateLimit(options.rateLimit),
            compression: this.compression(options.compression),
            csrf: this.csrf(options.csrf),
            requestSignature: this.requestSignature(options.requestSignature),
        };
    }

    // Helper method for XSS sanitization
    private static sanitizeObject(obj: any, config: any): any {
        if (typeof obj === "string") {
            return xss(obj, config);
        } else if (Array.isArray(obj)) {
            return obj.map((item) => this.sanitizeObject(item, config));
        } else if (obj && typeof obj === "object") {
            const sanitized: any = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = this.sanitizeObject(obj[key], config);
                }
            }
            return sanitized;
        }
        return obj;
    }
}

