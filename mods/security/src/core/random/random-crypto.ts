/**
 * Random crypto - Cryptographic utilities (IV, keys, nonces)
 */

import crypto from "crypto";
import {
    IVGenerationOptions,
    CryptoUtilityOptions,
    RandomGenerationOptions,
} from "./random-types";
import { RandomGenerators } from "./random-generators";
import { EnhancedUint8Array } from "../../helpers/Uint8Array";

export class RandomCrypto {
    /**
     * Generate secure nonce/IV for encryption
     * @param algorithm - Algorithm requiring the nonce
     * @param options - Generation options
     * @returns Nonce as Uint8Array
     */
    public static generateNonce(
        algorithm: "aes-gcm" | "chacha20-poly1305" | "aes-cbc" | "custom",
        options: {
            quantumSafe?: boolean;
            useEntropyPool?: boolean;
            customLength?: number;
        } = {}
    ): Uint8Array {
        let length: number;

        switch (algorithm) {
            case "aes-gcm":
                length = 12; // 96 bits recommended for AES-GCM
                break;
            case "chacha20-poly1305":
                length = 12; // 96 bits for ChaCha20-Poly1305
                break;
            case "aes-cbc":
                length = 16; // 128 bits for AES-CBC
                break;
            case "custom":
                length = options.customLength || 16;
                break;
            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }

        return RandomGenerators.getRandomBytes(length, options);
    }

    /**
     * Generate a secure Initialization Vector (IV) for encryption algorithms
     * @param length - Length of the IV in bytes
     * @param options - Generation options including algorithm
     * @returns Secure IV as EnhancedUint8Array
     */
    public static generateSecureIV(
        length: number,
        options: IVGenerationOptions = {}
    ): EnhancedUint8Array {
        const {
            algorithm,
            quantumSafe = false,
            useEntropyPool = true,
            validateSize = true,
        } = options;

        if (length <= 0) {
            throw new Error("IV length must be positive");
        }

        // If algorithm is specified, validate the length matches expected size
        if (algorithm && validateSize) {
            const expectedSizes: { [key: string]: number } = {
                "aes-128-cbc": 16,
                "aes-192-cbc": 16,
                "aes-256-cbc": 16,
                "aes-128-ctr": 16,
                "aes-192-ctr": 16,
                "aes-256-ctr": 16,
                "aes-128-gcm": 12,
                "aes-192-gcm": 12,
                "aes-256-gcm": 12,
                chacha20: 12,
                "chacha20-poly1305": 12,
                "des-ede3-cbc": 8,
                "blowfish-cbc": 8,
            };

            const expectedSize = expectedSizes[algorithm];
            if (expectedSize && length !== expectedSize) {
                console.warn(
                    `Warning: IV length ${length} bytes does not match recommended ${expectedSize} bytes for ${algorithm}`
                );
            }
        }

        // Generate secure random bytes for IV
        const iv = RandomGenerators.getRandomBytes(length, {
            quantumSafe,
            useEntropyPool,
        });

        return new EnhancedUint8Array(iv);
    }

    /**
     * Generate multiple IVs efficiently
     * @param count - Number of IVs to generate
     * @param length - Length of each IV
     * @param options - Generation options
     * @returns Array of IVs
     */
    public static generateSecureIVBatch(
        count: number,
        length: number,
        options: IVGenerationOptions = {}
    ): EnhancedUint8Array[] {
        if (count <= 0 || count > 1000) {
            throw new Error("Count must be between 1 and 1000");
        }

        const ivs: EnhancedUint8Array[] = [];

        // Generate all random bytes at once for efficiency
        const allBytes = RandomGenerators.getRandomBytes(
            length * count,
            options
        );

        for (let i = 0; i < count; i++) {
            const offset = i * length;
            const ivBytes = allBytes.slice(offset, offset + length);
            ivs.push(new EnhancedUint8Array(ivBytes));
        }

        return ivs;
    }

