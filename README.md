<div align="center">
  <img src="https://dll.nehonix.com/assets/xypriss/mode/transparent/logo.png" alt="XyPriss Logo" width="200" height="200">

# XyPriss (Beta)

A powerful Node.js web framework with built-in security, clustering, and performance optimizations for modern web applications.

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.com)

</div>

---

## Overview

XyPriss is a powerful, TypeScript-first, open-source Node.js web framework that enhances your development experience with built-in security middleware, clustering, and performance optimizations. Whether you're building new applications or enhancing existing ones, XyPriss provides the tools you need for scalable, secure web development.

### Key Features

-   **Familiar API**: Intuitive syntax for defining routes and middleware
-   **Built-in Security**: 12+ security middleware modules (CSRF, XSS, rate limiting)
-   **File Upload Support**: Seamless multipart/form-data handling with automatic error handling
-   **XJson API**: Advanced JSON serialization handling BigInt, circular references, and large data
-   **Multi-Server Mode**: Run multiple server instances with different configurations
-   **Flexible Routing**: Parameters, wildcards, and modular routers
-   **TypeScript Support**: Full type definitions for better DX
-   **Performance**: Advanced clustering, caching, and optimizations

> **Note**: XyPriss is the successor to FortifyJS, which will be deprecated. [Migration Guide](https://github.com/nehonix/FortifyJS)

---

## Installation

```bash
npm install xypriss
# or
yarn add xypriss
```

For additional security features:

```bash
npm install xypriss-security
```

---

## Quick Start

### Recommended: Use XyPriss CLI

```bash
# Install the CLI globally
npm install -g xypriss-cli

# Create a new project
xypcli init

# Start development
cd your-project-name
npm run dev
```

The CLI automatically generates a complete project structure with authentication, file upload support, and multi-server configuration (all optional).

### Manual Setup

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: { port: 3000 },
    security: { enabled: true },
    performance: { clustering: true },
});

server.get("/", (req, res) => {
    res.json({ message: "Hello from XyPriss!", powered: "Nehonix" });
});

// XJson example for handling BigInt and large data
server.get("/api/data", (req, res) => {
    const data = {
        id: 123n, // BigInt value
        timestamp: new Date(),
        items: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            value: BigInt(i * 1000),
        })),
    };

    res.xJson(data); // Advanced JSON handling
});

server.start(() => {
    console.log(`Server running at http://localhost:${server.getPort()}`);
});
```

---

## Documentation

### Core Guides

-   **[Routing](./docs/ROUTING.md)** - Routes, parameters, wildcards, and middleware
-   **[XJson API](./docs/XJSON_API.md)** - Advanced JSON serialization for BigInt and large data
-   **[Global APIs](./docs/GLOBAL_APIS.md)** - Runtime globals for system, config, and constants
-   **[File Upload](./docs/FILE_UPLOAD_GUIDE.md)** - Complete file upload guide with runtime compatibility
-   **[Security](./docs/SECURITY.md)** - CORS, CSRF, rate limiting, and security best practices
-   **[Multi-Server](./docs/MULTI_SERVER.md)** - Running multiple server instances
-   **[Configuration](./docs/CONFIGURATION.md)** - Complete configuration reference

### Additional Resources

-   **[Wildcard CORS](./docs/WILDCARD_CORS.md)** - Advanced CORS configuration
-   **[API Reference](./docs/API.md)** - Complete API documentation
-   **[Examples](./examples/)** - Code examples and use cases
-   **[Migration Guide](./docs/MIGRATION.md)** - Migrating from FortifyJS

---

## Quick Examples

### Routing

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();
const userRouter = Router();

userRouter.get("/:id", (req, res) => {
    res.json({ userId: req.params.id });
});

app.use("/api/users", userRouter);
```

[→ Full Routing Guide](./docs/ROUTING.md)

### File Upload

```typescript
import { createServer, FileUploadAPI } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
    },
});

const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);

app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ success: true, file: req.file });
});
```

[→ Full File Upload Guide](./docs/FILE_UPLOAD_GUIDE.md)

### Security

```typescript
const server = createServer({
    security: {
        enabled: true,
        level: "enhanced",
        cors: {
            origin: ["localhost:*", "*.myapp.com"],
            credentials: true,
        },
        rateLimit: { max: 100, windowMs: 15 * 60 * 1000 },
    },
});
```

[→ Full Security Guide](./docs/SECURITY.md)

### Multi-Server

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 3001,
                routePrefix: "/api",
                allowedRoutes: ["/api/*"],
            },
            {
                id: "admin-server",
                port: 3002,
                routePrefix: "/admin",
                security: { level: "maximum" },
            },
        ],
    },
});

await app.startAllServers();
```

[→ Full Multi-Server Guide](./docs/MULTI_SERVER.md)

---

## Modules

### ACPES (Advanced Cross-Platform Encrypted Storage)

Secure storage solution for web, mobile, and Node.js environments.

```typescript
import { Storage, STORAGE_KEYS } from "xypriss-acpes";

await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "secure-token");
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
```

[→ ACPES Documentation](./mods/ACPES/docs/)

### Security Module

Advanced security utilities for data handling and request protection.

```typescript
import { fString, generateSecureToken } from "xypriss-security";

const secureData = fString(data, { enableEncryption: true });
const token = generateSecureToken({ length: 32 });
```

[→ Security Module Documentation](./mods/security/docs/)

---

## Performance

XyPriss is designed for efficiency and scalability:

-   **Independent HTTP Server**: No Express dependency
-   **Clustering**: Automatic scaling based on CPU cores
-   **Caching**: Memory, Redis, or hybrid strategies
-   **Auto Port Switching**: Detects and switches ports if conflicts arise

```typescript
const server = createServer({
    server: {
        port: 3000,
        autoPortSwitch: { enabled: true, portRange: [3000, 3100] },
    },
    cache: {
        strategy: "redis",
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600,
    },
    cluster: { enabled: true, workers: "auto" },
});
```

[→ Full Configuration Guide](./docs/CONFIGURATION.md)

---

## Works Great With Express

XyPriss complements the Node.js ecosystem:

-   Use XyPriss standalone for new projects
-   Enhance existing Express apps with XyPriss security modules
-   Run both frameworks side by side
-   Migrate gradually

```typescript
import express from "express";
import { XyPrissSecurity } from "xypriss-security";

const app = express();

app.use(
    XyPrissSecurity.middleware({
        csrf: true,
        xss: true,
        rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
    })
);
```

---

## Contributing

We welcome contributions! See the [Contributing Guide](./CONTRIBUTING.md) for details.

---

## Support

-   **[Documentation](./docs/)** - Complete guides and API reference
-   **[GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)** - Bug reports and feature requests
-   **[Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)** - Report security vulnerabilities
-   **[Discussions](https://github.com/Nehonix-Team/XyPriss/discussions)** - Community support

---

## License

XyPriss is licensed under the [MIT License](./LICENSE).

---

### Powered by Nehonix Devs

[![Website](https://img.shields.io/badge/Website-nehonix.com-blue?style=for-the-badge&logo=globe)](https://nehonix.com)
[![GitHub](https://img.shields.io/badge/GitHub-Nehonix--Team-black?style=for-the-badge&logo=github)](https://github.com/Nehonix-Team)
[![Twitter](https://img.shields.io/badge/Twitter-@nehonix-1DA1F2?style=for-the-badge&logo=twitter)](https://twitter.com/nehonix)

