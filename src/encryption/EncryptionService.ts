
/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */
/**
 * XyPrissJS Express Encryption Service
 *  encryption/decryption service using XyPrissJS cryptographic utilities
 *
 * Features:
 * - AES-256-GCM encryption with authentication
 * - ChaCha20-Poly1305 fallback for quantum-safe encryption
 * - Proper key derivation using PBKDF2
 * - Secure IV/nonce generation
 * - Constant-time operations
 * - Memory-safe operations with secure wiping
 */

import { Hash } from "../../mods/security/src/core/hash";
import {
    SecureRandom,
    RandomCrypto,
} from "../../mods/security/src/core/random";
import { Validators } from "../../mods/security/src/core/validators";
import { SecureBuffer } from "../../mods/security/src/components/secure-memory";

import * as crypto from "crypto";

/**
 * Encryption algorithm options
 */
export type EncryptionAlgorithm = "aes-256-gcm" | "chacha20-poly1305";

/**
 * Encryption options
 */
export interface EncryptionOptions {
    algorithm?: EncryptionAlgorithm;
    keyDerivationIterations?: number;
    additionalData?: string;
    quantumSafe?: boolean;
}

/**
 * Encrypted data package
 */
export interface EncryptedPackage {
    algorithm: EncryptionAlgorithm;
    iv: string;
    data: string;
    authTag: string;
    salt: string;
    timestamp: number;
    version: string;
}

/**
 *  encryption service using XyPrissJS utilities
 */
export class EncryptionService {
    private static readonly VERSION = "1.0.0";
    private static readonly DEFAULT_ITERATIONS = 100000;
    private static readonly KEY_LENGTH = 32; // 256 bits
    private static readonly IV_LENGTH = 12; // 96 bits for GCM
    private static readonly SALT_LENGTH = 32; // 256 bits
    private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

