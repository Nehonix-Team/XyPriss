# String Utilities (`str`)

The `str` module provides a high-performance suite for string manipulation, normalization, and generation.

## API Reference

### `randomString`

```typescript
__sys__.utils.str.randomString(length: number = 10): string
```

Generates a random Alpha-Numeric string. This implementation is not cryptographically secure and is intended for non-sensitive use cases like temporary IDs or nonces.

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

