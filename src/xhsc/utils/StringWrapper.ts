export class StringWrapper {
    private current: string;

    constructor(str: string | number) {
        this.current = String(str);
    }

    /**
     * **value**
     *
     * Unwraps and returns the underlying string value held by this wrapper.
     * Call this at the end of a chain to get back the final string.
     *
     * @returns The wrapped string.
     *
     * @example
     * ```ts
     * __sys__.utils.str.of("hello world").toTitleCase().value(); // "Hello World"
     * ```
     */
    public value(): string {
        return this.current;
    }

    /**
     * **raw**
     *
     * Alias for {@link value}.
     *
     * @returns The wrapped string.
     */
    public raw(): string {
        return this.current;
    }

    /**
     * **toString**
     *
     * Returns the string representation of the wrapped value.
     */
    public toString(): string {
        return this.current;
    }

    /**
     * **slugify**
     *
     * Converts the wrapped string into a URL-friendly slug.
     */
    public slugify(): StringWrapper {
        this.current = __sys__.utils.str.slugify(this.current);
        return this;
    }

    /**
     * **truncate**
     *
     * Shortens the wrapped string to a specified length and appends a suffix.
     */
    public truncate(maxLength: number, suffix: string = "..."): StringWrapper {
        this.current = __sys__.utils.str.truncate(
            this.current,
            maxLength,
            suffix,
        );
        return this;
    }

    /**
     * **capitalize**
     *
     * Uppercases the first character of the wrapped string.
     */
    public capitalize(): StringWrapper {
        this.current = __sys__.utils.str.capitalize(this.current);
        return this;
    }

    /**
     * **toCamelCase**
     *
     * Converts the wrapped string to camelCase.
     */
    public toCamelCase(): StringWrapper {
        this.current = __sys__.utils.str.toCamelCase(this.current);
        return this;
    }

    /**
     * **toKebabCase**
     *
     * Converts the wrapped string to kebab-case.
     */
    public toKebabCase(): StringWrapper {
        this.current = __sys__.utils.str.toKebabCase(this.current);
        return this;
    }

    /**
     * **toSnakeCase**
     *
     * Converts the wrapped string to snake_case.
     */
    public toSnakeCase(): StringWrapper {
        this.current = __sys__.utils.str.toSnakeCase(this.current);
        return this;
    }

    /**
     * **toPascalCase**
     *
     * Converts the wrapped string to PascalCase.
     */
    public toPascalCase(): StringWrapper {
        this.current = __sys__.utils.str.toPascalCase(this.current);
        return this;
    }

    /**
     * **toTitleCase**
     *
     * Converts the wrapped string to Title Case.
     */
    public toTitleCase(): StringWrapper {
        this.current = __sys__.utils.str.toTitleCase(this.current);
        return this;
    }

    /**
     * **pad**
     *
     * Pads the wrapped string to the specified length.
     */
    public pad(
        length: number,
        char: string = " ",
        position: "start" | "end" = "start",
    ): StringWrapper {
        this.current = __sys__.utils.str.pad(
            this.current,
            length,
            char,
            position,
        );
        return this;
    }

    /**
     * **reverse**
     *
     * Reverses the characters in the wrapped string.
     */
    public reverse(): StringWrapper {
        this.current = __sys__.utils.str.reverse(this.current);
        return this;
    }

    /**
     * **stripHtml**
     *
     * Strips HTML tags from the wrapped string.
     */
    public stripHtml(): StringWrapper {
        this.current = __sys__.utils.str.stripHtml(this.current);
        return this;
    }

    /**
     * **escapeHtml**
     *
     * Escapes HTML entities in the wrapped string.
     */
    public escapeHtml(): StringWrapper {
        this.current = __sys__.utils.str.escapeHtml(this.current);
        return this;
    }

    /**
     * **unescapeHtml**
     *
     * Unescapes HTML entities in the wrapped string.
     */
    public unescapeHtml(): StringWrapper {
        this.current = __sys__.utils.str.unescapeHtml(this.current);
        return this;
    }

    /**
     * **mask**
     *
     * Masks the wrapped string.
     */
    public mask(
        options: {
            visibleStart?: number;
            visibleEnd?: number;
            maskChar?: string;
        } = {},
    ): StringWrapper {
        this.current = __sys__.utils.str.mask(this.current, options);
        return this;
    }

    /**
     * **wordWrap**
     *
     * Wraps the wrapped text at the given width.
     */
    public wordWrap(width: number, lineBreak: string = "\n"): StringWrapper {
        this.current = __sys__.utils.str.wordWrap(
            this.current,
            width,
            lineBreak,
        );
        return this;
    }

    /**
     * **stripAccents**
     *
     * Removes accents/diacritics from the wrapped string.
     */
    public stripAccents(): StringWrapper {
        this.current = __sys__.utils.str.stripAccents(this.current);
        return this;
    }

    /**
     * **normalizeWhitespace**
     *
     * Normalizes whitespace runs in the wrapped string.
     */
    public normalizeWhitespace(): StringWrapper {
        this.current = __sys__.utils.str.normalizeWhitespace(this.current);
        return this;
    }

    /**
     * **escapeRegExp**
     *
     * Escapes special regex characters in the wrapped string.
     */
    public escapeRegExp(): StringWrapper {
        this.current = __sys__.utils.str.escapeRegExp(this.current);
        return this;
    }

    /**
     * **countOccurrences**
     *
     * Counts occurrences of `word` in the wrapped string.
     */
    public countOccurrences(
        word: string,
        caseSensitive: boolean = false,
    ): number {
        return __sys__.utils.str.countOccurrences(
            this.current,
            word,
            caseSensitive,
        );
    }

    /**
     * **isPalindrome**
     *
     * Checks if the wrapped string is a palindrome.
     */
    public isPalindrome(
        options: {
            caseSensitive?: boolean;
            ignoreSpaces?: boolean;
        } = {},
    ): boolean {
        return __sys__.utils.str.isPalindrome(this.current, options);
    }

    /**
     * **wordCount**
     *
     * Counts words in the wrapped string.
     */
    public wordCount(): number {
        return __sys__.utils.str.wordCount(this.current);
    }

    /**
     * **chunk**
     *
     * Splits the wrapped string into chunks of `size`.
     */
    public chunk(size: number): string[] {
        return __sys__.utils.str.chunk(this.current, size);
    }

    /**
     * **extractEmails**
     *
     * Extracts email addresses found in the wrapped string.
     */
    public extractEmails(): string[] {
        return __sys__.utils.str.extractEmails(this.current);
    }

    /**
     * **extractUrls**
     *
     * Extracts URLs found in the wrapped string.
     */
    public extractUrls(): string[] {
        return __sys__.utils.str.extractUrls(this.current);
    }

    /**
     * **isEmail**
     *
     * Validates whether the wrapped string is an email address.
     */
    public isEmail(): boolean {
        return __sys__.utils.str.isEmail(this.current);
    }

    /**
     * **isUrl**
     *
     * Validates whether the wrapped string is a URL.
     */
    public isUrl(): boolean {
        return __sys__.utils.str.isUrl(this.current);
    }

    /**
     * **between**
     *
     * Returns the substring between markers.
     */
    public between(start: string, end?: string): string | null {
        return __sys__.utils.str.between(this.current, start, end);
    }

    /**
     * **isBlank**
     *
     * Checks if the wrapped string is blank.
     */
    public isBlank(): boolean {
        return __sys__.utils.str.isBlank(this.current);
    }

    /**
     * **levenshteinDistance**
     *
     * Computes Levenshtein distance between wrapped string and `other`.
     */
    public levenshteinDistance(other: string): number {
        return __sys__.utils.str.levenshteinDistance(this.current, other);
    }

    /**
     * **similarity**
     *
     * Computes similarity score between wrapped string and `other`.
     */
    public similarity(other: string): number {
        return __sys__.utils.str.similarity(this.current, other);
    }
}