    /**
     * Generate IV for specific algorithm
     * @param algorithm - Encryption algorithm
     * @param options - Generation options
     * @returns Algorithm-specific IV
     */
    public static generateSecureIVForAlgorithm(
        algorithm: string,
        options: IVGenerationOptions = {}
    ): EnhancedUint8Array {
        const algorithmSizes: { [key: string]: number } = {
            "aes-128-cbc": 16,
            "aes-192-cbc": 16,
            "aes-256-cbc": 16,
            "aes-128-ctr": 16,
            "aes-192-ctr": 16,
            "aes-256-ctr": 16,
            "aes-128-gcm": 12,
            "aes-192-gcm": 12,
            "aes-256-gcm": 12,
            chacha20: 12,
            "chacha20-poly1305": 12,
            "des-ede3-cbc": 8,
            "blowfish-cbc": 8,
        };

        const length = algorithmSizes[algorithm.toLowerCase()];
        if (!length) {
            throw new Error(`Unsupported algorithm: ${algorithm}`);
        }

        return RandomCrypto.generateSecureIV(length, {
            ...options,
            algorithm: algorithm as any,
        });
    }

    /**
     * Generate multiple IVs for specific algorithm
     * @param count - Number of IVs to generate
     * @param algorithm - Encryption algorithm
     * @param options - Generation options
     * @returns Array of algorithm-specific IVs
     */
    public static generateSecureIVBatchForAlgorithm(
        count: number,
        algorithm: string,
        options: IVGenerationOptions = {}
    ): EnhancedUint8Array[] {
        const algorithmSizes: { [key: string]: number } = {
            "aes-128-cbc": 16,
            "aes-192-cbc": 16,
            "aes-256-cbc": 16,
            "aes-128-ctr": 16,
            "aes-192-ctr": 16,
            "aes-256-ctr": 16,
            "aes-128-gcm": 12,
            "aes-192-gcm": 12,
            "aes-256-gcm": 12,
            chacha20: 12,
            "chacha20-poly1305": 12,
            "des-ede3-cbc": 8,
            "blowfish-cbc": 8,
        };

        const length = algorithmSizes[algorithm.toLowerCase()];
        if (!length) {
            throw new Error(`Unsupported algorithm: ${algorithm}`);
        }

        return RandomCrypto.generateSecureIVBatch(count, length, {
            ...options,
            algorithm: algorithm as any,
        });
    }

    /**
     * Validate IV for algorithm
     * @param iv - IV to validate
     * @param algorithm - Target algorithm
     * @returns Validation result
     */
    public static validateIV(
        iv: Uint8Array | Buffer,
        algorithm: string
    ): {
        valid: boolean;
        expectedLength?: number;
        actualLength: number;
        message: string;
    } {
        const algorithmSizes: { [key: string]: number } = {
            "aes-128-cbc": 16,
            "aes-192-cbc": 16,
            "aes-256-cbc": 16,
            "aes-128-ctr": 16,
            "aes-192-ctr": 16,
            "aes-256-ctr": 16,
            "aes-128-gcm": 12,
            "aes-192-gcm": 12,
            "aes-256-gcm": 12,
            chacha20: 12,
            "chacha20-poly1305": 12,
            "des-ede3-cbc": 8,
            "blowfish-cbc": 8,
        };

        const expectedLength = algorithmSizes[algorithm.toLowerCase()];
        const actualLength = iv.length;

        if (!expectedLength) {
            return {
                valid: false,
                actualLength,
                message: `Unknown algorithm: ${algorithm}`,
            };
        }

        if (actualLength !== expectedLength) {
            return {
                valid: false,
                expectedLength,
                actualLength,
                message: `IV length mismatch: expected ${expectedLength} bytes, got ${actualLength} bytes`,
            };
        }

        // Check for all zeros (weak IV)
        const isAllZeros = Array.from(iv).every((byte) => byte === 0);
        if (isAllZeros) {
            return {
                valid: false,
                expectedLength,
                actualLength,
                message: "IV is all zeros (weak)",
            };
        }

        return {
            valid: true,
            expectedLength,
            actualLength,
            message: "IV is valid",
        };
    }