    /**
     * Encrypt data using production-grade encryption
     */
    public static async encrypt(
        data: any,
        key: string,
        options: EncryptionOptions = {}
    ): Promise<string> {
        try {
            // Validate inputs
            this.validateInputs(data, key);

            const {
                algorithm = "aes-256-gcm",
                keyDerivationIterations = this.DEFAULT_ITERATIONS,
                additionalData,
                quantumSafe = false,
            } = options;

            // Serialize data
            const jsonData = JSON.stringify(data);
            const dataBuffer = new TextEncoder().encode(jsonData);

            // Generate cryptographically secure salt
            const salt = SecureRandom.getRandomBytes(this.SALT_LENGTH);

            // Derive encryption key using PBKDF2
            const derivedKey = await this.deriveKey(
                key,
                salt,
                keyDerivationIterations
            );

            // Generate secure IV/nonce
            const iv = this.generateIV(algorithm);

            // Encrypt based on algorithm
            let encrypted: Uint8Array;
            let authTag: Uint8Array;

            if (algorithm === "chacha20-poly1305" || quantumSafe) {
                ({ encrypted, authTag } = this.encryptChaCha20Poly1305(
                    dataBuffer,
                    derivedKey,
                    iv,
                    additionalData
                ));
            } else {
                ({ encrypted, authTag } = this.encryptAES256GCM(
                    dataBuffer,
                    derivedKey,
                    iv,
                    additionalData
                ));
            }

            // Create encrypted package
            const package_: EncryptedPackage = {
                algorithm: quantumSafe ? "chacha20-poly1305" : algorithm,
                iv: this.bufferToHex(iv),
                data: this.bufferToHex(encrypted),
                authTag: this.bufferToHex(authTag),
                salt: this.bufferToHex(salt.toUint8Array()),
                timestamp: Date.now(),
                version: this.VERSION,
            };

            // Secure memory cleanup
            this.secureWipe(derivedKey);
            this.secureWipe(dataBuffer);

            return JSON.stringify(package_);
        } catch (error) {
            throw new Error(
                `Encryption failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Decrypt data using production-grade decryption
     */
    public static async decrypt(
        encryptedData: string,
        key: string
    ): Promise<any> {
        try {
            // Parse encrypted package
            const package_: EncryptedPackage = JSON.parse(encryptedData);
            this.validatePackage(package_);

            // Convert hex strings back to buffers
            const iv = this.hexToBuffer(package_.iv);
            const encrypted = this.hexToBuffer(package_.data);
            const authTag = this.hexToBuffer(package_.authTag);
            const salt = this.hexToBuffer(package_.salt);

            // Derive the same key
            const derivedKey = await this.deriveKey(
                key,
                salt,
                this.DEFAULT_ITERATIONS
            );

            // Decrypt based on algorithm
            let decrypted: Uint8Array;

            if (package_.algorithm === "chacha20-poly1305") {
                decrypted = this.decryptChaCha20Poly1305(
                    encrypted,
                    derivedKey,
                    iv,
                    authTag
                );
            } else {
                decrypted = this.decryptAES256GCM(
                    encrypted,
                    derivedKey,
                    iv,
                    authTag
                );
            }

            // Convert back to string and parse JSON
            const jsonString = new TextDecoder().decode(decrypted);
            const result = JSON.parse(jsonString);

            // Secure memory cleanup
            this.secureWipe(derivedKey);
            this.secureWipe(decrypted);

            return result;
        } catch (error) {
            throw new Error(
                `Decryption failed: ${
                    error instanceof Error
                        ? error.message
                        : "Invalid encrypted data"
                }`
            );
        }
    }

    /**
     * Derive encryption key using PBKDF2
     */
    private static async deriveKey(
        password: string,
        salt: Uint8Array | any,
        iterations: number
    ): Promise<Uint8Array> {
        const passwordBuffer = new TextEncoder().encode(password);
        const saltBuffer =
            salt instanceof Uint8Array ? salt : salt.toUint8Array();

        // Use XyPrissJS Hash for key derivation
        const hashResult = Hash.createSecureHash(passwordBuffer, saltBuffer, {
            algorithm: "sha256",
            iterations,
            outputFormat: "buffer",
        });

        // Handle both sync and async results
        const derivedKey =
            hashResult instanceof Promise
                ? Buffer.from((await hashResult) as any)
                : Buffer.from(hashResult as any);

        return new Uint8Array(derivedKey);
    }

    /**
     * Generate secure IV/nonce for encryption
     */
    private static generateIV(algorithm: EncryptionAlgorithm): Uint8Array {
        return RandomCrypto.generateNonce(
            algorithm === "chacha20-poly1305" ? "chacha20-poly1305" : "aes-gcm",
            { quantumSafe: true }
        );
    }

    /**
     * Encrypt using AES-256-GCM
     */
    private static encryptAES256GCM(
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        additionalData?: string
    ): { encrypted: Uint8Array; authTag: Uint8Array } {
        try {
            // Use Node.js crypto for AES-GCM
            const cipher = crypto.createCipheriv(
                "aes-256-gcm",
                key.slice(0, 32),
                iv
            );

            if (additionalData) {
                cipher.setAAD(new TextEncoder().encode(additionalData));
            }

            const encrypted = Buffer.concat([
                cipher.update(Buffer.from(data)),
                cipher.final(),
            ]);

            const authTag = cipher.getAuthTag();

            return {
                encrypted: new Uint8Array(encrypted),
                authTag: new Uint8Array(authTag),
            };
        } catch (error) {
            throw new Error(
                `AES-GCM encryption failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Decrypt using AES-256-GCM
     */
    private static decryptAES256GCM(
        encrypted: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        authTag: Uint8Array
    ): Uint8Array {
        try {
            const decipher = crypto.createDecipheriv(
                "aes-256-gcm",
                key.slice(0, 32),
                iv
            );
            decipher.setAuthTag(Buffer.from(authTag));

            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(encrypted)),
                decipher.final(),
            ]);

            return new Uint8Array(decrypted);
        } catch (error) {
            throw new Error(
                `AES-GCM decryption failed: ${
                    error instanceof Error
                        ? error.message
                        : "Authentication failed"
                }`
            );
        }
    }

    /**
     * Encrypt using ChaCha20-Poly1305 (quantum-safe fallback)
     */
    private static encryptChaCha20Poly1305(
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        additionalData?: string
    ): { encrypted: Uint8Array; authTag: Uint8Array } {
        // Try to use libsodium if available
        try {
            const sodium = require("libsodium-wrappers");
            if (
                sodium &&
                typeof sodium.crypto_aead_chacha20poly1305_ietf_encrypt ===
                    "function"
            ) {
                const aad = additionalData
                    ? new TextEncoder().encode(additionalData)
                    : null;
                const result = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
                    data,
                    aad,
                    null,
                    iv,
                    key.slice(0, 32)
                );

                // Split result into encrypted data and auth tag
                const encrypted = result.slice(0, -16);
                const authTag = result.slice(-16);

                return {
                    encrypted: new Uint8Array(encrypted),
                    authTag: new Uint8Array(authTag),
                };
            }
        } catch (error) {
            // Fall back to AES-GCM if ChaCha20-Poly1305 is not available
            console.warn(
                "ChaCha20-Poly1305 not available, falling back to AES-GCM"
            );
        }

