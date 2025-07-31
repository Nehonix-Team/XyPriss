/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) NEHONIX INC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 * -------------------------------------------------------------------------------------------
 */

/**
 * Hash Core - Main Hash class with modular architecture
 * This is the primary interface for all hashing operations
 */

import { EnhancedHashOptions } from "../../types";
import { HASH_SECURITY_CONSTANTS } from "../../utils/constants";
import { SecureRandom } from "../random";

// Import modular components
import { HashStrength } from "./hash-types";
import { HashUtils } from "./hash-utils";
import { HashValidator } from "./hash-validator";
import { HashAlgorithms } from "../../algorithms/hash-algorithms";
import { HashSecurity } from "./hash-security";
import { HashAdvanced } from "./hash-advanced";
import { HashEntropy } from "./hash-entropy";
import * as crypto from "crypto";
/**
 * Military-grade hashing functionality with enhanced security features
 * Modular architecture for maintainable and scalable hash operations
 */
export class Hash {
    // ============================================================================
    // PUBLIC API - Main hash functions
    // ============================================================================

    /**
     * Create secure hash with military-grade security options
     *
     * IMPORTANT: This method automatically generates a random salt
     * when no salt is provided, resulting in different hashes for the same input.
     * This is designed for password hashing where randomness enhances security.
     *
     * For consistent hashes, either:
     * - Provide a fixed salt parameter, or
     * - Use Hash.create() method instead
     *
     * @param input - The input to hash
     * @param salt - Salt for the hash (if not provided, random salt is auto-generated)
     * @param options - Enhanced hashing options
     * @returns The hash in the specified format
     */
    public static createSecureHash(
        input: string | Uint8Array,
        salt?: string | Buffer | Uint8Array,
        options: EnhancedHashOptions = {}
    ): string | Promise<string> {
        const {
            strength = HashStrength.GOOD,
            memoryHard = false,
            quantumResistant = false,
            timingSafe = false,
            validateInput = true,
            secureWipe = true,
            algorithm = "sha256",
            iterations = HASH_SECURITY_CONSTANTS.RECOMMENDED_ITERATIONS,
            pepper,
            outputFormat = "hex",
        } = options;

        // Validate input if requested
        if (validateInput) {
            HashValidator.validateHashInput(input, options);
        }

        // Generate salt if not provided
        let finalSalt = salt;
        if (!finalSalt) {
            const strengthConfig = HashUtils.getStrengthConfiguration(strength);
            finalSalt = SecureRandom.getRandomBytes(strengthConfig.saltLength);
        }

        // Prepare enhanced options
        const enhancedOptions = {
            ...options,
            algorithm,
            iterations,
            salt: finalSalt,
            pepper,
            outputFormat,
        };

        // Route to appropriate implementation based on options
        if (memoryHard) {
            return HashSecurity.memoryHardHash(input, {
                ...enhancedOptions,
                outputFormat: outputFormat === "buffer" ? "buffer" : "hex",
            }).then((result) => {
                Hash.handleSecureWipe(
                    input,
                    finalSalt,
                    pepper,
                    secureWipe,
                    result
                );
                return typeof result === "string"
                    ? result
                    : result.toString("hex");
            });
        }

        if (quantumResistant) {
            const result = HashSecurity.quantumResistantHash(input, {
                ...enhancedOptions,
                outputFormat: outputFormat as "hex" | "base64" | "buffer",
            });
            return Hash.handleSecureWipe(
                input,
                finalSalt,
                pepper,
                secureWipe,
                result
            ) as string;
        }

        if (timingSafe) {
            const result = HashSecurity.timingSafeHash(input, {
                ...enhancedOptions,
                outputFormat: outputFormat as "hex" | "base64" | "buffer",
            });
            return Hash.handleSecureWipe(
                input,
                finalSalt,
                pepper,
                secureWipe,
                result
            ) as string;
        }

        // Standard secure hash
        const result = HashAlgorithms.secureHash(input, {
            ...enhancedOptions,
            outputFormat: outputFormat as
                | "hex"
                | "base64"
                | "base58"
                | "binary"
                | "base64url"
                | "buffer",
        });
        return Hash.handleSecureWipe(
            input,
            finalSalt,
            pepper,
            secureWipe,
            result
        ) as string;
    }

