# XyPriss Plugin System - Developer Guide

## Table of Contents

-   [Overview](#overview)
-   [Why Plugins vs Middleware](#why-plugins-vs-middleware)
-   [How It Works](#how-it-works)
-   [Getting Started](#getting-started)
-   [Plugin Interface](#plugin-interface)
-   [Registration Methods](#registration-methods)
-   [Use Cases](#use-cases)
-   [Best Practices](#best-practices)
-   [Examples](#examples)
-   [API Reference](#api-reference)

---

## Overview

The XyPriss Plugin System provides a structured way to extend server functionality with reusable, composable modules. Plugins can hook into the server lifecycle, register routes, add middleware, and interact with other plugins through a dependency system.

### Key Features

-   **Lifecycle Hooks**: Execute code at specific server events (start, ready, stop)
-   **Route Registration**: Add custom endpoints programmatically
-   **Middleware Integration**: Inject middleware with priority control
-   **Dependency Management**: Automatic resolution of plugin dependencies
-   **Type Safety**: Full TypeScript support with proper type inference
-   **Imperative & Declarative**: Register plugins via config or API calls

---

## Why Plugins vs Middleware?

### When to Use Middleware

Use regular middleware when you need:

-   Simple request/response transformation
-   Single-purpose functionality (logging, CORS, body parsing)
-   No lifecycle management
-   No route registration
-   No dependencies on other components

```typescript
// Simple middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
```

### When to Use Plugins

Use plugins when you need:

-   **Lifecycle Management**: Initialize resources on server start, cleanup on stop
-   **Route Registration**: Add multiple related endpoints
-   **Complex Functionality**: Database connections, authentication systems, metrics collection
-   **Dependency Coordination**: Plugin A depends on Plugin B
-   **Reusability**: Package and share functionality across projects
-   **Configuration**: Complex setup with validation

```typescript
// Plugin with lifecycle and routes
{
  name: 'database',
  onServerStart: async () => await db.connect(),
  onServerStop: async () => await db.disconnect(),
  registerRoutes: (app) => {
    app.get('/db/health', (req, res) => res.json({ connected: db.isConnected() }));
  }
}
```

### Comparison Table

| Feature                   | Middleware | Plugin      |
| ------------------------- | ---------- | ----------- |
| Request/Response handling | ✅ Yes     | ✅ Yes      |
| Lifecycle hooks           | ❌ No      | ✅ Yes      |
| Route registration        | ❌ No      | ✅ Yes      |
| Dependency management     | ❌ No      | ✅ Yes      |
| Server extension          | ❌ No      | ✅ Yes      |
| Reusability               | ⚠️ Limited | ✅ High     |
| Configuration             | ⚠️ Manual  | ✅ Built-in |

---

## How It Works

### Plugin Lifecycle

```
1. Registration
   ↓
2. Validation (name, version check)
   ↓
3. onRegister() hook
   ↓
4. Dependency Resolution
   ↓
5. onServerStart() hook
   ↓
6. Route Registration
   ↓
7. Middleware Application
   ↓
8. onServerReady() hook
   ↓
   [Server Running]
   ↓
9. onServerStop() hook
```

### Plugin Manager

The `PluginManager` handles:

-   **Registration**: Stores plugins and validates metadata
-   **Dependency Resolution**: Topological sort to determine execution order
-   **Lifecycle Execution**: Calls hooks in the correct order
-   **Route Distribution**: Registers plugin routes on the app
-   **Middleware Application**: Applies middleware with priority (first/normal/last)

---

## Getting Started

### Basic Plugin

```typescript
import { createServer } from "xypriss";

const app = createServer({
    plugins: {
        register: [
            () => ({
                name: "hello-world",
                version: "1.0.0",
                description: "Simple greeting plugin",

                onServerStart: (server) => {
                    console.log("Hello from plugin!");
                },

                registerRoutes: (app) => {
                    app.get("/hello", (req, res) => {
                        res.json({ message: "Hello from plugin!" });
                    });
                },
            }),
        ],
    },
});

app.start();
```

### With Dependencies

```typescript
plugins: {
    register: [
        // Database plugin (loaded first)
        () => ({
            name: "database",
            version: "1.0.0",
            onServerStart: async (server) => {
                server.db = await connectDatabase();
            },
        }),

        // Auth plugin (depends on database)
        () => ({
            name: "auth",
            version: "1.0.0",
            dependencies: ["database"], // ← Loaded after database

            registerRoutes: (app) => {
                app.post("/login", async (req, res) => {
                    const user = await server.db.findUser(req.body.username);
                    // ... auth logic
                });
            },
        }),
    ];
}
```

---

## Plugin Interface

```typescript
interface XyPrissPlugin {
    // Required
    name: string;
    version: string;

    // Optional
    description?: string;
    dependencies?: string[];

    // Lifecycle Hooks
    onRegister?(server: XyPrissServer, config?: any): void | Promise<void>;
    onServerStart?(server: XyPrissServer): void | Promise<void>;
    onServerReady?(server: XyPrissServer): void | Promise<void>;
    onServerStop?(server: XyPrissServer): void | Promise<void>;

    // Request/Response Hooks
    onRequest?(
        req: Request,
        res: Response,
        next: NextFunction
    ): void | Promise<void>;
    onResponse?(req: Request, res: Response): void | Promise<void>;
    onError?(
        error: Error,
        req: Request,
        res: Response,
        next: NextFunction
    ): void | Promise<void>;

    // Route Registration
    registerRoutes?(app: UltraFastApp): void;

    // Middleware
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";
}
```

### Hook Descriptions

| Hook            | When Called           | Use For                                   | Notes                            |
| :-------------- | :-------------------- | :---------------------------------------- | :------------------------------- |
| `onRegister`    | Plugin is registered  | Early initialization, config validation   | Synchronous                      |
| `onServerStart` | Server is starting    | Connect to databases, initialize services | Async supported                  |
| `onServerReady` | Server is fully ready | Post-startup tasks, health checks         | Async supported                  |
| `onServerStop`  | Server is stopping    | Cleanup, close connections                | Async supported                  |
| `onRequest`     | Before each request   | Request logging, authentication           | Acts as middleware               |
| `onResponse`    | After each response   | Response logging, metrics                 | Requires manual event binding    |
| `onError`       | On request error      | Error logging, custom error handling      | **Manual registration required** |

---

## Registration Methods

### Method 1: Config-Based (Recommended)

```typescript
const app = createServer({
    plugins: {
        register: [myPlugin(), anotherPlugin({ config: "value" })],
    },
});
```

### Method 2: Imperative API

```typescript
import { Plugin } from "xypriss";

Plugin.register({
    name: "my-plugin",
    version: "1.0.0",
    onServerStart: () => console.log("Started!"),
});
```

### Method 3: Plugin Factory

```typescript
// Create reusable plugin
function createAuthPlugin(config: { secret: string }) {
    return {
        name: "auth",
        version: "1.0.0",
        onServerStart: (server) => {
            server.auth = new AuthService(config.secret);
        },
        registerRoutes: (app) => {
            app.post("/login", (req, res) => {
                // Use server.auth
            });
        },
    };
}

// Use it
plugins: {
    register: [createAuthPlugin({ secret: process.env.JWT_SECRET })];
}
```

---

## Use Cases

### 1. Database Connection Management

```typescript
function createDatabasePlugin(config: { url: string }) {
    let db: Database;

    return {
        name: "database",
        version: "1.0.0",

        onServerStart: async (server) => {
            db = await Database.connect(config.url);
            server.db = db;
            console.log("Database connected");
        },

        onServerStop: async () => {
            await db.disconnect();
            console.log("Database disconnected");
        },

        registerRoutes: (app) => {
            app.get("/db/health", (req, res) => {
                res.json({ connected: db.isConnected() });
            });
        },
    };
}
```

### 2. Authentication System

```typescript
function createAuthPlugin(config: { secret: string }) {
    return {
        name: "auth",
        version: "1.0.0",
        dependencies: ["database"],

        onRequest: (req, res, next) => {
            const token = req.headers.authorization?.split(" ")[1];
            if (!token && req.path.startsWith("/api/")) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            next();
        },

        registerRoutes: (app) => {
            app.post("/auth/login", async (req, res) => {
                const { username, password } = req.body;
                const token = await generateToken(
                    username,
                    password,
                    config.secret
                );
                res.json({ token });
            });

            app.post("/auth/logout", (req, res) => {
                // Logout logic
                res.json({ success: true });
            });
        },
    };
}
```

### 3. Metrics Collection

```typescript
function createMetricsPlugin() {
    const metrics = {
        requests: 0,
        errors: 0,
        responseTime: [] as number[],
    };

    return {
        name: "metrics",
        version: "1.0.0",

        onRequest: (req, res, next) => {
            const start = Date.now();
            metrics.requests++;

            res.on("finish", () => {
                const duration = Date.now() - start;
                metrics.responseTime.push(duration);

                if (res.statusCode >= 400) {
                    metrics.errors++;
                }
            });

            next();
        },

        registerRoutes: (app) => {
            app.get("/metrics", (req, res) => {
                const avgResponseTime =
                    metrics.responseTime.reduce((a, b) => a + b, 0) /
                    metrics.responseTime.length;

                res.json({
                    totalRequests: metrics.requests,
                    totalErrors: metrics.errors,
                    errorRate: (metrics.errors / metrics.requests) * 100,
                    avgResponseTime: avgResponseTime.toFixed(2),
                });
            });
        },
    };
}
```

### 4. Health Check System

```typescript
function createHealthCheckPlugin() {
    return {
        name: "health",
        version: "1.0.0",
        dependencies: ["database", "cache"],

        registerRoutes: (app) => {
            app.get("/health", async (req, res) => {
                const checks = {
                    server: "ok",
                    database: await checkDatabase(),
                    cache: await checkCache(),
                    memory:
                        process.memoryUsage().heapUsed < 500 * 1024 * 1024
                            ? "ok"
                            : "warning",
                };

                const allOk = Object.values(checks).every((v) => v === "ok");

                res.status(allOk ? 200 : 503).json({
                    status: allOk ? "healthy" : "degraded",
                    checks,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString(),
                });
            });
        },
    };
}
```

### 5. Request Logger

```typescript
function createLoggerPlugin() {
    return {
        name: "logger",
        version: "1.0.0",

        onRequest: (req, res, next) => {
            const start = Date.now();

            res.on("finish", () => {
                const duration = Date.now() - start;
                console.log(
                    `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`
                );
            });

            next();
        },
    };
}
```

---

## Best Practices

### 1. Use Descriptive Names

```typescript
// ❌ Bad
{ name: 'plugin1', version: '1.0.0' }

// ✅ Good
{ name: 'database-connection', version: '1.0.0' }
```

### 2. Follow Semantic Versioning

```typescript
{
  name: 'my-plugin',
  version: '1.2.3' // MAJOR.MINOR.PATCH
}
```

### 3. Handle Errors Gracefully

```typescript
{
    onServerStart: async (server) => {
        try {
            await connectDatabase();
        } catch (error) {
            console.error("Failed to connect to database:", error);
            // Don't throw - let server continue
        }
    };
}
```

### 4. Clean Up Resources

```typescript
{
  onServerStart: async (server) => {
    server.db = await Database.connect();
  },

  onServerStop: async (server) => {
    await server.db?.disconnect(); // Always cleanup
  }
}
```

### 5. Document Dependencies

```typescript
{
  name: 'auth',
  version: '1.0.0',
  description: 'Authentication plugin - requires database plugin',
  dependencies: ['database'] // Explicit dependencies
}
```

### 6. Use TypeScript

```typescript
import type { XyPrissPlugin } from "xypriss";

function createMyPlugin(): XyPrissPlugin {
    return {
        name: "my-plugin",
        version: "1.0.0",
        // Type-safe!
    };
}
```

---

## Examples

### Complete Example: Blog API Plugin

```typescript
import type { XyPrissPlugin } from "xypriss";

interface BlogPluginConfig {
    postsPerPage: number;
    enableComments: boolean;
}

function createBlogPlugin(config: BlogPluginConfig): XyPrissPlugin {
    const posts: any[] = [];

    return {
        name: "blog",
        version: "1.0.0",
        description: "Simple blog API",
        dependencies: ["database"],

        onServerStart: async (server) => {
            console.log("[Blog] Initializing blog plugin...");
            // Load posts from database
            const loadedPosts = await server.db.query("SELECT * FROM posts");
            posts.push(...loadedPosts);
        },

        registerRoutes: (app) => {
            // List posts
            app.get("/blog/posts", (req, res) => {
                const page = parseInt(req.query.page as string) || 1;
                const start = (page - 1) * config.postsPerPage;
                const end = start + config.postsPerPage;

                res.json({
                    posts: posts.slice(start, end),
                    page,
                    total: posts.length,
                    hasMore: end < posts.length,
                });
            });

            // Get single post
            app.get("/blog/posts/:id", (req, res) => {
                const post = posts.find((p) => p.id === req.params.id);
                if (!post) {
                    return res.status(404).json({ error: "Post not found" });
                }
                res.json(post);
            });

            // Create post
            app.post("/blog/posts", async (req, res) => {
                const newPost = {
                    id: Date.now().toString(),
                    ...req.body,
                    createdAt: new Date(),
                };

                posts.push(newPost);
                await server.db.insert("posts", newPost);

                res.status(201).json(newPost);
            });
        },
    };
}

// Usage
const app = createServer({
    plugins: {
        register: [
            createDatabasePlugin({ url: "postgresql://..." }),
            createBlogPlugin({ postsPerPage: 10, enableComments: true }),
        ],
    },
});
```

---

## API Reference

### Plugin Interface

See [Plugin Interface](#plugin-interface) section above.

### Plugin API

```typescript
import { Plugin } from "xypriss";

// Register a plugin
Plugin.register(pluginInstance, config);

// Get a plugin by name
const plugin = Plugin.get("plugin-name");

// Create a plugin (helper)
const myPlugin = Plugin.create({
    name: "my-plugin",
    version: "1.0.0",
});

// Create a plugin factory
const createMyPlugin = Plugin.factory((config) => ({
    name: "my-plugin",
    version: "1.0.0",
}));
```

### Server Extensions

Plugins can extend the server object:

```typescript
{
    onServerStart: (server) => {
        server.myCustomProperty = "value";
        server.myCustomMethod = () => "result";
    };
}
```

---

## Troubleshooting

### Circular Dependencies

```
Error: Circular dependency detected: plugin-a
```

**Solution**: Check your `dependencies` array. Plugin A cannot depend on Plugin B if Plugin B depends on Plugin A.

### Plugin Not Found

```
Error: Plugin 'plugin-a' depends on 'plugin-b' which is not registered
```

**Solution**: Ensure all dependencies are registered before the dependent plugin.

### Duplicate Plugin

```
Warning: Plugin 'my-plugin' already registered, skipping
```

**Solution**: Each plugin name must be unique. Change the name or remove the duplicate.

---

## Next Steps

-   Explore [built-in network plugins](./NETWORK_CONFIG_GUIDE.md)
-   Learn about [middleware](./middleware.md)
-   Check out [plugin examples](../examples/plugins/)

