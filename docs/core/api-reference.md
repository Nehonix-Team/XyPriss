s# XyPriss API Reference

API documentation for XyPriss framework.

## Table of Contents

-   [createServer Function](#createserver-function)
-   [ServerOptions Interface](#serveroptions-interface)
-   [XyPriss Server Methods](#xypriss-server-methods)
-   [Cache Configuration](#cache-configuration)
-   [Request Management](#request-management)
-   [Cluster Configuration](#cluster-configuration)
-   [Security Integration](#security-integration)
-   [Meta Configuration](#meta-configuration)
-   [Core Hooks](#core-hooks)

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
server.start(port, callback);
server.start(port, host, callback);
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

## Request and Response Objects

XyPriss enhances the standard Node.js `IncomingMessage` and `ServerResponse` with a robust, Express-compatible API.

### `XyPrisRequest` (req)

-   **`req.app`**: A proxy to the main application instance. Supports `get()` and `set()`.
-   **`req.path`**: The parsed URL pathname.
-   **`req.method`**: The HTTP method (GET, POST, etc.).
-   **`req.query`**: Object containing URL query parameters.
-   **`req.params`**: Object containing route parameters.
-   **`req.body`**: The parsed request body.
-   **`req.cookies`**: Object containing parsed cookies.
-   **`req.ip` / `req.ips`**: Client IP address and proxy chain (requires Trust Proxy configuration).
-   **`req.get(headerName)`**: Case-insensitive retrieval of request headers.
-   **`req.xhr`**: Boolean indicating if the request is an `XMLHttpRequest`.

### `XyPrisResponse` (res)

-   **`res.send(data)`**: Sends a response. Automatically handles objects (as JSON), strings, and buffers.
-   **`res.json(data)`**: Sends a JSON response. Includes safe serialization for `BigInt` and `Error` objects.
-   **`res.status(code)`**: Sets the HTTP status code. Chainable.
-   **`res.set(name, value)` / `res.set(headers)`**: Sets one or more response headers. Chainable.
-   **`res.cookie(name, value, options)`**: Sets a cookie with support for `maxAge`, `expires`, `httpOnly`, `secure`, `sameSite`, `path`, and `domain`.
-   **`res.clearCookie(name, options)`**: Clears a cookie by setting its expiration to the past.
-   **`res.redirect([status], url)`**: Redirects to the specified URL with an optional status code (default: 302).
-   **`res.locals`**: An object for storing request-scoped data, accessible to all middlewares and handlers.

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
} from "xypriss-security"; // ise the XyPrissSecurity module instead

const server = createServer({
    server: { port: 3000 },
});

// Use secure data structures
server.post("/api/secure", async (req, res) => {
    const secureData = fArray(req.body.data);
    const token = generateSecureToken({
        length: 32,
        entropy: "maximum",
    });

    res.json({ token, success: true });
});
```

### Available Security Exports

From `xypriss-security`:

````typescript
// Main security class
import { XyPrissSecurity } from "xypriss-security";

// Secure data structures
import { fArray, fString, fObject } from "xypriss-security";

// Utility functions
import {
    generateSecureToken,
    Hash,
    SecureRandom,
    Validators, // install Fortify Schema instead (```bash npm i fortify-schema```)
} from "xypriss-security";

// Advanced features
import { TamperEvidentLogger } from "xypriss-security";
````

## Meta Configuration

Programmatic initialization mechanism that executes before standard configuration.

-   **Discovery**: Searches for `+xypriss.meta.ts` or `+xypriss.meta.js` in root or hidden directories.
-   **Execution**: Supports top-level code (IIFE) and an exported `run()` function.
-   **Timing**: Executes during `configLoader.loadAndApplySysConfig()`.

For more details, see the **[Meta Configuration Guide](./META_CONFIG.md)**.

## Core Hooks

XyPriss provides a powerful hook system that allows plugins to intercept critical events.

Available hooks include:

-   `onSecurityAttack`: Triggered when a security threat is blocked.
-   `onResponseTime`: Triggered after every request with performance data.
-   `onRouteError`: Triggered when an unhandled error occurs.
-   `onRateLimit`: Triggered when a client hits a rate limit.

### Plugin Data Masking

For security reasons, XyPriss automatically masks sensitive request data in plugin hooks to prevent unauthorized interception.

**Masked Fields:**

-   `req.body`
-   `req.query`
-   `req.cookies`
-   `req.params`

When accessed within a plugin hook, these fields return a security warning string instead of the actual data. This ensures that sensitive user information is only processed by the core application logic.

For more details, see the **[Plugin Data Masking Guide](./PLUGIN_DATA_MASKING.md)**.

For detailed documentation and examples, see the **[Core Hooks Guide](./CORE_HOOKS.md)**.

---

**Next**: [Getting Started Guide](./getting-started.md)
**Previous**: [Main Documentation](../README.md)

