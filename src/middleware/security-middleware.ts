/**
 * XyPriss Security Middleware
 * Comprehensive security middleware using BuiltInMiddleware as single source of truth
 */

import { XyPrissSecurity as XyPrissJS } from "xypriss-security";
import {
    SecurityConfig,
    SecurityLevel,
    RateLimitConfig,
    CSRFConfig,
    HelmetConfig,
    CompressionConfig,
    HPPConfig,
    MongoSanitizeConfig,
    MorganConfig,
    SlowDownConfig,
    CORSConfig,
    XSSConfig,
    SQLInjectionConfig,
    PathTraversalConfig,
    CommandInjectionConfig,
    XXEConfig,
    LDAPInjectionConfig,
    SecurityModuleRouteConfig,
    RoutePattern,
} from "../types/mod/security";
import {
    NextFunction,
    XyPrisRequest,
    XyPrisResponse,
} from "../types/httpServer.type";
import {
    SQLInjectionDetector,
    PathTraversalDetector,
    CommandInjectionDetector,
    XXEProtector,
    LDAPInjectionDetector,
} from "./built-in/security";
import { Logger } from "../../shared/logger/Logger";
import { BuiltInMiddleware } from "./built-in/BuiltInMiddleware";
import xss from "xss"; // Used for custom XSS sanitization logic

/**
 * Security middleware class implementing comprehensive protection
 * Implements SecurityConfig interface to ensure type safety
 */
export class SecurityMiddleware {
    // SecurityConfig properties
    public level: SecurityLevel;
    public csrf: boolean | CSRFConfig;
    public helmet: boolean | HelmetConfig;
    public xss: boolean | XSSConfig;
    public sqlInjection: boolean | SQLInjectionConfig;
    public pathTraversal: boolean | PathTraversalConfig;
    public commandInjection: boolean | CommandInjectionConfig;
    public xxe: boolean | XXEConfig;
    public ldapInjection: boolean | LDAPInjectionConfig;
    public bruteForce: boolean | RateLimitConfig;
    public rateLimit: boolean | RateLimitConfig;
    public cors: boolean | CORSConfig;
    public compression: boolean | CompressionConfig;
    public hpp: boolean | HPPConfig;
    public mongoSanitize: boolean | MongoSanitizeConfig;
    public morgan: boolean | MorganConfig;
    public slowDown: boolean | SlowDownConfig;
    public encryption: Required<SecurityConfig>["encryption"];
    public authentication: Required<SecurityConfig>["authentication"];
    public routeConfig?: SecurityConfig["routeConfig"];

    // Middleware instances from external libraries
    private helmetMiddleware: any;
    private corsMiddleware: any;
    private rateLimitMiddleware: any;
    private bruteForceMiddleware: any; // Separate middleware for brute force
    private csrfMiddleware: any;
    private mongoSanitizeMiddleware: any;
    private hppMiddleware: any;
    private compressionMiddleware: any;
    private morganMiddleware: any;
    private slowDownMiddleware: any;

    // Security detectors
    private sqlInjectionDetector: SQLInjectionDetector;
    private pathTraversalDetector: PathTraversalDetector;
    private commandInjectionDetector: CommandInjectionDetector;
    private xxeProtector: XXEProtector;
    private ldapInjectionDetector: LDAPInjectionDetector;

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
        this.csrf = config.csrf !== false ? config.csrf || true : false;
        this.helmet = config.helmet !== false ? config.helmet || true : false;
        this.xss = config.xss !== false ? config.xss || true : false;
        this.sqlInjection =
            config.sqlInjection !== false ? config.sqlInjection || true : false;
        this.pathTraversal =
            config.pathTraversal !== false
                ? config.pathTraversal || false
                : false;
        this.commandInjection =
            config.commandInjection !== false
                ? config.commandInjection || false
                : false;
        this.xxe = config.xxe !== false ? config.xxe || false : false;
        this.ldapInjection =
            config.ldapInjection !== false
                ? config.ldapInjection || false
                : false;
        this.bruteForce =
            config.bruteForce !== false ? config.bruteForce || true : false;
        this.rateLimit =
            config.rateLimit !== false ? config.rateLimit || true : false;
        this.cors = config.cors !== false ? config.cors || true : false;
        this.compression =
            config.compression !== false ? config.compression || true : false;
        this.hpp = config.hpp !== false ? config.hpp || true : false;
        this.mongoSanitize =
            config.mongoSanitize !== false
                ? config.mongoSanitize || true
                : false;
        this.morgan = config.morgan !== false ? config.morgan || true : false;
        this.slowDown =
            config.slowDown !== false ? config.slowDown || true : false;

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
                    "xypriss.nehonix.sid",
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

