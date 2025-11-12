<div align="center">
  <img src="https://sdk.nehonix.space/assets/xypriss/mode/transparent/logo.png" alt="XyPriss Logo" width="200" height="200">

# XyPriss (Beta)

A powerful Node.js web framework with built-in security, clustering, and performance optimizations for modern web applications.

[![npm version](https://badge.fury.io/js/xypriss.svg)](https://badge.fury.io/js/xypriss)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered by Nehonix](https://img.shields.io/badge/Powered%20by-Nehonix-blue?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://nehonix.space)

</div>

---

## Overview

XyPriss is a powerful, TypeScript-first, open-source Node.js web framework that enhances your development experience with built-in security middleware, clustering, and performance optimizations. Whether you're building new applications or enhancing existing ones, XyPriss provides the tools you need for scalable, secure web development. Join our community and contribute on GitHub!

### Key Features

-   **Familiar API**: Intuitive syntax for defining routes and middleware that feels natural to Node.js developers.
-   **Built-in Security**: Includes 12+ security middleware modules for common protections like CSRF, XSS, and rate limiting.
-   **File Upload Support**: Seamless integration with multer and other multipart form-data parsers.
-   **Multi-Server Mode**: Run multiple server instances with different configurations from a single setup.
-   **Flexible Routing**: Supports parameters, wildcards, and modular routers.
-   **TypeScript Support**: Full type definitions for a better developer experience.
-   **Performance**: Advanced clustering, caching, and performance optimizations built-in.

> **Note**: XyPriss is the successor to FortifyJS, which will be deprecated. Migrate to XyPriss for continued support and new features. [Migration Guide](https://github.com/nehonix/FortifyJS).

---

## Installation

Install XyPriss via npm or yarn:

```bash
npm install xypriss
# or
yarn add xypriss
```

For additional security features, install the security module:

```bash
npm install xypriss-security
```

---

## Quick Start

### 🚀 Recommended: Use XyPriss CLI for Instant Setup

The fastest way to get started with XyPriss is using our CLI tool:

```bash
# Install the CLI globally
npm install -g xypriss-cli

# Create a new XyPriss project
xypcli init

# Follow the interactive prompts to configure your project
# Choose TypeScript/JavaScript

# Start development server
cd your-project-name
npm run dev
```

The CLI automatically generates a complete project structure with:
- ✅ Pre-configured TypeScript/JavaScript setup
- ✅ Authentication system (optional)
- ✅ File upload support (optional)
- ✅ Multi-server configuration (optional)
- ✅ All dependencies installed
- ✅ Ready-to-run development server

### Manual Setup

If you prefer manual setup, create a basic server with XyPriss:

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

server.start(() => {
    console.log(`Server running at http://localhost:${server.getPort()}`);
});
```

This sets up a server with security middleware and clustering enabled, listening on port 3000.

### Works Great With Express

XyPriss is designed to complement the Node.js ecosystem, not replace it. You can:

-   **Use XyPriss standalone** for new projects that need built-in security and clustering
-   **Enhance existing Express apps** by integrating XyPriss security modules
-   **Run both frameworks** side by side for different services
-   **Migrate gradually** by moving specific routes or services to XyPriss

```typescript
// Example: Using XyPriss security with Express
import express from "express";
import { XyPrissSecurity } from "xypriss-security";

const app = express();

// Add XyPriss security to your Express app
app.use(
    XyPrissSecurity.middleware({
        csrf: true,
        xss: true,
        rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
    })
);

app.listen(3000);
```

---

## Table of Contents

-   [Overview](#overview)
-   [Installation](#installation)
-   [Quick Start](#quick-start)
-   [Routing](#routing)
-   [File Upload](#file-upload)
-   [Multi-Server](#multi-server)
-   [Security](#security)
-   [Performance](#performance)
-   [Configuration](#configuration)
-   [Modules](#modules)
-   [Contributing](#contributing)
-   [License](#license)
-   [Support](#support)

---

## Routing

XyPriss provides a flexible routing system with support for parameters, wildcards, and modular routers.

### Basic Routes

```typescript
import { createServer } from "xypriss";

const app = createServer();

app.get("/", (req, res) => {
    res.json({ message: "Welcome to XyPriss" });
});

app.post("/users", (req, res) => {
    res.json({ message: "User created", data: req.body });
});

app.put("/users/:id", (req, res) => {
    res.json({ message: "User updated", id: req.params.id });
});
```

### Route Parameters

Extract dynamic segments from URLs:

```typescript
app.get("/users/:id", (req, res) => {
    res.json({ userId: req.params.id });
});

app.get("/users/:userId/posts/:postId", (req, res) => {
    res.json({ userId: req.params.userId, postId: req.params.postId });
});
```

### Wildcard Routes

-   **Single Wildcard (`*`)**: Matches one path segment.
-   **Multi-segment Wildcard (`**`)\*\*: Matches multiple path segments.

```typescript
app.get("/files/*", (req, res) => {
    res.json({ filename: req.params["*"] }); // e.g., "document.pdf"
});

app.get("/api/**", (req, res) => {
    res.json({ path: req.params["**"] }); // e.g., "v1/users/123"
});
```

### Modular Routers

Organize routes with routers:

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();
const userRouter = Router();

userRouter.get("/", (req, res) => {
    res.json({ message: "List users" });
});

userRouter.get("/:id", (req, res) => {
    res.json({ message: "Get user", id: req.params.id });
});

app.use("/api/users", userRouter);
```

### Middleware

Apply middleware globally, per route, or per router:

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
        if (!req.headers.authorization) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        next();
    },
    (req, res) => {
        res.json({ message: "Protected resource" });
    }
);
```

---

## File Upload

XyPriss provides powerful file upload support with **automatic error handling** and both class-based and functional APIs. No manual error handling required!

### Quick Start (Class-Based API - Recommended)

```typescript
import { createServer } from "xypriss";
import { FileUploadAPI } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ["image/jpeg", "image/png"],
    },
});

