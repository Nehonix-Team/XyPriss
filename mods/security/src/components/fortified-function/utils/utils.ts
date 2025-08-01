/**
 * Utility functions for Fortified Function Core
 */

import { NehoID as ID } from "nehoid";

export class FortifiedUtils {
    /**
     * Generate unique execution ID
     */
    static generateExecutionId(prefix?: string): string {
        return ID.generate({ prefix: "nehonix.func.exec" });
    }

    /**
     * Get current memory usage
     */
    static getCurrentMemoryUsage(): number {
        // Simplified memory usage calculation
        return process.memoryUsage?.()?.heapUsed || 0;
    }

    /**
     * Sanitize stack trace to remove sensitive parameter information
     */
    static sanitizeStackTrace(stack: string): string {
        // Remove sensitive parameter information from stack traces
        return stack.replace(/\(.*?\)/g, "([REDACTED])");
    }

    /**
     * Sleep utility for retry delays
     */
    static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Calculate exponential backoff delay
     */
    static calculateRetryDelay(attempt: number, maxDelay: number): number {
        return Math.min(1000 * Math.pow(2, attempt), maxDelay);
    }

    /**
     * Check if memory usage exceeds limit
     */
    static isMemoryLimitExceeded(current: number, limit: number): boolean {
        return current > limit;
    }

    /**
     * Serialize arguments for hashing (with redaction for large values)
     */
    static serializeArgsForHash<T extends any[]>(args: T): string {
        return JSON.stringify(args, (_key, value) => {
            // Don't include actual sensitive values in hash
            if (typeof value === "string" && value.length > 50) {
                return `[REDACTED:${value.length}]`;
            }
            return value;
        });
    }

    /**
     * Check if cache entry is expired
     */
    static isCacheEntryExpired(timestamp: number, maxAge: number): boolean {
        return Date.now() - timestamp > maxAge;
    }
}

