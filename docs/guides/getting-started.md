# Getting Started with XyPriss

XyPriss is a high-performance framework designed for speed, security, and scalability. This guide will walk you through setting up your environment and building your first ultra-fast application.

## 1. Prerequisites

Before installing XyPriss, ensure you have the following:

- **Node.js**: v18.0.0 or higher.
- **XFPM**: The [XyPriss Fast Package Manager](https://github.com/Nehonix-Team/XFMP) (Recommended).

### Installing XFPM

XFPM is the high-performance package manager for the XyPriss ecosystem. It is mandatory for professional workflows and provides strict dependency isolation.

**Unix / macOS / WSL:**

```bash
curl -sL https://xypriss.nehonix.com/install.js | node
```

**Windows (PowerShell):**

```powershell
Invoke-RestMethod -Uri "https://xypriss.nehonix.com/install.js" -UseBasicParsing | node
```

> [!TIP]
> Learn more about the XyPriss CLI on [npm](https://www.npmjs.com/package/xypriss-cli).

---

## 2. Installation

Initialize your project and install the `xypriss` core:

```bash
xfpm init
xfpm add xypriss
```

For advanced security features, add the security module:

```bash
xfpm add xypriss-security
```

---

## 3. Your First Server

Create a file named `index.ts`:

```typescript
import { createServer } from "xypriss";

// Initialize the server
const app = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
});

// Define a route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Hello from XyPriss Go-Native Bridge!",
    });
});

// Start the engine
app.start(3000, () => {
    console.log("🚀 XyPriss is flying on http://localhost:3000");
});
```

---

## 4. Running the Application

Use `xfpm run` or `bun` to execute your scripts with optimal performance:

```bash
xfpm run index.ts
```

---

## 5. Next Steps

- **Native File Uploads**: Master the high-performance file system in the [File Upload Tutorial](../features/file-upload.md).
- **Architecture**: Understand how the Go engine and Node.js work together in the [Architecture Guide](../core/SERVER_CORE_ARCHITECTURE.md).
- **API Reference**: Detailed documentation of all methods in the [API Reference](../core/api-reference.md).

