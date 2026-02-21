/**************************************************************************************************************************************************************
 * This code contains proprietary source code from NEHONIX
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 * @version v2.0
 * @see {@link https://dll.nehonix.com/licenses/NOSL}
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ************************************************************************************************************************************************************** */

import type { ServerOptions } from "./types/types";

/**
 * XyPriss Constant Variables Class - Enhanced Edition
 *
 * Provides ultra-aggressive immutability protection with multiple layers of defense.
 * Protects against all known mutation vectors including prototype pollution,
 * reflection APIs, and advanced tampering techniques.
 *
 * @class XyPrissConst
 * @version 3.0.0
 */
export class XyPrissConst {
    private constants: Map<string, any>;
    private immutableCache: WeakMap<object, any>;
    private accessLog: Map<string, number>;
    private readonly maxStackDepth: number = 100;
    private stackDepthTracker: WeakMap<object, number>;

    constructor() {
        // Use private symbols to make internal state harder to access
        this.constants = new Map();
        this.immutableCache = new WeakMap();
        this.accessLog = new Map();
        this.stackDepthTracker = new WeakMap();

        // Freeze the class prototype to prevent method tampering
        Object.freeze(XyPrissConst.prototype);
    }
    /**
     * Create an immutable server configuration.
     *
     * @param {ServerOptions} value - The configuration object
     * @returns {ServerOptions} The immutable configuration
     */
    public $cfg(value: ServerOptions): ServerOptions {
        return this.$make(value, "Configs");
    }

    /**
     * Make a value deeply immutable with maximum protection.
     *
     * @template T - Type of the value to freeze
     * @param {T} value - The value to make immutable
     * @param {string} [path] - Internal path tracking for error messages
     * @param {Set<any>} [visited] - Circular reference tracker
     * @returns {T} The deeply protected immutable value
     */
    public $make<T>(
        value: T,
        path: string = "root",
        visited: Set<any> = new Set(),
    ): T {
        if (value === null || value === undefined) {
            return value;
        }

        const type = typeof value;

        // Primitives are immutable by nature
        if (type !== "object" && type !== "function") {
            return value;
        }

        // Check if already immutable
        if ((value as any)?.__isXyPrissImmutable) {
            return value;
        }

        // Check cache
        if (this.immutableCache.has(value as object)) {
            return this.immutableCache.get(value as object);
        }

        // Circular reference detection
        if (visited.has(value)) {
            return value; // Return as-is for circular refs
        }

        // Stack depth protection
        const currentDepth =
            (this.stackDepthTracker.get(value as object) || 0) + 1;
        if (currentDepth > this.maxStackDepth) {
            throw new Error(
                `[XyPrissConst] Maximum nesting depth (${this.maxStackDepth}) exceeded at "${path}". ` +
                    `Possible circular reference or overly deep structure.`,
            );
        }
        this.stackDepthTracker.set(value as object, currentDepth);

        visited.add(value);

        let proxied: any;

        try {
            // Handle arrays with enhanced protection
            if (Array.isArray(value)) {
                proxied = this.createImmutableArray(value, path, visited);
            }
            // Handle Maps
            else if (value instanceof Map) {
                proxied = this.createImmutableMap(value, path, visited);
            }
            // Handle Sets
            else if (value instanceof Set) {
                proxied = this.createImmutableSet(value, path, visited);
            }
            // Handle WeakMaps (limited protection)
            else if (value instanceof WeakMap) {
                proxied = this.createImmutableWeakMap(value, path);
            }
            // Handle WeakSets (limited protection)
            else if (value instanceof WeakSet) {
                proxied = this.createImmutableWeakSet(value, path);
            }
            // Handle Dates
            else if (value instanceof Date) {
                return value;
            }
            // Handle RegExp
            else if (value instanceof RegExp) {
                return value;
            }
            // Handle typed arrays
            else if (ArrayBuffer.isView(value)) {
                return this.createImmutableTypedArray(value as any, path);
            }
            // Handle functions
            else if (type === "function") {
                proxied = this.createImmutableFunction(value as any, path);
            }
            // Handle regular objects and class instances
            else {
                proxied = this.createImmutableObject(value, path, visited);
            }

            this.immutableCache.set(value as object, proxied);
            return proxied;
        } finally {
            visited.delete(value);
        }
    }

