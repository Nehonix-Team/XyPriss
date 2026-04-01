# Advanced Route Features

Router V2 exposes three production-critical features directly on the route definition object: **Rate Limiting**, **Response Caching**, and **Lifecycle Hooks**. Declaring these at the route level ensures that the intent is explicit, co-located with the business logic, and fully visible in the routing registry.

---

## Rate Limiting

Per-route rate limiting is enforced natively without external packages.

```typescript
router.get(
    "/api/export",
    {
        rateLimit: {
            max: 10,
            windowMs: 60_000, // 10 requests per minute
            message: "Rate limit exceeded. Please retry in 1 minute.",
            keyBy: "ip", // or "user", or a custom (req) => string function
        },
    },
    (req, res) => {
        res.json({ data: "..." });
    },
);
```

### Options

| Option     | Type                                | Description                                   |
| ---------- | ----------------------------------- | --------------------------------------------- |
| `max`      | `number`                            | Maximum number of requests per window         |
| `windowMs` | `number`                            | Window duration in milliseconds               |
| `window`   | `string`                            | Shorthand duration string (`"1m"`, `"1h"`)    |
| `message`  | `string`                            | Error message returned when limit is exceeded |
| `keyBy`    | `"ip" \| "user" \| (req) => string` | Client identification strategy                |

---

## Response Caching

Cache the response of `GET` routes in-memory to eliminate redundant handler invocations.

```typescript
router.get("/api/products", { cache: "5m" }, (req, res) => {
    // This handler runs once per 5 minutes; subsequent hits are served from cache
    const products = db.getAll();
    res.json({ products });
});
```

### Options

| Option  | Type               | Description                                                        |
| ------- | ------------------ | ------------------------------------------------------------------ |
| `cache` | `string \| number` | TTL as a duration string (`"10s"`, `"1m"`, `"1h"`) or milliseconds |
| `key`   | `(req) => string`  | Optional custom cache key generator (defaults to the request URL)  |

> [!NOTE]
> Caching applies exclusively to `GET` routes. Mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) are not eligible.

---

## Lifecycle Hooks

Lifecycle hooks intercept the request at precisely defined stages without interfering with the normal handler chain.

| Hook          | When it runs                             | Use case                             |
| ------------- | ---------------------------------------- | ------------------------------------ |
| `beforeEnter` | Before the main handler                  | Input validation, enriching `req`    |
| `afterLeave`  | After the response is sent               | Logging, metrics, async side effects |
| `onError`     | When the handler or `beforeEnter` throws | Structured error responses           |

```typescript
router.get(
    "/api/users/:id",
    {
        beforeEnter(req, res, next) {
            if (!req.params.id.match(/^\d+$/)) {
                return res.status(400).json({ error: "Invalid ID format" });
            }
            next();
        },
        afterLeave(req, res) {
            // Fires after the response is already sent — safe for async analytics
            analytics.track("user.viewed", { id: req.params.id });
        },
    },
    (req, res) => {
        res.json({ userId: req.params.id });
    },
);
```

### Correct `onError` Patterns

> [!CAUTION]
> If you define an `onError` hook, you **must** terminate the request. Calling `next()` inside `onError` does not terminate the connection and will cause the request to hang indefinitely.

```typescript
// WRONG — request hangs
onError(err, req, res, next) {
    console.error(err);
    next(); // Do not use next() here
}

// CORRECT — respond to the client
onError(err, req, res) {
    res.status(500).json({ error: "Internal Server Error" });
}

// CORRECT — bubble up to the global error handler
onError(err) {
    throw err;
}
```

---

## Combining All Features

```typescript
router.post(
    "/api/orders",
    {
        guards: [authGuard, subscriptionGuard],
        rateLimit: { max: 20, window: "1m" },
        beforeEnter(req, res, next) {
            if (!req.body.items?.length) {
                return res
                    .status(400)
                    .json({ error: "Order must have at least one item" });
            }
            next();
        },
        onError(err, req, res) {
            res.status(500).json({ error: err.message });
        },
    },
    async (req, res) => {
        const order = await OrderService.create(req.body);
        res.status(201).json({ order });
    },
);
```

