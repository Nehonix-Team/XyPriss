# Logic & Validation Utilities (`async` & `is`)

This module covers asynchronous control flow primitives and type/value validation guards.

## Async Utilities (`async`)

### `wait` / `sleep`

```typescript
__sys__.utils.async.wait(ms: number): Promise<void>
__sys__.utils.async.sleep(ms: number): Promise<void>
```

Introduces an asynchronous delay. `wait` is a high-level alias for `sleep`.

#### Example: Sequential simulation pauses

```ts
await __sys__.utils.async.wait(1000); // 1-second pause
```

---

### `retry`

```typescript
__sys__.utils.async.retry<T>(fn: () => Promise<T>, maxAtt: number = 3, dly: number = 500): Promise<T>
```

Executes an async function with automatic retry logic and configurable delay.

#### Example: Resilient API calls

```ts
const status = await __sys__.utils.async.retry(
    () => fetch("http://localhost:3728/api/").then((r) => r.status),
    5, // Try 5 times
    100, // 100ms between attempts
);
```

---

### `repeat`

```typescript
__sys__.utils.async.repeat(fn: (tick: number) => void | Promise<void>, ms: number, signal?: AbortSignal): Promise<void>
```

Executes a function repeatedly with a fixed interval, automatically compensating for execution time drift.

#### Example: Stable Status Monitoring

```ts
const controller = new AbortController();

// Monitor health every 5 seconds without drift
__sys__.utils.async.repeat(
    async (tick) => {
        const health = await checkHealth();
        console.log(`[Tick ${tick}] Health: ${health}`);
    },
    5000,
    controller.signal,
);

// Later: stop monitoring
// controller.abort();
```

---

### `debounce` / `throttle`

```typescript
__sys__.utils.async.debounce<T>(fn: T, wait: number = 300): T
__sys__.utils.async.throttle<T>(fn: T, limit: number = 300): T
```

Wraps functions to control their execution frequency.

---

### `measure`

```typescript
__sys__.utils.async.measure<T>(fn: () => T | Promise<T>): Promise<{ result: T, durationMs: number }>
```

Executes a function and returns timing data.

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

