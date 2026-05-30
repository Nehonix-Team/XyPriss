# XStatic: High-Performance Static Delegation (XHSC Fast Path)

## Overview

In traditional Node.js web frameworks, serving static files involves reading data from the disk into memory buffers, processing them through the JavaScript event loop, and finally writing them to the network socket. While functional, this approach introduces several bottlenecks:

1.  **Memory Overhead**: Every file read creates temporary buffers that increase garbage collection (GC) pressure.
2.  **Event Loop Blocking**: Large file transfers or high-concurrency static requests can saturate the event loop, delaying the execution of critical business logic.
3.  **Context Switching**: Constant data movement between kernel space (disk/network) and user space (Node.js) incurs CPU overhead.

**XStatic** solves these issues by implementing a **Native XHSC Fast Path Interception** architecture. Node.js is completely **100% bypassed** during the actual request lifecycle. Instead, routes and security configurations are synced to the native **XHSC (Go)** engine upon startup. Go then intercepts the traffic at the TCP level and serves the files natively.

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

By default, XStatic operates in a **Strict Sandbox** mode. When `define()` is called, Node.js synchronously verifies that the target directory is within the project root. The route is only synchronized to Go if this check passes. 

Additionally, any malicious URL like `/static/../../.env` is blocked instantly by Go's native path-cleaning before the file system is even accessed.

```typescript
xs.define("/assets", "./public", {
    allowOutsideRoot: false, // Default behavior
    maxAge: "1d"             // Caching for 24 hours
});
```

*   **Behavior**: Any attempt to mount a path outside your project root fails on startup. Any request attempting path traversal (`../`) is cleaned and resolved inside the sandbox.
*   **Security**: This is the recommended setting for almost all web applications.

### Case 2: Shared Assets (Cross-Root Access)

In some advanced scenarios, you might need to serve files from a shared directory that is not located within your project's root folder (e.g., a shared NAS mount or a global assets folder).

```typescript
xs.define("/global", "/mnt/shared/images", {
    allowOutsideRoot: true,
    maxAge: 3600
});
```

*   **Behavior**: XStatic disables the startup Sandbox check and syncs `/mnt/shared/images` to Go. Go will still normalize the URI to prevent directory traversal relative to `/mnt/shared/images`, ensuring requests cannot escape the shared folder.

---

## Global Configuration via `ServerOptions`

Global settings in `createServer` define the default security and performance policy for all static instances. These policies are passed down to the Go engine as startup flags.

```typescript
const app = createServer({
    static: {
        dotfiles: "deny",
        zeroCopy: true,
        concurrencyPool: 2048
    }
});
```

### 1. `dotfiles` (Native Enforcement)
Controls access to hidden files (e.g., `.env`, `.git`). Since Node.js is bypassed, this rule is strictly enforced by the Go engine.

*   **Options**: 
    *   `deny`: Returns `403 Forbidden` instantly for any file starting with `.`.
    *   `ignore`: Returns `404 Not Found` (stealth mode) for any file starting with `.`.
    *   `allow`: Serves the file (Not recommended).
*   **Expected Behavior**: Go inspects the base filename. If it matches the dot-prefix policy, it halts the request immediately.

### 2. `zeroCopy`
Enables the native `sendfile(2)` optimization in the Go engine.

*   **Explanation**: Data is transferred directly from disk to the TCP socket at the OS kernel level without intermediate memory copies.
*   **Expected Behavior**: Drastic reduction in CPU and RAM usage during high-concurrency file serving. Node.js heap memory remains completely unaffected.

### 3. `concurrencyPool`
Limits the maximum number of concurrent I/O goroutines in the native engine.

*   **Explanation**: Prevents system resource exhaustion (file descriptors/CPU) under extreme load.

---

## Performance Metrics

| Metric | Traditional Node.js | XyPriss XStatic (Fast Path) |
| :--- | :--- | :--- |
| **Throughput** | ~5,000 req/s | **~12,000+ req/s** |
| **Memory usage** | Grows with concurrency | **Constant (Zero-Copy)** |
| **CPU Overhead** | High (GC + Buffer Copy) | **Negligible (Kernel Handover)** |
| **Node.js Event Loop** | Heavily blocked | **0% Blocked** |

---

## Summary

XStatic completely revolutionizes static file delivery. By synchronizing routing tables and security policies (like `allowOutsideRoot` and `dotfiles`) down to the XHSC engine, Node.js delegates 100% of the workload. This achieves Enterprise-Grade throughput and sub-millisecond latency, while your Node.js application remains exclusively dedicated to executing your dynamic business logic.
