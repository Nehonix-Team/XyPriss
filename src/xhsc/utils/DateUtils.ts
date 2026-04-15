/**
 * **DateUtils — XyPriss Date & Time Utilities**
 */
export class DateUtils {
    /**
     * **Format Duration**
     *
     * Converts milliseconds into a readable duration string (e.g., "1d 2h 30m").
     *
     * @param ms - Duration in milliseconds.
     * @returns A formatted string.
     */
    public formatDuration(ms: number): string {
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
     * **Format Date (Locale-aware)**
     *
     * Serializes a Date object into a localized string.
     */
    public formatDate(
        date: Date,
        locale: string = "en-US",
        options?: Intl.DateTimeFormatOptions,
    ): string {
        return new Intl.DateTimeFormat(locale, options).format(date);
    }

    /**
     * **Time Ago**
     *
     * Returns a relative time string (e.g., "5 minutes ago").
     */
    public timeAgo(date: Date, locale: string = "en-US"): string {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

        if (seconds < 60) return rtf.format(-seconds, "second");
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return rtf.format(-minutes, "minute");
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return rtf.format(-hours, "hour");
        const days = Math.floor(hours / 24);
        if (days < 30) return rtf.format(-days, "day");
        const months = Math.floor(days / 30);
        if (months < 12) return rtf.format(-months, "month");
        const years = Math.floor(months / 12);
        return rtf.format(-years, "year");
    }
}

