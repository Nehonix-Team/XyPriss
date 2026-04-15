# Number Utilities (`num`)

The `num` module provides optimized mathematical operations and unit formatting for various numeric types.

## API Reference

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

Provides locale-aware formatting for numbers, supporting currency, percentage, and localized separators using the native `Intl` API.

### `formatBytes`

```typescript
__sys__.utils.num.formatBytes(bytes: number, decimals: number = 2): string
```

Converts a raw byte count into a human-readable format (e.g., KB, MB, GB, TB).

#### Example

```ts
__sys__.utils.num.formatBytes(1048576); // "1 MB"
```

