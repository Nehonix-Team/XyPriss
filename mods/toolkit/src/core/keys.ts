/**
 * Legacy Keys implementation for key derivation and management.
 * This class provides a backward-compatible interface for key derivation while leveraging
 * the modern, optimized key derivation infrastructure. It serves as a facade to the {@link OptimizedKeys} class,
 * simplifying interaction with cryptographic key operations and providing environment insights.
 *
 * @remarks
 * - This class ensures compatibility with legacy systems while delegating core functionality to {@link OptimizedKeys}.
 * - All methods are static, allowing direct usage without instantiation.
 * - Designed to be thread-safe and efficient by reusing a singleton instance of {@link OptimizedKeys}.
 *
 * @public
 */

import { KeyDerivationOptions } from "../types";
import { OptimizedKeys } from "./keys/index";

/**
 * ### Cryptographic Key Management
 *
 * Advanced key generation, derivation, and management utilities for
 * symmetric and asymmetric cryptographic operations.
 *
 * @example
 * ```typescript
 * import { Keys } from "xypriss-security";
 *
 * // Generate encryption key
 * const encryptionKey = Keys.generateEncryptionKey(256);
 *
 * // Derive key from password
 * const derivedKey = await Keys.deriveKey("password", "salt");
 * ```
 */
export class Keys {
    /**
     * Derives a cryptographic key from the provided input using specified options.
     * This method delegates to the optimized key derivation system, ensuring high performance
     * and adherence to cryptographic best practices.
     *
     * @param input - The input data for key derivation, either a password (string) or raw bytes (Uint8Array).
     * @param options - Optional configuration for key derivation, including algorithm, iterations, and other parameters.
     *                  If omitted, default values are applied based on the underlying {@link OptimizedKeys} implementation.
     * @returns A hexadecimal string representing the derived cryptographic key.
     *
     * @example
     * ```typescript
     * const key = Keys.deriveKey('myPassword', { algorithm: 'PBKDF2', iterations: 100000 });
     * console.log(key); // Outputs: "a1b2c3d4e5f6..."
     * ```
     *
     * @remarks
     * - Throws an invalid input error if the input format is invalid or unsupported.
     * - The output length depends on the algorithm and options specified.
     * - For security, ensure the input is securely handled to prevent leakage.
     *
     * @public
     */
    public static deriveKey(
        input: string | Uint8Array,
        options: KeyDerivationOptions = {}
    ): string {
        return OptimizedKeys.getInstance().deriveKey(input, options);
    }

    /**
     * Retrieves performance metrics for key derivation operations.
     * Offers detailed insights into the efficiency and resource usage of the underlying
     * optimized key derivation system.
     *
     * @returns An object containing performance metrics, such as derivation time (ms) and memory usage (MB).
     *
     * @example
     * ```typescript
     * const metrics = Keys.getMetrics();
     * console.log(metrics); // Outputs: { derivationTimeMs: 10, memoryUsedMb: 2.5, operationsCount: 100, ... }
     * ```
     *
     * @remarks
     * - Metrics are aggregated from the {@link OptimizedKeys} instance and may include vendor-specific data.
     * - Useful for debugging and optimizing key derivation processes in performance-critical applications.
     *
     * @public
     */
    public static getMetrics(): object {
        return OptimizedKeys.getInstance().getMetrics();
    }

    /**
     * Retrieves information about the current runtime environment.
     * Includes details about such the as platform, supported cryptographic algorithms,
     * and other environment-specific data relevant to key derivation.
     *
     * @returns An object containing environment-specific information, such as platform type and cryptographic capabilities.
     *
     * @example
     * ```typescript
     * const envInfo = Keys.getEnvironmentInfo();
     * console.log('envInfo); // Outputs: ' { platform: 'Node.js', cryptoSupport: ['PBKDF2', 'Argon2'], version: '18.x', ... }
     * ```
     *
     * @remarks
     * - The exact structure of the returned object may vary depending on the runtime environment.
     * - Useful for feature detection and compatibility checks in cross-platform applications.
     *
     * @public
     */
    public static getEnvironmentInfo(): object {
        return OptimizedKeys.getInstance().getEnvironmentInfo();
    }

    /**
     * Recommends an optimal key derivation algorithm based on the current runtime environment.
     * Evaluates the environment to suggest a secure algorithm and performant algorithm, prioritizing security.
     * security.
     *
     * @returns A string indicating the recommended key derivation algorithm (e.g., 'PBKDF2', 'Argon2').
     *
     * @example
     * ```typescript
     * const algorithm = Keys.getRecommendedAlgorithm();
     * console.log(algorithm); // Outputs: 'Argon2'
     * ```
     *
     * @remarks
     * - The recommendation is based on factors like CPU architecture, memory availability, and cryptographic library support.
     * - The recommended algorithm may differ across environments (e.g., browser vs. server).
     *
     * @public
     */
    public static getRecommendedAlgorithm(): string {
        return OptimizedKeys.getInstance().getRecommendedAlgorithm();
    }
}

