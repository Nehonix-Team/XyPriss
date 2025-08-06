/**
 * Security utilities for ACPES
 */

import { Logger } from "../../../../shared/logger";
import { SecurityMetrics } from "../types/security";
import { DEFAULT_CONFIG } from "../utils/constants";
import { KeyRotationManager } from "./keyRotation";

/**
 * Security management utility class
 */
export class SecurityUtils {
    private static securityMetrics: Map<string, SecurityMetrics> = new Map();
    private static logger: Logger;

    /**
     * Initialize the security utils with logger
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
     * Checks if a service is locked due to failed attempts
     */
    public static async isServiceLocked(key: string): Promise<boolean> {
        const metrics = this.securityMetrics.get(key);
        if (!metrics || !metrics.isLocked) return false;

        if (metrics.lockUntil && Date.now() > metrics.lockUntil) {
            metrics.isLocked = false;
            metrics.lockUntil = undefined;
            metrics.failedAttempts = 0;
            this.securityMetrics.set(key, metrics);
            return false;
        }
        return metrics.isLocked;
    }

    /**
     * Records a failed attempt and potentially locks the service
     */
    public static async recordFailedAttempt(
        key: string,
        type: "read" | "write" | "integrity"
    ): Promise<void> {
        this.initialize();
        const metrics = this.securityMetrics.get(key) || {
            totalAttempts: 0,
            failedAttempts: 0,
            isLocked: false,
        };

        metrics.totalAttempts++;
        metrics.failedAttempts++;
        metrics.lastFailedAttempt = Date.now();

        if (metrics.failedAttempts >= DEFAULT_CONFIG.MAX_FAILED_ATTEMPTS) {
            metrics.isLocked = true;
            metrics.lockUntil = Date.now() + DEFAULT_CONFIG.LOCKOUT_DURATION;
            this.logger.warn(
                "acpes",
                `Service locked for key: ${key} due to ${metrics.failedAttempts} failed ${type} attempts`
            );
        }
        this.securityMetrics.set(key, metrics);
    }

    /**
     * Records a successful attempt
     */
    public static async recordSuccessfulAttempt(key: string): Promise<void> {
        const metrics = this.securityMetrics.get(key) || {
            totalAttempts: 0,
            failedAttempts: 0,
            isLocked: false,
        };
        metrics.totalAttempts++;
        metrics.failedAttempts = 0;
        this.securityMetrics.set(key, metrics);
    }

    /**
     * Gets security metrics for a key
     */
    public static getSecurityMetrics(key: string): SecurityMetrics {
        return (
            this.securityMetrics.get(key) || {
                totalAttempts: 0,
                failedAttempts: 0,
                isLocked: false,
            }
        );
    }

    /**
     * Unlocks a service manually
     */
    public static async unlockService(key: string): Promise<boolean> {
        try {
            const metrics = this.securityMetrics.get(key);
            if (metrics) {
                metrics.isLocked = false;
                metrics.lockUntil = undefined;
                metrics.failedAttempts = 0;
                this.securityMetrics.set(key, metrics);
            }
            return true;
        } catch (error) {
            this.logger.error("acpes", "Error during unlock:", error);
            return false;
        }
    }

    /**
     * Cleanup expired data entries
     */
    public static async cleanupExpiredData(): Promise<void> {
        this.initialize();
        this.logger.info("acpes", "Starting cleanup of expired data");

        // Clean up expired security metrics
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, metrics] of this.securityMetrics.entries()) {
            // Remove metrics for keys that haven't been accessed in 24 hours
            if (
                metrics.lastFailedAttempt &&
                now - metrics.lastFailedAttempt > 24 * 60 * 60 * 1000
            ) {
                this.securityMetrics.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.info(
                "acpes",
                `Cleaned up ${cleanedCount} expired security metrics`
            );
        }
    }

    /**
     * Cleanup corrupted data entries
     */
    public static async cleanupCorruptedData(): Promise<void> {
        this.initialize();
        this.logger.info("acpes", "Starting cleanup of corrupted data");

        // Reset metrics for keys with excessive failed attempts that might indicate corruption
        let cleanedCount = 0;

        for (const [key, metrics] of this.securityMetrics.entries()) {
            if (
                metrics.failedAttempts >
                DEFAULT_CONFIG.MAX_FAILED_ATTEMPTS * 2
            ) {
                // Reset metrics for potentially corrupted entries
                metrics.failedAttempts = 0;
                metrics.isLocked = false;
                metrics.lockUntil = undefined;
                this.securityMetrics.set(key, metrics);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.info(
                "acpes",
                `Reset ${cleanedCount} potentially corrupted security metrics`
            );
        }
    }

    /**
     * Check and perform key rotation if needed
     */
    public static async checkKeyRotation(): Promise<void> {
        this.initialize();
        this.logger.info("acpes", "Checking key rotation policies");

        try {
            // Initialize key rotation manager
            KeyRotationManager.initialize();

            // Perform rotation check
            const rotationCheck =
                await KeyRotationManager.performRotationCheck();

            // Log recommendations
            if (rotationCheck.recommendations.length > 0) {
                for (const recommendation of rotationCheck.recommendations) {
                    if (
                        rotationCheck.criticalKeys.some((key) =>
                            recommendation.includes(key)
                        )
                    ) {
                        this.logger.error("acpes", recommendation);
                    } else {
                        this.logger.warn("acpes", recommendation);
                    }
                }
            }

            // Get and log statistics
            const stats = KeyRotationManager.getRotationStatistics();
            this.logger.info(
                "acpes",
                `Key rotation statistics: ${stats.activeKeys} active keys, ${stats.keysNeedingRotation} need rotation`
            );

            // Clean up old metadata
            KeyRotationManager.cleanupOldMetadata();
        } catch (error) {
            this.logger.error(
                "acpes",
                "Error during key rotation check:",
                error
            );
        }
    }
}

