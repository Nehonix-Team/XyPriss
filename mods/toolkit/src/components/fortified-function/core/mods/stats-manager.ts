/**
 * Statistics Manager for Fortified Function Core
 * Handles performance tracking and audit logging
 */

import { EventEmitter } from "events";
import {
    FunctionStats,
    AuditEntry,
    SecureExecutionContext,
    FortifiedFunctionOptions,
} from "../../types/types";
import { FortifiedUtils } from "../../utils/utils";

export class StatsManager extends EventEmitter {
    private readonly stats: FunctionStats;
    private readonly auditLog: AuditEntry[] = [];
    private readonly options: Required<FortifiedFunctionOptions>;

    constructor(options: Required<FortifiedFunctionOptions>) {
        super();
        this.options = options;
        this.stats = {
            executionCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            memoryUsage: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errorCount: 0,
            lastExecuted: new Date(),
            securityEvents: 0,
        };
    }

    /**
     * Update execution statistics
     */
    updateStats(context: SecureExecutionContext, success: boolean): void {
        const executionTime = performance.now() - context.startTime;

        this.stats.executionCount++;
        this.stats.totalExecutionTime += executionTime;
        this.stats.averageExecutionTime =
            this.stats.totalExecutionTime / this.stats.executionCount;
        this.stats.lastExecuted = new Date();
        this.stats.memoryUsage = FortifiedUtils.getCurrentMemoryUsage();

        if (!success) {
            this.stats.errorCount++;
        }

        // Update audit entry
        context.auditEntry.executionTime = executionTime;
        context.auditEntry.success = success;
        context.auditEntry.memoryUsage = this.stats.memoryUsage;

        if (this.options.auditLog) {
            this.auditLog.push(context.auditEntry);

            // Limit audit log size
            if (this.auditLog.length > 1000) {
                this.auditLog.splice(0, 100);
            }
        }

        this.emit("stats_updated", {
            executionId: context.executionId,
            success,
            executionTime,
            memoryUsage: this.stats.memoryUsage,
        });
    }

    /**
     * Record cache hit
     */
    recordCacheHit(): void {
        this.stats.cacheHits++;
        this.emit("cache_hit_recorded");
    }

    /**
     * Record cache miss
     */
    recordCacheMiss(): void {
        this.stats.cacheMisses++;
        this.emit("cache_miss_recorded");
    }

    /**
     * Record security event
     */
    recordSecurityEvent(): void {
        this.stats.securityEvents++;
        this.emit("security_event_recorded");
    }

    /**
     * Handle execution error with proper logging
     */
    handleExecutionError(context: SecureExecutionContext, error: Error): void {
        context.auditEntry.errorMessage = error.message;
        context.auditEntry.securityFlags.push("execution_error");

        this.updateStats(context, false);

        this.emit("execution_failed", {
            executionId: context.executionId,
            error: error.message,
            memoryUsage: context.auditEntry.memoryUsage,
        });
    }

    /**
     * Get current statistics
     */
    getStats(): FunctionStats {
        return { ...this.stats };
    }

    /**
     * Get audit log
     */
    getAuditLog(): AuditEntry[] {
        return [...this.auditLog];
    }

    /**
     * Get filtered audit log by criteria
     */
    getFilteredAuditLog(filter: {
        success?: boolean;
        startDate?: Date;
        endDate?: Date;
        executionId?: string;
    }): AuditEntry[] {
        return this.auditLog.filter((entry) => {
            if (
                filter.success !== undefined &&
                entry.success !== filter.success
            ) {
                return false;
            }
            if (filter.startDate && entry.timestamp < filter.startDate) {
                return false;
            }
            if (filter.endDate && entry.timestamp > filter.endDate) {
                return false;
            }
            if (
                filter.executionId &&
                entry.executionId !== filter.executionId
            ) {
                return false;
            }
            return true;
        });
    }

    /**
     * Clear audit log
     */
    clearAuditLog(): void {
        this.auditLog.length = 0;
        this.emit("audit_log_cleared");
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats.executionCount = 0;
        this.stats.totalExecutionTime = 0;
        this.stats.averageExecutionTime = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        this.stats.errorCount = 0;
        this.stats.securityEvents = 0;
        this.stats.lastExecuted = new Date();
        this.stats.memoryUsage = FortifiedUtils.getCurrentMemoryUsage();

        this.emit("stats_reset");
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.clearAuditLog();
        this.removeAllListeners();
    }
}

