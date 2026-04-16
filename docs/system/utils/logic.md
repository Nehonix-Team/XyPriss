# Logic & Validation Utilities (`async` & `is`)

This module covers asynchronous control flow primitives and type/value validation guards.

## Async Utilities (`async`)

The `async` module provides a comprehensive library for resilient and performant asynchronous operations, supporting abort signals, backoff strategies, and concurrency control.

---

### `sleep` / `wait`

```typescript
__sys__.utils.async.sleep(ms: number, signal?: AbortSignal): Promise<void>
```

Suspends execution for a specific duration.

- **Abortable**: If `signal` is aborted, the promise resolves immediately.
- **Leak-Safe**: Automatically cleans up timers and listeners.

#### Example: Sequential simulation pauses

```ts
await __sys__.utils.async.wait(1000); // 1-second pause
```

---

### `retry`

```typescript
__sys__.utils.async.retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>
```

Executes an async function with automatic retry logic.

- **Backoff**: Supports exponential backoff via `backoffFactor`.
- **Filtering**: Use `retryIf` to avoid retrying fatal errors (e.g., 401 Unauthorized).

#### Example: Resilient API calls

```ts
const status = await __sys__.utils.async.retry(
    async () => {
        const res = await fetch("http://localhost:3728/api/");
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        return res.status;
    },
    { maxAttempts: 5, delay: 100 },
);
```

---

### `timeout`

```typescript
__sys__.utils.async.timeout<T>(fn: () => Promise<T>, ms: number, options?: TimeoutOptions): Promise<T>
```

Wraps a promise with a maximum execution time. Throws an error if the timeout is reached.

#### Example

```ts
const result = await __sys__.utils.async.timeout(() => heavyTask(), 2000);
```

---

### `attempt`

```typescript
__sys__.utils.async.attempt<T>(fn: () => Promise<T>): Promise<AttemptResult<T>>
```

Executes an async function and returns a discriminated object `{ ok, value }` or `{ ok, error }`. This simplifies flow control by avoiding global try/catch blocks.

---

### `repeat`

```typescript
__sys__.utils.async.repeat(fn: (tick: number) => void | Promise<void>, ms: number, signal?: AbortSignal): Promise<void>
```

Executes a function repeatedly with a fixed interval, automatically compensating for execution time drift (drift correction) to maintain steady timing.

---

### `pool`

```typescript
__sys__.utils.async.pool<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>, concurrency: number = 5): Promise<R[]>
```

Processes an array of items in parallel with a limited number of active promises (concurrency control).

---

### `memoize` (Async)

```typescript
__sys__.utils.async.memoize<TArgs, TResult>(fn: (...args) => Promise<TResult>, ttlMs: number = 0): Function
```

Caches the results of an async function. If multiple identical calls arrive while a promise is pending, they share the same promise (request collapsing).

---

### `queue`

```typescript
__sys__.utils.async.queue(): { add: <T>(fn: () => Promise<T>) => Promise<T>, readonly size: number }
```

Creates a sequential task queue where jobs are executed one by one in the order they were added.

---

### `once`

```typescript
__sys__.utils.async.once<TResult>(fn: () => Promise<TResult>): () => Promise<TResult>
```

Guarantees that a function is executed only once, and subsequent calls return the same cached promise.

---

### `poll`

```typescript
__sys__.utils.async.poll<T>(fn: () => Promise<T>, predicate: (v: T) => boolean, interval: number = 1000, signal?: AbortSignal): Promise<T>
```

Repeatedly checks a condition until it becomes true or the signal is aborted.

---

### `debounce` / `throttle`

```typescript
__sys__.utils.async.debounce<T>(fn: T, wait: number = 300): T
__sys__.utils.async.throttle<T>(fn: T, limit: number = 300): T
```

---

### `measure`

```typescript
__sys__.utils.async.measure<T>(fn: () => T | Promise<T>): Promise<MeasureResult<T>>
```

---

## Validation Utilities (`is`)

### `email` / `url`

```typescript
__sys__.utils.is.email(email: string): boolean
__sys__.utils.is.url(url: string): boolean
```

---

### `nullish`

```typescript
__sys__.utils.is.nullish(value: unknown): value is null | undefined
```

Type guard for `null` or `undefined` values.

