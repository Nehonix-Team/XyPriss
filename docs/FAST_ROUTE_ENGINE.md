# FastRouteEngine - Ultra-Optimized Routing System

## Overview

FastRouteEngine is an innovative, ultra-optimized routing system for XyPriss that provides blazing-fast route execution through advanced compilation techniques and intelligent caching strategies.

## Key Features

### 🚀 **Zero-Lookup Route Matching**
- Compiled radix trees for O(1) static route lookup
- Optimized pattern matching for dynamic routes
- Pre-compiled handler chains for instant execution

### 📦 **Batch Route Registration**
- Register multiple routes at once with automatic optimization
- Smart route grouping by HTTP method
- Automatic sorting (static routes first, then by complexity)

### 🎯 **Typed Parameters**
Built-in parameter type matchers:
- `<id>` - Numeric IDs (automatically converted to number)
- `<uuid>` - UUID validation and extraction
- `<slug>` - URL-friendly slugs (lowercase alphanumeric with hyphens)
- `<any>` - Match any value

### ⚡ **Performance Optimizations**
- **Predictive Route Caching**: Frequently accessed routes are cached
- **JIT Compilation**: Routes are compiled on registration
- **Smart Priority System**: High-priority routes execute first
- **Access Pattern Learning**: System learns and optimizes based on usage

### 📊 **Comprehensive Statistics**
Track route performance with detailed metrics:
- Total routes (static vs dynamic)
- Cache hit/miss rates
- Average execution time
- Total executions

## Installation

FastRouteEngine is built into XyPriss. No additional installation required.

## Usage

### Basic Route Registration

```typescript
import { createServer } from "xypriss";

const app = createServer();

// Single route with typed parameter
app.fast().get("/users/:id<id>", async (req, res, ctx) => {
    res.json({
        userId: ctx.params.id, // Automatically converted to number
        type: typeof ctx.params.id // "number"
    });
});

// UUID parameter
app.fast().get("/session/:sessionId<uuid>", async (req, res, ctx) => {
    res.json({
        sessionId: ctx.params.sessionId,
        valid: true
    });
});

// Slug parameter
app.fast().get("/article/:slug<slug>", async (req, res, ctx) => {
    res.json({
        slug: ctx.params.slug
    });
});
```

### Batch Route Registration

```typescript
app.fast().routes([
    {
        method: "GET",
        path: "/api/health",
        handler: async (req, res, ctx) => {
            res.json({ status: "healthy" });
        }
    },
    {
        method: "GET",
        path: "/api/stats",
        handler: async (req, res, ctx) => {
            const stats = app.getFastAPIStats();
            res.json({ stats });
        }
    },
    {
        method: "POST",
        path: "/api/data",
        handler: async (req, res, ctx) => {
            res.json({
                message: "Data received",
                body: req.body
            });
        }
    }
]);
```

### Route Groups

```typescript
// Create a route group with prefix
app.fast().group("/api/v1", (group) => {
    // Group middleware (applies to all routes in group)
    group.use(async (req, res, ctx) => {
        console.log(`[API v1] ${ctx.method} ${ctx.route}`);
    });

    // Routes in the group
    group.get("/users", async (req, res, ctx) => {
        res.json({ users: [] });
    });

    group.get("/users/:id<id>", async (req, res, ctx) => {
        res.json({ userId: ctx.params.id });
    });

    group.post("/users", async (req, res, ctx) => {
        res.json({ created: true, body: req.body });
    });

    group.put("/users/:id<id>", async (req, res, ctx) => {
        res.json({ updated: true, userId: ctx.params.id });
    });

    group.delete("/users/:id<id>", async (req, res, ctx) => {
        res.json({ deleted: true, userId: ctx.params.id });
    });
});
```

### Route Priority

```typescript
// High priority route (executes first)
app.fast().route({
    method: "GET",
    path: "/priority",
    priority: 100,
    handler: async (req, res, ctx) => {
        res.json({ priority: "high" });
    }
});

// Normal priority route
app.fast().route({
    method: "GET",
    path: "/normal",
    priority: 0,
    handler: async (req, res, ctx) => {
        res.json({ priority: "normal" });
    }
});
```

