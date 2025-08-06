/**
 * Main CrossPlatformSecureStorage class
 * Orchestrates all the modular components
 */

import { Platform, PlatformModules } from "./platform";
import {
    SecureStorageOptions,
    StorageConstructorOptions,
} from "../types/options";
import { StoredData } from "../types/storage";
import { SecurityMetrics } from "../types/security";
import { PlatformInfo, PlatformType } from "../types/platform";
import { EncryptionUtils } from "../components/encryption";
import { CompressionUtils } from "../components/compression";
import { SecurityUtils } from "../components/security";
import { FingerprintUtils } from "../components/fingerprint";
import { WebStorage } from "../platforms/web";
import { MobileStorage } from "../platforms/mobile";
import { NodeStorage } from "../platforms/node";
import { FallbackStorage } from "../platforms/fallback";
import { DEFAULT_CONFIG } from "../utils/constants";
import { isVersionCompatible } from "../utils/validation";

/**
 * Cross-platform secure storage implementation
 */
export class CrossPlatformSecureStorage {
    private readonly encryptionKey: string;
    private readonly integrityKey: string;
    private readonly deviceFingerprint: string;
    private readonly nodeStoragePath: string;

    // Platform-specific storage instances
    private webStorage?: WebStorage;
    private mobileStorage?: MobileStorage;
    private nodeStorage?: NodeStorage;
    private fallbackStorage?: FallbackStorage;

    constructor(options: StorageConstructorOptions = {}) {
        // Generate device fingerprint for key derivation
        this.deviceFingerprint = FingerprintUtils.generateDeviceFingerprint();

        // Separate encryption and integrity keys
        this.encryptionKey = EncryptionUtils.generateEncryptionKey(
            this.deviceFingerprint
        );
        this.integrityKey = EncryptionUtils.generateIntegrityKey(
            this.deviceFingerprint
        );

        // Node.js storage path
        this.nodeStoragePath =
            options.nodeStoragePath ||
            (Platform.isNode && typeof process !== "undefined"
                ? process.cwd() + "/.secure-storage"
                : "");

        // Initialize platform modules synchronously as fallback
        PlatformModules.initializeSync();

        this.initializeStorage();
        this.initializeSecurity();
    }

    /**
     * Initialize platform-specific storage
     */
    private initializeStorage(): void {
        if (Platform.isWeb) {
            this.webStorage = new WebStorage();
        } else if (Platform.isMobile) {
            this.mobileStorage = new MobileStorage();
        } else if (Platform.isNode) {
            this.nodeStorage = new NodeStorage(this.nodeStoragePath);
        } else {
            this.fallbackStorage = new FallbackStorage();
        }
    }

    /**
     * Initialize security mechanisms
     */
    private async initializeSecurity(): Promise<void> {
        try {
            // Automatic cleanup of expired data on startup
            await SecurityUtils.cleanupExpiredData();

            // Cleanup corrupted data
            await SecurityUtils.cleanupCorruptedData();

            // Periodic key rotation check
            await SecurityUtils.checkKeyRotation();
        } catch (error) {
            console.error("❌ Error during security initialization:", error);
        }
    }

    /**
     * Stores a value securely across platforms
     */
    async setItem(
        key: string,
        value: string,
        options: SecureStorageOptions & { expiresIn?: number } = {}
    ): Promise<boolean> {
        try {
            // Parameter validation
            if (!key || typeof key !== "string") {
                throw new Error("Invalid key");
            }
            if (!value || typeof value !== "string") {
                throw new Error("Invalid value");
            }

            // Check if service is locked
            if (await SecurityUtils.isServiceLocked(key)) {
                console.warn(`🔒 Service temporarily locked for key: ${key}`);
                return false;
            }

            // Optional compression for large data
            let processedValue = value;
            if (options.compressionEnabled && value.length > 1000) {
                processedValue = CompressionUtils.compress(value);
            }

            const data: StoredData = {
                value: processedValue,
                timestamp: Date.now(),
                expiresAt: options.expiresIn
                    ? Date.now() + options.expiresIn * 1000
                    : undefined,
                checksum: EncryptionUtils.generateChecksum(
                    processedValue,
                    this.integrityKey
                ),
                version: DEFAULT_CONFIG.VERSION,
                attempts: 0,
                lastAccess: Date.now(),
            };

            const serializedData = JSON.stringify(data);
            const encryptedData = EncryptionUtils.doubleEncrypt(
                serializedData,
                this.encryptionKey
            );
            const hashedKey = EncryptionUtils.hashKey(
                key,
                DEFAULT_CONFIG.DEFAULT_SERVICE
            );

            // Platform-specific storage
            const success = await this.getStorageInstance().setItem(
                hashedKey,
                encryptedData,
                options
            );

            if (success) {
                await SecurityUtils.recordSuccessfulAttempt(key);
            } else {
                await SecurityUtils.recordFailedAttempt(key, "write");
            }

            return success;
        } catch (error) {
            console.error("❌ Error during secure storage:", error);
            await SecurityUtils.recordFailedAttempt(key, "write");
            return false;
        }
    }

