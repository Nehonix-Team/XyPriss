/**
 * Advanced Memory Management System for XyPrissSecurity
 *
 * Features:
 * - Modular architecture with separate components
 * - Advanced memory tracking and leak detection
 * - Configurable memory pools with different strategies
 * - Event-driven memory management
 * - Cross-platform compatibility (Node.js & Browser)
 * - Comprehensive error handling and validation
 * - Performance monitoring and optimization
 */

import { initializePolyfills } from "../types/global";

// Initialize polyfills for WeakRef and FinalizationRegistry
initializePolyfills();

/**
 * Memory statistics interface
 */
export interface MemoryStats {
    totalAllocated: number;
    totalFreed: number;
    currentUsage: number;
    peakUsage: number;
    gcCount: number;
    leakCount: number;
    pressure: number; // 0-1 scale
    poolStats: PoolStats[];
    trackedObjects: number;
    lastGC: number;
    averageGCTime: number;
}

/**
 * Pool statistics interface
 */
export interface PoolStats {
    name: string;
    size: number;
    capacity: number;
    hitRate: number;
    totalAcquisitions: number;
    totalReleases: number;
    strategy: PoolStrategy;
}

/**
 * Pool strategy enumeration
 */
export enum PoolStrategy {
    LIFO = "lifo", // Last In, First Out (stack-like)
    FIFO = "fifo", // First In, First Out (queue-like)
    LRU = "lru", // Least Recently Used
    ADAPTIVE = "adaptive", // Adaptive based on usage patterns
}

/**
 * Memory pool configuration
 */
export interface PoolConfig<T> {
    name: string;
    factory: () => T;
    reset: (item: T) => void;
    capacity: number;
    strategy: PoolStrategy;
    maxAge?: number; // Maximum age in milliseconds
    validator?: (item: T) => boolean;
    onAcquire?: (item: T) => void;
    onRelease?: (item: T) => void;
}

/**
 * Enhanced memory pool interface
 */
export interface MemoryPool<T> {
    acquire(): T;
    release(item: T): void;
    clear(): void;
    resize(newCapacity: number): void;
    getStats(): PoolStats;
    readonly size: number;
    readonly capacity: number;
    readonly strategy: PoolStrategy;
}

/**
 * Reference tracking interface
 */
export interface ReferenceTracker {
    addReference(obj: any, id: string): void;
    removeReference(id: string): void;
    getRefCount(id: string): number;
    cleanup(): void;
    getTrackedObjects(): string[];
    detectLeaks(): string[];
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
    maxMemory: number;
    gcThreshold: number;
    gcInterval: number;
    enableLeakDetection: boolean;
    enablePerformanceMonitoring: boolean;
    enableEventLogging: boolean;
    autoCleanupInterval: number;
    maxPoolAge: number;
}

/**
 * Memory event types
 */
export enum MemoryEventType {
    GC_TRIGGERED = "gc_triggered",
    GC_COMPLETED = "gc_completed",
    MEMORY_PRESSURE = "memory_pressure",
    LEAK_DETECTED = "leak_detected",
    POOL_CREATED = "pool_created",
    POOL_DESTROYED = "pool_destroyed",
    OBJECT_TRACKED = "object_tracked",
    OBJECT_RELEASED = "object_released",
}

/**
 * Memory event interface
 */
export interface MemoryEvent {
    type: MemoryEventType;
    timestamp: number;
    data?: any;
    metadata?: Record<string, any>;
}

/**
 * Memory event listener
 */
export type MemoryEventListener = (event: MemoryEvent) => void;

/**
 * Event manager for memory events
 */
class MemoryEventManager {
    private listeners = new Map<MemoryEventType, Set<MemoryEventListener>>();
    private eventHistory: MemoryEvent[] = [];
    private maxHistorySize = 1000;

    /**
     * Add event listener
     */
    on(type: MemoryEventType, listener: MemoryEventListener): void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);
    }

    /**
     * Remove event listener
     */
    off(type: MemoryEventType, listener: MemoryEventListener): void {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.listeners.delete(type);
            }
        }
    }

    /**
     * Emit event
     */
    emit(
        type: MemoryEventType,
        data?: any,
        metadata?: Record<string, any>
    ): void {
        const event: MemoryEvent = {
            type,
            timestamp: Date.now(),
            data,
            metadata,
        };

        // Add to history
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        // Notify listeners
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    listener(event);
                } catch (error) {
                    console.error(`Error in memory event listener:`, error);
                }
            });
        }
    }

    /**
     * Get event history
     */
    getHistory(type?: MemoryEventType): MemoryEvent[] {
        if (type) {
            return this.eventHistory.filter((event) => event.type === type);
        }
        return [...this.eventHistory];
    }

    /**
     * Clear event history
     */
    clearHistory(): void {
        this.eventHistory = [];
    }
}

/**
 * Configuration manager with validation
 */
class ConfigurationManager {
    private config: MemoryManagerConfig;

    constructor(config: Partial<MemoryManagerConfig> = {}) {
        this.config = this.validateAndMergeConfig(config);
    }

    /**
     * Validate and merge configuration
     */
    private validateAndMergeConfig(
        config: Partial<MemoryManagerConfig>
    ): MemoryManagerConfig {
        const defaults: MemoryManagerConfig = {
            maxMemory: 100 * 1024 * 1024, // 100MB
            gcThreshold: 0.8,
            gcInterval: 30000, // 30 seconds
            enableLeakDetection: true,
            enablePerformanceMonitoring: true,
            enableEventLogging: false,
            autoCleanupInterval: 60000, // 1 minute
            maxPoolAge: 300000, // 5 minutes
        };

        const merged = { ...defaults, ...config };

        // Validate configuration
        if (merged.maxMemory <= 0) {
            throw new Error("maxMemory must be greater than 0");
        }
        if (merged.gcThreshold < 0.1 || merged.gcThreshold > 1.0) {
            throw new Error("gcThreshold must be between 0.1 and 1.0");
        }
        if (merged.gcInterval < 1000) {
            throw new Error("gcInterval must be at least 1000ms");
        }

        return merged;
    }

    /**
     * Get configuration
     */
    getConfig(): Readonly<MemoryManagerConfig> {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<MemoryManagerConfig>): void {
        this.config = this.validateAndMergeConfig({
            ...this.config,
            ...updates,
        });
    }
}