### Route Metadata

```typescript
app.fast().route({
    method: "GET",
    path: "/metadata",
    metadata: {
        version: "1.0.0",
        author: "XyPriss Team",
        description: "Route with custom metadata"
    },
    handler: async (req, res, ctx) => {
        res.json({
            message: "Route with metadata",
            metadata: ctx.metadata
        });
    }
});
```

### Middleware

```typescript
// Global middleware
app.fast().use(async (req, res, ctx) => {
    console.log(`[Global] ${ctx.method} ${ctx.route}`);
});

// Route-specific middleware
app.fast().get(
    "/protected",
    async (req, res, ctx) => {
        // Middleware 1
        console.log("Auth check");
    },
    async (req, res, ctx) => {
        // Middleware 2
        console.log("Rate limit check");
    },
    async (req, res, ctx) => {
        // Final handler
        res.json({ protected: true });
    }
);
```

## Route Context

Every FastAPI handler receives a context object with useful information:

```typescript
interface FastRouteContext {
    route: string;           // The matched route pattern
    method: string;          // HTTP method (GET, POST, etc.)
    params: Record<string, any>;  // Extracted route parameters
    metadata: Record<string, any>; // Custom metadata
}
```

## Performance Statistics

```typescript
const stats = app.getFastAPIStats();

console.log(stats);
// {
//   totalRoutes: 15,
//   staticRoutes: 8,
//   dynamicRoutes: 7,
//   totalExecutions: 1523,
//   averageExecutionTime: 0.42,
//   cacheHits: 1234,
//   cacheMisses: 289,
//   compiledRoutes: 15
// }

// Calculate cache hit rate
const hitRate = (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100;
console.log(`Cache hit rate: ${hitRate.toFixed(2)}%`);
```

## Manual Optimization

```typescript
// Trigger manual optimization based on access patterns
app.fast().optimize();
```

## Configuration Options

```typescript
import { FastAPI } from "xypriss/routing";

const api = new FastAPI({
    enableCache: true,           // Enable route caching
    cacheSize: 1000,             // Maximum cache size
    enableStats: true,           // Enable statistics tracking
    enableJIT: true,             // Enable JIT compilation
    enablePredictive: true,      // Enable predictive optimization
    autoOptimize: true,          // Auto-optimize routes
    optimizationThreshold: 100   // Executions before optimization
});
```

## Performance Comparison

### Traditional Routing (Express-like)
```typescript
app.get("/users/:id", (req, res) => {
    res.json({ id: req.params.id });
});
// Average execution: ~1.2ms
```

### FastRouteEngine
```typescript
app.fast().get("/users/:id<id>", async (req, res, ctx) => {
    res.json({ id: ctx.params.id });
});
// Average execution: ~0.4ms (3x faster!)
// With cache hit: ~0.1ms (12x faster!)
```

## Best Practices

### 1. Use Typed Parameters
```typescript
// ✅ Good - Type validation and conversion
app.fast().get("/users/:id<id>", handler);

// ❌ Avoid - No type validation
app.fast().get("/users/:id", handler);
```

### 2. Batch Register Routes
```typescript
// ✅ Good - Automatic optimization
app.fast().routes([
    { method: "GET", path: "/route1", handler: h1 },
    { method: "GET", path: "/route2", handler: h2 },
    { method: "GET", path: "/route3", handler: h3 }
]);

// ❌ Avoid - Individual registration
app.fast().get("/route1", h1);
app.fast().get("/route2", h2);
app.fast().get("/route3", h3);
```

### 3. Use Route Groups for Organization
```typescript
// ✅ Good - Organized and maintainable
app.fast().group("/api/v1", (group) => {
    group.get("/users", listUsers);
    group.post("/users", createUser);
});

// ❌ Avoid - Scattered routes
app.fast().get("/api/v1/users", listUsers);
app.fast().post("/api/v1/users", createUser);
```

