import { XStringify } from "xypriss-security";

/**
 * **ObjectUtils — XyPriss Object Utilities**
 */
export class ObjectUtils {
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
     * **parse**
     *
     * Safely parses a JSON string. If the parsing fails, the provided fallback
     * value is returned instead of throwing an exception.
     *
     * @param json The JSON string to parse.
     * @param fallback The fallback value to return on failure.
     * @returns The parsed object or the fallback value.
     */
    public parse<T>(json: string, fallback: T | null = null): T | null {
        try {
            return JSON.parse(json);
        } catch {
            return fallback;
        }
    }
}

