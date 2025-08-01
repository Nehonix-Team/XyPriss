import { keyLogger } from "../../keys-logger";
import {
    AlgorithmBackend,
    KeyDerivationAlgorithm,
    KeyDerivationHashFunction,
    KeyDerivationMetrics,
} from "../../keys-types";
import * as crypto from "crypto";
import { PBKDF2Algo } from "./PBKDF2Algo";
import { PerformanceUtils } from "../../keys-utils";

/**
 * Scrypt key derivation algorithm implementation with multiple backend support.
 *
 * This class provides a robust Scrypt implementation that automatically selects
 * the best available backend for optimal performance:
 * 1. Node.js crypto (fastest, native implementation)
 * 2. scrypt-js library (JavaScript implementation)
 * 3. PBKDF2 fallback (when Scrypt is unavailable)
 *
 * @example
 * ```typescript
 * const password = new TextEncoder().encode('mypassword');
 * const salt = crypto.randomBytes(32);
 * const result = await ScryptAlgo.derive(password, salt, 14, 32);
 * console.log('Derived key:', result.key);
 * console.log('Backend used:', result.backend);
 * ```
 */
export class ScryptAlgo {
    /**
     * Derives a key using the Scrypt algorithm with automatic backend selection.
     *
     * This method automatically selects the most appropriate backend based on
     * the runtime environment and available libraries. It provides comprehensive
     * metrics and error handling for production use.
     *
     * @param password - The password to derive the key from
     * @param salt - Cryptographic salt (should be at least 16 bytes)
     * @param cost - Cost parameter (N = 2^cost). Recommended: 14-20 for production
     * @param keyLength - Desired length of the derived key in bytes
     * @returns Promise containing the derived key, backend used, and performance metrics
     *
     * @throws {Error} When all backends fail or invalid parameters are provided
     *
     * @example
     * ```typescript
     * // High security (slow)
     * const highSec = await ScryptAlgo.derive(password, salt, 16, 32);
     *
     * // Balanced (recommended)
     * const balanced = await ScryptAlgo.derive(password, salt, 14, 32);
     *
     * // Fast (for testing only)
     * const fast = await ScryptAlgo.derive(password, salt, 10, 32);
     * ```
     */
    public static async asyncDerive(
        password: Uint8Array,
        salt: Uint8Array,
        cost: number,
        keyLength: number
    ): Promise<{
        key: Uint8Array;
        backend: AlgorithmBackend;
        metrics: KeyDerivationMetrics;
    }> {
        // Input validation
        this.validateInputs(password, salt, cost, keyLength);

        const startTime = performance.now();
        const N = Math.pow(2, cost);
        const r = 8; // Standard block size factor
        const p = 1; // Standard parallelization factor

        let backend: AlgorithmBackend;
        let key: Uint8Array;
        let error: string | undefined;

        try {
            // Primary: Node.js crypto (fastest, native implementation)
            if (this.canUseNodeCrypto()) {
                key = await this.deriveWithNodeCrypto(
                    password,
                    salt,
                    N,
                    r,
                    p,
                    keyLength
                );
                backend = AlgorithmBackend.NODE_CRYPTO;
                keyLogger.debug("Scrypt", "Using Node.js crypto backend", {
                    N,
                    r,
                    p,
                    keyLength,
                });
            }
            // Secondary: scrypt-js library (JavaScript implementation)
            else if (await this.canUseScryptLibrary()) {
                key = await this.deriveWithLibrary(
                    password,
                    salt,
                    N,
                    r,
                    p,
                    keyLength
                );
                backend = AlgorithmBackend.EXTERNAL_LIBRARY;
                keyLogger.debug("Scrypt", "Using scrypt-js library", {
                    N,
                    r,
                    p,
                    keyLength,
                });
            }
            // Fallback: PBKDF2 with equivalent security parameters
            else {
                keyLogger.warn(
                    "Scrypt",
                    "Scrypt unavailable, using PBKDF2 fallback"
                );
                const equivalentIterations =
                    this.calculateEquivalentPBKDF2Iterations(N, r, p);
                const pbkdf2Result = await PBKDF2Algo.derive(
                    password,
                    salt,
                    equivalentIterations,
                    keyLength,
                    KeyDerivationHashFunction.SHA512
                );
                backend = AlgorithmBackend.PURE_JS;
                key = pbkdf2Result.key;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown scrypt error";
            keyLogger.error("Scrypt", "Key derivation failed", {
                error,
                cost,
                keyLength,
            });
            throw new Error(`Scrypt key derivation failed: ${error}`);
        }

        const executionTime = performance.now() - startTime;
        const metrics: KeyDerivationMetrics = {
            algorithm: KeyDerivationAlgorithm.SCRYPT,
            backend,
            executionTime,
            memoryUsage: PerformanceUtils.estimateMemoryUsage(key),
            iterations: N,
            keyLength,
            success: !error,
            errorMessage: error,
            timestamp: Date.now(),
        };

        keyLogger.logMetrics(metrics);
        return { key, backend, metrics };
    }

    /**
     * Synchronous version of derive() for backward compatibility.
     *
     * **Deprecated**: Use the async version for better performance and error handling.
     * This method is provided for backward compatibility but may block the event loop.
     *
     * @param password - The password to derive the key from
     * @param salt - Cryptographic salt
     * @param cost - Cost parameter (N = 2^cost)
     * @param keyLength - Desired length of the derived key in bytes
     * @returns Object containing the derived key, backend used, and performance metrics
     *
     * @deprecated Use the async derive() method instead
     */
    public static derive(
        password: Uint8Array,
        salt: Uint8Array,
        cost: number,
        keyLength: number
    ): {
        key: Uint8Array;
        backend: AlgorithmBackend;
        metrics: KeyDerivationMetrics;
    } {
        // For backward compatibility, we'll use a synchronous approach
        // but log a deprecation warning
        keyLogger.warn(
            "Scrypt",
            "Using deprecated synchronous derive method. Consider upgrading to async version."
        );

        this.validateInputs(password, salt, cost, keyLength);

        const startTime = performance.now();
        const N = Math.pow(2, cost);
        const r = 8;
        const p = 1;

        let backend: AlgorithmBackend;
        let key: Uint8Array;
        let error: string | undefined;

        try {
            if (this.canUseNodeCrypto()) {
                const result = crypto.scryptSync(
                    Buffer.from(password),
                    Buffer.from(salt),
                    keyLength,
                    { N, r, p }
                );
                backend = AlgorithmBackend.NODE_CRYPTO;
                key = new Uint8Array(result);
            } else {
                // Fallback to PBKDF2 for sync operation
                keyLogger.warn(
                    "Scrypt",
                    "Node crypto unavailable, using PBKDF2 fallback"
                );
                const equivalentIterations =
                    this.calculateEquivalentPBKDF2Iterations(N, r, p);
                const pbkdf2Result = PBKDF2Algo.derive(
                    password,
                    salt,
                    equivalentIterations,
                    keyLength,
                    KeyDerivationHashFunction.SHA512
                );
                backend = AlgorithmBackend.PURE_JS;
                key = pbkdf2Result.key;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            throw new Error(`Scrypt key derivation failed: ${error}`);
        }

        const executionTime = performance.now() - startTime;
        const metrics: KeyDerivationMetrics = {
            algorithm: KeyDerivationAlgorithm.SCRYPT,
            backend,
            executionTime,
            memoryUsage: PerformanceUtils.estimateMemoryUsage(key),
            iterations: N,
            keyLength,
            success: !error,
            errorMessage: error,
            timestamp: Date.now(),
        };

        keyLogger.logMetrics(metrics);
        return { key, backend, metrics };
    }

    /**
     * Validates input parameters for the Scrypt algorithm.
     *
     * @private
     * @param password - Password to validate
     * @param salt - Salt to validate
     * @param cost - Cost parameter to validate
     * @param keyLength - Key length to validate
     * @throws {Error} When parameters are invalid
     */
    private static validateInputs(
        password: Uint8Array,
        salt: Uint8Array,
        cost: number,
        keyLength: number
    ): void {
        if (!password || password.length === 0) {
            throw new Error("Password cannot be empty");
        }
        if (!salt || salt.length < 16) {
            throw new Error("Salt must be at least 16 bytes");
        }
        if (cost < 1 || cost > 31) {
            throw new Error("Cost parameter must be between 1 and 31");
        }
        if (keyLength < 1 || keyLength > 1024) {
            throw new Error("Key length must be between 1 and 1024 bytes");
        }
    }

    /**
     * Derives key using Node.js native crypto implementation.
     *
     * @private
     * @param password - Password bytes
     * @param salt - Salt bytes
     * @param N - Cost parameter
     * @param r - Block size factor
     * @param p - Parallelization factor
     * @param keyLength - Desired key length
     * @returns Promise resolving to derived key
     */
    private static async deriveWithNodeCrypto(
        password: Uint8Array,
        salt: Uint8Array,
        N: number,
        r: number,
        p: number,
        keyLength: number
    ): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            crypto.scrypt(
                Buffer.from(password),
                Buffer.from(salt),
                keyLength,
                { N, r, p },
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(new Uint8Array(result));
                    }
                }
            );
        });
    }

    /**
     * Derives key using the scrypt-js library.
     *
     * @private
     * @param password - Password bytes
     * @param salt - Salt bytes
     * @param N - Cost parameter
     * @param r - Block size factor
     * @param p - Parallelization factor
     * @param keyLength - Desired key length
     * @returns Promise resolving to derived key
     */
    private static async deriveWithLibrary(
        password: Uint8Array,
        salt: Uint8Array,
        N: number,
        r: number,
        p: number,
        keyLength: number
    ): Promise<Uint8Array> {
        const scryptJs = await import("scrypt-js");
        return scryptJs.scrypt(password, salt, N, r, p, keyLength);
    }

    /**
     * Calculates equivalent PBKDF2 iterations for similar security level.
     *
     * This is an approximation based on computational complexity analysis.
     * The actual security depends on many factors including hardware characteristics.
     *
     * @private
     * @param N - Scrypt cost parameter
     * @param r - Scrypt block size factor
     * @param p - Scrypt parallelization factor
     * @returns Equivalent PBKDF2 iteration count
     */
    private static calculateEquivalentPBKDF2Iterations(
        N: number,
        r: number,
        p: number
    ): number {
        // Conservative approximation: Scrypt's memory-hard property makes it
        // roughly equivalent to PBKDF2 with significantly more iterations
        const baseIterations = N * r * p;
        const securityMultiplier = 10; // Conservative estimate
        return Math.min(1000000, baseIterations * securityMultiplier);
    }

    /**
     * Checks if Node.js crypto scrypt is available.
     *
     * @private
     * @returns True if Node.js crypto scrypt is available
     */
    private static canUseNodeCrypto(): boolean {
        try {
            return (
                typeof crypto !== "undefined" &&
                typeof crypto.scrypt === "function" &&
                typeof crypto.scryptSync === "function"
            );
        } catch {
            return false;
        }
    }

    /**
     * Checks if scrypt-js library is available.
     *
     * @private
     * @returns Promise resolving to true if scrypt-js is available
     */
    private static async canUseScryptLibrary(): Promise<boolean> {
        try {
            await import("scrypt-js");
            return true;
        } catch {
            return false;
        }
    }
}
