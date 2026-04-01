# XyPriss Router V2

The XyPriss routing engine is built on a **radix-tree** lookup algorithm backed by the [XHSC (XyPriss Hyper-System Core)](../core/XHSC_CORE.md). It is designed from the ground up for performance, security, and developer clarity — offering declarative guards, per-route rate limiting, response caching, live inspection, and typed lifecycle hooks as first-class citizens of the framework.

## What Router V2 Offers

| Capability                  | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| Radix-tree routing          | Sub-millisecond route resolution regardless of total route count          |
| Declarative security guards | Typed, inheritable guard chain applied at router, group, or route level   |
| Per-route rate limiting     | Enforced natively — no extra packages                                     |
| Per-route response caching  | In-memory caching with TTL, co-located with the route definition          |
| Lifecycle hooks             | `beforeEnter`, `afterLeave`, `onError` — precise request interception     |
| Live routing registry       | Full serializable snapshot of the routing tree for tooling and inspection |
| Native Go concurrency       | HTTP handling offloaded to XHSC — the Node.js event loop stays free       |

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
| [Routing Fundamentals](./routing.md)                          | HTTP methods, parameters, wildcards, modular routers        |
| [Groups and Versioning](./groups-and-versioning.md)           | Prefixing, nested groups, API versioning                    |
| [Parameters and Constraints](./parameters-and-constraints.md) | Dynamic params, regex constraints, query parsing            |
| [Security Guards](./security-guards.md)                       | Declarative guard hierarchy, inheritance, failure responses |
| [Advanced Features](./advanced-features.md)                   | Rate limiting, response caching, lifecycle hooks            |
| [Inspection](./inspection.md)                                 | Registry export, router statistics, debugging               |
| [HTTP Methods Reference](./HTTP_METHODS_REFERENCE.md)         | Full HTTP method reference                                  |

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

All must pass for the handler to execute.