    /**
     * Verify hash with secure comparison
     * @param input - Input to verify
     * @param expectedHash - Expected hash value
     * @param salt - Salt used in original hash
     * @param options - Verification options
     * @returns True if hash matches
     */
    public static verifyHash(
        input: string | Uint8Array,
        expectedHash: string | Buffer,
        salt?: string | Buffer | Uint8Array,
        options: EnhancedHashOptions = {}
    ): boolean {
        // For async operations, we need to handle them differently
        // Force synchronous verification by disabling async features
        const syncOptions = {
            ...options,
            memoryHard: false,
            timingSafe: false, // Disable timing-safe for verification to avoid async
        };

        // Generate hash using the same method as createSecureHash
        const computedHash = Hash.createSecureHash(input, salt, syncOptions);

        // Convert both hashes to the same format for comparison
        const expectedStr =
            typeof expectedHash === "string"
                ? expectedHash
                : expectedHash.toString("hex");
        const computedStr =
            typeof computedHash === "string"
                ? computedHash
                : computedHash.toString();

        // Use timing-safe comparison
        return HashValidator.timingSafeEqual(computedStr, expectedStr);
    }

    /**
     * Async verify hash with secure comparison
     * @param input - Input to verify
     * @param expectedHash - Expected hash value
     * @param salt - Salt used in original hash
     * @param options - Verification options
     * @returns Promise resolving to true if hash matches
     */
    public static async verifyHashAsync(
        input: string | Uint8Array,
        expectedHash: string | Buffer,
        salt?: string | Buffer | Uint8Array,
        options: EnhancedHashOptions = {}
    ): Promise<boolean> {
        // Generate hash using the same method as createSecureHash
        const computedHash = await Hash.createSecureHash(input, salt, options);

        // Convert both hashes to the same format for comparison
        const expectedStr =
            typeof expectedHash === "string"
                ? expectedHash
                : expectedHash.toString("hex");
        const computedStr =
            typeof computedHash === "string"
                ? computedHash
                : (computedHash as Buffer).toString("hex");

        // Use timing-safe comparison
        return HashValidator.timingSafeEqual(computedStr, expectedStr);
    }

    // ============================================================================
    // KEY DERIVATION FUNCTIONS
    // ============================================================================

    /**
     * Enhanced PBKDF2 key derivation
     */
    public static deriveKeyPBKDF2 = HashSecurity.memoryHardHash;

    /**
     * Enhanced scrypt key derivation
     */
    public static deriveKeyScrypt(
        password: string | Buffer,
        salt: string | Buffer,
        keyLength: number = 32,
        options: {
            N?: number;
            r?: number;
            p?: number;
            encoding?: "hex" | "base64" | "buffer";
            validateStrength?: boolean;
        } = {}
    ): string | Buffer {
        const {
            N = 32768,
            r = 8,
            p = 1,
            encoding = "hex",
            validateStrength = true,
        } = options;

        // Validate password strength if requested
        if (validateStrength && typeof password === "string") {
            const strength = HashValidator.validatePasswordStrength(password);
            if (!strength.isSecure) {
                console.warn("Weak password detected:", strength.issues);
            }
        }

        const passwordBuffer = HashUtils.toBuffer(password);
        const saltBuffer = HashUtils.toBuffer(salt);

        // Use Node.js scrypt
        const crypto = require("crypto");
        const derivedKey = crypto.scryptSync(
            passwordBuffer,
            saltBuffer,
            keyLength,
            {
                N,
                r,
                p,
            }
        );

        return HashUtils.formatOutput(derivedKey, encoding);
    }

    /**
     * Enhanced Argon2 key derivation
     */
    public static deriveKeyArgon2 = HashSecurity.memoryHardHash;

    /**
     * Standard PBKDF2 key derivation
     *
     * BEHAVIOR: Uses Node.js crypto.pbkdf2Sync for reliable, standard PBKDF2 implementation.
     * Produces consistent results and is widely compatible.
     * With crypto:
     * @example
     * crypto.pbkdf2Sync(
            password,
            salt,
            iterations,
            keyLength,
            hashFunction
        );
     *
     * @param password - Password to derive key from
     * @param salt - Salt for the derivation
     * @param iterations - Number of iterations (default: 100000)
     * @param keyLength - Desired key length in bytes (default: 32)
     * @param hashFunction - Hash function to use (default: "sha256")
     * @param outputFormat - Output format (default: "hex")
     * @returns PBKDF2 derived key
     */
    public static pbkdf2(
        password: string,
        salt: string,
        iterations: number = 100000,
        keyLength: number = 32,
        hashFunction: "sha256" | "sha512" = "sha256",
        outputFormat: "hex" | "base64" | "buffer" = "hex"
    ): string | Buffer {
        // const crypto = require("crypto");

        const result = crypto.pbkdf2Sync(
            password,
            salt,
            iterations,
            keyLength,
            hashFunction
        );

        switch (outputFormat) {
            case "hex":
                return result.toString("hex");
            case "base64":
                return result.toString("base64");
            case "buffer":
                return result;
            default:
                return result.toString("hex");
        }
    }

