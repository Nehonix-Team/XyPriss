# XyPriss Multi-Server Guide

Run multiple server instances with different configurations from a single setup. Perfect for microservices, API versioning, or separating concerns.

## Overview

Multi-Server mode allows you to:

-   Run multiple HTTP servers on different ports
-   Apply different configurations to each server
-   Route requests to specific servers based on path patterns
-   Isolate services for better security and performance

## Basic Multi-Server Setup

```typescript
import { createServer } from "xypriss";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 3001,
                routePrefix: "/api",
                allowedRoutes: ["/api/*"],
            },
            {
                id: "admin-server",
                port: 3002,
                routePrefix: "/admin",
                allowedRoutes: ["/admin/*"],
                security: { level: "maximum" },
            },
        ],
    },
});

// Routes are automatically distributed to appropriate servers
app.get("/api/users", (req, res) => res.json({ service: "api" }));
app.get("/admin/dashboard", (req, res) => res.json({ service: "admin" }));

// Start all servers with a simple API
await app.startAllServers();
```

## Server Configuration Options

Each server in the `servers` array can have:

```typescript
interface MultiServerConfig {
    id: string; // Unique identifier
    port: number; // Port number
    host?: string; // Host (default: localhost)
    routePrefix?: string; // Route prefix for this server
    allowedRoutes?: string[]; // Route patterns to include

    // Server-specific overrides
    server?: {
        autoPortSwitch?: boolean;
        trustProxy?: boolean;
    };

    security?: {
        level?: "basic" | "enhanced" | "maximum";
        cors?: object;
        rateLimit?: object;
    };

    cache?: {
        strategy?: "memory" | "redis";
        maxSize?: number;
    };

    performance?: {
        clustering?: boolean;
    };

    fileUpload?: {
        enabled?: boolean;
        maxFileSize?: number;
    };

    responseControl?: {
        enabled?: boolean;
        statusCode?: number;
        content?: string | object;
        contentType?: string;
        headers?: Record<string, string>;
        handler?: (req: Request, res: Response) => void | Promise<void>;
    };
}
```

## Use Cases

### 1. API Versioning

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-v1",
                port: 3001,
                routePrefix: "/api/v1",
                allowedRoutes: ["/api/v1/*"],
            },
            {
                id: "api-v2",
                port: 3002,
                routePrefix: "/api/v2",
                allowedRoutes: ["/api/v2/*"],
            },
        ],
    },
});

app.get("/api/v1/users", (req, res) => {
    res.json({ version: "v1", users: [] });
});

app.get("/api/v2/users", (req, res) => {
    res.json({ version: "v2", users: [], metadata: {} });
});
```

### 2. Microservices Architecture

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "auth-service",
                port: 3001,
                allowedRoutes: ["/auth/*"],
                security: { level: "maximum" },
            },
            {
                id: "user-service",
                port: 3002,
                allowedRoutes: ["/users/*"],
            },
            {
                id: "payment-service",
                port: 3003,
                allowedRoutes: ["/payments/*"],
                security: { level: "maximum" },
            },
        ],
    },
});
```

### 3. Public vs Admin Separation

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "public",
                port: 3000,
                allowedRoutes: ["/", "/api/*", "/public/*"],
                security: { level: "enhanced" },
            },
            {
                id: "admin",
                port: 3001,
                allowedRoutes: ["/admin/*"],
                security: {
                    level: "maximum",
                    rateLimit: { max: 50, windowMs: 15 * 60 * 1000 },
                },
            },
        ],
    },
});
```

## Managing Servers

### Start All Servers

```typescript
await app.startAllServers();
console.log("All servers started successfully");
```

### Stop All Servers

```typescript
await app.stopAllServers();
console.log("All servers stopped");
```

### Get Server Information

```typescript
const servers = app.getServerInfo();
servers.forEach((server) => {
    console.log(`${server.id}: http://${server.host}:${server.port}`);
});
```

## Route Distribution

Routes are automatically distributed based on:

1. **Route Prefix**: Routes matching the prefix are sent to that server
2. **Allowed Routes**: Only routes matching patterns are included
3. **Wildcard Matching**: Supports `*` and `**` patterns

```typescript
{
    allowedRoutes: [
        "/api/*", // Matches /api/users, /api/posts
        "/api/v1/**", // Matches /api/v1/users/123/posts
        "/exact", // Exact match only
    ];
}
```

## Server-Specific Middleware

Apply middleware to specific servers:

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            { id: "api", port: 3001, routePrefix: "/api" },
            { id: "admin", port: 3002, routePrefix: "/admin" },
        ],
    },
});

// This middleware only runs on the admin server
app.use("/admin", (req, res, next) => {
    console.log("Admin server middleware");
    next();
});
```

