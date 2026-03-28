# XyPriss API Reference

**XyPriss** is a high-performance, hybrid framework that combines an ultra-fast Go engine (`xsys`) with a flexible, Express-compatible TypeScript application layer. This reference provides detailed information on all core APIs and configuration options.

---

## Core Entry Point

### `createServer(options?: ServerOptions)`

Initializes and returns a high-performance application instance integrated with the XyPriss system. The returned instance is fully compatible with Express.js middleware and routing.

**Parameters:**

- `options` (optional): An object defining server performance, security, and infrastructure settings.

**Returns:**
An instance of `UltraFastApp`.

**Example:**

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: { port: 3000 },
    cluster: { enabled: true, workers: "auto" },
});
```

---

## Server Configuration (`ServerOptions`)

| Category       | Property  | Description                                           |
| :------------- | :-------- | :---------------------------------------------------- |
| **Server**     | `port`    | Main listening port (Default: 3000).                  |
| **Server**     | `host`    | Binding interface (Default: `localhost`).             |
| **Cluster**    | `enabled` | Enables multi-core execution via Go workers.          |
| **Cluster**    | `workers` | Number of worker processes or `"auto"`.               |
| **Request**    | `timeout` | Enforced native-level request timeouts.               |
| **FileUpload** | `enabled` | Enables the high-performance Go-native upload engine. |

---

## Request & Response Enhancements

XyPriss provides a rich, Express-compatible interface with native-level performance.

### `XyPrisRequest` (req)

- **`req.ip` / `req.ips`**: Real client IP identification (Advanced proxy support).
- **`req.body`**: Securely parsed request body.
- **`req.query` / `req.params`**: Typed URL and route parameters.
- **`req.files` / `req.file`**: Native Go-parsed file metadata.
- **`req.get(header)`**: Case-insensitive header retrieval.

### `XyPrisResponse` (res)

- **`res.status(code)`**: Set HTTP status (Chainable).
- **`res.json(data)`**: Optimized JSON serialization with BigInt/Error support.
- **`res.send(body)`**: Automatic Content-Type detection (String, Buffer, Object).
- **`res.set(headers)`**: Bulk header assignment.
- **`res.cookie(name, val, opt)`**: Secure cookie management.

---

## Native Components

### File Upload (`app.upload`)

Accessible via the `upload` property on your app instance. Supports `single()`, `array()`, `fields()`, and `any()`.

**[Read the Full File Upload Guide](../features/file-upload.md)**

### System API (`__sys__`)

Global system access to high-performance Go-native utilities, including the enhanced **PathApi**.

**[Read the PathApi Reference](../system/xypriss-sys-resume-en.md)**

---

## Advanced Management

### Clustered Execution

When `cluster.enabled` is `true`, XyPriss utilizes Go's native worker pool management to distribute traffic across all available CPU cores.

```typescript
const app = createServer({
    cluster: {
        enabled: true,
        workers: "auto", // Detects logical cores automatically
    },
});
```

### Request Lifecycle Timeouts

Enforced at the Go-native level to ensure system responsiveness even if the application layer is under heavy load.

```typescript
requestManagement: {
    timeout: {
        enabled: true,
        defaultTimeout: 30000, // 30s
        routes: { "/api/upload": 60000 } // Custom per route
    }
}
```

---

## Public Utilities

### `getIp(req)`

A robust utility that extracts the real client IP address, accounting for multiple proxy layers and VPNs.

**[Read the Full getIp Guide](../features/get-ip.md)**

```typescript
import { getIp } from "xypriss";

app.get("/ip", (req, res) => {
    const realIp = getIp(req);
    res.send(`Your real IP is: ${realIp}`);
});
```

---

[← Back to Getting Started](./getting-started.md)

