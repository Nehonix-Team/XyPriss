/**
 * Hash utilities - Common utility functions for hash operations
 */

import * as crypto from "crypto";
import { HashStrength, StrengthConfiguration } from "./hash-types";
import {
    bufferToHex,
    bufferToBase64,
    bufferToBase58,
    bufferToBinary,
    bufferToBase64Url,
    bufferToString,
} from "../../utils/encoding";

export class HashUtils {
    /**
     * Format hash output in the specified format
     * @param data - Data to format
     * @param format - Output format
     * @returns Formatted output
     */
    public static formatOutput(
        data: Uint8Array | Buffer,
        format:
            | "hex"
            | "base64"
            | "base58"
            | "binary"
            | "base64url"
            | "buffer" = "hex"
    ): string | Buffer {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

        switch (format) {
            case "hex":
                return bufferToHex(buffer);
            case "base64":
                return bufferToBase64(buffer);
            case "base58":
                return bufferToBase58(buffer);
            case "binary":
                return bufferToBinary(buffer);
            case "base64url":
                return bufferToBase64Url(buffer);
            case "buffer":
                return buffer;
            default:
                return bufferToHex(buffer);
        }
    }

    /**
     * Get strength-based configuration
     * @param strength - Hash strength level
     * @returns Configuration object
     */
    public static getStrengthConfiguration(
        strength: HashStrength
    ): StrengthConfiguration {
        switch (strength) {
            case HashStrength.WEAK:
                return {
                    minIterations: 1000,
                    saltLength: 8,
                    algorithm: "sha256",
                };
            case HashStrength.FAIR:
                return {
                    minIterations: 10000,
                    saltLength: 16,
                    algorithm: "sha256",
                };
            case HashStrength.GOOD:
                return {
                    minIterations: 50000,
                    saltLength: 32,
                    algorithm: "sha512",
                };
            case HashStrength.STRONG:
                return {
                    minIterations: 100000,
                    saltLength: 64,
                    algorithm: "sha512",
                };
            case HashStrength.MILITARY:
                return {
                    minIterations: 500000,
                    saltLength: 128,
                    algorithm: "blake3",
                };
            default:
                return {
                    minIterations: 50000,
                    saltLength: 32,
                    algorithm: "sha512",
                };
        }
    }

    /**
     * Get Argon2 configuration based on strength
     * @param strength - Hash strength level
     * @returns Argon2 configuration
     */
    public static getArgon2Configuration(
        strength: HashStrength
    ): StrengthConfiguration {
        switch (strength) {
            case HashStrength.WEAK:
                return {
                    minIterations: 0,
                    saltLength: 16,
                    memoryCost: 1024, // 1 MB
                    timeCost: 1,
                    parallelism: 1,
                    hashLength: 32,
                    fallbackIterations: 10000,
                };
            case HashStrength.FAIR:
                return {
                    minIterations: 0,
                    saltLength: 16,
                    memoryCost: 4096, // 4 MB
                    timeCost: 2,
                    parallelism: 1,
                    hashLength: 32,
                    fallbackIterations: 50000,
                };
            case HashStrength.GOOD:
                return {
                    minIterations: 0,
                    saltLength: 32,
                    memoryCost: 16384, // 16 MB
                    timeCost: 3,
                    parallelism: 2,
                    hashLength: 32,
                    fallbackIterations: 100000,
                };
            case HashStrength.STRONG:
                return {
                    minIterations: 0,
                    saltLength: 64,
                    memoryCost: 32768, // 32 MB
                    timeCost: 4,
                    parallelism: 4,
                    hashLength: 64,
                    fallbackIterations: 200000,
                };
            case HashStrength.MILITARY:
                return {
                    minIterations: 0,
                    saltLength: 128,
                    memoryCost: 65536, // 64 MB
                    timeCost: 5,
                    parallelism: 8,
                    hashLength: 64,
                    fallbackIterations: 500000,
                };
            default:
                return {
                    minIterations: 0,
                    saltLength: 32,
                    memoryCost: 16384,
                    timeCost: 3,
                    parallelism: 2,
                    hashLength: 32,
                    fallbackIterations: 100000,
                };
        }
    }

