# Logic & Validation Utilities (`async` & `is`)

This module covers asynchronous control flow primitives and type/value validation guards.

## Async Utilities (`async`)

### `sleep`

```typescript
__sys__.utils.async.sleep(ms: number): Promise<void>
```

Introduces an asynchronous delay.

### `retry`

```typescript
__sys__.utils.async.retry<T>(fn: () => Promise<T>, maxAtt: number = 3, dly: number = 500): Promise<T>
```

Executes an async function with automatic retry logic and configurable delay.

### `debounce` / `throttle`

```typescript
__sys__.utils.async.debounce<T>(fn: T, wait: number = 300): T
__sys__.utils.async.throttle<T>(fn: T, limit: number = 300): T
```

Wraps functions to control their execution frequency.

### `measure`

```typescript
__sys__.utils.async.measure<T>(fn: () => T | Promise<T>): Promise<{ result: T, durationMs: number }>
```

Executes a function and returns timing data.

---

## Validation Utilities (`is`)

### `email`

```typescript
__sys__.utils.is.email(email: string): boolean
```

Performs semantic validation on an email address.

### `url`

```typescript
__sys__.utils.is.url(url: string): boolean
```

Validates a URL string using an RFC-compliant URI parser.

### `nullish`

```typescript
__sys__.utils.is.nullish(value: unknown): value is null | undefined
```

Type guard for `null` or `undefined` values.

