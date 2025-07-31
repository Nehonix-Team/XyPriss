/***************************************************************************
 * XyPrissSecurity - Secure Array Types
 *
 * This file contains type definitions for the SecureArray modular architecture
 *
 * @author Nehonix
 *
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

import {
    SecureTokenOptions,
    HashOptions,
    KeyDerivationOptions,
    APIKeyOptions,
    SessionTokenOptions,
    MiddlewareOptions,
    CryptoStats,
    SecurityTestResult,
    PasswordStrengthResult,
    SecurityLevel,
    EncodingHashType,
    HashAlgorithm,
} from "../types";
import { SECURITY_DEFAULTS } from "../utils/constants";
import { bufferToBase32, stringToBuffer } from "../utils/encoding";
import { StatsTracker } from "../utils/stats";
import { Hash } from "./hash";
import { Keys } from "./keys";
import { SecureRandom, RandomTokens, RandomGenerationOptions } from "./random";
import { Validators } from "./validators";

// Import advanced security features
import {
    constantTimeEqual,
    secureModPow,
    faultResistantEqual,
} from "../components/side-channel";
import { argon2Derive, balloonDerive } from "../components/memory-hard";
import {
    lamportGenerateKeypair,
    lamportSign,
    lamportVerify,
    ringLweGenerateKeypair,
    ringLweEncrypt,
    ringLweDecrypt,
} from "../components/post-quantum";
import { SecureBuffer, secureWipe } from "../components/secure-memory";
import { EntropyPool } from "../components/entropy-augmentation";
import {
    createCanary,
    triggerCanary,
    createCanaryObject,
    createCanaryFunction,
} from "../components/canary-tokens";
import {
    createAttestation,
    verifyAttestation,
    createLibraryAttestation,
    verifyLibraryAttestation,
} from "../components/attestation";
import { verifyRuntimeSecurity } from "../components/runtime-verification";
import {
    secureSerialize,
    secureDeserialize,
} from "../components/secure-serialization";
import {
    TamperEvidentLogger,
    LogLevel,
} from "../components/tamper-evident-logging";
import { bufferDataConverter } from "../utils/dataConverter";
import SecureString from "../components/secure-string";
import SecureObject from "../components/secure-object";

/**
 * Main class for the XyPrissSecurity library
 */
export class XyPrissSecurity {
    /**
     * Generate a secure token with customizable options
     * @param options - Token generation options
     * @returns Secure random token
     */
    public static generateSecureToken(
        options: SecureTokenOptions = {
            entropy: "high",
        }
    ): string {
        const {
            length = SECURITY_DEFAULTS.TOKEN_LENGTH,
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = false,
            maxValidityLength = 1024,
            excludeSimilarCharacters = false,
            entropy,
        } = options;

        // Validate inputs
        Validators.validateLength(length, 1, maxValidityLength);
        Validators.validateEntropyLevel(entropy);

        // Map entropy string to SecurityLevel enum
        const securityLevel: Record<
            SecureTokenOptions["entropy"],
            SecurityLevel
        > = {
            standard: SecurityLevel.STANDARD,
            high: SecurityLevel.HIGH,
            maximum: SecurityLevel.MAXIMUM,
        };

        return RandomTokens.generateSecureToken(length, {
            includeUppercase,
            includeLowercase,
            includeNumbers,
            includeSymbols,
            excludeSimilarCharacters,
            entropyLevel: securityLevel[entropy],
        });
    }

    // PIN GENERATOR
    /**
     * Generate secure PIN
     * @param length - PIN length
     * @param options - Generation options
     * @returns Secure numeric PIN
     */
    public static generateSecurePIN(
        ...args: Parameters<(typeof RandomTokens)["generateSecurePIN"]>
    ): string {
        return RandomTokens.generateSecurePIN(...args);
    }

