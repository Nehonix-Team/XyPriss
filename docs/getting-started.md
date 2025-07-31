# Getting Started with XyPriss

This guide will help you get up and running with XyPriss quickly.

## Prerequisites

-   Node.js 16+ (recommended: Node.js 18+)
-   npm or yarn package manager
-   TypeScript knowledge (recommended)

## Installation

### Basic Installation

```bash
npm install xypriss
```

### With Security Toolkit

For enhanced security features, install the XyPriss Security module:

```bash
npm install xypriss xypriss-security
```

### Development Dependencies

For TypeScript development:

```bash
npm install -D typescript @types/node
```

## Your First XyPriss Application

### 1. Basic Server

Create a new file `app.ts`:

```typescript
import { createServer } from "xypriss";

const server = createServer({
    port: 3000,
});

server.get("/", (req, res) => {
    res.json({
        message: "Welcome to XyPriss!",
        timestamp: new Date().toISOString(),
    });
});

server.listen(3000, () => {
    console.log("🚀 XyPriss server running on http://localhost:3000");
});
```

Run your application:

```bash
npx ts-node app.ts
```

### 2. Adding Routes

```typescript
import { createServer } from "xypriss";

const server = createServer({
    port: 3000,
});

// GET route
server.get("/api/users", (req, res) => {
    res.json({ users: [] });
});

// POST route
server.post("/api/users", (req, res) => {
    const userData = req.body;
    // Process user data
    res.status(201).json({
        message: "User created",
        user: userData,
    });
});

// Route with parameters
server.get("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({
        userId,
        user: { id: userId, name: "John Doe" },
    });
});

// Route with query parameters
server.get("/api/search", (req, res) => {
    const { q, limit = 10 } = req.query;
    res.json({
        query: q,
        limit: parseInt(limit as string),
        results: [],
    });
});

server.listen();
```

### 3. Adding Middleware

```typescript
import { createServer } from "xypriss";

const server = createServer({
    port: 3000,
    security: {
        enabled: true,
    },
});

// Global middleware
server.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// JSON parsing middleware
server.use(express.json());

// CORS middleware
server.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

server.get("/", (req, res) => {
    res.json({ message: "Hello with middleware!" });
});

server.listen();
```

## Configuration

### Environment-based Configuration

Create a `config.ts` file:

```typescript
export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || "development",

    database: {
        url: process.env.DATABASE_URL || "sqlite://./dev.db",
    },

    cache: {
        type: process.env.CACHE_TYPE || "memory",
        redis: {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
        },
    },

    security: {
        jwtSecret: process.env.JWT_SECRET || "your-secret-key",
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100"),
    },
};
```

Use the configuration:

```typescript
import { createServer } from "xypriss";
import { config } from "./config";

const server = createServer({
    port: config.port,

    cache: {
        type: config.cache.type as "memory" | "redis",
        redis: config.cache.redis,
    },

    security: {
        enabled: true,
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: config.security.rateLimitMax,
        },
    },
});
```

## Error Handling

### Global Error Handler

```typescript
import { createServer } from "xypriss";

const server = createServer({
    port: 3000,
});

// Global error handler
server.use((err: Error, req: any, res: any, next: any) => {
    console.error("Global error:", err);

    res.status(500).json({
        error: "Internal Server Error",
        message:
            process.env.NODE_ENV === "development"
                ? err.message
                : "Something went wrong",
    });
});

// Route with error handling
server.get("/api/error-prone", async (req, res, next) => {
    try {
        // Some operation that might fail
        const result = await riskyOperation();
        res.json({ result });
    } catch (error) {
        next(error); // Pass error to global handler
    }
});

async function riskyOperation() {
    throw new Error("Something went wrong!");
}

server.listen();
```

## Testing Your Application

### Basic Test Setup

Install testing dependencies:

```bash
npm install -D jest @types/jest supertest @types/supertest
```

Create `app.test.ts`:

```typescript
import request from "supertest";
import { createServer } from "xypriss";

describe("XyPriss App", () => {
    let server: any;

    beforeAll(() => {
        server = createServer({
            port: 0, // Use random port for testing
        });

        server.get("/", (req: any, res: any) => {
            res.json({ message: "Hello Test!" });
        });
    });

    test("GET / should return welcome message", async () => {
        const response = await request(server).get("/").expect(200);

        expect(response.body.message).toBe("Hello Test!");
    });
});
```

## Next Steps

Now that you have a basic XyPriss application running, explore these advanced features:

1. **[Security Configuration](./security.md)** - Learn about XyPriss security features
2. **[Caching Strategies](./caching.md)** - Implement efficient caching
3. **[Performance Optimization](./performance.md)** - Optimize your application
4. **[Plugin Development](./plugins.md)** - Create custom plugins
5. **[Deployment](./deployment.md)** - Deploy to production

## Common Issues

### Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Change the port or kill the process using the port:

```bash
lsof -ti:3000 | xargs kill -9
```

### TypeScript Compilation Errors

Make sure your `tsconfig.json` includes:

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "strict": true,
        "esModuleInterop": true
    }
}
```

### Memory Issues

For large applications, increase Node.js memory:

```bash
node --max-old-space-size=4096 app.js
```

## Support

-   [API Reference](./api-reference.md)
-   [GitHub Issues](https://github.com/your-org/xypriss/issues)
-   [Community Discord](https://discord.gg/xypriss)

---

**Next**: [API Reference](./api-reference.md)

