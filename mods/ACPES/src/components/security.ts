/**
 * Security utilities for ACPES
 */

import { SecurityMetrics } from "../types/security";
import { DEFAULT_CONFIG } from "../utils/constants";

/**
 * Security management utility class
 */
export class SecurityUtils {
    private static securityMetrics: Map<string, SecurityMetrics> = new Map();

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
            console.error("❌ Error during unlock:", error);
            return false;
        }
    }

    /**
     * Cleanup methods for expired and corrupted data
     */
    public static async cleanupExpiredData(): Promise<void> {
        console.log("🧹 Cleanup expired data");
        // Implementation depends on platform and will be handled by storage implementations
    }

    public static async cleanupCorruptedData(): Promise<void> {
        console.log("🧹 Cleanup corrupted data");
        // Implementation depends on platform and will be handled by storage implementations
    }

    public static async checkKeyRotation(): Promise<void> {
        console.log("🔄 Key rotation check");
        // Implementation for key rotation policies
    }
}

