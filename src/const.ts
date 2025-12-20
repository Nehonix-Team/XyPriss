/**
 * XyPriss Constant Variables Class
 *
 * Provides a mechanism to store immutable values that cannot be changed once set.
 * This is useful for protecting critical application constants from being
 * modified by plugins or other modules at runtime.
 *
 * @class XyPrissConst
 * @version 2.0.0
 */
export class XyPrissConst {
    private constants: Map<string, any> = new Map();
    private immutableCache: WeakMap<object, any> = new WeakMap();

    /**
     * Make a value deeply immutable using Proxy protection.
     * This ACTIVELY blocks any modification attempts with clear error messages.
     * Works with objects, arrays, Maps, Sets, and nested structures.
     *
     * @template T - Type of the value to freeze
     * @param {T} value - The value to make immutable
     * @param {string} [path] - Internal path tracking for error messages
     * @returns {T} The deeply protected immutable value
     *
     * @example
     * ```typescript
     * const config = __const__.$make({
     *   server: { port: 8080, host: 'localhost' },
     *   features: ['auth', 'logging']
     * });
     * config.server.port = 9000; // ❌ THROWS ERROR IMMEDIATELY
     * ```
     */
    public $make<T>(value: T, path: string = "root"): T {
        if (value === null || value === undefined) {
            return value;
        }

        const type = typeof value;

        // Primitives are immutable by nature
        if (type !== "object" && type !== "function") {
            return value;
        }

        // Check if it's already one of our immutable proxies
        if ((value as any)?.__isXyPrissImmutable) {
            return value;
        }

        // Check cache to avoid re-wrapping
        if (this.immutableCache.has(value as object)) {
            return this.immutableCache.get(value as object);
        }

        // Freeze the original object
        Object.freeze(value);

        let proxied: any;

        // Handle arrays
        if (Array.isArray(value)) {
            const frozenArray = value.map((item, index) =>
                this.$make(item, `${path}[${index}]`)
            );

            proxied = new Proxy(frozenArray, {
                get: (target, prop) => {
                    if (prop === "__isXyPrissImmutable") return true;
                    return (target as any)[prop];
                },
                set: (target, prop, val) => {
                    throw new Error(
                        `[XyPrissConst] Cannot modify immutable array at "${path}.${String(
                            prop
                        )}". ` +
                            `Attempted to set value: ${JSON.stringify(val)}`
                    );
                },
                deleteProperty: (target, prop) => {
                    throw new Error(
                        `[XyPrissConst] Cannot delete property "${String(
                            prop
                        )}" from immutable array at "${path}"`
                    );
                },
                defineProperty: (target, prop) => {
                    throw new Error(
                        `[XyPrissConst] Cannot define property "${String(
                            prop
                        )}" on immutable array at "${path}"`
                    );
                },
            });

            this.immutableCache.set(value as object, proxied);
            return proxied;
        }

        // Handle Maps
        if (value instanceof Map) {
            const frozenMap = new Map();
            value.forEach((v, k) => {
                frozenMap.set(
                    this.$make(k, `${path}<key>`),
                    this.$make(v, `${path}.get("${k}")`)
                );
            });

            proxied = new Proxy(frozenMap, {
                get: (target, prop) => {
                    if (prop === "__isXyPrissImmutable") return true;
                    if (
                        prop === "set" ||
                        prop === "delete" ||
                        prop === "clear"
                    ) {
                        return () => {
                            throw new Error(
                                `[XyPrissConst] Cannot call Map.${String(
                                    prop
                                )}() on immutable Map at "${path}"`
                            );
                        };
                    }
                    return (target as any)[prop];
                },
            });

            this.immutableCache.set(value as object, proxied);
            return proxied;
        }

        // Handle Sets
        if (value instanceof Set) {
            const frozenSet = new Set();
            value.forEach((item) => {
                frozenSet.add(this.$make(item, `${path}<item>`));
            });

            proxied = new Proxy(frozenSet, {
                get: (target, prop) => {
                    if (prop === "__isXyPrissImmutable") return true;
                    if (
                        prop === "add" ||
                        prop === "delete" ||
                        prop === "clear"
                    ) {
                        return () => {
                            throw new Error(
                                `[XyPrissConst] Cannot call Set.${String(
                                    prop
                                )}() on immutable Set at "${path}"`
                            );
                        };
                    }
                    return (target as any)[prop];
                },
            });

            this.immutableCache.set(value as object, proxied);
            return proxied;
        }

        // Handle Dates - return as is (already immutable)
        if (value instanceof Date) {
            return value;
        }

        // Handle regular objects and class instances
        const frozenObj: any = {};
        const proto = Object.getPrototypeOf(value);

        // Copy all properties recursively
        Object.getOwnPropertyNames(value).forEach((prop) => {
            const descriptor = Object.getOwnPropertyDescriptor(value, prop);
            if (descriptor && descriptor.value !== undefined) {
                if (typeof descriptor.value === "function") {
                    // Keep methods as-is
                    frozenObj[prop] = descriptor.value;
                } else {
                    // Recursively protect nested values
                    frozenObj[prop] = this.$make(
                        descriptor.value,
                        `${path}.${prop}`
                    );
                }
            }
        });

        // Copy symbol properties
        Object.getOwnPropertySymbols(value).forEach((sym) => {
            const descriptor = Object.getOwnPropertyDescriptor(value, sym);
            if (descriptor && descriptor.value !== undefined) {
                if (typeof descriptor.value !== "function") {
                    frozenObj[sym] = this.$make(
                        descriptor.value,
                        `${path}[Symbol]`
                    );
                } else {
                    frozenObj[sym] = descriptor.value;
                }
            }
        });

        // Set the prototype
        Object.setPrototypeOf(frozenObj, proto);
        Object.freeze(frozenObj);

        // Wrap in Proxy for active protection
        proxied = new Proxy(frozenObj, {
            get: (target, prop) => {
                if (prop === "__isXyPrissImmutable") return true;
                return (target as any)[prop];
            },
            set: (target, prop, val) => {
                const errorMsg =
                    `[XyPrissConst] Cannot modify immutable property "${path}.${String(
                        prop
                    )}". ` + `Attempted to set value: ${JSON.stringify(val)}`;
                throw new Error(errorMsg);
            },
            deleteProperty: (target, prop) => {
                throw new Error(
                    `[XyPrissConst] Cannot delete immutable property "${path}.${String(
                        prop
                    )}"`
                );
            },
            defineProperty: (target, prop) => {
                throw new Error(
                    `[XyPrissConst] Cannot define property "${String(
                        prop
                    )}" on immutable object at "${path}"`
                );
            },
            setPrototypeOf: () => {
                throw new Error(
                    `[XyPrissConst] Cannot change prototype of immutable object at "${path}"`
                );
            },
        });

        this.immutableCache.set(value as object, proxied);
        return proxied;
    }

