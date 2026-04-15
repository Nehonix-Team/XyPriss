# Date Utilities (`date`)

The `date` module is a comprehensive temporal library designed to handle Unix timestamps, JavaScript dates, and complex calendar arithmetic with millisecond precision.

---

## Technical Heuristics: Seconds vs. Milliseconds

XyPriss `DateUtils` automatically detects the unit of numeric timestamps to bridge the gap between XHSC (which typically uses Unix seconds) and JavaScript (which uses milliseconds).

> [!IMPORTANT]
> **Autodetection Rule**: If a number is less than `100,000,000,000` (1e11), it is treated as **seconds** and internally converted to milliseconds. This heuristic remains valid until the year 2286.

---

## API Reference

### Core & Current Time

### `now` / `nowMs`

```typescript
__sys__.utils.date.now(): number    // Returns seconds
__sys__.utils.date.nowMs(): number  // Returns milliseconds
```

Helpers to get the current system time in the preferred unit.

### `today`

```typescript
__sys__.utils.date.today(): Date
```

Returns a new `Date` instance of the current system time.

---

### Formatting

### `format`

```typescript
__sys__.utils.date.format(date: Date | number | string, locale: string = "en-US", options?: Intl.DateTimeFormatOptions): string
```

The primary method for localized date serialization.

- **Auto-detection**: Handles ISO strings, Date objects, and numeric timestamps (seconds/ms).

#### Example: Localized Display

```ts
// From a XHSC timestamp (seconds)
__sys__.utils.date.format(1776287197, "fr-FR", { dateStyle: "long" });
// → "15 avril 2026"
```

### `formatDuration`

```typescript
__sys__.utils.date.formatDuration(value: number, unit: "ms" | "s" = "ms"): string
```

Converts a raw duration into a component-based string (e.g., `1d 2h`). Components with a value of zero are omitted.

#### Example: Uptime display

```ts
const uptimeSec = 93661;
__sys__.utils.date.formatDuration(uptimeSec, "s");
// → "1d 2h 1m 1s"
```

### `timeAgo`

```typescript
__sys__.utils.date.timeAgo(date: Date | number | string, locale: string = "en-US"): string
```

Returns a localized relative time string relative to the current instant.

#### Example: Feed Activity

```ts
const lastPost = Date.now() - 1000 * 60 * 15;
__sys__.utils.date.timeAgo(lastPost);
// → "15 minutes ago"
```

---

### Arithmetic & Comparison

### `add` / `subtract`

```typescript
__sys__.utils.date.add(date: Date | number | string, value: number, unit: "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y"): Date
```

Performs calendar-aware arithmetic. It correctly handles month-length variations and leap years.

#### Example: Expiry Logic

```ts
const subDate = new Date("2026-01-31");
const nextBilling = __sys__.utils.date.add(subDate, 1, "mo");
// → "2026-02-28" (Automatically clamped to end of Feb)
```

### `diff`

```typescript
__sys__.utils.date.diff(dateA: Date | number | string, dateB: Date | number | string, unit: "ms" | "s" | "m" | "h" | "d" | "w" = "ms"): number
```

Returns the signed integer difference between two dates in the requested unit.

#### Example: Days between events

```ts
const days = __sys__.utils.date.diff("2026-12-25", "2026-12-20", "d");
// → 5
```

---

### Calendar Queries

### `weekNumber`

```typescript
__sys__.utils.date.weekNumber(date: Date | number | string = new Date()): number
```

Returns the ISO 8601 week number (1–53).

### `isLeapYear`

```typescript
__sys__.utils.date.isLeapYear(year?: number): boolean
```

Determines if the given or current year has 366 days.

### `isWeekend` / `isWeekday`

```typescript
__sys__.utils.date.isWeekend(date?: Date | number | string): boolean
```

Day-of-week classification based on local time.

---

### Ranges & Validation

### `dateRange`

```typescript
__sys__.utils.date.dateRange(start: Date | number | string, end: Date | number | string): Date[]
```

Generates an array of `Date` objects for every calendar day between `start` and `end`.

- **Constraint**: The range is capped at 3,650 days (approx. 10 years) to prevent memory allocation overloads.

### `isValid`

```typescript
__sys__.utils.date.isValid(value: unknown): boolean
```

Checks if an input can be parsed into a finite, non-NaN date.

