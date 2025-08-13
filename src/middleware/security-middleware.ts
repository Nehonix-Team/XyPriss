/**
 * XyPriss Security Middleware
 * Comprehensive security middleware using proven external libraries
 */

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import hpp from "hpp";
import compression from "compression";
import { XyPrissSecurity as XyPrissJS } from "xypriss-security";
import { SecurityConfig, SecurityLevel } from "../types/mod/security";
import {
    NextFunction,
    XyPrisRequest,
    XyPrisResponse,
} from "../types/httpServer.type";
import SQLInjectionDetector from "./built-in/sqlInjection";
import { Logger } from "../../shared/logger/Logger";

/**
 * Security middleware class implementing comprehensive protection
 * Implements SecurityConfig interface to ensure type safety
 */
export class SecurityMiddleware implements Required<SecurityConfig> {
    // Required SecurityConfig properties - ensures all config options are implemented
    public level: SecurityLevel;
    public csrf: boolean;
    public helmet: boolean;
    public xss: boolean;
    public sqlInjection: boolean;
    public bruteForce: boolean;
    public encryption: Required<SecurityConfig>["encryption"];
    public authentication: Required<SecurityConfig>["authentication"];

    // Middleware instances from external libraries
    private helmetMiddleware: any;
    private corsMiddleware: any;
    private rateLimitMiddleware: any;
    private csrfMiddleware: any;
    private mongoSanitizeMiddleware: any;
    private hppMiddleware: any;
    private compressionMiddleware: any;

    // Security detectors
    private sqlInjectionDetector: SQLInjectionDetector;

    // Logger instance
    private logger: Logger;

    constructor(config: SecurityConfig = {}, logger?: Logger) {
        // Initialize logger (create default if not provided)
        this.logger =
            logger ||
            new Logger({
                enabled: true,
                level: "debug",
                components: { security: true },
                types: { debug: true },
            });

        // Set defaults and merge with provided config
        this.level = config.level || "enhanced";
        this.csrf = config.csrf !== false;
        this.helmet = config.helmet !== false;
        this.xss = config.xss !== false;
        this.sqlInjection = config.sqlInjection !== false;
        this.bruteForce = config.bruteForce !== false;

        this.encryption = {
            algorithm: "AES-256-GCM",
            keySize: 32,
            ...config.encryption,
        };

        this.authentication = {
            jwt: {
                secret:
                    config.authentication?.jwt?.secret ||
                    XyPrissJS.generateSecureToken({
                        length: 32,
                        entropy: "high",
                    }),
                expiresIn: config.authentication?.jwt?.expiresIn || "1h",
                algorithm: config.authentication?.jwt?.algorithm || "HS256",
            },
            session: {
                secret:
                    config.authentication?.session?.secret ||
                    XyPrissJS.generateSecureToken({
                        length: 32,
                        entropy: "high",
                    }),
                name:
                    config.authentication?.session?.name ||
                    "nehonix.XyPriss.sid",
                cookie: {
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    secure: true,
                    httpOnly: true,
                    sameSite: "strict",
                    ...config.authentication?.session?.cookie,
                },
            },
            ...config.authentication,
        };

        // Initialize security detectors
        this.sqlInjectionDetector = new SQLInjectionDetector({
            strictMode: false,
            contextualAnalysis: true,
            logAttempts: true,
            falsePositiveThreshold: 0.6,
        });

        // Initialize all middleware instances
        this.initializeMiddleware();
    }

