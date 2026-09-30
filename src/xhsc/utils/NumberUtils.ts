/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

/**
 * @file NumberUtils.ts
 * @description XyPriss Number & Math Utilities — A comprehensive suite of
 * everyday numeric calculations, file & storage conversions, percentage analytics,
 * pagination algorithms, precision roundings, and localized formatters.
 *
 * @remarks
 * All methods are pure and deterministic unless utilizing cryptographic randomness
 * provided by `xypriss-security`.
 *
 * @example
 * ```ts
 * const num = new NumberUtils();
 *
 * // File & Storage Calculations
 * num.formatBytes(15_728_640);            // "15 MB"
 * num.parseBytes("25.5 MB");              // 26738688
 * num.toMB(104857600);                   // 100
 *
 * // Daily Percentages & Ratios
 * num.percentage(45, 200);                // 22.5 (%)
 * num.percentageOf(20, 150);              // 30
 * num.percentageChange(100, 125);         // 25 (+25%)
 *
 * // Pagination Helper
 * num.paginate(154, 20, 2);               // { currentPage: 2, totalPages: 8, offset: 20, limit: 20, ... }
 * ```
 */

import { Random } from "xypriss-security";

/** Supported standard decimal byte units */
export type ByteUnit =
    | "B"
    | "KB"
    | "MB"
    | "GB"
    | "TB"
    | "PB"
    | "EB"
    | "ZB"
    | "YB";

/** Supported binary byte units (IEC standard) */
export type BinaryByteUnit =
    | "B"
    | "KiB"
    | "MiB"
    | "GiB"
    | "TiB"
    | "PiB"
    | "EiB"
    | "ZiB"
    | "YiB";

/** Options for customizing byte size formatting */
export interface FormatBytesOptions {
    /**
     * Number of decimal places to include.
     * @default 2
     */
    decimals?: number;

    /**
     * Whether to use binary unit labels (KiB, MiB, GiB...) instead of decimal labels (KB, MB, GB...).
     * @default false
     */
    binary?: boolean;

    /**
     * Custom separator between the numeric value and the unit label.
     * @default " "
     */
    spacer?: string;
}

/** Result returned by pagination calculations */
export interface PaginationResult {
    /** The current page number (1-indexed and clamped within [1, totalPages]) */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Number of items per page */
    pageSize: number;
    /** Total count of items */
    totalItems: number;
    /** Number of items to skip for database queries (SQL OFFSET / MongoDB skip) */
    offset: number;
    /** Number of items to retrieve for database queries (SQL LIMIT / MongoDB limit) */
    limit: number;
    /** 0-based index of the first item on the current page */
    startIndex: number;
    /** 0-based index of the last item on the current page */
    endIndex: number;
    /** True if a subsequent page exists */
    hasNext: boolean;
    /** True if a prior page exists */
    hasPrev: boolean;
}

/**
 * **NumberUtils — XyPriss Number & Math Utilities**
 *
 * Provides ready-to-use helpers for daily mathematical operations, data storage units,
 * rates, roundings, statistical metrics, bounds, and formatted output.
 */
export class NumberUtils {
    // ─────────────────────────────────────────────
    //  Internal Helpers
    // ─────────────────────────────────────────────

