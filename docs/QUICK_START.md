# Quick Start Guide

Get started with XyPriss in a few simple steps.

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

## Method 1: Using XyPriss CLI (Recommended)

The CLI provides the fastest way to initialize a new project with best practices:

```bash
# Install the CLI globally
npm install -g xypriss-cli

# Create a new project
xypcli init

# Start development
cd your-project-name
npm run dev
```

The CLI automatically generates:

-   Project structure with TypeScript configuration
-   Authentication setup (optional)
-   File upload support (optional)
-   Multi-server configuration (optional)
-   Security middleware configuration

---

## Method 2: Manual Setup

### Basic Server

```typescript
import { createServer } from "xypriss";

const server = createServer({
    server: { port: 3000 },
    security: { enabled: true },
});

server.get("/", (req, res) => {
    res.json({ message: "Server running" });
});

server.start(() => {
    console.log(`Server running at http://localhost:${server.getPort()}`);
});
```

### With Routing

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();
const userRouter = Router();

userRouter.get("/:id", (req, res) => {
    res.json({ userId: req.params.id });
});

app.use("/api/users", userRouter);
app.start();
```

### With File Upload

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

app.start();
```

### With Security Configuration

```typescript
const server = createServer({
    security: {
        enabled: true,
        level: "enhanced",
        cors: {
            origin: ["localhost:*", "*.myapp.com"],
            credentials: true,
        },
        rateLimit: {
            max: 100,
            windowMs: 15 * 60 * 1000,
        },
        csrf: { enabled: true },
        xss: { enabled: true },
    },
});
```

---

## Common Use Cases

### REST API Server

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: { enabled: true },
    cors: { origin: "*" },
});

app.get("/api/users", (req, res) => {
    res.json({ users: [] });
});

app.post("/api/users", (req, res) => {
    res.json({ created: true });
});

app.start();
```

### Multi-Server Setup

```typescript
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 3001,
                routePrefix: "/api",
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

### Production Deployment with XyNginC

```typescript
import { createServer } from "xypriss";
import XNCP from "xynginc";

const app = createServer({
    plugins: {
        register: [
            XNCP({
                domains: [
                    {
                        domain: "api.example.com",
                        port: 3000,
                        ssl: true,
                        email: "admin@example.com",
                    },
                ],
            }),
        ],
    },
});

app.start();
```

---

## Next Steps

-   [Routing Guide](./ROUTING.md) - Configure routes, parameters, and middleware
-   [Security Guide](./SECURITY.md) - Implement CORS, CSRF, and rate limiting
-   [File Upload Guide](./FILE_UPLOAD_GUIDE.md) - Handle file uploads
-   [Configuration Reference](./CONFIGURATION.md) - Complete configuration options
-   [API Reference](./api-reference.md) - Full API documentation

---

## Troubleshooting

### Port Already in Use

XyPriss automatically switches ports if the configured port is unavailable:

```typescript
const server = createServer({
    server: {
        port: 3000,
        autoPortSwitch: {
            enabled: true,
            portRange: [3000, 3100],
        },
    },
});
```

### CORS Configuration

Enable CORS for specific domains:

```typescript
const server = createServer({
    security: {
        cors: {
            origin: ["http://localhost:3000", "https://myapp.com"],
            credentials: true,
        },
    },
});
```

### File Upload Configuration

Configure file upload settings:

```typescript
const server = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ["image/jpeg", "image/png"],
    },
});
```

---

## Additional Resources

-   [Documentation](../docs/) - Complete guides
-   [Examples](./EXAMPLES.md) - Code examples
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues) - Report bugs
-   [GitHub Discussions](https://github.com/Nehonix-Team/XyPriss/discussions) - Community support

