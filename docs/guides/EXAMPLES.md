# XyPriss Examples

Practical code examples for common use cases.

## Table of Contents

- [Basic Server](#basic-server)
- [REST API](#rest-api)
- [File Upload](#file-upload)
- [Authentication](#authentication)
- [Multi-Server](#multi-server)
- [Security](#security)
- [Production Deployment](#production-deployment)

---

## Basic Server

```typescript
import { createServer } from "xypriss";

const server = createServer({
  server: { port: 3000 },
});

server.get("/", (req, res) => {
  res.xJson({ message: "Server running" });
});

server.start();
```

---

## REST API

```typescript
import { createServer, Router } from "xypriss";

const app = createServer();

// Users Router
const usersRouter = Router();

usersRouter.get("/", (req, res) => {
  res.xJson({ users: [] });
});

usersRouter.get("/:id", (req, res) => {
  res.xJson({ userId: req.params.id });
});

usersRouter.post("/", (req, res) => {
  res.xJson({ created: true, user: req.body });
});

usersRouter.put("/:id", (req, res) => {
  res.xJson({ updated: true, userId: req.params.id });
});

usersRouter.delete("/:id", (req, res) => {
  res.xJson({ deleted: true, userId: req.params.id });
});

app.use("/api/users", usersRouter);
app.start();
```

---

## File Upload

### Single File Upload

```typescript
import { createServer, FileUploadAPI } from "xypriss";

const app = createServer({
  fileUpload: {
    enabled: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    uploadDir: "./uploads",
  },
});

const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.xJson({
    success: true,
    file: {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

app.start();
```

### Multiple Files Upload

```typescript
app.post("/upload-multiple", upload.array("files", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  res.xJson({
    success: true,
    files: req.files.map((f) => ({
      filename: f.filename,
      size: f.size,
    })),
  });
});
```

---

## Authentication

### JWT Authentication

```typescript
import { createServer } from "xypriss";
import jwt from "jsonwebtoken";

const app = createServer();
const SECRET = "your-secret-key";

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Login endpoint
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;

  // Validate credentials
  if (username === "admin" && password === "password") {
    const token = jwt.sign({ username }, SECRET, { expiresIn: "1h" });
    return res.xJson({ token });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// Protected route
app.get("/api/protected", authMiddleware, (req, res) => {
  res.xJson({ message: "Access granted", user: req.user });
});

app.start();
```

---

## Multi-Server

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
        security: {
          level: "enhanced",
          rateLimit: { max: 100 },
        },
      },
      {
        id: "admin-server",
        port: 3002,
        routePrefix: "/admin",
        allowedRoutes: ["/admin/*"],
        security: {
          level: "maximum",
          rateLimit: { max: 50 },
        },
      },
      {
        id: "public-server",
        port: 3003,
        routePrefix: "/",
        security: {
          level: "basic",
        },
      },
    ],
  },
});

// API routes
app.get("/api/data", (req, res) => {
  res.xJson({ data: "API response" });
});

// Admin routes
app.get("/admin/dashboard", (req, res) => {
  res.xJson({ dashboard: "Admin panel" });
});

// Public routes
app.get("/", (req, res) => {
  res.xJson({ message: "Public homepage" });
});

await app.start();
```

---

## Security

### Complete Security Configuration

```typescript
import { createServer } from "xypriss";

const app = createServer({
  security: {
    enabled: true,
    level: "enhanced",

    // CORS
    cors: {
      origin: ["http://localhost:3000", "https://myapp.com"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
    },

    // CSRF Protection
    csrf: {
      enabled: true,
      cookieName: "_csrf",
    },

    // Rate Limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: "Too many requests",
    },

    // XSS Protection
    xss: {
      enabled: true,
      mode: "block",
    },

    // Helmet Security Headers
    helmet: {
      enabled: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    },
  },
});

app.start();
```

### Custom Security Middleware

```typescript
// IP Whitelist
const ipWhitelist = ["127.0.0.1", "192.168.1.1"];

app.use((req, res, next) => {
  const clientIp = req.ip;

  if (!ipWhitelist.includes(clientIp)) {
    return res.status(403).json({ error: "IP not allowed" });
  }

  next();
});

// API Key Authentication
app.use("/api/*", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== "your-secret-api-key") {
    return res.status(401).json({ error: "Invalid API key" });
  }

  next();
});
```

---

## Production Deployment

### With XyNginC (Automated Nginx + SSL)

```typescript
import { createServer } from "xypriss";
import XNCP from "xynginc";

const app = createServer({
  server: {
    port: 3000,
  },
  plugins: {
    register: [
      XNCP({
        domains: [
          {
            domain: "api.example.com",
            port: 3000,
            ssl: true,
            email: "admin@example.com",
            autoRenew: true,
          },
          {
            domain: "admin.example.com",
            port: 3001,
            ssl: true,
            email: "admin@example.com",
          },
        ],
        nginx: {
          clientMaxBodySize: "50M",
          proxyTimeout: 60,
        },
      }),
    ],
  },
});

app.start();
```

### With Clustering

```typescript
const app = createServer({
  cluster: {
    enabled: true,
    workers: "auto", // Use all CPU cores
    respawn: true,
  },
  cache: {
    strategy: "redis",
    redis: {
      host: "localhost",
      port: 6379,
    },
  },
});
```

### With Environment Variables

```typescript
import { createServer } from "xypriss";
import dotenv from "dotenv";

dotenv.config();

const app = createServer({
  server: {
    port: parseInt(process.env.PORT || "3000"),
  },
  security: {
    enabled: process.env.NODE_ENV === "production",
    level: process.env.SECURITY_LEVEL || "enhanced",
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["*"],
    },
  },
  database: {
    url: process.env.DATABASE_URL,
  },
});

app.start();
```

---

## Advanced Examples

### WebSocket Integration

```typescript
import { createServer } from "xypriss";
import { Server as SocketIO } from "socket.io";

const app = createServer();
const httpServer = app.getHttpServer();
const io = new SocketIO(httpServer);

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("message", (data) => {
    io.emit("message", data);
  });
});

app.start();
```

### Database Integration (MongoDB)

```typescript
import { createServer } from "xypriss";
import mongoose from "mongoose";

const app = createServer();

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI);

// Define schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const User = mongoose.model("User", UserSchema);

// Routes
app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.xJson({ users });
});

app.post("/api/users", async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.xJson({ user });
});

app.start();
```

---

## Additional Resources

For more examples and detailed documentation:

- [GitHub Repository Examples](https://github.com/Nehonix-Team/XyPriss/tree/main/examples)
- [Complete Documentation](../docs/)
- [API Reference](../docs/api-reference.md)

For support:

- [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
- [GitHub Discussions](https://github.com/Nehonix-Team/XyPriss/discussions)
