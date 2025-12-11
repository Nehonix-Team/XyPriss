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

