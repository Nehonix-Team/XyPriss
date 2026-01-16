# Getting Started with XyPriss

This guide will help you get started with XyPriss, from installation to building your first application.

## Prerequisites

-   Node.js 18 or higher
-   npm or yarn package manager
-   Basic knowledge of web development
-   TypeScript (recommended)

## Installation

### Basic Installation

```bash
npm install xypriss
```

### With Security Module

```bash
npm install xypriss xypriss-security
```

### TypeScript Support

XyPriss includes TypeScript definitions out of the box. For TypeScript projects:

```bash
npm install -D typescript @types/node
```

## Your First XyPriss Server

### Basic Server

Create a new file `server.ts` (or `server.js`):

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
});

server.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss!",
        timestamp: new Date().toISOString(),
    });
});

server.start(undefined, () => {
    console.log("XyPriss server running on port 3000");
});
```

Run your server:

```bash
npx ts-node server.ts
# or for JavaScript
node server.js
```

### Server with Auto Port Switching

XyPriss can automatically find available ports:

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
        autoPortSwitch: {
            enabled: true,
            portRange: [3000, 3010],
            strategy: "increment",
        },
    },
});

server.get("/", (req, res) => {
    res.json({ message: "Server running!" });
});

server.start(undefined, () => {
    console.log("Server started successfully");
});
```

## Adding Caching

XyPriss provides built-in caching capabilities:

### Memory Cache

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: {
        port: 3000,
    },
    cache: {
        strategy: "memory",
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600, // 1 hour
    },
});

server.get("/api/data", (req, res) => {
    // This response will be cached automatically
    res.json({
        data: "This will be cached",
        timestamp: new Date().toISOString(),
    });
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
        },
        ttl: 7200, // 2 hours
    },
});
```

## Request Management

Configure timeouts and concurrency limits:

```typescript
const server = createServer({
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 30000, // 30 seconds
            routes: {
                "/api/upload": 300000, // 5 minutes for uploads
                "/api/quick": 5000, // 5 seconds for quick endpoints
            },
        },
        concurrency: {
            maxConcurrentRequests: 1000,
            maxPerIP: 50,
        },
    },
});
```

## Adding Security

### Basic Security

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: {
        port: 3000,
    },
    // Security middleware is enabled by default
});

// XyPriss automatically includes:
// - Helmet for security headers
// - CORS support
// - Rate limiting
// - Input validation
```

### With XyPriss Security Module

```typescript
import { createServer } from "xypriss";
import {
    XyPrissSecurity,
    fString,
    fArray,
    generateSecureToken,
} from "xypriss-security";

const server = createServer({
    server: { port: 3000 },
});

server.post("/api/secure", async (req, res) => {
    try {
        // Use secure data structures
        const secureData = fArray(req.body.items);
        const secureMessage = fString(req.body.message, {
            protectionLevel: "maximum",
        });

        // Generate secure token
        const token = generateSecureToken({
            length: 32,
            entropy: "maximum",
        });

        res.json({
            success: true,
            token,
            itemCount: secureData.length,
        });
    } catch (error) {
        res.status(500).json({ error: "Security operation failed" });
    }
});
```

## Clustering

Enable clustering for better performance:

```typescript
const server = createServer({
    cluster: {
        enabled: true,
        workers: "auto", // Use all CPU cores
        autoScale: {
            enabled: true,
            minWorkers: 2,
            maxWorkers: 8,
            cpuThreshold: 80,
        },
    },
});
```

## Middleware

XyPriss is fully compatible with Express.js middleware:

```typescript
import { createServer } from "xypriss";
import morgan from "morgan";
import bodyParser from "body-parser";

const server = createServer();

// Standard Express middleware works
server.use(morgan("combined"));
server.use(bodyParser.json());

// Custom middleware
server.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

server.get("/", (req, res) => {
    const duration = Date.now() - req.startTime;
    res.json({
        message: "Hello World",
        processingTime: `${duration}ms`,
    });
});
```

## Error Handling

```typescript
const server = createServer();

// Route handlers
server.get("/error", (req, res) => {
    throw new Error("Something went wrong!");
});

// Error handling middleware
server.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: "Internal Server Error",
        message:
            process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});
```

## Environment Configuration

### Development vs Production

```typescript
const server = createServer({
    env: process.env.NODE_ENV || "development",
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || "localhost",
    },
    cache: {
        strategy: process.env.NODE_ENV === "production" ? "redis" : "memory",
        redis:
            process.env.NODE_ENV === "production"
                ? {
                      host: process.env.REDIS_HOST,
                      port: parseInt(process.env.REDIS_PORT || "6379"),
                  }
                : undefined,
    },
});
```

### Configuration File

Create `xypriss.config.json`:

```json
{
    "server": {
        "port": 3000,
        "host": "0.0.0.0",
        "autoPortSwitch": {
            "enabled": true,
            "portRange": [3000, 3010]
        }
    },
    "cache": {
        "strategy": "memory",
        "maxSize": 104857600,
        "ttl": 3600
    },
    "cluster": {
        "enabled": false,
        "workers": "auto"
    }
}
```

XyPriss will automatically load this configuration.

## Testing Your Application

### Basic Testing

```typescript
import request from "supertest";
import { createServer } from "xypriss";

describe("XyPriss App", () => {
    let server: any;

    beforeAll(() => {
        server = createServer({
            server: { port: 0 }, // Use random port for testing
        });

        server.get("/test", (req, res) => {
            res.json({ message: "test" });
        });
    });

    it("should respond to GET /test", async () => {
        const response = await request(server).get("/test").expect(200);

        expect(response.body.message).toBe("test");
    });
});
```

## Performance Monitoring

```typescript
const server = createServer();

// Get performance metrics
server.get("/metrics", (req, res) => {
    const metrics = server.getMetrics();
    res.json(metrics);
});

// Access cache statistics
server.get("/cache-stats", (req, res) => {
    const cache = server.getCache();
    const stats = cache.getStats();
    res.json(stats);
});
```

## Next Steps

Now that you have a basic XyPriss server running, you can:

1. **Explore the API**: Check out the [API Reference](./api-reference.md)
2. **Learn the Architecture**: Read the [Architecture Guide](./architecture.md)
3. **Add Security**: Integrate [XyPriss Security](../mods/securityREADME.md)
4. **Optimize Performance**: Configure caching and clustering
5. **Build Plugins**: Extend functionality with custom plugins

## Common Patterns

### API Server with Database

```typescript
import { createServer } from "xypriss";
import { Pool } from "pg"; // PostgreSQL example

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const server = createServer({
    server: { port: 3000 },
    cache: { strategy: "redis" },
});

server.get("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query("SELECT * FROM users WHERE id = $1", [
            id,
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});
```

### Microservice with Health Checks

```typescript
const server = createServer({
    server: { port: 3000 },
    cluster: { enabled: true },
});

// Health check endpoint
server.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Ready check endpoint
server.get("/ready", async (req, res) => {
    // Check database connection, external services, etc.
    const isReady = await checkDependencies();

    if (isReady) {
        res.json({ status: "ready" });
    } else {
        res.status(503).json({ status: "not ready" });
    }
});
```

You're now ready to build powerful applications with XyPriss!