        // Store route configuration
        this.routeConfig = config.routeConfig;

        // Initialize security detectors
        this.sqlInjectionDetector = new SQLInjectionDetector({
            strictMode:
                typeof this.sqlInjection === "object"
                    ? this.sqlInjection.strictMode
                    : false,
            contextualAnalysis:
                typeof this.sqlInjection === "object"
                    ? this.sqlInjection.contextualAnalysis
                    : true,
            logAttempts:
                typeof this.sqlInjection === "object"
                    ? this.sqlInjection.logAttempts
                    : true,
            falsePositiveThreshold:
                typeof this.sqlInjection === "object"
                    ? this.sqlInjection.falsePositiveThreshold
                    : 0.6,
        });

        this.pathTraversalDetector = new PathTraversalDetector({
            enabled: !!this.pathTraversal,
            strictMode:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.strictMode
                    : false,
            logAttempts:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.logAttempts
                    : true,
            blockOnDetection:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.blockOnDetection
                    : true,
            allowedPaths:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.allowedPaths
                    : [],
            allowedExtensions:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.allowedExtensions
                    : [".jpg", ".png", ".pdf", ".txt"],
            maxDepth:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.maxDepth
                    : 3,
            falsePositiveThreshold:
                typeof this.pathTraversal === "object"
                    ? this.pathTraversal.falsePositiveThreshold
                    : 0.6,
        });

        this.commandInjectionDetector = new CommandInjectionDetector({
            enabled: !!this.commandInjection,
            strictMode:
                typeof this.commandInjection === "object"
                    ? this.commandInjection.strictMode
                    : false,
            logAttempts:
                typeof this.commandInjection === "object"
                    ? this.commandInjection.logAttempts
                    : true,
            blockOnDetection:
                typeof this.commandInjection === "object"
                    ? this.commandInjection.blockOnDetection
                    : true,
            contextualAnalysis:
                typeof this.commandInjection === "object"
                    ? this.commandInjection.contextualAnalysis
                    : true,
            allowedCommands:
                typeof this.commandInjection === "object"
                    ? this.commandInjection.allowedCommands
                    : [],
            falsePositiveThreshold:
                typeof this.commandInjection === "object"
                    ? this.commandInjection.falsePositiveThreshold
                    : 0.7,
        });

        this.xxeProtector = new XXEProtector({
            enabled: !!this.xxe,
            strictMode:
                typeof this.xxe === "object" ? this.xxe.strictMode : true,
            logAttempts:
                typeof this.xxe === "object" ? this.xxe.logAttempts : true,
            blockOnDetection:
                typeof this.xxe === "object" ? this.xxe.blockOnDetection : true,
            allowDTD: typeof this.xxe === "object" ? this.xxe.allowDTD : false,
            allowExternalEntities:
                typeof this.xxe === "object"
                    ? this.xxe.allowExternalEntities
                    : false,
            maxEntityExpansions:
                typeof this.xxe === "object" ? this.xxe.maxEntityExpansions : 0,
        });

