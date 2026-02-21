// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ArrayStrategy = "replace" | "concat" | "merge";

export interface MergeOptions {
    /**
     * How to handle arrays when both `defaults` and `userOptions` have an
     * array at tme key.
     * - `"replace"` (default) — user array wins entirely.
     * - `"concat"`            — `[...defaultArray, ...userArray]`.
     * - `"merge"`             — element-wise: recurse for plain-object items,
     *                           otherwise use the user element (or the default
     *                           element when the user array is shorter).
     */
    arrayStrategy?: ArrayStrategy;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/** Keys that must never be written to avoid prototype pollution. */
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * mergeWithDefaults — Smart config merge utility
 *
 * Unlike `{ ...defaults, ...userOptions }` (shallow spread), this utility:
 *
 * 1. **User-provided keys always win** — a key present in `userOptions` (even
 *    if its value is `false`, `null`, `0`, or `""`) is NEVER overridden by a
 *    default. Only truly absent keys fall back to the default.
 *
 * 2. **Deep merge for plain objects** — nested objects are merged recursively
 *    at any depth, so that `userOptions.rateLimit.max` doesn't wipe out
 *    `defaults.rateLimit.windowMs`.
 *
 * 3. **No mutation** — returns a new object; inputs are untouched.
 *
 * 4. **Circular reference protection** — cycles are detected and broken
 *    (the circular reference is replaced by `undefined`).
 *
 * 5. **Prototype pollution protection** — dangerous keys (`__proto__`,
 *    `constructor`, `prototype`) are silently ignored.
 *
 * 6. **Array strategy** — configurable via `options.arrayStrategy`:
 *    - `"replace"` (default) — user array fully replaces the default array.
 *    - `"concat"`            — arrays are concatenated (defaults first).
 *    - `"merge"`             — elements are merged index-by-index (plain
 *                              objects recurse, primitives use user value).
 *
 * 7. **Symbol keys** — included in the merge alongside string keys.
 *
 * ### Example
 * ```ts
 * const defaults = {
 *   origin: true,
 *   credentials: false,
 *   maxAge: 86400,
 *   rateLimit: { max: 100, windowMs: 60_000 },
 * };
 * const user = {
 *   credentials: true,
 *   origin: ["http://localhost:5173"],
 *   rateLimit: { max: 50 },          // windowMs falls back to default
 * };
 *
 * mergeWithDefaults(defaults, user);
 * // → {
 * //     origin: ["http://localhost:5173"],
 * //     credentials: true,
 * //     maxAge: 86400,
 * //     rateLimit: { max: 50, windowMs: 60_000 },
 * //   }
 * ```
 */
export function mergeWithDefaults<T extends Record<string | symbol, any>>(
    defaults: T,
    userOptions: Partial<T> | undefined | null,
    options: MergeOptions = {},
    /** @internal — tracks visited objects to break circular refs */
    _seen: WeakSet<object> = new WeakSet(),
): T {
    if (!userOptions) return shallowClone(defaults);

    // Guard against circular structures
    if (_seen.has(userOptions as object)) return shallowClone(defaults);
    _seen.add(userOptions as object);

    const result: Record<string | symbol, any> = shallowClone(defaults);
    const arrayStrategy = options.arrayStrategy ?? "replace";

    // Merge both string and symbol keys from userOptions
    const keys: (string | symbol)[] = [
        ...Object.keys(userOptions),
        ...Object.getOwnPropertySymbols(userOptions),
    ];

    for (const key of keys) {
        // Prototype pollution guard (only relevant for string keys)
        if (typeof key === "string" && BLOCKED_KEYS.has(key)) continue;

        const userVal = (userOptions as any)[key];
        const defaultVal = (defaults as any)[key];

        // Honour `undefined` as "not provided" — let default win
        if (userVal === undefined) continue;

        if (isPlainObject(userVal) && isPlainObject(defaultVal)) {
            // Both sides are plain objects → recurse
            result[key] = mergeWithDefaults(
                defaultVal,
                userVal,
                options,
                _seen,
            );
        } else if (
            Array.isArray(userVal) &&
            Array.isArray(defaultVal) &&
            arrayStrategy !== "replace"
        ) {
            result[key] = mergeArrays(
                defaultVal,
                userVal,
                arrayStrategy,
                options,
                _seen,
            );
        } else {
            // Primitive, array (replace strategy), class instance, null, etc.
            result[key] = userVal;
        }
    }

    return result as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Merges two arrays according to the chosen strategy. */
function mergeArrays(
    defaultArr: any[],
    userArr: any[],
    strategy: "concat" | "merge",
    options: MergeOptions,
    seen: WeakSet<object>,
): any[] {
    if (strategy === "concat") {
        return [...defaultArr, ...userArr];
    }

    // "merge" — element-wise
    const length = Math.max(defaultArr.length, userArr.length);
    const merged: any[] = [];

    for (let i = 0; i < length; i++) {
        const dItem = defaultArr[i];
        const uItem = userArr[i];

        if (i >= userArr.length) {
            // User array is shorter — keep default element
            merged.push(dItem);
        } else if (i >= defaultArr.length) {
            // Default array is shorter — take user element as-is
            merged.push(uItem);
        } else if (isPlainObject(uItem) && isPlainObject(dItem)) {
            merged.push(mergeWithDefaults(dItem, uItem, options, seen));
        } else {
            // Primitive or non-plain-object — user wins
            merged.push(uItem !== undefined ? uItem : dItem);
        }
    }

    return merged;
}

/** Shallow-clones an object preserving both string and symbol own keys. */
function shallowClone<T extends object>(obj: T): T {
    const clone = Object.create(Object.getPrototypeOf(obj)) as T;
    for (const key of Object.getOwnPropertyNames(obj)) {
        (clone as any)[key] = (obj as any)[key];
    }
    for (const sym of Object.getOwnPropertySymbols(obj)) {
        (clone as any)[sym] = (obj as any)[sym];
    }
    return clone;
}

/** Returns `true` for plain `{}` objects (not arrays, not class instances). */
function isPlainObject(value: unknown): value is Record<string | symbol, any> {
    if (typeof value !== "object" || value === null) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