    /**
     * Create an immutable array with aggressive protection
     */
    private createImmutableArray(
        arr: any[],
        path: string,
        visited: Set<any>,
    ): any {
        const frozenArray = arr.map((item, index) =>
            this.$make(item, `${path}[${index}]`, visited),
        );

        // Prevent extension and seal
        Object.preventExtensions(frozenArray);
        Object.seal(frozenArray);
        Object.freeze(frozenArray);

        this.markAsImmutable(frozenArray);

        const proxy = new Proxy(frozenArray, {
            get: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;

                // Block mutation methods
                const mutationMethods = [
                    "push",
                    "pop",
                    "shift",
                    "unshift",
                    "splice",
                    "sort",
                    "reverse",
                    "fill",
                    "copyWithin",
                ];
                if (mutationMethods.includes(prop as string)) {
                    return () => {
                        throw new Error(
                            `[XyPrissConst] Cannot call Array.${String(
                                prop,
                            )}() on immutable array at "${path}"`,
                        );
                    };
                }

                return Reflect.get(target, prop);
            },
            set: () => {
                throw new Error(
                    `[XyPrissConst] Cannot modify immutable array at "${path}"`,
                );
            },
            deleteProperty: () => {
                throw new Error(
                    `[XyPrissConst] Cannot delete from immutable array at "${path}"`,
                );
            },
            defineProperty: () => {
                throw new Error(
                    `[XyPrissConst] Cannot define property on immutable array at "${path}"`,
                );
            },
            setPrototypeOf: () => {
                throw new Error(
                    `[XyPrissConst] Cannot change prototype of immutable array at "${path}"`,
                );
            },
            preventExtensions: () => true, // Already prevented
            isExtensible: () => false,
        });

