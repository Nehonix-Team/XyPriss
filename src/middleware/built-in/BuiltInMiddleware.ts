/**
 * XyPriss Built-in Middleware
 * Wrappers around popular middleware libraries
 */

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
     * @deprecated Handled natively by XHSC Engine
     */
    static cors(options: any = {}) {
        return (req: any, res: any, next: any) => {
            // Note: XHSC Engine applies CORS natively at the networking layer
            next();
        };
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

