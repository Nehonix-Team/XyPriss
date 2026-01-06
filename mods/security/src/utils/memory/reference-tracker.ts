/**
 * Advanced Reference Tracker
 *
 * Tracks object references with leak detection and comprehensive monitoring
 */

import { initializePolyfills } from "../../types/global";
import {
    ReferenceTracker,
    MemoryEventType,
    LeakDetectionResult,
    MemoryManagerConfig,
} from "./types";
import { MemoryEventManager } from "./event-manager";

// Initialize polyfills for WeakRef and FinalizationRegistry
initializePolyfills();

/**
 * Reference metadata for tracking
 */
interface ReferenceMetadata {
    id: string;
    weakRef: WeakRef<any>;
    refCount: number;
    createdAt: number;
    lastAccessed: number;
    size: number;
    type: string;
    stackTrace?: string;
}

/**
 * Advanced reference tracker with comprehensive leak detection
 */
export class AdvancedReferenceTracker implements ReferenceTracker {
    private references = new Map<string, ReferenceMetadata>();
    private finalizationRegistry: FinalizationRegistry<string>;
    private eventManager: MemoryEventManager;
    private config: MemoryManagerConfig;
    private isEnabled = true;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(eventManager: MemoryEventManager, config: MemoryManagerConfig) {
        this.eventManager = eventManager;
        this.config = config;

        // Initialize finalization registry for automatic cleanup
        this.finalizationRegistry = new FinalizationRegistry((id: string) => {
            this.handleObjectFinalization(id);
        });

        // Start periodic cleanup if enabled
        if (config.enableLeakDetection) {
            this.startPeriodicCleanup();
        }
    }

    /**
     * Add reference to an object with comprehensive metadata
     */
    addReference(obj: any, id: string): void {
        if (!this.isEnabled) {
            return;
        }

        try {
            const now = Date.now();
            const existingRef = this.references.get(id);

            if (existingRef) {
                // Update existing reference
                existingRef.refCount++;
                existingRef.lastAccessed = now;
            } else {
                // Create new reference
                const metadata: ReferenceMetadata = {
                    id,
                    weakRef: new WeakRef(obj),
                    refCount: 1,
                    createdAt: now,
                    lastAccessed: now,
                    size: this.estimateObjectSize(obj),
                    type: this.getObjectType(obj),
                    stackTrace: this.config.enablePerformanceMonitoring
                        ? this.captureStackTrace()
                        : undefined,
                };

                this.references.set(id, metadata);

                // Register with finalization registry
                this.finalizationRegistry.register(obj, id);

                this.eventManager.emit(MemoryEventType.OBJECT_TRACKED, {
                    id,
                    size: metadata.size,
                    type: metadata.type,
                    timestamp: now,
                });
            }
        } catch (error) {
            this.eventManager.emit(MemoryEventType.ERROR_OCCURRED, {
                error: `Failed to add reference for ${id}: ${error}`,
                operation: "addReference",
                objectId: id,
            });
        }
    }

    /**
     * Remove reference from an object
     */
    removeReference(id: string): void {
        if (!this.isEnabled) {
            return;
        }

        try {
            const metadata = this.references.get(id);
            if (!metadata) {
                return;
            }

            metadata.refCount--;
            metadata.lastAccessed = Date.now();

            if (metadata.refCount <= 0) {
                this.references.delete(id);
                this.eventManager.emit(MemoryEventType.OBJECT_RELEASED, {
                    id,
                    lifetime: Date.now() - metadata.createdAt,
                    size: metadata.size,
                });
            }
        } catch (error) {
            this.eventManager.emit(MemoryEventType.ERROR_OCCURRED, {
                error: `Failed to remove reference for ${id}: ${error}`,
                operation: "removeReference",
                objectId: id,
            });
        }
    }

    /**
     * Get reference count for an object
     */
    getRefCount(id: string): number {
        const metadata = this.references.get(id);
        return metadata ? metadata.refCount : 0;
    }

    /**
     * Get object age in milliseconds
     */
    getObjectAge(id: string): number {
        const metadata = this.references.get(id);
        return metadata ? Date.now() - metadata.createdAt : 0;
    }

    /**
     * Get last access time
     */
    getLastAccess(id: string): number {
        const metadata = this.references.get(id);
        return metadata ? metadata.lastAccessed : 0;
    }

