/**
 * Global type definitions for XyPrissSecurity
 *
 * This file contains polyfills and type definitions for modern JavaScript features
 * that may not be available in all environments.
 */

// Polyfill for environments that don't support WeakRef and FinalizationRegistry
declare global {
    interface WeakRef<T> {
        deref(): T | undefined;
    }

    interface FinalizationRegistry<T> {
        register(target: object, heldValue: T, unregisterToken?: object): void;
        unregister(unregisterToken: object): boolean;
    }

    const WeakRef: {
        new <T>(target: T): WeakRef<T>;
    };

    const FinalizationRegistry: {
        new <T>(
            cleanupCallback: (heldValue: T) => void
        ): FinalizationRegistry<T>;
    };
}

/**
 * Runtime polyfills for WeakRef and FinalizationRegistry
 */
export function initializePolyfills(): void {
    // Check if WeakRef is available
    if (typeof (globalThis as any).WeakRef === "undefined") {
        // Simple polyfill for WeakRef
        (globalThis as any).WeakRef = class WeakRef<T> {
            private target: T | undefined;

            constructor(target: T) {
                this.target = target;
            }

            deref(): T | undefined {
                return this.target;
            }
        };
    }

    // Check if FinalizationRegistry is available
    if (typeof (globalThis as any).FinalizationRegistry === "undefined") {
        // Simple polyfill for FinalizationRegistry
        (globalThis as any).FinalizationRegistry = class FinalizationRegistry<
            T
        > {
            private cleanupCallback: (heldValue: T) => void;
            private registrations = new Map<object, T>();

            constructor(cleanupCallback: (heldValue: T) => void) {
                this.cleanupCallback = cleanupCallback;
            }

            register(
                target: object,
                heldValue: T,
                unregisterToken?: object
            ): void {
                this.registrations.set(target, heldValue);

                // Simple timeout-based cleanup (not perfect but better than nothing)
                setTimeout(() => {
                    if (this.registrations.has(target)) {
                        this.cleanupCallback(heldValue);
                        this.registrations.delete(target);
                    }
                }, 30000); // 30 seconds
            }

            unregister(unregisterToken: object): boolean {
                return this.registrations.delete(unregisterToken);
            }
        };
    }
}

/**
 * Enhanced type constraints for better type safety
 */
export type StrictSecureValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | Uint8Array
    | Date
    | StrictSecureObject<any>
    | StrictSecureValue[]
    | { [key: string]: StrictSecureValue };

export type StrictSecureRecord<T = any> = {
    [K in keyof T]: T[K] extends StrictSecureValue ? T[K] : never;
};

/**
 * Memory management interface
 */
export interface MemoryManager {
    allocatedMemory: number;
    maxMemory: number;
    gcThreshold: number;
    lastGC: number;
    referenceCount: number;
    memoryPressure: number;
}

/**
 * Forward declaration for StrictSecureObject
 */
export interface StrictSecureObject<T> {
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): this;
    has<K extends keyof T>(key: K): boolean;
    delete<K extends keyof T>(key: K): boolean;
    destroy(): void;
}

export {};

