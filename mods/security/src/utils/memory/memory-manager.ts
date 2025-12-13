/***************************************************************************
 * XyPrissSecurity - Secure Array Types
 *
 * This file contains type definitions for the SecureArray modular architecture
 *
 * @author Nehonix
 *
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

import { initializePolyfills } from "../../types/global";
import {
    MemoryStats,
    MemoryManagerConfig,
    MemoryPool,
    PoolConfig,
    MemoryEventType,
    MemoryUsageEstimate,
    GCResult,
    MemoryManagerState,
    PerformanceMetrics,
    MemoryPressureInfo,
    MemoryPressureLevel,
} from "./types";
import { MemoryEventManager } from "./event-manager";
import { ConfigurationManager } from "./config-manager";
import { AdvancedReferenceTracker } from "./reference-tracker";
import { AdvancedMemoryPool } from "./memory-pool";

// Initialize polyfills for WeakRef and FinalizationRegistry
initializePolyfills();

/**
 * Advanced Memory Manager
 *
 * Main orchestrator for the memory management system with all components
 */
export class AdvancedMemoryManager {
    private static instance: AdvancedMemoryManager;

    // Core components
    private eventManager: MemoryEventManager;
    private configManager: ConfigurationManager;
    private referenceTracker: AdvancedReferenceTracker;
    private pools = new Map<string, MemoryPool<any>>();

    // State management
    private state: MemoryManagerState;
    private stats: MemoryStats;
    private performanceMetrics: PerformanceMetrics;

    // Object collection tracking
    private objectTracker = new Map<
        string,
        {
            count: number;
            totalSize: number;
            lastSeen: number;
            type: string;
            weakRefs: WeakRef<any>[];
        }
    >();
    private collectionHistory: Array<{
        timestamp: number;
        objectsCollected: number;
        typesCollected: Map<string, number>;
        memoryFreed: number;
        gcDuration: number;
    }> = [];
    private finalizationRegistry?: FinalizationRegistry<string>;

    // Monitoring intervals
    private gcInterval?: NodeJS.Timeout;
    private monitoringInterval?: NodeJS.Timeout;
    private cleanupInterval?: NodeJS.Timeout;

    private constructor(config: Partial<MemoryManagerConfig> = {}) {
        // Initialize state
        this.state = {
            isRunning: false,
            lastGC: Date.now(),
            nextScheduledGC: 0,
            activeMonitors: 0,
            errorCount: 0,
            uptime: Date.now(),
        };

        // Initialize stats
        this.stats = {
            totalAllocated: 0,
            totalFreed: 0,
            currentUsage: 0,
            peakUsage: 0,
            gcCount: 0,
            leakCount: 0,
            pressure: 0,
            poolStats: [],
            trackedObjects: 0,
            lastGC: Date.now(),
            averageGCTime: 0,
        };

        // Initialize performance metrics
        this.performanceMetrics = {
            averageGCTime: 0,
            gcFrequency: 0,
            memoryEfficiency: 0,
            poolHitRates: {},
            leakDetectionAccuracy: 0,
            systemLoad: 0,
        };

        // Initialize components in order
        this.eventManager = new MemoryEventManager(this.getDefaultConfig());
        this.configManager = new ConfigurationManager(
            config,
            this.eventManager
        );
        this.referenceTracker = new AdvancedReferenceTracker(
            this.eventManager,
            this.configManager.getConfig()
        ); 

        // Initialize object collection tracking
        this.initializeObjectTracking();

        // Start the memory manager
        this.start();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(
        config?: Partial<MemoryManagerConfig>
    ): AdvancedMemoryManager {
        if (!AdvancedMemoryManager.instance) {
            AdvancedMemoryManager.instance = new AdvancedMemoryManager(config);
        }
        return AdvancedMemoryManager.instance;
    }

    /**
     * Get default configuration
     */
    private getDefaultConfig(): MemoryManagerConfig {
        return {
            maxMemory: 100 * 1024 * 1024, // 100MB
            gcThreshold: 0.8,
            gcInterval: 30000, // 30 seconds
            enableLeakDetection: true,
            enablePerformanceMonitoring: true,
            enableEventLogging: false,
            autoCleanupInterval: 60000, // 1 minute
            maxPoolAge: 300000, // 5 minutes
            leakDetectionThreshold: 300000, // 5 minutes
            maxEventHistory: 1000,
        };
    }

    /**
     * Start the memory manager
     */
    private start(): void {
        if (this.state.isRunning) {
            return;
        }

        this.state.isRunning = true;
        this.state.uptime = Date.now();

        const config = this.configManager.getConfig();

        // Start garbage collection monitoring
        this.startGCMonitoring();

        // Start performance monitoring if enabled
        if (config.enablePerformanceMonitoring) {
            this.startPerformanceMonitoring();
        }

        // Start cleanup monitoring
        this.startCleanupMonitoring();

        this.eventManager.emit(MemoryEventType.CONFIG_UPDATED, {
            action: "started",
            config: config,
        });
    }

    /**
     * Start garbage collection monitoring
     */
    private startGCMonitoring(): void {
        const config = this.configManager.getConfig();

        if (this.gcInterval) {
            clearInterval(this.gcInterval);
        }

        this.gcInterval = setInterval(() => {
            this.checkMemoryPressure();
        }, config.gcInterval);

        this.state.nextScheduledGC = Date.now() + config.gcInterval;
    }

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(() => {
            this.updatePerformanceMetrics();
            this.updateMemoryStats();
        }, 5000); // Update every 5 seconds

        this.state.activeMonitors++;
    }