// Initialize file upload API
const fileUpload = new FileUploadAPI();
await fileUpload.initialize(app.options.fileUpload);

app.post("/upload", fileUpload.single("file"), (req, res) => {
    // Automatic error handling - only success code here!
    res.json({
        success: true,
        message: "File uploaded successfully",
        file: {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
        },
    });
});

app.start();
```

### Functional API (Simple)

```typescript
import { createServer } from "xypriss";
import { uploadSingle } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },
});

app.post("/upload", uploadSingle("file"), (req, res) => {
    // Automatic error handling - no try/catch needed!
    res.json({
        success: true,
        file: req.file,
    });
});

app.start();
```

### Automatic Error Responses

**File Too Large:**

```json
{
    "success": false,
    "error": "File too large",
    "message": "File size exceeds the maximum limit of 1.00MB",
    "details": {
        "maxSize": 1048576,
        "maxSizeMB": "1.00",
        "fileSize": "unknown"
    }
}
```

**File Type Not Allowed:**

```json
{
    "success": false,
    "error": "File type not allowed",
    "message": "File type 'application/exe' not allowed. Allowed types: image/jpeg, image/png"
}
```

### Features

-   ✅ **Automatic Error Handling**: Multer errors converted to user-friendly JSON responses
-   ✅ **Class-Based API**: Modern `FileUploadAPI` class for better organization
-   ✅ **Legacy Compatibility**: Functional API still available for simple use cases
-   ✅ **Multipart Support**: Fixed multipart/form-data handling (no more "Unexpected end of form" errors)
-   ✅ **Security**: Built-in file validation, type checking, and size limits
-   ✅ **Flexible Storage**: Memory, disk, or custom storage backends
-   ✅ **Type Safety**: Full TypeScript support with proper type definitions
-   ✅ **Performance**: Optimized for large file uploads with streaming support

For comprehensive documentation, configuration options, and advanced usage, see the [File Upload Guide](./docs/file-upload.md).

---

## Multi-Server

Run multiple server instances with different configurations from a single setup. Perfect for microservices, API versioning, or separating concerns.

### Basic Multi-Server Setup

```typescript
import { createServer } from "xypriss";

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
                allowedRoutes: ["/admin/*"],
                security: { level: "maximum" },
            },
        ],
    },
});

// Routes are automatically distributed to appropriate servers
app.get("/api/users", (req, res) => res.json({ service: "api" }));
app.get("/admin/dashboard", (req, res) => res.json({ service: "admin" }));

// Start all servers with a simple API
await app.startAllServers();
```

### Features

-   **Simple API**: `startAllServers()` and `stopAllServers()` hide complexity
-   **Automatic Route Distribution**: Routes are filtered and distributed automatically
-   **Server-Specific Overrides**: Each server can have different security, cache, and performance settings
-   **Microservices Ready**: Perfect for API versioning and service separation
-   **Load Balancing**: Built-in support for reverse proxy load balancing

For comprehensive multi-server documentation, see the [Multi-Server Guide](./docs/multi-server.md).

---

## Security

XyPriss includes 12 built-in security middleware modules to protect your application:

-   **CSRF Protection**: Via the `csrf-csrf` library.
-   **Security Headers**: Powered by Helmet for secure HTTP headers.
-   **CORS**: Configurable cross-origin resource sharing with wildcard pattern support.
-   **Rate Limiting**: Prevents abuse by limiting requests per IP.
-   **Input Validation**: Sanitizes inputs to prevent XSS and injection attacks.
-   **Request Logging**: Monitors and logs incoming requests.

Enable security features:

```typescript
import { createServer } from "xypriss";

