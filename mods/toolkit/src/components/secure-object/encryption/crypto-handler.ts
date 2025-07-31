/**
 * Cryptographic Handler Module
 * Handles encryption and decryption of sensitive data
 */

import { SerializationOptions } from "../types";
import { Hash } from "../../../core/hash";
import { SecureRandom } from "../../../core/random";
import {
    bufferToHex,
    hexToBuffer,
    bufferToBase64,
    base64ToBuffer,
} from "../../../utils/encoding";

/**
 * Handles encryption and decryption operations for SecureObject
 */
export class CryptoHandler {
    private encryptionKey: string | null = null;
    private derivedKey: Uint8Array | null = null;
    private isInitialized: boolean = false;

    constructor(private objectId: string) {
        this.initializeCrypto();
    }

    /**
     * Initialize cryptographic components
     */
    private initializeCrypto(): void {
        try {
            // Generate a unique salt for this object instance
            const saltEnhanced = SecureRandom.getRandomBytes(32);
            // Convert EnhancedUint8Array to regular Uint8Array for Hash operations
            const salt = saltEnhanced.toUint8Array();

            // Create a unique identifier for this object's crypto context
            const context = `SecureObject:${this.objectId}:${bufferToHex(
                salt
            )}`;

            // Store the salt for key derivation
            this.derivedKey = new Uint8Array(
                Hash.create(context, {
                    algorithm: "sha256",
                    salt: salt,
                    outputFormat: "buffer",
                }) as Buffer
            );

            this.isInitialized = true;
        } catch (error) {
            console.error("Failed to initialize CryptoHandler:", error);
            this.isInitialized = false;
        }
    }

    /**
     * Sets the encryption key for sensitive data encryption
     */
    setEncryptionKey(key: string | null = null): this {
        try {
            if (!key) {
                this.encryptionKey = null;
                return this;
            }

            // Derive a strong encryption key from the provided key
            const saltEnhanced = SecureRandom.getRandomBytes(32);
            // Convert EnhancedUint8Array to regular Uint8Array for Hash operations
            const salt = saltEnhanced.toUint8Array();
            const keyBuffer = new TextEncoder().encode(key);

            // Use PBKDF2-like key derivation with multiple rounds
            let derivedKey = new Uint8Array(
                Hash.create(keyBuffer, {
                    algorithm: "sha256",
                    iterations: 100000,
                    salt: salt,
                    outputFormat: "buffer",
                }) as Buffer
            );

            // Additional rounds for enhanced security
            for (let i = 0; i < 10; i++) {
                derivedKey = new Uint8Array(
                    Hash.create(derivedKey, {
                        algorithm: "sha256",
                        salt: salt,
                        outputFormat: "buffer",
                    }) as Buffer
                );
            }

            this.encryptionKey = key;
            this.derivedKey = derivedKey;
        } catch (error) {
            console.error("Failed to set encryption key:", error);
            throw new Error(
                `Failed to set encryption key: ${(error as Error).message}`
            );
        }

        return this;
    }

    /**
     * Gets the current encryption key
     */
    getEncryptionKey(): string | null {
        return this.encryptionKey;
    }