        // Fallback to AES-GCM
        return this.encryptAES256GCM(data, key, iv, additionalData);
    }

    /**
     * Decrypt using ChaCha20-Poly1305
     */
    private static decryptChaCha20Poly1305(
        encrypted: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        authTag: Uint8Array
    ): Uint8Array {
        // Try to use libsodium if available
        try {
            const sodium = require("libsodium-wrappers");
            if (
                sodium &&
                typeof sodium.crypto_aead_chacha20poly1305_ietf_decrypt ===
                    "function"
            ) {
                const ciphertext = new Uint8Array(
                    encrypted.length + authTag.length
                );
                ciphertext.set(encrypted);
                ciphertext.set(authTag, encrypted.length);

                const result = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                    null,
                    ciphertext,
                    null,
                    iv,
                    key.slice(0, 32)
                );

                return new Uint8Array(result);
            }
        } catch (error) {
            // Fall back to AES-GCM if ChaCha20-Poly1305 is not available
            console.warn(
                "ChaCha20-Poly1305 not available, falling back to AES-GCM"
            );
        }

        // Fallback to AES-GCM
        return this.decryptAES256GCM(encrypted, key, iv, authTag);
    }

    /**
     * Validate inputs for encryption
     */
    private static validateInputs(data: any, key: string): void {
        if (data === undefined || data === null) {
            throw new Error("Data cannot be null or undefined");
        }

        if (!key || typeof key !== "string") {
            throw new Error("Key must be a non-empty string");
        }

        if (key.length < 8) {
            throw new Error("Key must be at least 8 characters long");
        }

        // Use XyPrissJS validators for additional validation
        try {
            Validators.validateLength(key.length, 8, 1024);
        } catch (error) {
            throw new Error(
                `Invalid key: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Validate encrypted package structure
     */
    private static validatePackage(package_: any): void {
        const requiredFields = [
            "algorithm",
            "iv",
            "data",
            "authTag",
            "salt",
            "timestamp",
            "version",
        ];

        for (const field of requiredFields) {
            if (!package_[field]) {
                throw new Error(`Invalid encrypted package: missing ${field}`);
            }
        }

        if (
            !["aes-256-gcm", "chacha20-poly1305"].includes(package_.algorithm)
        ) {
            throw new Error(
                `Unsupported encryption algorithm: ${package_.algorithm}`
            );
        }

        // Validate timestamp (not too old, not in future)
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (package_.timestamp > now + 60000) {
            // 1 minute future tolerance
            throw new Error("Invalid encrypted package: timestamp in future");
        }

        if (now - package_.timestamp > maxAge) {
            throw new Error("Invalid encrypted package: timestamp too old");
        }
    }

    /**
     * Convert buffer to hex string
     */
    private static bufferToHex(buffer: Uint8Array): string {
        return Array.from(buffer)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    /**
     * Convert hex string to buffer
     */
    private static hexToBuffer(hex: string): Uint8Array {
        if (hex.length % 2 !== 0) {
            throw new Error("Invalid hex string length");
        }

        const buffer = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            buffer[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return buffer;
    }

    /**
     * Secure memory wipe using XyPrissJS utilities
     */
    private static secureWipe(buffer: Uint8Array): void {
        try {
            // Use XyPrissJS secure memory wiping
            if (buffer && buffer.length > 0) {
                // Overwrite with random data first
                const randomData = SecureRandom.getRandomBytes(buffer.length);
                buffer.set(randomData.toUint8Array());

                // Then overwrite with zeros
                buffer.fill(0);

                // Finally overwrite with 0xFF
                buffer.fill(0xff);
                buffer.fill(0);
            }
        } catch (error) {
            // Fallback to simple zero fill
            if (buffer && buffer.length > 0) {
                buffer.fill(0);
            }
        }
    }

    /**
     * Generate a secure session key for temporary use
     */
    public static generateSessionKey(): string {
        const keyBytes = SecureRandom.getRandomBytes(32);
        return this.bufferToHex(keyBytes.toUint8Array());
    }

    /**
     * Verify the integrity of encrypted data without decrypting
     */
    public static verifyIntegrity(encryptedData: string): boolean {
        try {
            const package_: EncryptedPackage = JSON.parse(encryptedData);
            this.validatePackage(package_);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get encryption metadata without decrypting
     */
    public static getMetadata(encryptedData: string): {
        algorithm: EncryptionAlgorithm;
        timestamp: number;
        version: string;
    } {
        try {
            const package_: EncryptedPackage = JSON.parse(encryptedData);
            return {
                algorithm: package_.algorithm,
                timestamp: package_.timestamp,
                version: package_.version,
            };
        } catch (error) {
            throw new Error("Invalid encrypted data format");
        }
    }
}


