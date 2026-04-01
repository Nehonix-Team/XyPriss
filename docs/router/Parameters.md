# XyPriss Router V2 - Parameters and Constraints

Define dynamic parameters and enforce constraints on route segments.

## Path Parameters

Parameters are defined using the `:` prefix.

```typescript
router.get("/users/:id", (req, res) => {
    const userId = req.params.id;
    res.success(`User ID: ${userId}`);
});
```

## Parameter Constraints (Regex)

Enforce specific formats for parameters using regular expressions.

```typescript
router.get("/users/:id(\\d+)", (req, res) => {
    // Only matches if 'id' is numeric
    res.success("Numeric ID");
});
```

## Multiple Parameters

You can use multiple parameters in a single route.

```typescript
router.get("/posts/:year/:month/:slug", (req, res) => {
    const { year, month, slug } = req.params;
    res.json({ year, month, slug });
});
```

## Query Parameters

Query parameters are automatically parsed into `req.query`.

```typescript
// GET /search?q=test&limit=10
router.get("/search", (req, res) => {
    const { q, limit } = req.query;
    res.json({ query: q, limit });
});
```