    /**
     * Retrieves a stored value across platforms
     */
    async getItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<string | null> {
        try {
            // Parameter validation
            if (!key || typeof key !== "string") {
                throw new Error("Invalid key");
            }

            // Check if service is locked
            if (await SecurityUtils.isServiceLocked(key)) {
                console.warn(`🔒 Service temporarily locked for key: ${key}`);
                return null;
            }

            const hashedKey = EncryptionUtils.hashKey(
                key,
                DEFAULT_CONFIG.DEFAULT_SERVICE
            );
            const encryptedData = await this.getStorageInstance().getItem(
                hashedKey,
                options
            );

            if (!encryptedData) return null;

            // Common decryption and validation logic
            return await this.processRetrievedData(encryptedData, key, options);
        } catch (error) {
            console.error("❌ Error during secure retrieval:", error);
            await SecurityUtils.recordFailedAttempt(key, "read");
            return null;
        }
    }

    /**
     * Removes a stored value across platforms
     */
    async removeItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        try {
            const hashedKey = EncryptionUtils.hashKey(
                key,
                DEFAULT_CONFIG.DEFAULT_SERVICE
            );
            return await this.getStorageInstance().removeItem(
                hashedKey,
                options
            );
        } catch (error) {
            console.error("❌ Error during secure removal:", error);
            return false;
        }
    }

    /**
     * Clears all stored data across platforms
     */
    async clear(): Promise<boolean> {
        try {
            return await this.getStorageInstance().clear();
        } catch (error) {
            console.error("❌ Error during secure cleanup:", error);
            return false;
        }
    }

    /**
     * Gets the appropriate storage instance for the current platform
     */
    private getStorageInstance():
        | WebStorage
        | MobileStorage
        | NodeStorage
        | FallbackStorage {
        if (Platform.isWeb && this.webStorage) {
            return this.webStorage;
        } else if (Platform.isMobile && this.mobileStorage) {
            return this.mobileStorage;
        } else if (Platform.isNode && this.nodeStorage) {
            return this.nodeStorage;
        } else if (this.fallbackStorage) {
            return this.fallbackStorage;
        } else {
            // Create fallback storage if none exists
            this.fallbackStorage = new FallbackStorage();
            return this.fallbackStorage;
        }
    }

    /**
     * Processes retrieved encrypted data
     */
    private async processRetrievedData(
        encryptedData: string,
        originalKey: string,
        options: SecureStorageOptions
    ): Promise<string | null> {
        try {
            const serializedData = EncryptionUtils.doubleDecrypt(
                encryptedData,
                this.encryptionKey
            );
            const data: StoredData = JSON.parse(serializedData);

            // Version validation
            if (!isVersionCompatible(data.version)) {
                console.warn(`⚠️ Incompatible version for key ${originalKey}`);
                await this.removeItem(originalKey, options);
                return null;
            }

            // Integrity verification
            if (
                !EncryptionUtils.verifyChecksum(
                    data.value,
                    data.checksum,
                    this.integrityKey
                )
            ) {
                console.error(
                    `❌ Integrity compromised for key ${originalKey}`
                );
                await this.removeItem(originalKey, options);
                await SecurityUtils.recordFailedAttempt(
                    originalKey,
                    "integrity"
                );
                return null;
            }

            // Check expiration
            if (data.expiresAt && Date.now() > data.expiresAt) {
                await this.removeItem(originalKey, options);
                return null;
            }

            // Decompression if necessary
            let value = data.value;
            if (CompressionUtils.isCompressed(value)) {
                value = CompressionUtils.decompress(value);
            }

            await SecurityUtils.recordSuccessfulAttempt(originalKey);
            return value;
        } catch (error) {
            console.error("❌ Error processing retrieved data:", error);
            await SecurityUtils.recordFailedAttempt(originalKey, "read");
            return null;
        }
    }

    // Public utility methods
    async hasItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        const value = await this.getItem(key, options);
        return value !== null;
    }

    async setItemWithTTL(
        key: string,
        value: string,
        ttlSeconds: number,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        return this.setItem(key, value, { ...options, expiresIn: ttlSeconds });
    }

    async updateItem(
        key: string,
        updater: (currentValue: string | null) => string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        try {
            const currentValue = await this.getItem(key, options);
            const newValue = updater(currentValue);
            return await this.setItem(key, newValue, options);
        } catch (error) {
            console.error("❌ Error during atomic update:", error);
            return false;
        }
    }

    getSecurityMetrics(key: string): SecurityMetrics {
        return SecurityUtils.getSecurityMetrics(key);
    }

    async unlockService(key: string): Promise<boolean> {
        return SecurityUtils.unlockService(key);
    }

    getPlatformInfo(): PlatformInfo {
        return {
            platform: Platform.OS as PlatformType,
            isWeb: Platform.isWeb,
            isMobile: Platform.isMobile,
            isNode: Platform.isNode,
            hasKeychain: !!this.mobileStorage,
            hasIndexedDB: Platform.isWeb && !!this.webStorage,
            hasFileSystem: Platform.isNode && !!this.nodeStorage,
        };
    }
}
 
// Singleton instance
export const crossPlatformStorage = new CrossPlatformSecureStorage();

