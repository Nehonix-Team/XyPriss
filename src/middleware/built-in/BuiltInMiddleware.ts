/**
 * XyPriss Built-in Middleware
 * Wrappers around popular middleware libraries
 */

import { xyprissCors as cors } from "./security/XyPrissCors";
import { xyprissHPP as hpp } from "./security/XyPrissHPP";
import compression, { shouldCompress } from "xypriss-compression";
import { mergeWithDefaults } from "../../utils/mergeWithDefaults";
import { RequestSignatureProtector } from "./security/RequestSignatureProtector";
import { RequestSignatureConfig } from "../../types/mod/security";
import { BrowserOnlyProtector } from "./security/BrowserOnlyProtector";
import { TerminalOnlyProtector } from "./security/TerminalOnlyProtector";
import { MobileOnlyProtector } from "./security/MobileOnlyProtector";
import { MaliciousUrlScanner } from "./security/MaliciousUrlScanner";
import { Logger } from "../../shared/logger/Logger";

export interface BuiltInMiddlewareConfig {
    helmet?: any;
    cors?: any;
    compression?: any;
    csrf?: any;
    validator?: any;
    hpp?: any;
    xss?: any;
    requestSignature?: any;
    maliciousUrlScanner?: any;
}

export class BuiltInMiddleware {
    /**
     * Get Helmet middleware for security headers
     * @deprecated Handled natively by XHSC Engine
     */
    static helmet(options: any = {}) {
        return (req: any, res: any, next: any) => {
            // Note: XHSC Engine applies Helmet at the entry point
            next();
        };
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
     * Rate limiting is now handled natively or via XHSC.
     * @deprecated Use XyPriss Native Rate Limiter instead.
     */
    /**
     * Native XyPriss Rate Limiter
     */
    static rateLimit(options: any = {}) {
        // Handled by XHSC Hyper-System Core natively for maximum performance.
        // This middleware is kept as a placeholder to maintain API compatibility
        // with existing code but delegates logic to the engine.
        return (req: any, res: any, next: any) => {
            // Note: XHSC Engine applies Rate Limiting at the entry point
            // BEFORE reaching the worker, using tollbooth (Go).
            next();
        };
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

        // Robust check for ESM/CJS interop issues with the compression plugin
        const compressionFn =
            typeof compression === "function"
                ? compression
                : (compression as any).default;

        if (typeof compressionFn !== "function") {
            const logger = Logger.getInstance();
            logger.error(
                "middleware",
                "Compression plugin is not a function. Skipping compression.",
            );
            return (_req: any, _res: any, next: any) => next();
        }

        return compressionFn(config);
    }

    /**
     * CSRF protection middleware
     * @deprecated Handled natively by XHSC Engine
     */
    static csrf(options: any = {}) {
        return (req: any, res: any, next: any) => {
            // Note: XHSC Engine applies CSRF validation
            next();
        };
    }

    /**
     * Get HPP (HTTP Parameter Pollution) protection middleware
     */
    static hpp(options: Parameters<typeof hpp>[0] = {}): any {
        const defaultOptions = {
            whitelist: ["tags", "categories"], // Allow arrays for these parameters
        };

        const config: any = mergeWithDefaults(defaultOptions, options as any);
        return hpp(config);
    }

    /**
     * Get XSS protection middleware
     * @deprecated Handled natively by XHSC Engine
     */
    static xss(options: any = {}) {
        return (req: any, _res: any, next: any) => {
            // Note: XHSC Engine applies XSS sanitization at the entry point
            next();
        };
    }

    // Morgan is not supported. This stub exists only to produce a clear runtime error.
    static morgan(_options?: any): never {
        throw new Error(
            "[XyPriss] morgan is not supported. Use the Xyphra plugin for request logging: https://github.com/Nehonix-Team/xyphra",
        );
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
            compression: this.compression(options.compression),
            csrf: this.csrf(options.csrf),
            requestSignature: this.requestSignature(options.requestSignature),
        };
    }


    /**
     * Get Malicious URL Scanner middleware
     */
    static maliciousUrlScanner(config: any, logger?: Logger) {
        return MaliciousUrlScanner.middleware(config, logger);
    }
}

