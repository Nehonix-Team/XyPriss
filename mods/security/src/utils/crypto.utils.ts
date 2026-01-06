/***************************************************************************
 * XyPrissSecurity - Ex fortify2-js is an Advanced JavaScript Security Library designed for XyPriss
 *
 * This file contains the main entry point for the XyPrissSecurity library.
 *
 * @author Nehonix
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

/**
 * Cryptographic utility class for AES-256-CBC encryption and decryption.
 *
 * This class provides secure encryption and decryption functionality using the
 * Advanced Encryption Standard (AES) with 256-bit keys in Cipher Block Chaining (CBC) mode.
 *
 * @class CryptoUtils
 * @since 0.2.14
 *
 * @security
 * - Uses AES-256-CBC, a FIPS-approved encryption algorithm
 * - Generates cryptographically secure random IVs for each encryption operation
 * - Validates all inputs before processing
 * - Requires 32-byte (256-bit) encryption keys
 *
 * @example
 * ```typescript
 * import { CryptoUtils } from './crypto.utils';
 *
 * const crypto = new CryptoUtils('your-32-character-secret-key!!');
 * const encrypted = crypto.encrypt('sensitive data');
 * const decrypted = crypto.decrypt(encrypted);
 * ```
 */

import crypto from "crypto";
import { Interface, Mod } from "reliant-type";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported encryption algorithms.
 * Currently only AES-256-CBC is supported for maximum security.
 */
export type SupportedAlgorithm = "aes-256-cbc";

/**
 * Encryption operation types for input validation.
 */
export type OperationType = "encrypt" | "decrypt";

/**
 * Schema for encryption input validation.
 */
export const encryptionSchema = Interface({
    text: "string",
    ENCRYPTION_KEY: "string(32,)",
    ALGORITHM: "string",
    IV_LENGTH: "number(16, )",
});

/**
 * Schema for decryption input validation (IV_LENGTH not required).
 */
export const decryptionSchema = Mod.omit(encryptionSchema, ["IV_LENGTH"]);

// ============================================================================
// Constants
// ============================================================================
 
/**
 * Default encryption algorithm.
 * AES-256-CBC provides strong security with good performance.
 */
export const DEFAULT_ALGORITHM = "aes-256-cbc" as const;

/**
 * Required length for AES-256 encryption keys in bytes.
 * AES-256 requires exactly 32 bytes (256 bits).
 */
export const REQUIRED_KEY_LENGTH = 32;

/**
 * Length of the Initialization Vector (IV) in bytes.
 * For AES with CBC mode, IV must be 16 bytes (128 bits).
 */
export const DEFAULT_IV_LENGTH = 16;

/**
 * Delimiter used to separate IV from encrypted data in the output string.
 */
export const IV_SEPARATOR = ":" as const;

// ============================================================================
// CryptoUtils Class
// ============================================================================

/**
 * Cryptographic utility class for AES-256-CBC encryption and decryption.
 *
 * This class provides secure encryption and decryption functionality using the
 * Advanced Encryption Standard (AES) with 256-bit keys in Cipher Block Chaining (CBC) mode.
 *
 * @class CryptoUtils
 * @since 1.0.0
 *
 * @security
 * - Uses AES-256-CBC, a FIPS-approved encryption algorithm
 * - Generates cryptographically secure random IVs for each encryption operation
 * - Validates all inputs before processing
 * - Requires 32-byte (256-bit) encryption keys
 *
 * @example
 * ```typescript
 * import { CryptoUtils } from './crypto.utils';
 *
 * const crypto = new CryptoUtils('your-32-character-secret-key!!');
 * const encrypted = crypto.encrypt('sensitive data');
 * const decrypted = crypto.decrypt(encrypted);
 * ```
 */
export class CryptoUtils {
    private readonly encryptionKey: string;
    private readonly algorithm: SupportedAlgorithm;
    private readonly ivLength: number;

