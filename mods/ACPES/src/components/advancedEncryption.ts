/**
 * Advanced encryption layer with user-specified keys and binary encoding
 */

import { Logger } from "../../../../shared/logger";
import { FingerprintUtils } from "./fingerprint";
import CryptoJS from "crypto-js";

/**
 * Advanced encryption configuration
 */
export interface AdvancedEncryptionConfig {
    userKey?: string; // User-specified encryption key
    enableBinaryEncoding: boolean; // Convert to binary for extra obfuscation
    keyDerivationRounds: number; // PBKDF2 rounds for key strengthening
    saltLength: number; // Salt length for key derivation
}

/**
 * Advanced encryption result
 */
export interface AdvancedEncryptionResult {
    encryptedData: string; // Final encrypted data (possibly binary-encoded)
    keyFingerprint: string; // Fingerprint of the key used
    isBinaryEncoded: boolean; // Whether data is binary-encoded
    metadata: {
        algorithm: string;
        keyDerivationRounds: number;
        timestamp: number;
    };
}

/**
 * Advanced encryption utilities for second-layer security
 */
export class AdvancedEncryptionUtils {
    private static logger: Logger;
    private static defaultConfig: AdvancedEncryptionConfig = {
        enableBinaryEncoding: true,
        keyDerivationRounds: 50000, // Higher rounds for user keys
        saltLength: 32,
    };

    /**
     * Initialize the advanced encryption utilities
     */
    public static initialize(): void {
        if (!this.logger) {
            this.logger = new Logger({
                components: {
                    acpes: true,
                },
            });
        }
    }

    /**
     * Generate a secure key from user input or device fingerprint
     */
    private static generateSecureKey(userKey?: string, salt?: string): string {
        this.initialize();

        // Salt is required for consistent key generation
        if (!salt) {
            throw new Error("Salt is required for secure key generation");
        }

        if (userKey) {
            // Use user-provided key with device fingerprint as additional salt
            const deviceFingerprint =
                FingerprintUtils.generateDeviceFingerprint();
            const combinedSalt = salt + deviceFingerprint;

            const strengthenedKey = CryptoJS.PBKDF2(userKey, combinedSalt, {
                keySize: 256 / 32,
                iterations: this.defaultConfig.keyDerivationRounds,
                hasher: CryptoJS.algo.SHA512,
            });

            this.logger.debug("acpes", "Generated secure key from user input");
            return strengthenedKey.toString();
        } else {
            // Generate secure key from device fingerprint only
            const deviceFingerprint =
                FingerprintUtils.generateDeviceFingerprint();

            const secureKey = CryptoJS.PBKDF2(deviceFingerprint, salt, {
                keySize: 256 / 32,
                iterations: this.defaultConfig.keyDerivationRounds,
                hasher: CryptoJS.algo.SHA512,
            });

            this.logger.debug(
                "acpes",
                "Generated secure key from device fingerprint"
            );
            return secureKey.toString();
        }
    }

    /**
     * Convert string to safe binary representation using Base64
     */
    private static stringToBinary(str: string): string {
        // Convert to Base64 first, then to binary for extra obfuscation
        const base64 = CryptoJS.enc.Base64.stringify(
            CryptoJS.enc.Utf8.parse(str)
        );
        return base64
            .split("")
            .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
            .join("");
    }

    /**
     * Convert binary representation back to string
     */
    private static binaryToString(binary: string): string {
        try {
            const bytes = binary.match(/.{8}/g) || [];
            const base64 = bytes
                .map((byte) => String.fromCharCode(parseInt(byte, 2)))
                .join("");

            // Convert from Base64 back to original string
            return CryptoJS.enc.Base64.parse(base64).toString(
                CryptoJS.enc.Utf8
            );
        } catch (error) {
            throw new Error("Failed to decode binary data");
        }
    }