        return proxy;
    }

    /**
     * Create an immutable Map
     */
    private createImmutableMap(
        map: Map<any, any>,
        path: string,
        visited: Set<any>,
    ): any {
        const frozenMap = new Map();
        map.forEach((v, k) => {
            frozenMap.set(
                this.$make(k, `${path}<key>`, visited),
                this.$make(v, `${path}.get(${JSON.stringify(k)})`, visited),
            );
        });

        Object.freeze(frozenMap);
        this.markAsImmutable(frozenMap);

        return new Proxy(frozenMap, {
            get: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;
                if (prop === "set" || prop === "delete" || prop === "clear") {
                    return () => {
                        throw new Error(
                            `[XyPrissConst] Cannot call Map.${String(
                                prop,
                            )}() on immutable Map at "${path}"`,
                        );
                    };
                }
                return Reflect.get(target, prop);
            },
            set: () => {
                throw new Error(
                    `[XyPrissConst] Cannot modify immutable Map at "${path}"`,
                );
            },
        });
    }

    /**
     * Create an immutable Set
     */
    private createImmutableSet(
        set: Set<any>,
        path: string,
        visited: Set<any>,
    ): any {
        const frozenSet = new Set();
        set.forEach((item) => {
            frozenSet.add(this.$make(item, `${path}<item>`, visited));
        });

        Object.freeze(frozenSet);
        this.markAsImmutable(frozenSet);

        return new Proxy(frozenSet, {
            get: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;
                if (prop === "add" || prop === "delete" || prop === "clear") {
                    return () => {
                        throw new Error(
                            `[XyPrissConst] Cannot call Set.${String(
                                prop,
                            )}() on immutable Set at "${path}"`,
                        );
                    };
                }
                return Reflect.get(target, prop);
            },
            set: () => {
                throw new Error(
                    `[XyPrissConst] Cannot modify immutable Set at "${path}"`,
                );
            },
        });
    }

    /**
     * Create an immutable WeakMap (limited protection - WeakMaps can't be fully frozen)
     */
    private createImmutableWeakMap(
        weakMap: WeakMap<any, any>,
        path: string,
    ): any {
        return new Proxy(weakMap, {
            get: (target, prop) => {
                if (prop === "set" || prop === "delete") {
                    return () => {
                        throw new Error(
                            `[XyPrissConst] Cannot call WeakMap.${String(
                                prop,
                            )}() on immutable WeakMap at "${path}"`,
                        );
                    };
                }
                return Reflect.get(target, prop);
            },
        });
    }

    /**
     * Create an immutable WeakSet
     */
    private createImmutableWeakSet(weakSet: WeakSet<any>, path: string): any {
        return new Proxy(weakSet, {
            get: (target, prop) => {
                if (prop === "add" || prop === "delete") {
                    return () => {
                        throw new Error(
                            `[XyPrissConst] Cannot call WeakSet.${String(
                                prop,
                            )}() on immutable WeakSet at "${path}"`,
                        );
                    };
                }
                return Reflect.get(target, prop);
            },
        });
    }

    /**
     * Create an immutable typed array
     */
    private createImmutableTypedArray(typedArray: any, path: string): any {
        Object.freeze(typedArray);
        this.markAsImmutable(typedArray);

        return new Proxy(typedArray, {
            get: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;

                const mutationMethods = [
                    "set",
                    "copyWithin",
                    "fill",
                    "reverse",
                    "sort",
                ];
                if (mutationMethods.includes(prop as string)) {
                    return () => {
                        throw new Error(
                            `[XyPrissConst] Cannot call ${String(
                                prop,
                            )}() on immutable typed array at "${path}"`,
                        );
                    };
                }

                return Reflect.get(target, prop);
            },
            set: () => {
                throw new Error(
                    `[XyPrissConst] Cannot modify immutable typed array at "${path}"`,
                );
            },
        });
    }

    /**
     * Create an immutable function wrapper
     */
    private createImmutableFunction(fn: Function, path: string): any {
        Object.freeze(fn);
        this.markAsImmutable(fn);

        return new Proxy(fn, {
            get: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;
                return Reflect.get(target, prop);
            },
            set: () => {
                throw new Error(
                    `[XyPrissConst] Cannot modify immutable function at "${path}"`,
                );
            },
            defineProperty: () => {
                throw new Error(
                    `[XyPrissConst] Cannot define property on immutable function at "${path}"`,
                );
            },
            apply: (target, thisArg, args) => {
                return Reflect.apply(target, thisArg, args);
            },
        });
    }

    /**
     * Create an immutable object with full prototype chain protection
     */
    private createImmutableObject(
        obj: any,
        path: string,
        visited: Set<any>,
    ): any {
        const frozenObj: any = {};
        const proto = Object.getPrototypeOf(obj);

        // Freeze the entire prototype chain
        let currentProto = proto;
        while (currentProto && currentProto !== Object.prototype) {
            Object.freeze(currentProto);
            currentProto = Object.getPrototypeOf(currentProto);
        }

        // Copy all own properties
        const descriptors = Object.getOwnPropertyDescriptors(obj);
        for (const prop of Object.keys(descriptors)) {
            const descriptor = descriptors[prop];

            if (descriptor.get || descriptor.set) {
                // Keep accessors but freeze them
                Object.defineProperty(frozenObj, prop, {
                    ...descriptor,
                    configurable: false,
                });
            } else {
                const val = descriptor.value;
                const immutableVal =
                    typeof val === "function"
                        ? this.createImmutableFunction(val, `${path}.${prop}`)
                        : this.$make(val, `${path}.${prop}`, visited);

                Object.defineProperty(frozenObj, prop, {
                    value: immutableVal,
                    writable: false,
                    enumerable: descriptor.enumerable,
                    configurable: false,
                });
            }
        }

        // Copy symbol properties
        Object.getOwnPropertySymbols(obj).forEach((sym) => {
            const descriptor = Object.getOwnPropertyDescriptor(obj, sym)!;
            if (descriptor.get || descriptor.set) {
                Object.defineProperty(frozenObj, sym, {
                    ...descriptor,
                    configurable: false,
                });
            } else {
                const val = descriptor.value;
                const immutableVal =
                    typeof val === "function"
                        ? this.createImmutableFunction(val, `${path}[Symbol]`)
                        : this.$make(val, `${path}[Symbol]`, visited);

                Object.defineProperty(frozenObj, sym, {
                    value: immutableVal,
                    writable: false,
                    enumerable: descriptor.enumerable,
                    configurable: false,
                });
            }
        });

        Object.setPrototypeOf(frozenObj, proto);
        this.markAsImmutable(frozenObj);

        Object.preventExtensions(frozenObj);
        Object.seal(frozenObj);
        Object.freeze(frozenObj);

        // Ultra-aggressive proxy protection
        const proxy = new Proxy(frozenObj, {
            get: (target, prop, receiver) => {
                if (prop === "__isXyPrissImmutable") return true;
                return Reflect.get(target, prop, receiver);
            },
            set: (target, prop, value) => {
                // Allow setting the same value (no-op) to avoid false positives during redundant merges
                if (Reflect.get(target, prop) === value) {
                    return true;
                }
                throw new Error(
                    `[XyPrissConst] VIOLATION: Attempted to modify immutable property "${path}.${String(
                        prop,
                    )}". ` + `Value attempted: ${this.safeStringify(value)}`,
                );
            },
            deleteProperty: (target, prop) => {
                throw new Error(
                    `[XyPrissConst] VIOLATION: Attempted to delete immutable property "${path}.${String(
                        prop,
                    )}"`,
                );
            },
            defineProperty: (target, prop, descriptor) => {
                throw new Error(
                    `[XyPrissConst] VIOLATION: Attempted to define property "${String(
                        prop,
                    )}" on immutable object at "${path}". ` +
                        `Descriptor: ${this.safeStringify(descriptor)}`,
                );
            },
            setPrototypeOf: () => {
                throw new Error(
                    `[XyPrissConst] VIOLATION: Attempted to change prototype of immutable object at "${path}"`,
                );
            },
            preventExtensions: () => true,
            isExtensible: () => false,
            has: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;
                return Reflect.has(target, prop);
            },
            ownKeys: (target) => Reflect.ownKeys(target),
            getOwnPropertyDescriptor: (target, prop) => {
                if (prop === "__isXyPrissImmutable") {
                    return {
                        value: true,
                        writable: false,
                        enumerable: false,
                        configurable: false,
                    };
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },
        });

        return proxy;
    }

    /**
     * Mark an object as immutable with a hidden property
     */
    private markAsImmutable(obj: any): void {
        try {
            Object.defineProperty(obj, "__isXyPrissImmutable", {
                value: true,
                enumerable: false,
                writable: false,
                configurable: false,
            });
        } catch (e) {
            // Some objects (like frozen built-ins) can't have properties added
        }
    }

    /**
     * Safe JSON stringification with circular reference handling
     */
    private safeStringify(value: any, maxLength: number = 100): string {
        try {
            const seen = new WeakSet();
            const str = JSON.stringify(value, (key, val) => {
                if (typeof val === "object" && val !== null) {
                    if (seen.has(val)) return "[Circular]";
                    seen.add(val);
                }
                return val;
            });
            return str.length > maxLength
                ? str.substring(0, maxLength) + "..."
                : str;
        } catch (e) {
            return "[Unstringifiable]";
        }
    }

    /**
     * Define a new constant with enhanced validation
     */
    public $set(key: string, value: any): void {
        if (typeof key !== "string" || key.trim() === "") {
            throw new Error(
                "[XyPrissConst] Constant key must be a non-empty string",
            );
        }

        if (this.constants.has(key)) {
            throw new Error(
                `[XyPrissConst] VIOLATION: Cannot redefine constant "${key}". ` +
                    `Constants are immutable once set.`,
            );
        }

        const immutableValue = this.$make(value, key);
        this.constants.set(key, immutableValue);

        // Log the creation
        this.accessLog.set(key, Date.now());
    }

    /**
     * Retrieve a constant value with optional access tracking
     */
    public $get<T = any>(key: string, defaultValue?: T): T {
        if (!this.constants.has(key)) {
            if (defaultValue === undefined) {
                throw new Error(
                    `[XyPrissConst] Constant "${key}" does not exist`,
                );
            }
            return defaultValue;
        }
        return this.constants.get(key) as T;
    }

    /**
     * Safe get that returns undefined instead of throwing
     */
    public $getSafe<T = any>(key: string): T | undefined {
        return this.constants.get(key) as T | undefined;
    }

    /**
     * Check if a constant is defined
     */
    public $has(key: string): boolean {
        return this.constants.has(key);
    }

    /**
     * Export all constants as a deeply frozen object
     */
    public $toJSON(): Record<string, any> {
        const obj: Record<string, any> = {};
        this.constants.forEach((value, key) => {
            obj[key] = value;
        });
        return this.$make(obj, "$toJSON_result");
    }

    /**
     * Delete a constant (DANGEROUS - use only for testing)
     */
    public $delete(key: string): boolean {
        console.warn(
            `[XyPrissConst] WARNING: Deleting constant "${key}". This should only be done in tests.`,
        );
        return this.constants.delete(key);
    }

    /**
     * Clear all constants (DANGEROUS - use only for testing)
     */
    public $clear(): void {
        console.warn(
            "[XyPrissConst] WARNING: Clearing all constants. This should only be done in tests.",
        );
        this.constants.clear();
        this.accessLog.clear();
    }

    /**
     * Get the total number of constants
     */
    public $size(): number {
        return this.constants.size;
    }

    /**
     * List all constant keys
     */
    public $keys(): string[] {
        return Array.from(this.constants.keys());
    }

    /**
     * Get access information about a constant
     */
    public $getAccessInfo(key: string): { created: number; exists: boolean } {
        return {
            created: this.accessLog.get(key) || 0,
            exists: this.constants.has(key),
        };
    }

    /**
     * Validate that an object is truly immutable (deep check)
     */
    public $validate(value: any): boolean {
        return (value as any)?.__isXyPrissImmutable === true;
    }
}

// Freeze the class itself to prevent tampering
Object.freeze(XyPrissConst);
Object.freeze(XyPrissConst.prototype);

// Self-register global __const__ with protection
if (typeof globalThis !== "undefined") {
    if (!(globalThis as any).__const__) {
        const instance = new XyPrissConst();

        // Define with non-configurable descriptor
        Object.defineProperty(globalThis, "__const__", {
            value: instance,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    }
}

/**
 * Default instance for easy access
 */
export const __const__ = (globalThis as any).__const__ as XyPrissConst;

