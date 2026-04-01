# Parameters and Constraints

XyPriss Router V2 supports dynamic path segments with optional inline Regex constraints enforced at the routing layer — before any handler executes.

---

## Path Parameters

Parameters are defined using the `:name` prefix and are captured into `req.params`.

```typescript
router.get("/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({ userId });
});
```

### Multiple Parameters

```typescript
router.get("/posts/:year/:month/:slug", (req, res) => {
    const { year, month, slug } = req.params;
    res.json({ year, month, slug });
});
```

---

## Regex Constraints

Enforce a specific format on a parameter without any middleware — XyPriss validates it at the routing layer.

```typescript
// Only matches when 'id' consists of digits
router.get("/users/:id(\\d+)", (req, res) => {
    res.json({ userId: req.params.id });
});

// Only matches product slugs formatted as: word-word-word
router.get("/shop/:slug([a-z]+-[a-z]+-[a-z]+)", (req, res) => {
    res.json({ slug: req.params.slug });
});
```

> [!IMPORTANT]
> A request that does not satisfy the constraint will **not match the route at all** and will continue to the next registered route. This is a clean routing-level rejection, not a handler-level error.

---

## Wildcard Routes

### Single Wildcard (`*`) — One Segment

Matches exactly one path segment (no forward slashes).

```typescript
// Matches: /files/document.pdf — Does NOT match: /files/folder/doc.pdf
router.get("/files/*", (req, res) => {
    const filename = req.params["*"];
    res.json({ filename });
});
```

### Double Wildcard (`**`) — Multiple Segments

Matches multiple path segments across slashes.

```typescript
// Matches: /api/v1/users, /api/v1/users/123/posts/456
router.get("/api/**", (req, res) => {
    const capturedPath = req.params["**"];
    res.json({ capturedPath });
});
```

### Combined

```typescript
router.get("/users/:id/data/**", (req, res) => {
    const { id } = req.params;
    const dataPath = req.params["**"];
    res.json({ userId: id, dataPath });
});
```

---

## Query Parameters

Query strings are automatically parsed into `req.query`.

```typescript
// GET /search?q=xypriss&limit=10
router.get("/search", (req, res) => {
    const { q, limit } = req.query;
    res.json({ query: q, limit: Number(limit) });
});
```

