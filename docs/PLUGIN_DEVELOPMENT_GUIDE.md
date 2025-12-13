# XyPriss Plugin Development Guide

**Version**: 1.0.0  
**Last Updated**: December 12, 2025  
**Target**: XyPriss v4.2.0+

## Table of Contents

1. [Introduction](#introduction)
2. [Plugin Architecture](#plugin-architecture)
3. [Getting Started](#getting-started)
4. [Plugin API Reference](#plugin-api-reference)
5. [Lifecycle Hooks](#lifecycle-hooks)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)
8. [Publishing Plugins](#publishing-plugins)
9. [Examples](#examples)

---

## Introduction

The XyPriss Plugin System provides a powerful and flexible way to extend server functionality. Plugins can intercept requests, add routes, modify responses, handle errors, and integrate deeply with the server lifecycle.

### Key Features

-   **Lifecycle Hooks**: Integrate at every stage of server operation
-   **Imperative API**: Register plugins programmatically with `Plugin.exec()`
-   **Declarative API**: Configure plugins via server options
-   **Dependency Resolution**: Automatic handling of plugin dependencies
-   **Type Safety**: Full TypeScript support with comprehensive type definitions
-   **Performance**: Minimal overhead with intelligent middleware ordering

### Use Cases

-   Authentication and authorization systems
-   Request/response logging and monitoring
-   Rate limiting and throttling
-   Custom caching strategies
-   API versioning
-   Error tracking and reporting
-   Performance profiling
-   Process management (e.g., Prydam)

---

## Plugin Architecture

### Plugin Structure

A XyPriss plugin is a TypeScript/JavaScript object that implements the `XyPrissPlugin` interface:

```typescript
interface XyPrissPlugin {
    // Required metadata
    name: string;
    version: string;

    // Optional metadata
    description?: string;
    author?: string;
    dependencies?: string[];

    // Lifecycle hooks
    onServerStart?: (server: UltraFastApp) => void | Promise<void>;
    onServerReady?: (server: UltraFastApp) => void | Promise<void>;
    onServerStop?: (server: UltraFastApp) => void | Promise<void>;

    // Request/Response hooks
    onRequest?: (req: Request, res: Response, next: NextFunction) => void;
    onResponse?: (req: Request, res: Response) => void;
    onError?: (
        error: Error,
        req: Request,
        res: Response,
        next: NextFunction
    ) => void;

    // Route registration
    registerRoutes?: (app: UltraFastApp) => void;

    // Middleware
    middleware?: RequestHandler | RequestHandler[];
    middlewarePriority?: "first" | "normal" | "last";
}
```

### Plugin Lifecycle

```
1. Plugin Registration
   └─> Plugin.create() or Plugin.register()

2. Server Creation
   └─> createServer()

3. Plugin Initialization
   └─> Dependency resolution
   └─> onServerStart() [BLOCKING]

4. Route Registration
   └─> registerRoutes()

5. Middleware Application
   └─> middleware / onRequest / onResponse

6. Server Start
   └─> app.start()
   └─> onServerReady()

7. Request Handling
   └─> onRequest -> Route Handler -> onResponse
   └─> onError (if error occurs)

8. Server Shutdown
   └─> onServerStop()
```

---

## Getting Started

### Creating Your First Plugin

#### Step 1: Install Dependencies

```bash
npm install xypriss
# or
bun add xypriss
```

#### Step 2: Create Plugin File

```typescript
// plugins/my-plugin.ts
import { Plugin } from "xypriss";

export const MyPlugin = Plugin.create({
    name: "my-plugin",
    version: "1.0.0",
    description: "My awesome XyPriss plugin",

    onServerStart(server) {
        console.log("[MyPlugin] Server starting...");
    },

    onServerReady(server) {
        console.log("[MyPlugin] Server ready!");
    },

    registerRoutes(app) {
        app.get("/plugin/status", (req, res) => {
            res.json({ status: "active", plugin: "my-plugin" });
        });
    },
});
```

#### Step 3: Register Plugin

**Option A: Imperative API (Recommended)**

```typescript
import { createServer, Plugin } from "xypriss";
import { MyPlugin } from "./plugins/my-plugin";

// Register before server creation
Plugin.exec(MyPlugin);

const app = createServer({
    server: { port: 3000 },
});

app.start();
```

**Option B: Declarative API**

```typescript
import { createServer } from "xypriss";
import { MyPlugin } from "./plugins/my-plugin";

const app = createServer({
    server: { port: 3000 },
    plugins: {
        register: [MyPlugin],
    },
});

app.start();
```

---

## Plugin API Reference

### Plugin.create()

Creates a new plugin instance.

```typescript
Plugin.create(config: XyPrissPlugin): XyPrissPlugin
```

**Parameters:**

-   `config`: Plugin configuration object implementing `XyPrissPlugin` interface

**Returns:**

-   Plugin instance ready for registration

**Example:**

```typescript
const authPlugin = Plugin.create({
    name: "auth-plugin",
    version: "1.0.0",

    onRequest(req, res, next) {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        next();
    },
});
```

### Plugin.register()

Registers a plugin with the global plugin manager.

```typescript
Plugin.register(
    plugin: XyPrissPlugin | PluginCreator,
    config?: any
): void
```

**Parameters:**

-   `plugin`: Plugin instance or creator function
-   `config`: Optional configuration object

**Example:**

```typescript
Plugin.register(authPlugin);

// With configuration
Plugin.register(authPlugin, {
    secretKey: process.env.JWT_SECRET,
});
```

### Plugin.exec()

Alias for `Plugin.register()`. Preferred for imperative plugin registration.

```typescript
Plugin.exec(
    plugin: XyPrissPlugin | PluginCreator,
    config?: any
): void
```

**Example:**

```typescript
Plugin.exec(
    Plugin.create({
        name: "logger",
        version: "1.0.0",
        onRequest(req, res, next) {
            console.log(`${req.method} ${req.url}`);
            next();
        },
    })
);
```

### Plugin.get()

Retrieves a registered plugin by name.

```typescript
Plugin.get(name: string): XyPrissPlugin | undefined
```

**Parameters:**

-   `name`: Plugin name

**Returns:**

-   Plugin instance or `undefined` if not found

**Example:**

```typescript
const authPlugin = Plugin.get("auth-plugin");
if (authPlugin) {
    console.log("Auth plugin is registered");
}
```

### Plugin.factory()

Creates a plugin factory function for configurable plugins.

```typescript
Plugin.factory<T = any>(
    creator: (config: T) => XyPrissPlugin
): PluginCreator<T>
```

**Parameters:**

-   `creator`: Function that receives configuration and returns a plugin

**Returns:**

-   Plugin creator function

**Example:**

```typescript
const createRateLimiter = Plugin.factory(
    (config: { maxRequests: number; windowMs: number }) => ({
        name: "rate-limiter",
        version: "1.0.0",

        onRequest(req, res, next) {
            // Rate limiting logic using config
            next();
        },
    })
);

// Use the factory
Plugin.exec(
    createRateLimiter({
        maxRequests: 100,
        windowMs: 60000,
    })
);
```

---

## Lifecycle Hooks

### onServerStart

**Signature:**

```typescript
onServerStart?: (server: UltraFastApp) => void | Promise<void>
```

**Description:**
Called during server initialization, BEFORE the HTTP server starts listening. This hook BLOCKS server startup until completion.

**Use Cases:**

-   Database connection initialization
-   External service authentication
-   Configuration validation
-   Resource allocation

**Important:**

-   This hook is BLOCKING - server will not start until it completes
-   Async operations are fully supported
-   Errors will prevent server startup

**Example:**

```typescript
{
    onServerStart: async (server) => {
        // Connect to database
        await database.connect();

        // Initialize cache
        await cache.initialize();

        console.log("Plugin initialized successfully");
    };
}
```

### onServerReady

**Signature:**

```typescript
onServerReady?: (server: UltraFastApp) => void | Promise<void>
```

**Description:**
Called AFTER the HTTP server has started and is ready to accept connections.

**Use Cases:**

-   Start background jobs
-   Register with service discovery
-   Send startup notifications
-   Begin health checks

**Example:**

```typescript
{
    onServerReady: async (server) => {
        // Start background job
        setInterval(() => {
            performCleanup();
        }, 60000);

        // Register with service discovery
        await serviceRegistry.register({
            name: "my-service",
            port: server.getPort(),
        });
    };
}
```

### onServerStop

**Signature:**

```typescript
onServerStop?: (server: UltraFastApp) => void | Promise<void>
```

**Description:**
Called when the server is shutting down.

**Use Cases:**

-   Close database connections
-   Flush logs
-   Cleanup resources
-   Deregister from service discovery

**Example:**

```typescript
{
    onServerStop: async (server) => {
        // Close connections
        await database.disconnect();

        // Flush logs
        await logger.flush();

        console.log("Plugin shutdown complete");
    };
}
```

### onRequest

**Signature:**

```typescript
onRequest?: (req: Request, res: Response, next: NextFunction) => void
```

**Description:**
Called for EVERY incoming request, before route handlers.

**Use Cases:**

-   Request logging
-   Authentication
-   Request modification
-   Metrics collection

**Example:**

```typescript
{
    onRequest(req, res, next) {
        // Add request ID
        req.id = generateId();

        // Log request
        console.log(`[${req.id}] ${req.method} ${req.url}`);

        // Add timing
        req.startTime = Date.now();

        next();
    }
}
```

### onResponse

**Signature:**

```typescript
onResponse?: (req: Request, res: Response) => void
```

**Description:**
Called AFTER the response has been sent to the client.

**Use Cases:**

-   Response logging
-   Metrics collection
-   Cleanup operations
-   Audit logging

**Example:**

```typescript
{
    onResponse(req, res) {
        const duration = Date.now() - req.startTime;
        console.log(`[${req.id}] ${res.statusCode} ${duration}ms`);

        // Send metrics
        metrics.record({
            method: req.method,
            path: req.url,
            status: res.statusCode,
            duration
        });
    }
}
```

### onError

**Signature:**

```typescript
onError?: (error: Error, req: Request, res: Response, next: NextFunction) => void
```

**Description:**
Called when an error occurs during request processing.

**Use Cases:**

-   Error logging
-   Error reporting to external services
-   Custom error responses
-   Error recovery

**Example:**

```typescript
{
    onError(error, req, res, next) {
        // Log error
        console.error(`[${req.id}] Error:`, error);

        // Send to error tracking service
        errorTracker.captureException(error, {
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers
            }
        });

        // Send custom error response
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal Server Error',
                requestId: req.id
            });
        }
    }
}
```

### registerRoutes

**Signature:**

```typescript
registerRoutes?: (app: UltraFastApp) => void
```

**Description:**
Called during server initialization to register plugin routes.

**Use Cases:**

-   Add API endpoints
-   Health check endpoints
-   Admin interfaces
-   Webhook handlers

**Example:**

```typescript
{
    registerRoutes(app) {
        // Health check
        app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
        });

        // Plugin API
        app.get('/api/plugin/stats', (req, res) => {
            res.json(getStats());
        });

        // Admin endpoint
        app.post('/api/plugin/config', (req, res) => {
            updateConfig(req.body);
            res.json({ success: true });
        });
    }
}
```

---

## Advanced Features

### Plugin Dependencies

Plugins can declare dependencies on other plugins. The plugin manager will automatically resolve dependencies and ensure correct initialization order.

```typescript
const databasePlugin = Plugin.create({
    name: "database",
    version: "1.0.0",

    onServerStart: async () => {
        await database.connect();
    },
});

const authPlugin = Plugin.create({
    name: "auth",
    version: "1.0.0",
    dependencies: ["database"], // Requires database plugin

    onServerStart: async () => {
        // Database is guaranteed to be connected
        await loadUsers();
    },
});

Plugin.exec(authPlugin);
Plugin.exec(databasePlugin); // Order doesn't matter
```

### Middleware Priority

Control when your middleware executes relative to other plugins.

```typescript
{
    middleware: (req, res, next) => {
        // Your middleware logic
        next();
    },
    middlewarePriority: 'first' // 'first' | 'normal' | 'last'
}
```

**Priority Levels:**

-   `first`: Executes before all other middleware
-   `normal`: Default priority (default)
-   `last`: Executes after all other middleware

### Multiple Middleware

Plugins can register multiple middleware functions.

```typescript
{
    middleware: [
        (req, res, next) => {
            // First middleware
            next();
        },
        (req, res, next) => {
            // Second middleware
            next();
        },
    ];
}
```

### Configuration Management

Use `Plugin.factory()` to create configurable plugins.

```typescript
interface CacheConfig {
    ttl: number;
    maxSize: number;
    strategy: "lru" | "lfu";
}

export const createCachePlugin = Plugin.factory<CacheConfig>((config) => ({
    name: "cache-plugin",
    version: "1.0.0",

    onServerStart: async () => {
        await cache.initialize({
            ttl: config.ttl,
            maxSize: config.maxSize,
            strategy: config.strategy,
        });
    },

    onRequest(req, res, next) {
        const cached = cache.get(req.url);
        if (cached) {
            return res.json(cached);
        }
        next();
    },
}));

// Usage
Plugin.exec(
    createCachePlugin({
        ttl: 3600,
        maxSize: 1000,
        strategy: "lru",
    })
);
```

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully in your plugins.

```typescript
{
    onServerStart: async (server) => {
        try {
            await externalService.connect();
        } catch (error) {
            console.error("Failed to connect to external service:", error);
            // Decide: fail fast or continue with degraded functionality
            throw error; // Prevents server startup
        }
    };
}
```

### 2. Resource Cleanup

Always clean up resources in `onServerStop`.

```typescript
{
    onServerStart: async () => {
        this.connection = await database.connect();
    },

    onServerStop: async () => {
        if (this.connection) {
            await this.connection.close();
        }
    }
}
```

### 3. Performance

Minimize overhead in `onRequest` and `onResponse` hooks.

```typescript
// Bad: Synchronous heavy operation
{
    onRequest(req, res, next) {
        const data = heavyComputation(); // Blocks request
        req.data = data;
        next();
    }
}

// Good: Async or lazy loading
{
    onRequest(req, res, next) {
        req.getData = () => heavyComputation(); // Lazy
        next();
    }
}
```

### 4. Naming Conventions

Use descriptive, unique names for your plugins.

```typescript
// Bad
{
    name: "plugin";
}

// Good
{
    name: "xypriss-auth-jwt";
}
{
    name: "xypriss-logger-winston";
}
{
    name: "xypriss-cache-redis";
}
```

### 5. Versioning

Follow semantic versioning for your plugins.

```typescript
{
    name: 'my-plugin',
    version: '1.2.3', // MAJOR.MINOR.PATCH
}
```

### 6. Documentation

Document your plugin's configuration and usage.

````typescript
/**
 * JWT Authentication Plugin
 *
 * Provides JWT-based authentication for XyPriss applications.
 *
 * @example
 * ```typescript
 * Plugin.exec(createJWTAuth({
 *   secret: process.env.JWT_SECRET,
 *   expiresIn: '1h'
 * }));
 * ```
 */
export const createJWTAuth = Plugin.factory<JWTConfig>((config) => ({
    // Plugin implementation
}));
````

---

## Publishing Plugins

### Package Structure

```
my-xypriss-plugin/
├── src/
│   └── index.ts
├── dist/
│   └── index.js
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### package.json

```json
{
    "name": "@yourorg/xypriss-plugin-name",
    "version": "1.0.0",
    "description": "Description of your plugin",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "keywords": ["xypriss", "plugin", "your-keywords"],
    "peerDependencies": {
        "xypriss": "^4.5.0"
    },
    "devDependencies": {
        "xypriss": "^4.5.11",
        "typescript": "^5.0.0"
    }
}
```

### README.md Template

```markdown
# @yourorg/xypriss-plugin-name

Description of what your plugin does.

## Installation

\`\`\`bash
npm install @yourorg/xypriss-plugin-name
\`\`\`

## Usage

\`\`\`typescript
import { Plugin } from 'xypriss';
import { MyPlugin } from '@yourorg/xypriss-plugin-name';

Plugin.exec(MyPlugin);
\`\`\`

## Configuration

| Option  | Type   | Default   | Description |
| ------- | ------ | --------- | ----------- |
| option1 | string | 'default' | Description |

## License

MIT
```

### Publishing to npm

```bash
# Build
npm run build

# Test
npm test

# Publish
npm publish --access public
```

---

## Examples

### Example 1: Request Logger

```typescript
import { Plugin } from "xypriss";

export const RequestLogger = Plugin.create({
    name: "request-logger",
    version: "1.0.0",
    description: "Logs all incoming requests",

    onRequest(req, res, next) {
        const start = Date.now();
        req.startTime = start;

        console.log(`--> ${req.method} ${req.url}`);
        next();
    },

    onResponse(req, res) {
        const duration = Date.now() - req.startTime;
        console.log(
            `<-- ${req.method} ${req.url} ${res.statusCode} ${duration}ms`
        );
    },
});
```

### Example 2: API Key Authentication

```typescript
import { Plugin } from "xypriss";

interface AuthConfig {
    apiKeys: string[];
    headerName?: string;
}

export const createAPIKeyAuth = Plugin.factory<AuthConfig>((config) => ({
    name: "api-key-auth",
    version: "1.0.0",

    onRequest(req, res, next) {
        const headerName = config.headerName || "x-api-key";
        const apiKey = req.headers[headerName];

        if (!apiKey || !config.apiKeys.includes(apiKey as string)) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Invalid or missing API key",
            });
        }

        next();
    },
}));

// Usage
Plugin.exec(
    createAPIKeyAuth({
        apiKeys: ["key1", "key2", "key3"],
        headerName: "x-api-key",
    })
);
```

### Example 3: Rate Limiter

```typescript
import { Plugin } from "xypriss";

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

export const createRateLimiter = Plugin.factory<RateLimitConfig>((config) => {
    const requests = new Map<string, number[]>();

    return {
        name: "rate-limiter",
        version: "1.0.0",

        onRequest(req, res, next) {
            const ip = req.ip || req.connection.remoteAddress;
            const now = Date.now();

            if (!requests.has(ip)) {
                requests.set(ip, []);
            }

            const timestamps = requests.get(ip)!;
            const validTimestamps = timestamps.filter(
                (t) => now - t < config.windowMs
            );

            if (validTimestamps.length >= config.maxRequests) {
                return res.status(429).json({
                    error: "Too Many Requests",
                    retryAfter: Math.ceil(config.windowMs / 1000),
                });
            }

            validTimestamps.push(now);
            requests.set(ip, validTimestamps);

            next();
        },
    };
});

// Usage
Plugin.exec(
    createRateLimiter({
        maxRequests: 100,
        windowMs: 60000, // 1 minute
    })
);
```

### Example 4: Health Check

```typescript
import { Plugin } from "xypriss";

export const HealthCheckPlugin = Plugin.create({
    name: "health-check",
    version: "1.0.0",

    registerRoutes(app) {
        app.get("/health", (req, res) => {
            res.json({
                status: "healthy",
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString(),
            });
        });

        app.get("/ready", (req, res) => {
            // Check if all dependencies are ready
            const ready = checkDependencies();
            res.status(ready ? 200 : 503).json({
                ready,
                timestamp: new Date().toISOString(),
            });
        });
    },
});
```

### Example 5: Error Tracker

```typescript
import { Plugin } from "xypriss";

interface ErrorTrackerConfig {
    apiKey: string;
    environment: string;
}

export const createErrorTracker = Plugin.factory<ErrorTrackerConfig>(
    (config) => ({
        name: "error-tracker",
        version: "1.0.0",

        onError: async (error, req, res, next) => {
            // Send error to tracking service
            await fetch("https://error-tracker.example.com/api/errors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": config.apiKey,
                },
                body: JSON.stringify({
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name,
                    },
                    request: {
                        method: req.method,
                        url: req.url,
                        headers: req.headers,
                        ip: req.ip,
                    },
                    environment: config.environment,
                    timestamp: new Date().toISOString(),
                }),
            });

            // Continue error handling
            next();
        },
    })
);
```

---

## Support and Resources

-   **Documentation**: https://docs.xypriss.nehonix.com
-   **GitHub**: https://github.com/Nehonix-Team/xypriss
-   **Issues**: https://github.com/Nehonix-Team/xypriss/issues

---

**Copyright** 2025 Nehonix Team  
**License**: MIT