    /**
     * Initialize all security middleware instances using external libraries
     */
    private initializeMiddleware(): void {
        // Helmet for security headers
        if (this.helmet) {
            this.helmetMiddleware = helmet({
                contentSecurityPolicy:
                    this.level === "maximum"
                        ? {
                              directives: {
                                  defaultSrc: ["'self'"],
                                  styleSrc: ["'self'", "'unsafe-inline'"],
                                  scriptSrc: ["'self'"],
                                  imgSrc: ["'self'", "data:", "https:"],
                              },
                          }
                        : false,
                hsts: this.level !== "basic",
                crossOriginEmbedderPolicy: this.level === "maximum",
            });
        }

        // CORS middleware
        this.corsMiddleware = cors({
            origin: this.level === "maximum" ? false : true,
            credentials: true,
            optionsSuccessStatus: 200,
        });

        // Rate limiting for brute force protection
        if (this.bruteForce) {
            const maxRequests =
                this.level === "maximum"
                    ? 50
                    : this.level === "enhanced"
                    ? 100
                    : 200;

            this.rateLimitMiddleware = rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: maxRequests,
                message: {
                    error: "Too many requests from this IP, please try again later.",
                    retryAfter: "15 minutes",
                },
                standardHeaders: true,
                legacyHeaders: false,
                skip: (req) => {
                    // Skip rate limiting for health checks
                    return req.path === "/health" || req.path === "/ping";
                },
            });
        }

        // CSRF protection using csrf-csrf library
        if (this.csrf) {
            const { doubleCsrfProtection } = doubleCsrf({
                getSecret: () =>
                    this.authentication.session?.secret || "default-secret",
                getSessionIdentifier: (req) =>
                    (req as any).sessionID || req.ip || "anonymous",
                cookieName: "__Host-csrf-token",
                cookieOptions: {
                    httpOnly: true,
                    sameSite: "strict",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                },
                size: 64,
                ignoredMethods: ["GET", "HEAD", "OPTIONS"],
            });
            // Create a wrapper that ensures cookies exist
            this.csrfMiddleware = (req: any, res: any, next: any) => {
                // Ensure cookies object exists for Express compatibility
                if (!req.cookies) {
                    req.cookies = {};
                }

                // Call the original CSRF middleware
                doubleCsrfProtection(req, res, next);
            };
        }

        // MongoDB injection protection
        if (this.sqlInjection) {
            const originalMongoSanitize = mongoSanitize({
                replaceWith: "_",
                onSanitize: ({ req, key }) => {
                    console.warn(
                        `Sanitized key ${key} in request from ${req.ip}`
                    );
                },
            });

            // Create a wrapper that handles readonly properties
            this.mongoSanitizeMiddleware = (req: any, res: any, next: any) => {
                // Make request properties writable before sanitization
                this.makeRequestPropertiesWritable(req);

                // Call the original middleware
                originalMongoSanitize(req, res, next);
            };
        }

        // HTTP Parameter Pollution protection
        const originalHpp = hpp({
            whitelist: ["tags", "categories"], // Allow arrays for specific parameters
        });

        // Create a wrapper that handles readonly properties
        this.hppMiddleware = (req: any, res: any, next: any) => {
            // Make request properties writable before processing
            this.makeRequestPropertiesWritable(req);

            // Call the original middleware
            originalHpp(req, res, next);
        };

        // Compression middleware
        this.compressionMiddleware = compression({
            filter: (req, res) => {
                if (req.headers["x-no-compression"]) {
                    return false;
                }
                return compression.filter(req, res);
            },
            level: 6,
            threshold: 1024,
        });
    }

    /**
     * Get the main security middleware stack
     * Returns a single middleware function that applies all security measures
     */
    public getMiddleware() {
        return (
            req: XyPrisRequest,
            res: XyPrisResponse,
            next: NextFunction
        ) => {
            this.applySecurityStack(req, res, next);
        };
    }

    /**
     * Apply all security middleware in the correct order
     */
    private applySecurityStack(
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: NextFunction
    ): void {
        this.logger.debug("security", "Starting security middleware stack");
        const middlewareStack: Array<(req: any, res: any, next: any) => void> =
            [];

        // 1. Compression (should be first)
        this.logger.debug("security", "Adding compression middleware");
        middlewareStack.push(this.compressionMiddleware);

        // 2. Security headers (Helmet)
        if (this.helmet && this.helmetMiddleware) {
            this.logger.debug("security", "Adding helmet middleware");
            middlewareStack.push(this.helmetMiddleware);
        }

        // 3. CORS
        this.logger.debug("security", "Adding CORS middleware");
        middlewareStack.push(this.corsMiddleware);

        // 4. Rate limiting
        if (this.bruteForce && this.rateLimitMiddleware) {
            this.logger.debug("security", "Adding rate limit middleware");
            middlewareStack.push(this.rateLimitMiddleware);
        }

        // 5. HTTP Parameter Pollution protection
        this.logger.debug("security", "Adding HPP middleware");
        middlewareStack.push(this.hppMiddleware);

        // 6. MongoDB sanitization
        if (this.sqlInjection && this.mongoSanitizeMiddleware) {
            this.logger.debug("security", "Adding mongo sanitize middleware");
            middlewareStack.push(this.mongoSanitizeMiddleware);
        }

        // 7. XSS protection (custom implementation)
        if (this.xss) {
            this.logger.debug("security", "Adding XSS protection middleware");
            middlewareStack.push(this.xssProtection.bind(this));
        }

        // 8. CSRF protection (should be after body parsing)
        if (this.csrf && this.csrfMiddleware) {
            this.logger.debug("security", "Adding CSRF middleware");
            middlewareStack.push(this.csrfMiddleware);
        }

        this.logger.debug(
            "security",
            `Total middleware in stack: ${middlewareStack.length}`
        );
        // Execute middleware stack
        this.executeMiddlewareStack(middlewareStack, req, res, next);
    }

    /**
     * Execute middleware stack sequentially with proper async handling
     */
    private executeMiddlewareStack(
        stack: Array<(req: any, res: any, next: any) => void>,
        req: XyPrisRequest,
        res: XyPrisResponse,
        finalNext: NextFunction
    ): void {
        let index = 0;
        let nextCalled = false;

        this.logger.debug(
            "security",
            `Executing middleware stack with ${stack.length} middleware`
        );

        const next = (error?: any) => {
            if (nextCalled) {
                this.logger.debug(
                    "security",
                    "next() already called, ignoring duplicate call"
                );
                return;
            }

            if (error) {
                nextCalled = true;
                this.logger.debug(
                    "security",
                    `Error in middleware at index ${index - 1}:`,
                    error
                );
                return finalNext(error);
            }

            if (index >= stack.length) {
                nextCalled = true;
                this.logger.debug(
                    "security",
                    "All middleware completed, calling final next"
                );
                return finalNext();
            }

            const currentIndex = index;
            this.logger.debug(
                "security",
                `Executing middleware ${currentIndex + 1}/${stack.length}`
            );

            const middleware = stack[index++];

            try {
                // Set a timeout to detect if middleware doesn't call next()
                let timeoutId: NodeJS.Timeout | null = null;
                let middlewareCompleted = false;

                const middlewareNext = (err?: any) => {
                    if (middlewareCompleted) return;
                    middlewareCompleted = true;

                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }

                    this.logger.debug(
                        "security",
                        `Middleware ${currentIndex + 1} completed`
                    );

                    next(err);
                };

                // Set timeout to detect hanging middleware
                timeoutId = setTimeout(() => {
                    if (!middlewareCompleted) {
                        this.logger.debug(
                            "security",
                            `Middleware ${
                                currentIndex + 1
                            } timed out, continuing anyway`
                        );
                        middlewareCompleted = true;
                        next();
                    }
                }, 100); // 100ms timeout

                // Execute the middleware
                middleware(req, res, middlewareNext);
            } catch (error) {
                this.logger.debug(
                    "security",
                    `Exception in middleware at index ${currentIndex}:`,
                    error
                );
                finalNext(error);
            }
        };

        // Start the middleware chain
        this.logger.debug("security", "Starting middleware chain");
        next();
    }

    /**
     * Custom XSS protection middleware
     */
    private xssProtection(
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: NextFunction
    ): void {
        let maliciousContentDetected = false;
        const detectedThreats: string[] = [];

        // Check and sanitize request body
        if (req.body && typeof req.body === "object") {
            const { sanitized, threats } = this.sanitizeObjectWithDetection(
                req.body
            );
            if (threats.length > 0) {
                maliciousContentDetected = true;
                detectedThreats.push(...threats.map((t) => `body.${t}`));
            }

            try {
                req.body = sanitized;
            } catch (error) {
                // Handle readonly property - create new object
                Object.defineProperty(req, "body", {
                    value: sanitized,
                    writable: true,
                    configurable: true,
                });
            }
        }

        // Check and sanitize query parameters
        if (req.query && typeof req.query === "object") {
            const { sanitized, threats } = this.sanitizeObjectWithDetection(
                req.query
            );
            if (threats.length > 0) {
                maliciousContentDetected = true;
                detectedThreats.push(...threats.map((t) => `query.${t}`));
            }

            try {
                req.query = sanitized;
            } catch (error) {
                // Handle readonly property - create new object
                Object.defineProperty(req, "query", {
                    value: sanitized,
                    writable: true,
                    configurable: true,
                });
            }
        }

        // Check and sanitize URL parameters
        if (req.params && typeof req.params === "object") {
            const { sanitized, threats } = this.sanitizeObjectWithDetection(
                req.params
            );
            if (threats.length > 0) {
                maliciousContentDetected = true;
                detectedThreats.push(...threats.map((t) => `params.${t}`));
            }

            try {
                req.params = sanitized;
            } catch (error) {
                // Handle readonly property - create new object
                Object.defineProperty(req, "params", {
                    value: sanitized,
                    writable: true,
                    configurable: true,
                });
            }
        }

        // Block request if malicious content was detected
        if (maliciousContentDetected) {
            this.logger.warn(
                "security",
                `XSS attack blocked from ${
                    req.ip
                }. Threats detected: ${detectedThreats.join(", ")}`
            );

            res.status(400).json({
                error: "Malicious content detected",
                message: "Request blocked due to potential XSS attack",
                threats: detectedThreats,
                timestamp: new Date().toISOString(),
            });
            return; // Don't call next() - block the request
        }

        next();
    }

    /**
     * Make request properties writable to avoid readonly property errors
     */
    private makeRequestPropertiesWritable(req: any): void {
        const properties = ["body", "params", "headers", "query"];

        properties.forEach((prop) => {
            if (req[prop] !== undefined) {
                try {
                    // Test if property is writable
                    const original = req[prop];
                    req[prop] = original;
                } catch (error) {
                    // Property is readonly, make it writable
                    const value = req[prop];
                    Object.defineProperty(req, prop, {
                        value: value,
                        writable: true,
                        configurable: true,
                        enumerable: true,
                    });
                }
            }
        });
    }

    /**
     * Recursively sanitize object properties
     */
    private sanitizeObject(obj: any): any {
        if (typeof obj === "string") {
            return xss(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.sanitizeObject(item));
        }

        if (obj && typeof obj === "object") {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeObject(value);
            }
            return sanitized;
        }

        return obj;
    }

    /**
     * Sanitize object and detect threats
     */
    private sanitizeObjectWithDetection(
        obj: any,
        path: string = ""
    ): { sanitized: any; threats: string[] } {
        const threats: string[] = [];

        const sanitizeWithDetection = (
            value: any,
            currentPath: string
        ): any => {
            if (typeof value === "string") {
                const original = value;
                let sanitized = xss(value);
                let threatDetected = false;
                const detectedPatterns: string[] = [];

                // Check if XSS library sanitization changed the content
                if (original !== sanitized) {
                    threatDetected = true;
                    detectedPatterns.push("XSS");
                }

                // SQL Injection Detection
                if (this.sqlInjection) {
                    const sqlResult = this.sqlInjectionDetector.detect(
                        original,
                        currentPath
                    );
                    if (sqlResult.isMalicious) {
                        threatDetected = true;
                        detectedPatterns.push(
                            `SQL Injection (${sqlResult.riskLevel})`
                        );
                        // Use the SQL detector's sanitized version if available
                        if (sqlResult.sanitizedInput) {
                            sanitized = sqlResult.sanitizedInput;
                        }
                    }
                }

                // Additional threat detection for patterns XSS library might miss
                const additionalThreats = [
                    /javascript:/i,
                    /vbscript:/i,
                    /data:/i,
                    /on\w+\s*=/i, // event handlers like onclick=, onload=
                    /<iframe/i,
                    /<object/i,
                    /<embed/i,
                    /<link/i,
                    /<meta/i,
                    /expression\s*\(/i, // CSS expression()
                    /url\s*\(\s*javascript:/i,
                ];

                for (const pattern of additionalThreats) {
                    if (pattern.test(original)) {
                        threatDetected = true;
                        detectedPatterns.push("Enhanced XSS");
                        // Sanitize these additional threats
                        sanitized = original.replace(pattern, "[BLOCKED]");
                        break;
                    }
                }

                if (threatDetected) {
                    threats.push(currentPath || "root");
                    // Log the specific threats detected
                    this.logger.warn(
                        "security",
                        `Security threat detected in ${
                            currentPath || "root"
                        }: ${detectedPatterns.join(", ")}`
                    );
                }

                return sanitized;
            }

            if (Array.isArray(value)) {
                return value.map((item, index) =>
                    sanitizeWithDetection(item, `${currentPath}[${index}]`)
                );
            }

            if (value && typeof value === "object") {
                const sanitized: any = {};
                for (const [key, val] of Object.entries(value)) {
                    const newPath = currentPath ? `${currentPath}.${key}` : key;
                    sanitized[key] = sanitizeWithDetection(val, newPath);
                }
                return sanitized;
            }

            return value;
        };

        const sanitized = sanitizeWithDetection(obj, path);
        return { sanitized, threats };
    }

    /**
     * Get CSRF token for client-side usage
     */
    public generateCsrfToken(req: XyPrisRequest): string | null {
        if (this.csrf && (req as any).csrfToken) {
            return (req as any).csrfToken();
        }
        return null;
    }

    /**
     * Get security configuration
     */
    public getConfig(): Required<SecurityConfig> {
        return {
            level: this.level,
            csrf: this.csrf,
            helmet: this.helmet,
            xss: this.xss,
            sqlInjection: this.sqlInjection,
            bruteForce: this.bruteForce,
            encryption: this.encryption,
            authentication: this.authentication,
        };
    }
}

