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

import { ID } from "nehoid";

/**
 * **StringUtils — XyPriss String Utilities**
 *
 * A collection of dependency-free helpers for everyday string manipulation:
 * case conversion (`camelCase`, `kebab-case`, `snake_case`, `Title Case`),
 * sanitization (HTML escaping/stripping, accent stripping, whitespace
 * normalization), validation (emails, URLs, palindromes), extraction
 * (emails, URLs, substrings between markers), masking of sensitive data,
 * fuzzy comparison (Levenshtein distance, similarity score), text layout
 * (word wrap, chunking), and generation (random strings, UUIDs).
 *
 * All methods are pure functions with no side effects and no external
 * dependencies — instantiate once and reuse across your application.
 *
 * @remarks
 * The public API surface of this class is conventionally exposed as `str.**`
 * (e.g. `str.slugify(...)`, `str.toCamelCase(...)`) in XyPriss.
 *
 * @example
 * ```ts
 * import { StringUtils } from "xypriss";
 *
 * const str = new StringUtils();
 *
 * str.slugify("Hello World!");       // "hello-world"
 * str.toCamelCase("hello-world");    // "helloWorld"
 * str.truncate("A very long text", 10); // "A very ..."
 * str.mask("4111111111111111", { visibleStart: 4, visibleEnd: 4 }); // "4111********1111"
 * ```
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

    /**
     * **Reverse a String**
     *
     * Reverses the characters of a string. Uses `Array.from` internally so
     * multi-byte / surrogate-pair characters (emojis, accented letters, etc.)
     * are not mangled.
     *
     * @param text - The string to reverse.
     * @returns The reversed string.
     *
     * @example
     * ```ts
     * str.reverse("hello"); // "olleh"
     * ```
     */
    public reverse(text: string): string {
        return Array.from(text).reverse().join("");
    }

    /**
     * **Check if a String is a Palindrome**
     *
     * Determines whether a string reads the same forwards and backwards.
     *
     * @param text          - The string to check.
     * @param options       - Comparison options.
     * @param options.caseSensitive - Respect letter casing (default: `false`).
     * @param options.ignoreSpaces  - Ignore spaces and punctuation (default: `true`).
     * @returns `true` if the string is a palindrome.
     *
     * @example
     * ```ts
     * str.isPalindrome("A man a plan a canal Panama"); // true
     * str.isPalindrome("Hello"); // false
     * ```
     */
    public isPalindrome(
        text: string,
        options: { caseSensitive?: boolean; ignoreSpaces?: boolean } = {},
    ): boolean {
        const { caseSensitive = false, ignoreSpaces = true } = options;
        let normalized = text;
        if (ignoreSpaces)
            normalized = normalized.replace(/[^\p{L}\p{N}]/gu, "");
        if (!caseSensitive) normalized = normalized.toLowerCase();
        return normalized === this.reverse(normalized);
    }

    /**
     * **Count Words**
     *
     * Counts the number of words in a string, splitting on whitespace.
     *
     * @param text - The string to analyze.
     * @returns The number of words found.
     *
     * @example
     * ```ts
     * str.wordCount("The quick brown fox"); // 4
     * ```
     */
    public wordCount(text: string): number {
        const trimmed = text.trim();
        if (trimmed === "") return 0;
        return trimmed.split(/\s+/).length;
    }

    /**
     * **Strip HTML Tags**
     *
     * Removes all HTML/XML tags from a string, leaving only the text content.
     *
     * @param html - The HTML string to clean.
     * @returns The plain-text content.
     *
     * @example
     * ```ts
     * str.stripHtml("<p>Hello <b>World</b></p>"); // "Hello World"
     * ```
     */
    public stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, "");
    }

    /**
     * **Escape HTML Entities**
     *
     * Escapes characters that have special meaning in HTML (`&`, `<`, `>`,
     * `"`, `'`) so a string can be safely embedded in markup.
     *
     * @param text - The string to escape.
     * @returns The HTML-safe string.
     *
     * @example
     * ```ts
     * str.escapeHtml('<script>alert("hi")</script>');
     * // "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;"
     * ```
     */
    public escapeHtml(text: string): string {
        const map: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    }

    /**
     * **Unescape HTML Entities**
     *
     * Converts common HTML entities back to their literal characters.
     * The inverse operation of {@link StringUtils.escapeHtml}.
     *
     * @param text - The string containing HTML entities.
     * @returns The unescaped string.
     *
     * @example
     * ```ts
     * str.unescapeHtml("Tom &amp; Jerry"); // "Tom & Jerry"
     * ```
     */
    public unescapeHtml(text: string): string {
        const map: Record<string, string> = {
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": '"',
            "&#39;": "'",
            "&apos;": "'",
        };
        return text.replace(
            /&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g,
            (entity) => map[entity],
        );
    }

    /**
     * **Split a String into Words**
     *
     * Internal helper that tokenizes camelCase, PascalCase, kebab-case,
     * snake_case, or space separated text into an array of lowercase words.
     * Used by the various case-conversion methods to keep their behavior
     * consistent.
     *
     * @param text - The string to tokenize.
     * @returns An array of lowercase word tokens.
     */
    private splitWords(text: string): string[] {
        return (
            text
                // insert a boundary between a lowercase/digit and an uppercase letter
                .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                // insert a boundary between consecutive uppercase letters followed by lowercase (e.g. "XMLParser" -> "XML Parser")
                .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
                // treat hyphens/underscores as separators
                .replace(/[-_]+/g, " ")
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((word) => word.toLowerCase())
        );
    }

    /**
     * **Convert to kebab-case**
     *
     * @param text - The string to convert.
     * @returns The kebab-case string.
     *
     * @example
     * ```ts
     * str.toKebabCase("Hello World"); // "hello-world"
     * str.toKebabCase("helloWorld");  // "hello-world"
     * ```
     */
    public toKebabCase(text: string): string {
        return this.splitWords(text).join("-");
    }

    /**
     * **Convert to snake_case**
     *
     * @param text - The string to convert.
     * @returns The snake_case string.
     *
     * @example
     * ```ts
     * str.toSnakeCase("Hello World"); // "hello_world"
     * str.toSnakeCase("helloWorld");  // "hello_world"
     * ```
     */
    public toSnakeCase(text: string): string {
        return this.splitWords(text).join("_");
    }

    /**
     * **Convert to PascalCase**
     *
     * @param text - The string to convert.
     * @returns The PascalCase string.
     *
     * @example
     * ```ts
     * str.toPascalCase("hello world"); // "HelloWorld"
     * str.toPascalCase("hello-world"); // "HelloWorld"
     * ```
     */
    public toPascalCase(text: string): string {
        return this.splitWords(text)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join("");
    }

    /**
     * **Convert to Title Case**
     *
     * Capitalizes the first letter of every word.
     *
     * @param text - The string to convert.
     * @returns The title-cased string.
     *
     * @example
     * ```ts
     * str.toTitleCase("the lord of the rings"); // "The Lord Of The Rings"
     * ```
     */
    public toTitleCase(text: string): string {
        return text.replace(
            /\w\S*/g,
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        );
    }

    /**
     * **Mask a String**
     *
     * Obscures the middle portion of a string with a repeated character,
     * commonly used to redact sensitive data such as emails, card numbers,
     * or phone numbers while keeping a few characters visible at each end.
     *
     * @param text            - The string to mask.
     * @param options         - Masking options.
     * @param options.visibleStart - Number of visible characters at the start (default: `2`).
     * @param options.visibleEnd   - Number of visible characters at the end (default: `2`).
     * @param options.maskChar      - Character used for masking (default: `"*"`).
     * @returns The masked string.
     *
     * @example
     * ```ts
     * str.mask("4111111111111111", { visibleStart: 4, visibleEnd: 4 });
     * // "4111********1111"
     * str.mask("john.doe@example.com", { visibleStart: 2, visibleEnd: 0 });
     * // "jo******************"
     * ```
     */
    public mask(
        text: string,
        options: {
            visibleStart?: number;
            visibleEnd?: number;
            maskChar?: string;
        } = {},
    ): string {
        const { visibleStart = 2, visibleEnd = 2, maskChar = "*" } = options;
        if (text.length <= visibleStart + visibleEnd) {
            return maskChar.repeat(text.length);
        }
        const start = text.slice(0, visibleStart);
        const end = visibleEnd > 0 ? text.slice(-visibleEnd) : "";
        const middleLength = text.length - visibleStart - visibleEnd;
        return start + maskChar.repeat(middleLength) + end;
    }

    /**
     * **Levenshtein Distance**
     *
     * Computes the minimum number of single-character edits (insertions,
     * deletions, substitutions) required to change one string into another.
     *
     * @param a - The first string.
     * @param b - The second string.
     * @returns The edit distance between the two strings.
     *
     * @example
     * ```ts
     * str.levenshteinDistance("kitten", "sitting"); // 3
     * ```
     */
    public levenshteinDistance(a: string, b: string): number {
        const rows = a.length + 1;
        const cols = b.length + 1;
        const matrix: number[][] = Array.from({ length: rows }, (_, i) => [
            i,
            ...new Array(cols - 1).fill(0),
        ]);
        for (let j = 0; j < cols; j++) matrix[0][j] = j;

        for (let i = 1; i < rows; i++) {
            for (let j = 1; j < cols; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1, // deletion
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j - 1] + cost, // substitution
                );
            }
        }
        return matrix[rows - 1][cols - 1];
    }

    /**
     * **String Similarity**
     *
     * Returns a normalized similarity score between two strings based on
     * the Levenshtein distance, where `1` means identical and `0` means
     * completely different.
     *
     * @param a - The first string.
     * @param b - The second string.
     * @returns A similarity score between `0` and `1`.
     *
     * @example
     * ```ts
     * str.similarity("hello", "hallo"); // 0.8
     * ```
     */
    public similarity(a: string, b: string): number {
        const maxLength = Math.max(a.length, b.length);
        if (maxLength === 0) return 1;
        return 1 - this.levenshteinDistance(a, b) / maxLength;
    }

    /**
     * **Word Wrap**
     *
     * Wraps text so that each line does not exceed a given width, breaking
     * only at word boundaries.
     *
     * @param text      - The text to wrap.
     * @param width     - Maximum number of characters per line.
     * @param lineBreak - The line-break sequence to insert (default: `"\n"`).
     * @returns The wrapped text.
     *
     * @example
     * ```ts
     * str.wordWrap("The quick brown fox jumps over the lazy dog", 15);
     * // "The quick brown\nfox jumps over\nthe lazy dog"
     * ```
     */
    public wordWrap(
        text: string,
        width: number,
        lineBreak: string = "\n",
    ): string {
        const words = text.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (candidate.length > width && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = candidate;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.join(lineBreak);
    }

    /**
     * **Chunk a String**
     *
     * Splits a string into an array of fixed-size substrings.
     *
     * @param text - The string to split.
     * @param size - The maximum length of each chunk.
     * @returns An array of string chunks.
     *
     * @example
     * ```ts
     * str.chunk("ABCDEFGHIJ", 3); // ["ABC", "DEF", "GHI", "J"]
     * ```
     */
    public chunk(text: string, size: number): string[] {
        if (size <= 0) throw new Error("Chunk size must be greater than 0");
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * **Strip Accents / Diacritics**
     *
     * Removes accents and diacritical marks from a string, e.g. converting
     * `"café"` to `"cafe"`. Useful for search normalization and slugs.
     *
     * @param text - The string to normalize.
     * @returns The de-accented string.
     *
     * @example
     * ```ts
     * str.stripAccents("café résumé"); // "cafe resume"
     * ```
     */
    public stripAccents(text: string): string {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    /**
     * **Extract Emails**
     *
     * Finds and returns all email addresses contained in a block of text.
     *
     * @param text - The text to search.
     * @returns An array of email addresses found (empty if none).
     *
     * @example
     * ```ts
     * str.extractEmails("Contact us at hi@example.com or support@example.org");
     * // ["hi@example.com", "support@example.org"]
     * ```
     */
    public extractEmails(text: string): string[] {
        const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        return text.match(regex) || [];
    }

    /**
     * **Extract URLs**
     *
     * Finds and returns all `http(s)` URLs contained in a block of text.
     *
     * @param text - The text to search.
     * @returns An array of URLs found (empty if none).
     *
     * @example
     * ```ts
     * str.extractUrls("Visit https://example.com or http://test.org/page");
     * // ["https://example.com", "http://test.org/page"]
     * ```
     */
    public extractUrls(text: string): string[] {
        const regex = /https?:\/\/[^\s<>"')]+/g;
        return text.match(regex) || [];
    }

    /**
     * **Validate an Email Address**
     *
     * Checks whether the entire given string is a syntactically valid
     * email address.
     *
     * @param text - The string to validate.
     * @returns `true` if the string is a valid email address.
     *
     * @example
     * ```ts
     * str.isEmail("hi@example.com"); // true
     * str.isEmail("not-an-email");   // false
     * ```
     */
    public isEmail(text: string): boolean {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text);
    }

    /**
     * **Validate a URL**
     *
     * Checks whether the given string is a well-formed URL.
     *
     * @param text - The string to validate.
     * @returns `true` if the string is a valid URL.
     *
     * @example
     * ```ts
     * str.isUrl("https://example.com"); // true
     * str.isUrl("not a url");            // false
     * ```
     */
    public isUrl(text: string): boolean {
        try {
            new URL(text);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * **Escape Regular Expression Special Characters**
     *
     * Escapes characters that have special meaning in a regular expression,
     * so a string can be safely used inside a `RegExp` constructor.
     *
     * @param text - The string to escape.
     * @returns The escaped string, safe for use in `new RegExp(...)`.
     *
     * @example
     * ```ts
     * new RegExp(str.escapeRegExp("a.b*c")); // matches literal "a.b*c"
     * ```
     */
    public escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * **Extract Substring Between Two Markers**
     *
     * Returns the substring located between the first occurrence of `start`
     * and the following occurrence of `end`.
     *
     * @param text  - The source string.
     * @param start - The marker preceding the desired substring.
     * @param end   - The marker following the desired substring.
     * @returns The substring between the markers, or `null` if either marker is not found.
     *
     * @example
     * ```ts
     * str.between("Hello [World]!", "[", "]"); // "World"
     * str.between("<b>bold</b>", "<b>", "</b>"); // "bold"
     * ```
     */
    public between(text: string, start: string, end: string): string | null {
        const startIndex = text.indexOf(start);
        if (startIndex === -1) return null;
        const from = startIndex + start.length;
        const endIndex = text.indexOf(end, from);
        if (endIndex === -1) return null;
        return text.slice(from, endIndex);
    }

    /**
     * **Normalize Whitespace**
     *
     * Collapses runs of whitespace (spaces, tabs, newlines) into a single
     * space and trims the result.
     *
     * @param text - The string to normalize.
     * @returns The normalized string.
     *
     * @example
     * ```ts
     * str.normalizeWhitespace("  Hello   \n\t World  "); // "Hello World"
     * ```
     */
    public normalizeWhitespace(text: string): string {
        return text.replace(/\s+/g, " ").trim();
    }

    /**
     * **Check if a String is Blank**
     *
     * Determines whether a string is empty or contains only whitespace.
     *
     * @param text - The string to check.
     * @returns `true` if the string is empty or whitespace-only.
     *
     * @example
     * ```ts
     * str.isBlank("   "); // true
     * str.isBlank("hi");  // false
     * ```
     */
    public isBlank(text: string): boolean {
        return text.trim().length === 0;
    }

    /**
     * **Generate a UUID (v4)**
     *
     * Generates a random RFC 4122 version-4 UUID. Uses `crypto.randomUUID`
     * when available and falls back to the {@link https://github.com/nehonix/nehoid NehoId}
     * implementation otherwise (e.g. in older runtimes).
     *
     * @returns A UUID v4 string, e.g. `"3f2504e0-4f89-41d3-9a0c-0305e82c3301"`.
     *
     * @example
     * ```ts
     * str.uuid(); // "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
     * ```
     */
    public uuid(): string {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return crypto.randomUUID();
        }
        return ID.uuid();
    }
}

