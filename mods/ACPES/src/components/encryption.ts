/**
 * Encryption and decryption utilities for ACPES
 */

import CryptoJS from "crypto-js";

/**
 * Encryption utility class
 */
export class EncryptionUtils {
    /**
     * Generates an encryption key based on device fingerprint
     */
    public static generateEncryptionKey(deviceFingerprint: string): string {
        const baseKey = [
            deviceFingerprint,
            "CrossPlatform_encryption_2025",
            Date.now().toString().slice(-6),
        ].join("|");

        return CryptoJS.PBKDF2(baseKey, "salt_encryption_key", {
            keySize: 256 / 32,
            iterations: 10000,
        }).toString();
    }

    /**
     * Generates an integrity key based on device fingerprint
     */
    public static generateIntegrityKey(deviceFingerprint: string): string {
        const baseKey = [
            deviceFingerprint,
            "CrossPlatform_integrity_2025",
            Date.now().toString().slice(-6),
        ].join("|");

        return CryptoJS.PBKDF2(baseKey, "salt_integrity_key", {
            keySize: 256 / 32,
            iterations: 10000,
        }).toString();
    }

    /**
     * Hashes a key for storage
     */
    public static hashKey(key: string, service: string): string {
        return CryptoJS.SHA256(key + service).toString();
    }

    /**
     * Double encrypts text for enhanced security
     */
    public static doubleEncrypt(text: string, encryptionKey: string): string {
        const firstEncryption = CryptoJS.AES.encrypt(
            text,
            encryptionKey
        ).toString();
        const derivedKey = CryptoJS.PBKDF2(encryptionKey, "second_layer", {
            keySize: 256 / 32,
            iterations: 1000,
        }).toString();
        return CryptoJS.AES.encrypt(firstEncryption, derivedKey).toString();
    }

    /**
     * Double decrypts text
     */
    public static doubleDecrypt(
        encryptedText: string,
        encryptionKey: string
    ): string {
        try {
            const derivedKey = CryptoJS.PBKDF2(encryptionKey, "second_layer", {
                keySize: 256 / 32,
                iterations: 1000,
            }).toString();

            const firstDecryption = CryptoJS.AES.decrypt(
                encryptedText,
                derivedKey
            );

            // Safe UTF-8 conversion with error handling
            let firstDecryptedText: string;
            try {
                firstDecryptedText = firstDecryption.toString(
                    CryptoJS.enc.Utf8
                );
                if (!firstDecryptedText) {
                    throw new Error("First decryption failed - empty result");
                }
            } catch (utf8Error) {
                throw new Error(
                    `First decryption failed - malformed UTF-8 data: ${utf8Error}`
                );
            }

            const secondDecryption = CryptoJS.AES.decrypt(
                firstDecryptedText,
                encryptionKey
            );

            // Safe UTF-8 conversion with error handling
            let finalDecryptedText: string;
            try {
                finalDecryptedText = secondDecryption.toString(
                    CryptoJS.enc.Utf8
                );
                if (!finalDecryptedText) {
                    throw new Error("Second decryption failed - empty result");
                }
            } catch (utf8Error) {
                throw new Error(
                    `Second decryption failed - malformed UTF-8 data: ${utf8Error}`
                );
            }

            return finalDecryptedText;
        } catch (error) {
            throw new Error(
                `Double decryption failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Generates a checksum for data integrity
     */
    public static generateChecksum(data: string, integrityKey: string): string {
        return CryptoJS.HmacSHA256(data, integrityKey).toString();
    }

    /**
     * Verifies a checksum
     */
    public static verifyChecksum(
        data: string,
        checksum: string,
        integrityKey: string
    ): boolean {
        const computedChecksum = this.generateChecksum(data, integrityKey);
        return computedChecksum === checksum;
    }
}

