/**
 * Key rotation management for ACPES
 */

import { Logger } from "../../../../shared/logger";
import { PlatformModules } from "../core/platform";
import type { KeyRotationConfig, KeyMetadata } from "../types/keyRotation.t";

/**
 * The KeyRotationManager is a singleton class that manages key rotation for ACPES.
 * It provides utilities for managing key rotation, including automatic rotation,
 * rotation check, and statistics.
 * 
 * @example
 * ```typescript
 * import { Storage, KeyRotationManager } from 'xypriss-acpes';

    // Keys are automatically registered and tracked
    await Storage.setItem('data', 'value');

    // Get rotation statistics
    const stats = KeyRotationManager.getRotationStatistics();
    console.log(`Active keys: ${stats.activeKeys}`);

    // Perform rotation check (called automatically during security cleanup)
    const check = await KeyRotationManager.performRotationCheck();
    console.log(`Keys needing rotation: ${check.keysNeedingRotation.length}`);
 * ```
 */
export class KeyRotationManager {
    private static logger: Logger;
    private static config: KeyRotationConfig;
    private static keyMetadata: Map<string, KeyMetadata> = new Map();

    /**
     * Initialize the key rotation manager
     */
    public static initialize(config?: Partial<KeyRotationConfig>): void {
        if (!this.logger) {
            this.logger = new Logger({
                components: {
                    acpes: true,
                },
            });
        }

        // Default configuration
        this.config = {
            rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
            maxKeyAge: 90 * 24 * 60 * 60 * 1000, // 90 days
            enableAutoRotation: false, // Disabled by default for security
            backupOldKeys: true,
            ...config,
        };

        this.logger.debug("acpes", "Key rotation manager initialized");
    }

    /**
     * Check if key rotation is needed for a specific key
     */
    public static isRotationNeeded(keyId: string): boolean {
        const metadata = this.keyMetadata.get(keyId);
        if (!metadata) {
            return false; // No metadata means key doesn't exist
        }

        const now = Date.now();
        const keyAge = now - metadata.createdAt;
        const timeSinceLastUse = now - metadata.lastUsed;

        // Check if key is too old
        if (keyAge > this.config.maxKeyAge) {
            this.logger.warn("acpes", `Key ${keyId} exceeds maximum age`);
            return true;
        }

        // Check if rotation interval has passed
        if (keyAge > this.config.rotationInterval) {
            this.logger.info("acpes", `Key ${keyId} rotation interval reached`);
            return true;
        }

        return false;
    }

    /**
     * Register a key for rotation tracking
     */
    public static registerKey(keyId: string): void {
        this.initialize(); // Ensure logger is initialized

        const now = Date.now();
        const metadata: KeyMetadata = {
            keyId,
            createdAt: now,
            lastUsed: now,
            rotationCount: 0,
            isActive: true,
        };

        this.keyMetadata.set(keyId, metadata);
        this.logger.debug(
            "acpes",
            `Registered key for rotation tracking: ${keyId}`
        );
    }

    /**
     * Update key usage timestamp
     */
    public static updateKeyUsage(keyId: string): void {
        this.initialize(); // Ensure logger is initialized

        const metadata = this.keyMetadata.get(keyId);
        if (metadata) {
            metadata.lastUsed = Date.now();
            this.keyMetadata.set(keyId, metadata);
        }
    }

    /**
     * Get key rotation status
     */
    public static getKeyStatus(keyId: string): KeyMetadata | null {
        return this.keyMetadata.get(keyId) || null;
    }

    /**
     * Get all keys that need rotation
     */
    public static getKeysNeedingRotation(): string[] {
        const keysNeedingRotation: string[] = [];

        for (const [keyId, metadata] of this.keyMetadata.entries()) {
            if (metadata.isActive && this.isRotationNeeded(keyId)) {
                keysNeedingRotation.push(keyId);
            }
        }

        return keysNeedingRotation;
    }

