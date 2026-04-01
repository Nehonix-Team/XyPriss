# XyPriss Router V2 - Advanced Options

This document covers advanced features including Rate Limiting, Caching, and Lifecycle Hooks.

## Rate Limiting

Declarative rate limiting per route.

```typescript
router.get(
    "/limited",
    {
        rateLimit: {
            max: 100,
            windowMs: 60000, // 1 minute
            message: "Too many requests",
        },
    },
    (req, res) => {
        res.success("Welcome");
    },
);
```

- **windowMs**: Duration in milliseconds.
- **window**: String duration (e.g., "1m", "1h").
- **max**: Maximum requests per window.
- **keyBy**: Function or string ("ip", "user") to identify the client.

## Response Caching

In-memory response caching for GET routes.

```typescript
router.get("/data", { cache: "1h" }, (req, res) => {
    res.json({ date: new Date() });
});
```

- **ttl**: Time-to-live in milliseconds or string ("10s", "1m").
- **key**: Optional custom cache key generator.

## Lifecycle Hooks

Hooks executed at different stages of the request.

| Hook          | Description                                                  |
| :------------ | :----------------------------------------------------------- |
| `beforeEnter` | Runs before the main handler. Use `next()` to proceed.       |
| `afterLeave`  | Runs after the response is sent. Useful for logging metrics. |
| `onError`     | Catches errors thrown by the handler or `beforeEnter`.       |

### IMPORTANT: Handling Errors in `onError`

If you use the `onError` hook, you **MUST** ensure the request is terminated, otherwise it will **hang indefinitely**.

**Pattern (Hanging):**

```typescript
onError(err, req, res, next) {
    console.error(err);
    next(); // Do not use next() here as it does not terminate the request.
}
```

**Correct Patterns:**

1. **Respond to the Client:**

```typescript
onError(err, req, res, next) {
    res.status(500).json({ error: "Internal Error" }); // Correct
}
```

2. **Bubble up to Global Handler:**

```typescript
onError(err, req, res, next) {
    throw err; // Correct: XyPriss global handler will catch it.
}
```

3. **Ignore and Fallback:**

```typescript
onError(err, req, res, next) {
    res.success("Fallback value"); // Correct
}
```

## Security Guards

Typed guards that run before any route logic.

```typescript
const isAuth = (req, res) => {
    if (req.headers.auth) return true;
    return "Unauthorized"; // Returns string = 401 with this message
};

router.get("/secure", { guards: [isAuth] }, (req, res) => {
    res.success("Secret data");
});
```

