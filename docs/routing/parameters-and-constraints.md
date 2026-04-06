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

Enforce a specific format on a parameter at the routing layer.

```typescript
// Only matches when 'id' consists of digits
router.get("/users/:id(\\d+)", (req, res) => {
    res.json({ userId: req.params.id });
});

// matches slugs like: word-word-word
router.get("/shop/:slug([a-z]+-[a-z]+-[a-z]+)", (req, res) => {
    res.json({ slug: req.params.slug });
});
```

---

## Typed Parameters

XyPriss provides built-in type shortcuts for common parameter formats. This is cleaner than writing raw regex.

```typescript
// Only matches numbers
router.get("/items/:id<number>", (req, res) => {
    res.json({ id: req.params.id });
});

// Only matches UUIDs
router.get("/jobs/:uuid<uuid>", (req, res) => {
    res.json({ uuid: req.params.uuid });
});

// Only matches alphabetic characters
router.get("/category/:name<alpha>", (req, res) => {
    res.json({ category: req.params.name });
});
```

**Supported Types:**

- `number`, `integer`, `boolean`, `uuid`, `alpha`, `alphanumeric`
- `string(min,max)`: Length constraint
- `number(min,max)`: Value constraint
- `enum(a,b,c)`: Allowed values

---

## Multiple Parameters in One Segment

You can define multiple parameters in a single path segment without using slashes.

```typescript
// Matches: /archive/2026-04-05
router.get("/archive/:year-:month-:day", (req, res) => {
    const { year, month, day } = req.params;
    res.json({ year, month, day });
});

// Matches: /files/image.png
router.get("/files/:name.:ext", (req, res) => {
    const { name, ext } = req.params;
    res.json({ name, ext });
});
```

---

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

---

## Relative Redirection

When using `router.redirect()`, the destination path is automatically scoped to the router's mount point. This ensures that a router remains portable and only "knows" about its own routes.

### Instance-Scoped Redirection

If a router is mounted at `/api/v1`, a redirect from `/old` to `/new` will automatically resolve to `/api/v1/new`.

```typescript
const apiRouter = Router();

// Redirects to /api/v1/dashboard (assuming mount at /api/v1)
apiRouter.redirect("/home", "/dashboard");

app.use("/api/v1", apiRouter);
```

### Relative vs. Absolute Redirection

| Method                      | Behavior                                                                            | Use Case                                       |
| :-------------------------- | :---------------------------------------------------------------------------------- | :--------------------------------------------- |
| `router.redirect(from, to)` | **Relative**: Always prepends the router's base path to `to` if it starts with `/`. | Internal navigation within a modular router.   |
| `app.redirect(from, to)`    | **Absolute**: Redirects exactly to the provided `to` path.                          | Cross-router navigation or external redirects. |

> [!NOTE]
> `router.redirect` is designed to enforce encapsulation. You cannot use it to redirect to routes outside of the router's own instance. For global navigation, use the main application object (`app.redirect`).