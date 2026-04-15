# String Utilities (`str`)

The `str` module provides a suite of optimized functions for string manipulation, generation, and formatting within the XyPriss ecosystem.

---

## API Reference

### `randomString`

```typescript
__sys__.utils.str.randomString(length: number = 10): string
```

Generates a random Alpha-Numeric string.

> [!CAUTION]
> This implementation is not cryptographically secure. Use it for temporary identifiers, nonces, or non-sensitive data. For security-critical tokens, use the `crypto` module.

#### Example: Generating a unique temporary name

```ts
const tempId = `tmp-${__sys__.utils.str.randomString(6)}`;
// → "tmp-aB7x9z"
```

---

### `slugify`

```typescript
__sys__.utils.str.slugify(text: string): string
```

Transforms an arbitrary string into a URL-safe slug. It normalizes the case to lowercase, removes non-alphanumeric characters (except hyphens), and collapses whitespace/underscores into single hyphens.

#### Example: Routing and URL Generation

```ts
const postTitle = "Implementing XyPriss Utilities: A Deep Dive!";
const slug = __sys__.utils.str.slugify(postTitle);
// → "implementing-xypriss-utilities-a-deep-dive"
```

---

### `truncate`

```typescript
__sys__.utils.str.truncate(text: string, maxLength: number, suffix: string = "..."): string
```

Shortens a string to a specified maximum length. If the string is longer than `maxLength`, it is cut and the `suffix` is appended. The resulting string's total length will exactly equal `maxLength`.

#### Example: UI Descriptions

```ts
const desc =
    "This is a very long description that might overflow the card container in the dashboard.";
const shortDesc = __sys__.utils.str.truncate(desc, 30);
// → "This is a very long descri..."
```

---

### `capitalize`

```typescript
__sys__.utils.str.capitalize(text: string): string
```

Ensures the first character of the input string is uppercase. All other characters maintain their existing casing.

#### Example: User Profile Display

```ts
const username = "john_doe";
const label = __sys__.utils.str.capitalize(username);
// → "John_doe"
```

---

### `toCamelCase`

```typescript
__sys__.utils.str.toCamelCase(text: string): string
```

Converts hyphenated (`kebab-case`), underscored (`snake_case`), or space-separated strings into standard `camelCase` notation. Useful for normalizing property keys from external data sources.

#### Example: API Data Normalization

```ts
const keys = ["first_name", "last-name", "User Role"];
const camelKeys = keys.map((k) => __sys__.utils.str.toCamelCase(k));
// → ["firstName", "lastName", "userRole"]
```

---

### `pad`

```typescript
__sys__.utils.str.pad(text: string, length: number, char: string = " ", posit: "start" | "end" = "start"): string
```

Pads the input string to a target length using a specific character.

#### Example: Formatting Numbers with Leading Zeros

```ts
const count = "42";
const padded = __sys__.utils.str.pad(count, 5, "0");
// → "00042"
```

---

### `countOccurrences`

```typescript
__sys__.utils.str.countOccurrences(text: string, word: string, caseSensitive: boolean = false): number
```

Analyzes a text body to count how many times a specific substring appeared.

#### Example: Basic Keyword Analysis

```ts
const log = "ERROR: Failed to connect. ERROR: Timeout. SUCCESS.";
const errorCount = __sys__.utils.str.countOccurrences(log, "error");
// → 2 (case-insensitive by default)
```

---

### `toQueryString`

```typescript
__sys__.utils.str.toQueryString(params: Record<string, unknown>): string
```

Serializes a flat record into a URL-encoded query string format. It handles URI encoding for both keys and values.

#### Example: Constructing Fetch Parameters

```ts
const filters = { search: "query string", page: 1, active: true };
const qs = __sys__.utils.str.toQueryString(filters);
// → "search=query%20string&page=1&active=true"
```