    /**
     * Creates a new CryptoUtils instance.
     *
     * @param {string} [encryptionKey] - The 32-character encryption key.
     *   Defaults to process.env.ENC_SECRET_KEY if not provided.
     * @param {SupportedAlgorithm} [algorithm='aes-256-cbc'] - The encryption algorithm to use
     * @param {number} [ivLength=16] - The length of the Initialization Vector in bytes
     *
     * @throws {Error} If encryption key is not exactly 32 characters
     */
    constructor(
        encryptionKey: string = process.env.ENC_SECRET_KEY as string,
        algorithm: SupportedAlgorithm = DEFAULT_ALGORITHM,
        ivLength: number = DEFAULT_IV_LENGTH
    ) {
        this.validateEncryptionKey(encryptionKey);
        this.encryptionKey = encryptionKey;
        this.algorithm = algorithm;
        this.ivLength = ivLength;
    }

    /**
     * Validates input parameters for encryption or decryption operations.
     *
     * @private
     */
    private isValidInput(input: {
        d:
            | typeof encryptionSchema.types
            | Omit<typeof encryptionSchema.types, "IV_LENGTH">;
        t: OperationType;
    }): boolean {
        const schema =
            input.t === "encrypt" ? encryptionSchema : decryptionSchema;
        const validation = schema.safeParse(input.d);

        if (!validation.success) {
            const error = validation.errors[0];
            throw new Error(
                `Validation Error [${error.code}]: ${error.message} at path: ${error.path}`
            );
        }

        return true;
    }

    /**
     * Validates the format of encrypted text.
     *
     * @private
     */
    private validateEncryptedFormat(encryptedText: string): void {
        const parts = encryptedText.split(IV_SEPARATOR);

        if (parts.length !== 2) {
            throw new Error(
                `Invalid encrypted data format. Expected format: "IV${IV_SEPARATOR}ENCRYPTED_DATA"`
            );
        }

        const [ivHex, encryptedHex] = parts;

        if (!ivHex || !encryptedHex) {
            throw new Error("Encrypted data contains empty components");
        }

        const hexRegex = /^[0-9a-fA-F]+$/;
        if (!hexRegex.test(ivHex)) {
            throw new Error("IV component is not a valid hexadecimal string");
        }
        if (!hexRegex.test(encryptedHex)) {
            throw new Error(
                "Encrypted data component is not a valid hexadecimal string"
            );
        }

        if (ivHex.length !== DEFAULT_IV_LENGTH * 2) {
            throw new Error(
                `Invalid IV length. Expected ${
                    DEFAULT_IV_LENGTH * 2
                } hex characters, got ${ivHex.length}`
            );
        }
    }

    /**
     * Securely checks if an encryption key is valid.
     *
     * @private
     */
    private validateEncryptionKey(
        key: string | undefined
    ): asserts key is string {
        if (!key) {
            throw new Error(
                "Encryption key is required. Please provide a valid 32-character key."
            );
        }

        if (key.length !== REQUIRED_KEY_LENGTH) {
            throw new Error(
                `Encryption key must be exactly ${REQUIRED_KEY_LENGTH} characters long. ` +
                    `Received: ${key.length} characters`
            );
        }
    }

