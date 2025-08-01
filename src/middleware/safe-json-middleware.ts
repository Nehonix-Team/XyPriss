/**
 * Safe JSON Middleware for Express
 * Automatically handles circular references in JSON responses
 */

import { Request, Response, NextFunction } from "express";
import { expressStringify } from "../../mods/security/src/components/fortified-function/serializer/safe-serializer";
import { logger } from "../server/utils/Logger";

export interface SafeJsonOptions {
    /**
     * Enable safe JSON serialization for all responses
     * @default true
     */
    enabled?: boolean;

    /**
     * Maximum depth for object serialization
     * @default 10
     */
    maxDepth?: number;

    /**
     * Maximum string length before truncation
     * @default 1000
     */
    truncateStrings?: number;

    /**
     * Include non-enumerable properties
     * @default false
     */
    includeNonEnumerable?: boolean;

    /**
     * Log when circular references are detected
     * @default false
     */
    logCircularRefs?: boolean;

    /**
     * Custom replacer function for additional handling
     */
    customReplacer?: (key: string, value: any) => any;
}

/**
 * Creates middleware that safely handles JSON serialization
 */
export function createSafeJsonMiddleware(options: SafeJsonOptions = {}) {
    const opts = {
        enabled: true,
        maxDepth: 10,
        truncateStrings: 1000,
        includeNonEnumerable: false,
        logCircularRefs: false,
        customReplacer: undefined as
            | ((key: string, value: any) => any)
            | undefined,
        ...options,
    };

    return function safeJsonMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        if (!opts.enabled) {
            return next();
        }

        // Store the original json method
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        // Override res.json to use safe serialization
        res.json = function (obj: any) {
            try {
                // Try standard JSON.stringify first for performance
                const standardResult = JSON.stringify(obj);
                return originalJson(obj);
            } catch (error: any) {
                if (
                    opts.logCircularRefs &&
                    error.message.includes("circular")
                ) {
                    logger.debug(
                        "server",
                        "🔄 Circular reference detected, using safe serialization:",
                        {
                            url: req.url,
                            method: req.method,
                            error: error.message,
                        }
                    );
                }

                try {
                    // Use our safe serialization
                    const safeResult = expressStringify(obj);
                    const parsedResult = JSON.parse(safeResult);
                    return originalJson(parsedResult);
                } catch (safeError: any) {
                    logger.debug(
                        "server",
                        "❌ Safe JSON serialization failed:",
                        safeError
                    );
                    return originalJson({
                        error: "Serialization failed",
                        message: "Unable to serialize response object",
                        originalError: safeError.message,
                    });
                }
            }
        };

        // Override res.send to handle objects that might be passed directly
        res.send = function (body: any) {
            if (
                typeof body === "object" &&
                body !== null &&
                !Buffer.isBuffer(body)
            ) {
                // If it's an object, use our safe json method
                return res.json(body);
            }
            return originalSend(body);
        };

        next();
    };
}

/**
 * Quick setup function for common use cases
 */
export function setupSafeJson(app: any, options: SafeJsonOptions = {}) {
    app.use(createSafeJsonMiddleware(options));
}

/**
 * Utility function to safely stringify any object
 */
export function safeJsonStringify(
    obj: any,
    options: SafeJsonOptions = {}
): string {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        return expressStringify(obj);
    }
}

/**
 * Enhanced res.json replacement that can be used manually
 */
export function sendSafeJson(
    res: Response,
    obj: any,
    options: SafeJsonOptions = {}
) {
    try {
        const result = safeJsonStringify(obj, options);
        res.setHeader("Content-Type", "application/json");
        res.send(result);
    } catch (error: any) {
        console.error("❌ Failed to send safe JSON:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to serialize response",
        });
    }
}

/**
 * Middleware specifically for debugging circular references
 */
export function createCircularRefDebugger() {
    return function circularRefDebugger(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        const originalJson = res.json.bind(res);

        res.json = function (obj: any) {
            try {
                JSON.stringify(obj);
                return originalJson(obj);
            } catch (error: any) {
                if (error.message.includes("circular")) {
                    console.log("🔍 Circular Reference Debug Info:");
                    console.log("  Route:", req.method, req.url);
                    console.log("  Object type:", typeof obj);
                    console.log(
                        "  Object constructor:",
                        obj?.constructor?.name
                    );
                    console.log("  Object keys:", Object.keys(obj || {}));

                    // Try to identify the circular reference
                    const seen = new WeakSet();
                    const findCircular = (
                        obj: any,
                        path: string[] = []
                    ): string[] => {
                        if (typeof obj !== "object" || obj === null) return [];
                        if (seen.has(obj)) return path;
                        seen.add(obj);

                        for (const [key, value] of Object.entries(obj)) {
                            const result = findCircular(value, [...path, key]);
                            if (result.length > 0) return result;
                        }
                        return [];
                    };

                    const circularPath = findCircular(obj);
                    if (circularPath.length > 0) {
                        console.log(
                            "  Circular path:",
                            circularPath.join(" -> ")
                        );
                    }
                }
                throw error;
            }
        };

        next();
    };
}

