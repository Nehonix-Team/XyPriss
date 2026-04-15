# XyPriss System Utilities (`__sys__.utils`)

The `utils` module provides a comprehensive suite of high-performance utility functions designed for professional application development. The module is secondary to the core system APIs and is globally accessible via `__sys__.utils`. It adopts a granular modular architecture for improved maintainability and developer ergonomics.

## Architectural Overview

The utility suite is partitioned into the following specialized categories:

- `str`: String manipulation and formatting.
- `num`: Numeric calculations and unit formatting.
- `date`: Temporal logic and localization.
- `obj`: Deep object operations and transformations.
- `arr`: Collection management and grouping.
- `async`: Asynchronous control flow and timing.
- `is`: Predicates and validation guards.
- `fn`: Functional programming helpers.
- `id`: Unique identity generation.

---

## String Utilities (`str`)

### `randomString(length: number = 10): string`

Generates a random Alpha-Numeric string. Not cryptographically secure.

### `slugify(text: string): string`

Transforms an arbitrary string into a URL-safe slug.

### `truncate(text: string, maxLength: number, suffix: string = "..."): string`

Shortens a string to a specified maximum length with a suffix.

### `capitalize(text: string): string`

Converts the first character of the input string to upper case.

### `toCamelCase(text: string): string`

Converts strings into standard camelCase notation.

### `pad(text: string, length: number, char: string = " ", position: "start" | "end" = "start"): string`

Pads the input string to a target length.

### `countOccurrences(text: string, word: string, caseSensitive: boolean = false): number`

Calculates the number of times a substring appears within a text.

### `toQueryString(params: Record<string, unknown>): string`

Serializes a record into a URL-encoded query string format.

---

## Number Utilities (`num`)

### `clamp(value: number, min: number, max: number): number`

Restricts a numeric value to a defined range.

### `lerp(start: number, end: number, t: number): number`

Performs linear interpolation between two values.

### `randomInt(min: number, max: number): number`

Returns a pseudo-random integer within an inclusive range.

### `formatNumber(value: number, locale: string = "en-US", options?: Intl.NumberFormatOptions): string`

Provides locale-aware formatting for numbers.

### `formatBytes(bytes: number, decimals: number = 2): string`

Converts a raw byte count into a human-readable format (KB, MB, GB).

---

## Date Utilities (`date`)

### `formatDuration(ms: number): string`

Converts milliseconds into a concise string (e.g., "1d 2h").

### `formatDate(date: Date, locale: string = "en-US", options?: Intl.DateTimeFormatOptions): string`

Serializes a `Date` object into a localized string.

### `timeAgo(date: Date, locale: string = "en-US"): string`

Generates a relative time string (e.g., "3 hours ago").

---

## Object Utilities (`obj`)

### `deepClone<T>(obj: T): T`

Performs a high-performance deep copy of an object.

### `parse<T>(json: string, fallback: T | null = null): T | null`

Safely parses a JSON string, returning a fallback value on failure.

### `pick<T, K>(obj: T, keys: K[]): Pick<T, K>`

Creates a new object containing only the specified keys.

### `omit<T, K>(obj: T, keys: K[]): Omit<T, K>`

Creates a new object by excluding the specified keys.

### `isEmpty(obj: object): boolean`

Determines if an object contains any own enumerable properties.

### `flattenObject(obj: Record<string, unknown>, separator: string = "."): Record<string, unknown>`

Recursively flattens an object into path-based keys.

---

## Array Utilities (`arr`)

### `chunk<T>(arr: T[], size: number): T[][]`

Partitions an array into sub-arrays of a fixed maximum size.

### `unique<T>(arr: T[]): T[]`

Returns a new array containing unique elements.

### `shuffle<T>(arr: T[]): T[]`

Randomly reorders the elements of an array.

### `groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]>`

Groups elements based on a key-mapping function.

### `sample<T>(arr: T[]): T | undefined`

Selects a single element from the array at random.

### `flatten<T>(arr: T[][]): T[]`

Reduces the nesting level of an array.

---

## Async Utilities (`async`)

### `sleep(ms: number): Promise<void>`

Introduces an asynchronous delay.

### `retry<T>(fn: () => Promise<T>, maxAtt: number = 3, dly: number = 500): Promise<T>`

Executes an async function with automatic retry logic.

### `debounce<T>(fn: T, wait: number = 300): T`

Delays execution until after a period of inactivity.

### `throttle<T>(fn: T, limit: number = 300): T`

Ensures a function is called at most once within a specific interval.

### `measure<T>(fn: () => T | Promise<T>): Promise<{ result: T, durationMs: number }>`

Executes a function and returns timing data.

---

## Validation Utilities (`is`)

### `email(email: string): boolean`

Performs semantic validation on an email address string.

### `url(url: string): boolean`

Validates a URL string using an RFC-compliant parser.

### `nullish(value: unknown): boolean`

A type guard that determines if a value is `null` or `undefined`.

---

## Functional Utilities (`fn`)

### `memo<T>(fn: T): T`

Returns a memoized version of a function that caches its results.

---

## Identity Utilities (`id`)

### `uuid(): string`

Generates a RFC-compliant UUID v4.

