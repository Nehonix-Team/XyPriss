# Data Utilities (`obj` & `arr`)

This module provides operations for deep object manipulation and advanced collection (array) management.

## Object Utilities (`obj`)

### `deepClone`

```typescript
__sys__.utils.obj.deepClone<T>(obj: T): T
```

Performs a high-performance deep copy of an object, handling cyclic references and complex data types.

### `parse`

```typescript
__sys__.utils.obj.parse<T>(json: string, fallback: T | null = null): T | null
```

Safely parses a JSON string. Returns the fallback value on failure.

### `pick` / `omit`

```typescript
__sys__.utils.obj.pick<T, K>(obj: T, keys: K[]): Pick<T, K>
__sys__.utils.obj.omit<T, K>(obj: T, keys: K[]): Omit<T, K>
```

Extracts or excludes specific keys from an object.

### `isEmpty`

```typescript
__sys__.utils.obj.isEmpty(obj: object): boolean
```

Determines if an object has no own enumerable properties.

### `flattenObject`

```typescript
__sys__.utils.obj.flattenObject(obj: Record<string, unknown>, separator: string = "."): Record<string, unknown>
```

Recursively flattens a nested object into a single-level object with path-based keys.

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

Returns a new array containing unique elements from the source.

### `shuffle`

```typescript
__sys__.utils.arr.shuffle<T>(arr: T[]): T[]
```

Randomly reorders elements using the Fisher-Yates algorithm. Non-mutating.

### `groupBy`

```typescript
__sys__.utils.arr.groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]>
```

Groups elements into an object based on the output of a provided key-mapping function.

### `sample`

```typescript
__sys__.utils.arr.sample<T>(arr: T[]): T | undefined
```

Selects a single element from the array at random.

### `flatten`

```typescript
__sys__.utils.arr.flatten<T>(arr: T[][]): T[]
```

Reduces the nesting level of an array.

