# XStatic: High-Performance Static File Serving

XStatic is the specialized subsystem of the XyPriss framework designed for high-performance, Zero-Trust compliant static file serving. It leverages the XHSC (XyPriss Hyper-System Core) engine to delegate heavy I/O operations to a native Go-based implementation, ensuring optimal throughput and minimal CPU overhead for the V8 engine.

## Architectural Overview

Traditional static serving middleware often introduces significant performance bottlenecks due to the overhead of moving file buffers through the Node.js memory heap. XStatic resolves this by employing a delegation model:

1. **Validation Layer (TypeScript)**: The XyPriss application validates the request, normalizes the path, and enforces security policies (Sandbox/Zero-Trust).
2. **Delegation Layer (IPC)**: Once validated, a pointer to the physical file is passed via Inter-Process Communication to the XHSC engine.
3. **Execution Layer (Go)**: The XHSC engine utilizes the `sendfile()` system call (Zero-Copy) to stream the file directly from the filesystem to the TCP socket, bypassing the Node.js event loop for the actual data transfer.

## Implementation Guide

The legacy `app.static()` middleware is deprecated and disabled in Zero-Trust mode. XStatic must be instantiated manually to ensure strict binding to the application instance and system interface.

### Basic Initialization

To enable static file serving, instantiate `XStatic` and define your routes:

```typescript
import { createServer, XStatic, __sys__ } from "xypriss";

const app = createServer();

// Instantiate the manager with application and system context
const xs = new XStatic(app, __sys__);

// Define a static route
xs.define("/static", "public");
```

### Security & Sandboxing

XStatic enforces a Zero-Trust architecture by default.

- **Root Isolation**: Files are served exclusively from the project root unless explicitly overridden.
- **Path Normalization**: All requested paths are normalized to prevent directory traversal attacks (`../`).
- **Dotfile Protection**: Access to hidden files (e.g., `.env`, `.git`) is denied by default.

To serve files outside the project root or bypass certain checks, use the configuration object:

```typescript
xstatic.define("/external", "/var/www/shared", {
    allowOutsideRoot: true,
    unsafe: false
});
```

## Performance Optimization

XStatic includes several mechanisms to ensure stability under heavy load.

### Anti-DDoS LRU Cache

To prevent filesystem saturation from malicious "404 spamming" (requests for non-existent files), XStatic maintains an in-memory Least Recently Used (LRU) cache. Metadata for non-existent or blocked paths is stored in RAM, allowing XyPriss to reject subsequent identical invalid requests instantly without performing a disk seek or engine delegation.

### Concurrency Management

The XHSC engine manages I/O operations through a dedicated goroutine pool. The concurrency level and zero-copy behavior can be configured globally during server creation:

```typescript
const app = createServer({
    static: {
        zeroCopy: true,
        ConcurrencyPool: 1024,
        lruCacheSize: 5000,
        dotfiles: "deny",
        maxAge: "1d"
    }
});
```

## Configuration Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `zeroCopy` | boolean | `true` | Enables the `sendfile()` system call for direct kernel-to-socket transfers. |
| `ConcurrencyPool` | number | `1024` | Maximum number of concurrent I/O operations in the Go engine. |
| `lruCacheSize` | number | `5000` | Number of path metadata entries stored in the anti-DDoS memory cache. |
| `dotfiles` | string | `"deny"` | Policy for hidden files: `"deny"`, `"allow"`, or `"ignore"`. |
| `maxAge` | string | `"1d"` | Default `Cache-Control` max-age header for served assets. |
| `allowOutsideRoot`| boolean | `false` | Permits serving files from outside the verified project root. |
| `unsafe` | boolean | `false` | Bypasses standard security validations for specific high-trust routes. |
