/**
 * XyPriss Security Middleware
 * Comprehensive security middleware using BuiltInMiddleware as single source of truth
 */

import {
    SecurityConfig,
    SecurityLevel,
    RateLimitConfig,
    CSRFConfig,
    HelmetConfig,
    RequestSignatureConfig,
    CompressionConfig,
    HPPConfig,
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
    BrowserOnlyProtector,
    TerminalOnlyProtector,
    BrowserOnlyConfig,
    TerminalOnlyConfig,
} from "./built-in/security";
import { Logger } from "../shared/logger/Logger";
import { BuiltInMiddleware } from "./built-in/BuiltInMiddleware";

import { getSysApi } from "../plugins/const/getSysApi";

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
    public rateLimit: boolean | RateLimitConfig;
    public cors: boolean | CORSConfig;
    public compression: boolean | CompressionConfig;
    public hpp: boolean | HPPConfig;
    public slowDown: boolean | SlowDownConfig;
    public browserOnly: boolean | BrowserOnlyConfig;
    public terminalOnly: boolean | TerminalOnlyConfig;
    public requestSignature: boolean | RequestSignatureConfig;
    public routeConfig?: SecurityConfig["routeConfig"];
    public maliciousUrlScanner: SecurityConfig["maliciousUrlScanner"];
    private _ignore: (string | RegExp)[];
    private _ignoreAll: (string | RegExp)[];

    // Middleware instances from external libraries
    private helmetMiddleware: any;
    private corsMiddleware: any;
    private rateLimitMiddleware: any;
    private csrfMiddleware: any;
    private browserOnlyMiddleware: any;
    private terminalOnlyMiddleware: any;
    private requestSignatureMiddleware: any;
    private hppMiddleware: any;
    private compressionMiddleware: any;
    private maliciousUrlScannerMiddleware: any;

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
        this._ignore = config._ignore || [];
        this._ignoreAll = config._ignoreAll || [];

        // console.log("config.csrf: ", config.csrf);
        this.csrf =
            typeof config.csrf === "boolean"
                ? config.csrf
                : (config.csrf ?? { enabled: true, secret: "" });
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
        this.rateLimit =
            config.rateLimit !== false ? config.rateLimit || true : false;

        // If rateLimit is explicitly configured as an object, disable bruteForce to avoid conflicts
        if (typeof config.rateLimit === "object" && config.rateLimit !== null) {
            this.logger.debug(
                "security",
                "Brute force protection disabled because rateLimit is explicitly configured",
            );
        }
        this.cors = config.cors !== false ? config.cors || true : false;
        this.compression =
            config.compression !== false ? config.compression || true : false;
        this.hpp = config.hpp !== false ? config.hpp || true : false;
        this.slowDown =
            config.slowDown !== false ? config.slowDown || true : false;
        this.browserOnly =
            config.browserOnly !== false ? config.browserOnly || false : false;
        this.terminalOnly =
            config.terminalOnly !== false
                ? config.terminalOnly || false
                : false;

        this.requestSignature =
            config.requestSignature !== false
                ? config.requestSignature || false
                : false;
        
        this.maliciousUrlScanner = config.maliciousUrlScanner;

        // this.encryption = {
        //     algorithm: "AES-256-GCM",
        //     keySize: 32,
        //     ...config.encryption,
        // };

        // Store route configuration
        this.routeConfig = config.routeConfig;





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

            this.logger.debug("security", "Final cspConfig:", cspConfig);
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
                `Initializing CORS with config: ${JSON.stringify(corsConfig)}`,
            );
            this.corsMiddleware = BuiltInMiddleware.cors(corsConfig);
        }

        // General rate limiting (separate from brute force protection)
        if (this.rateLimit) {
            const rateLimitConfig: RateLimitConfig =
                typeof this.rateLimit === "object" ? this.rateLimit : {};
            const maxRequests = rateLimitConfig.max || 100; // Default 100 requests

            this.rateLimitMiddleware = BuiltInMiddleware.rateLimit({
                windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000, // 15 minutes
                max: maxRequests,
                message: rateLimitConfig.message, // BuiltInMiddleware will handle format conversion
                standardHeaders: rateLimitConfig.standardHeaders !== false,
                legacyHeaders: false,
                skip: (req: any, res: any) => {
                    // Custom skip function
                    if (typeof rateLimitConfig.skip === "function") {
                        // If a skip function is provided, it takes full control
                        return rateLimitConfig.skip(req, res);
                    }

                    // Excluded paths (only used if no skip function is provided)
                    if (
                        rateLimitConfig.excludePaths &&
                        Array.isArray(rateLimitConfig.excludePaths)
                    ) {
                        return rateLimitConfig.excludePaths.some(
                            (p: string | RegExp) => {
                                if (typeof p === "string") {
                                    return (
                                        req.path === p || req.path.startsWith(p)
                                    );
                                }
                                if (p instanceof RegExp) {
                                    return p.test(req.path);
                                }
                                return false;
                            },
                        );
                    }

                    return false;
                },
            });
            this.logger.debug(
                "security",
                `General rate limiting initialized with max: ${maxRequests} requests per ${Math.ceil(
                    (rateLimitConfig.windowMs || 15 * 60 * 1000) / 1000,
                )}s window`,
            );
        }

        // CSRF protection using BuiltInMiddleware
        if (this.csrf) {
            this.logger.debug("security", "Initializing CSRF protection");
            const csrfConfig: CSRFConfig =
                typeof this.csrf === "object" ? this.csrf : { secret: "" };
            // Secret must be provided directly in the csrf config
            const secret = (csrfConfig as CSRFConfig).secret;

            if (!secret) {
                throw new Error(
                    "[XyPriss Security] CSRF protection is enabled but no secret was provided. Set 'security.csrf.secret' in your server config.",
                );
            }

            this.csrfMiddleware = BuiltInMiddleware.csrf({
                getSecret: () => secret,
                getSessionIdentifier: (req: any) =>
                    req.session?.id ||
                    req.headers["x-session-id"] ||
                    "anonymous",
                cookieName: csrfConfig.cookieName || "__Host-csrf-token",
                cookieOptions: {
                    httpOnly: true,
                    sameSite: "strict",
                    secure: getSysApi().__env__.isProduction(),
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    ...(csrfConfig.cookieOptions || {}),
                },
            });
        }

        this.logger.debug("security", "CSRF protection initialized");

        // Browser-only protection
        if (this.isBrowserOnlyEnabled()) {
            this.logger.debug(
                "security",
                "Initializing browser-only protection",
            );
            const browserOnlyConfig: BrowserOnlyConfig =
                typeof this.browserOnly === "object" ? this.browserOnly : {};
            this.browserOnlyMiddleware =
                BuiltInMiddleware.browserOnly(browserOnlyConfig);
        }

        // Terminal-only protection
        if (this.isTerminalOnlyEnabled()) {
            const terminalOnlyConfig: TerminalOnlyConfig =
                typeof this.terminalOnly === "object" ? this.terminalOnly : {};
            this.terminalOnlyMiddleware =
                BuiltInMiddleware.terminalOnly(terminalOnlyConfig);
        }

        // Request signature protection (API authentication)
        if (this.requestSignature) {
            const requestSignatureConfig: RequestSignatureConfig =
                typeof this.requestSignature === "object" &&
                this.requestSignature !== null
                    ? this.requestSignature
                    : { secret: "default-secret" }; // This will be overridden by user config
            this.requestSignatureMiddleware =
                BuiltInMiddleware.requestSignature(requestSignatureConfig);
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

        // Malicious URL Scanner
        if (this.maliciousUrlScanner) {
            this.maliciousUrlScannerMiddleware = BuiltInMiddleware.maliciousUrlScanner(this.maliciousUrlScanner, this.logger);
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
            next: NextFunction,
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
        next: NextFunction,
    ): void {
        this.logger.debug("security", "Starting security middleware stack");
        const middlewareStack: Array<(req: any, res: any, next: any) => void> =
            [];

        // 🚨 CRITICAL: Access control middlewares FIRST (before any other processing)
        // These must run before route resolution to block unwanted requests

        const browserEnabled = this.isBrowserOnlyEnabled();
        const terminalEnabled = this.isTerminalOnlyEnabled();

        if (
            terminalEnabled &&
            this.terminalOnlyMiddleware &&
            this.shouldApplySecurityModule(req, undefined, true)
        ) {
            this.logger.debug("security", "Adding terminal-only middleware");
            middlewareStack.push(this.terminalOnlyMiddleware);
        } else if (
            browserEnabled &&
            this.browserOnlyMiddleware &&
            this.shouldApplySecurityModule(req, undefined, true)
        ) {
            this.logger.debug("security", "Adding browser-only middleware");
            middlewareStack.push(this.browserOnlyMiddleware);
        }

        // 2.5 Malicious URL Scanner
        if (
            this.maliciousUrlScanner &&
            this.maliciousUrlScannerMiddleware &&
            this.shouldApplySecurityModule(req, undefined, true)
        ) {
            this.logger.debug("security", "Adding malicious URL scanner middleware");
            middlewareStack.push(this.maliciousUrlScannerMiddleware);
        }

        // 3. Request signature protection (API authentication)
        if (
            this.requestSignature &&
            this.requestSignatureMiddleware &&
            this.shouldApplySecurityModule(req, undefined, true)
        ) {
            this.logger.debug(
                "security",
                "Adding request signature middleware (FIRST)",
            );
            middlewareStack.push(this.requestSignatureMiddleware);
        }

        // 4. Compression (should be early but after access control)
        if (this.compression && this.compressionMiddleware) {
            this.logger.debug("security", "Adding compression middleware");
            middlewareStack.push(this.compressionMiddleware);
        }

        // 5. Security headers (Helmet) - MIGRATED TO XHSC

        // 6. CORS
        if (this.cors !== false && this.corsMiddleware) {
            this.logger.debug("security", "Adding CORS middleware");
            middlewareStack.push(this.corsMiddleware);
        }

        // 8. General rate limiting (less strict)
        if (this.rateLimit && this.rateLimitMiddleware) {
            this.logger.debug(
                "security",
                "Adding general rate limiting middleware",
            );
            middlewareStack.push(this.rateLimitMiddleware);
        }

        // 9. HTTP Parameter Pollution protection - MIGRATED TO XHSC

        // 13. XSS protection - MIGRATED TO XHSC

        // 14. CSRF protection (should be after body parsing) - MIGRATED TO XHSC

        this.logger.debug(
            "security",
            `Total middleware in stack: ${middlewareStack.length}`,
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
        finalNext: NextFunction,
    ): void {
        let index = 0;
        let nextCalled = false;

        this.logger.debug(
            "security",
            `Executing middleware stack with ${stack.length} middleware`,
        );

        const next = (error?: any) => {
            if (nextCalled) {
                this.logger.debug(
                    "security",
                    "next() already called, ignoring duplicate call",
                );
                return;
            }

            if (error) {
                nextCalled = true;
                this.logger.debug(
                    "security",
                    `Error in middleware at index ${index - 1}:`,
                    error,
                );
                return finalNext(error);
            }

            if (index >= stack.length) {
                nextCalled = true;
                this.logger.debug(
                    "security",
                    "All middleware completed, calling final next",
                );
                return finalNext();
            }

            const currentIndex = index;
            this.logger.debug(
                "security",
                `Executing middleware ${currentIndex + 1}/${stack.length}`,
            );

            const middleware = stack[index++];

            try {
                // Set a timeout to detect if middleware doesn't call next()
                //@ts-ignore - NodeJS.Timeout
                let timeoutId: NodeJS.Timeout | null = null;
                let middlewareCompleted = false;

                const middlewareNext = (err?: any) => {
                    if (middlewareCompleted) return;
                    middlewareCompleted = true;

                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }

                    // Intercept HTTP/CSRF errors passed via next(err)
                    if (
                        err &&
                        (err.statusCode ||
                            err.status ||
                            err.code === "EBADCSRFTOKEN")
                    ) {
                        const statusCode = err.statusCode || err.status || 403;
                        this.logger.debug(
                            "security",
                            `Security middleware rejected request (${statusCode}): ${err.message}`,
                        );
                        if (!res.headersSent) {
                            res.status(statusCode).json({
                                error: err.message || "Forbidden",
                                code: err.code || "SECURITY_BLOCKED",
                            });
                        }
                        return;
                    }

                    this.logger.debug(
                        "security",
                        `Middleware ${currentIndex + 1} completed`,
                    );

                    next(err);
                };

                // Set timeout to detect hanging middleware
                timeoutId = setTimeout(() => {
                    if (!middlewareCompleted) {
                        // If headers were already sent, it means the middleware blocked the request
                        // and sent a response, so we should NOT continue the chain.
                        if (res.headersSent) {
                            this.logger.debug(
                                "security",
                                `Middleware ${
                                    currentIndex + 1
                                } blocked the request (headers sent), stopping chain`,
                            );
                            middlewareCompleted = true;
                            return;
                        }

                        this.logger.debug(
                            "security",
                            `Middleware ${
                                currentIndex + 1
                            } timed out, continuing anyway`,
                        );
                        middlewareCompleted = true;
                        next();
                    }
                }, 100); // 100ms timeout

                // Execute the middleware
                middleware(req, res, middlewareNext);
            } catch (error: any) {
                // CSRF and other HTTP errors: respond directly instead of crashing
                if (
                    error?.statusCode ||
                    error?.status ||
                    error?.code === "EBADCSRFTOKEN"
                ) {
                    const statusCode = error.statusCode || error.status || 403;
                    this.logger.debug(
                        "security",
                        `Security middleware rejected request (${statusCode}): ${error.message}`,
                    );
                    if (!res.headersSent) {
                        res.status(statusCode).json({
                            error: error.message || "Forbidden",
                            code: error.code || "SECURITY_BLOCKED",
                        });
                    }
                    return;
                }

                this.logger.debug(
                    "security",
                    `Exception in middleware at index ${currentIndex}:`,
                    error,
                );
                finalNext(error);
            }
        };

        // Start the middleware chain
        this.logger.debug("security", "Starting middleware chain");
        next();
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
     * Check if browser-only protection is enabled
     */
    private isBrowserOnlyEnabled(): boolean {
        if (this.level === "maximum") {
            return true;
        }
        return !!this.browserOnly;
    }

    /**
     * Check if terminal-only protection is enabled
     */
    private isTerminalOnlyEnabled(): boolean {
        if (this.level === "maximum") {
            return false;
        }
        return !!this.terminalOnly;
    }

    /**
     * Check if a route matches a pattern
     */
    private matchesRoute(
        requestPath: string,
        requestMethod: string,
        pattern: string | RegExp | RoutePattern,
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
                routePattern.path,
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
                    `^${prefix.replace(/[.+?^${}()|[\]\\]/g, "\\$&")}(?:/.*)?$`,
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
     * Evaluates if a security module should be applied to the current request.
     *
     * @param req The incoming request
     * @param moduleConfig Optional route-specific configuration for the module
     * @param absoluteBypassOnly If true, only checks against _ignoreAll (used for access control/signatures)
     * @returns boolean True if the security module should be applied
     */
    private shouldApplySecurityModule(
        req: XyPrisRequest,
        moduleConfig?: SecurityModuleRouteConfig,
        absoluteBypassOnly: boolean = false,
    ): boolean {
        const requestPath = req.path || req.url || "";
        const requestMethod = req.method || "GET";

        // 1. 🚨 Absolute Ignore List Check (_ignoreAll)
        // High priority bypass for ALL security layers (detectors + access control)
        if (this._ignoreAll.length > 0) {
            const isAbsolutelyIgnored = this._ignoreAll.some((pattern) => {
                if (typeof pattern === "string") {
                    return this.matchesRoute(
                        requestPath,
                        requestMethod,
                        pattern,
                    );
                }
                if (pattern instanceof RegExp) {
                    return pattern.test(requestPath);
                }
                return false;
            });

            if (isAbsolutelyIgnored) {
                this.logger.debug(
                    "security",
                    `Route ${requestPath} is ABSOLUTELY ignored by security middleware`,
                );
                return false;
            }
        }

        // 2. 🛡️ Content-Only Ignore List Check (_ignore)
        // Bypass for content-based detectors only (XSS, SQLi, etc.)
        if (!absoluteBypassOnly && this._ignore.length > 0) {
            const isContentIgnored = this._ignore.some((pattern) => {
                if (typeof pattern === "string") {
                    return this.matchesRoute(
                        requestPath,
                        requestMethod,
                        pattern,
                    );
                }
                if (pattern instanceof RegExp) {
                    return pattern.test(requestPath);
                }
                return false;
            });

            if (isContentIgnored) {
                this.logger.debug(
                    "security",
                    `Route ${requestPath} bypassed content-based security detectors`,
                );
                return false;
            }
        }

        if (!moduleConfig) {
            return true; // Apply by default if no route config
        }

        // Check includeRoutes first (whitelist approach)
        if (
            moduleConfig.includeRoutes &&
            moduleConfig.includeRoutes.length > 0
        ) {
            // Only apply if route is in the include list
            return moduleConfig.includeRoutes.some((pattern) =>
                this.matchesRoute(requestPath, requestMethod, pattern),
            );
        }

        // Check excludeRoutes (blacklist approach)
        if (
            moduleConfig.excludeRoutes &&
            moduleConfig.excludeRoutes.length > 0
        ) {
            // Don't apply if route is in the exclude list
            const isExcluded = moduleConfig.excludeRoutes.some((pattern) =>
                this.matchesRoute(requestPath, requestMethod, pattern),
            );
            return !isExcluded;
        }

        return true; // Apply by default
    }

}



