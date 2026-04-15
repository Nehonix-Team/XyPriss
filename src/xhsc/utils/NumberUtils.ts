/**
 * **NumberUtils — XyPriss Number & Math Utilities**
 */
export class NumberUtils {
    /**
     * **Clamp a Value**
     *
     * Restricts a numeric value to a defined range [min, max].
     *
     * @param value - The value to clamp.
     * @param min   - The lower bound.
     * @param max   - The upper bound.
     * @returns The clamped value.
     */
    public clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * **Linear Interpolation (LERP)**
     *
     * Returns the linear interpolation between `start` and `end` for a factor `t`.
     *
     * @param start - The start value.
     * @param end   - The end value.
     * @param t     - The interpolation factor (0.0 to 1.0).
     * @returns The interpolated value.
     */
    public lerp(start: number, end: number, t: number): number {
        return start * (1 - t) + end * t;
    }

    /**
     * **Get a Random Integer**
     *
     * Returns a random integer between min (inclusive) and max (inclusive).
     *
     * @param min - Minimum value.
     * @param max - Maximum value.
     * @returns A random integer.
     */
    public randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * **Format Number**
     *
     * Locale-aware number formatting.
     *
     * @param value   - The number to format.
     * @param locale  - Optional locale (default: `en-US`).
     * @param options - Intl.NumberFormatOptions.
     * @returns A localized string.
     */
    public formatNumber(
        value: number,
        locale: string = "en-US",
        options?: Intl.NumberFormatOptions,
    ): string {
        return new Intl.NumberFormat(locale, options).format(value);
    }

    /**
     * **Format Bytes**
     *
     * Converts raw bytes into a human-readable size string (KB, MB, GB, etc.).
     *
     * @param bytes    - The number of bytes.
     * @param decimals - Decimal precision.
     * @returns A human-readable size string.
     */
    public formatBytes(bytes: number, decimals: number = 2): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
        );
    }
}

