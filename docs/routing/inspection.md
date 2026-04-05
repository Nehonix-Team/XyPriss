# Router Inspection

Router V2 exposes a built-in inspection API that allows you to programmatically read the entire routing state at runtime. This is especially valuable when building tooling such as API documentation generators, health dashboards, or debugging overlays.

---

## Registry Export

`router.toRegistry()` returns a fully serializable snapshot of the routing tree.

```typescript
const registry = router.toRegistry();
console.log(JSON.stringify(registry, null, 2));
```

Each entry in the registry contains:

| Field          | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| `method`       | HTTP verb (`GET`, `POST`, etc.)                             |
| `path`         | The registered path string                                  |
| `id`           | Unique internal route identifier                            |
| `params`       | Extracted parameter names and their regex constraints       |
| `hasGuards`    | Whether the route has guards defined                        |
| `hasRateLimit` | Whether the route has rate limiting configured              |
| `hasCache`     | Whether the route has response caching configured           |
| `meta`         | Custom metadata attached to the route (version, tags, etc.) |

---

## Router Statistics

`router.getStats()` returns high-level aggregated metrics about the router instance.

```typescript
const stats = router.getStats();
```

Available data:

- Total number of registered routes
- Breakdown of routes by HTTP method
- Number of active middleware and guards
- Global router configuration snapshot

**Example:**

```typescript
const stats = router.getStats();
console.log(`Total routes: ${stats.totalRoutes}`);
console.log(`GET routes: ${stats.byMethod.GET}`);
```

---

## Integration with Swagger / OpenAPI

The `toRegistry()` output is the data source powering the `@xypriss/swagger` plugin. The plugin automatically converts XyPriss-specific routing features (like typed parameters and regex constraints) into valid OpenAPI schema definitions.

```typescript
import { SwaggerPlugin } from "@xypriss/swagger";

createServer({
    plugins: {
        register: [
            SwaggerPlugin({
                path: "/api-docs",
                title: "My API",
                description: "Auto-generated from XyPriss Registry",
            }),
        ],
    },
});
```

> [!TIP]
> You can also add custom OpenAPI fields directly to a route via `meta.openapi`. This will merge with the automatically generated operation object.

