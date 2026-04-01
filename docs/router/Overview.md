# XyPriss Router V2 - Overview

The XyPriss Router V2 is a high-performance, radix-tree based routing engine that provides ultra-fast lookup and advanced declarative features.

## Key Features

1.  **Fast & Typed**: Native performance with full TypeScript support for request/response.
2.  **Modular**: Group routes by prefix, version, or logic.
3.  **Declarative**: Configure security, rate limiting, and caching directly on the route object.
4.  **Automatic Versioning**: Flexible API versioning support.
5.  **Lifecycle Hooks**: Intercept and handle requests at every stage.

## Quick Usage

```typescript
const app = createServer();
const router = Router();

router.get("/hello", (req, res) => {
    res.success("Hello from Router V2!");
});

app.use(router);
app.start();
```

## Related Documents

- [Grouping and Prefixing](./Grouping.md)
- [Parameters and Constraints](./Parameters.md)
- [Security and Guards](./Security.md)
- [Advanced Options (RateLimit, Cache, Lifecycle)](./AdvancedOptions.md)
- [System Inspection](./Inspection.md)