    /**
     * Generate recovery codes
     * @param count - Number of codes to generate
     * @param codeLength - Length of each code
     * @param options - Generation options
     * @returns Array of recovery codes
     */
    public static generateRecoveryCodes(
        ...args: Parameters<(typeof RandomTokens)["generateRecoveryCodes"]>
    ): string[] {
        return RandomTokens.generateRecoveryCodes(...args);
    }

    /**
     * Generate an API key with prefix and timestamp
     * @param options - API key generation options
     * @returns API key
     */
    public static generateAPIKey(options: APIKeyOptions | string = {}): string {
        // Handle string input (prefix)
        if (typeof options === "string") {
            options = { prefix: options };
        }

        const {
            prefix = "",
            includeTimestamp = true,
            randomPartLength = SECURITY_DEFAULTS.API_KEY_RANDOM_LENGTH,
            separator = "_",
        } = options;

        // Validate inputs
        Validators.validateLength(randomPartLength, 16, 64);

        // Generate timestamp part (8 hex characters)
        const timestamp = includeTimestamp
            ? Math.floor(Date.now() / 1000)
                  .toString(16)
                  .padStart(8, "0")
            : "";

        // Generate random part
        const randomPart = RandomTokens.generateSecureToken(randomPartLength, {
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: false,
            entropyLevel: SecurityLevel.MAXIMUM,
        });

        // Combine parts
        let apiKey = "";

        if (prefix) {
            apiKey += prefix + separator;
        }

        if (includeTimestamp) {
            apiKey += timestamp + separator;
        }

        apiKey += randomPart;

        if (options.encoding) {
            let result: string = apiKey;
            const e = bufferDataConverter(
                stringToBuffer(randomPart),
                options.encoding,
                {
                    onResult: (r) => (result = r),
                    onBuffer: (b) => (result = b as any),
                }
            );
            if (e) return e;
            return result;
        }

        return apiKey;
    }

    /**
     * Generate a JWT secret with high entropy
     * @param length - Length of the secret
     * @returns High-entropy JWT secret
     */
    public static generateJWTSecret(
        length: number = 32,
        encoding?: EncodingHashType
    ): string {
        // Validate inputs
        Validators.validateLength(length, 32, 128);

        // Generate a high-entropy secret
        const secr = RandomTokens.generateSecureToken(length, {
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: true,
            entropyLevel: SecurityLevel.MAXIMUM,
        });

        if (encoding) {
            let result: string = secr; // Initialize with default value
            const e = bufferDataConverter(stringToBuffer(secr), encoding, {
                onResult: (r) => (result = r),
                onBuffer: (b) => (result = b as any),
            });
            if (e) return e;
            return result;
        }

        return secr;
    }

    /**
     * Generate a session token with built-in signature
     * @param options - Session token options
     * @returns Session token
     */
    public static generateSessionToken(
        options: SessionTokenOptions = {}
    ): string {
        const {
            userId,
            ipAddress,
            userAgent,
            expiresIn = SECURITY_DEFAULTS.SESSION_EXPIRATION,
        } = options;

        // Generate timestamp (seconds since epoch)
        const timestamp = Math.floor(Date.now() / 1000);

        // Calculate expiration
        const expiration = timestamp + expiresIn;

        // Generate nonce
        const nonce = RandomTokens.generateSecureToken(16, {
            includeUppercase: false,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: false,
        });

        // Build data part
        let data = `exp=${expiration}`;

        if (userId) {
            data += `,uid=${userId}`;
        }

        if (ipAddress) {
            data += `,ip=${ipAddress}`;
        }

        if (userAgent) {
            // Hash the user agent to keep the token size reasonable
            const uaHash = (
                Hash.createSecureHash(userAgent, SecureRandom.generateSalt(), {
                    algorithm: "sha256",
                    outputFormat: "hex",
                }) as string
            ).substring(0, 16);

            data += `,ua=${uaHash}`;
        }

        // Generate signature
        const signatureInput = `${timestamp}.${nonce}.${data}`;
        const signature = Hash.createSecureHash(
            signatureInput,
            SecureRandom.generateSalt(),
            {
                algorithm: HashAlgorithm.SHA256,
                iterations: 1,
                outputFormat: "base64",
            }
        ) as string;

        // Combine all parts
        return `${timestamp}.${nonce}.${data}.${signature}`;
    }