    /**
     * Flattens a variadic list of numbers or number arrays into a flat numeric array.
     *
     * @param args - Numbers or arrays of numbers.
     * @returns A flat array of valid numbers.
     * @internal
     */
    private flattenNumbers(args: (number | number[])[]): number[] {
        const result: number[] = [];
        for (const item of args) {
            if (Array.isArray(item)) {
                for (const num of item) {
                    if (typeof num === "number" && !isNaN(num)) {
                        result.push(num);
                    }
                }
            } else if (typeof item === "number" && !isNaN(item)) {
                result.push(item);
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────
    //  File Sizes & Storage Data Calculations
    // ─────────────────────────────────────────────

    /**
     * **Format Bytes**
     *
     * Converts a raw number of bytes into a human-readable size string (e.g., `KB`, `MB`, `GB` or `KiB`, `MiB`, `GiB`).
     * Supports negative values and configurable decimal precision.
     *
     * @param bytes - The number of bytes to format.
     * @param optionsOrDecimals - Number of decimal places (default: `2`) or a {@link FormatBytesOptions} configuration object.
     * @returns A human-readable file size string.
     *
     * @example
     * ```ts
     * num.formatBytes(0);                       // "0 Bytes"
     * num.formatBytes(1024);                    // "1 KB"
     * num.formatBytes(15728640, 1);             // "15 MB"
     * num.formatBytes(1073741824, { binary: true }); // "1 GiB"
     * ```
     */
    public formatBytes(
        bytes: number,
        optionsOrDecimals: number | FormatBytesOptions = 2,
    ): string {
        const options: FormatBytesOptions =
            typeof optionsOrDecimals === "number"
                ? { decimals: optionsOrDecimals }
                : optionsOrDecimals || {};

        const decimals =
            options.decimals !== undefined && options.decimals >= 0
                ? options.decimals
                : 2;
        const binary = options.binary ?? false;
        const spacer = options.spacer ?? " ";

        if (bytes === 0) {
            return `0${spacer}Bytes`;
        }

        const isNegative = bytes < 0;
        const absBytes = Math.abs(bytes);
        const k = 1024;
        const standardSizes = [
            "Bytes",
            "KB",
            "MB",
            "GB",
            "TB",
            "PB",
            "EB",
            "ZB",
            "YB",
        ];
        const binarySizes = [
            "Bytes",
            "KiB",
            "MiB",
            "GiB",
            "TiB",
            "PiB",
            "EiB",
            "ZiB",
            "YiB",
        ];
        const sizes = binary ? binarySizes : standardSizes;

        const i = Math.min(
            Math.floor(Math.log(absBytes) / Math.log(k)),
            sizes.length - 1,
        );

        if (i === 0) {
            return `${isNegative ? "-" : ""}${absBytes}${spacer}${sizes[0]}`;
        }

        const val = absBytes / Math.pow(k, i);
        const formatted = this.round(val, decimals);
        return `${isNegative ? "-" : ""}${formatted}${spacer}${sizes[i]}`;
    }

    /**
     * **Parse Bytes**
     *
     * Parses a human-readable storage string (e.g., `"10MB"`, `"1.5 GB"`, `"500KB"`, `"64KiB"`, `"1024 B"`)
     * into the equivalent raw number of bytes. Very helpful for upload limits, payload sizes, and cache config.
     *
     * @param input - The size string to parse or raw byte number.
     * @returns The parsed number of bytes, or `NaN` if parsing fails.
     *
     * @example
     * ```ts
     * num.parseBytes("500 KB");  // 512000
     * num.parseBytes("10MB");    // 10485760
     * num.parseBytes("1.5 GB");  // 1610612736
     * num.parseBytes("256 B");   // 256
     * ```
     */
    public parseBytes(input: string | number): number {
        if (typeof input === "number") {
            return isNaN(input) ? 0 : input;
        }
        if (!input || typeof input !== "string") {
            return 0;
        }

        const trimmed = input.trim();
        const match = trimmed.match(
            /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-zA-Z]*)$/,
        );
        if (!match) {
            return NaN;
        }

        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        if (!unit || unit === "B" || unit === "BYTES" || unit === "BYTE") {
            return Math.round(value);
        }

        const multipliers: Record<string, number> = {
            K: 1024,
            KB: 1024,
            KIB: 1024,
            M: 1024 ** 2,
            MB: 1024 ** 2,
            MIB: 1024 ** 2,
            G: 1024 ** 3,
            GB: 1024 ** 3,
            GIB: 1024 ** 3,
            T: 1024 ** 4,
            TB: 1024 ** 4,
            TIB: 1024 ** 4,
            P: 1024 ** 5,
            PB: 1024 ** 5,
            PIB: 1024 ** 5,
        };

        const mult = multipliers[unit];
        return mult !== undefined ? Math.round(value * mult) : NaN;
    }

    /**
     * **Convert Bytes to Kilobytes (KB)**
     *
     * @param bytes    - Number of raw bytes.
     * @param decimals - Decimal places (default: `2`).
     * @returns The value in Kilobytes.
     *
     * @example
     * ```ts
     * num.toKB(2048); // 2
     * ```
     */
    public toKB(bytes: number, decimals: number = 2): number {
        return this.round(bytes / 1024, decimals);
    }

    /**
     * **Convert Bytes to Megabytes (MB)**
     *
     * @param bytes    - Number of raw bytes.
     * @param decimals - Decimal places (default: `2`).
     * @returns The value in Megabytes.
     *
     * @example
     * ```ts
     * num.toMB(10485760); // 10
     * ```
     */
    public toMB(bytes: number, decimals: number = 2): number {
        return this.round(bytes / 1024 ** 2, decimals);
    }

    /**
     * **Convert Bytes to Gigabytes (GB)**
     *
     * @param bytes    - Number of raw bytes.
     * @param decimals - Decimal places (default: `2`).
     * @returns The value in Gigabytes.
     *
     * @example
     * ```ts
     * num.toGB(1073741824); // 1
     * ```
     */
    public toGB(bytes: number, decimals: number = 2): number {
        return this.round(bytes / 1024 ** 3, decimals);
    }

    /**
     * **Convert Bytes to Terabytes (TB)**
     *
     * @param bytes    - Number of raw bytes.
     * @param decimals - Decimal places (default: `2`).
     * @returns The value in Terabytes.
     *
     * @example
     * ```ts
     * num.toTB(1099511627776); // 1
     * ```
     */
    public toTB(bytes: number, decimals: number = 2): number {
        return this.round(bytes / 1024 ** 4, decimals);
    }

    /**
     * **Convert Bytes to Target Unit**
     *
     * Converts a byte count to any specified target unit (`KB`, `MB`, `GB`, `TB`, etc.).
     *
     * @param bytes      - The number of bytes.
     * @param targetUnit - Destination unit (e.g., `"MB"`, `"GB"`).
     * @param decimals   - Decimal places (default: `2`).
     * @returns The converted numeric value.
     *
     * @example
     * ```ts
     * num.convertBytes(52428800, "MB"); // 50
     * ```
     */
    public convertBytes(
        bytes: number,
        targetUnit: ByteUnit | BinaryByteUnit,
        decimals: number = 2,
    ): number {
        const unitMap: Record<string, number> = {
            B: 1,
            KB: 1024,
            KIB: 1024,
            MB: 1024 ** 2,
            MIB: 1024 ** 2,
            GB: 1024 ** 3,
            GIB: 1024 ** 3,
            TB: 1024 ** 4,
            TIB: 1024 ** 4,
            PB: 1024 ** 5,
            PIB: 1024 ** 5,
            EB: 1024 ** 6,
            EIB: 1024 ** 6,
            ZB: 1024 ** 7,
            ZIB: 1024 ** 7,
            YB: 1024 ** 8,
            YIB: 1024 ** 8,
        };
        const divisor = unitMap[targetUnit.toUpperCase()] ?? 1;
        return this.round(bytes / divisor, decimals);
    }

    /**
     * **Transfer Rate / Speed**
     *
     * Calculates the transfer throughput given transferred bytes and elapsed duration in milliseconds.
     *
     * @param bytes      - Transferred bytes.
     * @param durationMs - Duration in milliseconds.
     * @param decimals   - Decimal places (default: `2`).
     * @returns A formatted speed string (e.g., `"12.5 MB/s"`).
     *
     * @example
     * ```ts
     * num.transferRate(10485760, 2000); // "5 MB/s"
     * ```
     */
    public transferRate(
        bytes: number,
        durationMs: number,
        decimals: number = 2,
    ): string {
        if (durationMs <= 0 || bytes <= 0) {
            return "0 Bytes/s";
        }
        const bytesPerSec = (bytes / durationMs) * 1000;
        return `${this.formatBytes(bytesPerSec, decimals)}/s`;
    }

    /**
     * **Transfer Estimated Time of Arrival (ETA)**
     *
     * Calculates the remaining time in seconds to complete a file or data transfer.
     *
     * @param remainingBytes - Bytes left to transfer.
     * @param bytesPerSec    - Transfer throughput in bytes per second.
     * @returns Remaining time in seconds (rounded up), or `0` if invalid.
     *
     * @example
     * ```ts
     * num.transferETA(52428800, 10485760); // 5 (seconds)
     * ```
     */
    public transferETA(remainingBytes: number, bytesPerSec: number): number {
        if (bytesPerSec <= 0 || remainingBytes <= 0) {
            return 0;
        }
        return Math.ceil(remainingBytes / bytesPerSec);
    }

    // ─────────────────────────────────────────────
    //  Percentages, Ratios & Progress
    // ─────────────────────────────────────────────

    /**
     * **Calculate Percentage (Partial of Total)**
     *
     * Returns what percentage `partial` represents relative to `total`: `(partial / total) * 100`.
     * Safely returns `0` if `total === 0` to prevent division by zero.
     *
     * @param partial  - The partial amount.
     * @param total    - The reference total.
     * @param decimals - Decimal places (default: `2`).
     * @returns The percentage value (e.g. `25` for 25%).
     *
     * @example
     * ```ts
     * num.percentage(25, 200);   // 12.5
     * num.percentage(50, 100);   // 50
     * num.percentage(0, 0);      // 0
     * ```
     */
    public percentage(
        partial: number,
        total: number,
        decimals: number = 2,
    ): number {
        if (total === 0) {
            return 0;
        }
        return this.round((partial / total) * 100, decimals);
    }

    /**
     * **Calculate Value From Percentage (X% of Total)**
     *
     * Returns the actual value corresponding to `percent` of `total`: `(percent / 100) * total`.
     *
     * @param percent  - The percentage rate (e.g., `20` for 20%).
     * @param total    - The reference total.
     * @param decimals - Decimal places (default: `2`).
     * @returns The calculated portion.
     *
     * @example
     * ```ts
     * num.percentageOf(20, 150); // 30 (20% of 150 is 30)
     * num.percentageOf(5.5, 200); // 11
     * ```
     */
    public percentageOf(
        percent: number,
        total: number,
        decimals: number = 2,
    ): number {
        return this.round((percent / 100) * total, decimals);
    }

    /**
     * **Percentage Change / Growth Rate**
     *
     * Computes the relative percentage variation from `oldValue` to `newValue`.
     * Positive indicates an increase, negative indicates a decrease.
     *
     * @param oldValue - The baseline value.
     * @param newValue - The current value.
     * @param decimals - Decimal precision (default: `2`).
     * @returns Percentage variation.
     *
     * @example
     * ```ts
     * num.percentageChange(100, 150); // 50 (+50%)
     * num.percentageChange(200, 150); // -25 (-25%)
     * ```
     */
    public percentageChange(
        oldValue: number,
        newValue: number,
        decimals: number = 2,
    ): number {
        if (oldValue === 0) {
            return newValue === 0 ? 0 : 100;
        }
        const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
        return this.round(change, decimals);
    }

    /**
     * **Progress Ratio**
     *
     * Calculates a normalized progress value clamped strictly between `0.0` and `1.0`.
     * Ideal for progress bars and completion meters.
     *
     * @param current - The current progress value.
     * @param total   - The target total value.
     * @returns A float between `0.0` and `1.0`.
     *
     * @example
     * ```ts
     * num.progress(50, 100);  // 0.5
     * num.progress(120, 100); // 1.0 (clamped)
     * num.progress(-10, 100); // 0.0 (clamped)
     * ```
     */
    public progress(current: number, total: number): number {
        if (total <= 0) {
            return 0;
        }
        return this.clamp(current / total, 0, 1);
    }

    // ─────────────────────────────────────────────
    //  Rounding & Decimal Precision
    // ─────────────────────────────────────────────

    /**
     * **Accurate Decimal Rounding**
     *
     * Accurately rounds a number to a specified number of decimal places.
     * Uses exponential notation internally to avoid common JavaScript floating-point rounding bugs (e.g. `1.005 * 100`).
     *
     * @param value    - The number to round.
     * @param decimals - Decimal places (default: `0`).
     * @returns The rounded number.
     *
     * @example
     * ```ts
     * num.round(1.005, 2);   // 1.01 (avoids standard JS Math.round bug)
     * num.round(12.3456, 2); // 12.35
     * num.round(12.3456, 0); // 12
     * ```
     */
    public round(value: number, decimals: number = 0): number {
        if (isNaN(value)) {
            return NaN;
        }
        if (decimals <= 0) {
            return Math.round(value);
        }
        return Number(
            Math.round(Number(value + "e" + decimals)) + "e-" + decimals,
        );
    }

    /**
     * **Accurate Decimal Ceil**
     *
     * Rounds up to the nearest specified decimal precision.
     *
     * @param value    - The number to round up.
     * @param decimals - Decimal places (default: `0`).
     * @returns Ceiled value.
     *
     * @example
     * ```ts
     * num.ceil(1.234, 2); // 1.24
     * num.ceil(1.2, 0);   // 2
     * ```
     */
    public ceil(value: number, decimals: number = 0): number {
        if (isNaN(value)) {
            return NaN;
        }
        if (decimals <= 0) {
            return Math.ceil(value);
        }
        return Number(
            Math.ceil(Number(value + "e" + decimals)) + "e-" + decimals,
        );
    }

    /**
     * **Accurate Decimal Floor**
     *
     * Rounds down to the nearest specified decimal precision.
     *
     * @param value    - The number to round down.
     * @param decimals - Decimal places (default: `0`).
     * @returns Floored value.
     *
     * @example
     * ```ts
     * num.floor(1.239, 2); // 1.23
     * num.floor(1.9, 0);   // 1
     * ```
     */
    public floor(value: number, decimals: number = 0): number {
        if (isNaN(value)) {
            return NaN;
        }
        if (decimals <= 0) {
            return Math.floor(value);
        }
        return Number(
            Math.floor(Number(value + "e" + decimals)) + "e-" + decimals,
        );
    }

    /**
     * **Round to Step / Multiple**
     *
     * Rounds a value to the nearest multiple of a given step (e.g., nearest `5`, `0.25`, or `100`).
     *
     * @param value - The value to round.
     * @param step  - The increment step size.
     * @returns Value rounded to the nearest step.
     *
     * @example
     * ```ts
     * num.roundToStep(23, 5);      // 25
     * num.roundToStep(1.234, 0.05); // 1.25
     * num.roundToStep(1430, 500);  // 1500
     * ```
     */
    public roundToStep(value: number, step: number): number {
        if (step <= 0) {
            return value;
        }
        const inv = 1 / step;
        return Math.round(value * inv) / inv;
    }

    /**
     * **Round to Significant Digits**
     *
     * Formats a number to a specified number of significant digits.
     *
     * @param value  - The number to format.
     * @param digits - Number of significant digits.
     * @returns The number rounded to significant precision.
     *
     * @example
     * ```ts
     * num.toPrecision(12345, 3); // 12300
     * num.toPrecision(0.001234, 2); // 0.0012
     * ```
     */
    public toPrecision(value: number, digits: number): number {
        if (isNaN(value) || digits <= 0) {
            return value;
        }
        return parseFloat(value.toPrecision(digits));
    }

    // ─────────────────────────────────────────────
    //  Bounds, Clamping & Mapping
    // ─────────────────────────────────────────────

    /**
     * **Clamp a Value**
     *
     * Restricts a numeric value within a defined range `[min, max]`.
     * If `min > max`, the bounds are automatically swapped for safety.
     *
     * @param value - The value to clamp.
     * @param min   - The lower bound.
     * @param max   - The upper bound.
     * @returns The clamped value.
     *
     * @example
     * ```ts
     * num.clamp(15, 0, 10);  // 10
     * num.clamp(-5, 0, 10);  // 0
     * num.clamp(5, 0, 10);   // 5
     * ```
     */
    public clamp(value: number, min: number, max: number): number {
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        return Math.min(Math.max(value, lower), upper);
    }

    /**
     * **Check if Value is in Range**
     *
     * Determines whether a value falls within `[min, max]`.
     *
     * @param value     - The value to test.
     * @param min       - Range start.
     * @param max       - Range end.
     * @param inclusive - Whether the bounds are inclusive (default: `true`).
     * @returns `true` if value is within bounds.
     *
     * @example
     * ```ts
     * num.inRange(5, 1, 10);        // true
     * num.inRange(10, 1, 10, true); // true
     * num.inRange(10, 1, 10, false);// false
     * ```
     */
    public inRange(
        value: number,
        min: number,
        max: number,
        inclusive: boolean = true,
    ): boolean {
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        return inclusive
            ? value >= lower && value <= upper
            : value > lower && value < upper;
    }

    /**
     * **Normalize a Value (0 to 1)**
     *
     * Maps a value from its original range `[min, max]` into a normalized unit float `[0.0, 1.0]`.
     *
     * @param value - The input value.
     * @param min   - The minimum of the original range.
     * @param max   - The maximum of the original range.
     * @returns Normalized float.
     *
     * @example
     * ```ts
     * num.normalize(50, 0, 100); // 0.5
     * num.normalize(15, 10, 20); // 0.5
     * ```
     */
    public normalize(value: number, min: number, max: number): number {
        if (min === max) {
            return 0;
        }
        return (value - min) / (max - min);
    }

    /**
     * **Linear Interpolation (LERP)**
     *
     * Returns the linear interpolation between `start` and `end` for a factor `t`:
     * Formula: `start * (1 - t) + end * t`.
     *
     * @param start - The start value.
     * @param end   - The end value.
     * @param t     - The interpolation factor (typically `0.0` to `1.0`).
     * @returns The interpolated value.
     *
     * @example
     * ```ts
     * num.lerp(0, 100, 0.5); // 50
     * num.lerp(20, 80, 0.25); // 35
     * ```
     */
    public lerp(start: number, end: number, t: number): number {
        return start * (1 - t) + end * t;
    }

    /**
     * **Map Range (Re-scale)**
     *
     * Maps an input number from an incoming range `[inMin, inMax]` to an outgoing range `[outMin, outMax]`.
     *
     * @param value  - The number to map.
     * @param inMin  - Lower bound of input range.
     * @param inMax  - Upper bound of input range.
     * @param outMin - Lower bound of output range.
     * @param outMax - Upper bound of output range.
     * @returns The re-scaled value.
     *
     * @example
     * ```ts
     * // Map a 0-10 rating to a 0-100 percentage
     * num.mapRange(7.5, 0, 10, 0, 100); // 75
     *
     * // Map temperature sensor (0-1023) to degrees C (0-100)
     * num.mapRange(511.5, 0, 1023, 0, 100); // 50
     * ```
     */
    public mapRange(
        value: number,
        inMin: number,
        inMax: number,
        outMin: number,
        outMax: number,
    ): number {
        if (inMin === inMax) {
            return outMin;
        }
        return (
            ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
        );
    }

    // ─────────────────────────────────────────────
    //  Aggregates & Statistics
    // ─────────────────────────────────────────────

    /**
     * **Sum of Numbers**
     *
     * Computes the sum of all provided numbers or numeric arrays.
     *
     * @param numbers - Variadic numbers or number arrays.
     * @returns Total sum.
     *
     * @example
     * ```ts
     * num.sum(1, 2, 3, 4);       // 10
     * num.sum([10, 20, 30]);     // 60
     * ```
     */
    public sum(...numbers: (number | number[])[]): number {
        const flat = this.flattenNumbers(numbers);
        return flat.reduce((acc, curr) => acc + curr, 0);
    }

    /**
     * **Average / Arithmetic Mean**
     *
     * Computes the arithmetic mean of all provided numbers or numeric arrays.
     *
     * @param numbers - Variadic numbers or number arrays.
     * @returns The average, or `0` if empty.
     *
     * @example
     * ```ts
     * num.average(10, 20, 30);   // 20
     * num.average([5, 15]);      // 10
     * ```
     */
    public average(...numbers: (number | number[])[]): number {
        const flat = this.flattenNumbers(numbers);
        if (flat.length === 0) {
            return 0;
        }
        return this.sum(flat) / flat.length;
    }

    /**
     * **Median**
     *
     * Returns the statistical median (middle value) of a set of numbers.
     *
     * @param numbers - Variadic numbers or number arrays.
     * @returns The median value, or `0` if empty.
     *
     * @example
     * ```ts
     * num.median(1, 3, 5);       // 3
     * num.median([1, 2, 3, 4]);  // 2.5
     * ```
     */
    public median(...numbers: (number | number[])[]): number {
        const flat = this.flattenNumbers(numbers);
        if (flat.length === 0) {
            return 0;
        }
        const sorted = [...flat].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /**
     * **Minimum Value**
     *
     * Returns the minimum value from numbers or number arrays.
     *
     * @param numbers - Variadic numbers or number arrays.
     * @returns The smallest number, or `Infinity` if no numbers provided.
     *
     * @example
     * ```ts
     * num.min(10, 5, 20);        // 5
     * num.min([12, 4, 89]);      // 4
     * ```
     */
    public min(...numbers: (number | number[])[]): number {
        const flat = this.flattenNumbers(numbers);
        if (flat.length === 0) {
            return Infinity;
        }
        return Math.min(...flat);
    }

    /**
     * **Maximum Value**
     *
     * Returns the maximum value from numbers or number arrays.
     *
     * @param numbers - Variadic numbers or number arrays.
     * @returns The largest number, or `-Infinity` if no numbers provided.
     *
     * @example
     * ```ts
     * num.max(10, 5, 20);        // 20
     * num.max([12, 4, 89]);      // 89
     * ```
     */
    public max(...numbers: (number | number[])[]): number {
        const flat = this.flattenNumbers(numbers);
        if (flat.length === 0) {
            return -Infinity;
        }
        return Math.max(...flat);
    }

    // ─────────────────────────────────────────────
    //  Pagination & Integer Division
    // ─────────────────────────────────────────────

    /**
     * **Calculate Pagination**
     *
     * Computes all essential pagination parameters (`totalPages`, `offset`, `limit`, `startIndex`, `endIndex`, `hasNext`, `hasPrev`)
     * for database queries and user interfaces.
     *
     * @param totalItems  - Total number of items across the entire dataset.
     * @param pageSize    - Items per page (minimum 1).
     * @param currentPage - Requested 1-based page number (default: `1`).
     * @returns A structured {@link PaginationResult} object.
     *
     * @example
     * ```ts
     * const pageInfo = num.paginate(154, 20, 2);
     * // {
     * //   currentPage: 2,
     * //   totalPages: 8,
     * //   pageSize: 20,
     * //   totalItems: 154,
     * //   offset: 20,
     * //   limit: 20,
     * //   startIndex: 20,
     * //   endIndex: 39,
     * //   hasNext: true,
     * //   hasPrev: true
     * // }
     * ```
     */
    public paginate(
        totalItems: number,
        pageSize: number,
        currentPage: number = 1,
    ): PaginationResult {
        const safeTotal = Math.max(0, totalItems);
        const safePageSize = Math.max(1, pageSize);
        const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
        const safeCurrentPage = this.clamp(currentPage, 1, totalPages);
        const offset = (safeCurrentPage - 1) * safePageSize;
        const limit = safePageSize;
        const startIndex = safeTotal === 0 ? 0 : offset;
        const endIndex =
            safeTotal === 0
                ? 0
                : Math.min(offset + safePageSize - 1, safeTotal - 1);

        return {
            currentPage: safeCurrentPage,
            totalPages,
            pageSize: safePageSize,
            totalItems: safeTotal,
            offset,
            limit,
            startIndex,
            endIndex,
            hasNext: safeCurrentPage < totalPages,
            hasPrev: safeCurrentPage > 1,
        };
    }

    /**
     * **Euclidean Division (DivMod)**
     *
     * Simultaneously calculates the integer quotient and remainder of two numbers: `[quotient, remainder]`.
     * Extremely convenient for converting time units (seconds to minutes/seconds), grid positioning, and pagination.
     *
     * @param numerator   - The dividend.
     * @param denominator - The divisor.
     * @returns A tuple `[quotient, remainder]`.
     *
     * @example
     * ```ts
     * const [minutes, seconds] = num.divmod(135, 60); // [2, 15] (2 min 15 sec)
     * const [hours, remainingMin] = num.divmod(150, 60); // [2, 30] (2 h 30 min)
     * ```
     */
    public divmod(
        numerator: number,
        denominator: number,
    ): [quotient: number, remainder: number] {
        if (denominator === 0) {
            return [NaN, NaN];
        }
        const quotient = Math.trunc(numerator / denominator);
        const remainder = numerator % denominator;
        return [quotient, remainder];
    }

    // ─────────────────────────────────────────────
    //  Secure Randomness
    // ─────────────────────────────────────────────

    /**
     * **Get a Random Integer**
     *
     * Generates a cryptographically secure random integer.
     * Powered by `xypriss-security` Random core.
     *
     * - If one argument is provided: `[0, max)`
     * - If two arguments are provided: `[min, max)`
     *
     * @param minOrMax - Minimum value (inclusive) or maximum if second argument is omitted.
     * @param max      - Maximum value (exclusive).
     * @returns A secure random integer.
     *
     * @example
     * ```ts
     * num.randomInt(10);      // Secure integer in [0, 10)
     * num.randomInt(10, 50);  // Secure integer in [10, 50)
     * ```
     */
    public randomInt(...I: Parameters<typeof Random.Int>): number {
        return Random.Int(...I);
    }

    /**
     * **Get a Random Float**
     *
     * Generates a cryptographically secure random floating-point number between `min` and `max`.
     *
     * @param min      - Lower bound (default: `0`).
     * @param max      - Upper bound (default: `1`).
     * @param decimals - Decimal places (default: `4`).
     * @returns A secure random float.
     *
     * @example
     * ```ts
     * num.randomFloat();           // e.g. 0.4821
     * num.randomFloat(1.5, 9.5, 2); // e.g. 6.34
     * ```
     */
    public randomFloat(
        min: number = 0,
        max: number = 1,
        decimals: number = 4,
    ): number {
        let low = min;
        let high = max;
        if (low > high) {
            [low, high] = [high, low];
        }

        const bytes = Random.Bytes(4);
        const view = new DataView(bytes.buffer, bytes.byteOffset, 4);
        const uint32 = view.getUint32(0, true);
        const norm = uint32 / 0xffffffff;
        const val = low + norm * (high - low);
        return this.round(val, decimals);
    }

    /**
     * **Random Item Selection**
     *
     * Randomly picks an element from an array using cryptographically secure random numbers.
     *
     * @param items - The candidate array.
     * @returns A selected item from the array.
     *
     * @example
     * ```ts
     * num.randomChoice(["apple", "banana", "cherry"]); // e.g. "banana"
     * ```
     */
    public randomChoice<T>(items: T[]): T {
        return Random.pick(items);
    }

    // ─────────────────────────────────────────────
    //  Formatting & Localization
    // ─────────────────────────────────────────────

    /**
     * **Format Number**
     *
     * Locale-aware number formatting powered by `Intl.NumberFormat`.
     *
     * @param value   - The number to format.
     * @param locale  - Optional BCP 47 locale (default: `en-US`).
     * @param options - `Intl.NumberFormatOptions`.
     * @returns A localized string.
     *
     * @example
     * ```ts
     * num.formatNumber(1250000);              // "1,250,000"
     * num.formatNumber(1250000, "fr-FR");     // "1 250 000"
     * ```
     */
    public formatNumber(
        value: number,
        locale: string = "en-US",
        options?: Intl.NumberFormatOptions,
    ): string {
        return new Intl.NumberFormat(locale, options).format(value);
    }

    /**
     * **Compact Number Formatting**
     *
     * Formats large numbers compactly for dashboards, views, and metrics (e.g., `1.5K`, `2.3M`, `4.8B`).
     *
     * @param value    - The number to format.
     * @param locale   - Locale tag (default: `en-US`).
     * @param decimals - Decimal digits (default: `1`).
     * @returns A compact string.
     *
     * @example
     * ```ts
     * num.formatCompact(1500);       // "1.5K"
     * num.formatCompact(2500000);    // "2.5M"
     * num.formatCompact(1200000000); // "1.2B"
     * ```
     */
    public formatCompact(
        value: number,
        locale: string = "en-US",
        decimals: number = 1,
    ): string {
        return new Intl.NumberFormat(locale, {
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: decimals,
        }).format(value);
    }

    /**
     * **Format Currency**
     *
     * Formats a numeric value into a localized currency string.
     *
     * @param value    - The amount to format.
     * @param currency - ISO 4217 currency code (default: `"USD"`).
     * @param locale   - Locale tag (default: `"en-US"`).
     * @param options  - Additional `Intl.NumberFormatOptions`.
     * @returns Formatted currency string.
     *
     * @example
     * ```ts
     * num.formatCurrency(49.99, "USD");         // "$49.99"
     * num.formatCurrency(49.99, "EUR", "fr-FR"); // "49,99 €"
     * ```
     */
    public formatCurrency(
        value: number,
        currency: string = "USD",
        locale: string = "en-US",
        options?: Intl.NumberFormatOptions,
    ): string {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            ...options,
        }).format(value);
    }

