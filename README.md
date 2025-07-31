# XyPriss

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**XyPriss** is a high-performance, security-focused Node.js framework that enhances Express.js with enterprise-grade features. Built with TypeScript and featuring a modular architecture, XyPriss provides developers with a fast, secure way to create scalable web applications while maintaining full Express.js compatibility.

## 🚀 Key Features

### Performance & Scalability

-   **Ultra-Fast Request Processing**: Advanced request pre-compilation and optimization
-   **Intelligent Caching**: Multi-tier caching with Redis, Memory, and File system support
-   **Cluster Management**: Built-in clustering with auto-scaling capabilities
-   **Smart Routing**: Dynamic route optimization and intelligent request handling

### Security First

-   **XyPriss Security Module**: Comprehensive cryptographic utilities and secure data handling
-   **Fortified Functions**: Tamper-resistant function execution with integrity verification
-   **Advanced Middleware**: Built-in protection against XSS, SQL injection, and other attacks
-   **Secure Memory Management**: Protected memory allocation and cleanup

### Developer Experience

-   **TypeScript Native**: Full TypeScript support with comprehensive type definitions
-   **Modular Architecture**: Plugin-based system for extensibility
-   **Rich Ecosystem**: Integration with XyPriss Security toolkit
-   **Comprehensive Documentation**: Detailed guides and API references

## 📦 Installation

```bash
npm install xypriss
```

For the complete security toolkit:

```bash
npm install xypriss xypriss-security
```

## 🏃‍♂️ Quick Start

### Basic Server Setup

```typescript
import { createServer } from "xypriss";

// Create a new XyPriss server (enhanced ExpressJS)
const server = createServer({
    port: 3000,
    security: {
        enabled: true,
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
        },
    },
    cache: {
        type: "memory",
        maxSize: 100, // 100MB
    },
});

// Define routes (ExpressJS-compatible)
server.get("/", (req, res) => {
    res.json({ message: "Hello from XyPriss!" });
});

server.get("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    // Your logic here
    res.json({ userId, data: "User data" });
});

// Start the server
server.listen(3000, () => {
    console.log("XyPriss server running on port 3000");
});
```

### XyPriss Security Integration

XyPriss seamlessly integrates with the XyPriss Security toolkit, providing:

-   Advanced cryptographic functions
-   Secure data structures
-   Tamper-evident logging
-   Fortified function execution

```typescript
import { createServer } from "xypriss";
import { XyPrissSecurity, SecureString, Hash } from "xypriss-security";

const server = createServer({
    port: 3000,
    security: { enabled: true },
});

// Initialize security module
const security = new XyPrissSecurity();

// Secure route with encryption
server.post("/api/secure-data", async (req, res) => {
    try {
        // Encrypt sensitive data
        const encryptedData = await security.encrypt(req.body.data);

        // Store securely (example)
        const secureStorage = new SecureString(encryptedData);

        res.json({
            success: true,
            hash: Hash.create(req.body.data, { algorithm: "sha256" }),
        });
    } catch (error) {
        res.status(500).json({ error: "Security operation failed" });
    }
});

server.listen(3000, () => {
    console.log("Secure XyPriss server running");
});
```

## 📚 Documentation

-   [Getting Started Guide](./docs/getting-started.md)
-   [API Reference](./docs/api-reference.md)
-   [Security Guide](./docs/security.md)
-   [Performance Optimization](./docs/performance.md)
-   [Plugin Development](./docs/plugins.md)
-   [Deployment Guide](./docs/deployment.md)

## 🔧 Configuration

XyPriss supports extensive configuration options:

```typescript
interface XyPrissConfig {
    server?: ServerConfig;
    security?: SecurityConfig;
    cache?: CacheConfig;
    cluster?: ClusterConfig;
    performance?: PerformanceConfig;
    plugins?: PluginConfig[];
}
```

See the [Configuration Guide](./docs/configuration.md) for detailed options.

## 🚀 Performance

XyPriss is designed for high performance:

-   **Request Processing**: Up to 50,000+ requests/second
-   **Memory Efficiency**: Optimized memory usage with automatic cleanup
-   **CPU Utilization**: Intelligent load balancing across CPU cores
-   **Caching**: Sub-millisecond cache retrieval times

## 🔒 Security

Security is built into every aspect of XyPriss:

-   **Input Validation**: Automatic sanitization and validation
-   **Output Encoding**: XSS protection through secure encoding
-   **SQL Injection Protection**: Parameterized query enforcement
-   **Rate Limiting**: Configurable rate limiting per IP/user
-   **Secure Headers**: Automatic security header injection

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

-   [Documentation](./docs/)
-   [GitHub Issues](https://github.com/your-org/xypriss/issues)
-   [Discord Community](https://discord.gg/xypriss)

---

**XyPriss** - Ultra-fast, secure, and scalable Node.js framework for modern web applications.

