
// ---------------------------------------------------------------------------

import { XStringify } from "xypriss-security";
import { DeepPick } from "./ObjectUtils";

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
     * **deepPick**
     *
     * Extracts a subset of the wrapped object using dot-notation paths,
     * preserving the original nested structure. Paths that do not exist
     * in the object are silently ignored.
     *
     * @param paths - Dot-notation paths to extract (e.g. `"a.b.c"`).
     * @param separator - Path separator (default: `"."`)
     * @returns A new wrapper around the extracted nested object.
     *
     * @example
     * ```ts
     * const data = {
     *   user: { name: "Alice", age: 30, password: "secret" },
     *   meta: { created: "2024-01-01", version: 2 },
     * };
     *
     * __sys__.utils.obj
     *   .of(data)
     *   .deepPick(["user.name", "user.age", "meta.version"])
     *   .value();
     * // { user: { name: "Alice", age: 30 }, meta: { version: 2 } }
     * ```
     */
    public deepPick<Paths extends string>(
        paths: Paths[],
        separator?: string,
    ): ObjectWrapper<DeepPick<T, Paths>> {
        const sep = separator ?? ".";
        const result: Record<string, unknown> = {};

        for (const path of paths) {
            const parts = path.split(sep);
            let src: any = this.current;
            let dst: Record<string, unknown> = result;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (src === null || src === undefined || !(part in src)) {
                    break;
                }

                if (i === parts.length - 1) {
                    dst[part] = src[part];
                } else {
                    if (
                        typeof dst[part] !== "object" ||
                        dst[part] === null ||
                        Array.isArray(dst[part])
                    ) {
                        dst[part] = {};
                    }
                    dst = dst[part] as Record<string, unknown>;
                    src = src[part];
                }
            }
        }

        return new ObjectWrapper(result) as unknown as ObjectWrapper<DeepPick<T, Paths>>;
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
     * __sys__.utils.obj.of({ a: 1 }).isEmpty(); // false
     * ```
     */
    public isEmpty(): boolean {
        return Object.keys(this.current).length === 0;
    }

    /**
     * **hasEmpty / hasAnyEmpty**
     *
     * Checks whether at least one property value in the object is empty
     * (`undefined`, `null`, `""` empty/whitespace string, empty `[]`, or empty `{}`).
     * If an optional list of `keys` is provided, only those keys will be inspected.
     *
     * @param keys - Optional array of specific keys to inspect. If omitted, all own keys are checked.
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns `true` if at least one value is empty/undefined, `false` otherwise.
     *
     * @example
     * ```ts
     * const contact = __sys__.utils.obj.of({ name: "Alice", phone: undefined, email: "" });
     * contact.hasEmpty(); // true (phone is undefined, email is empty)
     * contact.hasEmpty(["name"]); // false (name is defined and non-empty)
     * ```
     */
    public hasEmpty(
        keys?: (keyof T)[],
        options: { trim?: boolean } = { trim: true },
    ): boolean {
        const targetKeys = keys && keys.length > 0 ? keys : (Object.keys(this.current) as (keyof T)[]);
        if (targetKeys.length === 0) return true;

        const isValueEmpty = (val: unknown): boolean => {
            if (val === undefined || val === null) return true;
            if (typeof val === "string") {
                return options.trim !== false ? val.trim().length === 0 : val.length === 0;
            }
            if (Array.isArray(val)) return val.length === 0;
            if (typeof val === "object") {
                if (val instanceof Date || val instanceof RegExp) return false;
                return Object.keys(val).length === 0;
            }
            return false;
        };

        return targetKeys.some((k) => isValueEmpty(this.current[k]));
    }

    /**
     * **hasAnyEmpty**
     *
     * Alias for {@link hasEmpty}. Returns `true` if at least one property value
     * is `undefined`, `null`, empty string, empty array, or empty object.
     */
    public hasAnyEmpty(
        keys?: (keyof T)[],
        options?: { trim?: boolean },
    ): boolean {
        return this.hasEmpty(keys, options);
    }

    /**
     * **isAllEmpty**
     *
     * Checks whether **all** property values in the object are empty
     * (`undefined`, `null`, `""` empty/whitespace string, empty `[]`, or empty `{}`).
     * If the object has no keys, returns `true`.
     *
     * @param keys - Optional array of specific keys to inspect.
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns `true` if all inspected values are empty/undefined, `false` otherwise.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: undefined, b: "", c: null }).isAllEmpty(); // true
     * __sys__.utils.obj.of({ a: "value", b: "" }).isAllEmpty(); // false
     * ```
     */
    public isAllEmpty(
        keys?: (keyof T)[],
        options: { trim?: boolean } = { trim: true },
    ): boolean {
        const targetKeys = keys && keys.length > 0 ? keys : (Object.keys(this.current) as (keyof T)[]);
        if (targetKeys.length === 0) return true;

        const isValueEmpty = (val: unknown): boolean => {
            if (val === undefined || val === null) return true;
            if (typeof val === "string") {
                return options.trim !== false ? val.trim().length === 0 : val.length === 0;
            }
            if (Array.isArray(val)) return val.length === 0;
            if (typeof val === "object") {
                if (val instanceof Date || val instanceof RegExp) return false;
                return Object.keys(val).length === 0;
            }
            return false;
        };

        return targetKeys.every((k) => isValueEmpty(this.current[k]));
    }

    /**
     * **hasAny / hasAnyValue / hasPresent**
     *
     * Checks whether **at least one** property value in the object is present and non-empty
     * (not `undefined`, not `null`, not `""` empty string, not empty `[]`, and not empty `{}`).
     *
     * This is the exact inverse of {@link isAllEmpty}.
     *
     * @param keys - Optional array of specific keys to inspect.
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns `true` if at least one property is non-empty.
     *
     * @example
     * ```ts
     * const contact = __sys__.utils.obj.of({ name: undefined, phone: "+225010203", email: "" });
     * contact.hasAny(); // true (phone is filled)
     *
     * const emptyContact = __sys__.utils.obj.of({ name: undefined, phone: "", email: null });
     * emptyContact.hasAny(); // false (all fields empty)
     * ```
     */
    public hasAny(
        keys?: (keyof T)[],
        options: { trim?: boolean } = { trim: true },
    ): boolean {
        return !this.isAllEmpty(keys, options);
    }

    /**
     * **hasAnyValue**
     *
     * Alias for {@link hasAny}.
     */
    public hasAnyValue(
        keys?: (keyof T)[],
        options?: { trim?: boolean },
    ): boolean {
        return this.hasAny(keys, options);
    }

    /**
     * **hasNonNull**
     *
     * Checks whether **at least one** property in the object is not `null` and not `undefined`.
     * (Allows empty strings `""`, `[]` or `{}` as long as the value is defined and not `null`).
     *
     * @param keys - Optional array of specific keys to inspect.
     * @returns `true` if at least one property is not null and not undefined.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: undefined, b: null, c: "" }).hasNonNull(); // true (c is "")
     * __sys__.utils.obj.of({ a: undefined, b: null }).hasNonNull();         // false
     * ```
     */
    public hasNonNull(keys?: (keyof T)[]): boolean {
        const targetKeys = keys && keys.length > 0 ? keys : (Object.keys(this.current) as (keyof T)[]);
        if (targetKeys.length === 0) return false;
        return targetKeys.some((k) => this.current[k] !== null && this.current[k] !== undefined);
    }

    /**
     * **isAllNonNull**
     *
     * Checks whether **all** properties in the object are not `null` and not `undefined`.
     *
     * @param keys - Optional array of specific keys to inspect.
     * @returns `true` if all properties are not null and not undefined.
     */
    public isAllNonNull(keys?: (keyof T)[]): boolean {
        const targetKeys = keys && keys.length > 0 ? keys : (Object.keys(this.current) as (keyof T)[]);
        if (targetKeys.length === 0) return true;
        return targetKeys.every((k) => this.current[k] !== null && this.current[k] !== undefined);
    }

    /**
     * **hasUndefined**
     *
     * Checks whether at least one property value in the object is strictly `undefined` or missing.
     *
     * @param keys - Optional array of specific keys to inspect.
     * @returns `true` if at least one value is `undefined`.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ a: "ok", b: undefined }).hasUndefined(); // true
     * __sys__.utils.obj.of({ a: "ok", b: null }).hasUndefined(); // false
     * ```
     */
    public hasUndefined(keys?: (keyof T)[]): boolean {
        const targetKeys = keys && keys.length > 0 ? keys : (Object.keys(this.current) as (keyof T)[]);
        if (targetKeys.length === 0) return true;
        return targetKeys.some((k) => this.current[k] === undefined);
    }

    /**
     * **compact**
     *
     * Returns a new {@link ObjectWrapper} with all `undefined`, `null`, and empty string
     * properties removed from the wrapped object.
     *
     * @param options - Optional configuration (e.g. `trim: boolean`).
     * @returns A new wrapper around the cleaned object.
     *
     * @example
     * ```ts
     * __sys__.utils.obj.of({ name: "Alice", email: "", phone: undefined, notes: null })
     *   .compact()
     *   .value();
     * // { name: "Alice" }
     * ```
     */
    public compact(options: { trim?: boolean } = { trim: true }): ObjectWrapper<Partial<T>> {
        const result: Partial<T> = {};
        for (const key of Object.keys(this.current) as (keyof T)[]) {
            const val = this.current[key];
            if (val === undefined || val === null) continue;
            if (typeof val === "string") {
                const isEmptyStr = options.trim !== false ? val.trim().length === 0 : val.length === 0;
                if (isEmptyStr) continue;
            }
            result[key] = val;
        }
        return new ObjectWrapper(result);
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