    /**
     * Define a new constant.
     * Throws an error if the constant is already defined.
     * Automatically makes the value deeply immutable.
     *
     * @param {string} key - The unique identifier for the constant
     * @param {any} value - The value to store (will be made immutable)
     * @throws {Error} If the key already exists
     *
     * @example
     * ```typescript
     * __const__.$set('APP_CONFIG', {
     *   database: { host: 'localhost', port: 5432 }
     * });
     * ```
     */
    public $set(key: string, value: any): void {
        if (this.constants.has(key)) {
            throw new Error(
                `[XyPrissConst] Cannot redefine constant "${key}". Constants are immutable.`
            );
        }

        // Make the value deeply immutable before storing
        const immutableValue = this.$make(value, key);
        this.constants.set(key, immutableValue);
    }

    /**
     * Retrieve a constant value.
     *
     * @template T - Expected type of the constant
     * @param {string} key - The identifier of the constant
     * @param {T} [defaultValue] - Optional fallback value if not found
     * @returns {T} The constant value or default
     *
     * @example
     * ```typescript
     * const appId = __const__.$get('APP_ID');
     * ```
     */
    public $get<T = any>(key: string, defaultValue?: T): T {
        return (
            this.constants.has(key) ? this.constants.get(key) : defaultValue
        ) as T;
    }

    /**
     * Check if a constant is defined.
     *
     * @param {string} key - The identifier to check
     * @returns {boolean} True if the constant exists
     */
    public $has(key: string): boolean {
        return this.constants.has(key);
    }

    /**
     * Export all constants as a plain object.
     * Note: Returns a frozen snapshot, not the proxy-protected originals.
     *
     * @returns {Record<string, any>}
     */
    public $toJSON(): Record<string, any> {
        const obj = Object.fromEntries(this.constants);
        return Object.freeze(obj);
    }

    /**
     * Delete a constant (use with extreme caution).
     * This is primarily for testing purposes.
     *
     * @param {string} key - The identifier to delete
     * @returns {boolean} True if the constant was deleted
     */
    public $delete(key: string): boolean {
        return this.constants.delete(key);
    }

    /**
     * Clear all constants (use with extreme caution).
     * This is primarily for testing purposes.
     */
    public $clear(): void {
        this.constants.clear();
    }

    /**
     * Get the total number of constants stored.
     *
     * @returns {number} The count of constants
     */
    public $size(): number {
        return this.constants.size;
    }

    /**
     * List all constant keys.
     *
     * @returns {string[]} Array of all constant keys
     */
    public $keys(): string[] {
        return Array.from(this.constants.keys());
    }
}

