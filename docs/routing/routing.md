# XyPriss Routing System

XyPriss provides a flexible routing system with Express-like API but without Express dependency. The routing system supports advanced pattern matching, middleware, and modular route organization.

## Table of Contents

- [Basic Routing](#basic-routing)
- [Route Parameters](#route-parameters)
- [Wildcard Routes](#wildcard-routes)
- [Router System](#router-system)
- [Middleware](#middleware)
- [Advanced Examples](#advanced-examples)
- [API Reference](#api-reference)

## Basic Routing

XyPriss supports all standard HTTP methods with Express-like syntax:

```typescript
import { createServer } from "xypriss";

const app = createServer();

// Basic HTTP methods
app.get("/", (req, res) => {
    res.json({ message: "GET request" });
});

app.post("/users", (req, res) => {
    res.json({ message: "POST request", data: req.body });
});

app.put("/users/:id", (req, res) => {
    res.json({ message: "PUT request", id: req.params.id });
});

app.delete("/users/:id", (req, res) => {
    res.json({ message: "DELETE request", id: req.params.id });
});

app.patch("/users/:id", (req, res) => {
    res.json({ message: "PATCH request", id: req.params.id });
});

app.options("/users", (req, res) => {
    res.json({ message: "OPTIONS request" });
});

app.head("/users", (req, res) => {
    res.status(200).end();
});
```

## Route Parameters

### Single Parameters

```typescript
// Single parameter
app.get("/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({ userId });
});

// Parameter with validation
app.get("/posts/:postId", (req, res) => {
    const { postId } = req.params;
    
    if (!postId || isNaN(Number(postId))) {
        return res.status(400).json({ error: "Invalid post ID" });
    }
    
    res.json({ postId: Number(postId) });
});
```

### Multiple Parameters

```typescript
// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, res) => {
    const { userId, postId } = req.params;
    res.json({ userId, postId });
});

// Nested resource parameters
app.get("/organizations/:orgId/teams/:teamId/members/:memberId", (req, res) => {
    const { orgId, teamId, memberId } = req.params;
    res.json({ orgId, teamId, memberId });
});
```

## Wildcard Routes

XyPriss supports two types of wildcards with different behaviors:

### Single Wildcard (`*`) - One Path Segment

The single wildcard `*` matches exactly one path segment (no forward slashes).

```typescript
// Matches: /files/document.pdf, /files/image.jpg
// Does NOT match: /files/folder/document.pdf, /files/a/b/c.txt
app.get("/files/*", (req, res) => {
    const filename = req.params["*"];
    res.json({ 
        message: "Single wildcard match",
        filename,
        type: "file"
    });
});

// Example matches:
// GET /files/document.pdf → { filename: "document.pdf" }
// GET /files/image.jpg → { filename: "image.jpg" }
// GET /files/folder/doc.pdf → 404 (not matched)
```

### Double Wildcard (`**`) - Multiple Path Segments

The double wildcard `**` matches multiple path segments (including forward slashes).

```typescript
// Matches: /api/v1/users, /api/v1/users/123/posts, /api/v1/admin/settings/security
app.get("/api/**", (req, res) => {
    const path = req.params["**"];
    res.json({ 
        message: "Double wildcard match",
        capturedPath: path,
        segments: path.split("/")
    });
});

// Example matches:
// GET /api/v1/users → { capturedPath: "v1/users" }
// GET /api/v1/users/123/posts → { capturedPath: "v1/users/123/posts" }
// GET /api/admin/deep/nested/path → { capturedPath: "admin/deep/nested/path" }
```

### Combined Parameters and Wildcards

```typescript
// Parameter + single wildcard
app.get("/users/:id/files/*", (req, res) => {
    const { id } = req.params;
    const filename = req.params["*"];
    res.json({ userId: id, filename });
});

// Parameter + double wildcard
app.get("/users/:id/data/**", (req, res) => {
    const { id } = req.params;
    const dataPath = req.params["**"];
    res.json({ userId: id, dataPath });
});
```

## Router System

Create modular, reusable route groups using the Router system:

### Basic Router Usage

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();

// Create a router
const userRouter = Router();

// Add routes to router
userRouter.get("/", (req, res) => {
    res.json({ message: "Get all users" });
});

userRouter.get("/:id", (req, res) => {
    res.json({ message: "Get user", id: req.params.id });
});

userRouter.post("/", (req, res) => {
    res.json({ message: "Create user", data: req.body });
});

userRouter.put("/:id", (req, res) => {
    res.json({ message: "Update user", id: req.params.id, data: req.body });
});

userRouter.delete("/:id", (req, res) => {
    res.json({ message: "Delete user", id: req.params.id });
});

// Mount router at /api/users
app.use("/api/users", userRouter);
```

### Router with Middleware

```typescript
const adminRouter = Router();

// Router-level middleware
adminRouter.use((req, res, next) => {
    console.log("Admin route accessed");
    
    // Simple authentication check
    if (!req.headers.authorization) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    next();
});

adminRouter.get("/dashboard", (req, res) => {
    res.json({ message: "Admin dashboard" });
});

adminRouter.get("/users", (req, res) => {
    res.json({ message: "Admin users list" });
});

app.use("/admin", adminRouter);
```

### Nested Routers

```typescript
// API v1 router
const v1Router = Router();

v1Router.get("/users", (req, res) => {
    res.json({ version: "v1", users: [] });
});

v1Router.get("/posts", (req, res) => {
    res.json({ version: "v1", posts: [] });
});

// API v2 router
const v2Router = Router();

v2Router.get("/users", (req, res) => {
    res.json({ 
        version: "v2", 
        users: [], 
        pagination: { page: 1, limit: 10 } 
    });
});

v2Router.get("/posts", (req, res) => {
    res.json({ 
        version: "v2", 
        posts: [], 
        meta: { total: 0 } 
    });
});

// Mount versioned APIs
app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
```

## Middleware

### Global Middleware

```typescript
// Global middleware - applies to all routes
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// CORS middleware
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});
```

### Route-Specific Middleware

```typescript
// Authentication middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    
    // Validate token (simplified)
    if (token !== "Bearer valid-token") {
        return res.status(401).json({ error: "Invalid token" });
    }
    
    req.user = { id: 1, name: "John Doe" };
    next();
};

// Protected route with middleware
app.get("/protected", authenticate, (req, res) => {
    res.json({ 
        message: "Protected resource", 
        user: req.user 
    });
});

// Multiple middleware functions
app.post("/api/data", 
    authenticate,
    (req, res, next) => {
        // Validation middleware
        if (!req.body.name) {
            return res.status(400).json({ error: "Name is required" });
        }
        next();
    },
    (req, res) => {
        res.json({ 
            message: "Data created", 
            data: req.body,
            user: req.user
        });
    }
);
```

## Advanced Examples

### File Server with Wildcards

```typescript
// Static file serving with single wildcard
app.get("/static/*", (req, res) => {
    const filename = req.params["*"];
    const filepath = path.join(__dirname, "public", filename);
    
    // Security check - prevent directory traversal
    if (filename.includes("..")) {
        return res.status(400).json({ error: "Invalid filename" });
    }
    
    res.sendFile(filepath);
});

// Documentation with double wildcard
app.get("/docs/**", (req, res) => {
    const docPath = req.params["**"];
    const sections = docPath.split("/");
    
    res.json({
        documentPath: docPath,
        sections,
        breadcrumb: sections.map((section, index) => ({
            name: section,
            path: sections.slice(0, index + 1).join("/")
        }))
    });
});
```

### API with Complex Routing

```typescript
// Product catalog API
const catalogRouter = Router();

// Categories with subcategories (double wildcard)
catalogRouter.get("/categories/**", (req, res) => {
    const categoryPath = req.params["**"];
    const categories = categoryPath.split("/");
    
    res.json({
        categoryPath: categories,
        products: `Products in ${categories.join(" > ")}`
    });
});

// Product search with single wildcard for search terms
catalogRouter.get("/search/*", (req, res) => {
    const searchTerm = req.params["*"];
    
    res.json({
        searchTerm,
        results: `Search results for "${searchTerm}"`
    });
});

// Specific product by ID
catalogRouter.get("/products/:id", (req, res) => {
    const { id } = req.params;
    
    res.json({
        productId: id,
        name: `Product ${id}`,
        category: "Electronics"
    });
});

app.use("/api/catalog", catalogRouter);
```

## API Reference

### App Methods

- `app.get(path, ...handlers)` - Handle GET requests
- `app.post(path, ...handlers)` - Handle POST requests  
- `app.put(path, ...handlers)` - Handle PUT requests
- `app.delete(path, ...handlers)` - Handle DELETE requests
- `app.patch(path, ...handlers)` - Handle PATCH requests
- `app.options(path, ...handlers)` - Handle OPTIONS requests
- `app.head(path, ...handlers)` - Handle HEAD requests
- `app.use(path?, middleware)` - Add middleware or mount router

### Router Methods

- `Router()` - Create a new router instance
- `router.get(path, ...handlers)` - Add GET route to router
- `router.post(path, ...handlers)` - Add POST route to router
- `router.put(path, ...handlers)` - Add PUT route to router
- `router.delete(path, ...handlers)` - Add DELETE route to router
- `router.patch(path, ...handlers)` - Add PATCH route to router
- `router.options(path, ...handlers)` - Add OPTIONS route to router
- `router.head(path, ...handlers)` - Add HEAD route to router
- `router.use(middleware)` - Add middleware to router

### Route Patterns

- `/path` - Exact path match
- `/path/:param` - Parameter capture
- `/path/*` - Single wildcard (one segment)
- `/path/**` - Double wildcard (multiple segments)
- `/path/:param/*` - Combined parameter and wildcard
- `/path/:param/**` - Combined parameter and multi-wildcard

### Request Object

- `req.params` - Route parameters object
- `req.query` - Query string parameters
- `req.body` - Request body (parsed)
- `req.headers` - Request headers
- `req.method` - HTTP method
- `req.path` - Request path
- `req.url` - Full request URL

### Response Object

- `res.json(data)` - Send JSON response
- `res.send(data)` - Send response
- `res.status(code)` - Set status code
- `res.setHeader(name, value)` - Set response header
- `res.redirect(url)` - Redirect response
