# XyPriss API Reference

This document provides a comprehensive reference for the XyPriss API.

## Table of Contents

-   [createServer Function](#createserver-function)
-   [XyPriss Server (Enhanced Express)](#xypriss-server-enhanced-express)
-   [CacheEngine](#cacheengine)
-   [ClusterManager](#clustermanager)
-   [Security Middleware](#security-middleware)
-   [Plugin System](#plugin-system)
-   [Types and Interfaces](#types-and-interfaces)

## createServer Function

The `createServer` function is the primary entry point for creating XyPriss servers (enhanced ExpressJS).

### `createServer(config?: XyPrissConfig)`

Creates a new XyPriss server instance with enhanced ExpressJS functionality.

**Parameters:**

-   `config` (optional): Server configuration object

**Returns:** Enhanced Express server instance with XyPriss features

**Example:**

```typescript
import { createServer } from "xypriss";

const server = createServer({
    port: 3000,
    security: { enabled: true },
    cache: { type: "memory", maxSize: 100 },
});
```

### XyPrissConfig Interface

```typescript
interface XyPrissConfig {
    port?: number;
    host?: string;
    security?: SecurityConfig;
    cache?: CacheConfig;
    cluster?: ClusterConfig;
    performance?: PerformanceConfig;
    plugins?: PluginConfig[];
}
```

## XyPriss Server (Enhanced Express)

The XyPriss server is an enhanced Express.js application with additional security, caching, and performance features.

### Usage

```typescript
import { createServer } from 'xypriss';

const server = createServer(config?: XyPrissConfig);
```

### Methods

#### `get(path: string, handler: RequestHandler)`

Registers a GET route.

**Parameters:**

-   `path`: Route path (supports parameters like `/users/:id`)
-   `handler`: Request handler function

**Example:**

```typescript
server.get("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({ userId });
});
```

#### `post(path: string, handler: RequestHandler)`

Registers a POST route.

#### `put(path: string, handler: RequestHandler)`

Registers a PUT route.

#### `delete(path: string, handler: RequestHandler)`

Registers a DELETE route.

#### `use(middleware: MiddlewareFunction)`

Adds middleware to the application.

**Example:**

```typescript
server.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
```

#### `listen(callback?: () => void)`

Starts the server.

**Example:**

```typescript
server.listen(() => {
    console.log("Server running on port 3000");
});
```

## CacheEngine

Advanced caching system with multiple backend support.

### `new CacheEngine(config: CacheConfig)`

Creates a new cache engine instance.

### Methods

#### `get<T>(key: string): Promise<T | null>`

Retrieves a value from cache.

#### `set<T>(key: string, value: T, ttl?: number): Promise<void>`

Stores a value in cache.

#### `delete(key: string): Promise<boolean>`

Removes a value from cache.

#### `clear(): Promise<void>`

Clears all cache entries.

#### `getStats(): CacheStats`

Returns cache statistics.

### CacheConfig Interface

```typescript
interface CacheConfig {
    type: "memory" | "redis" | "file";
    maxSize?: number; // MB
    ttl?: number; // seconds
    redis?: RedisConfig;
    memory?: MemoryConfig;
    file?: FileConfig;
}
```

## ClusterManager

Manages multiple worker processes for scalability.

### `new ClusterManager(config: ClusterConfig)`

### Methods

#### `start(): Promise<void>`

Starts the cluster with configured workers.

#### `stop(): Promise<void>`

Gracefully stops all workers.

#### `scale(workerCount: number): Promise<void>`

Scales the cluster to the specified number of workers.

#### `getMetrics(): ClusterMetrics`

Returns cluster performance metrics.

### ClusterConfig Interface

```typescript
interface ClusterConfig {
    enabled: boolean;
    workers: number | "auto";
    autoScale?: {
        enabled: boolean;
        minWorkers: number;
        maxWorkers: number;
        cpuThreshold: number;
    };
}
```

## Security Middleware

Built-in security features and middleware.

### Security Configuration

```typescript
interface SecurityConfig {
    enabled: boolean;
    helmet?: boolean | HelmetOptions;
    cors?: CorsOptions;
    rateLimit?: RateLimitOptions;
    csrf?: boolean | CsrfOptions;
    customHeaders?: Record<string, string>;
}
```

### Rate Limiting

```typescript
interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
```

### CORS Configuration

```typescript
interface CorsOptions {
    origin: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
}
```

## Plugin System

Extensible plugin architecture for custom functionality.

### Creating a Plugin

```typescript
import { Plugin, PluginContext } from "xypriss";

class MyPlugin implements Plugin {
    name = "my-plugin";
    version = "1.0.0";

    async initialize(context: PluginContext): Promise<void> {
        // Plugin initialization logic
    }

    async execute(context: PluginContext): Promise<any> {
        // Plugin execution logic
    }

    async cleanup(): Promise<void> {
        // Plugin cleanup logic
    }
}
```

### Plugin Interface

```typescript
interface Plugin {
    name: string;
    version: string;
    dependencies?: string[];
    initialize(context: PluginContext): Promise<void>;
    execute(context: PluginContext): Promise<any>;
    cleanup?(): Promise<void>;
}
```

## Types and Interfaces

### RequestHandler

```typescript
type RequestHandler = (
    req: XyPrissRequest,
    res: XyPrissResponse,
    next?: NextFunction
) => void | Promise<void>;
```

### XyPrissRequest

```typescript
interface XyPrissRequest extends IncomingMessage {
    params: Record<string, string>;
    query: Record<string, string | string[]>;
    body: any;
    headers: IncomingHttpHeaders;
    method: string;
    url: string;
}
```

### XyPrissResponse

```typescript
interface XyPrissResponse extends ServerResponse {
    json(data: any): void;
    status(code: number): XyPrissResponse;
    send(data: string | Buffer): void;
    header(name: string, value: string): XyPrissResponse;
}
```

### MiddlewareFunction

```typescript
type MiddlewareFunction = (
    req: XyPrissRequest,
    res: XyPrissResponse,
    next: NextFunction
) => void | Promise<void>;
```

### NextFunction

```typescript
type NextFunction = (error?: Error) => void;
```

## Error Handling

### Custom Error Classes

```typescript
class XyPrissError extends Error {
    statusCode: number;
    code: string;

    constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}
```

### Error Handler Middleware

```typescript
type ErrorHandler = (
    error: Error,
    req: XyPrissRequest,
    res: XyPrissResponse,
    next: NextFunction
) => void;
```

## Performance Monitoring

### Performance Metrics

```typescript
interface PerformanceMetrics {
    requestCount: number;
    averageResponseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
}
```

### Getting Metrics

```typescript
import { PerformanceMonitor } from "xypriss";

const metrics = PerformanceMonitor.getMetrics();
console.log("Average response time:", metrics.averageResponseTime);
```

---

**Next**: [Security Guide](./security.md)

