# XyPriss System Utilities (`__sys__.utils`)

The `utils` module provides a comprehensive suite of high-performance utility functions designed for professional application development. The module is secondary to the core system APIs and is globally accessible via `__sys__.utils`. It adopts a granular modular architecture for improved maintainability and developer ergonomics.

## Architectural Overview

The utility suite is partitioned into the following specialized categories:

- `str`: String manipulation and formatting.
- `num`: Numeric calculations and unit formatting.
- `date`: Temporal logic, arithmetic, and calendar queries.
- `obj`: Deep object operations and transformations.
- `arr`: Collection management and grouping.
- `async`: Asynchronous control flow and timing.
- `is`: Predicates and validation guards.
- `fn`: Functional programming helpers.
- `id`: Unique identity generation.

---

## String Utilities (`str`)

### `randomString`

```typescript
__sys__.utils.str.randomString(length: number = 10): string
```

Generates a random Alpha-Numeric string. This implementation is not cryptographically secure and is intended for non-sensitive use cases.

### `slugify`

```typescript
__sys__.utils.str.slugify(text: string): string
```

Transforms an arbitrary string into a URL-safe slug by normalizing case, removing non-alphanumeric characters, and collapsing whitespace into hyphens.

### `truncate`

```typescript
__sys__.utils.str.truncate(text: string, maxLength: number, suffix: string = "..."): string
```

Shortens a string to a specified maximum length. If truncated, a suffix is appended while ensuring the total length does not exceed the limit.

### `capitalize`

```typescript
__sys__.utils.str.capitalize(text: string): string
```

Converts the first character of the input string to upper case while maintaining the case of the remaining characters.

### `toCamelCase`

```typescript
__sys__.utils.str.toCamelCase(text: string): string
```

Converts hyphenated, underscored, or space-separated strings into standard camelCase notation.

### `pad`

```typescript
__sys__.utils.str.pad(text: string, length: number, char: string = " ", posit: "start" | "end" = "start"): string
```

Pads the input string to a target length using a specific character. Supports both leading and trailing padding.

### `countOccurrences`

```typescript
__sys__.utils.str.countOccurrences(text: string, word: string, caseSensitive: boolean = false): number
```

Calculates the number of times a specific substring appears within a larger text body.

### `toQueryString`

```typescript
__sys__.utils.str.toQueryString(params: Record<string, unknown>): string
```

Serializes a flat record into a URL-encoded query string format suitable for HTTP requests.

---

## Number Utilities (`num`)

### `clamp`

```typescript
__sys__.utils.num.clamp(value: number, min: number, max: number): number
```

Restricts a numeric value to a defined range. If the value exceeds the boundaries, it is set to the nearest boundary value.

### `lerp`

```typescript
__sys__.utils.num.lerp(start: number, end: number, t: number): number
```

Performs linear interpolation between two numeric values based on a factor `t` (typically between 0 and 1).

### `randomInt`

```typescript
__sys__.utils.num.randomInt(min: number, max: number): number
```

Returns a pseudo-random integer within the inclusive range specified by the lower and upper bounds.

### `formatNumber`

```typescript
__sys__.utils.num.formatNumber(value: number, locale: string = "en-US", options?: Intl.NumberFormatOptions): string
```

Provides locale-aware formatting for numbers, supporting currency, percentage, and localized separators.

### `formatBytes`

```typescript
__sys__.utils.num.formatBytes(bytes: number, decimals: number = 2): string
```

Converts a raw byte count into a human-readable format (e.g., KB, MB, GB) using a base-1024 binary prefix system.

---

## Date Utilities (`date`)

### Core & Current Time

#### `now`

```typescript
__sys__.utils.date.now(): number
```

Returns the current Unix timestamp in **seconds**.

#### `nowMs`

```typescript
__sys__.utils.date.nowMs(): number
```

Returns the current JavaScript timestamp in **milliseconds**.

#### `today`

```typescript
__sys__.utils.date.today(): Date
```

Returns a new `Date` object representing the current instant.

### Formatting

#### `format`

```typescript
__sys__.utils.date.format(date: Date | number | string, locale: string = "en-US", options?: Intl.DateTimeFormatOptions): string
```

