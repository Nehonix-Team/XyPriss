import { keyLogger } from "../../keys-logger";
import {
    AlgorithmBackend,
    KeyDerivationAlgorithm,
    KeyDerivationHashFunction,
    KeyDerivationMetrics,
} from "../../keys-types";
import * as crypto from "crypto";
import { PerformanceUtils } from "../../keys-utils";
 
/**
 * High-performance PBKDF2 (Password-Based Key Derivation Function 2) implementation
 * with intelligent backend selection and comprehensive error handling.
 *
 * This implementation provides optimal performance by automatically selecting
 * the best available cryptographic backend in the following priority order:
 * 1. Node.js native crypto (fastest, most secure)
 * 2. External pbkdf2 library (good performance, widely compatible)
 * 3. Pure JavaScript fallback (slowest, maximum compatibility)
 *
 * @example
 * ```typescript
 * const password = new TextEncoder().encode('mypassword');
 * const salt = crypto.randomBytes(16);
 * const result = PBKDF2Algo.derive(password, salt, 100000, 32, KeyDerivationHashFunction.SHA256);
 * console.log('Derived key:', result.key);
 * console.log('Backend used:', result.backend);
 * ```
 */
export class PBKDF2Algo {
    /** Cache for backend availability to avoid repeated checks */
    private static backendCache = {
        nodeChecked: false,
        nodeAvailable: false,
        libraryChecked: false,
        libraryAvailable: false,
    };

    /**
     * Derives a cryptographic key from a password using PBKDF2 algorithm.
     *
     * This method automatically selects the optimal backend for maximum performance
     * and provides detailed metrics about the derivation process. The implementation
     * follows RFC 2898 specifications for PBKDF2.
     *
     * @param password - The input password as a Uint8Array
     * @param salt - Cryptographic salt as a Uint8Array (recommended: 16+ bytes)
     * @param iterations - Number of iterations (recommended: 100,000+ for passwords)
     * @param keyLength - Desired output key length in bytes
     * @param hashFunction - Hash function to use (SHA256 or SHA512)
     *
     * @returns Object containing:
     *   - key: The derived key as Uint8Array
     *   - backend: Which backend was used for derivation
     *   - metrics: Performance and execution metrics
     *
     * @throws {Error} When all backends fail or invalid parameters are provided
     *
     * @example
     * ```typescript
     * // Basic usage
     * const result = PBKDF2Algo.derive(
     *   new TextEncoder().encode('password123'),
     *   crypto.randomBytes(16),
     *   100000,
     *   32,
     *   KeyDerivationHashFunction.SHA256
     * );
     *
     * // Check which backend was used
     * if (result.backend === AlgorithmBackend.NODE_CRYPTO) {
     *   console.log('Using fastest native implementation');
     * }
     * ```
     */
    public static derive(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number,
        hashFunction: KeyDerivationHashFunction
    ): {
        key: Uint8Array;
        backend: AlgorithmBackend;
        metrics: KeyDerivationMetrics;
    } {
        // Input validation
        this.validateInputs(password, salt, iterations, keyLength);

        const startTime = performance.now();
        let backend: AlgorithmBackend;
        let key: Uint8Array;
        let error: string | undefined;

        try {
            // Try backends in order of performance preference
            if (this.isNodeCryptoAvailable()) {
                key = this.deriveWithNodeCrypto(
                    password,
                    salt,
                    iterations,
                    keyLength,
                    hashFunction
                );
                backend = AlgorithmBackend.NODE_CRYPTO;
                keyLogger.debug(
                    "PBKDF2",
                    "Using optimized Node.js crypto backend"
                );
            } else if (this.isLibraryAvailable()) {
                key = this.deriveWithLibrary(
                    password,
                    salt,
                    iterations,
                    keyLength,
                    hashFunction
                );
                backend = AlgorithmBackend.EXTERNAL_LIBRARY;
                keyLogger.debug(
                    "PBKDF2",
                    "Using external pbkdf2 library backend"
                );
            } else {
                // No synchronous implementation available
                throw new Error(
                    "No secure PBKDF2 implementation available. " +
                        "Please install Node.js crypto or pbkdf2 library for production use."
                );
            }

            return this.createSuccessResult(
                key,
                backend,
                startTime,
                iterations,
                keyLength
            );
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Unknown PBKDF2 derivation error";
            keyLogger.error("PBKDF2", `Derivation failed: ${error}`);

            const metrics = this.createErrorMetrics(
                startTime,
                iterations,
                keyLength,
                error
            );
            keyLogger.logMetrics(metrics);
            throw new Error(`PBKDF2 derivation failed: ${error}`);
        }
    }

    /**
     * Validates input parameters for PBKDF2 derivation.
     *
     * @private
     * @param password - Password to validate
     * @param salt - Salt to validate
     * @param iterations - Iteration count to validate
     * @param keyLength - Key length to validate
     * @throws {Error} When validation fails
     */
    private static validateInputs(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number
    ): void {
        if (!password || password.length === 0) {
            throw new Error("Password cannot be empty");
        }
        if (!salt || salt.length < 8) {
            throw new Error("Salt must be at least 8 bytes long");
        }
        if (iterations < 1000) {
            throw new Error(
                "Iteration count must be at least 1000 for security"
            );
        }
        if (keyLength < 1 || keyLength > 2048) {
            throw new Error("Key length must be between 1 and 2048 bytes");
        }
    }

