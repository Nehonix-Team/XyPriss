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

/**
 * Memory Management Module for XyPrissSecurity
 *
 * This module provides advanced memory management capabilities including:
 * - Object reference tracking with leak detection
 * - Configurable memory pools with multiple strategies
 * - Event-driven memory monitoring
 * - Cross-platform compatibility (Node.js & Browser)
 * - Comprehensive performance metrics
 */

// Export all types
export * from "./types";

// Export main components
export { MemoryEventManager } from "./event-manager";
export { ConfigurationManager } from "./config-manager";
export { AdvancedReferenceTracker } from "./reference-tracker";
export { AdvancedMemoryPool } from "./memory-pool";
export { AdvancedMemoryManager } from "./memory-manager";

// Create and export singleton instance
import { AdvancedMemoryManager } from "./memory-manager";

/**
 * Global memory manager instance
 *
 * This is the main entry point for memory management in XyPrissSecurity.
 * It provides a singleton instance that can be used throughout the application.
 */
export const memoryManager = AdvancedMemoryManager.getInstance();

/**
 * Create a new memory manager instance with custom configuration
 *
 * @param config - Custom configuration for the memory manager
 * @returns New memory manager instance
 */
export function createMemoryManager(config?: any) {
    return AdvancedMemoryManager.getInstance(config);
}

/**
 * Utility functions for memory management
 */
export const MemoryUtils = {
    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes: number): string {
        const units = ["B", "KB", "MB", "GB"];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    },

    /**
     * Format duration to human-readable string
     */
    formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    },

    /**
     * Estimate object size in bytes
     */
    estimateObjectSize(obj: any): number {
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
                        (sum, item) =>
                            sum + MemoryUtils.estimateObjectSize(item),
                        0
                    );
                }
                return Object.keys(obj).length * 64; // Rough estimate
            default:
                return 64; // Default estimate
        }
    },

    /**
     * Check if current environment supports advanced memory features
     */
    supportsAdvancedFeatures(): boolean {
        return (
            typeof WeakRef !== "undefined" &&
            typeof FinalizationRegistry !== "undefined"
        );
    },

    /**
     * Get current memory usage (Node.js only)
     */
    getCurrentMemoryUsage(): any {
        if (typeof process !== "undefined" && process.memoryUsage) {
            return process.memoryUsage();
        }
        return null;
    },

    /**
     * Force garbage collection if available
     */
    forceGC(): boolean {
        if (typeof global !== "undefined" && (global as any).gc) {
            (global as any).gc();
            return true;
        }
        return false;
    },
};

/**
 * Memory management decorators and helpers
 */
export const MemoryDecorators = {
    /**
     * Decorator to automatically track object lifecycle
     */
    tracked(id?: string) {
        return function (
            target: any,
            propertyKey?: string,
            descriptor?: PropertyDescriptor
        ) {
            const objectId = id || `${target.constructor.name}_${Date.now()}`;

            if (descriptor) {
                // Method decorator
                const originalMethod = descriptor.value;
                descriptor.value = function (...args: any[]) {
                    memoryManager.registerObject(
                        this,
                        `${objectId}_${propertyKey}`
                    );
                    try {
                        return originalMethod.apply(this, args);
                    } finally {
                        memoryManager.removeReference(
                            `${objectId}_${propertyKey}`
                        );
                    }
                };
            } else {
                // Class decorator
                const originalConstructor = target;
                const newConstructor = function (...args: any[]) {
                    const instance = new originalConstructor(...args);
                    memoryManager.registerObject(instance, objectId);
                    return instance;
                };
                newConstructor.prototype = originalConstructor.prototype;
                return newConstructor;
            }
        };
    },

    /**
     * Decorator to automatically use memory pool for object creation
     */
    pooled(poolName: string) {
        return function (target: any) {
            const originalConstructor = target;
            const newConstructor = function (...args: any[]) {
                const pool = memoryManager.getPool(poolName);
                if (pool) {
                    const instance = pool.acquire();
                    // Initialize with constructor logic
                    originalConstructor.apply(instance, args);
                    return instance;
                } else {
                    return new originalConstructor(...args);
                }
            };
            newConstructor.prototype = originalConstructor.prototype;
            return newConstructor;
        };
    },
};

/**
 * Quick setup functions for common use cases
 */
export const MemorySetup = {
    /**
     * Setup memory management for development (verbose logging, frequent GC)
     */
    development() {
        memoryManager.updateConfig({
            enableEventLogging: true,
            enableLeakDetection: true,
            enablePerformanceMonitoring: true,
            gcInterval: 10000, // 10 seconds
            gcThreshold: 0.7,
        });
    },

    /**
     * Setup memory management for production (optimized for performance)
     */
    production() {
        memoryManager.updateConfig({
            enableEventLogging: false,
            enableLeakDetection: true,
            enablePerformanceMonitoring: false,
            gcInterval: 60000, // 1 minute
            gcThreshold: 0.85,
        });
    },

    /**
     * Setup memory management for testing (minimal overhead)
     */
    testing() {
        memoryManager.updateConfig({
            enableEventLogging: false,
            enableLeakDetection: false,
            enablePerformanceMonitoring: false,
            gcInterval: 30000, // 30 seconds
            gcThreshold: 0.9,
        });
    },

    /**
     * Setup memory management for high-performance applications
     */
    highPerformance() {
        memoryManager.updateConfig({
            enableEventLogging: false,
            enableLeakDetection: false,
            enablePerformanceMonitoring: true,
            gcInterval: 120000, // 2 minutes
            gcThreshold: 0.9,
            maxMemory: 500 * 1024 * 1024, // 500MB
        });
    },
};

// Default export
export default {
    memoryManager,
    createMemoryManager,
    MemoryUtils,
    MemoryDecorators,
    MemorySetup,
};