Serializes a date into a localized string. Automatically handles Unix timestamps (seconds) and JavaScript timestamps (milliseconds) via a smart heuristic.

#### `toISO`

```typescript
__sys__.utils.date.toISO(date: Date | number | string = new Date()): string
```

Formats a date as an ISO 8601 UTC string.

#### `toDateString`

```typescript
__sys__.utils.date.toDateString(date: Date | number | string = new Date(), utc = false): string
```

Formats a date as `YYYY-MM-DD`.

#### `toTimeString`

```typescript
__sys__.utils.date.toTimeString(date: Date | number | string = new Date(), utc = false): string
```

Formats a date as `HH:mm:ss`.

#### `formatDuration`

```typescript
__sys__.utils.date.formatDuration(value: number, unit: "ms" | "s" = "ms"): string
```

Converts a duration into a human-readable string (e.g., "1d 2h 30m"). Components are omitted if zero.

#### `timeAgo`

```typescript
__sys__.utils.date.timeAgo(date: Date | number | string, locale: string = "en-US"): string
```

Generates a localized relative time string (e.g., "5 minutes ago").

### Arithmetic & Comparison

#### `add` / `subtract`

```typescript
__sys__.utils.date.add(date: Date | number | string, value: number, unit: "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y"): Date
```

Performs calendar-aware arithmetic. Month and year additions correctly handle overflow (e.g., Jan 31 + 1 month = Feb 28).

#### `diff`

```typescript
__sys__.utils.date.diff(dateA: Date | number | string, dateB: Date | number | string, unit: "ms" | "s" | "m" | "h" | "d" | "w" = "ms"): number
```

Calculates the signed difference between two dates.

#### `isBefore` / `isAfter` / `isSame`

```typescript
__sys__.utils.date.isBefore(dateA: Date | number | string, dateB: Date | number | string): boolean
```

Standard temporal comparison operators.

#### `isBetween`

```typescript
__sys__.utils.date.isBetween(date: Date | number | string, start: Date | number | string, end: Date | number | string): boolean
```

Determines if a date falls within a specific inclusive range.

### Boundaries & Calendar

#### `startOf` / `endOf`

```typescript
__sys__.utils.date.startOf(unit: "day" | "week" | "month" | "year", date: Date | number | string = new Date()): Date
```

Resets temporal components to the boundary of the specified unit.

#### `isLeapYear`

```typescript
__sys__.utils.date.isLeapYear(year: number = new Date().getFullYear()): boolean
```

Determines if a given year is a leap year.

#### `daysInMonth`

```typescript
__sys__.utils.date.daysInMonth(month: number, year: number = new Date().getFullYear()): number
```

Returns the number of days in a month (1-12).

#### `weekNumber`

```typescript
__sys__.utils.date.weekNumber(date: Date | number | string = new Date()): number
```

Returns the ISO 8601 week number (1-53).

#### `dayOfYear`

```typescript
__sys__.utils.date.dayOfYear(date: Date | number | string = new Date()): number
```

Returns the day index within the year (1-366).

#### `quarter`

```typescript
__sys__.utils.date.quarter(date: Date | number | string = new Date()): 1 | 2 | 3 | 4
```

Returns the calendar quarter.

#### `isWeekend` / `isWeekday`

```typescript
__sys__.utils.date.isWeekend(date: Date | number | string = new Date()): boolean
```

Predicates for day-of-week classification.

### Range & Validation

#### `dateRange`

```typescript
__sys__.utils.date.dateRange(start: Date | number | string, end: Date | number | string): Date[]
```

Generates an array of dates between two bounds (inclusive). Capped at 3,650 days.

#### `isValid`

```typescript
__sys__.utils.date.isValid(value: unknown): boolean
```

Validates if a value can be interpreted as a finite date.

#### `parse`

```typescript
__sys__.utils.date.parse(value: string, formats: string[]): Date | null
```

Attempts to parse a string using a list of specified format patterns.

---

## Object Utilities (`obj`)

### `deepClone`

```typescript
__sys__.utils.obj.deepClone<T>(obj: T): T
```