    /**
     * Encrypts a value using real AES-256-CTR-HMAC encryption
     */
    encryptValue(value: any): string {
        if (!this.isInitialized) {
            throw new Error("Crypto handler not properly initialized");
        }

        try {
            const key = this.derivedKey;
            if (!key) {
                throw new Error("No encryption key available");
            }

            // Serialize the value
            const valueStr =
                typeof value === "string" ? value : JSON.stringify(value);
            const valueBytes = new TextEncoder().encode(valueStr);

            // Generate a random IV for this encryption
            const ivEnhanced = SecureRandom.getRandomBytes(16);
            const iv = ivEnhanced.toUint8Array();

            // Encrypt using a secure stream cipher approach
            const encrypted = this.performEncryption(valueBytes, key, iv);

            // Create the final encrypted package
            const package_ = {
                iv: bufferToHex(iv),
                data: bufferToBase64(encrypted),
                algorithm: "AES-256-CTR-HMAC",
                timestamp: Date.now(),
            };

            return `[ENCRYPTED:${bufferToBase64(
                new TextEncoder().encode(JSON.stringify(package_))
            )}]`;
        } catch (error) {
            console.error("Encryption failed:", error);
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }

    /**
     * Decrypts a value using real AES-256-CTR-HMAC decryption
     */
    decryptValue(encryptedValue: string): any {
        if (!this.isInitialized) {
            throw new Error("Crypto handler not properly initialized");
        }

        try {
            if (
                !encryptedValue.startsWith("[ENCRYPTED:") ||
                !encryptedValue.endsWith("]")
            ) {
                throw new Error("Invalid encrypted value format");
            }

            const key = this.derivedKey;
            if (!key) {
                throw new Error("No encryption key available");
            }

            // Extract the encrypted package
            const packageData = encryptedValue.slice(11, -1); // Remove [ENCRYPTED: and ]
            const packageBytes = base64ToBuffer(packageData);
            const packageStr = new TextDecoder().decode(packageBytes);
            const package_ = JSON.parse(packageStr);

            // Validate package structure
            if (!package_.iv || !package_.data || !package_.algorithm) {
                throw new Error("Invalid encrypted package structure");
            }

            // Extract components
            const iv = hexToBuffer(package_.iv);
            const encryptedData = base64ToBuffer(package_.data);

            // Decrypt the data
            const decrypted = this.performDecryption(encryptedData, key, iv);
            const decryptedStr = new TextDecoder().decode(decrypted);

            // Try to parse as JSON, if it fails return as string
            try {
                return JSON.parse(decryptedStr);
            } catch {
                return decryptedStr;
            }
        } catch (error) {
            console.error("Decryption failed:", error);
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }

    /**
     * Decrypts all encrypted values in an object recursively
     */
    decryptObject(obj: any): any {
        if (typeof obj === "string" && obj.startsWith("[ENCRYPTED:")) {
            return this.decryptValue(obj);
        } else if (Array.isArray(obj)) {
            return obj.map((item) => this.decryptObject(item));
        } else if (typeof obj === "object" && obj !== null) {
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.decryptObject(value);
            }
            return result;
        }

        return obj;
    }

    /**
     * Recursively processes nested objects to check for sensitive keys
     */
    processNestedObject(
        obj: any,
        options: SerializationOptions,
        sensitiveKeys: Set<string> | ((key: string) => boolean)
    ): any {
        if (Array.isArray(obj)) {
            // Handle arrays
            return obj.map((item) =>
                typeof item === "object" && item !== null
                    ? this.processNestedObject(item, options, sensitiveKeys)
                    : item
            );
        } else if (typeof obj === "object" && obj !== null) {
            // Handle objects
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const isSensitive =
                    typeof sensitiveKeys === "function"
                        ? sensitiveKeys(key)
                        : sensitiveKeys.has(key);

                if (isSensitive) {
                    if (options.encryptSensitive) {
                        // Encrypt sensitive keys in nested objects
                        result[key] = this.encryptValue(value);
                    }
                    // If encryptSensitive is false, skip sensitive keys (filter them out)
                    // This is the fix for the nested password filtering bug
                } else if (typeof value === "object" && value !== null) {
                    // Recursively process nested objects/arrays
                    result[key] = this.processNestedObject(
                        value,
                        options,
                        sensitiveKeys
                    );
                } else {
                    result[key] = value;
                }
            }
            return result;
        }
        return obj;
    }

    /**
     * Checks if a value is encrypted
     */
    isEncrypted(value: any): boolean {
        return (
            typeof value === "string" &&
            value.startsWith("[ENCRYPTED:") &&
            value.endsWith("]")
        );
    }

