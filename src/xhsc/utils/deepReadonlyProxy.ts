/**
 * **Deep Immutability Proxy for `__sys__`**
 *
 * Wraps the `XyPrissXHSC` singleton (and all its nested sub-APIs) in a
 * recursive `Proxy` that intercepts and denies every mutation attempt at
 * runtime.
 *
 * ### Intercepted traps
 * - `set`            — blocks `obj.prop = value`
 * - `deleteProperty` — blocks `delete obj.prop`
 * - `defineProperty` — blocks `Object.defineProperty(obj, ...)`
 *
 * ### Why a "deep" proxy?
 * A shallow proxy on `__sys__` alone would still allow:
 * ```ts
 * __sys__.fs.ls = () => ["/etc/passwd"];   // mutates a nested object
 * __sys__.__env__.set = () => {};          // replaces an API method
 * ```
 * By lazily wrapping every object/function returned via `get`, mutations
 * are intercepted at every depth without allocating all proxies upfront.
 *
 * ### Exempted values
 * Primitive values (`string`, `number`, `boolean`, `symbol`, `bigint`,
 * `null`, `undefined`) are returned as-is — they are inherently immutable.
 * Already-proxied objects (tracked by `proxyCache`) are returned from cache
 * to preserve strict equality (`===`) across multiple reads.
 *
 * ### Error strategy
 * A `TypeError` is thrown on every blocked operation. This matches the
 * behaviour of native `Object.freeze()` in strict mode, making the constraint
 * visible and debuggable during development.
 *
 * @module
 */

/** Internal registry that maps original objects to their proxied counterparts. */
const proxyCache = new WeakMap<object, object>();

/**
 * List of property names that are explicitly allowed to be written internally
 * by the XyPriss bootstrap (before the proxy is applied). Any attempt to set
 * these from user code will still be blocked.
 */
const BLOCKED_WRITE_MSG =
    "[XyPriss Security] The __sys__ API is read-only. " +
    "Mutations to the system interface are not permitted.";

/**
 * Recursively wraps `target` in an immutability proxy.
 *
 * @template T - The concrete type of the object being wrapped.
 * @param target - The object to protect.
 * @returns A deeply-proxied, mutation-proof view of `target`.
 *
 * @example
 * const safeSys = createDeepReadonlyProxy(sysInstance);
 * safeSys.fs = null; // throws TypeError
 * safeSys.__env__.set("KEY", "val"); // set() itself still callable — it is a method
 */
export function createDeepReadonlyProxy<T extends object>(target: T): T {
    // Return primitives directly — they cannot be mutated
    if (target === null || typeof target !== "object" && typeof target !== "function") {
        return target;
    }

    // Return from cache to preserve referential equality
    if (proxyCache.has(target)) {
        return proxyCache.get(target) as T;
    }

    const proxy = new Proxy(target, {
        /**
         * Intercepts property reads and lazily wraps nested objects.
         */
        get(obj, prop, receiver) {
            let value = Reflect.get(obj, prop, receiver);

            // Bind functions to the original object to preserve 'this' context
            // and handle internal slots (Map, Set, etc.)
            if (typeof value === "function") {
                return value.bind(obj);
            }

            // Do not proxy primitives or null
            if (value === null || (typeof value !== "object")) {
                return value;
            }

            // Skip well-known Symbol properties
            if (typeof prop === "symbol") {
                return value;
            }

            return createDeepReadonlyProxy(value);
        },

        /**
         * Blocks all assignment operations: `obj.prop = value`.
         */
        set(_obj, prop, _value) {
            throw new TypeError(
                `${BLOCKED_WRITE_MSG}\n  -> Blocked: set '__sys__.${String(prop)}'`,
            );
        },

        /**
         * Blocks `delete obj.prop`.
         */
        deleteProperty(_obj, prop) {
            throw new TypeError(
                `${BLOCKED_WRITE_MSG}\n  -> Blocked: delete '__sys__.${String(prop)}'`,
            );
        },

        /**
         * Blocks `Object.defineProperty(obj, prop, descriptor)`.
         */
        defineProperty(_obj, prop, _descriptor) {
            throw new TypeError(
                `${BLOCKED_WRITE_MSG}\n  -> Blocked: defineProperty '__sys__.${String(prop)}'`,
            );
        },
    });

    proxyCache.set(target, proxy);
    return proxy;
}