    /**
     * Perform key rotation check and return recommendations
     */
    public static async performRotationCheck(): Promise<{
        keysNeedingRotation: string[];
        recommendations: string[];
        criticalKeys: string[];
    }> {
        this.initialize(); // Ensure initialized

        const keysNeedingRotation = this.getKeysNeedingRotation();
        const recommendations: string[] = [];
        const criticalKeys: string[] = [];

        for (const keyId of keysNeedingRotation) {
            const metadata = this.keyMetadata.get(keyId);
            if (!metadata) continue;

            const keyAge = Date.now() - metadata.createdAt;

            if (keyAge > this.config.maxKeyAge) {
                criticalKeys.push(keyId);
                recommendations.push(
                    `CRITICAL: Key ${keyId} is ${Math.floor(
                        keyAge / (24 * 60 * 60 * 1000)
                    )} days old and must be rotated immediately`
                );
            } else if (keyAge > this.config.rotationInterval) {
                recommendations.push(
                    `Key ${keyId} should be rotated (${Math.floor(
                        keyAge / (24 * 60 * 60 * 1000)
                    )} days old)`
                );
            }
        }

        // Log findings
        if (criticalKeys.length > 0) {
            this.logger.error(
                "acpes",
                `${criticalKeys.length} critical keys need immediate rotation`
            );
        }

        if (keysNeedingRotation.length > 0) {
            this.logger.warn(
                "acpes",
                `${keysNeedingRotation.length} keys need rotation`
            );
        } else {
            this.logger.debug(
                "acpes",
                "All keys are current, no rotation needed"
            );
        }

        return {
            keysNeedingRotation,
            recommendations,
            criticalKeys,
        };
    }

    /**
     * Mark a key as rotated
     */
    public static markKeyRotated(keyId: string): void {
        const metadata = this.keyMetadata.get(keyId);
        if (metadata) {
            metadata.createdAt = Date.now();
            metadata.lastUsed = Date.now();
            metadata.rotationCount++;
            this.keyMetadata.set(keyId, metadata);

            this.logger.info(
                "acpes",
                `Key ${keyId} marked as rotated (rotation #${metadata.rotationCount})`
            );
        }
    }

    /**
     * Deactivate a key (mark as inactive)
     */
    public static deactivateKey(keyId: string): void {
        const metadata = this.keyMetadata.get(keyId);
        if (metadata) {
            metadata.isActive = false;
            this.keyMetadata.set(keyId, metadata);
            this.logger.info("acpes", `Key ${keyId} deactivated`);
        }
    }

    /**
     * Get rotation statistics
     */
    public static getRotationStatistics(): {
        totalKeys: number;
        activeKeys: number;
        keysNeedingRotation: number;
        averageKeyAge: number;
        oldestKeyAge: number;
    } {
        const activeKeys = Array.from(this.keyMetadata.values()).filter(
            (k) => k.isActive
        );
        const now = Date.now();

        let totalAge = 0;
        let oldestAge = 0;

        for (const metadata of activeKeys) {
            const age = now - metadata.createdAt;
            totalAge += age;
            if (age > oldestAge) {
                oldestAge = age;
            }
        }

        return {
            totalKeys: this.keyMetadata.size,
            activeKeys: activeKeys.length,
            keysNeedingRotation: this.getKeysNeedingRotation().length,
            averageKeyAge:
                activeKeys.length > 0 ? totalAge / activeKeys.length : 0,
            oldestKeyAge: oldestAge,
        };
    }

    /**
     * Clean up old key metadata
     */
    public static cleanupOldMetadata(): void {
        const now = Date.now();
        const maxRetentionTime = 365 * 24 * 60 * 60 * 1000; // 1 year
        let cleanedCount = 0;

        for (const [keyId, metadata] of this.keyMetadata.entries()) {
            if (
                !metadata.isActive &&
                now - metadata.lastUsed > maxRetentionTime
            ) {
                this.keyMetadata.delete(keyId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.info(
                "acpes",
                `Cleaned up ${cleanedCount} old key metadata entries`
            );
        }
    }
}