    /**
     * Generate a TOTP secret for two-factor authentication
     * @returns Base32 encoded TOTP secret
     */
    public static generateTOTPSecret(): string {
        // Generate 20 bytes of random data (160 bits)
        const secretBytes = SecureRandom.getRandomBytes(20);

        // Encode as Base32 (standard for TOTP)
        return bufferToBase32(secretBytes).replace(/=/g, "");
    }

    /**
     * Create a secure hash with configurable options
     * @param input - The input to hash
     * @param options - Hashing options
     * @returns The hash in the specified format
     */
    public static secureHash(
        ...p: Parameters<typeof Hash.createSecureHash>
    ): string {
        return Hash.createSecureHash(...p) as string;
    }

    /**
     * Verify that a hash matches the expected input
     * @param input - The input to verify
     * @param hash - The hash to verify against
     * @param options - Hashing options (must match those used to create the hash)
     * @returns True if the hash matches the input
     */
    public static verifyHash(
        ...p: Parameters<typeof Hash.verifyHash>
    ): boolean {
        return Hash.verifyHash(...p);
    }

    /**
     * Derive a key from a password or other input
     * @param input - The input to derive a key from
     * @param options - Key derivation options
     * @returns The derived key as a hex string
     */
    public static deriveKey(
        input: string | Uint8Array,
        options: KeyDerivationOptions = {}
    ): string {
        return Keys.deriveKey(input, options);
    }

    /**
     * Calculate password strength with detailed analysis
     * @param password - The password to analyze
     * @returns Password strength analysis
     */
    public static calculatePasswordStrength(
        password: string
    ): PasswordStrengthResult {
        if (!password) {
            return {
                score: 0,
                feedback: ["Password is empty"],
                estimatedCrackTime: "Instant",
                analysis: {
                    length: 0,
                    entropy: 0,
                    variety: 0,
                    patterns: 100,
                },
            };
        }

        // Calculate basic metrics
        const length = password.length;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        const hasSymbols = /[^A-Za-z0-9]/.test(password);

        // Calculate character variety score (0-25)
        let varietyScore = 0;
        if (hasUppercase) varietyScore += 6.25;
        if (hasLowercase) varietyScore += 6.25;
        if (hasNumbers) varietyScore += 6.25;
        if (hasSymbols) varietyScore += 6.25;

        // Calculate length score (0-40)
        const lengthScore = Math.min(40, length * 2);

        // Check for common patterns
        const patterns = [
            /^[0-9]+$/, // All numbers
            /^[a-zA-Z]+$/, // All letters
            /^[a-z]+$/, // All lowercase
            /^[A-Z]+$/, // All uppercase
            /^(qwerty|asdfgh|zxcvbn)/i, // Keyboard patterns
            /^(password|admin|user)/i, // Common words
            /^(123|abc|xyz)/i, // Simple sequences
            /(.)\1{2,}/, // Repeated characters
        ];

        // Calculate pattern penalty (0-35)
        let patternPenalty = 0;
        for (const pattern of patterns) {
            if (pattern.test(password)) {
                patternPenalty += 5;
            }
        }

        // Calculate entropy (0-35)
        let charsetSize = 0;
        if (hasUppercase) charsetSize += 26;
        if (hasLowercase) charsetSize += 26;
        if (hasNumbers) charsetSize += 10;
        if (hasSymbols) charsetSize += 33;

        const entropy = Math.log2(Math.pow(charsetSize, length));
        const entropyScore = Math.min(35, entropy / 8);

        // Calculate final score (0-100)
        const rawScore =
            lengthScore + entropyScore + varietyScore - patternPenalty;
        const finalScore = Math.max(0, Math.min(100, rawScore));

        // Generate feedback
        const feedback = [];

        if (length < 8) {
            feedback.push("Password is too short");
        }

        if (!hasUppercase) {
            feedback.push("Add uppercase letters");
        }

        if (!hasLowercase) {
            feedback.push("Add lowercase letters");
        }

        if (!hasNumbers) {
            feedback.push("Add numbers");
        }

        if (!hasSymbols) {
            feedback.push("Add symbols");
        }

        if (patternPenalty > 10) {
            feedback.push("Avoid common patterns and sequences");
        }

        // Estimate crack time
        let estimatedCrackTime = "Instant";
        if (finalScore > 90) {
            estimatedCrackTime = "Centuries";
        } else if (finalScore > 80) {
            estimatedCrackTime = "Decades";
        } else if (finalScore > 70) {
            estimatedCrackTime = "Years";
        } else if (finalScore > 60) {
            estimatedCrackTime = "Months";
        } else if (finalScore > 50) {
            estimatedCrackTime = "Weeks";
        } else if (finalScore > 40) {
            estimatedCrackTime = "Days";
        } else if (finalScore > 30) {
            estimatedCrackTime = "Hours";
        } else if (finalScore > 20) {
            estimatedCrackTime = "Minutes";
        } else if (finalScore > 10) {
            estimatedCrackTime = "Seconds";
        }

        return {
            score: Math.round(finalScore),
            feedback: feedback.length > 0 ? feedback : ["Password is strong"],
            estimatedCrackTime,
            analysis: {
                length: lengthScore,
                entropy: entropyScore,
                variety: varietyScore,
                patterns: patternPenalty,
            },
        };
    }

