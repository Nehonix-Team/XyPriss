/**
 * **DateUtils — XyPriss Date & Time Utilities**
 */
export class DateUtils {
    /**
     * **now**
     *
     * Returns the current Unix timestamp in **seconds**.
     *
     * @returns Current timestamp in seconds.
     */
    public now(): number {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * **format**
     *
     * Serializes a date into a localized string. Automatically handles
     * Unix timestamps (seconds) and JavaScript timestamps (milliseconds).
     *
     * @param date - The input to format: Date object, number (timestamp), or ISO string.
     * @param locale - Optional locale (default: `en-US`).
     * @param options - Intl.DateTimeFormatOptions.
     * @returns A localized date string.
     *
     * @example
     * ```ts
     * utils.date.format(1776287197); // "Apr 15, 2026" (Auto-detects seconds)
     * ```
     */
    public format(
        date: Date | number | string,
        locale: string = "en-US",
        options?: Intl.DateTimeFormatOptions,
    ): string {
        let d: Date;

        if (date instanceof Date) {
            d = date;
        } else if (typeof date === "number") {
            // Heuristic: Unix timestamps (seconds) are currently ~1.7e9.
            // JavaScript timestamps (ms) are ~1.7e12.
            // If < 1e11, we assume it's seconds.
            const ms = date < 100000000000 ? date * 1000 : date;
            d = new Date(ms);
        } else {
            d = new Date(date);
        }

        return new Intl.DateTimeFormat(locale, options).format(d);
    }

    /**
     * **formatDuration**
     *
     * Converts a duration into a readable string (e.g., "1d 2h 30m").
     *
     * @param value - The duration to format.
     * @param unit - The unit of the input value: `"ms"` (default) or `"s"`.
     * @returns A formatted duration string.
     */
    public formatDuration(value: number, unit: "ms" | "s" = "ms"): string {
        const ms = unit === "s" ? value * 1000 : value;
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

        return parts.join(" ");
    }

    /**
     * **timeAgo**
     *
     * Returns a relative time string (e.g., "5 minutes ago").
     * Handles both seconds and milliseconds automatically.
     */
    public timeAgo(date: Date | number, locale: string = "en-US"): string {
        let ms: number;
        if (typeof date === "number") {
            ms = date < 100000000000 ? date * 1000 : date;
        } else {
            ms = date.getTime();
        }

        const deltaSeconds = Math.floor((Date.now() - ms) / 1000);
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

        if (Math.abs(deltaSeconds) < 60)
            return rtf.format(-deltaSeconds, "second");
        const minutes = Math.floor(deltaSeconds / 60);
        if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
        const hours = Math.floor(minutes / 60);
        if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
        const days = Math.floor(hours / 24);
        if (Math.abs(days) < 30) return rtf.format(-days, "day");
        const months = Math.floor(days / 30);
        if (Math.abs(months) < 12) return rtf.format(-months, "month");
        const years = Math.floor(months / 12);
        return rtf.format(-years, "year");
    }
}

