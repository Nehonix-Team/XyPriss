<div align="center">
  <img src="https://sdk.nehonix.space/assets/xypriss/mode/transparent/logo.png" alt="XyPriss Logo" width="200" height="200">

# XyPriss (Beta)

A Node.js web framework with Express-like API, built-in security middleware, and routing system

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.space)

</div>

---

## About XyPriss

XyPriss is a Node.js web framework with an Express-like API, built from the ground up with TypeScript. It provides built-in security middleware, a flexible routing system, and performance optimizations without depending on Express.

### Key Benefits

-   Independent web framework with Express-like API
-   Built-in security middleware (12 security modules)
-   Flexible routing system with wildcard and parameter support
-   TypeScript support with full type definitions

> **Migration Notice**: This library is the evolved version of FortifyJS. The FortifyJS library will be deprecated soon - migrate to XyPriss for continued support and new features. [Learn more](https://github.com/nehonix/FortifyJS)

---

## Quick Start

```bash
# Install XyPriss
npm install xypriss

# Or with yarn
yarn add xypriss
```

```typescript
import { createServer } from "xypriss";

// Create a XyPriss server
const server = createServer({
    server: { port: 3000 },
    security: { enabled: true },
    performance: { clustering: true },
});

// Use Express-like API
server.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss!",
        powered: "Nehonix",
    });
});

// Start the server
server.start();
```

Your server is now running with built-in security middleware and routing capabilities.

---

## Table of Contents

-   [About XyPriss](#about-xypriss)
-   [Quick Start](#quick-start)
-   [Key Features](#key-features)
    -   [Routing System](#routing-system)
    -   [Security and Reliability](#security-and-reliability)
    -   [Performance and Scalability](#performance-and-scalability)
    -   [Developer Experience](#developer-experience)
-   [Routing Documentation](#routing-documentation)
-   [Installation](#installation)
-   [Basic Usage](#basic-usage)
-   [Configuration](#configuration)
-   [Documentation](#documentation)
-   [Contributing](#contributing)
-   [License](#license)
-   [Support](#support)

---

## Key Features

### Routing System

-   Express-like API for familiar development experience
-   Advanced route patterns with parameter support (`:id`, `:name`)
-   Wildcard routing with single (`*`) and multi-segment (`**`) support
-   Router mounting and middleware support
-   Route-specific middleware and parameter extraction

### Security and Reliability

-   12 built-in security middleware modules
-   CSRF protection with csrf-csrf library
-   Security headers (Helmet), CORS, rate limiting
-   Input validation and sanitization (XSS, MongoDB injection protection)
-   Request logging and monitoring

### Performance and Scalability

-   Independent HTTP server implementation
-   Fast server initialization with minimal overhead
-   Multi-tier caching system supporting memory, Redis, and hybrid strategies
-   Automatic port detection and switching with configurable port ranges
-   Built-in clustering with automatic scaling based on system load

### Developer Experience
-   Complete TypeScript support with type definitions
-   Extensible plugin system for custom functionality
-   Comprehensive documentation and examples

## Routing Documentation

XyPriss provides a flexible routing system with Express-like API but without Express dependency.

### Basic Routing

```typescript
import { createServer } from "xypriss";

const app = createServer();

// Basic routes
app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

app.post("/users", (req, res) => {
    res.json({ message: "User created", data: req.body });
});

app.put("/users/:id", (req, res) => {
    res.json({ message: "User updated", id: req.params.id });
});

app.delete("/users/:id", (req, res) => {
    res.json({ message: "User deleted", id: req.params.id });
});
```

### Route Parameters

```typescript
// Single parameter
app.get("/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({ userId });
});

// Multiple parameters
app.get("/users/:userId/posts/:postId", (req, res) => {
    const { userId, postId } = req.params;
    res.json({ userId, postId });
});
```

### Wildcard Routes

XyPriss supports two types of wildcards:

#### Single Wildcard (`*`) - Matches one path segment

```typescript
// Matches: /files/document.pdf, /files/image.jpg
// Does NOT match: /files/folder/document.pdf
app.get("/files/*", (req, res) => {
    const filename = req.params["*"];
    res.json({ filename });
});
```

#### Double Wildcard (`**`) - Matches multiple path segments

```typescript
// Matches: /api/v1/users, /api/v1/users/123/posts
app.get("/api/**", (req, res) => {
    const path = req.params["**"];
    res.json({ capturedPath: path });
});
```

### Router System

Create modular routes using the Router system:

```typescript
import { createServer, Router } from "xypriss"; // import XyPrissRouter for full control

const app = createServer();

// Create a router
const userRouter = Router();

// Add routes to router
userRouter.get("/", (req, res) => {
    res.json({ message: "Get all users" });
});

userRouter.get("/:id", (req, res) => {
    res.json({ message: "Get user", id: req.params.id });
});

userRouter.post("/", (req, res) => {
    res.json({ message: "Create user", data: req.body });
});

// Mount router at /api/users
app.use("/api/users", userRouter);

// Router with middleware
const adminRouter = Router();

adminRouter.use((req, res, next) => {
    // Admin authentication middleware
    console.log("Admin route accessed");
    next();
});

adminRouter.get("/dashboard", (req, res) => {
    res.json({ message: "Admin dashboard" });
});

app.use("/admin", adminRouter);
```

### Middleware

Add middleware to routes or routers:

```typescript
// Global middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Route-specific middleware
app.get(
    "/protected",
    (req, res, next) => {
        // Authentication middleware
        if (!req.headers.authorization) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        next();
    },
    (req, res) => {
        res.json({ message: "Protected resource" });
    }
);

// Router middleware
const apiRouter = Router();

apiRouter.use((req, res, next) => {
    // API-specific middleware
    res.setHeader("X-API-Version", "1.0");
    next();
});
```

### Route Examples

```typescript
// Combined parameters and wildcards
app.get("/users/:id/files/*", (req, res) => {
    const { id } = req.params;
    const filename = req.params["*"];
    res.json({ userId: id, filename });
});

// Deep wildcard routing
app.get("/docs/**", (req, res) => {
    const docPath = req.params["**"];
    res.json({ documentPath: docPath });
});

// API versioning with routers
const v1Router = Router();
const v2Router = Router();

v1Router.get("/users", (req, res) => {
    res.json({ version: "v1", users: [] });
});

v2Router.get("/users", (req, res) => {
    res.json({ version: "v2", users: [], pagination: {} });
});

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
```

## Installation

```bash
npm install xypriss
```

For security features:

```bash
npm install xypriss xypriss-security
```

## Quick Start

### Basic Server Setup

```typescript
import { createServer } from "xypriss";

// Create a new XyPriss server
const app = createServer({
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

// Define routes using Express-like syntax
app.get("/", (req, res) => {
    res.json({ message: "Hello from XyPriss!" });
});

app.get("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({ userId, data: "User data" });
});

// Start the server
app.start(undefined, () => {
    console.log(
        "Secure XyPriss server running at http://localhost:" + app.getPort()
    );
});
```

### Advanced Configuration

```typescript
import { createServer } from "xypriss";

const server = createServer({
    env: "production",

    server: {
        port: 8080,
        host: "0.0.0.0",
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 5,
            portRange: [8080, 8090],
            strategy: "increment",
        },
    },

    cache: {
        strategy: "hybrid", // Memory + Redis
        maxSize: 500 * 1024 * 1024, // 500MB
        ttl: 7200, // 2 hours
        redis: {
            host: "localhost",
            port: 6379,
            cluster: true,
            nodes: [
                { host: "redis-1", port: 6379 },
                { host: "redis-2", port: 6379 },
            ],
        },
    },

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

    cluster: {
        enabled: true,
        workers: "auto", // Auto-detect CPU cores
        autoScale: {
            enabled: true,
            minWorkers: 2,
            maxWorkers: 8,
            cpuThreshold: 80,
        },
    },
});
```

### With XyPriss Security Integration

```typescript
import { createServer } from "xypriss";
import { XyPrissSecurity as security, fString, fArray } from "xypriss-security";

const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
});

// Secure route with encryption
server.post("/api/secure-data", async (req, res) => {
    try {
        // Use secure data structures
        const secureData = fArray(req.body.sensitiveArray);
        const securePassword = fString(req.body.password, {
            protectionLevel: "maximum",
            enableEncryption: true,
        });

        // Generate secure token
        const token = security.generateSecureToken({
            length: 32,
            entropy: "maximum",
        });

        res.json({
            success: true,
            token,
            dataLength: secureData.length,
        });
    } catch (error) {
        res.status(500).json({ error: "Security operation failed" });
    }
});

server.start(undefined, () => {
    console.log(
        "Secure XyPriss server running at http://localhost:" + server.getPort()
    );
});
```

## Architecture

### Core Framework (`xypriss`)

-   Server Factory: Independent HTTP server creation with `createServer()`
-   Routing System: Express-like API with advanced pattern matching
-   Security Middleware: 12 built-in security modules
-   Cache Engine: Multi-tier caching system with intelligent invalidation
-   Plugin System: Extensible plugin architecture

### Security Module (`xypriss-security`)

XyPriss integrates with the XyPriss Security toolkit, providing:

-   Secure Data Structures: `fArray`, `fString`, `fObject` with encryption
-   Cryptographic Functions: Token generation, hashing, key derivation
-   Advanced Security: Post-quantum cryptography, tamper-evident logging
-   Performance: Fortified functions with security monitoring

```typescript
import { createServer } from "xypriss";
import {
    XyPrissSecurity as security, // or just import XyPriss
    fArray,
    fString,
    fObject,
    generateSecureToken,
} from "xypriss-security";

// Use both together
const server = createServer({
    /* config */
});
```

## Documentation

-   [Getting Started Guide](./docs/getting-started.md)
-   [Routing System](./docs/routing.md)
-   [Security Guide](./docs/security.md)
-   [API Reference](./docs/api-reference.md)
-   [Configuration Options](./docs/configuration.md)
-   [Plugin Development](./docs/plugins.md)

## Configuration

XyPriss supports extensive configuration through the `ServerOptions` interface:

```typescript
interface ServerOptions {
    env?: "development" | "production" | "test";
    server?: {
        port?: number;
        host?: string;
        autoPortSwitch?: {
            enabled?: boolean;
            portRange?: [number, number];
            strategy?: "increment" | "random" | "predefined";
        };
    };
    cache?: {
        strategy?: "auto" | "memory" | "redis" | "hybrid";
        maxSize?: number;
        ttl?: number;
        redis?: RedisConfig;
    };
    requestManagement?: RequestManagementConfig;
    cluster?: ClusterConfig;
    // ... and many more options
}
```

## Performance

XyPriss is optimized for production use:

-   Fast server initialization with minimal overhead
-   High-throughput request handling
-   Efficient memory usage with automatic cleanup
-   Low-latency cache access
-   Horizontal scaling through clustering

## Available Modules

XyPriss includes several specialized modules for enhanced functionality:

### ACPES - Advanced Cross-Platform Encrypted Storage

**Location**: `mods/ACPES/`

A secure, cross-platform storage solution that works seamlessly across Web, Mobile (React Native), and Node.js environments.

**Features:**

-   Cross-platform compatibility (Web, Mobile, Node.js)
-   Double AES-256 encryption with PBKDF2 key derivation
-   Integrity verification with HMAC-SHA256 checksums
-   Device fingerprinting for unique encryption keys
-   Automatic lockout protection against brute force attacks
-   TTL support for automatic data expiration
-   LZ-string compression for large data

**Quick Usage:**

```typescript
import { Storage, STORAGE_KEYS } from "xypriss-acpes";

// Store sensitive data
await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "your-token");

// Retrieve data
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
```

**Documentation**: [ACPES Documentation](./mods/ACPES/docs/)

### Security Module

**Location**: `mods/security/`

Comprehensive security utilities and middleware for XyPriss applications.

**Features:**

-   Request validation and sanitization
-   Rate limiting and DDoS protection
-   Security headers management
-   Authentication and authorization utilities
-   Cryptographic functions and secure random generation

**Documentation**: [Security Module Documentation](./mods/security/docs/)

## Contributing

Contributions are welcome. Please see our [Contributing Guide](./CONTRIBUTING.md).

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

-   [Documentation](./docs/)
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
-   [Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)

---

### Powered by Nehonix

XyPriss is developed and maintained by the Nehonix Team.

[![Website](https://img.shields.io/badge/Website-nehonix.space-blue?style=for-the-badge&logo=globe)](https://nehonix.space)
[![GitHub](https://img.shields.io/badge/GitHub-Nehonix--Team-black?style=for-the-badge&logo=github)](https://github.com/Nehonix-Team)
[![Twitter](https://img.shields.io/badge/Twitter-@nehonix-1DA1F2?style=for-the-badge&logo=twitter)](https://twitter.com/nehonix)