    /**
     * Create secure cipher with auto-generated IV
     * @param algorithm - Cipher algorithm
     * @param key - Encryption key
     * @param options - Cipher options
     * @returns Cipher and IV
     */
    public static createSecureCipheriv(
        algorithm: string,
        key: crypto.CipherKey,
        options: CryptoUtilityOptions = {}
    ): { cipher: crypto.Cipher; iv: Buffer } {
        const ivOptions: IVGenerationOptions = {
            quantumSafe: options.quantumSafe,
            useEntropyPool: options.useHardwareEntropy,
            validateSize: options.validateStrength,
        };
        const iv = RandomCrypto.generateSecureIVForAlgorithm(
            algorithm,
            ivOptions
        );
        const cipher = crypto.createCipheriv(algorithm, key, Buffer.from(iv));

        return { cipher, iv: Buffer.from(iv) };
    }

    /**
     * Create secure decipher
     * @param algorithm - Cipher algorithm
     * @param key - Decryption key
     * @param iv - Initialization vector
     * @returns Decipher
     */
    public static createSecureDecipheriv(
        algorithm: string,
        key: crypto.CipherKey,
        iv: crypto.BinaryLike
    ): crypto.Decipher {
        return crypto.createDecipheriv(algorithm, key, iv);
    }

    /**
     * Generate cryptographic key
     * @param length - Key length in bytes
     * @param options - Generation options
     * @returns Cryptographic key
     */
    public static generateCryptoKey(
        length: number,
        options: CryptoUtilityOptions = {}
    ): Buffer {
        const {
            quantumSafe = false,
            useHardwareEntropy = true,
            validateStrength = true,
        } = options;

        const keyBytes = RandomGenerators.getRandomBytes(length, {
            quantumSafe,
            useEntropyPool: useHardwareEntropy,
        });

        const key = Buffer.from(keyBytes);

        if (validateStrength) {
            RandomCrypto.validateKeyStrength(key);
        }

        return key;
    }

    /**
     * Validate key strength
     * @param key - Key to validate
     * @returns Validation result
     */
    public static validateKeyStrength(key: Buffer): {
        valid: boolean;
        strength: "weak" | "fair" | "good" | "strong";
        issues: string[];
    } {
        const issues: string[] = [];
        let strength: "weak" | "fair" | "good" | "strong" = "strong";

        // Check for all zeros
        if (key.every((byte) => byte === 0)) {
            issues.push("Key is all zeros");
            strength = "weak";
        }

        // Check for all same value
        const firstByte = key[0];
        if (key.every((byte) => byte === firstByte)) {
            issues.push("Key has no entropy");
            strength = "weak";
        }

        // Check entropy
        const uniqueBytes = new Set(key);
        const entropyRatio = uniqueBytes.size / key.length;

        if (entropyRatio < 0.1) {
            issues.push("Very low entropy");
            strength = "weak";
        } else if (entropyRatio < 0.3) {
            issues.push("Low entropy");
            strength = "fair";
        } else if (entropyRatio < 0.6) {
            strength = "good";
        }

        // Check length
        if (key.length < 16) {
            issues.push("Key too short");
            strength = "weak";
        } else if (key.length < 32) {
            if (strength === "strong") strength = "good";
        }

        return {
            valid: issues.length === 0,
            strength,
            issues,
        };
    }

    /**
     * Generate key derivation salt
     * @param length - Salt length
     * @param options - Generation options
     * @returns KDF salt
     */
    public static generateKDFSalt(
        length: number = 32,
        options: RandomGenerationOptions = {}
    ): Buffer {
        return RandomGenerators.generateSalt(length, options);
    }

    /**
     * Generate HMAC key
     * @param algorithm - HMAC algorithm
     * @param options - Generation options
     * @returns HMAC key
     */
    public static generateHMACKey(
        algorithm: string = "sha256",
        options: CryptoUtilityOptions = {}
    ): Buffer {
        // Recommended key sizes for HMAC
        const keySizes: { [key: string]: number } = {
            sha1: 20,
            sha256: 32,
            sha384: 48,
            sha512: 64,
        };

        const keySize = keySizes[algorithm.toLowerCase()] || 32;
        return RandomCrypto.generateCryptoKey(keySize, options);
    }
}
