# XyPriss API Reference

API documentation for XyPriss framework.

## Table of Contents

-   [createServer Function](#createserver-function)
-   [ServerOptions Interface](#serveroptions-interface)
-   [XyPriss Server Methods](#xypriss-server-methods)
-   [Cache Configuration](#cache-configuration)
-   [Request Management](#request-management)
-   [Cluster Configuration](#cluster-configuration)
-   [Security Integration](#security-integration)

## createServer Function

The `createServer` function is the primary entry point for creating XyPriss servers.

### `createServer(options?: ServerOptions)`

Creates a new XyPriss server instance with enhanced Express.js functionality.

**Parameters:**

-   `options` (optional): Server configuration object

**Returns:** Enhanced Express server instance with XyPriss features

**Example:**

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
        autoPortSwitch: {
            enabled: true,
            portRange: [8086, 3010],
        },
    },
    cache: {
        strategy: "memory",
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600, // 1 hour
    },
});
```

## ServerOptions Interface

The main configuration interface for XyPriss servers.

```typescript
interface ServerOptions {
    env?: "development" | "production" | "test";

    server?: {
        port?: number;
        host?: string;
        autoPortSwitch?: {
            enabled?: boolean;
            maxAttempts?: number;
            portRange?: [number, number];
            strategy?: "increment" | "random" | "predefined";
        };
    };

    cache?: {
        strategy?: "auto" | "memory" | "redis" | "hybrid";
        maxSize?: number;
        ttl?: number;
        redis?: {
            host?: string;
            port?: number;
            cluster?: boolean;
            nodes?: Array<{ host: string; port: number }>;
        };
    };

    requestManagement?: {
        timeout?: {
            enabled?: boolean;
            defaultTimeout?: number;
            routes?: Record<string, number>;
        };
        concurrency?: {
            maxConcurrentRequests?: number;
            maxPerIP?: number;
        };
    };

    cluster?: {
        enabled?: boolean;
        workers?: number | "auto";
        autoScale?: {
            enabled?: boolean;
            minWorkers?: number;
            maxWorkers?: number;
            cpuThreshold?: number;
        };
    };
}
```

## XyPriss Server Methods

The XyPriss server extends Express.js with additional methods and maintains full compatibility.

### Standard Express Methods

All standard Express.js methods are available:

```typescript
// HTTP Methods
server.get(path, handler);
server.post(path, handler);
server.put(path, handler);
server.delete(path, handler);
server.patch(path, handler);
server.head(path, handler);
server.options(path, handler);

// Middleware
server.use(middleware);
server.use(path, middleware);

// Server Control
server.listen(port, callback);
server.listen(port, host, callback);
```

### Enhanced XyPriss Methods

Additional methods provided by XyPriss:

#### `server.getCache()`

Returns the cache engine instance.

```typescript
const cache = server.getCache();
await cache.set("key", "value", 3600);
const value = await cache.get("key");
```

#### `server.getMetrics()`

Returns performance metrics.

```typescript
const metrics = server.getMetrics();
console.log(metrics.requestCount, metrics.averageResponseTime);
```

## Cache Configuration

XyPriss provides multiple caching strategies:

### Memory Cache

```typescript
const server = createServer({
    cache: {
        strategy: "memory",
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600, // 1 hour default TTL
    },
});
```

### Redis Cache

```typescript
const server = createServer({
    cache: {
        strategy: "redis",
        redis: {
            host: "localhost",
            port: 6379,
            cluster: false,
        },
        ttl: 7200, // 2 hours
    },
});
```

### Hybrid Cache (Memory + Redis)

```typescript
const server = createServer({
    cache: {
        strategy: "hybrid",
        maxSize: 50 * 1024 * 1024, // 50MB memory
        redis: {
            host: "localhost",
            port: 6379,
        },
        ttl: 3600,
    },
});
```

### Redis Cluster

```typescript
const server = createServer({
    cache: {
        strategy: "redis",
        redis: {
            cluster: true,
            nodes: [
                { host: "redis-1", port: 6379 },
                { host: "redis-2", port: 6379 },
                { host: "redis-3", port: 6379 },
            ],
        },
    },
});
```

## Request Management

Advanced request handling and timeout management:

```typescript
const server = createServer({
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 30000, // 30 seconds default
            routes: {
                "/api/upload": 300000, // 5 minutes for uploads
                "/api/quick": 5000, // 5 seconds for quick endpoints
                "/api/stream": 0, // No timeout for streaming
            },
        },
        concurrency: {
            maxConcurrentRequests: 1000, // Global limit
            maxPerIP: 50, // Per-IP limit
        },
        networkQuality: {
            enabled: true,
            adaptiveTimeout: true,
            qualityThresholds: {
                excellent: 100, // < 100ms
                good: 500, // < 500ms
                poor: 2000, // < 2000ms
            },
        },
    },
});
```

## Cluster Configuration

Built-in clustering with auto-scaling:

```typescript
const server = createServer({
    cluster: {
        enabled: true,
        workers: "auto", // Auto-detect CPU cores
        autoScale: {
            enabled: true,
            minWorkers: 2,
            maxWorkers: 8,
            cpuThreshold: 80, // Scale up at 80% CPU
            memoryThreshold: 85, // Scale up at 85% memory
            scaleInterval: 30000, // Check every 30 seconds
        },
        gracefulShutdown: {
            enabled: true,
            timeout: 10000, // 10 seconds to finish requests
        },
    },
});
```

## Security Integration

XyPriss integrates seamlessly with XyPriss Security:

```typescript
import { createServer } from "xypriss";
import {
    XyPrissSecurity,
    fArray,
    fString,
    fObject,
    generateSecureToken,
} from "xypriss-security";

const server = createServer({
    server: { port: 3000 },
});

// Initialize security
const security = new XyPrissSecurity();

// Use secure data structures
server.post("/api/secure", async (req, res) => {
    const secureData = fArray(req.body.data);
    const token = generateSecureToken(32, "base64url");

    res.json({ token, success: true });
});
```

### Available Security Exports

From `xypriss-security`:

```typescript
// Main security class
import { XyPrissSecurity } from "xypriss-security";

// Secure data structures
import { fArray, fString, fObject } from "xypriss-security";

// Utility functions
import {
    generateSecureToken,
    Hash,
    SecureRandom,
    Validators,
} from "xypriss-security";

// Advanced features
import {
    PostQuantum,
    TamperEvidentLogger,
    SideChannelProtection,
} from "xypriss-security";
```

---

**Next**: [Getting Started Guide](./getting-started.md)
**Previous**: [Main Documentation](../README.md)