    /**
     * **Format Percentage String**
     *
     * Formats a numeric value into a localized percentage string with the `%` symbol.
     *
     * @param value    - The percentage value (e.g. `15.5` or `0.155` if `isRatio: true`).
     * @param decimals - Decimal places (default: `1`).
     * @param locale   - Locale tag (default: `"en-US"`).
     * @param isRatio  - If `true`, multiplies value by 100 first (default: `false`).
     * @returns Formatted percentage string.
     *
     * @example
     * ```ts
     * num.formatPercent(15.5);              // "15.5%"
     * num.formatPercent(0.155, 1, "en-US", true); // "15.5%"
     * ```
     */
    public formatPercent(
        value: number,
        decimals: number = 1,
        locale: string = "en-US",
        isRatio: boolean = false,
    ): string {
        const percentValue = isRatio ? value * 100 : value;
        const formatted = this.formatNumber(
            this.round(percentValue, decimals),
            locale,
            {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            },
        );
        return `${formatted}%`;
    }

    /**
     * **Ordinal Number Suffix**
     *
     * Appends the appropriate ordinal suffix to a number (e.g. `1st`, `2nd`, `3rd`, `4th` in English, or `1er`, `2e` in French).
     *
     * @param num    - The integer number.
     * @param locale - Target locale (default: `"en-US"`).
     * @returns The number with its ordinal suffix.
     *
     * @example
     * ```ts
     * num.ordinal(1);          // "1st"
     * num.ordinal(2);          // "2nd"
     * num.ordinal(23);         // "23rd"
     * num.ordinal(1, "fr-FR"); // "1er"
     * num.ordinal(2, "fr-FR"); // "2e"
     * ```
     */
    public ordinal(num: number, locale: string = "en-US"): string {
        const intVal = Math.trunc(num);
        if (locale.startsWith("fr")) {
            return intVal === 1 ? "1er" : `${intVal}e`;
        }

        const abs = Math.abs(intVal);
        const mod100 = abs % 100;
        if (mod100 >= 11 && mod100 <= 13) {
            return `${intVal}th`;
        }
        switch (abs % 10) {
            case 1:
                return `${intVal}st`;
            case 2:
                return `${intVal}nd`;
            case 3:
                return `${intVal}rd`;
            default:
                return `${intVal}th`;
        }
    }

