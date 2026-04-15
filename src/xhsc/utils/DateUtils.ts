/**
 * @file DateUtils.ts
 * @description XyPriss Date & Time Utilities — A comprehensive, zero-dependency
 * date/time utility class built on the native `Date` object and the `Intl` API.
 *
 * @remarks
 * All methods are pure and side-effect-free unless otherwise noted.
 * Timestamps can be provided in either **seconds** (Unix) or **milliseconds**
 * (JavaScript). The class auto-detects the unit using the heuristic:
 * values below `1e11` are treated as seconds; values at or above `1e11` are
 * treated as milliseconds. This heuristic is valid until **November 2286**.
 *
 * @example
 * ```ts
 * const du = new DateUtils();
 *
 * du.format(Date.now());            // "Apr 15, 2026"
 * du.timeAgo(Date.now() - 90_000); // "2 minutes ago"
 * du.formatDuration(3_661_000);    // "1h 1m 1s"
 * du.startOf("month");             // 2026-04-01T00:00:00.000Z
 * ```
 */
export class DateUtils {
    // ─────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────

    /**
     * Converts any supported input value to a `Date` object.
     *
     * Supported inputs:
     * - `Date` — returned as-is (not cloned).
     * - `number` — auto-detected as Unix seconds (`< 1e11`) or milliseconds.
     * - `string` — parsed via `new Date(string)` (ISO 8601 recommended).
     *
     * @param date - The value to convert.
     * @returns The corresponding `Date` object.
     * @throws {RangeError} If the resulting `Date` is invalid.
     *
     * @internal
     */
    private toDate(date: Date | number | string): Date {
        let d: Date;

        if (date instanceof Date) {
            d = date;
        } else if (typeof date === "number") {
            // Heuristic: Unix timestamps (seconds) are currently ~1.7e9.
            // JavaScript timestamps (ms) are ~1.7e12.
            // Values below 1e11 are assumed to be in seconds.
            const ms = date < 100_000_000_000 ? date * 1000 : date;
            d = new Date(ms);
        } else {
            d = new Date(date);
        }

        if (isNaN(d.getTime())) {
            throw new RangeError(`DateUtils: invalid date value — "${date}"`);
        }

        return d;
    }

    /**
     * Converts any supported input value to a millisecond timestamp.
     *
     * @param date - The value to convert.
     * @returns Milliseconds since the Unix epoch.
     *
     * @internal
     */
    private toMs(date: Date | number | string): number {
        return this.toDate(date).getTime();
    }

    // ─────────────────────────────────────────────
    //  Current time
    // ─────────────────────────────────────────────