    /**
     * Run security tests to validate the library's functionality
     * @returns Security test results
     */
    // public static runSecurityTests(sampleSize?: number) {
    //     return runSecurityTests({
    //         generateToken: () => XyPrissSecurity.generateSecureToken(),
    //         hashFunction: (input: string) => XyPrissSecurity.secureHash(input),
    //         sampleSize,
    //     });
    // }

    /**
     * Get cryptographic operation statistics
     * @returns Current statistics
     */
    public static getStats(): CryptoStats {
        return StatsTracker.getInstance().getStats();
    }

    /**
     * Reset statistics
     */
    public static resetStats(): void {
        StatsTracker.getInstance().resetStats();
    }

    // ===== ADVANCED SECURITY FEATURES =====

    /**
     * Perform a constant-time comparison of two strings or arrays
     * This prevents timing attacks by ensuring the comparison takes the same
     * amount of time regardless of how many characters match
     *
     * @param a - First string or array to compare
     * @param b - Second string or array to compare
     * @returns True if the inputs are equal, false otherwise
     */
    public static constantTimeEqual(
        a: string | Uint8Array,
        b: string | Uint8Array
    ): boolean {
        return constantTimeEqual(a, b);
    }

    /**
     * Derive a key using memory-hard Argon2 algorithm
     * This is more resistant to hardware-based attacks than standard PBKDF2
     *
     * @param password - Password to derive key from
     * @param options - Derivation options
     * @returns Derived key and metadata
     */
    public static deriveKeyMemoryHard(
        password: string | Uint8Array,
        options: any = {}
    ): any {
        return argon2Derive(password, options);
    }

    /**
     * Derive a key using memory-hard Balloon algorithm
     * An alternative memory-hard algorithm with different security properties
     *
     * @param password - Password to derive key from
     * @param options - Derivation options
     * @returns Derived key and metadata
     */
    public static deriveKeyBalloon(
        password: string | Uint8Array,
        options: any = {}
    ): any {
        return balloonDerive(password, options);
    }

