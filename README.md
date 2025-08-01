# XyPriss

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

XyPriss is a Node.js framework that extends Express.js with additional performance, security, and scalability features. Built with TypeScript, it maintains full Express.js compatibility while adding enterprise-level capabilities for production applications.

> **Migration Notice**: This library is the separated version of FortifyJS accessible via [the link](https://github.com/nehonix/FortifyJS) or using `npm install fortify2-js`. The FortifyJS library will be deprecated soon, so start moving from it to XyPriss for future improvements.

## Key Features

### Performance and Scalability

-   Fast server initialization with minimal overhead
-   Multi-tier caching system supporting memory, Redis, and hybrid strategies
-   Automatic port detection and switching with configurable port ranges
-   Built-in clustering with automatic scaling based on system load
-   Advanced request management including timeouts and concurrency controls

### Security and Reliability

-   Integration with XyPriss Security module for cryptographic operations
-   Built-in security middleware including Helmet, CORS, rate limiting, and CSRF protection
-   Tamper-evident logging with cryptographic verification
-   Input validation and sanitization utilities

### Developer Experience

-   Full compatibility with existing Express.js applications
-   Complete TypeScript support with type definitions
-   Extensible plugin system for custom functionality
-   Comprehensive documentation and examples

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

// Define routes using standard Express.js syntax
server.get("/", (req, res) => {
    res.json({ message: "Hello from XyPriss!" });
});

server.get("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    res.json({ userId, data: "User data" });
});

// Start the server
server.listen(3000, () => {
    console.log("XyPriss server running on port 3000");
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
import { XyPrissSecurity, fString, fArray } from "xypriss-security";

const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
});

// Initialize security module
const security = new XyPrissSecurity();

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

server.listen(3000, () => {
    console.log("Secure XyPriss server running");
});
```

## Architecture

XyPriss uses a modular architecture with the following core components:

### Core Framework (`xypriss`)

-   Server Factory: Enhanced Express.js server creation with `createServer()`
-   Cache Engine: Multi-tier caching system with intelligent invalidation
-   Cluster Manager: Process management and auto-scaling
-   Plugin System: Extensible plugin architecture
-   Request Management: Advanced timeout and concurrency controls

### Security Module (`xypriss-security`)

XyPriss integrates with the XyPriss Security toolkit, providing:

-   Secure Data Structures: `fArray`, `fString`, `fObject` with encryption
-   Cryptographic Functions: Token generation, hashing, key derivation
-   Advanced Security: Post-quantum cryptography, tamper-evident logging
-   Performance: Fortified functions with security monitoring

```typescript
import { createServer } from "xypriss";
import {
    XyPrissSecurity,
    fArray,
    fString,
    fObject,
    generateSecureToken,
} from "xypriss-security";

// Use both together
const server = createServer({
    /* config */
});
const security = new XyPrissSecurity();
```

## Documentation

-   [Getting Started Guide](./docs/getting-started.md)
-   [API Reference](./docs/api-reference.md)
-   [Security Guide](./docs/security.md)
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

## Contributing

Contributions are welcome. Please see our [Contributing Guide](./CONTRIBUTING.md).

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

-   [Documentation](./docs/)
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
-   [Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)

