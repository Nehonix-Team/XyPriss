/**
 * Cryptographic Operations Module
 * Handles hashing, HMAC, and key derivation for SecureString
 */

import * as crypto from "crypto";
import { ALGORITHM_REGISTRY } from "../../../algorithms/registry";
import { CryptoAlgorithmUtils } from "../../../utils/CryptoAlgorithmUtils";
import type {
    HashAlgorithm,
    HashOutputFormat,
    HMACAlgorithm,
    HMACOptions,
    PBKDF2Options,
    AlgorithmInfo,
    CryptoAlgorithm,
} from "../../../types/string";

/**
 * Handles cryptographic operations for SecureString
 */
export class CryptoOperations {
    /**
     * Creates a hash of the string content
     */
    static async hash(
        content: string,
        algorithm: HashAlgorithm = "SHA-256",
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        // Validate algorithm
        const validatedAlgorithm =
            CryptoAlgorithmUtils.validateAlgorithm(algorithm);

        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest(validatedAlgorithm, data);
        const hashArray = new Uint8Array(hashBuffer);

        return this.formatHash(hashArray, format);
    }

    /**
     * Creates an HMAC of the string content
     */
    static async hmac(
        content: string,
        options: HMACOptions,
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        const { key, algorithm } = options;

        // Validate algorithm
        if (!CryptoAlgorithmUtils.isSupported(algorithm)) {
            throw new Error(`Unsupported HMAC algorithm: ${algorithm}`);
        }

        // Prepare key
        let keyData: Uint8Array;
        if (typeof key === "string") {
            keyData = new TextEncoder().encode(key);
        } else if (this.isSecureString(key)) {
            keyData = new TextEncoder().encode((key as any).toString());
        } else {
            keyData = key as Uint8Array;
        }

        // Extract hash algorithm from HMAC algorithm
        const hashAlgorithm = algorithm.replace("HMAC-", "") as HashAlgorithm;

        // Import key
        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: hashAlgorithm },
            false,
            ["sign"]
        );

        // Sign data
        const data = new TextEncoder().encode(content);
        const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
        const signatureArray = new Uint8Array(signature);

        return this.formatHash(signatureArray, format);
    }

    /**
     * Derives a key using PBKDF2
     */
    static async deriveKeyPBKDF2(
        content: string,
        options: PBKDF2Options,
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        const { salt, iterations, keyLength, hash } = options;

        // Validate parameters
        if (iterations < 1000) {
            console.warn(
                "Warning: PBKDF2 iterations should be at least 1000 for security"
            );
        }

        // Prepare salt
        const saltData =
            typeof salt === "string" ? new TextEncoder().encode(salt) : salt;

        // Import password
        const passwordKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(content),
            "PBKDF2",
            false,
            ["deriveBits"]
        );

        // Derive key
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: saltData,
                iterations: iterations,
                hash: hash,
            },
            passwordKey,
            keyLength * 8 // Convert bytes to bits
        );

        const derivedArray = new Uint8Array(derivedBits);
        return this.formatHash(derivedArray, format);
    }

    /**
     * Derives a key using scrypt (Node.js only)
     */
    static async deriveKeyScrypt(
        content: string,
        salt: string | Uint8Array,
        keyLength: number = 32,
        options: {
            N?: number; // CPU/memory cost parameter
            r?: number; // Block size parameter
            p?: number; // Parallelization parameter
        } = {},
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        const { N = 16384, r = 8, p = 1 } = options;

        return new Promise((resolve, reject) => {
            const saltData =
                typeof salt === "string"
                    ? Buffer.from(salt, "utf8")
                    : Buffer.from(salt);

            crypto.scrypt(
                content,
                saltData,
                keyLength,
                { N, r, p },
                (err, derivedKey) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const derivedArray = new Uint8Array(derivedKey);
                    resolve(this.formatHash(derivedArray, format));
                }
            );
        });
    }

    /**
     * Derives a key using Argon2 (with fallback to PBKDF2)
     */
    static async deriveKeyArgon2(
        content: string,
        salt: string | Uint8Array,
        keyLength: number = 32,
        options: {
            type?: "argon2d" | "argon2i" | "argon2id";
            memoryCost?: number;
            timeCost?: number;
            parallelism?: number;
        } = {},
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        const {
            type = "argon2id",
            memoryCost = 65536,
            timeCost = 3,
            parallelism = 1,
        } = options;

        // Try to use Argon2 library if available
        try {
            // Check if argon2 is available (common library names)
            let argon2: any;
            try {
                argon2 = require("argon2");
            } catch {
                try {
                    argon2 = require("@node-rs/argon2");
                } catch {
                    try {
                        argon2 = require("argon2-browser");
                    } catch {
                        // No Argon2 library found, fall back to PBKDF2
                        console.warn(
                            "Argon2 library not found, falling back to PBKDF2"
                        );
                        return this.deriveKeyPBKDF2(
                            content,
                            {
                                salt,
                                iterations: 100000,
                                keyLength,
                                hash: "SHA-256",
                            },
                            format
                        );
                    }
                }
            }

            // Use the Argon2 library
            const saltBuffer =
                typeof salt === "string"
                    ? Buffer.from(salt, "utf8")
                    : Buffer.from(salt);

            let hashResult: Buffer;

            if (argon2.hash) {
                // Standard argon2 library
                const hashOptions = {
                    type: argon2[type.toUpperCase()] || argon2.argon2id,
                    memoryCost,
                    timeCost,
                    parallelism,
                    hashLength: keyLength,
                    salt: saltBuffer,
                    raw: true,
                };

                hashResult = await argon2.hash(content, hashOptions);
            } else if (argon2.argon2id || argon2.argon2i || argon2.argon2d) {
                // @node-rs/argon2 library
                const hashFunction = argon2[type] || argon2.argon2id;
                hashResult = await hashFunction(
                    Buffer.from(content, "utf8"),
                    saltBuffer,
                    {
                        memoryCost,
                        timeCost,
                        parallelism,
                        outputLen: keyLength,
                    }
                );
            } else {
                // Fallback to PBKDF2 if Argon2 interface is not recognized
                console.warn(
                    "Unrecognized Argon2 library interface, falling back to PBKDF2"
                );
                return this.deriveKeyPBKDF2(
                    content,
                    {
                        salt,
                        iterations: 100000,
                        keyLength,
                        hash: "SHA-256",
                    },
                    format
                );
            }

            const derivedArray = new Uint8Array(hashResult);
            return this.formatHash(derivedArray, format);
        } catch (error) {
            // If Argon2 fails for any reason, fall back to PBKDF2
            console.warn(
                "Argon2 operation failed, falling back to PBKDF2:",
                error
            );
            return this.deriveKeyPBKDF2(
                content,
                {
                    salt,
                    iterations: 100000,
                    keyLength,
                    hash: "SHA-256",
                },
                format
            );
        }
    }

    /**
     * Generates a cryptographically secure salt
     */
    static generateSalt(length: number = 32): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Generates a cryptographically secure salt as hex string
     */
    static generateSaltHex(length: number = 32): string {
        const salt = this.generateSalt(length);
        return this.formatHash(salt, "hex") as string;
    }

    /**
     * Generates a cryptographically secure salt as base64 string
     */
    static generateSaltBase64(length: number = 32): string {
        const salt = this.generateSalt(length);
        return this.formatHash(salt, "base64") as string;
    }

    /**
     * Formats hash output according to specified format
     */
    private static formatHash(
        hashArray: Uint8Array,
        format: HashOutputFormat
    ): string | Uint8Array {
        switch (format) {
            case "hex":
                return Array.from(hashArray)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");

            case "base64":
                return btoa(String.fromCharCode(...hashArray));

            case "base64url":
                return btoa(String.fromCharCode(...hashArray))
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=/g, "");

            case "uint8array":
                return hashArray;

            default:
                throw new Error(`Unsupported hash format: ${format}`);
        }
    }

    /**
     * Checks if a value is a SecureString instance
     */
    private static isSecureString(value: any): boolean {
        return (
            value &&
            typeof value === "object" &&
            typeof value.toString === "function"
        );
    }

    /**
     * Gets information about available algorithms
     */
    static getAlgorithmInfo(): Record<CryptoAlgorithm, AlgorithmInfo> {
        return { ...ALGORITHM_REGISTRY };
    }

    /**
     * Lists all supported hash algorithms
     */
    static getSupportedHashAlgorithms(): HashAlgorithm[] {
        return ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
    }

    /**
     * Lists all supported HMAC algorithms
     */
    static getSupportedHMACAlgorithms(): HMACAlgorithm[] {
        return ["HMAC-SHA-1", "HMAC-SHA-256", "HMAC-SHA-384", "HMAC-SHA-512"];
    }

    /**
     * Validates if an algorithm is supported
     */
    static isAlgorithmSupported(algorithm: string): boolean {
        return CryptoAlgorithmUtils.isSupported(algorithm as any);
    }

    /**
     * Gets algorithm information for a specific algorithm
     */
    static getAlgorithmDetails(
        algorithm: CryptoAlgorithm
    ): AlgorithmInfo | undefined {
        return ALGORITHM_REGISTRY[algorithm];
    }

    /**
     * Compares two hashes in constant time
     */
    static constantTimeHashCompare(hash1: string, hash2: string): boolean {
        if (hash1.length !== hash2.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < hash1.length; i++) {
            result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
        }

        return result === 0;
    }

    /**
     * Verifies a hash against content
     */
    static async verifyHash(
        content: string,
        expectedHash: string,
        algorithm: HashAlgorithm = "SHA-256",
        format: HashOutputFormat = "hex"
    ): Promise<boolean> {
        const actualHash = await this.hash(content, algorithm, format);

        if (typeof actualHash !== "string") {
            throw new Error("Hash verification requires string format");
        }

        return this.constantTimeHashCompare(actualHash, expectedHash);
    }

    /**
     * Verifies an HMAC against content
     */
    static async verifyHMAC(
        content: string,
        expectedHMAC: string,
        options: HMACOptions,
        format: HashOutputFormat = "hex"
    ): Promise<boolean> {
        const actualHMAC = await this.hmac(content, options, format);

        if (typeof actualHMAC !== "string") {
            throw new Error("HMAC verification requires string format");
        }

        return this.constantTimeHashCompare(actualHMAC, expectedHMAC);
    }
}

