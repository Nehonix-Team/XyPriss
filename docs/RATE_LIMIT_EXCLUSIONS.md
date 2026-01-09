# Rate Limiting Exclusions and `skip` Function

XyPriss allows you to refine which requests are subject to rate limiting using two methods: `excludePaths` and a `skip` function.

## 1. Excluded Paths (`excludePaths`)

By default, XyPriss excludes common endpoints and static assets to avoid blocking health checks and resource loading.

### Default Exclusions

Unless configured otherwise, XyPriss excludes:

-   `/health`
-   `/ping`
-   `/static/`
-   `/assets/`

### Custom Exclusions

You can override or extend these exclusions in your `serverOptions`:

```typescript
const app = createServer({
    security: {
        rateLimit: {
            // Only exclude my specific API status and images
            excludePaths: ["/api/status", /^\/images\//],
        },
    },
});
```

-   **Strings**: If a string starts with `/`, it matches exactly or as a path prefix.
-   **RegExp**: The regular expression is tested against `req.path`.

---

## 2. The `skip` Function

For more complex logic, you can provide a `skip` function.

```typescript
const app = createServer({
    security: {
        rateLimit: {
            skip(req, res) {
                // Ignore rate limit for local traffic or a specific header
                return (
                    req.ip === "127.0.0.1" || req.get("X-Internal") === "true"
                );
            },
        },
    },
});
```

### ⚠️ Important: Priority and Overriding

**When a `skip` function is defined, XyPriss completely ignores the `excludePaths` setting.**

This is done to prevent confusion or conflicting rules. If you provide a `skip` function, it is assumed that you want full control over the exclusion logic.

### How to combine them

If you want to use a `skip` function but still want to keep some path-based exclusions, you should include that logic inside your `skip` function:

```typescript
skip(req, res) {
    // Keep standard exclusions manually
    if (req.path === "/health" || req.path === "/ping") return true;

    // Add custom logic
    return req.path === "/test";
}
```

## Summary Table

| Configuration           | Exclusion Logic Used                                              |
| :---------------------- | :---------------------------------------------------------------- |
| **None**                | Default paths (`/health`, `/ping`, etc.) are excluded.            |
| **`excludePaths` only** | Only the paths in your list are excluded.                         |
| **`skip` only**         | Only your function's result determines exclusion.                 |
| **Both**                | **Only your `skip` function is used.** `excludePaths` is ignored. |

