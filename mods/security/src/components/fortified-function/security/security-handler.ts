/**
 * XyPrissSecurity - Fortified Function Security Handler
 * Handles all security operations using existing XyPrissSecurity components
 */

import { SecureBuffer } from "../..";
import { SecureString } from "../../secure-string";
import { Hash } from "../../../core";
import { SecureRandom } from "../../../core/random";
import {
    SecureExecutionContext,
    FortifiedFunctionOptions,
} from "../types/types";
import { NehoID } from "nehoid";

export class SecurityHandler {
    private readonly hashUtil: typeof Hash;
    private readonly randomUtil: typeof SecureRandom;

    constructor() {
        this.hashUtil = Hash;
        this.randomUtil = SecureRandom;
    }

    /**
     * Encrypt sensitive parameters using existing SecureString component
     */
    public async encryptParameters<T extends any[]>(
        context: SecureExecutionContext,
        args: T,
        options: Required<FortifiedFunctionOptions>
    ): Promise<void> {
        const { secureParameters } = options;

        for (let i = 0; i < args.length; i++) {
            const shouldEncrypt =
                (secureParameters as (string | number)[]).includes(i) ||
                (secureParameters as (string | number)[]).includes(`param${i}`);

            if (shouldEncrypt && args[i] != null) {
                try {
                    // Use existing SecureString component
                    const secureString = new SecureString(String(args[i]));
                    const encrypted = await secureString.hash("SHA-256", "hex");
                    context.encryptedParameters.set(
                        `param${i}`,
                        encrypted as string
                    );

                    // Store in secure buffer for memory management using existing SecureBuffer
                    const buffer = SecureBuffer.from(String(args[i]));
                    context.secureBuffers.set(`param${i}`, buffer);

                    context.auditEntry.securityFlags.push(
                        `param${i}_encrypted`
                    );
                } catch (error) {
                    console.warn(`Failed to encrypt parameter ${i}:`, error);
                }
            }
        }
    }

    /**
     * Generate deterministic cache key using existing Hash component
     */
    public async generateCacheKey<T extends any[]>(args: T): Promise<string> {
        const serialized = this.safeStringify(args);

        // Use a fixed salt for deterministic cache keys
        const fixedSalt =
            "a99d0d44a7e59854473b3233fd5b2385e3f4be207c61f78beaa3a9d11836f57c";

        return this.hashUtil.createSecureHash(serialized, fixedSalt, {
            algorithm: "sha256",
            outputFormat: "hex",
        }) as string;
    }

    /**
     * Generate hash of parameters for audit logging using existing Hash component
     */
    public async hashParameters<T extends any[]>(args: T): Promise<string> {
        const serialized = this.safeStringify(args, (_, value) => {
            // Don't include actual sensitive values in hash
            if (typeof value === "string" && value.length > 50) {
                return `[REDACTED:${value.length}]`;
            }
            return value;
        });

        return this.hashUtil.createSecureHash(serialized, undefined, {
            algorithm: "sha256",
            outputFormat: "hex",
        }) as string;
    }

    /**
     * Generate secure execution ID using existing SecureRandom
     */
    public generateExecutionId(): string {
        // Use existing SecureRandom for secure ID generation
        return NehoID.generate({ prefix: "func.nhx", size: 16 });
    }

    /**
     * Safe JSON stringify that handles circular references and complex objects
     */
    private safeStringify(
        obj: any,
        replacer?: (key: string, value: any) => any
    ): string {
        const seen = new WeakSet();

        return JSON.stringify(obj, (key: string, value: any) => {
            // Handle circular references
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return "[Circular Reference]";
                }
                seen.add(value);
            }

            // Handle Express.js specific objects
            if (this.isExpressObject(value)) {
                return this.serializeExpressObject(key, value);
            }

            // Handle functions
            if (typeof value === "function") {
                return `[Function: ${value.name || "anonymous"}]`;
            }

            // Handle undefined
            if (value === undefined) {
                return "[Undefined]";
            }

            // Apply custom replacer if provided
            if (replacer) {
                return replacer(key, value);
            }

            return value;
        });
    }

    /**
     * Check if object is an Express.js request/response object
     */
    private isExpressObject(obj: any): boolean {
        if (!obj || typeof obj !== "object") return false;

        // Check for Express request object
        if (obj.method && obj.url && obj.headers && obj.params) {
            return true;
        }

        // Check for Express response object
        if (obj.statusCode !== undefined && obj.setHeader && obj.end) {
            return true;
        }

        return false;
    }

    /**
     * Serialize Express.js objects safely
     */
    private serializeExpressObject(key: string, obj: any): any {
        // For Express request objects
        if (obj.method && obj.url) {
            return {
                type: "ExpressRequest",
                method: obj.method,
                url: obj.url,
                headers: this.sanitizeHeaders(obj.headers),
                params: obj.params,
                query: obj.query,
                body: this.sanitizeBody(obj.body),
            };
        }

        // For Express response objects
        if (obj.statusCode !== undefined) {
            return {
                type: "ExpressResponse",
                statusCode: obj.statusCode,
                headersSent: obj.headersSent,
            };
        }

        return `[Express Object: ${key}]`;
    }

    /**
     * Sanitize headers for safe serialization
     */
    private sanitizeHeaders(headers: any): any {
        if (!headers || typeof headers !== "object") return {};

        const sanitized: any = {};
        for (const [key, value] of Object.entries(headers)) {
            // Redact sensitive headers
            if (
                key.toLowerCase().includes("authorization") ||
                key.toLowerCase().includes("cookie") ||
                key.toLowerCase().includes("token")
            ) {
                sanitized[key] = "[REDACTED]";
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    /**
     * Sanitize request body for safe serialization
     */
    private sanitizeBody(body: any): any {
        if (!body) return body;

        if (typeof body === "object") {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(body)) {
                // Redact sensitive fields
                if (
                    key.toLowerCase().includes("password") ||
                    key.toLowerCase().includes("token") ||
                    key.toLowerCase().includes("secret")
                ) {
                    sanitized[key] = "[REDACTED]";
                } else if (typeof value === "string" && value.length > 100) {
                    sanitized[key] = `[TRUNCATED:${value.length}]`;
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }

        return body;
    }

    /**
     * Sanitize stack trace to remove sensitive information
     */
    public sanitizeStackTrace(stack: string): string {
        // Remove sensitive parameter information from stack traces
        return stack.replace(/\(.*?\)/g, "([REDACTED])");
    }

    /**
     * Schedule secure cleanup of execution context using existing SecureBuffer
     */
    public scheduleCleanup(
        context: SecureExecutionContext,
        memoryWipeDelay: number,
        onCleanup?: (executionId: string) => void
    ): void {
        const cleanup = () => {
            // Destroy secure buffers using existing SecureBuffer.destroy()
            for (const buffer of context.secureBuffers.values()) {
                buffer.destroy();
            }

            // Clear encrypted parameters
            context.encryptedParameters.clear();

            if (onCleanup) {
                onCleanup(context.executionId);
            }
        };

        if (memoryWipeDelay > 0) {
            setTimeout(cleanup, memoryWipeDelay);
        } else {
            cleanup();
        }
    }
}