    /**
     * Get scrypt configuration based on strength
     * @param strength - Hash strength level
     * @returns Scrypt configuration
     */
    public static getScryptConfiguration(strength: HashStrength): {
        N: number;
        r: number;
        p: number;
    } {
        switch (strength) {
            case HashStrength.WEAK:
                return { N: 4096, r: 4, p: 1 };
            case HashStrength.FAIR:
                return { N: 8192, r: 6, p: 1 };
            case HashStrength.GOOD:
                return { N: 16384, r: 8, p: 1 };
            case HashStrength.STRONG:
                return { N: 32768, r: 8, p: 2 };
            case HashStrength.MILITARY:
                return { N: 65536, r: 8, p: 4 };
            default:
                return { N: 16384, r: 8, p: 1 };
        }
    }

    /**
     * Perform secure memory wipe
     * @param input - Input to wipe
     * @param salt - Salt to wipe
     * @param pepper - Pepper to wipe
     */
    public static performSecureWipe(
        input: string | Buffer | Uint8Array,
        salt?: string | Buffer | Uint8Array,
        pepper?: string | Buffer | Uint8Array
    ): void {
        try {
            // Wipe input if it's a buffer
            if (Buffer.isBuffer(input)) {
                input.fill(0);
            } else if (input instanceof Uint8Array) {
                input.fill(0);
            }

            // Wipe salt if provided and is a buffer
            if (salt) {
                if (Buffer.isBuffer(salt)) {
                    salt.fill(0);
                } else if (salt instanceof Uint8Array) {
                    salt.fill(0);
                }
            }

            // Wipe pepper if provided and is a buffer
            if (pepper) {
                if (Buffer.isBuffer(pepper)) {
                    pepper.fill(0);
                } else if (pepper instanceof Uint8Array) {
                    pepper.fill(0);
                }
            }
        } catch (error) {
            console.warn("Secure wipe failed:", error);
        }
    }

    /**
     * Validate hash algorithm
     * @param algorithm - Algorithm to validate
     * @returns True if valid
     */
    public static isValidAlgorithm(algorithm: string): boolean {
        const validAlgorithms = [
            "sha256",
            "sha512",
            "sha3-256",
            "sha3-512",
            "blake3",
            "blake2b",
            "blake2s",
            "md5",
            "sha1", // Included for compatibility but not recommended
        ];
        return validAlgorithms.includes(algorithm.toLowerCase());
    }

    /**
     * Get algorithm security level
     * @param algorithm - Algorithm to check
     * @returns Security level
     */
    public static getAlgorithmSecurityLevel(
        algorithm: string
    ): "LOW" | "MEDIUM" | "HIGH" | "MILITARY" {
        const algo = algorithm.toLowerCase();

        if (["md5", "sha1"].includes(algo)) {
            return "LOW";
        } else if (["sha256"].includes(algo)) {
            return "MEDIUM";
        } else if (["sha512", "sha3-256", "sha3-512"].includes(algo)) {
            return "HIGH";
        } else if (["blake3", "blake2b", "blake2s"].includes(algo)) {
            return "MILITARY";
        }

        return "MEDIUM"; // Default
    }

    /**
     * Convert string or Uint8Array to Buffer
     * @param input - Input to convert
     * @returns Buffer
     */
    public static toBuffer(input: string | Uint8Array | Buffer): Buffer {
        if (Buffer.isBuffer(input)) {
            return input;
        } else if (input instanceof Uint8Array) {
            // Handle EnhancedUint8Array and regular Uint8Array
            if (
                "toUint8Array" in input &&
                typeof input.toUint8Array === "function"
            ) {
                // EnhancedUint8Array - use its toUint8Array method
                return Buffer.from(input.toUint8Array());
            } else {
                // Regular Uint8Array
                return Buffer.from(input);
            }
        } else {
            return Buffer.from(input, "utf8");
        }
    }

    /**
     * Generate random salt with specified length
     * @param length - Salt length in bytes
     * @returns Random salt buffer
     */
    public static generateRandomSalt(length: number): Buffer {
        return crypto.randomBytes(length);
    }

    /**
     * Combine multiple buffers securely
     * @param buffers - Buffers to combine
     * @returns Combined buffer
     */
    public static combineBuffers(buffers: Buffer[]): Buffer {
        return Buffer.concat(buffers);
    }

    /**
     * XOR two buffers of equal length
     * @param a - First buffer
     * @param b - Second buffer
     * @returns XORed result
     */
    public static xorBuffers(a: Buffer, b: Buffer): Buffer {
        if (a.length !== b.length) {
            throw new Error(
                "Buffers must be of equal length for XOR operation"
            );
        }

        const result = Buffer.alloc(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] ^ b[i];
        }
        return result;
    }
}
