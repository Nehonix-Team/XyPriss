/**
 * **ArrayUtils — XyPriss Array Utilities**
 */
export class ArrayUtils {
    /**
     * **Chunk an Array**
     *
     * Splits an array into sub-arrays of a fixed maximum size.
     */
    public chunk<T>(arr: T[], size: number): T[][] {
        return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
            arr.slice(i * size, i * size + size),
        );
    }

    /**
     * **Unique Elements**
     *
     * Returns a new array with all duplicates removed.
     */
    public unique<T>(arr: T[]): T[] {
        return [...new Set(arr)];
    }

    /**
     * **Shuffle Elements**
     *
     * Randomly reorders an array using the Fisher-Yates algorithm.
     */
    public shuffle<T>(arr: T[]): T[] {
        const newArr = [...arr];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }

    /**
     * **Group Elements**
     *
     * Groups array elements into an object based on a key-mapping function.
     */
    public groupBy<T>(
        arr: T[],
        keyFn: (item: T) => string,
    ): Record<string, T[]> {
        return arr.reduce(
            (acc, item) => {
                const key = keyFn(item);
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            },
            {} as Record<string, T[]>,
        );
    }

    /**
     * **Pick Random Sample**
     */
    public sample<T>(arr: T[]): T | undefined {
        if (arr.length === 0) return undefined;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * **Flatten One Level**
     */
    public flatten<T>(arr: T[][]): T[] {
        return arr.reduce((acc, val) => acc.concat(val), []);
    }
}

