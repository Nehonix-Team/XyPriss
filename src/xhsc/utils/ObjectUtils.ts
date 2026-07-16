import { XStringify } from "xypriss-security";

export class ObjectWrapper<T extends object> {
    private current: T;

    constructor(obj: T) {
        this.current = obj;
    }

    /**
     * **value**
     *
     * Unwraps and returns the underlying plain object held by this wrapper.
     * Call this at the end of a chain to get back a normal object.
     *
     * @returns The current wrapped object.
     *
     * @example
     * ```ts
     * const obj = __sys__.utils.obj.of({ a: 1 });
     * obj.value(); // { a: 1 }
     * ```
     */
    public value(): T {
        return this.current;
    }

    /**
     * **raw**
     *
     * Alias for {@link value}. Useful when `value` reads awkwardly in context.
     *
     * @returns The current wrapped object.
     */
    public raw(): T {
        return this.current;
    }

    /**
     * **clone**
     *
     * Deep-clones the wrapped object (via `XStringify`) and continues
     * the chain on the cloned copy, leaving the original untouched.
     *
     * @returns `this`, now wrapping a deep copy of the previous value.
     *
     * @example
     * ```ts
     * const source = { nested: { count: 1 } };
     * const obj = __sys__.utils.obj.of(source).clone();
     * obj.value().nested.count = 99;
     * // source.nested.count is still 1
     * ```
     */
    public clone(): ObjectWrapper<T> {
        this.current = JSON.parse(XStringify(this.current));
        return this;
    }

    /**
     * **pick**
     *
     * Narrows the wrapped object down to only the given keys.
     *
     * @param keys - The keys to keep.
     * @returns `this`, now wrapping only the picked keys.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: 1, b: 2, c: 3 }).pick(["a", "c"]).value();
     * // { a: 1, c: 3 }
     * ```
     */
    public pick<K extends keyof T>(keys: K[]): ObjectWrapper<Pick<T, K>> {
        const result = keys.reduce(
            (acc, key) => {
                if (key in this.current) acc[key] = this.current[key];
                return acc;
            },
            {} as Pick<T, K>,
        );
        return new ObjectWrapper(result);
    }

    /**
     * **omit**
     *
     * Removes the given keys from the wrapped object.
     *
     * @param keys - The keys to remove.
     * @returns `this`, now wrapping the object without those keys.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: 1, b: 2, c: 3 }).omit(["b"]).value();
     * // { a: 1, c: 3 }
     * ```
     */
    public omit<K extends keyof T>(keys: K[]): ObjectWrapper<Omit<T, K>> {
        const result = { ...this.current };
        keys.forEach((key) => delete (result as any)[key]);
        return new ObjectWrapper(result as Omit<T, K>);
    }

    /**
     * **isEmpty**
     *
     * Checks whether the wrapped object has no own enumerable keys.
     * This is a terminal read (does not return the wrapper), since it
     * yields a boolean rather than an object.
     *
     * @returns `true` if the object has no own keys.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({}).isEmpty(); // true
     * ```
     */
    public isEmpty(): boolean {
        return Object.keys(this.current).length === 0;
    }

    /**
     * **flatten**
     *
     * Collapses the wrapped object's nested structure into flat
     * dot-notation (or custom separator) keys.
     *
     * @param separator - Path separator (default: `"."`).
     * @returns A new wrapper around the flattened object.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: { b: 1 } }).flatten().value();
     * // { "a.b": 1 }
     * ```
     */
    public flatten(
        separator: string = ".",
    ): ObjectWrapper<Record<string, unknown>> {
        const result: Record<string, unknown> = {};
        const recurse = (current: any, path: string = "") => {
            for (const [key, val] of Object.entries(current)) {
                const newPath = path ? `${path}${separator}${key}` : key;
                if (
                    val &&
                    typeof val === "object" &&
                    !Array.isArray(val) &&
                    Object.keys(val).length > 0
                ) {
                    recurse(val, newPath);
                } else {
                    result[newPath] = val;
                }
            }
        };
        recurse(this.current);
        return new ObjectWrapper(result);
    }