const server = createServer({
    security: {
        enabled: true,
        csrf: { enabled: true },
        rateLimit: { max: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
    },
});
```

### CORS with Wildcard Support

XyPriss supports flexible CORS configuration with wildcard patterns:

```typescript
const server = createServer({
    security: {
        cors: {
            origin: [
                "localhost:*",        // Any localhost port
                "127.0.0.1:*",       // Any 127.0.0.1 port  
                "*.myapp.com",       // Any subdomain
                "https://app.prod.com" // Exact production URL
            ],
            credentials: true
        }
    }
});
```

**Supported patterns:**
- `localhost:*` - Matches any port on localhost
- `*.domain.com` - Matches any subdomain
- Exact URLs for production environments

For detailed CORS configuration, see the [Wildcard CORS Guide](./docs/WILDCARD_CORS.md).

For advanced security, use the `xypriss-security` module:

```typescript
import { createServer } from "xypriss";
import { fString, generateSecureToken } from "xypriss-security";

const server = createServer();

server.post("/api/secure", async (req, res) => {
    const secureData = fString(req.body.data, { enableEncryption: true });
    const token = generateSecureToken({ length: 32 });
    res.json({ token, data: secureData });
});
```

---

## Performance

XyPriss is designed for efficiency and scalability:

-   **Independent HTTP Server**: No Express dependency, reducing overhead.
-   **Clustering**: Automatic scaling based on CPU cores.
-   **Caching**: Supports memory, Redis, or hybrid caching strategies.
-   **Auto Port Switching**: Detects and switches ports if conflicts arise.

Example configuration:

```typescript
const server = createServer({
    server: {
        port: 3000,
        autoPortSwitch: { enabled: true, portRange: [3000, 3100] },
    },
    cache: {
        strategy: "memory",
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600, // 1 hour
    },
    cluster: { enabled: true, workers: "auto" },
});
```

---

## Configuration

Customize XyPriss with the `ServerOptions` interface:

```typescript
interface ServerOptions {
    env?: "development" | "production" | "test";
    server?: {
        port?: number;
        host?: string;
        autoPortSwitch?: {
            enabled: boolean;
            portRange?: [number, number];
            strategy?: "increment" | "random";
        };
    };
    cache?: {
        strategy?: "memory" | "redis" | "hybrid";
        maxSize?: number;
        ttl?: number;
        redis?: { host: string; port: number; cluster?: boolean };
    };
    security?: {
        enabled?: boolean;
        csrf?: { enabled: boolean };
        rateLimit?: { max: number; windowMs: number };
    };
    cluster?: {
        enabled: boolean;
        workers?: number | "auto";
    };
    fileUpload?: {
        maxFileSize?: number;
        allowedMimeTypes?: string[];
        storage?: {
            type?: "memory" | "disk" | "cloud";
            destination?: string;
            filename?: (req: any, file: any, cb: any) => void;
        };
        validation?: {
            enabled?: boolean;
            maxFiles?: number;
            minFileSize?: number;
            virusScan?: boolean;
        };
        security?: {
            sanitizeFilename?: boolean;
            removeExif?: boolean;
            watermark?: boolean;
        };
    };
    multiServer?: {
        enabled: boolean;
        servers: Array<{
            id: string;
            port: number;
            host?: string;
            routePrefix?: string;
            allowedRoutes?: string[];
            server?: object;
            security?: object;
            cache?: object;
            performance?: object;
            fileUpload?: object;
        }>;
    };
}
```

Example:

```typescript
const server = createServer({
    env: "production",
    server: { port: 8080, host: "0.0.0.0" },
    cache: { strategy: "redis", redis: { host: "localhost", port: 6379 } },
});
```

---

## Modules

### ACPES (Advanced Cross-Platform Encrypted Storage)

**Location**: `mods/ACPES/`

A secure storage solution for web, mobile, and Node.js environments.

**Features**:

-   AES-256 encryption with PBKDF2 key derivation.
-   HMAC-SHA256 for integrity verification.
-   TTL for automatic data expiration.
-   LZ-string compression for large data.

**Usage**:

```typescript
import { Storage, STORAGE_KEYS } from "xypriss-acpes";

await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "secure-token");
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
```

**Docs**: [ACPES Documentation](./mods/ACPES/docs/)

### Security Module

**Location**: `mods/security/`

Provides utilities for secure data handling and request protection.

**Features**:

-   Input sanitization and validation.
-   Cryptographic functions (e.g., secure token generation).
-   Rate limiting and DDoS protection.

**Docs**: [Security Documentation](./mods/security/docs/)

---

## Contributing

We welcome contributions! See the [Contributing Guide](./CONTRIBUTING.md) for details on how to get started.

---

## License

XyPriss is licensed under the [MIT License](./LICENSE).

---

## Support

-   [Documentation](./docs/)
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
-   [Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)

---

### Powered by Nehonix

[![Website](https://img.shields.io/badge/Website-nehonix.space-blue?style=for-the-badge&logo=globe)](https://nehonix.space)
[![GitHub](https://img.shields.io/badge/GitHub-Nehonix--Team-black?style=for-the-badge&logo=github)](https://github.com/Nehonix-Team)
[![Twitter](https://img.shields.io/badge/Twitter-@nehonix-1DA1F2?style=for-the-badge&logo=twitter)](https://twitter.com/nehonix)