    /**
     * Apply advanced encryption with second layer
     */
    public static encrypt(
        data: string,
        config: Partial<AdvancedEncryptionConfig> = {}
    ): AdvancedEncryptionResult {
        this.initialize();

        const finalConfig = { ...this.defaultConfig, ...config };

        try {
            // Generate salt for this encryption
            const salt = CryptoJS.lib.WordArray.random(
                finalConfig.saltLength
            ).toString();

            // Generate secure key
            const secureKey = this.generateSecureKey(finalConfig.userKey, salt);

            // Create key fingerprint for verification
            const keyFingerprint = CryptoJS.SHA256(secureKey)
                .toString()
                .substring(0, 16);

            // First layer: AES-256 encryption with secure key
            const iv = CryptoJS.lib.WordArray.random(128 / 8);
            const encrypted = CryptoJS.AES.encrypt(data, secureKey, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7,
            });

            // Combine IV + salt + encrypted data
            const combinedData =
                iv.toString() + ":" + salt + ":" + encrypted.toString();

            // Second layer: Binary encoding for obfuscation
            let finalData = combinedData;
            if (finalConfig.enableBinaryEncoding) {
                finalData = this.stringToBinary(combinedData);
                this.logger.debug(
                    "acpes",
                    "Applied binary encoding to encrypted data"
                );
            }

            this.logger.info(
                "acpes",
                "Applied advanced encryption with second layer"
            );

            return {
                encryptedData: finalData,
                keyFingerprint,
                isBinaryEncoded: finalConfig.enableBinaryEncoding,
                metadata: {
                    algorithm: "AES-256-CBC + Binary",
                    keyDerivationRounds: finalConfig.keyDerivationRounds,
                    timestamp: Date.now(),
                },
            };
        } catch (error) {
            this.logger.error("acpes", "Advanced encryption failed:", error);
            throw new Error("Advanced encryption failed");
        }
    }

    /**
     * Decrypt data with advanced decryption
     */
    public static decrypt(
        encryptionResult: AdvancedEncryptionResult,
        config: Partial<AdvancedEncryptionConfig> = {}
    ): string {
        this.initialize();

        const finalConfig = { ...this.defaultConfig, ...config };

        try {
            let combinedData = encryptionResult.encryptedData;

            // First layer: Binary decoding if applied
            if (encryptionResult.isBinaryEncoded) {
                combinedData = this.binaryToString(combinedData);
                this.logger.debug("acpes", "Decoded binary data");
            }

            // Parse combined data
            const parts = combinedData.split(":");
            if (parts.length !== 3) {
                throw new Error("Invalid encrypted data format");
            }

            const [ivStr, salt, encryptedStr] = parts;

            // Regenerate the same secure key
            const secureKey = this.generateSecureKey(finalConfig.userKey, salt);

            // Verify key fingerprint
            const keyFingerprint = CryptoJS.SHA256(secureKey)
                .toString()
                .substring(0, 16);
            if (keyFingerprint !== encryptionResult.keyFingerprint) {
                this.logger.error(
                    "acpes",
                    "Key fingerprint mismatch - possible tampering"
                );
                throw new Error("Key verification failed");
            }

            // Second layer: AES decryption
            const iv = CryptoJS.enc.Hex.parse(ivStr);
            const decrypted = CryptoJS.AES.decrypt(encryptedStr, secureKey, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7,
            });

            const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);

            if (!decryptedData) {
                throw new Error(
                    "Decryption failed - invalid key or corrupted data"
                );
            }

            this.logger.info(
                "acpes",
                "Successfully decrypted advanced encrypted data"
            );
            return decryptedData;
        } catch (error) {
            this.logger.error("acpes", "Advanced decryption failed:", error);
            throw new Error("Advanced decryption failed");
        }
    }

    /**
     * Validate encryption result integrity
     */
    public static validateEncryptionResult(
        result: AdvancedEncryptionResult
    ): boolean {
        this.initialize();

        try {
            // Check required fields
            if (
                !result.encryptedData ||
                !result.keyFingerprint ||
                !result.metadata
            ) {
                return false;
            }

            // Check metadata
            if (!result.metadata.algorithm || !result.metadata.timestamp) {
                return false;
            }

            // Check if data format is valid
            if (result.isBinaryEncoded) {
                // Validate binary format
                const binaryRegex = /^[01]+$/;
                if (!binaryRegex.test(result.encryptedData)) {
                    return false;
                }
            }

            this.logger.debug("acpes", "Encryption result validation passed");
            return true;
        } catch (error) {
            this.logger.error(
                "acpes",
                "Encryption result validation failed:",
                error
            );
            return false;
        }
    }

    /**
     * Get encryption strength information
     */
    public static getEncryptionStrength(result: AdvancedEncryptionResult): {
        level: "HIGH" | "MAXIMUM";
        features: string[];
        keyDerivationRounds: number;
    } {
        const features = ["AES-256-CBC", "PBKDF2-SHA512"];

        if (result.isBinaryEncoded) {
            features.push("Binary Obfuscation");
        }

        const level =
            result.metadata.keyDerivationRounds >= 50000 ? "MAXIMUM" : "HIGH";

        return {
            level,
            features,
            keyDerivationRounds: result.metadata.keyDerivationRounds,
        };
    }
}

