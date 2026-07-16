# ObjectWrapper Documentation

The `ObjectWrapper` class provides a fluent, chainable API for object manipulation within the XyPriss framework. It wraps a single object value and exposes various utility methods bound to that value, allowing developers to chain multiple operations without passing the object as an argument repeatedly.

This functionality is exposed publicly via the `__sys__.utils.obj.of()` method.

## Initialization

To begin chaining operations on an object, initialize the wrapper by passing the object to the `of` method.

```typescript
const obj = __sys__.utils.obj.of({ a: 1, b: 2, c: 3 });
```

## Methods

### `value()`
Unwraps and returns the underlying plain object held by this wrapper. Call this at the end of a chain to retrieve the final result.

**Returns:** `T` - The current wrapped object.

### `raw()`
An alias for `value()`. Unwraps and returns the underlying plain object.

**Returns:** `T` - The current wrapped object.

### `clone()`
Deep-clones the wrapped object (using internal serialization) and continues the chain on the cloned copy, leaving the original object untouched.

**Returns:** `ObjectWrapper<T>`

### `pick(keys)`
Narrows the wrapped object down to only the specified keys.

**Parameters:**
- `keys` (`K[]`): An array of keys to keep.

**Returns:** `ObjectWrapper<Pick<T, K>>`

### `omit(keys)`
Removes the specified keys from the wrapped object.

**Parameters:**
- `keys` (`K[]`): An array of keys to remove.

**Returns:** `ObjectWrapper<Omit<T, K>>`

### `isEmpty()`
Checks whether the wrapped object has no own enumerable keys. This is a terminal read operation.

**Returns:** `boolean` - `true` if the object has no own keys.

### `flatten(separator)`
Collapses the wrapped object's nested structure into a flat structure with path-based keys.

**Parameters:**
- `separator` (`string`, optional): The path separator. Defaults to `"."`.

**Returns:** `ObjectWrapper<Record<string, unknown>>`

### `unflatten(separator)`
Reverses the `flatten` operation, expanding flat path-based keys back into a nested object structure.

**Parameters:**
- `separator` (`string`, optional): The path separator. Defaults to `"."`.

**Returns:** `ObjectWrapper<Record<string, unknown>>`

### `merge(...sources)`
Deep-merges one or more source objects into the wrapped object. Arrays and primitive values are overwritten by the last source that defines them.

**Parameters:**
- `sources` (`Array<Partial<T> | Record<string, any>>`): One or more partial objects to merge.

**Returns:** `ObjectWrapper<T>`

### `mapValues(fn)`
Transforms every value of the wrapped object using the provided mapping function, keeping the same keys.

**Parameters:**
- `fn` (`(value: T[keyof T], key: keyof T) => R`): The mapping function.

**Returns:** `ObjectWrapper<Record<keyof T, R>>`

### `mapKeys(fn)`
Transforms every key of the wrapped object using the provided mapping function, keeping the same values.

**Parameters:**
- `fn` (`(key: keyof T, value: T[keyof T]) => string`): The mapping function, which must return a string.

**Returns:** `ObjectWrapper<Record<string, T[keyof T]>>`

### `filter(predicate)`
Keeps only the key-value pairs for which the predicate function returns `true`.

**Parameters:**
- `predicate` (`(value: T[keyof T], key: keyof T) => boolean`): The filtering function.

**Returns:** `ObjectWrapper<Partial<T>>`

### `keys()`
Returns the own enumerable keys of the wrapped object. This is a terminal read operation.

**Returns:** `(keyof T)[]`

### `values()`
Returns the own enumerable values of the wrapped object. This is a terminal read operation.

**Returns:** `T[keyof T][]`

### `entries()`
Returns the own enumerable key-value pairs of the wrapped object. This is a terminal read operation.

**Returns:** `[keyof T, T[keyof T]][]`

### `has(key)`
Checks whether the wrapped object has the given own key. This is a terminal read operation.

**Parameters:**
- `key` (`PropertyKey`): The key to check.

**Returns:** `boolean`

### `get(path, fallback)`
Safely reads a possibly-nested value using a path string, returning a fallback if any part of the path is missing. This is a terminal read operation.

**Parameters:**
- `path` (`string`): The path to the property (e.g., `"a.b.c"`).
- `fallback` (`R | undefined`, optional): The value to return if the path cannot be resolved.

**Returns:** `R | undefined`

### `set(path, value)`
Sets a possibly-nested value using a path string, creating intermediate objects as necessary.

**Parameters:**
- `path` (`string`): The path to the property.
- `value` (`unknown`): The value to set.

**Returns:** `ObjectWrapper<T>`

### `equals(other)`
Performs a deep structural equality check between the wrapped object and the provided object. This is a terminal read operation.

**Parameters:**
- `other` (`unknown`): The object to compare against.

**Returns:** `boolean`

## Usage Examples

### Method Chaining
Chain multiple modifications consecutively without redefining the variable.

```typescript
const result = __sys__.utils.obj.of({ a: 1, b: 2, c: 3, d: 4 })
  .omit(["d"])
  .pick(["a", "b"])
  .value(); 

// Output: { a: 1, b: 2 }
```

### Deep Cloning
Safely clone an object and mutate the clone without affecting the source object.

```typescript
const source = { nested: { count: 1 } };
const wrapper = __sys__.utils.obj.of(source).clone();

wrapper.value().nested.count = 99;
// source.nested.count remains 1
```

### Path-Based Assignment and Retrieval
Set and get deeply nested properties easily using dot-notation paths.

```typescript
const config = __sys__.utils.obj.of({});

config.set("database.host", "localhost");
config.set("database.port", 5432);

const port = config.get("database.port", 3306); // Returns 5432
```
