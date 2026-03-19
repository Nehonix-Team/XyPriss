import {
    EnhancedRequest,
    EnhancedResponse,
    ResponseManipulationConfig,
} from "../../types/types";
import { MiddlewareFunction } from "../../types/mod/core";
import { XStringify } from "xypriss-security";

/**
 * Creates a middleware that manipulates the response body before sending it to the client.
 * This is useful for masking sensitive data in deep objects.
 *
 * @param config Configuration for response manipulation
 * @returns Middleware function
 */
export function createResponseManipulationMiddleware(
    config: ResponseManipulationConfig,
): MiddlewareFunction {
    return (req: EnhancedRequest, res: EnhancedResponse, next: any) => {
        if (!config.enabled || !config.rules || config.rules.length === 0) {
            return next();
        }

        const originalJson = res.json;
        const originalSend = res.send;

        const maxDepth = config.maxDepth || 10;

        const manipulate = (data: any) => {
            if (typeof data !== "object" || data === null) {
                return data;
            }

            // We need a deep clone to avoid mutating the original data
            // but we must be careful with very large objects.
            let result: any;
            try {
                // For objects that might have circular refs or be too large,
                // JSON stringify is a decent first-pass filter/clonner.
                result = JSON.parse(
                    XStringify(data, {
                        pureRaw: true,
                        maxDepth: 100,
                        maxLength: 2000000, // 2MB limit
                        truncateStrings: 1000000, // 1MB limit per string (pour le HTML)
                        reportCircularPath: true,
                    }),
                );
            } catch (e) {
                // If it fails (circular refs), we can't easily manipulate safely
                // without a proper deep clone.
                return data;
            }

            for (const rule of config.rules!) {
                applyRule(
                    result,
                    rule.field,
                    rule.replacement,
                    rule.preserve,
                    rule.valuePattern,
                    0,
                    maxDepth,
                );
            }

            return result;
        };

        // Override res.json
        res.json = function (data: any) {
            try {
                const manipulatedData = manipulate(data);
                return originalJson.call(this, manipulatedData);
            } catch (err) {
                return originalJson.call(this, data);
            }
        };

        // Override res.send
        res.send = function (data: any) {
            if (
                typeof data === "object" &&
                data !== null &&
                !Buffer.isBuffer(data)
            ) {
                try {
                    const manipulatedData = manipulate(data);
                    return originalSend.call(this, manipulatedData);
                } catch (err) {
                    return originalSend.call(this, data);
                }
            }
            return originalSend.call(this, data);
        };

        next();
    };
}

/**
 * Recursively applies a manipulation rule to an object.
 */
function applyRule(
    obj: any,
    field: string | RegExp | undefined,
    replacement: any,
    preserve?: number,
    valuePattern?: RegExp,
    depth: number = 0,
    maxDepth: number = 10,
): void {
    if (!obj || typeof obj !== "object" || depth > maxDepth) return;

    // 1. Global value matching if field is omitted
    if (!field && valuePattern) {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                maskValue(obj, key, replacement, preserve, valuePattern);
                // Recurse deeper
                if (obj[key] && typeof obj[key] === "object") {
                    applyRule(
                        obj[key],
                        undefined,
                        replacement,
                        preserve,
                        valuePattern,
                        depth + 1,
                        maxDepth,
                    );
                }
            }
        }
        return;
    }

    // 2. RegExp matching on keys
    if (field instanceof RegExp) {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (field.test(key)) {
                    maskValue(obj, key, replacement, preserve, valuePattern);
                }
                // Recurse for nested objects even if key didn't match (to find matches deeper)
                if (obj[key] && typeof obj[key] === "object") {
                    applyRule(
                        obj[key],
                        field,
                        replacement,
                        preserve,
                        valuePattern,
                        depth + 1,
                        maxDepth,
                    );
                }
            }
        }
        return;
    }

    // 3. Dot notation matching
    const keys = (field as string).split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] && typeof current[key] === "object") {
            current = current[key];
        } else {
            return; // Path not found
        }
    }

    const lastKey = keys[keys.length - 1];
    if (current[lastKey] !== undefined) {
        maskValue(current, lastKey, replacement, preserve, valuePattern);
    }
}

/**
 * Masks or replaces a value at a specific key in an object.
 */
function maskValue(
    obj: any,
    key: string,
    replacement: any,
    preserve?: number,
    valuePattern?: RegExp,
): void {
    const value = obj[key];

    // If valuePattern is specified, only mask if the value matches the pattern
    if (valuePattern && typeof value === "string") {
        if (!valuePattern.test(value)) {
            return;
        }
    } else if (valuePattern) {
        // Skip non-string values if we're looking for a pattern match
        // (Patterns typically only make sense for string/error messages)
        return;
    }

    if (replacement !== undefined) {
        obj[key] = replacement;
    } else if (typeof value === "string") {
        const preserveLen = preserve || 0;
        if (value.length > preserveLen) {
            obj[key] =
                value.substring(0, preserveLen) +
                "*".repeat(Math.min(value.length - preserveLen, 50)); // Limit mask length
        } else {
            obj[key] = "*".repeat(Math.min(value.length, 50));
        }
    } else if (typeof value === "number" || typeof value === "boolean") {
        obj[key] = "[MASKED]";
    } else if (typeof value === "object") {
        obj[key] = "[HIDDEN OBJECT]";
    } else {
        obj[key] = "********";
    }
}