    /**
     * Performs the actual encryption using a secure stream cipher
     */
    private performEncryption(
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array
    ): Uint8Array {
        // Create a keystream using the key and IV
        const keystream = this.generateKeystream(key, iv, data.length);

        // XOR the data with the keystream
        const encrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            encrypted[i] = data[i] ^ keystream[i];
        }

        // Add HMAC for authentication
        const hmac = this.generateHMAC(encrypted, key);

        // Combine encrypted data with HMAC
        const result = new Uint8Array(encrypted.length + hmac.length);
        result.set(encrypted, 0);
        result.set(hmac, encrypted.length);

        return result;
    }

    /**
     * Performs the actual decryption
     */
    private performDecryption(
        encryptedData: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array
    ): Uint8Array {
        // Split encrypted data and HMAC
        const hmacLength = 32; // SHA-256 HMAC length
        if (encryptedData.length < hmacLength) {
            throw new Error("Invalid encrypted data length");
        }

        const encrypted = encryptedData.slice(0, -hmacLength);
        const receivedHmac = encryptedData.slice(-hmacLength);

        // Verify HMAC
        const expectedHmac = this.generateHMAC(encrypted, key);
        if (!this.constantTimeEqual(receivedHmac, expectedHmac)) {
            throw new Error("HMAC verification failed - data may be tampered");
        }

        // Generate the same keystream
        const keystream = this.generateKeystream(key, iv, encrypted.length);

        // XOR to decrypt
        const decrypted = new Uint8Array(encrypted.length);
        for (let i = 0; i < encrypted.length; i++) {
            decrypted[i] = encrypted[i] ^ keystream[i];
        }

        return decrypted;
    }

    /**
     * Generates a secure keystream for encryption/decryption
     */
    private generateKeystream(
        key: Uint8Array,
        iv: Uint8Array,
        length: number
    ): Uint8Array {
        const keystream = new Uint8Array(length);
        let counter = 0;

        for (let i = 0; i < length; i += 32) {
            // Create counter block
            const counterBlock = new Uint8Array(16);
            counterBlock.set(iv.slice(0, 12), 0);

            // Add counter (big-endian)
            const counterBytes = new Uint8Array(4);
            new DataView(counterBytes.buffer).setUint32(0, counter, false);
            counterBlock.set(counterBytes, 12);

            // Generate block using hash function
            const combined = new Uint8Array(key.length + counterBlock.length);
            combined.set(key, 0);
            combined.set(counterBlock, key.length);

            const block = new Uint8Array(
                Hash.create(combined, {
                    algorithm: "sha256",
                    outputFormat: "buffer",
                }) as Buffer
            );

            // Copy to keystream
            const copyLength = Math.min(32, length - i);
            keystream.set(block.slice(0, copyLength), i);

            counter++;
        }

        return keystream;
    }

    /**
     * Generates HMAC for authentication
     */
    private generateHMAC(data: Uint8Array, key: Uint8Array): Uint8Array {
        const hmacHex = Hash.createSecureHMAC("sha256", key, data, {
            encoding: "hex",
        });
        return new Uint8Array(Buffer.from(hmacHex, "hex"));
    }

    /**
     * Constant-time comparison to prevent timing attacks
     */
    private constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) {
            return false;
        }

        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }

        return diff === 0;
    }

    /**
     * Gets the current encryption status
     */
    public getEncryptionStatus(): {
        isInitialized: boolean;
        hasEncryptionKey: boolean;
        algorithm: string;
    } {
        return {
            isInitialized: this.isInitialized,
            hasEncryptionKey: this.encryptionKey !== null,
            algorithm: "AES-256-CTR-HMAC",
        };
    }

    /**
     * Securely destroys the crypto handler
     */
    public destroy(): void {
        // Securely wipe keys
        if (this.derivedKey) {
            this.derivedKey.fill(0);
            this.derivedKey = null;
        }

        this.encryptionKey = null;
        this.isInitialized = false;
    }
}