    /**
     * Generate a post-quantum secure key pair using Lamport one-time signatures
     * This is resistant to attacks by quantum computers
     *
     * @returns Public and private key pair
     */
    public static generateQuantumResistantKeypair(): any {
        return lamportGenerateKeypair();
    }

    /**
     * Sign a message using quantum-resistant Lamport signatures
     *
     * @param message - Message to sign
     * @param privateKey - Private key
     * @returns Signature
     */
    public static quantumResistantSign(
        message: string | Uint8Array,
        privateKey: string
    ): string {
        return lamportSign(message, privateKey);
    }

    /**
     * Verify a quantum-resistant signature
     *
     * @param message - Message that was signed
     * @param signature - Signature to verify
     * @param publicKey - Public key
     * @returns True if the signature is valid
     */
    public static quantumResistantVerify(
        message: string | Uint8Array,
        signature: string,
        publicKey: string
    ): boolean {
        return lamportVerify(message, signature, publicKey);
    }

    /**
     * Create a secure buffer that automatically zeros its contents when destroyed
     *
     * @param size - Size of the buffer in bytes
     * @param fill - Optional value to fill the buffer with
     * @returns Secure buffer
     */
    public static createSecureBuffer(
        size: number,
        fill?: number
    ): SecureBuffer {
        return new SecureBuffer(size, fill);
    }

    /**
     * Create a secure string that can be explicitly cleared from memory
     *
     * @param value - Initial string value
     * @returns Secure string
     */
    public static createSecureString(value: string = ""): SecureString {
        return new SecureString(value);
    }

    /**
     * Create a secure object that can store sensitive data and be explicitly cleared
     *
     * @param initialData - Initial data
     * @returns Secure object
     */
    public static createSecureObject<T extends Record<string, any>>(
        initialData?: T
    ): SecureObject<T> {
        return new SecureObject<T>(initialData);
    }

    /**
     * Securely wipe a section of memory
     *
     * @param buffer - Buffer to wipe
     * @param start - Start position
     * @param end - End position
     */
    public static secureWipe(
        buffer: Uint8Array,
        start: number = 0,
        end: number = buffer.length
    ): void {
        secureWipe(buffer, start, end);
    }

    /**
     * Get an enhanced entropy source that collects entropy from multiple sources
     *
     * @param poolSize - Size of the entropy pool in bytes
     * @param options - Entropy collection options
     * @returns Entropy pool instance
     */
    public static getEnhancedEntropySource(
        poolSize?: number,
        options?: any
    ): EntropyPool {
        return EntropyPool.getInstance(poolSize, options);
    }

    /**
     * Create a canary token that can detect unauthorized access
     *
     * @param options - Canary options
     * @returns Canary token
     */
    public static createCanaryToken(options: any = {}): string {
        return createCanary(options);
    }

    /**
     * Create a canary object that triggers when accessed
     *
     * @param target - Object to wrap with a canary
     * @param options - Canary options
     * @returns Proxy object that triggers the canary when accessed
     */
    public static createCanaryObject<T extends object>(
        target: T,
        options: any = {}
    ): T {
        return createCanaryObject(target, options);
    }

    /**
     * Create a canary function that triggers when called
     *
     * @param fn - Function to wrap with a canary
     * @param options - Canary options
     * @returns Function that triggers the canary when called
     */
    public static createCanaryFunction<T extends Function>(
        fn: T,
        options: any = {}
    ): T {
        return createCanaryFunction(fn, options);
    }

    /**
     * Create a cryptographic attestation for data
     *
     * @param data - Data to attest
     * @param options - Attestation options
     * @returns Attestation string
     */
    public static createAttestation(
        data: string | Uint8Array | Record<string, any>,
        options: any = {}
    ): string {
        return createAttestation(data, options);
    }

    /**
     * Verify a cryptographic attestation
     *
     * @param attestation - Attestation to verify
     * @param options - Verification options
     * @returns Verification result
     */
    public static verifyAttestation(attestation: string, options: any): any {
        return verifyAttestation(attestation, options);
    }

