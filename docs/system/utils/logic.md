# Logic & Validation Utilities (`async` & `is`)

This module provides essential tools for asynchronous flow control, timing, and structural data validation.

---

## Async Utilities (`async`)

### `sleep`

```typescript
__sys__.utils.async.sleep(ms: number): Promise<void>
```

Standard `Promise`-based delay. Useful for introducing pauses in loops or simulating network latency during development.

---

### `retry`

```typescript
__sys__.utils.async.retry<T>(fn: () => Promise<T>, maxAtt: number = 3, dly: number = 500): Promise<T>
```

Attempts to execute an async function multiple times upon failure.

#### Example: Robust API Requests

```ts
const data = await __sys__.utils.async.retry(
    () => fetch("https://api.example.com/data").then((r) => r.json()),
    5, // Max attempts
    1000, // Delay (ms) between retries
);
```

---

### `debounce` / `throttle`

```typescript
__sys__.utils.async.debounce<T>(fn: T, wait: number = 300): T
__sys__.utils.async.throttle<T>(fn: T, limit: number = 300): T
```

Decorators to limit frequency of execution.

- **Debounce**: Resets timer on every call. Executes only after `wait` ms since the _last_ call.
- **Throttle**: Ensures the function is called at most once every `limit` ms.

#### Example: Search and Scroll behavior

```ts
// Search box input (wait for user to stop typing)
const onSearch = __sys__.utils.async.debounce(
    (query) => performSearch(query),
    500,
);

// Scroll handler (update UI at most 60fps)
const onScroll = __sys__.utils.async.throttle(() => updateParallax(), 16);
```

---

### `measure`

```typescript
__sys__.utils.async.measure<T>(fn: () => T | Promise<T>): Promise<{ result: T, durationMs: number }>
```

Executes a function and returns its result along with high-precision timing data.

#### Example: Performance Benchmarking

```ts
const { durationMs } = await __sys__.utils.async.measure(() =>
    processHeavyData(),
);
console.log(`Processing took ${durationMs}ms`);
```

---

## Validation Utilities (`is`)

### `email` / `url`

```typescript
__sys__.utils.is.email(email: string): boolean
__sys__.utils.is.url(url: string): boolean
```

Semantic validation for common data formats.

---

### `nullish`

```typescript
__sys__.utils.is.nullish(value: unknown): value is null | undefined
```

A type guard that determines if a value is `null` or `undefined`. Useful for strict narrowing in TypeScript.

#### Example

```ts
if (__sys__.utils.is.nullish(cfg.path)) {
    throw new Error("Path is required");
}
```

