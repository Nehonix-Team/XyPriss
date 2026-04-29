# XStatic: High-Performance Static Delegation

## Overview

In traditional Node.js web frameworks, serving static files involves reading data from the disk into memory buffers, processing them through the JavaScript event loop, and finally writing them to the network socket. While functional, this approach introduces several bottlenecks:

1.  **Memory Overhead**: Every file read creates temporary buffers that increase garbage collection (GC) pressure.
2.  **Event Loop Blocking**: Large file transfers or high-concurrency static requests can saturate the event loop, delaying the execution of critical business logic.
3.  **Context Switching**: Constant data movement between kernel space (disk/network) and user space (Node.js) incurs CPU overhead.

**XStatic** solves these issues by implementing a **Zero-Copy IPC Delegation** architecture. Instead of serving files through Node.js, XyPriss validates the request in TypeScript and then "delegates" the actual data transfer to the native **XHSC (Go)** engine.

---

## Basic Usage

To enable XStatic, instantiate the component and define your routes:

```typescript
import { XStatic, createServer, __sys__ } from "xypriss";

const app = createServer();
const xs = new XStatic(app, __sys__);

// Define a static route
xs.define("/static", "public");

app.start();
```

---

## Configuration Examples (Local Options)

### Case 1: Secure Sandbox (Default)

By default, XStatic operates in a **Strict Sandbox** mode. It ensures that even if a malicious user tries to craft a URL like `/static/../../.env`, the framework will block the request.

```typescript
xs.define("/assets", "./public", {
    allowOutsideRoot: false, // Default behavior
    maxAge: "1d"             // Caching for 24 hours
});
```

*   **Behavior**: Any attempt to resolve a path that ends up outside the `./public` directory will result in a `403 Forbidden` response.
*   **Security**: This is the recommended setting for almost all web applications.

### Case 2: Shared Assets (Cross-Root Access)

In some advanced scenarios, you might need to serve files from a shared directory that is not located within your project's root folder (e.g., a shared NAS mount or a global assets folder).

```typescript
xs.define("/global", "/mnt/shared/images", {
    allowOutsideRoot: true,
    maxAge: 3600
});
```

*   **Behavior**: XStatic will still normalize the URI to prevent directory traversal relative to the `/mnt/shared/images` path, but it will allow the final resolved path to exist anywhere on the system as long as it starts with that root.

---

## Global Configuration via `ServerOptions`

Global settings in `createServer` define the default security and performance policy for all static instances.

```typescript
const app = createServer({
    static: {
        lruCacheSize: 10000,
        dotfiles: "deny",
        zeroCopy: true,
        concurrencyPool: 2048,
        defaultMaxAge: "1d"
    }
});
```

### 1. `lruCacheSize`
Sets the size of the Meta-Cache (LRU) for negative path lookups.

*   **Explanation**: This cache stores the state of non-existent files.
*   **Expected Behavior**: If a bot spams `GET /static/fake.png`, XStatic checks the disk once, then serves a `404` directly from RAM for subsequent requests, saving disk I/O.
*   **Example**:
    ```typescript
    // Config: lruCacheSize: 5000
    // Request 1: /static/unknown.jpg -> Disk Check -> 404
    // Request 2-1000: /static/unknown.jpg -> RAM Check -> 404 (Instant)
    ```

### 2. `dotfiles`
Controls access to hidden files (e.g., `.env`, `.git`).

*   **Explanation**: Prevents accidental exposure of sensitive system configuration.
*   **Expected Behavior**: 
    *   `deny`: Returns `403 Forbidden` instantly.
    *   `allow`: Serves the file (Not recommended).
*   **Example**:
    ```typescript
    // Config: dotfiles: "deny"
    // Request: GET /static/.env -> 403 Forbidden
    ```

### 3. `zeroCopy`
Enables the native `sendfile(2)` optimization in the Go engine.

*   **Explanation**: Data is transferred directly from disk to network without intermediate memory copies.
*   **Expected Behavior**: Drastic reduction in CPU and RAM usage during high-concurrency file serving.
*   **Example**:
    ```typescript
    // Config: zeroCopy: true
    // Result: Node.js memory stays flat even while serving 10GB files to 1000 clients.
    ```

### 4. `concurrencyPool`
Limits the maximum number of concurrent I/O goroutines in the native engine.

*   **Explanation**: Prevents system resource exhaustion (file descriptors/CPU) under extreme load.
*   **Expected Behavior**: New static requests wait in a high-speed queue if the pool is saturated.
*   **Example**:
    ```typescript
    // Config: concurrencyPool: 1024
    // 1025th concurrent request will be queued until a worker finishes.
    ```

### 5. `defaultMaxAge`
Provides a default `Cache-Control` policy.

*   **Example**:
    ```typescript
    // Config: defaultMaxAge: "1h"
    // Result: Header "Cache-Control: public, max-age=3600" is added automatically.
    ```

---

## Performance Metrics

| Metric | Traditional Node.js | XyPriss XStatic |
| :--- | :--- | :--- |
| **Throughput** | ~5,000 req/s | **~45,000+ req/s** |
| **Memory usage** | Grows with concurrency | **Constant (Zero-Copy)** |
| **CPU Overhead** | High (GC + Buffer Copy) | **Minimal (Kernel Handover)** |

---

## Summary

XStatic represents a shift from "File Streaming" to **"File Delegation"**. By offloading the heavy lifting of data transfer to a compiled native engine while maintaining the security and flexibility of TypeScript for validation, XyPriss provides an enterprise-grade solution for serving assets at scale with sub-millisecond latency.