    /**
     * Create an attestation for the library itself
     *
     * @param options - Attestation options
     * @returns Attestation string
     */
    public static createLibraryAttestation(options: any = {}): string {
        return createLibraryAttestation(options);
    }

    /**
     * Verify a library attestation
     *
     * @param attestation - Attestation to verify
     * @param options - Verification options
     * @returns Verification result
     */
    public static verifyLibraryAttestation(
        attestation: string,
        options: any
    ): any {
        return verifyLibraryAttestation(attestation, options);
    }

    /**
     * Verify the security of the runtime environment
     *
     * @param options - Verification options
     * @returns Verification result
     */
    public static verifyRuntimeSecurity(options: any = {}): any {
        return verifyRuntimeSecurity(options);
    }

    /**
     * Securely serialize data with protection against various attacks
     *
     * @param data - Data to serialize
     * @param options - Serialization options
     * @returns Serialization result
     */
    public static secureSerialize<T>(data: T, options: any = {}): any {
        return secureSerialize(data, options);
    }

    /**
     * Securely deserialize data
     *
     * @param serialized - Serialized data
     * @param options - Deserialization options
     * @returns Deserialization result
     */
    public static secureDeserialize<T>(
        serialized: any,
        options: any = {}
    ): any {
        return secureDeserialize<T>(serialized, options);
    }

    /**
     * Create a tamper-evident logger
     *
     * @param key - Secret key for hashing
     * @param storageKey - Key for storing logs in localStorage
     * @returns Tamper-evident logger
     */
    public static createTamperEvidentLogger(
        key?: string,
        storageKey?: string
    ): TamperEvidentLogger {
        return new TamperEvidentLogger(key, storageKey);
    }

    /**
     * Get log level enum for tamper-evident logging
     * @returns Log level enum
     */
    public static getLogLevel(): typeof LogLevel {
        return LogLevel;
    }

    /**
     * Perform secure modular exponentiation resistant to timing attacks
     *
     * @param base - Base value
     * @param exponent - Exponent value
     * @param modulus - Modulus value
     * @returns (base^exponent) mod modulus
     */
    public static secureModPow(
        base: bigint,
        exponent: bigint,
        modulus: bigint
    ): bigint {
        return secureModPow(base, exponent, modulus);
    }

    /**
     * Perform a fault-resistant comparison of two buffers
     * This is resistant to fault injection attacks
     *
     * @param a - First buffer to compare
     * @param b - Second buffer to compare
     * @returns True if the buffers are equal
     */
    public static faultResistantEqual(a: Uint8Array, b: Uint8Array): boolean {
        return faultResistantEqual(a, b);
    }

    /**
     * Generate a Ring-LWE key pair for post-quantum encryption
     *
     * @returns Public and private key pair
     */
    public static generateRingLweKeypair(): any {
        return ringLweGenerateKeypair();
    }

    /**
     * Encrypt data using Ring-LWE post-quantum encryption
     *
     * @param message - Message to encrypt
     * @param publicKey - Public key
     * @returns Encrypted message
     */
    public static ringLweEncrypt(
        message: string | Uint8Array,
        publicKey: string
    ): string {
        return ringLweEncrypt(message, publicKey);
    }

    /**
     * Decrypt data using Ring-LWE post-quantum encryption
     *
     * @param ciphertext - Encrypted message
     * @param privateKey - Private key
     * @returns Decrypted message
     */
    public static ringLweDecrypt(
        ciphertext: string,
        privateKey: string
    ): Uint8Array {
        return ringLweDecrypt(ciphertext, privateKey);
    }

    /**
     * Trigger a canary token
     *
     * @param token - Canary token to trigger
     * @param triggerContext - Additional context for the trigger
     * @returns True if the canary was triggered
     */
    public static triggerCanaryToken(
        token: string,
        triggerContext?: any
    ): boolean {
        return triggerCanary(token, triggerContext);
    }
}

