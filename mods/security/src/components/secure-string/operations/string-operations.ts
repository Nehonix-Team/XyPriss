/**
 * String Operations Module
 * Handles string manipulation operations for SecureString
 */
 
import {
    SplitOptions,
    SearchOptions,
    DEFAULT_SPLIT_OPTIONS,
    DEFAULT_SEARCH_OPTIONS,
} from "../types";

/**
 * Handles string manipulation operations
 */
export class StringOperations {
    /**
     * Appends a value to a string
     */
    static append(current: string, value: string): string {
        return current + value;
    }

    /**
     * Prepends a value to a string
     */
    static prepend(current: string, value: string): string {
        return value + current;
    }

    /**
     * Replaces the entire string with a new value
     */
    static replace(_current: string, newValue: string): string {
        return newValue;
    }

    /**
     * Extracts a substring
     */
    static substring(current: string, start: number, end?: number): string {
        return current.substring(start, end);
    }

    /**
     * Splits a string into parts
     */
    static split(
        current: string,
        separator: string | RegExp,
        options: SplitOptions = {}
    ): string[] {
        const opts = { ...DEFAULT_SPLIT_OPTIONS, ...options };

        let parts = current.split(
            separator,
            opts.limit > 0 ? opts.limit : undefined
        );

        if (opts.removeEmpty) {
            parts = parts.filter((part) => part.length > 0);
        }

        if (opts.trim) {
            parts = parts.map((part) => part.trim());
        }

        return parts;
    }

    /**
     * Trims whitespace from both ends
     */
    static trim(current: string): string {
        return current.trim();
    }

    /**
     * Trims whitespace from the start
     */
    static trimStart(current: string): string {
        return current.trimStart();
    }

    /**
     * Trims whitespace from the end
     */
    static trimEnd(current: string): string {
        return current.trimEnd();
    }

    /**
     * Converts to uppercase
     */
    static toUpperCase(current: string): string {
        return current.toUpperCase();
    }

    /**
     * Converts to lowercase
     */
    static toLowerCase(current: string): string {
        return current.toLowerCase();
    }

    /**
     * Converts to title case
     */
    static toTitleCase(current: string): string {
        return current.replace(
            /\w\S*/g,
            (txt) =>
                txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
        );
    }

    /**
     * Reverses the string
     */
    static reverse(current: string): string {
        return current.split("").reverse().join("");
    }

    /**
     * Repeats the string n times
     */
    static repeat(current: string, count: number): string {
        if (count < 0) {
            throw new Error("Repeat count must be non-negative");
        }
        return current.repeat(count);
    }

    /**
     * Pads the string to a target length
     */
    static padStart(
        current: string,
        targetLength: number,
        padString: string = " "
    ): string {
        return current.padStart(targetLength, padString);
    }

    /**
     * Pads the string to a target length at the end
     */
    static padEnd(
        current: string,
        targetLength: number,
        padString: string = " "
    ): string {
        return current.padEnd(targetLength, padString);
    }

    /**
     * Checks if string contains a substring
     */
    static includes(
        current: string,
        searchString: string,
        options: SearchOptions = {}
    ): boolean {
        const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

        let haystack = current;
        let needle = searchString;

        if (!opts.caseSensitive) {
            haystack = haystack.toLowerCase();
            needle = needle.toLowerCase();
        }

        const startPos = Math.max(0, opts.startPosition);
        const endPos =
            opts.endPosition > 0 ? opts.endPosition : haystack.length;

        const searchArea = haystack.substring(startPos, endPos);

        if (opts.wholeWord) {
            const wordRegex = new RegExp(
                `\\b${this.escapeRegExp(needle)}\\b`,
                opts.caseSensitive ? "g" : "gi"
            );
            return wordRegex.test(searchArea);
        }

        return searchArea.includes(needle);
    }

    /**
     * Checks if string starts with a prefix
     */
    static startsWith(
        current: string,
        searchString: string,
        options: SearchOptions = {}
    ): boolean {
        const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

        let haystack = current;
        let needle = searchString;

        if (!opts.caseSensitive) {
            haystack = haystack.toLowerCase();
            needle = needle.toLowerCase();
        }

        const startPos = Math.max(0, opts.startPosition);
        return haystack.startsWith(needle, startPos);
    }

    /**
     * Checks if string ends with a suffix
     */
    static endsWith(
        current: string,
        searchString: string,
        options: SearchOptions = {}
    ): boolean {
        const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

        let haystack = current;
        let needle = searchString;

        if (!opts.caseSensitive) {
            haystack = haystack.toLowerCase();
            needle = needle.toLowerCase();
        }

        const length = opts.endPosition > 0 ? opts.endPosition : undefined;
        return haystack.endsWith(needle, length);
    }

    /**
     * Finds the index of a substring
     */
    static indexOf(
        current: string,
        searchString: string,
        options: SearchOptions = {}
    ): number {
        const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

        let haystack = current;
        let needle = searchString;

        if (!opts.caseSensitive) {
            haystack = haystack.toLowerCase();
            needle = needle.toLowerCase();
        }

        const startPos = Math.max(0, opts.startPosition);
        return haystack.indexOf(needle, startPos);
    }

    /**
     * Finds the last index of a substring
     */
    static lastIndexOf(
        current: string,
        searchString: string,
        options: SearchOptions = {}
    ): number {
        const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

        let haystack = current;
        let needle = searchString;

        if (!opts.caseSensitive) {
            haystack = haystack.toLowerCase();
            needle = needle.toLowerCase();
        }

        const startPos =
            opts.startPosition > 0 ? opts.startPosition : undefined;
        return haystack.lastIndexOf(needle, startPos);
    }

    /**
     * Replaces occurrences of a substring
     */
    static replaceAll(
        current: string,
        searchValue: string | RegExp,
        replaceValue: string
    ): string {
        if (typeof searchValue === "string") {
            return current.split(searchValue).join(replaceValue);
        } else {
            return current.replace(searchValue, replaceValue);
        }
    }

    /**
     * Normalizes the string
     */
    static normalize(
        current: string,
        form: "NFC" | "NFD" | "NFKC" | "NFKD" = "NFC"
    ): string {
        return current.normalize(form);
    }

    /**
     * Escapes special regex characters
     */
    private static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Gets character at specific index
     */
    static charAt(current: string, index: number): string {
        return current.charAt(index);
    }

    /**
     * Gets character code at specific index
     */
    static charCodeAt(current: string, index: number): number {
        return current.charCodeAt(index);
    }

    /**
     * Slices the string
     */
    static slice(current: string, start: number, end?: number): string {
        return current.slice(start, end);
    }
}