    // ─────────────────────────────────────────────
    //  Predicates & Checks
    // ─────────────────────────────────────────────

    /**
     * **Check Even**
     *
     * Returns `true` if the number is an even integer.
     *
     * @param value - The number to test.
     * @returns `true` if even.
     *
     * @example
     * ```ts
     * num.isEven(4); // true
     * num.isEven(3); // false
     * ```
     */
    public isEven(value: number): boolean {
        return value % 2 === 0;
    }

    /**
     * **Check Odd**
     *
     * Returns `true` if the number is an odd integer.
     *
     * @param value - The number to test.
     * @returns `true` if odd.
     *
     * @example
     * ```ts
     * num.isOdd(3); // true
     * num.isOdd(4); // false
     * ```
     */
    public isOdd(value: number): boolean {
        return Math.abs(value % 2) === 1;
    }

    /**
     * **Check Integer**
     *
     * Returns `true` if the value is a safe, finite integer.
     *
     * @param value - The number to test.
     * @returns `true` if an integer.
     *
     * @example
     * ```ts
     * num.isInteger(42);   // true
     * num.isInteger(42.5); // false
     * ```
     */
    public isInteger(value: number): boolean {
        return Number.isInteger(value);
    }

    /**
     * **Check Numeric**
     *
     * Checks if a value is a valid numeric value or a numeric string representing a finite number.
     *
     * @param value - Any value to test.
     * @returns Type guard confirming if the value is numeric.
     *
     * @example
     * ```ts
     * num.isNumeric(42);       // true
     * num.isNumeric("42.5");   // true
     * num.isNumeric("abc");    // false
     * num.isNumeric(null);     // false
     * ```
     */
    public isNumeric(value: unknown): value is number | string {
        if (typeof value === "number") {
            return !isNaN(value) && isFinite(value);
        }
        if (typeof value !== "string") {
            return false;
        }
        return (
            value.trim() !== "" &&
            !isNaN(Number(value)) &&
            isFinite(Number(value))
        );
    }

    /**
     * **Sign of a Number**
     *
     * Returns `-1` for negative numbers, `1` for positive numbers, and `0` for zero.
     *
     * @param value - The number.
     * @returns `-1 | 0 | 1`.
     *
     * @example
     * ```ts
     * num.sign(-42); // -1
     * num.sign(42);  // 1
     * num.sign(0);   // 0
     * ```
     */
    public sign(value: number): -1 | 0 | 1 {
        if (value > 0) return 1;
        if (value < 0) return -1;
        return 0;
    }
}
