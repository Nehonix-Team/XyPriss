# Date Utilities (`date`)

The `date` module is a comprehensive temporal library built for the XyPriss system. It supports calendar arithmetic, localized formatting, and smart timestamp detection.

## Heuristics & Units

XyPriss `DateUtils` automatically detects the unit of numeric timestamps:

- **Unix Seconds**: Values below `1e11` are treated as seconds (common in XHSC).
- **JS Milliseconds**: Values at or above `1e11` are treated as milliseconds.

## API Reference

### Core & Current Time

### `now`

```typescript
__sys__.utils.date.now(): number
```

Returns the current Unix timestamp in **seconds**.

### `nowMs`

```typescript
__sys__.utils.date.nowMs(): number
```

Returns the current JavaScript timestamp in **milliseconds**.

### `today`

```typescript
__sys__.utils.date.today(): Date
```

Returns a new `Date` object representing the current instant.

---

### Formatting

### `format`

```typescript
__sys__.utils.date.format(date: Date | number | string, locale: string = "en-US", options?: Intl.DateTimeFormatOptions): string
```

Serializes a date into a localized string.

### `toISO`

```typescript
__sys__.utils.date.toISO(date: Date | number | string = new Date()): string
```

Formats a date as an ISO 8601 UTC string.

### `toDateString`

```typescript
__sys__.utils.date.toDateString(date: Date | number | string = new Date(), utc = false): string
```

Formats a date as `YYYY-MM-DD`.

### `toTimeString`

```typescript
__sys__.utils.date.toTimeString(date: Date | number | string = new Date(), utc = false): string
```

Formats a date as `HH:mm:ss`.

### `formatDuration`

```typescript
__sys__.utils.date.formatDuration(value: number, unit: "ms" | "s" = "ms"): string
```

Converts a duration into a concise, component-based string representation.

- Example: `1d 2h 30m`

### `timeAgo`

```typescript
__sys__.utils.date.timeAgo(date: Date | number | string, locale: string = "en-US"): string
```

Generates a localized relative time string.

- Example: `5 minutes ago`

---

### Arithmetic & Comparison

### `add` / `subtract`

```typescript
__sys__.utils.date.add(date: Date | number | string, value: number, unit: "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y"): Date
```

Performs calendar-aware arithmetic.

> [!NOTE]
> Month and year additions correctly handle overflow. Adding 1 month to January 31 results in February 28/29.

### `diff`

```typescript
__sys__.utils.date.diff(dateA: Date | number | string, dateB: Date | number | string, unit: "ms" | "s" | "m" | "h" | "d" | "w" = "ms"): number
```

Calculates the signed difference between two dates.

---

### Calendar Queries

### `isLeapYear`

```typescript
__sys__.utils.date.isLeapYear(year: number = new Date().getFullYear()): boolean
```

### `daysInMonth`

```typescript
__sys__.utils.date.daysInMonth(month: number, year: number = new Date().getFullYear()): number
```

### `weekNumber`

```typescript
__sys__.utils.date.weekNumber(date: Date | number | string = new Date()): number
```

Returns ISO 8601 week number (1-53).

### `dayOfYear`

```typescript
__sys__.utils.date.dayOfYear(date: Date | number | string = new Date()): number
```

### `isWeekend` / `isWeekday`

```typescript
__sys__.utils.date.isWeekend(date: Date | number | string = new Date()): boolean
```

Check if a date falls on a weekend or weekday.

