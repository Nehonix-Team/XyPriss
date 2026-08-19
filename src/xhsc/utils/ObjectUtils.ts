import { XStringify } from "xypriss-security";
import { ObjectWrapper } from "./ObjectWrapper";

// ---------------------------------------------------------------------------
// Type utilities for deepPick — infer the exact nested shape from path strings
// ---------------------------------------------------------------------------

/**
 * Reconstructs a single-path nested object type from a dot-notation string.
 *
 * @example
 * DeepPickSingle<{ a: { b: number } }, "a.b"> => { a: { b: number } }
 */
type DeepPickSingle<
    T,
    Path extends string,
> = Path extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T
        ? { [K in Head]: DeepPickSingle<T[Head], Tail> }
        : never
    : Path extends keyof T
      ? { [K in Path]: T[Path] }
      : never;

/**
 * Converts a union of object types into a single intersected type, merging
 * all properties from each member.
 */
type UnionToIntersection<U> = (
    U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
    ? I
    : never;

/**
 * Derives the precise nested output type of `deepPick` given an object type
 * `T` and a union of dot-notation path strings `Paths`.
 *
 * @example
 * type Result = DeepPick<{ user: { name: string; age: number } }, "user.name">;
 * // => { user: { name: string } }
 */
export type DeepPick<T, Paths extends string> = UnionToIntersection<
    DeepPickSingle<T, Paths>
> &
    Record<string, unknown>;

/**
 * **ObjectUtils — XyPriss Object Utilities**
 *
 * All original methods remain fully supported and are **not deprecated**;
 * they are the right choice for one-off, single-call operations. For
 * chaining several operations on the same object without repeating it as
 * an argument each time, use {@link __sys__.utils.obj.of} to get a fluent
 * {@link ObjectWrapper} instance instead:
 *
 * @example
 * ```ts
 * // Classic style (still fully supported):
 * const utils = new ObjectUtils();
 * utils.omit(utils.pick(obj, ["a", "b", "c"]), ["c"]);
 *
 * // Fluent style (new, optional):
 * const result = __sys__.utils.obj.of(obj)
 *   .pick(["a", "b", "c"])
 *   .omit(["c"])
 *   .value();
 * ```
 */
export class ObjectUtils {
    /**
     * **of**
     *
     * Wraps `obj` in a chainable {@link ObjectWrapper}, so multiple
     * operations can be applied in sequence without re-declaring the
     * object as an argument each time.
     *
     * This does not mutate or replace the classic API — it's an
     * additive convenience entry point.
     *
     * @param obj - The object to wrap.
     * @returns An {@link ObjectWrapper} bound to `obj`.
     *
     * @example
     * ```ts
     * const obj = __sys__.utils.obj.of({ a: 1, b: 2, c: 3 });
     * const picked = obj.pick(["a", "b"]).value(); // { a: 1, b: 2 }
     * ```
     */
    public static of<T extends object>(obj: T): ObjectWrapper<T> {
        return new ObjectWrapper(obj);
    }

    /**
     * **of** (instance method)
     *
     * Instance-bound convenience wrapper around the static {@link ObjectUtils.of}.
     * Allows `__sys__.utils.obj.of(...)` to work correctly when `obj` is a
     * class instance rather than the class itself.
     *
     * @param obj - The object to wrap.
     * @returns An {@link ObjectWrapper} bound to `obj`.
     */
    public of<T extends object>(obj: T): ObjectWrapper<T> {
        return ObjectUtils.of(obj);
    }

    /**
     * **Deep Clone an Object**
     *
     * Creates a deep copy of `obj` using `XStringify` for serialization,
     * which handles cyclic references and offers better performance
     * than the native `JSON.stringify` in complex object graphs.
     *
     * @param obj - The object to clone. Must be serializable.
     * @returns A completely independent deep copy of the input object.
     *
     * @example
     * ```ts
     * const original = { a: 1, nested: { b: 2 } };
     * const clone = utils.deepClone(original);
     * clone.nested.b = 99;
     * // original.nested.b is still 2
     * ```
     */
    public deepClone<T>(obj: T): T {
        return JSON.parse(XStringify(obj));
    }

    /**
     * **Pick Specific Keys from an Object**
     *
     * Returns a new object containing only the key-value pairs whose
     * keys appear in the `keys` array. Non-existent keys are silently ignored.
     *
     * @param obj  - The source object.
     * @param keys - Array of keys to extract.
     * @returns A new object with only the specified keys.
     *
     * @example
     * ```ts
     * utils.pick({ a: 1, b: 2, c: 3 }, ["a", "c"]);   // { a: 1, c: 3 }
     * ```
     */
    public pick<T extends object, K extends keyof T>(
        obj: T,
        keys: K[],
    ): Pick<T, K> {
        return keys.reduce(
            (acc, key) => {
                if (key in obj) acc[key] = obj[key];
                return acc;
            },
            {} as Pick<T, K>,
        );
    }

    /**
     * **deepPick**
     *
     * Extracts a subset of `obj` using dot-notation paths, preserving the
     * original nested structure. Paths that do not exist in the object are
     * silently ignored.
     *
     * @param obj - The source object.
     * @param paths - Dot-notation paths to extract (e.g. `"a.b.c"`).
     * @param separator - Path separator (default: `"."`).
     * @returns A new nested object containing only the specified paths.
     *
     * @example
     * ```ts
     * const data = {
     *   user: { name: "Alice", age: 30, password: "secret" },
     *   meta: { created: "2024-01-01", version: 2 },
     * };
     *
     * utils.deepPick(data, ["user.name", "user.age", "meta.version"]);
     * // { user: { name: "Alice", age: 30 }, meta: { version: 2 } }
     * ```
     */
    public deepPick<T extends object, Paths extends string>(
        obj: T,
        paths: Paths[],
        separator?: string,
    ): DeepPick<T, Paths> {
        return ObjectUtils.of(obj)
            .deepPick(paths, separator)
            .value() as DeepPick<T, Paths>;
    }

    /**
     * **Omit Specific Keys from an Object**
     *
     * Returns a new object that is a shallow copy of `obj` with the
     * specified keys removed.
     *
     * @param obj  - The source object.
     * @param keys - Array of keys to exclude.
     * @returns A new object without the specified keys.
     *
     * @example
     * ```ts
     * utils.omit({ a: 1, b: 2, c: 3 }, ["b"]);   // { a: 1, c: 3 }
     * ```
     */
    public omit<T extends object, K extends keyof T>(
        obj: T,
        keys: K[],
    ): Omit<T, K> {
        const result = { ...obj };
        keys.forEach((key) => delete result[key]);
        return result as Omit<T, K>;
    }

    /**
     * **Check if an Object is Empty**
     *
     * Returns `true` if the object has no own enumerable keys.
     * Works correctly with objects created via `Object.create(null)`.
     *
     * @param obj - The object to inspect.
     * @returns `true` if the object has no own keys, `false` otherwise.
     *
     * @example
     * ```ts
     * utils.isEmpty({});             // true
     * utils.isEmpty({ a: 1 });       // false
     * utils.isEmpty(Object.create(null)); // true
     * ```
     */
    public isEmpty(obj: object): boolean {
        return Object.keys(obj).length === 0;
    }

    /**
     * **Check if an Object has Any Empty Values**
     *
     * Returns `true` if at least one property value in the object is `undefined`, `null`,
     * an empty string `""` (or whitespace-only if trim: true), empty array `[]`, or empty object `{}`.
     *
     * @param obj - The object to inspect.
     * @param keys - Optional specific keys to check.
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns `true` if at least one value is empty/undefined.
     *
     * @example
     * ```ts
     * utils.hasEmpty({ name: "Alice", phone: undefined }); // true
     * utils.hasEmpty({ name: "Alice", phone: "+22501020304" }); // false
     * ```
     */
    public hasEmpty<T extends object>(
        obj: T,
        keys?: (keyof T)[],
        options: { trim?: boolean } = { trim: true },
    ): boolean {
        return new ObjectWrapper(obj).hasEmpty(keys, options);
    }

    /**
     * **hasAnyEmpty**
     *
     * Alias for {@link hasEmpty}. Returns `true` if at least one property is empty.
     */
    public hasAnyEmpty<T extends object>(
        obj: T,
        keys?: (keyof T)[],
        options?: { trim?: boolean },
    ): boolean {
        return this.hasEmpty(obj, keys, options);
    }

    /**
     * **Check if All Object Values are Empty**
     *
     * Returns `true` if ALL property values in the object are `undefined`, `null`,
     * empty string `""`, empty array `[]`, or empty object `{}` (or if the object has 0 keys).
     *
     * @param obj - The object to inspect.
     * @param keys - Optional specific keys to check.
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns `true` if all values are empty.
     *
     * @example
     * ```ts
     * utils.isAllEmpty({ name: undefined, phone: "", email: null }); // true
     * utils.isAllEmpty({ name: "Alice", phone: "" }); // false
     * ```
     */
    public isAllEmpty<T extends object>(
        obj: T,
        keys?: (keyof T)[],
        options: { trim?: boolean } = { trim: true },
    ): boolean {
        return new ObjectWrapper(obj).isAllEmpty(keys, options);
    }

    /**
     * **Check if an Object contains Undefined Values**
     *
     * Returns `true` if at least one property value in the object is strictly `undefined`.
     *
     * @param obj - The object to inspect.
     * @param keys - Optional specific keys to check.
     * @returns `true` if at least one value is undefined.
     *
     * @example
     * ```ts
     * utils.hasUndefined({ name: "Alice", phone: undefined }); // true
     * utils.hasUndefined({ name: "Alice", phone: null }); // false
     * ```
     */
    public hasUndefined<T extends object>(
        obj: T,
        keys?: (keyof T)[],
    ): boolean {
        return new ObjectWrapper(obj).hasUndefined(keys);
    }

    /**
     * **Compact Object**
     *
     * Returns a new plain object with all `undefined`, `null`, and empty string properties removed.
     *
     * @param obj - The object to clean.
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns A new cleaned object without empty properties.
     *
     * @example
     * ```ts
     * utils.compact({ name: "Alice", phone: undefined, email: "" });
     * // { name: "Alice" }
     * ```
     */
    public compact<T extends object>(
        obj: T,
        options: { trim?: boolean } = { trim: true },
    ): Partial<T> {
        return new ObjectWrapper(obj).compact(options).value();
    }

    /**
     * **flattenObject**
     *
     * Collapses nested objects into flat dot-notation (or custom) keys.
     * Useful for configuration mapping or CSV generation.
     *
     * @param obj - The object to flatten.
     * @param separator - Optional path separator (default: `"."`).
     * @returns A shallow object with path-based keys.
     *
     * @example
     * ```ts
     * utils.flattenObject({ a: { b: 1, c: { d: 2 } } });
     * // { "a.b": 1, "a.c.d": 2 }
     * ```
     */
    public flattenObject(
        obj: Record<string, unknown>,
        separator: string = ".",
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        const recurse = (current: any, path: string = "") => {
            for (const [key, value] of Object.entries(current)) {
                const newPath = path ? `${path}${separator}${key}` : key;
                if (
                    value &&
                    typeof value === "object" &&
                    !Array.isArray(value) &&
                    Object.keys(value).length > 0
                ) {
                    recurse(value, newPath);
                } else {
                    result[newPath] = value;
                }
            }
        };

        recurse(obj);
        return result;
    }

    /**
     * **unflattenObject**
     *
     * Reverses {@link flattenObject}, expanding dot-notation (or custom
     * separator) keys back into a nested object structure.
     *
     * @param obj - The flat object to expand.
     * @param separator - Path separator used in the flat keys (default: `"."`).
     * @returns A nested object reconstructed from the flat keys.
     *
     * @example
     * ```ts
     * utils.unflattenObject({ "a.b": 1, "a.c.d": 2 });
     * // { a: { b: 1, c: { d: 2 } } }
     * ```
     */
    public unflattenObject(
        obj: Record<string, unknown>,
        separator: string = ".",
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [flatKey, val] of Object.entries(obj)) {
            const parts = flatKey.split(separator);
            let cursor: Record<string, unknown> = result;
            parts.forEach((part, i) => {
                if (i === parts.length - 1) {
                    cursor[part] = val;
                } else {
                    if (
                        typeof cursor[part] !== "object" ||
                        cursor[part] === null
                    ) {
                        cursor[part] = {};
                    }
                    cursor = cursor[part] as Record<string, unknown>;
                }
            });
        }
        return result;
    }

    /**
     * **parse**
     *
     * Safely parses a JSON string. If the parsing fails, the provided fallback
     * value is returned instead of throwing an exception.
     *
     * @param json The JSON string to parse.
     * @param fallback The fallback value to return on failure.
     * @returns The parsed object or the fallback value.
     *
     * @example
     * ```ts
     * utils.parse('{"a":1}');       // { a: 1 }
     * utils.parse("not json", {});  // {}
     * ```
     */
    public parse<T>(json: string, fallback: T | null = null): T | null {
        try {
            return JSON.parse(json);
        } catch {
            return fallback;
        }
    }

    /**
     * **merge**
     *
     * Deep-merges one or more source objects into a copy of `target`.
     * Plain object values are merged recursively; arrays and primitive
     * values are overwritten by the last source that defines them.
     * The original `target` and `sources` are never mutated.
     *
     * @param target - The base object.
     * @param sources - One or more objects to merge into the base.
     * @returns A new object containing the deep-merged result.
     *
     * @example
     * ```ts
     * utils.merge({ a: 1, nested: { x: 1 } }, { nested: { y: 2 } });
     * // { a: 1, nested: { x: 1, y: 2 } }
     * ```
     */
    public merge<T extends object>(
        target: T,
        ...sources: Array<Partial<T> | Record<string, any>>
    ): T {
        const isPlainObject = (val: unknown): val is Record<string, any> =>
            !!val && typeof val === "object" && !Array.isArray(val);

        const deepMerge = (t: any, s: any) => {
            for (const key of Object.keys(s)) {
                if (isPlainObject(s[key]) && isPlainObject(t[key])) {
                    deepMerge(t[key], s[key]);
                } else {
                    t[key] = s[key];
                }
            }
            return t;
        };

        const base = JSON.parse(XStringify(target));
        return sources.reduce((acc, src) => deepMerge(acc, src), base);
    }

    /**
     * **mapValues**
     *
     * Builds a new object by transforming every value of `obj` with `fn`,
     * keeping the same keys.
     *
     * @param obj - The source object.
     * @param fn - Mapping function receiving `(value, key)`.
     * @returns A new object with transformed values.
     *
     * @example
     * ```ts
     * utils.mapValues({ a: 1, b: 2 }, (v) => v * 10);
     * // { a: 10, b: 20 }
     * ```
     */
    public mapValues<T extends object, R>(
        obj: T,
        fn: (value: T[keyof T], key: keyof T) => R,
    ): Record<keyof T, R> {
        const result = {} as Record<keyof T, R>;
        for (const key of Object.keys(obj) as (keyof T)[]) {
            result[key] = fn(obj[key], key);
        }
        return result;
    }

    /**
     * **mapKeys**
     *
     * Builds a new object by transforming every key of `obj` with `fn`,
     * keeping the same values.
     *
     * @param obj - The source object.
     * @param fn - Mapping function receiving `(key, value)`. Must return a string.
     * @returns A new object with renamed keys.
     *
     * @example
     * ```ts
     * utils.mapKeys({ a: 1, b: 2 }, (k) => k.toUpperCase());
     * // { A: 1, B: 2 }
     * ```
     */
    public mapKeys<T extends object>(
        obj: T,
        fn: (key: keyof T, value: T[keyof T]) => string,
    ): Record<string, T[keyof T]> {
        const result: Record<string, T[keyof T]> = {};
        for (const key of Object.keys(obj) as (keyof T)[]) {
            result[fn(key, obj[key])] = obj[key];
        }
        return result;
    }

    /**
     * **filter**
     *
     * Builds a new object containing only the key-value pairs of `obj`
     * for which `predicate` returns `true`.
     *
     * @param obj - The source object.
     * @param predicate - Function receiving `(value, key)`.
     * @returns A new, filtered object.
     *
     * @example
     * ```ts
     * utils.filter({ a: 1, b: 2, c: 3 }, (v) => v > 1);
     * // { b: 2, c: 3 }
     * ```
     */
    public filter<T extends object>(
        obj: T,
        predicate: (value: T[keyof T], key: keyof T) => boolean,
    ): Partial<T> {
        const result: Partial<T> = {};
        for (const key of Object.keys(obj) as (keyof T)[]) {
            if (predicate(obj[key], key)) {
                result[key] = obj[key];
            }
        }
        return result;
    }

    /**
     * **get**
     *
     * Safely reads a possibly-nested value from `obj` using a dot-notation
     * path, returning `fallback` if any part of the path is missing.
     *
     * @param obj - The source object.
     * @param path - Dot-notation path (e.g. `"a.b.c"`).
     * @param fallback - Value returned if the path can't be resolved.
     * @returns The resolved value or the fallback.
     *
     * @example
     * ```ts
     * utils.get({ a: { b: { c: 42 } } }, "a.b.c");        // 42
     * utils.get({ a: {} }, "a.b.c", "missing");            // "missing"
     * ```
     */
    public get<R = unknown>(
        obj: object,
        path: string,
        fallback: R | undefined = undefined,
    ): R | undefined {
        const parts = path.split(".");
        let cursor: any = obj;
        for (const part of parts) {
            if (cursor === null || cursor === undefined) return fallback;
            cursor = cursor[part];
        }
        return cursor === undefined ? fallback : cursor;
    }

    /**
     * **set**
     *
     * Returns a new object equal to `obj` but with a possibly-nested value
     * set at `path` (dot-notation), creating intermediate objects as needed.
     * The original `obj` is not mutated.
     *
     * @param obj - The source object.
     * @param path - Dot-notation path (e.g. `"a.b.c"`).
     * @param value - The value to set.
     * @returns A new object with the value set at the given path.
     *
     * @example
     * ```ts
     * utils.set({}, "a.b.c", 42);
     * // { a: { b: { c: 42 } } }
     * ```
     */
    public set<T extends object>(obj: T, path: string, value: unknown): T {
        const clone: any = JSON.parse(XStringify(obj));
        const parts = path.split(".");
        let cursor: any = clone;
        parts.forEach((part, i) => {
            if (i === parts.length - 1) {
                cursor[part] = value;
            } else {
                if (typeof cursor[part] !== "object" || cursor[part] === null) {
                    cursor[part] = {};
                }
                cursor = cursor[part];
            }
        });
        return clone;
    }

    /**
     * **has**
     *
     * Checks whether `obj` has the given own key (shortcut over
     * `Object.prototype.hasOwnProperty`).
     *
     * @param obj - The object to inspect.
     * @param key - The key to check.
     * @returns `true` if the key exists as an own property.
     *
     * @example
     * ```ts
     * utils.has({ a: 1 }, "a"); // true
     * utils.has({ a: 1 }, "b"); // false
     * ```
     */
    public has(obj: object, key: PropertyKey): boolean {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    /**
     * **deepEqual**
     *
     * Performs a deep structural equality check between two values,
     * comparing plain objects and arrays recursively by value rather
     * than by reference.
     *
     * @param a - First value.
     * @param b - Second value.
     * @returns `true` if both values are deeply equal.
     *
     * @example
     * ```ts
     * utils.deepEqual({ a: { b: 1 } }, { a: { b: 1 } }); // true
     * utils.deepEqual({ a: 1 }, { a: 2 });               // false
     * ```
     */
    public static deepEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (typeof a !== typeof b) return false;
        if (a === null || b === null) return a === b;
        if (typeof a !== "object") return false;

        if (Array.isArray(a) || Array.isArray(b)) {
            if (!Array.isArray(a) || !Array.isArray(b)) return false;
            if (a.length !== b.length) return false;
            return a.every((item, i) =>
                __sys__.utils.obj.deepEqual(item, b[i]),
            );
        }

        const aKeys = Object.keys(a as object);
        const bKeys = Object.keys(b as object);
        if (aKeys.length !== bKeys.length) return false;

        return aKeys.every((key) =>
            __sys__.utils.obj.deepEqual((a as any)[key], (b as any)[key]),
        );
    }

    /**
     * **deepEqual** (instance method)
     *
     * Instance-bound convenience wrapper around the static
     * {@link __sys__.utils.obj.deepEqual}, for callers already holding an
     * `ObjectUtils` instance.
     *
     * @param a - First value.
     * @param b - Second value.
     * @returns `true` if both values are deeply equal.
     */
    public deepEqual(a: unknown, b: unknown): boolean {
        return __sys__.utils.obj.deepEqual(a, b);
    }

    /**
     * **invert**
     *
     * Swaps keys and values: returns a new object where each original
     * value (stringified) becomes a key, and each original key becomes
     * its value. If multiple keys share a value, the last one wins.
     *
     * @param obj - The source object. Values are coerced to strings for keys.
     * @returns A new object with keys and values swapped.
     *
     * @example
     * ```ts
     * utils.invert({ a: "x", b: "y" });
     * // { x: "a", y: "b" }
     * ```
     */
    public invert<T extends Record<string, PropertyKey>>(
        obj: T,
    ): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[String(value)] = key;
        }
        return result;
    }

    /**
     * **defaults**
     *
     * Returns a new object built from `obj`, filling in any keys that are
     * `undefined` with the corresponding value from `defaultsObj`.
     * Does not overwrite keys that already have a defined value.
     *
     * @param obj - The source object.
     * @param defaultsObj - Object providing fallback values.
     * @returns A new object with defaults applied.
     *
     * @example
     * ```ts
     * utils.defaults({ a: 1, b: undefined }, { b: 2, c: 3 });
     * // { a: 1, b: 2, c: 3 }
     * ```
     */
    public defaults<T extends object>(obj: T, defaultsObj: Partial<T>): T {
        const result: any = { ...defaultsObj, ...obj };
        for (const key of Object.keys(result)) {
            if (result[key] === undefined && key in defaultsObj) {
                result[key] = (defaultsObj as any)[key];
            }
        }
        return result;
    }



    /**
     * **isPlainObject**
     *
     * Checks whether `value` is a plain object (i.e. not `null`, not an
     * array, not a class instance created from a custom prototype, and
     * not a built-in like `Date`, `Map`, or `Set`).
     *
     * @param value - The value to check.
     * @returns `true` if `value` is a plain object.
     *
     * @example
     * ```ts
     * utils.isPlainObject({});          // true
     * utils.isPlainObject([]);          // false
     * utils.isPlainObject(new Date());  // false
     * utils.isPlainObject(null);        // false
     * ```
     */
    public isPlainObject(value: unknown): value is Record<string, unknown> {
        if (value === null || typeof value !== "object") return false;
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }
}

export default ObjectUtils;

