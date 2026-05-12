# XyPriss Router V2

The XyPriss routing engine is built on a **radix-tree** lookup algorithm backed by the [XHSC (XyPriss Hyper-System Core)](../core/XHSC_CORE.md). It is designed from the ground up for performance, security, and developer clarity — offering declarative guards, per-route rate limiting, response caching, live inspection, and typed lifecycle hooks as first-class citizens of the framework.

---

## What Router V2 Offers

| Capability                  | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| Radix-tree routing          | Sub-millisecond route resolution regardless of total route count          |
| Declarative security guards | Typed, inheritable guard chain applied at router, group, or route level   |
| Per-route rate limiting     | Enforced natively — no extra packages                                     |
| Per-route response caching  | In-memory caching with TTL, co-located with the route definition          |
| Lifecycle hooks             | `beforeEnter`, `afterLeave`, `onError` — precise request interception     |
| Live routing registry       | Full serializable snapshot of the routing tree for tooling and inspection |
| Native XHSC concurrency     | HTTP handling offloaded to XHSC — the Node.js event loop stays free       |

---

## Quick Start

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();
const router = Router();

router.get("/hello", (req, res) => {
    res.success("Hello from Router V2!");
});

app.use(router);
app.start();
```

---

## Documentation Index

| Document                                                      | Description                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| [Groups and Versioning](./groups-and-versioning.md)           | Prefixing, nested groups, API versioning                    |
| [Parameters and Constraints](./parameters-and-constraints.md) | Dynamic params, regex constraints, query parsing            |
| [Security Guards](./security-guards.md)                       | Declarative guard hierarchy, inheritance, failure responses |
| [Advanced Features](./advanced-features.md)                   | Rate limiting, response caching, lifecycle hooks            |
| [Advanced Routing](./ADVANCED_ROUTING.md)                     | Modular architecture, XyGuard API, custom guard resolvers   |
| [Inspection](./inspection.md)                                 | Registry export, router statistics, debugging               |
| [HTTP Methods Reference](./HTTP_METHODS_REFERENCE.md)         | Full HTTP method reference with examples                    |

---

## Core Concepts

### Declarative Route Options

Unlike traditional middleware stacks, Router V2 lets you declare security, throttling, and caching **directly on the route definition** — making intent visible and auditable at a glance.

```typescript
router.get(
    "/api/data",
    {
        guards: [authGuard],
        rateLimit: { max: 100, windowMs: 60_000 },
        cache: "1h",
    },
    (req, res) => {
        res.json({ data: "protected and cached" });
    },
);
```

### Guard Inheritance Chain

Guards cascade from the broadest to most specific scope:

```
Router Guards → Group Guards → Route Guards
```

All guards must pass for the handler to execute. A guard returning `false` produces a **403 Forbidden**; returning a string produces a **401 Unauthorized** with that string as the message.

### Modular Routers

You can split your routing logic across multiple `Router()` instances and mount them on the main app. This keeps large applications organized by domain.

```typescript
import { Router } from "xypriss";

const userRouter = Router();
const productRouter = Router();

userRouter.get("/profile", (req, res) => { /* ... */ });
productRouter.get("/list", (req, res) => { /* ... */ });

app.use("/users", userRouter);
app.use("/products", productRouter);
```

### Route Parameters

Dynamic segments are declared with a colon prefix. Multiple parameters can coexist in a single path.

```typescript
router.get("/users/:userId/orders/:orderId", (req, res) => {
    const { userId, orderId } = req.params;
    res.json({ userId, orderId });
});
```

### Wildcard Routes

Use `*` to match any trailing path segment. Useful for catch-all handlers or serving static assets.

```typescript
router.get("/static/*", (req, res) => {
    const filePath = req.params["*"];
    res.sendFile(filePath);
});
```

### Response Helpers

Router V2 ships with a set of built-in response helpers for the most common patterns:

| Method            | Behavior                                     |
| ----------------- | -------------------------------------------- |
| `res.json(data)`  | Sends JSON with `Content-Type: application/json` |
| `res.success(msg)`| Sends a 200 response with a success envelope |
| `res.status(n)`   | Sets the HTTP status code (chainable)        |
| `res.send(body)`  | Sends a plain text or buffer response        |
| `res.redirect(url)` | Issues a 302 redirect                      |

---

## Error Handling

Define a global error handler with `app.onError` to catch unhandled errors from any route:

```typescript
app.onError((err, req, res) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
});
```

Route-level errors can also be caught with the `onError` lifecycle hook:

```typescript
router.get(
    "/risky",
    {
        onError: (err, req, res) => {
            res.status(422).json({ error: err.message });
        },
    },
    handler,
);
```

---

## Performance Notes

- The radix-tree algorithm resolves routes in **O(k)** time where *k* is the length of the URL path, not the number of registered routes.
- Response caching is stored in-memory and respects the TTL declared at the route level. Use short TTLs for frequently updated resources.
- Rate limiting is enforced at the XHSC layer, before handlers execute, so rejected requests do not consume event loop time.
