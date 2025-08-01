/**
 * Memory Management Types for XyPrissSecurity
 *
 * This file contains all type definitions for the memory management system
 */

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
    createdAt: number;
    lastUsed: number;
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
    readonly name: string;
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
    getObjectAge(id: string): number;
    getLastAccess(id: string): number;
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
    leakDetectionThreshold: number;
    maxEventHistory: number;
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
    CONFIG_UPDATED = "config_updated",
    ERROR_OCCURRED = "error_occurred",
}

/**
 * Memory event interface
 */
export interface MemoryEvent {
    type: MemoryEventType;
    timestamp: number;
    data?: any;
    metadata?: Record<string, any>;
    severity?: "low" | "medium" | "high" | "critical";
}

/**
 * Memory event listener
 */
export type MemoryEventListener = (event: MemoryEvent) => void;

/**
 * Memory usage estimation result
 */
export interface MemoryUsageEstimate {
    estimatedSize: number;
    confidence: number; // 0-1 scale
    method: "node" | "browser" | "fallback";
    breakdown?: {
        heap?: number;
        external?: number;
        tracked?: number;
    };
}

/**
 * Garbage collection result
 */
export interface GCResult {
    beforeUsage: number;
    afterUsage: number;
    freedMemory: number;
    duration: number;
    objectsCollected: number;
    poolsCleanedUp: number;
    success: boolean;
    error?: string;
}

/**
 * Leak detection result
 */
export interface LeakDetectionResult {
    leaks: string[];
    suspiciousObjects: string[];
    totalLeakedMemory: number;
    detectionTime: number;
    confidence: number;
}

/**
 * Pool item with metadata
 */
export interface PoolItem<T> {
    item: T;
    createdAt: number;
    lastUsed: number;
    usageCount: number;
}

/**
 * Memory pressure levels
 */
export enum MemoryPressureLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical",
}

/**
 * Memory pressure info
 */
export interface MemoryPressureInfo {
    level: MemoryPressureLevel;
    pressure: number;
    recommendation: string;
    shouldTriggerGC: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    averageGCTime: number;
    gcFrequency: number;
    memoryEfficiency: number;
    poolHitRates: Record<string, number>;
    leakDetectionAccuracy: number;
    systemLoad: number;
}

/**
 * Memory manager state
 */
export interface MemoryManagerState {
    isRunning: boolean;
    lastGC: number;
    nextScheduledGC: number;
    activeMonitors: number;
    errorCount: number;
    uptime: number;
}

/**
 * Error types for memory management
 */
export enum MemoryErrorType {
    ALLOCATION_FAILED = "allocation_failed",
    POOL_OVERFLOW = "pool_overflow",
    LEAK_DETECTED = "leak_detected",
    GC_FAILED = "gc_failed",
    CONFIG_INVALID = "config_invalid",
    TRACKER_ERROR = "tracker_error",
}

/**
 * Memory error interface
 */
export interface MemoryError extends Error {
    type: MemoryErrorType;
    timestamp: number;
    context?: Record<string, any>;
    recoverable: boolean;
}

