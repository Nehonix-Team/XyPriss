/**
 * **FunctionUtils — Functional Programming Helpers**
 */
export class FunctionUtils {
    /**
     * **memo**
     *
     * Returns a memoized version of a function that caches its results based on input parameters.
     *
     * @param fn The function to memoize.
     * @returns The memoized function.
     */
    public memo<T extends (...args: any[]) => any>(fn: T): T {
        const cache = new Map<string, any>();
        return ((...args: any[]) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) return cache.get(key);
            const result = fn(...args);
            cache.set(key, result);
            return result;
        }) as T;
    }
}