    /**
     * Start cleanup monitoring
     */
    private startCleanupMonitoring(): void {
        const config = this.configManager.getConfig();

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, config.autoCleanupInterval);

        this.state.activeMonitors++;
    }

    /**
     * Check memory pressure and trigger GC if needed
     */
    private checkMemoryPressure(): void {
        try {
            const usage = this.getCurrentMemoryUsage();
            const config = this.configManager.getConfig();

            this.stats.currentUsage = usage.estimatedSize;
            this.stats.pressure = usage.estimatedSize / config.maxMemory;

            const pressureInfo = this.getMemoryPressureInfo();

            if (pressureInfo.shouldTriggerGC) {
                this.triggerGarbageCollection();
            }

            // Emit memory pressure event if significant
            if (pressureInfo.level !== MemoryPressureLevel.LOW) {
                this.eventManager.emit(
                    MemoryEventType.MEMORY_PRESSURE,
                    pressureInfo
                );
            }
        } catch (error) {
            this.handleError("checkMemoryPressure", error);
        }
    }

    /**
     * Get current memory usage estimation
     */
    private getCurrentMemoryUsage(): MemoryUsageEstimate {
        // Try Node.js process.memoryUsage first
        if (typeof process !== "undefined" && process.memoryUsage) {
            const usage = process.memoryUsage();
            return {
                estimatedSize: usage.heapUsed,
                confidence: 0.95,
                method: "node",
                breakdown: {
                    heap: usage.heapUsed,
                    external: usage.external,
                },
            };
        }

        // Browser fallback - estimate based on tracked objects
        const trackerStats = this.referenceTracker.getStats();
        return {
            estimatedSize: trackerStats.totalEstimatedSize || 0,
            confidence: 0.6,
            method: "browser",
            breakdown: {
                tracked: trackerStats.totalEstimatedSize || 0,
            },
        };
    }

    /**
     * Get memory pressure information
     */
    private getMemoryPressureInfo(): MemoryPressureInfo {
        const config = this.configManager.getConfig();
        const pressure = this.stats.pressure;

        let level: MemoryPressureLevel;
        let recommendation: string;
        let shouldTriggerGC: boolean;

        if (pressure < 0.5) {
            level = MemoryPressureLevel.LOW;
            recommendation = "Memory usage is optimal";
            shouldTriggerGC = false;
        } else if (pressure < config.gcThreshold) {
            level = MemoryPressureLevel.MEDIUM;
            recommendation = "Monitor memory usage";
            shouldTriggerGC = false;
        } else if (pressure < 0.95) {
            level = MemoryPressureLevel.HIGH;
            recommendation = "Consider triggering garbage collection";
            shouldTriggerGC = true;
        } else {
            level = MemoryPressureLevel.CRITICAL;
            recommendation = "Immediate garbage collection required";
            shouldTriggerGC = true;
        }

        // Also check time since last GC
        const timeSinceLastGC = Date.now() - this.state.lastGC;
        if (timeSinceLastGC >= config.gcInterval) {
            shouldTriggerGC = true;
        }

        return {
            level,
            pressure,
            recommendation,
            shouldTriggerGC,
        };
    }

    /**
     * Trigger garbage collection
     */
    private triggerGarbageCollection(): GCResult {
        const startTime = Date.now();
        const beforeUsage = this.stats.currentUsage;

        this.eventManager.emit(MemoryEventType.GC_TRIGGERED, {
            beforeUsage,
            pressure: this.stats.pressure,
            trigger: "automatic",
        });

        try {
            // Clean up dead references
            this.referenceTracker.cleanup();

            // Clean up memory pools
            let poolsCleanedUp = 0;
            for (const pool of this.pools.values()) {
                // Remove old items from pools
                const sizeBefore = pool.size;
                // Pool cleanup is handled internally
                if (pool.size < sizeBefore) {
                    poolsCleanedUp++;
                }
            }

            // Force GC if available (Node.js)
            if (typeof global !== "undefined" && (global as any).gc) {
                (global as any).gc();
            }

            // Update stats
            const afterUsage = this.getCurrentMemoryUsage().estimatedSize;
            const duration = Date.now() - startTime;
            const freedMemory = Math.max(0, beforeUsage - afterUsage);

            this.stats.totalFreed += freedMemory;
            this.stats.gcCount++;
            this.stats.lastGC = Date.now();
            this.state.lastGC = Date.now();

            // Update average GC time
            this.stats.averageGCTime =
                (this.stats.averageGCTime * (this.stats.gcCount - 1) +
                    duration) /
                this.stats.gcCount;

            // Perform sophisticated object collection tracking
            const objectsCollected = this.trackObjectCollection(
                beforeUsage,
                afterUsage
            );

            const result: GCResult = {
                beforeUsage,
                afterUsage,
                freedMemory,
                duration,
                objectsCollected,
                poolsCleanedUp,
                success: true,
            };

            this.eventManager.emit(MemoryEventType.GC_COMPLETED, result);

            return result;
        } catch (error) {
            const result: GCResult = {
                beforeUsage,
                afterUsage: beforeUsage,
                freedMemory: 0,
                duration: Date.now() - startTime,
                objectsCollected: 0,
                poolsCleanedUp: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };

            this.handleError("triggerGarbageCollection", error);
            return result;
        }
    }

    /**
     * Perform routine cleanup
     */
    private performCleanup(): void {
        try {
            // Clean up reference tracker
            this.referenceTracker.cleanup();

            // Detect memory leaks if enabled
            const config = this.configManager.getConfig();
            if (config.enableLeakDetection) {
                const leaks = this.referenceTracker.detectLeaks();
                this.stats.leakCount = leaks.length;
            }

            // Update tracked objects count
            this.stats.trackedObjects =
                this.referenceTracker.getTrackedObjects().length;
        } catch (error) {
            this.handleError("performCleanup", error);
        }
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(): void {
        try {
            // Update pool hit rates
            const poolHitRates: Record<string, number> = {};
            for (const [name, pool] of this.pools.entries()) {
                const stats = pool.getStats();
                poolHitRates[name] = stats.hitRate;
            }
            this.performanceMetrics.poolHitRates = poolHitRates;

            // Calculate GC frequency (GCs per hour)
            const uptime = Date.now() - this.state.uptime;
            this.performanceMetrics.gcFrequency =
                (this.stats.gcCount / uptime) * 3600000;

            // Calculate memory efficiency
            const config = this.configManager.getConfig();
            this.performanceMetrics.memoryEfficiency =
                1 - this.stats.currentUsage / config.maxMemory;

            // Update average GC time
            this.performanceMetrics.averageGCTime = this.stats.averageGCTime;
        } catch (error) {
            this.handleError("updatePerformanceMetrics", error);
        }
    }

    /**
     * Update memory statistics
     */
    private updateMemoryStats(): void {
        try {
            const usage = this.getCurrentMemoryUsage();
            this.stats.currentUsage = usage.estimatedSize;
            this.stats.peakUsage = Math.max(
                this.stats.peakUsage,
                usage.estimatedSize
            );

            const config = this.configManager.getConfig();
            this.stats.pressure = usage.estimatedSize / config.maxMemory;

            // Update pool stats
            this.stats.poolStats = Array.from(this.pools.values()).map((pool) =>
                pool.getStats()
            );
        } catch (error) {
            this.handleError("updateMemoryStats", error);
        }
    }

    /**
     * Handle errors with proper logging and recovery
     */
    private handleError(operation: string, error: any): void {
        this.state.errorCount++;

        const errorMessage =
            error instanceof Error ? error.message : String(error);
        console.error(`Memory Manager Error in ${operation}:`, errorMessage);

        this.eventManager.emit(MemoryEventType.ERROR_OCCURRED, {
            operation,
            error: errorMessage,
            timestamp: Date.now(),
            errorCount: this.state.errorCount,
        });
    }

    // Public API methods

    /**
     * Register an object for memory tracking
     */
    public registerObject(obj: any, id: string): void {
        try {
            this.referenceTracker.addReference(obj, id);
            this.stats.totalAllocated += this.estimateObjectSize(obj);
        } catch (error) {
            this.handleError("registerObject", error);
        }
    }

    /**
     * Unregister an object from memory tracking
     */
    public unregisterObject(id: string): void {
        try {
            this.referenceTracker.removeReference(id);
            this.stats.trackedObjects = Math.max(
                0,
                this.stats.trackedObjects - 1
            );
        } catch (error) {
            this.handleError("unregisterObject", error);
        }
    }

    /**
     * Add reference to an object
     */
    public addReference(id: string): void {
        try {
            this.referenceTracker.addReference({}, id); // This needs to be fixed in the interface
        } catch (error) {
            this.handleError("addReference", error);
        }
    }

    /**
     * Remove reference from an object
     */
    public removeReference(id: string): void {
        try {
            this.referenceTracker.removeReference(id);
        } catch (error) {
            this.handleError("removeReference", error);
        }
    }

    /**
     * Create a memory pool for object reuse
     */
    public createPool<T>(config: PoolConfig<T>): MemoryPool<T> {
        try {
            if (this.pools.has(config.name)) {
                throw new Error(
                    `Pool with name '${config.name}' already exists`
                );
            }

            const pool = new AdvancedMemoryPool<T>(config, this.eventManager);
            this.pools.set(config.name, pool);

            return pool;
        } catch (error) {
            this.handleError("createPool", error);
            throw error;
        }
    }

    /**
     * Get memory pool by name
     */
    public getPool<T>(name: string): MemoryPool<T> | undefined {
        return this.pools.get(name) as MemoryPool<T>;
    }

    /**
     * Remove a memory pool
     */
    public removePool(name: string): boolean {
        const pool = this.pools.get(name);
        if (pool && "destroy" in pool && typeof pool.destroy === "function") {
            (pool as any).destroy();
        }
        return this.pools.delete(name);
    }

    /**
     * Get current memory statistics
     */
    public getStats(): Readonly<MemoryStats> {
        this.updateMemoryStats();
        return { ...this.stats };
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): Readonly<PerformanceMetrics> {
        this.updatePerformanceMetrics();
        return { ...this.performanceMetrics };
    }

    /**
     * Get memory manager state
     */
    public getState(): Readonly<MemoryManagerState> {
        return { ...this.state };
    }

    /**
     * Set memory limits
     */
    public setLimits(maxMemory: number, gcThreshold: number = 0.8): void {
        try {
            this.configManager.updateConfig({ maxMemory, gcThreshold });

            // Restart monitoring with new configuration
            this.startGCMonitoring();
        } catch (error) {
            this.handleError("setLimits", error);
            throw error;
        }
    }

    /**
     * Force garbage collection
     */
    public forceGC(): GCResult {
        this.eventManager.emit(MemoryEventType.GC_TRIGGERED, {
            trigger: "manual",
            timestamp: Date.now(),
        });

        return this.triggerGarbageCollection();
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
                return Object.keys(obj).length * 64; // Rough estimate
            default:
                return 64; // Default estimate
        }
    }

    /**
     * Get memory usage report
     */
    public getMemoryReport(): string {
        const stats = this.getStats();
        const state = this.getState();
        const config = this.configManager.getConfig();

        return `
Memory Manager Report:
=====================
Current Usage: ${this.formatBytes(stats.currentUsage)}
Peak Usage: ${this.formatBytes(stats.peakUsage)}
Total Allocated: ${this.formatBytes(stats.totalAllocated)}
Total Freed: ${this.formatBytes(stats.totalFreed)}
Memory Pressure: ${(stats.pressure * 100).toFixed(1)}%
GC Count: ${stats.gcCount}
Average GC Time: ${stats.averageGCTime.toFixed(2)}ms
Tracked Objects: ${stats.trackedObjects}
Memory Pools: ${this.pools.size}
Leak Count: ${stats.leakCount}

Configuration:
- Max Memory: ${this.formatBytes(config.maxMemory)}
- GC Threshold: ${(config.gcThreshold * 100).toFixed(1)}%
- GC Interval: ${(config.gcInterval / 1000).toFixed(1)}s
- Leak Detection: ${config.enableLeakDetection ? "Enabled" : "Disabled"}
- Performance Monitoring: ${
            config.enablePerformanceMonitoring ? "Enabled" : "Disabled"
        }

State:
- Running: ${state.isRunning}
- Uptime: ${this.formatDuration(Date.now() - state.uptime)}
- Active Monitors: ${state.activeMonitors}
- Error Count: ${state.errorCount}
        `.trim();
    }

    /**
     * Format bytes for human-readable output
     */
    private formatBytes(bytes: number): string {
        const units = ["B", "KB", "MB", "GB"];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Format duration for human-readable output
     */
    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Update configuration
     */
    public updateConfig(updates: Partial<MemoryManagerConfig>): void {
        try {
            this.configManager.updateConfig(updates);

            // Update components with new configuration
            const newConfig = this.configManager.getConfig();
            this.referenceTracker.updateConfig(newConfig);
            this.eventManager.updateConfig(newConfig);

            // Restart monitoring if intervals changed
            if (updates.gcInterval !== undefined) {
                this.startGCMonitoring();
            }
            if (updates.autoCleanupInterval !== undefined) {
                this.startCleanupMonitoring();
            }
        } catch (error) {
            this.handleError("updateConfig", error);
            throw error;
        }
    }

    /**
     * Get configuration
     */
    public getConfig(): Readonly<MemoryManagerConfig> {
        return this.configManager.getConfig();
    }

    /**
     * Add event listener
     */
    public on(type: MemoryEventType, listener: (event: any) => void): void {
        this.eventManager.on(type, listener);
    }

    /**
     * Remove event listener
     */
    public off(type: MemoryEventType, listener: (event: any) => void): void {
        this.eventManager.off(type, listener);
    }

    /**
     * Stop the memory manager
     */
    public stop(): void {
        if (!this.state.isRunning) {
            return;
        }

        this.state.isRunning = false;

        // Clear all intervals
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = undefined;
        }
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }

        this.state.activeMonitors = 0;

        this.eventManager.emit(MemoryEventType.CONFIG_UPDATED, {
            action: "stopped",
            timestamp: Date.now(),
        });
    }

    /**
     * Restart the memory manager
     */
    public restart(): void {
        this.stop();
        this.start();
    }

    /**
     * Destroy the memory manager and clean up all resources
     */
    public destroy(): void {
        this.stop();

        // Destroy all pools
        for (const [, pool] of this.pools.entries()) {
            if ("destroy" in pool && typeof pool.destroy === "function") {
                (pool as any).destroy();
            }
        }
        this.pools.clear();

        // Destroy components
        this.referenceTracker.destroy();
        this.eventManager.destroy();

        // Reset singleton instance
        AdvancedMemoryManager.instance = null as any;
    }

    /**
     * Initialize object collection tracking system
     */
    private initializeObjectTracking(): void {
        // Initialize FinalizationRegistry if available
        if (typeof FinalizationRegistry !== "undefined") {
            this.finalizationRegistry = new FinalizationRegistry(
                (objectId: string) => {
                    this.handleObjectFinalization(objectId);
                }
            );
        }

        // Set up periodic object tracking cleanup
        setInterval(() => {
            this.cleanupObjectTracker();
        }, 60000); // Every minute
    }

    /**
     * Track object collection during garbage collection
     */
    private trackObjectCollection(
        beforeUsage: number,
        afterUsage: number
    ): number {
        const memoryFreed = beforeUsage - afterUsage;
        const gcStartTime = Date.now();

        // Count objects that are no longer reachable
        let objectsCollected = 0;
        const typesCollected = new Map<string, number>();

        // Check weak references to see which objects were collected
        for (const [objectId, tracker] of this.objectTracker.entries()) {
            let collectedCount = 0;

            // Filter out collected weak references
            tracker.weakRefs = tracker.weakRefs.filter((weakRef) => {
                const obj = weakRef.deref();
                if (obj === undefined) {
                    collectedCount++;
                    return false;
                }
                return true;
            });

            if (collectedCount > 0) {
                objectsCollected += collectedCount;
                tracker.count -= collectedCount;

                // Track by type
                const currentTypeCount = typesCollected.get(tracker.type) || 0;
                typesCollected.set(
                    tracker.type,
                    currentTypeCount + collectedCount
                );

                // Remove tracker if no objects remain
                if (tracker.count <= 0) {
                    this.objectTracker.delete(objectId);
                }
            }
        }

        // Estimate objects collected based on memory freed if no direct tracking
        if (objectsCollected === 0 && memoryFreed > 0) {
            // Rough estimate: assume average object size of 1KB
            objectsCollected = Math.floor(memoryFreed / 1024);
        }

        // Record collection history
        const gcDuration = Date.now() - gcStartTime;
        this.collectionHistory.push({
            timestamp: Date.now(),
            objectsCollected,
            typesCollected,
            memoryFreed,
            gcDuration,
        });

        // Limit history size
        if (this.collectionHistory.length > 100) {
            this.collectionHistory.shift();
        }

        return objectsCollected;
    }

    /**
     * Register an object for tracking
     */
    public trackObject(
        obj: any,
        type: string = "unknown",
        estimatedSize: number = 0
    ): string {
        const objectId = this.generateObjectId();

        let tracker = this.objectTracker.get(type);
        if (!tracker) {
            tracker = {
                count: 0,
                totalSize: 0,
                lastSeen: Date.now(),
                type,
                weakRefs: [],
            };
            this.objectTracker.set(type, tracker);
        }

        // Create weak reference to track the object
        const weakRef = new WeakRef(obj);
        tracker.weakRefs.push(weakRef);
        tracker.count++;
        tracker.totalSize += estimatedSize;
        tracker.lastSeen = Date.now();

        // Register with FinalizationRegistry if available
        if (this.finalizationRegistry) {
            this.finalizationRegistry.register(obj, objectId);
        }

        return objectId;
    }

    /**
     * Handle object finalization
     */
    private handleObjectFinalization(objectId: string): void {
        // This is called when an object is finalized by the garbage collector
        // We can use this to get more accurate collection statistics
        console.debug(`Object finalized: ${objectId}`);
    }

    /**
     * Clean up object tracker by removing stale entries
     */
    private cleanupObjectTracker(): void {
        const now = Date.now();
        const staleThreshold = 300000; // 5 minutes

        for (const [type, tracker] of this.objectTracker.entries()) {
            // Remove stale weak references
            tracker.weakRefs = tracker.weakRefs.filter((weakRef) => {
                return weakRef.deref() !== undefined;
            });

            // Update count based on remaining weak references
            tracker.count = tracker.weakRefs.length;

            // Remove tracker if no objects remain and it's stale
            if (
                tracker.count === 0 &&
                now - tracker.lastSeen > staleThreshold
            ) {
                this.objectTracker.delete(type);
            }
        }
    }

    /**
     * Generate unique object ID
     */
    private generateObjectId(): string {
        return `obj_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 11)}`;
    }

    /**
     * Get object collection statistics
     */
    public getObjectCollectionStats(): {
        totalTracked: number;
        byType: Map<string, { count: number; totalSize: number }>;
        recentCollections: Array<{
            timestamp: number;
            objectsCollected: number;
            typesCollected: Map<string, number>;
            memoryFreed: number;
            gcDuration: number;
        }>;
        averageCollectionRate: number;
    } {
        const totalTracked = Array.from(this.objectTracker.values()).reduce(
            (sum, tracker) => sum + tracker.count,
            0
        );

        const byType = new Map();
        for (const [type, tracker] of this.objectTracker.entries()) {
            byType.set(type, {
                count: tracker.count,
                totalSize: tracker.totalSize,
            });
        }

        // Calculate average collection rate from recent history
        const recentCollections = this.collectionHistory.slice(-10);
        const averageCollectionRate =
            recentCollections.length > 0
                ? recentCollections.reduce(
                      (sum, entry) => sum + entry.objectsCollected,
                      0
                  ) / recentCollections.length
                : 0;

        return {
            totalTracked,
            byType,
            recentCollections: this.collectionHistory.slice(-20), // Last 20 collections
            averageCollectionRate,
        };
    }
}

