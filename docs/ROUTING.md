# XyPriss Routing Guide

XyPriss provides a flexible routing system with support for parameters, wildcards, and modular routers.

## Basic Routes

```typescript
import { createServer } from "xypriss";

const app = createServer();

app.get("/", (req, res) => {
    res.json({ message: "Welcome to XyPriss" });
});

app.post("/users", (req, res) => {
    res.json({ message: "User created", data: req.body });
});

app.put("/users/:id", (req, res) => {
    res.json({ message: "User updated", id: req.params.id });
});
```

## Route Parameters

Extract dynamic segments from URLs:

```typescript
app.get("/users/:id", (req, res) => {
    res.json({ userId: req.params.id });
});

app.get("/users/:userId/posts/:postId", (req, res) => {
    res.json({ userId: req.params.userId, postId: req.params.postId });
});
```

## Wildcard Routes

-   **Single Wildcard (`*`)**: Matches one path segment.
-   **Multi-segment Wildcard (`**`)\*\*: Matches multiple path segments.

```typescript
app.get("/files/*", (req, res) => {
    res.json({ filename: req.params["*"] }); // e.g., "document.pdf"
});

app.get("/api/**", (req, res) => {
    res.json({ path: req.params["**"] }); // e.g., "v1/users/123"
});
```

## Modular Routers

Organize routes with routers:

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();
const userRouter = Router();

userRouter.get("/", (req, res) => {
    res.json({ message: "List users" });
});

userRouter.get("/:id", (req, res) => {
    res.json({ message: "Get user", id: req.params.id });
});

app.use("/api/users", userRouter);
```

## Middleware

Apply middleware globally, per route, or per router:

```typescript
// Global middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Route-specific middleware
app.get(
    "/protected",
    (req, res, next) => {
        if (!req.headers.authorization) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        next();
    },
    (req, res) => {
        res.json({ message: "Protected resource" });
    }
);
```

## Advanced Routing Patterns

### Route Groups

```typescript
const apiRouter = Router();

apiRouter.use("/v1", v1Router);
apiRouter.use("/v2", v2Router);

app.use("/api", apiRouter);
```

### Conditional Routes

```typescript
app.get("/admin/*", authMiddleware, adminMiddleware, (req, res) => {
    res.json({ admin: true });
});
```

### Error Handling in Routes

```typescript
app.get("/error-test", async (req, res) => {
    try {
        throw new Error("Test error");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Best Practices

1. **Use routers** for organizing related routes
2. **Apply middleware** at the appropriate level (global, router, or route)
3. **Use route parameters** for dynamic segments
4. **Validate inputs** in middleware before reaching route handlers
5. **Handle errors** consistently across all routes

---

[← Back to Main Documentation](../README.md)

