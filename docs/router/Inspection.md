# XyPriss Router V2 - System Inspection

The Router V2 provides built-in tools to inspect and debug the routing registry.

## Registry Export

Export the entire routing state as a serializable object for documentation generators or debug UI.

```typescript
const registry = router.toRegistry();
console.log(JSON.stringify(registry, null, 2));
```

The output includes:

- Method and Path
- Route ID
- Parameter names and regex constraints
- Feature flags (hasGuards, hasRateLimit, hasCache)
- Metadata (version, custom meta)

## Router Statistics

Get high-level metrics about the router instance.

```typescript
const stats = router.getStats();
```

Stats include:

- Total number of routes
- Breakdown by HTTP method
- Number of active middleware/guards
- Global router configuration

## Visualizing Parameters

The router automatically extracts parameter names from paths. These are available in the registry to help verify that complex regex patterns are correctly identifying segments.