    /**
     * Clean up dead references
     */
    cleanup(): void {
        if (!this.isEnabled) {
            return;
        }

        let cleanedCount = 0;
        const now = Date.now();

        for (const [id, metadata] of this.references.entries()) {
            const obj = metadata.weakRef.deref();
            if (!obj) {
                this.references.delete(id);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.eventManager.emit(MemoryEventType.GC_COMPLETED, {
                objectsCollected: cleanedCount,
                operation: "cleanup",
                timestamp: now,
            });
        }
    }

    /**
     * Get all tracked object IDs
     */
    getTrackedObjects(): string[] {
        return Array.from(this.references.keys());
    }

    /**
     * Detect potential memory leaks with advanced heuristics
     */
    detectLeaks(): string[] {
        if (!this.isEnabled || !this.config.enableLeakDetection) {
            return [];
        }

        const now = Date.now();
        const leaks: string[] = [];
        const suspiciousObjects: string[] = [];
        let totalLeakedMemory = 0;

        for (const [id, metadata] of this.references.entries()) {
            const obj = metadata.weakRef.deref();
            if (!obj) {
                // Object was garbage collected, clean up
                this.references.delete(id);
                continue;
            }

            const age = now - metadata.createdAt;
            const timeSinceAccess = now - metadata.lastAccessed;

            // Leak detection heuristics
            const isOld = age > this.config.leakDetectionThreshold;
            const isStale =
                timeSinceAccess > this.config.leakDetectionThreshold / 2;
            const hasHighRefCount = metadata.refCount > 10; // Configurable threshold
            const isLargeObject = metadata.size > 1024 * 1024; // > 1MB

            if (isOld && isStale) {
                if (hasHighRefCount || isLargeObject) {
                    leaks.push(id);
                    totalLeakedMemory += metadata.size;
                } else {
                    suspiciousObjects.push(id);
                }
            }
        }

        if (leaks.length > 0) {
            const result: LeakDetectionResult = {
                leaks,
                suspiciousObjects,
                totalLeakedMemory,
                detectionTime: Date.now(),
                confidence: this.calculateLeakConfidence(
                    leaks.length,
                    suspiciousObjects.length
                ),
            };

            this.eventManager.emit(MemoryEventType.LEAK_DETECTED, result);
        }

        return leaks;
    }

    /**
     * Calculate confidence level for leak detection
     */
    private calculateLeakConfidence(
        leakCount: number,
        suspiciousCount: number
    ): number {
        const totalObjects = this.references.size;
        if (totalObjects === 0) return 0;

        const leakRatio = leakCount / totalObjects;
        const suspiciousRatio = suspiciousCount / totalObjects;

        // Higher confidence for more leaks relative to total objects
        let confidence = Math.min(leakRatio * 2, 1.0);

        // Reduce confidence if there are many suspicious objects (might be false positives)
        if (suspiciousRatio > 0.5) {
            confidence *= 0.7;
        }

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Handle object finalization
     */
    private handleObjectFinalization(id: string): void {
        const metadata = this.references.get(id);
        if (metadata) {
            this.references.delete(id);
            this.eventManager.emit(MemoryEventType.OBJECT_RELEASED, {
                id,
                lifetime: Date.now() - metadata.createdAt,
                size: metadata.size,
                automatic: true,
            });
        }
    }

    /**
     * Estimate object size in bytes
     */
    private estimateObjectSize(obj: any): number {
        if (obj === null || obj === undefined) return 0;

        const type = typeof obj;
        switch (type) {
            case "boolean":
                return 4;
            case "number":
                return 8;
            case "string":
                return obj.length * 2; // UTF-16
            case "object":
                if (obj instanceof ArrayBuffer) return obj.byteLength;
                if (obj instanceof Uint8Array) return obj.byteLength;
                if (Array.isArray(obj)) {
                    return obj.reduce(
                        (sum, item) => sum + this.estimateObjectSize(item),
                        0
                    );
                }
                // Estimate object size based on properties
                return Object.keys(obj).length * 64; // Rough estimate
            default:
                return 64; // Default estimate
        }
    }

    /**
     * Get object type description
     */
    private getObjectType(obj: any): string {
        if (obj === null) return "null";
        if (obj === undefined) return "undefined";
        if (Array.isArray(obj)) return "Array";
        if (obj instanceof Date) return "Date";
        if (obj instanceof RegExp) return "RegExp";
        if (obj instanceof Error) return "Error";
        if (obj instanceof ArrayBuffer) return "ArrayBuffer";
        if (obj instanceof Uint8Array) return "Uint8Array";

        return obj.constructor?.name || typeof obj;
    }

    /**
     * Capture stack trace for debugging
     */
    private captureStackTrace(): string | undefined {
        try {
            const stack = new Error().stack;
            return stack?.split("\n").slice(3, 8).join("\n"); // Skip first 3 lines, take next 5
        } catch {
            return undefined;
        }
    }

    /**
     * Start periodic cleanup
     */
    private startPeriodicCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
            if (this.config.enableLeakDetection) {
                this.detectLeaks();
            }
        }, this.config.autoCleanupInterval);
    }

    /**
     * Get tracker statistics
     */
    getStats(): Record<string, any> {
        const now = Date.now();
        let totalSize = 0;
        let oldestObject = now;
        let newestObject = 0;
        const typeDistribution: Record<string, number> = {};

        for (const metadata of this.references.values()) {
            totalSize += metadata.size;
            oldestObject = Math.min(oldestObject, metadata.createdAt);
            newestObject = Math.max(newestObject, metadata.createdAt);

            typeDistribution[metadata.type] =
                (typeDistribution[metadata.type] || 0) + 1;
        }

        return {
            trackedObjects: this.references.size,
            totalEstimatedSize: totalSize,
            averageObjectSize:
                this.references.size > 0 ? totalSize / this.references.size : 0,
            oldestObjectAge: oldestObject < now ? now - oldestObject : 0,
            newestObjectAge: newestObject > 0 ? now - newestObject : 0,
            typeDistribution,
            isEnabled: this.isEnabled,
        };
    }

    /**
     * Enable/disable tracker
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;

        if (
            enabled &&
            this.config.enableLeakDetection &&
            !this.cleanupInterval
        ) {
            this.startPeriodicCleanup();
        } else if (!enabled && this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config: MemoryManagerConfig): void {
        this.config = config;

        if (config.enableLeakDetection && this.isEnabled) {
            this.startPeriodicCleanup();
        } else if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }

    /**
     * Destroy the tracker
     */
    destroy(): void {
        this.isEnabled = false;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }

        this.references.clear();
    }
}