Performs a high-performance deep copy of an object. This implementation handles cyclic references and complex data structures.

### `parse`

```typescript
__sys__.utils.obj.parse<T>(json: string, fallback: T | null = null): T | null
```

Safely parses a JSON string. If parsing fails, the provided fallback value is returned instead of throwing an exception.

### `pick`

```typescript
__sys__.utils.obj.pick<T, K>(obj: T, keys: K[]): Pick<T, K>
```

Creates a new object containing only the property-value pairs associated with the specified keys.

### `omit`

```typescript
__sys__.utils.obj.omit<T, K>(obj: T, keys: K[]): Omit<T, K>
```

Creates a new object by excluding the specified keys from the source object.

### `isEmpty`

```typescript
__sys__.utils.obj.isEmpty(obj: object): boolean
```

Determines if an object contains any own enumerable properties.

### `flattenObject`

```typescript
__sys__.utils.obj.flattenObject(obj: Record<string, unknown>, separator: string = "."): Record<string, unknown>
```

Recursively flattens a nested object into a single-level object with path-based keys (e.g., "a.b.c").

---

## Array Utilities (`arr`)

### `chunk`

```typescript
__sys__.utils.arr.chunk<T>(arr: T[], size: number): T[][]
```

Partitions an array into multiple sub-arrays of a fixed maximum size.

### `unique`

```typescript
__sys__.utils.arr.unique<T>(arr: T[]): T[]
```

Returns a new array containing unique elements from the source, preserving their original order.

### `shuffle`

```typescript
__sys__.utils.arr.shuffle<T>(arr: T[]): T[]
```

Randomly reorders the elements of an array using the Fisher-Yates algorithm. Non-mutating operation.

### `groupBy`

```typescript
__sys__.utils.arr.groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]>
```

Groups elements of an array into an object based on the output of a provided key-mapping function.

### `sample`

```typescript
__sys__.utils.arr.sample<T>(arr: T[]): T | undefined
```

Selects a single element from the array at random. Returns `undefined` if the array is empty.

### `flatten`

```typescript
__sys__.utils.arr.flatten<T>(arr: T[][]): T[]
```

Reduces the nesting level of an array by one level of depth.

---

## Async Utilities (`async`)

### `sleep`

```typescript
__sys__.utils.async.sleep(ms: number): Promise<void>
```

Introduces an asynchronous delay in execution for a specified duration.

### `retry`

```typescript
__sys__.utils.async.retry<T>(fn: () => Promise<T>, maxAtt: number = 3, dly: number = 500): Promise<T>
```

Executes an asynchronous function with automatic retry logic upon failure, using a configurable delay.

### `debounce`

```typescript
__sys__.utils.async.debounce<T>(fn: T, wait: number = 300): T
```

Wraps a function to delay its execution until after a specified period of inactivity.

### `throttle`

```typescript
__sys__.utils.async.throttle<T>(fn: T, limit: number = 300): T
```

Wraps a function to ensure it is called at most once within a specified time interval.

### `measure`

```typescript
__sys__.utils.async.measure<T>(fn: () => T | Promise<T>): Promise<{ result: T, durationMs: number }>
```

Executes a function and returns its result alongside high-precision execution timing data in milliseconds.

---

## Validation Utilities (`is`)

### `email`

```typescript
__sys__.utils.is.email(email: string): boolean
```

Performs semantic validation on an email address string.

### `url`

```typescript
__sys__.utils.is.url(url: string): boolean
```

Validates a URL string using an RFC-compliant URI parser.

### `nullish`

```typescript
__sys__.utils.is.nullish(value: unknown): value is null | undefined
```

A type guard that determines if a value is either `null` or `undefined`.

---

## Functional Utilities (`fn`)

### `memo`

```typescript
__sys__.utils.fn.memo<T>(fn: T): T
```

Returns a memoized version of a function that caches its results based on input parameters for improved performance.

---

## Identity Utilities (`id`)

### `uuid`

```typescript
__sys__.utils.id.uuid(): string
```

Generates a RFC-compliant UUID v4 using the high-performance identity engine.