## Custom Response Control

Configure custom responses for when routes don't match on each server individually:

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "public-server",
                port: 3000,
                routePrefix: "/public",
                responseControl: {
                    enabled: true,
                    statusCode: 404,
                    content: "Custom 404: Public resource not found",
                    contentType: "text/plain",
                    headers: { "X-Server": "public" },
                },
            },
            {
                id: "api-server",
                port: 3001,
                routePrefix: "/api",
                responseControl: {
                    enabled: true,
                    statusCode: 404,
                    content: {
                        error: "API endpoint not found",
                        path: "/api/test",
                    },
                    contentType: "application/json",
                    headers: { "X-Server": "api" },
                },
            },
            {
                id: "admin-server",
                port: 3002,
                routePrefix: "/admin",
                responseControl: {
                    enabled: true,
                    statusCode: 403,
                    content: "Access denied to admin area",
                    contentType: "text/plain",
                    headers: { "X-Server": "admin" },
                    handler: (req, res) => {
                        // Custom handler function
                        res.status(403).json({
                            error: "Forbidden",
                            message: "Admin access required",
                            path: req.path,
                        });
                    },
                },
            },
        ],
    },
});

// Register routes
app.get("/public/home", (req, res) => res.send("Welcome to public area"));
app.get("/api/users", (req, res) => res.json({ users: [] }));
app.get("/admin/dashboard", (req, res) => res.send("Admin Dashboard"));

await app.startAllServers();
```

### Response Control Configuration Options

Each server can have its own response control configuration:

-   **`enabled`**: Enable/disable custom response control (default: `false`)
-   **`statusCode`**: HTTP status code to send (default: `404`)
-   **`content`**: Response content (string or object)
-   **`contentType`**: Content-Type header (default: `"text/plain"`)
-   **`headers`**: Custom headers to set
-   **`handler`**: Custom response handler function

### Using Custom Handler Function

For complex response logic, use a custom handler:

```typescript
{
    id: "api-server",
    port: 3001,
    routePrefix: "/api",
    responseControl: {
        enabled: true,
        handler: async (req, res) => {
            // Custom logic based on request
            if (req.path.startsWith("/api/v1")) {
                res.status(410).json({
                    error: "Gone",
                    message: "API v1 is no longer supported",
                    upgradeTo: "/api/v2"
                });
            } else {
                res.status(404).json({
                    error: "Not Found",
                    message: "API endpoint does not exist",
                    path: req.path
                });
            }
        }
    }
}
```

### Minimal Configuration

For simple custom responses:

```typescript
{
    id: "api-server",
    port: 3001,
    routePrefix: "/api",
    responseControl: {
        enabled: true,
        content: "API endpoint not found"
    }
}
```

### Disabling Custom Response Control

To use default 404 behavior:

```typescript
{
    id: "simple-server",
    port: 3000,
    responseControl: {
        enabled: false
    }
}
```

## Load Balancing

Use a reverse proxy (nginx, HAProxy) for load balancing:

```nginx
upstream api_servers {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    listen 80;

    location /api {
        proxy_pass http://api_servers;
    }
}
```

## Performance Considerations

1. **Port Range**: Use sequential ports for easier management
2. **Resource Allocation**: Each server uses separate resources
3. **Clustering**: Can be combined with clustering for each server
4. **Monitoring**: Monitor each server independently

## Best Practices

1. **Use clear naming** for server IDs
2. **Separate concerns** logically (auth, api, admin)
3. **Apply appropriate security** levels per server
4. **Monitor all servers** independently
5. **Use reverse proxy** for production load balancing
6. **Document port assignments** clearly
7. **Test failover scenarios**

## Troubleshooting

### Port Already in Use

Enable auto port switching:

```typescript
{
    id: "api",
    port: 3001,
    server: {
        autoPortSwitch: {
            enabled: true,
            portRange: [3001, 3010]
        }
    }
}
```

### Routes Not Distributing

Check your `allowedRoutes` patterns:

```typescript
// ❌ Too restrictive
allowedRoutes: ["/api/users"];

// ✅ Better
allowedRoutes: ["/api/*"];
```

### Server Not Starting

Check logs for port conflicts or configuration errors:

```typescript
const app = createServer({
    logging: {
        enabled: true,
        level: "debug",
    },
    multiServer: {
        /* ... */
    },
});
```

---

[← Back to Main Documentation](../README.md)

