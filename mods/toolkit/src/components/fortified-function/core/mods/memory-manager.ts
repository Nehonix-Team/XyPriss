/**
 * Memory Manager for Fortified Function Core
 * Handles memory monitoring, cleanup, and resource management
 */

import { EventEmitter } from "events";
import {
    FortifiedFunctionOptions,
    SecureExecutionContext,
} from "../../types/types";
import { FortifiedUtils } from "../../utils/utils";

export class MemoryManager extends EventEmitter {
    private readonly options: Required<FortifiedFunctionOptions>;
    private memoryMonitorInterval?: NodeJS.Timeout;

    constructor(options: Required<FortifiedFunctionOptions>) {
        super();
        this.options = options;

        if (this.options.memoryPool) {
            this.setupMemoryMonitoring();
        }
    }

    /**
     * Check if memory usage is within limits
     */
    checkMemoryLimits(): boolean {
        const currentUsage = FortifiedUtils.getCurrentMemoryUsage();
        const isExceeded = FortifiedUtils.isMemoryLimitExceeded(
            currentUsage,
            this.options.maxMemoryUsage
        );

        if (isExceeded) {
            this.emit("memory_limit_exceeded", {
                current: currentUsage,
                limit: this.options.maxMemoryUsage,
            });
        }

        return !isExceeded;
    }

    /**
     * Get current memory usage information
     */
    getMemoryInfo(): {
        current: number;
        limit: number;
        percentage: number;
        withinLimits: boolean;
    } {
        const current = FortifiedUtils.getCurrentMemoryUsage();
        const limit = this.options.maxMemoryUsage;
        const percentage = (current / limit) * 100;
        const withinLimits = !FortifiedUtils.isMemoryLimitExceeded(
            current,
            limit
        );

        return {
            current,
            limit,
            percentage,
            withinLimits,
        };
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection(): boolean {
        if (global.gc) {
            try {
                global.gc();
                this.emit("garbage_collection_forced");
                return true;
            } catch (error) {
                this.emit("garbage_collection_failed", { error });
                return false;
            }
        }
        return false;
    }

    /**
     * Clean up execution context memory
     */
    cleanupExecutionMemory(context: SecureExecutionContext): void {
        // Destroy secure buffers
        for (const buffer of context.secureBuffers.values()) {
            try {
                buffer.destroy();
            } catch (error) {
                this.emit("buffer_cleanup_error", {
                    executionId: context.executionId,
                    error,
                });
            }
        }

        // Clear encrypted parameters
        context.encryptedParameters.clear();

        this.emit("execution_memory_cleaned", {
            executionId: context.executionId,
        });
    }

    /**
     * Schedule memory cleanup with delay
     */
    scheduleMemoryCleanup(
        context: SecureExecutionContext,
        callback?: () => void
    ): void {
        const cleanup = () => {
            this.cleanupExecutionMemory(context);
            if (callback) {
                callback();
            }
        };

        if (this.options.memoryWipeDelay > 0) {
            setTimeout(cleanup, this.options.memoryWipeDelay);
        } else {
            cleanup();
        }
    }

    /**
     * Monitor memory usage and emit warnings
     */
    private setupMemoryMonitoring(): void {
        this.memoryMonitorInterval = setInterval(() => {
            const memoryInfo = this.getMemoryInfo();

            this.emit("memory_status", memoryInfo);

            // Emit warnings at different thresholds
            if (memoryInfo.percentage > 90) {
                this.emit("memory_critical", memoryInfo);
            } else if (memoryInfo.percentage > 75) {
                this.emit("memory_warning", memoryInfo);
            }

            // Auto cleanup if memory is critical
            if (memoryInfo.percentage > 95) {
                this.forceGarbageCollection();
            }
        }, 5000); // Check every 5 seconds
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats(): {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    } {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
        };
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
        this.removeAllListeners();
    }
}

