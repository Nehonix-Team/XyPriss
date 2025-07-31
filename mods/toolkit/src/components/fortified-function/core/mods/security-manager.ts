/**
 * Security Manager for Fortified Function Core
 * Handles encryption, parameter security, and stack trace protection
 */

import { SecureBuffer } from "../../../secure-memory";
import { SecureString } from "../../../secure-string";
import { ArrayCryptoHandler } from "../../../secure-array/crypto/ArrayCryptoHandler";
import { EventEmitter } from "events";
import {
    FortifiedFunctionOptions,
    SecureExecutionContext,
} from "../../types/types";
import { FortifiedUtils } from "../../utils/utils";

export class SecurityManager extends EventEmitter {
    private readonly cryptoHandler: ArrayCryptoHandler;
    private readonly options: Required<FortifiedFunctionOptions>;

    constructor(options: Required<FortifiedFunctionOptions>) {
        super();
        this.options = options;
        this.cryptoHandler = new ArrayCryptoHandler(
            `xypriss.func.${Date.now()}`
        );
    }

    /**
     * Encrypt sensitive parameters for secure storage
     */
    async encryptParameters<T extends any[]>(
        context: SecureExecutionContext,
        args: T
    ): Promise<void> {
        const { secureParameters } = this.options;

        for (let i = 0; i < args.length; i++) {
            const shouldEncrypt =
                secureParameters.includes(i) ||
                secureParameters.includes(`param${i}`);

            if (shouldEncrypt && args[i] != null) {
                try {
                    // Convert to secure string and hash for security
                    const secureString = new SecureString(String(args[i]));
                    const encrypted = await secureString.hash("SHA-256", "hex");
                    context.encryptedParameters.set(
                        `param${i}`,
                        encrypted as string
                    );

                    // Store in secure buffer for memory management
                    const buffer = SecureBuffer.from(String(args[i]));
                    context.secureBuffers.set(`param${i}`, buffer);

                    context.auditEntry.securityFlags.push(
                        `param${i}_encrypted`
                    );

                    this.emit("parameter_encrypted", { parameter: i });
                } catch (error) {
                    this.emit("encryption_error", { parameter: i, error });
                }
            }
        }
    }

    /**
     * Execute function with stack trace protection
     */
    async executeWithStackProtection<T extends any[], R>(
        originalFunction: (...args: T) => R | Promise<R>,
        args: T
    ): Promise<R> {
        if (!this.options.stackTraceProtection) {
            return await originalFunction(...args);
        }

        try {
            return await originalFunction(...args);
        } catch (error) {
            // Sanitize stack trace to remove sensitive parameter information
            if (error instanceof Error && error.stack) {
                error.stack = FortifiedUtils.sanitizeStackTrace(error.stack);
            }
            throw error;
        }
    }

    /**
     * Generate cache key for memoization
     */
    async generateCacheKey<T extends any[]>(args: T): Promise<string> {
        const serialized = JSON.stringify(args);
        const secureString = new SecureString(serialized);
        try {
            return (await secureString.hash("SHA-256", "hex")) as string;
        } finally {
            secureString.destroy();
        }
    }

    /**
     * Generate hash of parameters for audit logging
     */
    async hashParameters<T extends any[]>(args: T): Promise<string> {
        const serialized = FortifiedUtils.serializeArgsForHash(args);
        const secureString = new SecureString(serialized);
        try {
            return (await secureString.hash("SHA-256", "hex")) as string;
        } finally {
            secureString.destroy();
        }
    }

    /**
     * Clean up security resources
     */
    destroy(): void {
        this.removeAllListeners();
    }
}

