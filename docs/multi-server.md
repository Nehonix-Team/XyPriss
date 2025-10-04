# Multi-Server Configuration Guide

## Overview

XyPriss supports running multiple server instances with different configurations, ports, and route scopes from a single configuration. This feature is useful for microservices architectures, API versioning, or separating concerns like admin panels from public APIs.

## Basic Setup

```typescript
import { createServer } from 'xypriss';

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 3001,
                routePrefix: "/api/v1",
                allowedRoutes: ["/api/v1/*"]
            },
            {
                id: "admin-server",
                port: 3002,
                routePrefix: "/admin",
                allowedRoutes: ["/admin/*"]
            }
        ]
    }
});

// Start all servers (simple API)
await app.startAllServers();

// Get server information
const servers = app.getServers();
console.log(`Running ${servers.length} servers`);
```

## Configuration Options

### Multi-Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable multi-server mode |
| `servers` | `MultiServerConfig[]` | `[]` | Array of server configurations |

### Server Configuration

Each server in the `servers` array can have the following options:

| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` | Unique identifier for the server |
| `port` | `number` | Port number for this server |
| `host` | `string` | Host for this server (optional) |
| `routePrefix` | `string` | Route prefix this server handles |
| `allowedRoutes` | `string[]` | Array of allowed route patterns |

### Server-Specific Overrides

Each server can override base configuration:

| Option | Type | Description |
|--------|------|-------------|
| `server` | `object` | Server-specific settings |
| `security` | `SecurityConfig` | Security overrides |
| `performance` | `PerformanceConfig` | Performance overrides |
| `cache` | `CacheConfig` | Cache overrides |
| `fileUpload` | `FileUploadConfig` | File upload overrides |
| `logging` | `ComponentLogConfig` | Logging overrides |

## Route Filtering

### Route Prefix

```typescript
{
    id: "api-server",
    port: 3001,
    routePrefix: "/api/v1"
    // This server will only handle routes starting with /api/v1
}
```

### Allowed Routes

```typescript
{
    id: "admin-server",
    port: 3002,
    allowedRoutes: ["/admin/*", "/dashboard"]
    // This server handles /admin/* and /dashboard routes
}
```

### Wildcard Patterns

- `/*` - Matches any path at that level
- `/api/*` - Matches `/api/users`, `/api/posts`, etc.
- `/api/*/details` - Matches `/api/users/details`, `/api/posts/details`, etc.

## Complete Example

```typescript
const app = createServer({
    // Base configuration shared by all servers
    security: {
        enabled: true,
        level: "standard"
    },
    cache: {
        strategy: "memory",
        ttl: 300000
    },

    // Multi-server configuration
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "public-api",
                port: 3001,
                routePrefix: "/api/v1",
                allowedRoutes: ["/api/v1/*"],
                server: {
                    host: "0.0.0.0"
                },
                security: {
                    level: "standard"
                }
            },
            {
                id: "admin-panel",
                port: 3002,
                routePrefix: "/admin",
                allowedRoutes: ["/admin/*", "/dashboard"],
                security: {
                    level: "maximum"
                },
                cache: {
                    enabled: false // Disable caching for admin
                }
            },
            {
                id: "legacy-api",
                port: 3003,
                routePrefix: "/api/v0",
                allowedRoutes: ["/api/v0/*"],
                performance: {
                    optimizationEnabled: false // Legacy API doesn't need optimization
                }
            }
        ]
    }
});

// Start all servers (simple API)
await app.startAllServers();

// Get information about running servers
const servers = app.getServers();
servers.forEach(server => {
    console.log(`${server.id}: ${server.host}:${server.port}`);
});

// Get statistics
const stats = app.getStats();
console.log(`Total servers: ${stats.totalServers}`);
```

## API Reference

### MultiServerApp Interface

```typescript
interface MultiServerApp {
    // Route registration methods (same as UltraFastApp)
    get(path: string, ...handlers: RequestHandler[]): void;
    post(path: string, ...handlers: RequestHandler[]): void;
    // ... other HTTP methods

    // Simple server management API
    startAllServers(): Promise<void>;
    stopAllServers(): Promise<void>;

    // Server information
    getServers(): MultiServerInstance[];
    getServer(id: string): MultiServerInstance | undefined;
    getStats(): any;
}
```

### MultiServerInstance Interface

```typescript
interface MultiServerInstance {
    id: string;
    server: XyPrissServer;
    config: MultiServerConfig;
    port: number;
    host: string;
}
```

## Use Cases

### API Versioning

```typescript
multiServer: {
    enabled: true,
    servers: [
        {
            id: "api-v1",
            port: 3001,
            routePrefix: "/api/v1",
            allowedRoutes: ["/api/v1/*"]
        },
        {
            id: "api-v2",
            port: 3002,
            routePrefix: "/api/v2",
            allowedRoutes: ["/api/v2/*"]
        }
    ]
}
```

### Microservices Separation

```typescript
multiServer: {
    enabled: true,
    servers: [
        {
            id: "user-service",
            port: 3001,
            allowedRoutes: ["/users/*", "/auth/*"]
        },
        {
            id: "product-service",
            port: 3002,
            allowedRoutes: ["/products/*", "/categories/*"]
        },
        {
            id: "order-service",
            port: 3003,
            allowedRoutes: ["/orders/*", "/cart/*"]
        }
    ]
}
```

## Route Registration

In multi-server mode, routes are registered globally but filtered per server based on the `allowedRoutes` and `routePrefix` configuration. The filtering happens automatically - you don't need to register routes on individual servers.

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            { id: "api", port: 3001, routePrefix: "/api" },
            { id: "web", port: 3002, routePrefix: "/" }
        ]
    }
});

// Routes are registered globally
app.get("/api/users", handler);
app.get("/dashboard", handler);

// The /api/users route will only be available on the api server (port 3001)
// The /dashboard route will only be available on the web server (port 3002)
```

## Best Practices

1. **Use meaningful server IDs** for easy identification
2. **Group related routes** on the same server
3. **Configure appropriate security levels** for each server
4. **Monitor resource usage** of each server instance
5. **Use reverse proxy** in production for load balancing
6. **Implement health checks** for each server
7. **Log server-specific metrics** for monitoring
8. **Test route filtering** thoroughly before deployment