    /**
     * **unflatten**
     *
     * Reverses {@link flatten}, expanding dot-notation (or custom
     * separator) keys back into a nested object.
     *
     * @param separator - Path separator used in the flat keys (default: `"."`).
     * @returns A new wrapper around the nested object.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ "a.b": 1, "a.c": 2 }).unflatten().value();
     * // { a: { b: 1, c: 2 } }
     * ```
     */
    public unflatten(
        separator: string = ".",
    ): ObjectWrapper<Record<string, unknown>> {
        const result: Record<string, unknown> = {};
        for (const [flatKey, val] of Object.entries(
            this.current as Record<string, unknown>,
        )) {
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
        return new ObjectWrapper(result);
    }

    /**
     * **merge**
     *
     * Deep-merges one or more source objects into the wrapped object.
     * Plain object values are merged recursively; arrays and primitives
     * are overwritten by the last source that defines them.
     *
     * @param sources - One or more partial objects to merge in.
     * @returns `this`, now wrapping the merged result.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: 1, nested: { x: 1 } })
     *   .merge({ nested: { y: 2 } })
     *   .value();
     * // { a: 1, nested: { x: 1, y: 2 } }
     * ```
     */
    public merge(
        ...sources: Array<Partial<T> | Record<string, any>>
    ): ObjectWrapper<T> {
        const isPlainObject = (val: unknown): val is Record<string, any> =>
            !!val && typeof val === "object" && !Array.isArray(val);

        const deepMerge = (target: any, source: any) => {
            for (const key of Object.keys(source)) {
                if (isPlainObject(source[key]) && isPlainObject(target[key])) {
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        };

        this.current = sources.reduce(
            (acc, src) => deepMerge(acc, src),
            this.current as any,
        );
        return this;
    }

    /**
     * **mapValues**
     *
     * Transforms every value of the wrapped object using `fn`, keeping
     * the same keys.
     *
     * @param fn - Mapping function receiving `(value, key)`.
     * @returns A new wrapper around the transformed object.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: 1, b: 2 }).mapValues((v) => v * 10).value();
     * // { a: 10, b: 20 }
     * ```
     */
    public mapValues<R>(
        fn: (value: T[keyof T], key: keyof T) => R,
    ): ObjectWrapper<Record<keyof T, R>> {
        const result = {} as Record<keyof T, R>;
        for (const key of Object.keys(this.current) as (keyof T)[]) {
            result[key] = fn(this.current[key], key);
        }
        return new ObjectWrapper(result);
    }

    /**
     * **mapKeys**
     *
     * Transforms every key of the wrapped object using `fn`, keeping
     * the same values.
     *
     * @param fn - Mapping function receiving `(key, value)`. Must return a string.
     * @returns A new wrapper around the object with renamed keys.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: 1, b: 2 })
     *   .mapKeys((k) => k.toUpperCase())
     *   .value();
     * // { A: 1, B: 2 }
     * ```
     */
    public mapKeys(
        fn: (key: keyof T, value: T[keyof T]) => string,
    ): ObjectWrapper<Record<string, T[keyof T]>> {
        const result: Record<string, T[keyof T]> = {};
        for (const key of Object.keys(this.current) as (keyof T)[]) {
            result[fn(key, this.current[key])] = this.current[key];
        }
        return new ObjectWrapper(result);
    }

    /**
     * **filter**
     *
     * Keeps only the key-value pairs for which `predicate` returns `true`.
     *
     * @param predicate - Function receiving `(value, key)`.
     * @returns A new wrapper around the filtered object.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: 1, b: 2, c: 3 })
     *   .filter((v) => v > 1)
     *   .value();
     * // { b: 2, c: 3 }
     * ```
     */
    public filter(
        predicate: (value: T[keyof T], key: keyof T) => boolean,
    ): ObjectWrapper<Partial<T>> {
        const result: Partial<T> = {};
        for (const key of Object.keys(this.current) as (keyof T)[]) {
            if (predicate(this.current[key], key)) {
                result[key] = this.current[key];
            }
        }
        return new ObjectWrapper(result);
    }

    /**
     * **keys**
     *
     * Returns the own enumerable keys of the wrapped object.
     * This is a terminal read.
     *
     * @returns Array of keys.
     */
    public keys(): (keyof T)[] {
        return Object.keys(this.current) as (keyof T)[];
    }

    /**
     * **values**
     *
     * Returns the own enumerable values of the wrapped object.
     * This is a terminal read.
     *
     * @returns Array of values.
     */
    public values(): T[keyof T][] {
        return Object.values(this.current) as T[keyof T][];
    }

    /**
     * **entries**
     *
     * Returns the own enumerable `[key, value]` pairs of the wrapped object.
     * This is a terminal read.
     *
     * @returns Array of `[key, value]` tuples.
     */
    public entries(): [keyof T, T[keyof T]][] {
        return Object.entries(this.current) as [keyof T, T[keyof T]][];
    }

    /**
     * **has**
     *
     * Checks whether the wrapped object has the given own key.
     * This is a terminal read.
     *
     * @param key - The key to check.
     * @returns `true` if the key exists on the object.
     */
    public has(key: PropertyKey): boolean {
        return Object.prototype.hasOwnProperty.call(this.current, key);
    }

    /**
     * **get**
     *
     * Safely reads a possibly-nested value using dot-notation path,
     * returning `fallback` if any part of the path is missing.
     * This is a terminal read.
     *
     * @param path - Dot-notation path (e.g. `"a.b.c"`).
     * @param fallback - Value returned if the path can't be resolved.
     * @returns The resolved value or the fallback.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: { b: { c: 42 } } }).get("a.b.c"); // 42
     * __sys__.utils.obj.of({ a: {} }).get("a.b.c", "missing");    // "missing"
     * ```
     */
    public get<R = unknown>(
        path: string,
        fallback: R | undefined = undefined,
    ): R | undefined {
        const parts = path.split(".");
        let cursor: any = this.current;
        for (const part of parts) {
            if (cursor === null || cursor === undefined) return fallback;
            cursor = cursor[part];
        }
        return cursor === undefined ? fallback : cursor;
    }

    /**
     * **set**
     *
     * Sets a possibly-nested value using dot-notation path, creating
     * intermediate objects as needed.
     *
     * @param path - Dot-notation path (e.g. `"a.b.c"`).
     * @param value - The value to set.
     * @returns `this`, with the value set at the given path.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of<any>({}).set("a.b.c", 42).value();
     * // { a: { b: { c: 42 } } }
     * ```
     */
    public set(path: string, value: unknown): ObjectWrapper<T> {
        const parts = path.split(".");
        let cursor: any = this.current;
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
        return this;
    }

    /**
     * **equals**
     *
     * Performs a deep structural equality check between the wrapped
     * object and `other`. This is a terminal read.
     *
     * @param other - The object to compare against.
     * @returns `true` if both objects are deeply equal.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: { b: 1 } }).equals({ a: { b: 1 } }); // true
     * ```
     */
    public equals(other: unknown): boolean {
        return __sys__.utils.obj.deepEqual(this.current, other);
    }
}

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
            return a.every((item, i) => __sys__.utils.obj.deepEqual(item, b[i]));
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
     * **compact**
     *
     * Returns a new object with all keys whose value is `null` or
     * `undefined` removed.
     *
     * @param obj - The source object.
     * @returns A new object without null/undefined values.
     *
     * @example
     * ```ts
     * utils.compact({ a: 1, b: null, c: undefined, d: 0 });
     * // { a: 1, d: 0 }
     * ```
     */
    public compact<T extends object>(obj: T): Partial<T> {
        const result: Partial<T> = {};
        for (const key of Object.keys(obj) as (keyof T)[]) {
            const val = obj[key];
            if (val !== null && val !== undefined) {
                result[key] = val;
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