    // ============================================================================
    // ADVANCED SECURITY FEATURES
    // ============================================================================

    /**
     * Hardware Security Module (HSM) compatible hashing
     */
    public static hsmCompatibleHash = HashSecurity.hsmCompatibleHash;

    /**
     * Cryptographic agility hash
     */
    public static agilityHash = HashAdvanced.agilityHash;

    /**
     * Side-channel attack resistant hashing
     */
    public static sideChannelResistantHash =
        HashAdvanced.sideChannelResistantHash;

    /**
     * Real-time security monitoring
     */
    public static monitorHashSecurity = HashSecurity.monitorHashSecurity;

    // ============================================================================
    // ENTROPY AND ANALYSIS
    // ============================================================================

    /**
     * Analyze hash entropy
     */
    public static analyzeHashEntropy = HashEntropy.analyzeHashEntropy;

    /**
     * Generate entropy report
     */
    public static generateEntropyReport = HashEntropy.generateEntropyReport;

    /**
     * Perform randomness tests
     */
    public static performRandomnessTests = HashEntropy.performRandomnessTests;

    // ============================================================================
    // VALIDATION AND UTILITIES
    // ============================================================================

    /**
     * Validate password strength
     */
    public static validatePasswordStrength =
        HashValidator.validatePasswordStrength;

    /**
     * Timing-safe string comparison
     */
    public static timingSafeEqual = HashValidator.timingSafeEqual;

    /**
     * Validate salt quality
     */
    public static validateSalt = HashValidator.validateSalt;

    // ============================================================================
    // ADVANCED ALGORITHMS
    // ============================================================================

    /**
     * Parallel hash processing
     */
    public static parallelHash = HashAdvanced.parallelHash;

    /**
     * Streaming hash for large data
     */
    public static createStreamingHash = HashAdvanced.createStreamingHash;

    /**
     * Merkle tree hash
     */
    public static merkleTreeHash = HashAdvanced.merkleTreeHash;

    /**
     * Incremental hash
     */
    public static incrementalHash = HashAdvanced.incrementalHash;

    /**
     * Hash chain
     */
    public static hashChain = HashAdvanced.hashChain;

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Format hash output
     */
    public static formatOutput = HashUtils.formatOutput;

    /**
     * Get strength configuration
     */
    public static getStrengthConfiguration = HashUtils.getStrengthConfiguration;

    /**
     * Get algorithm security level
     */
    public static getAlgorithmSecurityLevel =
        HashUtils.getAlgorithmSecurityLevel;

    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================

    /**
     * Handle secure wipe if requested
     * IMPORTANT: Only wipe copies, not the original salt/pepper that might be needed for verification
     */
    private static handleSecureWipe(
        input: string | Uint8Array,
        salt: string | Buffer | Uint8Array,
        pepper: string | Buffer | Uint8Array | undefined,
        secureWipe: boolean,
        result: string | Buffer
    ): string | Buffer {
        if (secureWipe) {
            // Create copies for wiping to avoid destroying original data
            let inputCopy: string | Buffer | Uint8Array = input;
            let saltCopy: string | Buffer | Uint8Array | undefined = undefined;
            let pepperCopy: string | Buffer | Uint8Array | undefined =
                undefined;

            // Only create copies for buffers (strings are immutable anyway)
            if (Buffer.isBuffer(salt) || salt instanceof Uint8Array) {
                saltCopy = Buffer.from(salt);
            }
            if (
                pepper &&
                (Buffer.isBuffer(pepper) || pepper instanceof Uint8Array)
            ) {
                pepperCopy = Buffer.from(pepper);
            }
            if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
                inputCopy = Buffer.from(input);
            }

            // Wipe the copies, not the originals
            HashUtils.performSecureWipe(inputCopy, saltCopy, pepperCopy);
        }
        return result;
    }

    // ============================================================================
    // LEGACY COMPATIBILITY (for backward compatibility)
    // ============================================================================

    /**
     * Legacy secure hash method (for backward compatibility)
     *
     * BEHAVIOR: Produces consistent hashes for the same input (like CryptoJS).
     * This method does NOT auto-generate random salts, ensuring deterministic results.
     *
     * For password hashing with auto-salt generation, use Hash.createSecureHash() instead.
     */
    public static create = HashAlgorithms.secureHash;

    /**
     * Legacy HMAC creation (for backward compatibility)
     */
    public static createSecureHMAC = HashAlgorithms.createSecureHMAC;
}