    /**
     * Checks if Node.js crypto module is available and functional.
     * Uses caching to avoid repeated checks for better performance.
     *
     * @private
     * @returns True if Node.js crypto is available
     */
    private static isNodeCryptoAvailable(): boolean {
        if (this.backendCache.nodeChecked) {
            return this.backendCache.nodeAvailable;
        }

        try {
            this.backendCache.nodeAvailable =
                typeof crypto !== "undefined" &&
                typeof crypto.pbkdf2Sync === "function" &&
                typeof crypto.randomBytes === "function";
        } catch {
            this.backendCache.nodeAvailable = false;
        }

        this.backendCache.nodeChecked = true;
        return this.backendCache.nodeAvailable;
    }

    /**
     * Checks if external pbkdf2 library is available.
     * Uses caching to avoid repeated require() calls.
     *
     * @private
     * @returns True if pbkdf2 library is available
     */
    private static isLibraryAvailable(): boolean {
        if (this.backendCache.libraryChecked) {
            return this.backendCache.libraryAvailable;
        }

        try {
            if (typeof require === "function") {
                const pbkdf2Lib = require("pbkdf2");
                this.backendCache.libraryAvailable =
                    typeof pbkdf2Lib.pbkdf2Sync === "function";
            } else {
                this.backendCache.libraryAvailable = false;
            }
        } catch {
            this.backendCache.libraryAvailable = false;
        }

        this.backendCache.libraryChecked = true;
        return this.backendCache.libraryAvailable;
    }

    /**
     * Performs PBKDF2 derivation using Node.js native crypto module.
     * This is the fastest and most secure implementation.
     *
     * @private
     * @param password - Input password
     * @param salt - Cryptographic salt
     * @param iterations - Iteration count
     * @param keyLength - Output key length
     * @param hashFunction - Hash function to use
     * @returns Derived key as Uint8Array
     */
    private static deriveWithNodeCrypto(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number,
        hashFunction: KeyDerivationHashFunction
    ): Uint8Array {
        const digest =
            hashFunction === KeyDerivationHashFunction.SHA512
                ? "sha512"
                : "sha256";

        const result = crypto.pbkdf2Sync(
            Buffer.from(password),
            Buffer.from(salt),
            iterations,
            keyLength,
            digest
        );

        return new Uint8Array(result);
    }

    /**
     * Performs PBKDF2 derivation using external pbkdf2 library.
     * Provides good performance with wide compatibility.
     *
     * @private
     * @param password - Input password
     * @param salt - Cryptographic salt
     * @param iterations - Iteration count
     * @param keyLength - Output key length
     * @param hashFunction - Hash function to use
     * @returns Derived key as Uint8Array
     */
    private static deriveWithLibrary(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number,
        hashFunction: KeyDerivationHashFunction
    ): Uint8Array {
        const pbkdf2Lib = require("pbkdf2");
        const digest =
            hashFunction === KeyDerivationHashFunction.SHA512
                ? "sha512"
                : "sha256";

        const result = pbkdf2Lib.pbkdf2Sync(
            Buffer.from(password),
            Buffer.from(salt),
            iterations,
            keyLength,
            digest
        );

        return new Uint8Array(result);
    }

    /**
     * Creates a successful result object with metrics.
     *
     * @private
     * @param key - Derived key
     * @param backend - Backend used
     * @param startTime - Operation start time
     * @param iterations - Iteration count used
     * @param keyLength - Key length generated
     * @returns Complete result object
     */
    private static createSuccessResult(
        key: Uint8Array,
        backend: AlgorithmBackend,
        startTime: number,
        iterations: number,
        keyLength: number
    ) {
        const executionTime = performance.now() - startTime;
        const metrics: KeyDerivationMetrics = {
            algorithm:  KeyDerivationAlgorithm.PBKDF2,
            backend,
            executionTime,
            memoryUsage: PerformanceUtils.estimateMemoryUsage(key),
            iterations,
            keyLength,
            success: true,
            timestamp: Date.now(),
        };

        keyLogger.logMetrics(metrics);
        return { key, backend, metrics };
    }

    /**
     * Creates error metrics for failed operations.
     *
     * @private
     * @param startTime - Operation start time
     * @param iterations - Attempted iteration count
     * @param keyLength - Attempted key length
     * @param error - Error message
     * @returns Error metrics object
     */
    private static createErrorMetrics(
        startTime: number,
        iterations: number,
        keyLength: number,
        error: string
    ): KeyDerivationMetrics {
        return {
            algorithm: KeyDerivationAlgorithm.PBKDF2,
            backend: AlgorithmBackend.PURE_JS, // Default for error case
            executionTime: performance.now() - startTime,
            memoryUsage: 0,
            iterations,
            keyLength,
            success: false,
            errorMessage: error,
            timestamp: Date.now(),
        };
    }
}
