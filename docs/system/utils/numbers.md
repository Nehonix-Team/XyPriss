# Number Utilities (`num`)

The `num` module provides optimized mathematical operations and locale-aware unit formatting.

---

## API Reference

### `clamp`

```typescript
__sys__.utils.num.clamp(value: number, min: number, max: number): number
```

Ensures a number stays within the specified `[min, max]` range. Useful for validating sensory inputs or bounding UI elements.

#### Example: Character Health Bounding

```ts
let health = 150;
health = __sys__.utils.num.clamp(health, 0, 100);
// → 100
```

---

### `lerp`

```typescript
__sys__.utils.num.lerp(start: number, end: number, t: number): number
```

Performs linear interpolation between `start` and `end`. The value `t` (normalized between 0 and 1) determines the position along the line.

#### Example: Smooth UI Animations

```ts
// Calculate the current opacity based on animation progress (0.0 to 1.0)
const opacity = __sys__.utils.num.lerp(0, 1, progress);
```

---

### `randomInt`

```typescript
__sys__.utils.num.randomInt(min: number, max: number): number
```

Returns a pseudo-random integer within the inclusive range `[min, max]`.

#### Example: Dice Rolling

```ts
const roll = __sys__.utils.num.randomInt(1, 6);
// → a number between 1 and 6
```

---

### `formatNumber`

```typescript
__sys__.utils.num.formatNumber(value: number, locale: string = "en-US", options?: Intl.NumberFormatOptions): string
```

A thin wrapper around the native `Intl.NumberFormat` API for consistent, localized number formatting.

#### Example: Currency and Percentage

```ts
const price = __sys__.utils.num.formatNumber(1250.5, "en-US", {
    style: "currency",
    currency: "USD",
});
// → "$1,250.50"

const percent = __sys__.utils.num.formatNumber(0.85, "en-US", {
    style: "percent",
});
// → "85%"
```

---

### `formatBytes`

```typescript
__sys__.utils.num.formatBytes(bytes: number, decimals: number = 2): string
```

Converts a raw byte count into a human-readable format (KB, MB, GB, TB) using a base-1024 binary system.

#### Example: File System Reporting

```ts
const size = 15728640;
const readable = __sys__.utils.num.formatBytes(size);
// → "15 MB"
```

