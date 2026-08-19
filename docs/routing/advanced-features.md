# Advanced Route Features

Router V2 exposes production-critical features directly on route definitions and route groups: **Go-Native Rate Limiting & XTRS**, **Response Caching**, and **Lifecycle Hooks**. Declaring these at the route or group level ensures explicit intent, co-located business logic, and full visibility in the routing registry.

---

## Rate Limiting (Go-Native XHSC & XTRS)

Rate limiting in XyPriss is executed **100% natively in Go** via the **XHSC (XyPriss Hyper-System Core)** engine. It operates before JavaScript execution, ensuring ultra-low overhead and zero Node.js event-loop blocking.

Rate limiting can be declared as a **string shorthand**, a **standard configuration object**, or an **XTRS (Temporal Rate Shield)** policy inside the `xtrs` property.

### 1. String Shorthand
You can pass a quick duration string directly to `rateLimit`:

```typescript
router.get("/api/search", { rateLimit: "10/1m" }, (req, res) => {
    res.json({ results: [] });
});
```

### 2. Standard Configuration Object

Standard rate limit options remain clean and explicit at the root of `rateLimit`:

```typescript
router.get(
    "/api/export",
    {
        rateLimit: {
            max: 10,
            window: "1m", // or windowMs: 60_000
            message: "Rate limit exceeded. Please retry in 1 minute.",
            statusCode: 429,
            keyBy: "ip", // "ip" | "user" | (req) => string
        },
    },
    (req, res) => {
        res.json({ data: "..." });
    },
);
```

### 3. XTRS (Temporal Rate Shield) & Multi-Window Protection

Advanced multi-window rules, rate limits by second (`limit: "3/s"`), and temporary IP blocks are nested cleanly inside `rateLimit.xtrs`:

```typescript
router.post(
    "/api/auth/login",
    {
        rateLimit: {
            xtrs: {
                rules: [
                    {
                        rule: "5/1m",
                        message: "Too many login attempts. Account temporarily locked for 5 minutes.",
                        blockDuration: "5m",
                        statusCode: 429,
                    },
                ],
            },
        },
    },
    async (req, res) => {
        // Login logic
    },
);
```

You can also pass an XTRS shorthand string or single limit directly inside `xtrs`:

```typescript
router.post(
    "/upload",
    {
        rateLimit: {
            xtrs: {
                limit: "3/s",
                blockDuration: "10s",
            },
        },
    },
    Upload.single("file"),
    CdnController.upload,
);
```

### 4. Route Group Rate Limiting

Rate limiting can also be declared globally for an entire route group via `router.group(...)`. Group rate limits apply natively in Go across all routes inside the group, including unhandled `404` requests matching the group prefix:

```typescript
router.group(
    {
        prefix: "/stream",
        rateLimit: {
            xtrs: {
                limit: "3/1m",
                message: "Stream group rate limit exceeded!",
                blockDuration: "20s",
            },
        },
    },
    (stream) => {
        stream.get("/video", (req, res) => {
            res.send("Video stream");
        });
    },
);
```

### Rate Limit Options Reference (`RoutRateLimit`)

| Option       | Type                                | Description                                                          |
| ------------ | ----------------------------------- | -------------------------------------------------------------------- |
| `max`        | `number`                            | Maximum requests allowed per window (Standard Rate Limit)            |
| `window`     | `string \| number`                  | Window duration string (`"10s"`, `"1m"`, `"1h"`) or milliseconds     |
| `windowMs`   | `number`                            | Window duration in milliseconds (takes precedence over `window`)     |
| `message`    | `string \| any`                     | Error message or JSON object returned when limit is exceeded         |
| `statusCode` | `number`                            | HTTP status code returned when blocked (defaults to `429`)           |
| `keyBy`      | `"ip" \| "user" \| (req) => string` | Identification strategy for tracking requests (defaults to IP)       |
| `xtrs`       | `string \| XtrsOptions`             | Advanced multi-window XTRS policy object or shorthand string (`"3/s"`) |

#### XTRS Options Object (`XtrsOptions`)

| Property          | Type                | Description                                                                     |
| ----------------- | ------------------- | ------------------------------------------------------------------------------- |
| `limit`           | `string \| number`  | Shorthand limit string (e.g. `"3/s"`, `"5/1m"`)                                 |
| `rules`           | `XtrsRuleInput[]`   | Array of multi-window XTRS rules (e.g. `[{ rule: "5/1m", blockDuration: "5m" }]` |
| `blockDuration`   | `string \| number`  | Temporary IP ban duration after breaching threshold (e.g. `"20s"`, `"5m"`)      |
| `blockDurationMs` | `number`            | Block duration in milliseconds                                                  |
| `message`         | `string \| any`     | XTRS error message                                                              |
| `statusCode`      | `number`            | HTTP status code (defaults to `429`)                                            |

#### Type Definition (`RoutRateLimitInput`)
```typescript
export type RoutRateLimitInput = string | RoutRateLimit;
```

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
        rateLimit: {
            max: 20,
            window: "1m",
            message: "Rate limit exceeded for order placement",
        },
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