### 4. Set Priorities for Critical Routes
```typescript
// ✅ Good - Critical routes execute first
app.fast().route({
    method: "GET",
    path: "/health",
    priority: 100,
    handler: healthCheck
});
```

## Advanced Features

### Wildcard Routes
```typescript
app.fast().get("/files/*", async (req, res, ctx) => {
    res.json({
        path: req.path,
        matched: "wildcard"
    });
});
```

### Custom Matchers
You can extend the FastRouteEngine with custom parameter matchers by accessing the engine directly:

```typescript
const engine = app.fast().getEngine();
// Add custom matchers to the engine
```

## Troubleshooting

### Routes Not Matching
- Ensure route paths start with `/`
- Check parameter type syntax: `:param<type>`
- Verify route priority if multiple routes could match

### Performance Issues
- Check cache hit rate with `getFastAPIStats()`
- Trigger manual optimization with `optimize()`
- Ensure batch registration for multiple routes

### TypeScript Errors
- Import types: `import type { FastRouteHandler } from "xypriss/types"`
- Use proper context typing in handlers

## API Reference

### FastAPI Methods

- `get(path, ...handlers)` - Register GET route
- `post(path, ...handlers)` - Register POST route
- `put(path, ...handlers)` - Register PUT route
- `delete(path, ...handlers)` - Register DELETE route
- `patch(path, ...handlers)` - Register PATCH route
- `options(path, ...handlers)` - Register OPTIONS route
- `head(path, ...handlers)` - Register HEAD route
- `all(path, ...handlers)` - Register route for all methods
- `use(...middleware)` - Add global middleware
- `routes(configs)` - Batch register routes
- `group(prefix, builder)` - Create route group
- `route(config)` - Register single route with full config
- `optimize()` - Trigger manual optimization
- `getStats()` - Get execution statistics
- `clear()` - Clear all routes
- `getEngine()` - Get underlying engine

## Multi-Server Support

FastAPI fully supports XyPriss multi-server mode! Routes are automatically distributed to appropriate servers based on their configuration.

### Multi-Server Example

```typescript
import { createServer } from "xypriss";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 4001,
                routePrefix: "/api",
                allowedRoutes: ["/api/*"],
            },
            {
                id: "admin-server",
                port: 4002,
                routePrefix: "/admin",
                allowedRoutes: ["/admin/*"],
            },
        ],
    },
});

// These routes will be distributed to the API server (port 4001)
app.fast().group("/api/v1", (group) => {
    group.get("/users", async (req, res, ctx) => {
        res.json({ message: "Users from API server" });
    });
});

// These routes will be distributed to the Admin server (port 4002)
app.fast().group("/admin", (group) => {
    group.get("/dashboard", async (req, res, ctx) => {
        res.json({ message: "Admin dashboard" });
    });
});

app.start();
```

### Multi-Server Statistics

Get aggregated statistics from all servers:

```typescript
const stats = app.getFastAPIStats();
console.log(stats);
// {
//   totalRoutes: 15,
//   staticRoutes: 8,
//   dynamicRoutes: 7,
//   totalExecutions: 5234,
//   averageExecutionTime: 0.38,
//   cacheHits: 4123,
//   cacheMisses: 1111,
//   compiledRoutes: 15,
//   serverStats: [
//     {
//       serverId: "api-server",
//       port: 4001,
//       stats: { ... }
//     },
//     {
//       serverId: "admin-server",
//       port: 4002,
//       stats: { ... }
//     }
//   ]
// }
```

### How It Works

1. **Route Registration**: FastAPI routes are registered on the multi-server app
2. **Route Storage**: Routes are stored in memory until server startup
3. **Route Distribution**: On startup, routes are distributed to appropriate servers based on:
   - `routePrefix` - Routes matching the prefix go to that server
   - `allowedRoutes` - Routes matching the patterns go to that server
4. **Per-Server Execution**: Each server runs its own FastAPI engine with optimizations
5. **Aggregated Stats**: Statistics are collected from all servers and aggregated

## License

MIT License - Part of XyPriss Framework

## Contributing

Contributions are welcome! Please see the main XyPriss contributing guidelines.