        this.ldapInjectionDetector = new LDAPInjectionDetector({
            enabled: !!this.ldapInjection,
            strictMode:
                typeof this.ldapInjection === "object"
                    ? this.ldapInjection.strictMode
                    : false,
            logAttempts:
                typeof this.ldapInjection === "object"
                    ? this.ldapInjection.logAttempts
                    : true,
            blockOnDetection:
                typeof this.ldapInjection === "object"
                    ? this.ldapInjection.blockOnDetection
                    : true,
            falsePositiveThreshold:
                typeof this.ldapInjection === "object"
                    ? this.ldapInjection.falsePositiveThreshold
                    : 0.6,
        });

        // Initialize all middleware instances
        this.initializeMiddleware();
    }

    /**
     * Initialize all security middleware instances using BuiltInMiddleware
     * BuiltInMiddleware is the single source of truth for all middleware wrappers
     */
    private initializeMiddleware(): void {
        // Helmet for security headers
        if (this.helmet) {
            const helmetConfig: HelmetConfig =
                typeof this.helmet === "object" ? this.helmet : {};

            // Prepare CSP configuration with proper merging
            let cspConfig: any = false;
            if (this.level === "maximum") {
                cspConfig = {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                    },
                };
            } else if (helmetConfig.contentSecurityPolicy) {
                // Merge user CSP config with defaults from BuiltInMiddleware
                cspConfig = helmetConfig.contentSecurityPolicy; // BuiltInMiddleware will handle merging
            }

            console.log("[SecurityMiddleware] Final cspConfig:", cspConfig);
            this.helmetMiddleware = BuiltInMiddleware.helmet({
                contentSecurityPolicy: cspConfig,
                hsts:
                    this.level !== "basic" || helmetConfig.hsts
                        ? helmetConfig.hsts
                        : undefined,
                crossOriginEmbedderPolicy: this.level === "maximum",
            });
        }

        // CORS middleware - use config if provided, otherwise use defaults
        if (this.cors !== false) {
            const corsConfig =
                typeof this.cors === "object"
                    ? this.cors
                    : {
                          origin: this.level === "maximum" ? false : true,
                          credentials: true,
                          optionsSuccessStatus: 200,
                      };
            this.logger.debug(
                "security",
                `Initializing CORS with config: ${JSON.stringify(corsConfig)}`
            );
            this.corsMiddleware = BuiltInMiddleware.cors(corsConfig);
        }

        // Rate limiting for brute force protection (stricter limits)
        if (this.bruteForce) {
            const rateLimitConfig: RateLimitConfig =
                typeof this.bruteForce === "object" ? this.bruteForce : {};
            const maxRequests =
                rateLimitConfig.max ||
                (this.level === "maximum"
                    ? 50
                    : this.level === "enhanced"
                    ? 100
                    : 200);

            this.bruteForceMiddleware = BuiltInMiddleware.brute();
        }

        // General rate limiting (separate from brute force protection)
        if (this.rateLimit) {
            const rateLimitConfig: RateLimitConfig =
                typeof this.rateLimit === "object" ? this.rateLimit : {};
            const maxRequests = rateLimitConfig.max || 100; // Default 100 requests

            this.rateLimitMiddleware = BuiltInMiddleware.rateLimit({
                windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000, // 15 minutes
                max: maxRequests,
                message: rateLimitConfig.message || {
                    error: "Too many requests, please try again later.",
                    retryAfter: "15 minutes",
                },
                standardHeaders: rateLimitConfig.standardHeaders !== false,
                legacyHeaders: false,
                skip: (req: any) => {
                    // Skip rate limiting for health checks and static assets
                    return (
                        req.path === "/health" ||
                        req.path === "/ping" ||
                        req.path.startsWith("/static/") ||
                        req.path.startsWith("/assets/")
                    );
                },
            });
            this.logger.debug(
                "security",
                `General rate limiting initialized with max: ${maxRequests} requests`
            );
        }

        // CSRF protection using BuiltInMiddleware
        if (this.csrf) {
            const csrfConfig: CSRFConfig =
                typeof this.csrf === "object" ? this.csrf : {};
            this.csrfMiddleware = BuiltInMiddleware.csrf({
                getSecret: (req: any) =>
                    this.authentication.session?.secret ||
                    "ac934dfcffc9e037b6921b6d4e874e788bfba7c5f48d17332ef92c9c67450000",
                getSessionIdentifier: (req: any) => req.session?.id,
                cookieName: csrfConfig.cookieName || "__Host-csrf-token",
                cookieOptions: {
                    httpOnly: true,
                    sameSite: "strict",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    ...(csrfConfig.cookieOptions || {}),
                },
            });
        }

        // Compression middleware
        if (this.compression) {
            const compressionConfig: CompressionConfig =
                typeof this.compression === "object" ? this.compression : {};
            this.compressionMiddleware = BuiltInMiddleware.compression({
                level: compressionConfig.level || 6,
                threshold: compressionConfig.threshold || 1024,
                filter: compressionConfig.filter,
            });
        }

        // HTTP Parameter Pollution protection
        if (this.hpp) {
            const hppConfig: HPPConfig =
                typeof this.hpp === "object" ? this.hpp : {};
            this.hppMiddleware = BuiltInMiddleware.hpp({
                whitelist: hppConfig.whitelist || ["tags", "categories"],
                checkQuery: hppConfig.checkQuery !== false,
                checkBody: hppConfig.checkBody !== false,
            });
        }

        // MongoDB injection protection
        if (this.mongoSanitize) {
            const mongoConfig: MongoSanitizeConfig =
                typeof this.mongoSanitize === "object"
                    ? this.mongoSanitize
                    : {};
            this.mongoSanitizeMiddleware = BuiltInMiddleware.mongoSanitize({
                replaceWith: mongoConfig.replaceWith || "_",
                onSanitize:
                    mongoConfig.onSanitize ||
                    (({ req, key }: any) => {
                        console.warn(
                            `Sanitized key ${key} in request from ${req.ip}`
                        );
                    }),
            });
        }

        // Morgan logging middleware
        if (this.morgan) {
            const morganConfig: MorganConfig =
                typeof this.morgan === "object" ? this.morgan : {};
            this.morganMiddleware = BuiltInMiddleware.morgan({
                skip:
                    morganConfig.skip ||
                    ((req: any, res: any) => res.statusCode < 400),
                stream: morganConfig.stream,
            });
        }

        // Slow down middleware for rate limiting
        if (this.slowDown) {
            const slowDownConfig: SlowDownConfig =
                typeof this.slowDown === "object" ? this.slowDown : {};
            this.slowDownMiddleware = BuiltInMiddleware.slowDown({
                windowMs: slowDownConfig.windowMs || 15 * 60 * 1000, // 15 minutes
                delayAfter: slowDownConfig.delayAfter || 100,
                delayMs:
                    slowDownConfig.delayMs ||
                    ((used: any, req: any) => {
                        const delayAfter = req.slowDown?.limit || 100;
                        return (used - delayAfter) * 500;
                    }),
            });
        }
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
        if (this.compression && this.compressionMiddleware) {
            this.logger.debug("security", "Adding compression middleware");
            middlewareStack.push(this.compressionMiddleware);
        }

        // 2. Security headers (Helmet)
        if (this.helmet && this.helmetMiddleware) {
            this.logger.debug("security", "Adding helmet middleware");
            middlewareStack.push(this.helmetMiddleware);
        }

        // 3. CORS
        if (this.cors !== false && this.corsMiddleware) {
            this.logger.debug("security", "Adding CORS middleware");
            middlewareStack.push(this.corsMiddleware);
        }

        // 4. Rate limiting (brute force protection - stricter)
        if (this.bruteForce && this.bruteForceMiddleware) {
            this.logger.debug(
                "security",
                "Adding brute force protection middleware"
            );
            middlewareStack.push(this.bruteForceMiddleware);
        }

        // 5. General rate limiting (less strict)
        if (this.rateLimit && this.rateLimitMiddleware) {
            this.logger.debug(
                "security",
                "Adding general rate limiting middleware"
            );
            middlewareStack.push(this.rateLimitMiddleware);
        }

        // 6. HTTP Parameter Pollution protection
        if (this.hpp && this.hppMiddleware) {
            this.logger.debug("security", "Adding HPP middleware");
            middlewareStack.push(this.hppMiddleware);
        }

        // 7. MongoDB sanitization
        if (this.mongoSanitize && this.mongoSanitizeMiddleware) {
            this.logger.debug("security", "Adding mongo sanitize middleware");
            middlewareStack.push(this.mongoSanitizeMiddleware);
        }

        // 8. Morgan logging
        if (this.morgan && this.morganMiddleware) {
            this.logger.debug("security", "Adding morgan middleware");
            middlewareStack.push(this.morganMiddleware);
        }

        // 9. Slow down middleware
        if (this.slowDown && this.slowDownMiddleware) {
            this.logger.debug("security", "Adding slow down middleware");
            middlewareStack.push(this.slowDownMiddleware);
        }

        // 10. XSS protection (custom implementation)
        if (this.xss) {
            this.logger.debug("security", "Adding XSS protection middleware");
            middlewareStack.push(this.xssProtection.bind(this));
        }

        // 11. CSRF protection (should be after body parsing)
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
                req.body,
                "",
                req
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
                req.query,
                "",
                req
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
                req.params,
                "",
                req
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
        path: string = "",
        req?: XyPrisRequest
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
                if (
                    this.sqlInjection &&
                    this.shouldApplySecurityModule(
                        req!,
                        this.routeConfig?.sqlInjection
                    )
                ) {
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

                // Path Traversal Detection
                if (
                    this.pathTraversal &&
                    this.shouldApplySecurityModule(
                        req!,
                        this.routeConfig?.pathTraversal
                    )
                ) {
                    const pathResult =
                        this.pathTraversalDetector.detect(original);
                    if (pathResult.isMalicious) {
                        threatDetected = true;
                        detectedPatterns.push(
                            `Path Traversal (${pathResult.riskLevel})`
                        );
                        if (pathResult.sanitizedInput) {
                            sanitized = pathResult.sanitizedInput;
                        }
                    }
                }

                // Command Injection Detection
                if (
                    this.commandInjection &&
                    this.shouldApplySecurityModule(
                        req!,
                        this.routeConfig?.commandInjection
                    )
                ) {
                    const cmdResult =
                        this.commandInjectionDetector.detect(original);
                    if (cmdResult.isMalicious) {
                        threatDetected = true;
                        detectedPatterns.push(
                            `Command Injection (${cmdResult.riskLevel})`
                        );
                        if (cmdResult.sanitizedInput) {
                            sanitized = cmdResult.sanitizedInput;
                        }
                    }
                }

                // XXE Detection (for XML content)
                if (
                    this.xxe &&
                    this.shouldApplySecurityModule(
                        req!,
                        this.routeConfig?.xxe
                    ) &&
                    (original.includes("<?xml") ||
                        original.includes("<!DOCTYPE"))
                ) {
                    const xxeResult = this.xxeProtector.detect(original);
                    if (xxeResult.isMalicious) {
                        threatDetected = true;
                        detectedPatterns.push(
                            `XXE Attack (${xxeResult.riskLevel})`
                        );
                        if (xxeResult.sanitizedInput) {
                            sanitized = xxeResult.sanitizedInput;
                        }
                    }
                }

                // LDAP Injection Detection
                if (
                    this.ldapInjection &&
                    this.shouldApplySecurityModule(
                        req!,
                        this.routeConfig?.ldapInjection
                    )
                ) {
                    const ldapResult =
                        this.ldapInjectionDetector.detect(original);
                    if (ldapResult.isMalicious) {
                        threatDetected = true;
                        detectedPatterns.push(
                            `LDAP Injection (${ldapResult.riskLevel})`
                        );
                        if (ldapResult.sanitizedInput) {
                            sanitized = ldapResult.sanitizedInput;
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
    public getConfig(): SecurityConfig {
        return {
            level: this.level,
            csrf: this.csrf,
            helmet: this.helmet,
            xss: this.xss,
            sqlInjection: this.sqlInjection,
            pathTraversal: this.pathTraversal,
            commandInjection: this.commandInjection,
            xxe: this.xxe,
            ldapInjection: this.ldapInjection,
            bruteForce: this.bruteForce,
            rateLimit: this.rateLimit,
            cors: this.cors,
            compression: this.compression,
            hpp: this.hpp,
            mongoSanitize: this.mongoSanitize,
            morgan: this.morgan,
            slowDown: this.slowDown,
            encryption: this.encryption,
            authentication: this.authentication,
            routeConfig: this.routeConfig,
        };
    }

    /**
     * Check if a route matches a pattern
     */
    private matchesRoute(
        requestPath: string,
        requestMethod: string,
        pattern: string | RegExp | RoutePattern
    ): boolean {
        // Handle RoutePattern object
        if (typeof pattern === "object" && "path" in pattern) {
            const routePattern = pattern as RoutePattern;
            // Check method if specified
            if (routePattern.methods && routePattern.methods.length > 0) {
                if (
                    !routePattern.methods.includes(requestMethod.toUpperCase())
                ) {
                    return false;
                }
            }
            return this.matchesRoute(
                requestPath,
                requestMethod,
                routePattern.path
            );
        }

        // Handle RegExp
        if (pattern instanceof RegExp) {
            return pattern.test(requestPath);
        }

        // Handle string patterns with wildcards
        const patternStr = pattern as string;

        // Normalize paths by removing trailing slashes for comparison
        const normalizedRequestPath = requestPath.replace(/\/$/, "");
        const normalizedPattern = patternStr.replace(/\/$/, "");

        // Exact match (after normalization)
        if (normalizedPattern === normalizedRequestPath) {
            return true;
        }

        // Wildcard matching (e.g., /api/* matches /api/anything)
        if (patternStr.includes("*")) {
            // Handle trailing /* specially to match with or without trailing slash
            if (patternStr.endsWith("/*")) {
                const prefix = patternStr.slice(0, -2); // Remove /*
                // Match if requestPath starts with prefix, optionally followed by /
                const regex = new RegExp(
                    `^${prefix.replace(/[.+?^${}()|[\]\\]/g, "\\$&")}(?:/.*)?$`
                );
                return regex.test(requestPath);
            } else {
                const regexPattern = patternStr
                    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars except *
                    .replace(/\*/g, ".*"); // Convert * to .*
                const regex = new RegExp(`^${regexPattern}$`);
                return regex.test(requestPath);
            }
        }

        // Path prefix matching (for patterns without wildcards)
        if (normalizedRequestPath.startsWith(normalizedPattern)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a security module should be applied to a route
     */
    private shouldApplySecurityModule(
        req: XyPrisRequest,
        moduleConfig?: SecurityModuleRouteConfig
    ): boolean {
        if (!moduleConfig) {
            return true; // Apply by default if no route config
        }

        const requestPath = req.path || req.url || "";
        const requestMethod = req.method || "GET";

        // Check includeRoutes first (whitelist approach)
        if (
            moduleConfig.includeRoutes &&
            moduleConfig.includeRoutes.length > 0
        ) {
            // Only apply if route is in the include list
            return moduleConfig.includeRoutes.some((pattern) =>
                this.matchesRoute(requestPath, requestMethod, pattern)
            );
        }

        // Check excludeRoutes (blacklist approach)
        if (
            moduleConfig.excludeRoutes &&
            moduleConfig.excludeRoutes.length > 0
        ) {
            // Don't apply if route is in the exclude list
            const isExcluded = moduleConfig.excludeRoutes.some((pattern) =>
                this.matchesRoute(requestPath, requestMethod, pattern)
            );
            return !isExcluded;
        }

        return true; // Apply by default
    }
}


