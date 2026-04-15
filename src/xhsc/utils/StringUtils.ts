/**
 * **StringUtils — XyPriss String Utilities**
 */
export class StringUtils {
    /**
     * **Generate a Random String**
     *
     * Generates a pseudo-random character sequence of a specified length.
     * Uses alphanumeric characters (A-Z, a-z, 0-9).
     *
     * @param length - The desired length of the string (default: `10`).
     * @returns A random alphanumeric string.
     *
     * @example
     * ```ts
     * utils.randomString(8); // "a7B2k9Xz"
     * ```
     */
    public randomString(length: number = 10): string {
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * **Slugify a String**
     *
     * Converts a string into a URL-friendly "slug" by lowering case,
     * removing non-alphanumeric characters, and replacing spaces with hyphens.
     *
     * @param text - The string to slugify.
     * @returns The URL-friendly slug.
     *
     * @example
     * ```ts
     * utils.slugify("Hello World!"); // "hello-world"
     * ```
     */
    public slugify(text: string): string {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    /**
     * **Truncate a String**
     *
     * Shortens a string to a specified length and appends a suffix (default: `...`)
     * if the original string was longer than the limit.
     *
     * @param text      - The string to truncate.
     * @param maxLength - Maximum length including the suffix.
     * @param suffix    - The string to append (default: `"..."`).
     * @returns The truncated string.
     *
     * @example
     * ```ts
     * utils.truncate("Very long sentence", 10); // "Very lo..."
     * ```
     */
    public truncate(
        text: string,
        maxLength: number,
        suffix: string = "...",
    ): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * **Capitalize a String**
     *
     * Uppercases the first character of the string.
     *
     * @param text - The string to capitalize.
     * @returns The capitalized string.
     */
    public capitalize(text: string): string {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    /**
     * **Convert to camelCase**
     *
     * Converts hyphen-separated, underscore-separated, or space-separated
     * strings into camelCase.
     *
     * @param text - The string to convert.
     * @returns The camelCase string.
     */
    public toCamelCase(text: string): string {
        return text
            .replace(/([-_ ][a-z])/gi, ($1) =>
                $1.toUpperCase().replace(/[-_ ]/g, ""),
            )
            .replace(/^[A-Z]/, (first) => first.toLowerCase());
    }

    /**
     * **Pad a String**
     *
     * Adds padding characters to the start or end of a string until it
     * reaches the target length.
     *
     * @param text     - The source string.
     * @param length   - Target length.
     * @param char     - Padding character (default: `" "`).
     * @param position - Whether to pad at `"start"` or `"end"`.
     * @returns The padded string.
     */
    public pad(
        text: string,
        length: number,
        char: string = " ",
        position: "start" | "end" = "start",
    ): string {
        return position === "start"
            ? text.padStart(length, char)
            : text.padEnd(length, char);
    }

    /**
     * **Count Word/Substring Occurrences**
     *
     * Returns the number of times a specific word or substring appears.
     *
     * @param text          - The body of text to search.
     * @param word          - The substring to look for.
     * @param caseSensitive - Whether to respect case (default: `false`).
     * @returns The number of occurrences.
     */
    public countOccurrences(
        text: string,
        word: string,
        caseSensitive: boolean = false,
    ): number {
        const flags = caseSensitive ? "g" : "gi";
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return (text.match(new RegExp(escaped, flags)) || []).length;
    }

    /**
     * **toQueryString**
     *
     * Serializes a flat record into a URL-encoded query string format.
     *
     * @param params The object to serialize.
     * @returns The query string.
     */
    public toQueryString(params: Record<string, unknown>): string {
        return Object.entries(params)
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
            )
            .join("&");
    }
}