    /**
     * Encrypts plaintext data using AES-256-CBC encryption.
     *
     * @public
     * @param {string} text - The plaintext string to encrypt
     *
     * @returns {string} The encrypted data in format "IV:ENCRYPTED_DATA"
     *
     * @throws {Error} If validation fails or encryption operation encounters an error
     *
     * @example
     * ```typescript
     * const crypto = new CryptoUtils('my-32-character-key-here!!!!');
     * const encrypted = crypto.encrypt('sensitive data');
     * ```
     */
    public encrypt(text: string): string {
        this.isValidInput({
            d: {
                ALGORITHM: this.algorithm,
                ENCRYPTION_KEY: this.encryptionKey,
                IV_LENGTH: this.ivLength,
                text,
            },
            t: "encrypt",
        });

        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(
                this.algorithm,
                Buffer.from(this.encryptionKey),
                iv
            );

            let encrypted = cipher.update(text, "utf8", "hex");
            encrypted += cipher.final("hex");

            return `${iv.toString("hex")}${IV_SEPARATOR}${encrypted}`;
        } catch (error) {
            throw new Error(
                `Encryption failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Decrypts data that was encrypted using the encrypt method.
     *
     * @public
     * @param {string} encryptedText - The encrypted string in format "IV:ENCRYPTED_DATA"
     *
     * @returns {string} The decrypted plaintext string
     *
     * @throws {Error} If validation fails or decryption operation encounters an error
     *
     * @example
     * ```typescript
     * const crypto = new CryptoUtils('my-32-character-key-here!!!!');
     * const decrypted = crypto.decrypt(encryptedText);
     * ```
     */
    public decrypt(encryptedText: string): string {
        this.isValidInput({
            d: {
                text: encryptedText,
                ENCRYPTION_KEY: this.encryptionKey,
                ALGORITHM: this.algorithm,
            },
            t: "decrypt",
        });

        this.validateEncryptedFormat(encryptedText);

        try {
            const parts = encryptedText.split(IV_SEPARATOR);
            const [ivHex, encryptedHex] = parts as [string, string];

            const iv = Buffer.from(ivHex, "hex");
            const encrypted = encryptedHex;

            const decipher = crypto.createDecipheriv(
                this.algorithm,
                Buffer.from(this.encryptionKey),
                iv
            );

            let decrypted = decipher.update(encrypted, "hex", "utf8");
            decrypted += decipher.final("utf8");

            return decrypted;
        } catch (error) {
            throw new Error(
                `Decryption failed: ${
                    error instanceof Error ? error.message : String(error)
                }. ` +
                    `This may indicate incorrect key, corrupted data, or data tampering.`
            );
        }
    }

    /**
     * Generates a cryptographically secure random encryption key.
     *
     * @public
     * @static
     * @returns {string} A 32-character hexadecimal string
     *
     * @example
     * ```typescript
     * const newKey = CryptoUtils.generateEncryptionKey();
     * const crypto = new CryptoUtils(newKey);
     * ```
     */
    public static generateEncryptionKey(): string {
        return crypto.randomBytes(REQUIRED_KEY_LENGTH / 2).toString("hex");
    }

    /**
     * Type guard to check if a string is a valid encrypted text format.
     *
     * @public
     * @static
     * @param {string} text - The text to check
     * @returns {boolean} True if the text appears to be in valid encrypted format
     *
     * @example
     * ```typescript
     * if (CryptoUtils.isEncryptedFormat(text)) {
     *   const decrypted = crypto.decrypt(text);
     * }
     * ```
     */
    public static isEncryptedFormat(text: string): boolean {
        try {
            const parts = text.split(IV_SEPARATOR);

            if (parts.length !== 2) {
                return false;
            }

            const [ivHex, encryptedHex] = parts;

            if (!ivHex || !encryptedHex) {
                return false;
            }

            const hexRegex = /^[0-9a-fA-F]+$/;
            if (!hexRegex.test(ivHex) || !hexRegex.test(encryptedHex)) {
                return false;
            }

            if (ivHex.length !== DEFAULT_IV_LENGTH * 2) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Gets the current encryption key.
     *
     * @public
     * @returns {string} The encryption key
     */
    public getEncryptionKey(): string {
        return this.encryptionKey;
    }

    /**
     * Gets the current algorithm.
     *
     * @public
     * @returns {SupportedAlgorithm} The encryption algorithm
     */
    public getAlgorithm(): SupportedAlgorithm {
        return this.algorithm;
    }

    /**
     * Gets the current IV length.
     *
     * @public
     * @returns {number} The IV length in bytes
     */
    public getIvLength(): number {
        return this.ivLength;
    }
}