    /**
     * Returns the current Unix timestamp in **seconds**.
     *
     * @returns The current time as a Unix timestamp (integer seconds).
     *
     * @example
     * ```ts
     * du.now(); // e.g. 1776287197
     * ```
     */
    public now(): number {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * Returns the current time as a JavaScript timestamp in **milliseconds**.
     *
     * Equivalent to `Date.now()`.
     *
     * @returns The current time in milliseconds since the Unix epoch.
     *
     * @example
     * ```ts
     * du.nowMs(); // e.g. 1776287197000
     * ```
     */
    public nowMs(): number {
        return Date.now();
    }

    /**
     * Returns the current time as a `Date` object.
     *
     * @returns A new `Date` representing the current instant.
     *
     * @example
     * ```ts
     * du.today(); // Date { ... }
     * ```
     */
    public today(): Date {
        return new Date();
    }

    // ─────────────────────────────────────────────
    //  Formatting
    // ─────────────────────────────────────────────

    /**
     * Serializes a date value into a localized string using `Intl.DateTimeFormat`.
     *
     * Automatically handles Unix timestamps (seconds) and JavaScript timestamps
     * (milliseconds) via the `< 1e11` heuristic.
     *
     * @param date    - The input to format: `Date`, number (timestamp), or ISO string.
     * @param locale  - BCP 47 locale tag (default: `"en-US"`).
     * @param options - `Intl.DateTimeFormatOptions` to customize the output.
     * @returns A localized date string.
     *
     * @example
     * ```ts
     * du.format(1776287197);
     * // → "Apr 15, 2026"
     *
     * du.format(new Date(), "fr-FR", { dateStyle: "full" });
     * // → "mercredi 15 avril 2026"
     *
     * du.format("2026-04-15T12:00:00Z", "en-GB", { timeStyle: "short" });
     * // → "12:00"
     * ```
     */
    public format(
        date: Date | number | string,
        locale: string = "en-US",
        options?: Intl.DateTimeFormatOptions,
    ): string {
        return new Intl.DateTimeFormat(locale, options).format(
            this.toDate(date),
        );
    }

    /**
     * Formats a date as an ISO 8601 string (`YYYY-MM-DDTHH:mm:ss.sssZ`).
     *
     * This is the format recommended for data interchange and storage.
     *
     * @param date - The date to format (default: current time).
     * @returns An ISO 8601 UTC string.
     *
     * @example
     * ```ts
     * du.toISO();
     * // → "2026-04-15T10:30:00.000Z"
     *
     * du.toISO(1776287197);
     * // → "2026-04-15T..."
     * ```
     */
    public toISO(date: Date | number | string = new Date()): string {
        return this.toDate(date).toISOString();
    }

    /**
     * Formats a date as a plain date string: `YYYY-MM-DD`.
     *
     * The date is rendered in **local time** unless a UTC flag is set.
     *
     * @param date - The date to format (default: current time).
     * @param utc  - If `true`, use UTC date components instead of local time (default: `false`).
     * @returns A date-only string in `YYYY-MM-DD` format.
     *
     * @example
     * ```ts
     * du.toDateString();
     * // → "2026-04-15"
     *
     * du.toDateString(new Date("2026-12-31T23:59:00Z"), true);
     * // → "2026-12-31"
     * ```
     */
    public toDateString(
        date: Date | number | string = new Date(),
        utc = false,
    ): string {
        const d = this.toDate(date);
        const y = utc ? d.getUTCFullYear() : d.getFullYear();
        const m = String(utc ? d.getUTCMonth() + 1 : d.getMonth() + 1).padStart(
            2,
            "0",
        );
        const day = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    /**
     * Formats a date as a time string: `HH:mm:ss`.
     *
     * The time is rendered in **local time** unless the UTC flag is set.
     *
     * @param date - The date to format (default: current time).
     * @param utc  - If `true`, use UTC time components (default: `false`).
     * @returns A time-only string in `HH:mm:ss` format.
     *
     * @example
     * ```ts
     * du.toTimeString(new Date("2026-04-15T08:05:03Z"), true);
     * // → "08:05:03"
     * ```
     */
    public toTimeString(
        date: Date | number | string = new Date(),
        utc = false,
    ): string {
        const d = this.toDate(date);
        const h = String(utc ? d.getUTCHours() : d.getHours()).padStart(2, "0");
        const min = String(utc ? d.getUTCMinutes() : d.getMinutes()).padStart(
            2,
            "0",
        );
        const sec = String(utc ? d.getUTCSeconds() : d.getSeconds()).padStart(
            2,
            "0",
        );
        return `${h}:${min}:${sec}`;
    }

    /**
     * Converts a duration into a human-readable string (e.g., `"1d 2h 30m 5s"`).
     *
     * Components are omitted when their value is zero, except for seconds which
     * always appear when the total duration is less than one minute.
     *
     * @param value - The duration to format.
     * @param unit  - The unit of `value`: `"ms"` (milliseconds, default) or `"s"` (seconds).
     * @returns A compact, space-separated duration string.
     *
     * @example
     * ```ts
     * du.formatDuration(3_661_000);       // → "1h 1m 1s"
     * du.formatDuration(90, "s");         // → "1m 30s"
     * du.formatDuration(0);              // → "0s"
     * du.formatDuration(86_400_000);     // → "1d"
     * ```
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
     * Returns a relative time string (e.g., `"5 minutes ago"`, `"in 2 hours"`).
     *
     * Uses `Intl.RelativeTimeFormat` for locale-aware output. Automatically
     * selects the most appropriate unit (second → minute → hour → day → month → year).
     *
     * @param date   - The reference date, in the past or future.
     * @param locale - BCP 47 locale tag (default: `"en-US"`).
     * @returns A localized relative time string.
     *
     * @example
     * ```ts
     * du.timeAgo(Date.now() - 90_000);       // → "2 minutes ago"
     * du.timeAgo(Date.now() + 3_600_000);    // → "in 1 hour"
     * du.timeAgo(Date.now() - 90_000, "fr"); // → "il y a 2 minutes"
     * ```
     */
    public timeAgo(
        date: Date | number | string,
        locale: string = "en-US",
    ): string {
        const ms = this.toMs(date);
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

    // ─────────────────────────────────────────────
    //  Arithmetic
    // ─────────────────────────────────────────────

    /**
     * Adds a given amount of time to a date and returns a new `Date`.
     *
     * Supported units: `"ms"`, `"s"` (seconds), `"m"` (minutes), `"h"` (hours),
     * `"d"` (days), `"w"` (weeks), `"mo"` (months), `"y"` (years).
     *
     * Month and year arithmetic is handled using `setMonth` / `setFullYear`,
     * which correctly accounts for varying month lengths (e.g., adding 1 month
     * to January 31 yields February 28/29).
     *
     * @param date  - The starting date.
     * @param value - The amount to add (can be negative to subtract).
     * @param unit  - The time unit.
     * @returns A new `Date` offset by the specified amount.
     *
     * @example
     * ```ts
     * du.add(new Date("2026-01-31"), 1, "mo");
     * // → Date("2026-02-28") — accounts for shorter February
     *
     * du.add(new Date("2026-04-15"), -7, "d");
     * // → Date("2026-04-08")
     *
     * du.add(Date.now(), 2, "h");
     * // → Date 2 hours from now
     * ```
     */
    public add(
        date: Date | number | string,
        value: number,
        unit: "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y",
    ): Date {
        const d = new Date(this.toMs(date));
        switch (unit) {
            case "ms":
                d.setMilliseconds(d.getMilliseconds() + value);
                break;
            case "s":
                d.setSeconds(d.getSeconds() + value);
                break;
            case "m":
                d.setMinutes(d.getMinutes() + value);
                break;
            case "h":
                d.setHours(d.getHours() + value);
                break;
            case "d":
                d.setDate(d.getDate() + value);
                break;
            case "w":
                d.setDate(d.getDate() + value * 7);
                break;
            case "mo": {
                const day = d.getDate();
                d.setMonth(d.getMonth() + value);
                if (d.getDate() !== day) {
                    d.setDate(0);
                }
                break;
            }
            case "y": {
                const day = d.getDate();
                const month = d.getMonth();
                d.setFullYear(d.getFullYear() + value);
                if (d.getMonth() !== month) {
                    d.setDate(0);
                }
                break;
            }
        }
        return d;
    }

    /**
     * Subtracts a given amount of time from a date and returns a new `Date`.
     *
     * This is a convenience wrapper around {@link add} with a negated `value`.
     *
     * @param date  - The starting date.
     * @param value - The amount to subtract (must be positive).
     * @param unit  - The time unit (same options as {@link add}).
     * @returns A new `Date` shifted back by the specified amount.
     *
     * @example
     * ```ts
     * du.subtract(new Date("2026-03-01"), 1, "mo");
     * // → Date("2026-02-01")
     * ```
     */
    public subtract(
        date: Date | number | string,
        value: number,
        unit: "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y",
    ): Date {
        return this.add(date, -value, unit);
    }

    // ─────────────────────────────────────────────
    //  Difference & comparison
    // ─────────────────────────────────────────────

    /**
     * Returns the difference between two dates in the specified unit.
     *
     * The result is the **signed** difference `(dateA - dateB)` truncated
     * toward zero. A positive value means `dateA` is later than `dateB`.
     *
     * Supported units: `"ms"`, `"s"`, `"m"`, `"h"`, `"d"`, `"w"`.
     * Month and year differences are intentionally excluded because their
     * variable length makes a lossless inverse impossible; use {@link add}
     * and calendar-aware logic for those cases.
     *
     * @param dateA - The first date.
     * @param dateB - The second date.
     * @param unit  - The unit for the result (default: `"ms"`).
     * @returns The signed integer difference in the requested unit.
     *
     * @example
     * ```ts
     * du.diff("2026-04-20", "2026-04-15", "d");  // → 5
     * du.diff("2026-04-10", "2026-04-15", "d");  // → -5
     * du.diff(Date.now(), Date.now() - 3600_000, "h"); // → 1
     * ```
     */
    public diff(
        dateA: Date | number | string,
        dateB: Date | number | string,
        unit: "ms" | "s" | "m" | "h" | "d" | "w" = "ms",
    ): number {
        const delta = this.toMs(dateA) - this.toMs(dateB);
        const divisors: Record<string, number> = {
            ms: 1,
            s: 1_000,
            m: 60_000,
            h: 3_600_000,
            d: 86_400_000,
            w: 604_800_000,
        };
        return Math.trunc(delta / divisors[unit]);
    }

    /**
     * Returns `true` if `dateA` is strictly before `dateB`.
     *
     * @param dateA - The first date.
     * @param dateB - The second date.
     * @returns `true` if `dateA < dateB`.
     *
     * @example
     * ```ts
     * du.isBefore("2026-01-01", "2026-06-01"); // → true
     * ```
     */
    public isBefore(
        dateA: Date | number | string,
        dateB: Date | number | string,
    ): boolean {
        return this.toMs(dateA) < this.toMs(dateB);
    }

    /**
     * Returns `true` if `dateA` is strictly after `dateB`.
     *
     * @param dateA - The first date.
     * @param dateB - The second date.
     * @returns `true` if `dateA > dateB`.
     *
     * @example
     * ```ts
     * du.isAfter("2026-12-31", "2026-06-01"); // → true
     * ```
     */
    public isAfter(
        dateA: Date | number | string,
        dateB: Date | number | string,
    ): boolean {
        return this.toMs(dateA) > this.toMs(dateB);
    }

    /**
     * Returns `true` if two dates represent the same instant in time.
     *
     * Comparison is performed at millisecond precision.
     *
     * @param dateA - The first date.
     * @param dateB - The second date.
     * @returns `true` if both dates resolve to the same millisecond.
     *
     * @example
     * ```ts
     * du.isSame(new Date("2026-04-15"), 1776268800000); // → true (if same instant)
     * ```
     */
    public isSame(
        dateA: Date | number | string,
        dateB: Date | number | string,
    ): boolean {
        return this.toMs(dateA) === this.toMs(dateB);
    }

    /**
     * Returns `true` if `date` falls within the range `[start, end]` (inclusive).
     *
     * @param date  - The date to test.
     * @param start - The start of the range.
     * @param end   - The end of the range.
     * @returns `true` if `start ≤ date ≤ end`.
     *
     * @example
     * ```ts
     * du.isBetween("2026-04-15", "2026-01-01", "2026-12-31"); // → true
     * du.isBetween("2025-12-31", "2026-01-01", "2026-12-31"); // → false
     * ```
     */
    public isBetween(
        date: Date | number | string,
        start: Date | number | string,
        end: Date | number | string,
    ): boolean {
        const ms = this.toMs(date);
        return ms >= this.toMs(start) && ms <= this.toMs(end);
    }

    // ─────────────────────────────────────────────
    //  Boundary helpers
    // ─────────────────────────────────────────────

    /**
     * Returns a new `Date` set to the **start** of the specified unit
     * (i.e., all smaller components zeroed out).
     *
     * Supported units: `"day"`, `"week"` (Monday = start), `"month"`, `"year"`.
     *
     * @param unit - The boundary unit.
     * @param date - The reference date (default: current time).
     * @returns A new `Date` at the beginning of the unit.
     *
     * @example
     * ```ts
     * du.startOf("day");
     * // → 2026-04-15T00:00:00.000 (local)
     *
     * du.startOf("month", new Date("2026-04-15"));
     * // → 2026-04-01T00:00:00.000
     *
     * du.startOf("year", "2026-06-15");
     * // → 2026-01-01T00:00:00.000
     * ```
     */
    public startOf(
        unit: "day" | "week" | "month" | "year",
        date: Date | number | string = new Date(),
    ): Date {
        const d = new Date(this.toMs(date));
        switch (unit) {
            case "day":
                d.setHours(0, 0, 0, 0);
                break;
            case "week": {
                const day = d.getDay(); // 0 = Sunday
                const diff = day === 0 ? -6 : 1 - day; // shift to Monday
                d.setDate(d.getDate() + diff);
                d.setHours(0, 0, 0, 0);
                break;
            }
            case "month":
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                break;
            case "year":
                d.setMonth(0, 1);
                d.setHours(0, 0, 0, 0);
                break;
        }
        return d;
    }

    /**
     * Returns a new `Date` set to the **end** of the specified unit
     * (i.e., the last millisecond of that unit).
     *
     * Supported units: `"day"`, `"week"` (Sunday = end), `"month"`, `"year"`.
     *
     * @param unit - The boundary unit.
     * @param date - The reference date (default: current time).
     * @returns A new `Date` at the very last millisecond of the unit.
     *
     * @example
     * ```ts
     * du.endOf("month", new Date("2026-02-01"));
     * // → 2026-02-28T23:59:59.999
     *
     * du.endOf("year", "2026-01-01");
     * // → 2026-12-31T23:59:59.999
     * ```
     */
    public endOf(
        unit: "day" | "week" | "month" | "year",
        date: Date | number | string = new Date(),
    ): Date {
        const d = new Date(this.toMs(date));
        switch (unit) {
            case "day":
                d.setHours(23, 59, 59, 999);
                break;
            case "week": {
                const day = d.getDay();
                const diff = day === 0 ? 0 : 7 - day; // shift to next Sunday
                d.setDate(d.getDate() + diff);
                d.setHours(23, 59, 59, 999);
                break;
            }
            case "month":
                d.setMonth(d.getMonth() + 1, 0); // day 0 of next month = last day of current
                d.setHours(23, 59, 59, 999);
                break;
            case "year":
                d.setMonth(11, 31);
                d.setHours(23, 59, 59, 999);
                break;
        }
        return d;
    }

    // ─────────────────────────────────────────────
    //  Calendar queries
    // ─────────────────────────────────────────────

    /**
     * Returns `true` if the given year is a leap year.
     *
     * A year is a leap year if it is divisible by 4, except for century years,
     * which must also be divisible by 400.
     *
     * @param year - The four-digit year to test (default: current year).
     * @returns `true` if the year is a leap year.
     *
     * @example
     * ```ts
     * du.isLeapYear(2024); // → true
     * du.isLeapYear(2100); // → false
     * du.isLeapYear(2000); // → true
     * ```
     */
    public isLeapYear(year: number = new Date().getFullYear()): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    /**
     * Returns the number of days in a given month of a given year.
     *
     * Correctly accounts for leap years when querying February.
     *
     * @param month - The 1-based month index (1 = January, 12 = December).
     * @param year  - The four-digit year (default: current year).
     * @returns The number of days in the specified month (28–31).
     *
     * @example
     * ```ts
     * du.daysInMonth(2, 2024); // → 29  (leap year)
     * du.daysInMonth(2, 2023); // → 28
     * du.daysInMonth(1, 2026); // → 31
     * ```
     */
    public daysInMonth(
        month: number,
        year: number = new Date().getFullYear(),
    ): number {
        // Day 0 of the next month equals the last day of the given month.
        return new Date(year, month, 0).getDate();
    }

    /**
     * Returns the ISO 8601 week number (1–53) for a given date.
     *
     * ISO 8601 defines Week 1 as the week containing the year's first Thursday.
     * Weeks run Monday–Sunday. A date in early January may belong to the
     * final week of the previous year (e.g., January 1, 2016 → Week 53 of 2015).
     *
     * @param date - The reference date (default: current time).
     * @returns The ISO week number.
     *
     * @example
     * ```ts
     * du.weekNumber(new Date("2026-01-01")); // → 1
     * du.weekNumber(new Date("2016-01-03")); // → 53 (belongs to 2015)
     * ```
     */
    public weekNumber(date: Date | number | string = new Date()): number {
        const d = new Date(this.toMs(date));
        // Set to nearest Thursday: current date + 4 - current day number (Mon=1 .. Sun=7)
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil(
            ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
        );
    }

    /**
     * Returns the day of the year (1–366) for a given date.
     *
     * @param date - The reference date (default: current time).
     * @returns An integer from 1 to 366.
     *
     * @example
     * ```ts
     * du.dayOfYear(new Date("2026-02-01")); // → 32
     * du.dayOfYear(new Date("2026-12-31")); // → 365
     * ```
     */
    public dayOfYear(date: Date | number | string = new Date()): number {
        const d = this.toDate(date);
        const start = new Date(d.getFullYear(), 0, 0);
        const diff = d.getTime() - start.getTime();
        return Math.floor(diff / 86_400_000);
    }

    /**
     * Returns the ISO 8601 quarter (1–4) in which the given date falls.
     *
     * @param date - The reference date (default: current time).
     * @returns A quarter number: `1`, `2`, `3`, or `4`.
     *
     * @example
     * ```ts
     * du.quarter(new Date("2026-04-15")); // → 2  (Apr–Jun)
     * du.quarter(new Date("2026-11-01")); // → 4  (Oct–Dec)
     * ```
     */
    public quarter(date: Date | number | string = new Date()): 1 | 2 | 3 | 4 {
        return (Math.floor(this.toDate(date).getMonth() / 3) + 1) as
            | 1
            | 2
            | 3
            | 4;
    }

    /**
     * Returns `true` if the given date falls on a weekend (Saturday or Sunday).
     *
     * The check uses **local time**.
     *
     * @param date - The date to check (default: current time).
     * @returns `true` if the date is a Saturday or Sunday.
     *
     * @example
     * ```ts
     * du.isWeekend(new Date("2026-04-18")); // → true  (Saturday)
     * du.isWeekend(new Date("2026-04-15")); // → false (Wednesday)
     * ```
     */
    public isWeekend(date: Date | number | string = new Date()): boolean {
        const day = this.toDate(date).getDay();
        return day === 0 || day === 6;
    }

    /**
     * Returns `true` if the given date falls on a weekday (Monday–Friday).
     *
     * @param date - The date to check (default: current time).
     * @returns `true` if the date is Monday through Friday.
     *
     * @example
     * ```ts
     * du.isWeekday(new Date("2026-04-15")); // → true
     * du.isWeekday(new Date("2026-04-19")); // → false (Sunday)
     * ```
     */
    public isWeekday(date: Date | number | string = new Date()): boolean {
        return !this.isWeekend(date);
    }

    /**
     * Returns `true` if two dates fall on the same calendar day (in local time).
     *
     * Only the year, month, and date components are compared; time is ignored.
     *
     * @param dateA - The first date.
     * @param dateB - The second date.
     * @returns `true` if both dates share the same year, month, and day.
     *
     * @example
     * ```ts
     * du.isSameDay("2026-04-15T08:00:00", "2026-04-15T22:00:00"); // → true
     * du.isSameDay("2026-04-15", "2026-04-16");                   // → false
     * ```
     */
    public isSameDay(
        dateA: Date | number | string,
        dateB: Date | number | string,
    ): boolean {
        const a = this.toDate(dateA);
        const b = this.toDate(dateB);
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    /**
     * Returns `true` if the given date is today (in local time).
     *
     * @param date - The date to test.
     * @returns `true` if `date` falls on the current calendar day.
     *
     * @example
     * ```ts
     * du.isToday(new Date()); // → true
     * du.isToday("2020-01-01"); // → false
     * ```
     */
    public isToday(date: Date | number | string): boolean {
        return this.isSameDay(date, new Date());
    }

    /**
     * Returns `true` if the given date is in the past (before the current instant).
     *
     * @param date - The date to check.
     * @returns `true` if `date` is strictly before `Date.now()`.
     *
     * @example
     * ```ts
     * du.isPast("2020-01-01"); // → true
     * du.isPast(Date.now() + 1000); // → false
     * ```
     */
    public isPast(date: Date | number | string): boolean {
        return this.toMs(date) < Date.now();
    }

    /**
     * Returns `true` if the given date is in the future (after the current instant).
     *
     * @param date - The date to check.
     * @returns `true` if `date` is strictly after `Date.now()`.
     *
     * @example
     * ```ts
     * du.isFuture(Date.now() + 5000); // → true
     * du.isFuture("2020-01-01");       // → false
     * ```
     */
    public isFuture(date: Date | number | string): boolean {
        return this.toMs(date) > Date.now();
    }

    // ─────────────────────────────────────────────
    //  Clamp & range utilities
    // ─────────────────────────────────────────────

    /**
     * Clamps a date to a `[min, max]` range.
     *
     * If `date` is before `min`, `min` is returned.
     * If `date` is after `max`, `max` is returned.
     * Otherwise, `date` is returned unchanged (as a new `Date`).
     *
     * @param date - The date to clamp.
     * @param min  - The lower bound.
     * @param max  - The upper bound.
     * @returns A new `Date` clamped within `[min, max]`.
     *
     * @example
     * ```ts
     * du.clamp("2025-01-01", "2026-01-01", "2026-12-31");
     * // → Date("2026-01-01")  — clamped to min
     *
     * du.clamp("2026-06-15", "2026-01-01", "2026-12-31");
     * // → Date("2026-06-15")  — within range, unchanged
     * ```
     */
    public clamp(
        date: Date | number | string,
        min: Date | number | string,
        max: Date | number | string,
    ): Date {
        const ms = Math.min(
            Math.max(this.toMs(date), this.toMs(min)),
            this.toMs(max),
        );
        return new Date(ms);
    }

    /**
     * Generates an array of `Date` objects representing each day in the range
     * `[start, end]`, inclusive.
     *
     * The range is capped at **3 650 days** (~10 years) to prevent accidental
     * allocation of enormous arrays.
     *
     * @param start - The first day of the range.
     * @param end   - The last day of the range.
     * @returns An ordered array of `Date` objects, one per day.
     * @throws {RangeError} If the range exceeds 3 650 days.
     *
     * @example
     * ```ts
     * du.dateRange("2026-04-13", "2026-04-15");
     * // → [Date("2026-04-13"), Date("2026-04-14"), Date("2026-04-15")]
     * ```
     */
    public dateRange(
        start: Date | number | string,
        end: Date | number | string,
    ): Date[] {
        const startMs = this.toMs(this.startOf("day", start));
        const endMs = this.toMs(this.startOf("day", end));
        const days = Math.round((endMs - startMs) / 86_400_000);

        if (days < 0) return [];
        if (days > 3_650) {
            throw new RangeError(
                `DateUtils.dateRange: range of ${days} days exceeds the 3,650-day limit.`,
            );
        }

        return Array.from(
            { length: days + 1 },
            (_, i) => new Date(startMs + i * 86_400_000),
        );
    }

    // ─────────────────────────────────────────────
    //  Validation & parsing
    // ─────────────────────────────────────────────

    /**
     * Returns `true` if the given value can be successfully interpreted
     * as a valid, finite date.
     *
     * Accepts `Date`, `number`, and `string` inputs. A `Date` whose
     * `getTime()` returns `NaN` is considered invalid.
     *
     * @param value - The value to validate.
     * @returns `true` if the value represents a valid date.
     *
     * @example
     * ```ts
     * du.isValid(new Date());           // → true
     * du.isValid("2026-04-15");         // → true
     * du.isValid("not-a-date");         // → false
     * du.isValid(new Date("invalid"));  // → false
     * du.isValid(NaN);                  // → false
     * ```
     */
    public isValid(value: unknown): boolean {
        try {
            if (
                typeof value !== "string" &&
                typeof value !== "number" &&
                !(value instanceof Date)
            ) {
                return false;
            }
            const d = this.toDate(value as Date | number | string);
            return !isNaN(d.getTime());
        } catch {
            return false;
        }
    }

    /**
     * Parses a date string using an ordered list of format patterns and returns
     * the first successfully parsed `Date`, or `null` if none match.
     *
     * Supported format tokens:
     * - `YYYY` — 4-digit year
     * - `MM`   — 2-digit month (01–12)
     * - `DD`   — 2-digit day (01–31)
     * - `HH`   — 2-digit hours (00–23)
     * - `mm`   — 2-digit minutes (00–59)
     * - `ss`   — 2-digit seconds (00–59)
     *
     * @param value   - The date string to parse.
     * @param formats - An ordered list of format strings to attempt.
     * @returns The first successfully parsed `Date`, or `null`.
     *
     * @example
     * ```ts
     * du.parse("15/04/2026", ["DD/MM/YYYY"]);
     * // → Date("2026-04-15")
     *
     * du.parse("2026-04-15 08:30:00", ["YYYY-MM-DD HH:mm:ss"]);
     * // → Date("2026-04-15T08:30:00")
     *
     * du.parse("bad-input", ["YYYY-MM-DD"]);
     * // → null
     * ```
     */
    public parse(value: string, formats: string[]): Date | null {
        for (const fmt of formats) {
            const tokens: Record<string, number> = {};
            let regexStr = fmt
                .replace("YYYY", "(?<YYYY>\\d{4})")
                .replace("MM", "(?<MM>\\d{2})")
                .replace("DD", "(?<DD>\\d{2})")
                .replace("HH", "(?<HH>\\d{2})")
                .replace("mm", "(?<mm>\\d{2})")
                .replace("ss", "(?<ss>\\d{2})");

            const match = new RegExp(`^${regexStr}$`).exec(value);
            if (!match?.groups) continue;

            const g = match.groups;
            const year = parseInt(g.YYYY ?? "1970", 10);
            const month = parseInt(g.MM ?? "1", 10) - 1;
            const day = parseInt(g.DD ?? "1", 10);
            const hour = parseInt(g.HH ?? "0", 10);
            const minute = parseInt(g.mm ?? "0", 10);
            const second = parseInt(g.ss ?? "0", 10);

            const d = new Date(year, month, day, hour, minute, second);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    }

    // ─────────────────────────────────────────────
    //  Timezone utilities
    // ─────────────────────────────────────────────

    /**
     * Returns the UTC offset of the local environment in minutes.
     *
     * Positive values indicate zones **behind** UTC (e.g., UTC-5 → `300`),
     * mirroring the behaviour of `Date.prototype.getTimezoneOffset()`.
     *
     * @returns The UTC offset in minutes.
     *
     * @example
     * ```ts
     * du.timezoneOffset(); // → -120 for UTC+2, 300 for UTC-5
     * ```
     */
    public timezoneOffset(): number {
        return new Date().getTimezoneOffset();
    }

    /**
     * Formats a date in a specific IANA timezone using `Intl.DateTimeFormat`.
     *
     * Requires the runtime to support the `timeZone` option (all modern
     * environments do).
     *
     * @param date     - The date to format.
     * @param timeZone - A valid IANA timezone identifier (e.g., `"America/New_York"`).
     * @param locale   - BCP 47 locale tag (default: `"en-US"`).
     * @param options  - Additional `Intl.DateTimeFormatOptions`.
     * @returns A localized date string in the given timezone.
     *
     * @example
     * ```ts
     * du.formatInTimezone(Date.now(), "Asia/Tokyo", "ja-JP", { dateStyle: "full", timeStyle: "short" });
     * // → "2026年4月15日水曜日 19:00"
     * ```
     */
    public formatInTimezone(
        date: Date | number | string,
        timeZone: string,
        locale: string = "en-US",
        options?: Omit<Intl.DateTimeFormatOptions, "timeZone">,
    ): string {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
            this.toDate(date),
        );
    }
}

