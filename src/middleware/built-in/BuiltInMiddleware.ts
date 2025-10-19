/**
 * XyPriss Built-in Middleware
 * Wrappers around popular middleware libraries
 */

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
// Note: express-validator has complex import structure, simplified for now
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import morgan from "morgan";
import slowDown from "express-slow-down";
import ExpressBrute from "express-brute";
import multer from "multer";
import { doubleCsrf } from "csrf-csrf";

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

        const config = { ...defaultOptions, ...options };
        return helmet(config as any);
    }

    /**
     * Get CORS middleware
     *
     * By default, allows all headers to be developer-friendly.
     * Developers can restrict headers via config if needed for production.
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

        const config = { ...defaultOptions, ...options };
        return cors(config);
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
            handler: (_req: any, res: any) => {
                res.status(429).json({
                    error: "Too many requests",
                    message: "Rate limit exceeded. Please try again later.",
                    retryAfter:
                        Math.ceil(options?.windowMs || 60000 / 1000) || 900,
                });
            },
        };

        const config = { ...defaultOptions, ...options };
        return rateLimit(config);
    }

    /**
     * Get Compression middleware
     */
    static compression(options: Parameters<typeof compression>[0] = {}) {
        const defaultOptions = {
            level: 6,
            threshold: 1024, // Only compress responses >= 1KB
            filter: (req: any, res: any) => {
                // Don't compress responses with this request header
                if (req.headers["x-no-compression"]) {
                    return false;
                }

                // Fallback to standard filter function
                return compression.filter(req, res);
            },
        };

        const config = { ...defaultOptions, ...options };
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
        }
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

        const config = { ...defaultOptions, ...options };

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

        const config = { ...defaultOptions, ...options };
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
                    `[MongoSanitize] Sanitized key: ${key}, value: ${value}`
                );
            },
        };

        const config = { ...defaultOptions, ...options };
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

        const config = { ...defaultOptions, ...options };

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

        const config = { ...defaultOptions, ...options };
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

        const config = { ...defaultOptions, ...options };
        return slowDown(config);
    }

    /**
     * Get Express Brute middleware for brute force protection
     */
    static brute(
        options: ConstructorParameters<typeof ExpressBrute.MemoryStore>[0] = {
            prefix: "nehonix.xypriss.brute",
        }
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
                nextValidRequestDate: Date
            ) => {
                res.status(429).json({
                    error: "Too many failed attempts",
                    message:
                        "Account temporarily locked due to too many failed attempts",
                    nextValidRequestDate: nextValidRequestDate,
                });
            },
        };

        const config = { ...defaultOptions, ...options };
        const bruteforce = new ExpressBrute(store, config);

        return bruteforce.prevent;
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
                    file.originalname.toLowerCase()
                );
                const mimetype = allowedTypes.test(file.mimetype);

                if (mimetype && extname) {
                    return cb(null, true);
                } else {
                    cb(
                        new Error(
                            "Invalid file type. Only images and documents are allowed."
                        )
                    );
                }
            },
        };

        const config = { ...defaultOptions, ...options };
        return multer(config);
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

