# XyPriss

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**XyPriss** is a high-performance, security-focused Node.js framework that enhances Express.js with enterprise-grade features. Built with TypeScript and featuring a modular architecture, XyPriss provides developers with a fast, secure way to create scalable web applications while maintaining full Express.js compatibility.

## 🚀 Key Features

### Performance & Scalability
- **Ultra-Fast Server Creation**: Zero-async initialization for immediate use
- **Intelligent Caching**: Multi-tier caching with Redis, memory, and hybrid strategies
- **Auto Port Switching**: Automatic port detection and switching with configurable ranges
- **Cluster Management**: Built-in clustering with auto-scaling capabilities
- **Request Management**: Advanced timeout, concurrency, and network quality controls

### Security & Reliability
- **XyPriss Security Integration**: Military-grade encryption and secure data structures
- **Built-in Security Middleware**: Helmet, CORS, rate limiting, and CSRF protection
- **Tamper-Evident Logging**: Immutable audit trails with cryptographic verification
- **Input Validation**: Comprehensive sanitization and validation utilities

### Developer Experience
- **Full Express.js Compatibility**: Drop-in replacement with enhanced features
- **TypeScript Native**: Complete type safety and IntelliSense support
- **Plugin Architecture**: Extensible system for custom functionality
- **Comprehensive Documentation**: Detailed guides and API references

## 📦 Installation

```bash
npm install xypriss
```

For security features:
```bash
npm install xypriss xypriss-security
```

## 🏃‍♂️ Quick Start

### Basic Server Setup

```typescript
import { createServer } from "xypriss";

// Create a new XyPriss server (enhanced ExpressJS)
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

// Define routes (ExpressJS-compatible)
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
            strategy: "increment"
        }
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
                { host: "redis-2", port: 6379 }
            ]
        }
    },

    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 30000, // 30 seconds
            routes: {
                "/api/upload": 300000, // 5 minutes for uploads
                "/api/quick": 5000     // 5 seconds for quick endpoints
            }
        },
        concurrency: {
            maxConcurrentRequests: 1000,
            maxPerIP: 50
        }
    },

    cluster: {
        enabled: true,
        workers: "auto", // Auto-detect CPU cores
        autoScale: {
            enabled: true,
            minWorkers: 2,
            maxWorkers: 8,
            cpuThreshold: 80
        }
    }
});
```

### With XyPriss Security Integration

```typescript
import { createServer } from "xypriss";
import { XyPrissSecurity, fString, fArray } from "xypriss-security";

const server = createServer({
    server: {
        port: 3000,
        host: "localhost"
    }
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
            enableEncryption: true
        });

        // Generate secure token
        const token = security.generateSecureToken({
            length: 32,
            entropy: "maximum"
        });

        res.json({ 
            success: true, 
            token,
            dataLength: secureData.length
        });
    } catch (error) {
        res.status(500).json({ error: "Security operation failed" });
    }
});

server.listen(3000, () => {
    console.log("Secure XyPriss server running");
});
```

## 🏗️ Architecture

XyPriss follows a modular architecture with the following core components:

### Core Framework (`xypriss`)
- **Server Factory**: Enhanced Express.js server creation with `createServer()`
- **Cache Engine**: Multi-tier caching system with intelligent invalidation
- **Cluster Manager**: Process management and auto-scaling
- **Plugin System**: Extensible plugin architecture
- **Request Management**: Advanced timeout and concurrency controls

### Security Module (`xypriss-security`)
XyPriss seamlessly integrates with the XyPriss Security toolkit, providing:

- **Secure Data Structures**: `fArray`, `fString`, `fObject` with encryption
- **Cryptographic Functions**: Token generation, hashing, key derivation
- **Advanced Security**: Post-quantum cryptography, tamper-evident logging
- **Performance**: Ultra-fast fortified functions with security monitoring

```typescript
import { createServer } from "xypriss";
import { 
    XyPrissSecurity, 
    fArray, 
    fString, 
    fObject,
    generateSecureToken 
} from "xypriss-security";

// Use both together for maximum security and performance
const server = createServer({ /* config */ });
const security = new XyPrissSecurity();
```

## 📚 Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Security Guide](./docs/security.md)
- [Configuration Options](./docs/configuration.md)
- [Plugin Development](./docs/plugins.md)

## 🔧 Configuration

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

## 🚀 Performance

XyPriss is designed for high performance:

- **Server Creation**: < 1ms initialization time
- **Request Handling**: 50,000+ requests/second
- **Memory Usage**: Optimized with automatic cleanup
- **Caching**: Sub-millisecond cache access
- **Clustering**: Linear scaling with CPU cores

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

- [Documentation](./docs/)
- [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
- [Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)

---

**XyPriss** - Ultra-fast, secure Express.js enhancement for modern applications.
