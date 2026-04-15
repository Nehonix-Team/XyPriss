# Data Utilities (`obj` & `arr`)

This module provides high-performance operations for deep object manipulation and collection management.

---

## Object Utilities (`obj`)

### `deepClone`

```typescript
__sys__.utils.obj.deepClone<T>(obj: T): T
```

Creates a complete, recursive copy of the input object. This implementation effectively handles circular references and complex prototypes.

#### Example: Immutable State Updates

```ts
const originalConfig = { api: { timeout: 5000 }, plugins: ["auth", "cors"] };
const newConfig = __sys__.utils.obj.deepClone(originalConfig);
newConfig.api.timeout = 10000; // Original remains unchanged
```

---

### `parse`

```typescript
__sys__.utils.obj.parse<T>(json: string, fallback: T | null = null): T | null
```

A safe alternative to `JSON.parse`. Instead of throwing on malformed strings, it returns a user-defined fallback value.

#### Example: Loading Configurations

```ts
const raw = localStorage.getItem("user_prefs") || "";
const prefs = __sys__.utils.obj.parse(raw, { theme: "light" });
```

---

### `pick` / `omit`

```typescript
__sys__.utils.obj.pick<T, K>(obj: T, keys: K[]): Pick<T, K>
__sys__.utils.obj.omit<T, K>(obj: T, keys: K[]): Omit<T, K>
```

Filters object properties based on a whitelist (`pick`) or blacklist (`omit`).

#### Example: Restricting API Response Data

```ts
const user = { id: 1, email: "j@d.com", password: "HIDDEN", role: "admin" };
const publicProfile = __sys__.utils.obj.omit(user, ["password", "email"]);
// → { id: 1, role: "admin" }
```

---

### `flattenObject`

```typescript
__sys__.utils.obj.flattenObject(obj: Record<string, unknown>, separator: string = "."): Record<string, unknown>
```

Recursively reduces a nested object into a single-level object with path-based keys.

#### Example: Dynamic Form Field Names

```ts
const data = { user: { profile: { name: "John" } } };
const flat = __sys__.utils.obj.flattenObject(data);
// → { "user.profile.name": "John" }
```

---

## Array Utilities (`arr`)

### `chunk`

```typescript
__sys__.utils.arr.chunk<T>(arr: T[], size: number): T[][]
```

Splits an array into smaller sub-arrays of a defined maximum size.

#### Example: Batch API Processing

```ts
const items = [1, 2, 3, 4, 5, 6, 7];
const batches = __sys__.utils.arr.chunk(items, 3);
// → [[1, 2, 3], [4, 5, 6], [7]]
```

---

### `unique`

```typescript
__sys__.utils.arr.unique<T>(arr: T[]): T[]
```

Removes duplicate elements from an array while preserving the original order of the first occurrence.

#### Example: Cleaning ID lists

```ts
const ids = ["A", "B", "A", "C", "B"];
const uniqueIds = __sys__.utils.arr.unique(ids);
// → ["A", "B", "C"]
```

---

### `groupBy`

```typescript
__sys__.utils.arr.groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]>
```

Buckets elements of an array into an object based on a discriminator function.

#### Example: Categorizing Products

```ts
const products = [
    { name: "Bread", category: "Food" },
    { name: "Milk", category: "Food" },
    { name: "Hammer", category: "Tools" },
];
const categorized = __sys__.utils.arr.groupBy(products, (p) => p.category);
/* → { 
    Food: [{...Bread}, {...Milk}],
    Tools: [{...Hammer}]
} */
```

