# XStatic: High-Performance Static Delegation

## Overview

In traditional Node.js web frameworks, serving static files involves reading data from the disk into memory buffers, processing them through the JavaScript event loop, and finally writing them to the network socket. While functional, this approach introduces several bottlenecks:

1.  **Memory Overhead**: Every file read creates temporary buffers that increase garbage collection (GC) pressure.
2.  **Event Loop Blocking**: Large file transfers or high-concurrency static requests can saturate the event loop, delaying the execution of critical business logic.
3.  **Context Switching**: Constant data movement between kernel space (disk/network) and user space (Node.js) incurs CPU overhead.

**XStatic** solves these issues by implementing a **Zero-Copy IPC Delegation** architecture. Instead of serving files through Node.js, XyPriss validates the request in TypeScript and then "delegates" the actual data transfer to the native **XHSC (Go)** engine.

## Architecture

XStatic operates on a dual-layer fulfillment model:

### 1. The TypeScript Validation Layer
When a request hits an XStatic route, the framework performs several high-speed security and optimization checks:

*   **Sandbox Enforcement**: Strict URI normalization prevents directory traversal attacks (`..`, `//`). All paths are resolved relative to a secure root.
*   **LRU Meta-Cache**: An in-memory Least Recently Used (LRU) cache tracks negative lookups (404s). If a file is missing, XStatic rejects subsequent requests immediately without hitting the disk or the IPC bridge, providing built-in anti-DDoS protection.
*   **Existence Check**: Uses the native `FSApi` to verify file presence and type (ignoring directories) before delegation.

### 2. The Native Fulfillment Layer (XHSC)
Once validated, the TypeScript layer sends a specialized IPC signal to the XHSC engine containing the Request ID and the absolute path to the file.

*   **Zero-Copy Handover**: XHSC identifies the active TCP/HTTP connection associated with the Request ID.
*   **Kernel-Level Streaming**: XHSC uses Go's optimized `http.ServeContent`, which leverages `sendfile(2)` or similar OS-level primitives to transfer data directly from the disk to the network buffer, completely bypassing the Node.js memory space.
*   **Protocol Synchronization**: A specialized "Delegation Sentinel" (Status Code 0) ensures that the Node.js middleware chain terminates correctly without attempting to send its own response, while keeping the socket open for the native engine.

## Security & Reliability

XStatic is designed with "Secure by Default" principles:

*   **Path Isolation**: Files are served from a strictly defined sandbox. Accessing any file outside this directory is blocked at the normalization phase.
*   **Dotfile Protection**: By default, hidden files (starting with `.`) are ignored to prevent accidental leakage of sensitive data (e.g., `.env`, `.git`).
*   **Middleware Compatibility**: XStatic integrates seamlessly into the standard XyPriss middleware chain, allowing you to wrap static routes with authentication or logging.

## Usage

To enable XStatic, instantiate the component and define your routes:

```typescript
import { createServer, XStatic, __sys__ } from "xypriss";

const app = createServer();

// Initialize XStatic with the system context
const xs = new XStatic(app, __sys__);

// Define a static route: /assets will serve files from the 'public' folder
xs.define("/assets", "public", {
    maxAge: 3600,         // Cache-Control: max-age=3600
    allowOutsideRoot: false, // Strict sandbox
});

app.start();
```

## Performance Comparison

| Metric | Traditional Node.js (express.static) | XyPriss XStatic |
| :--- | :--- | :--- |
| **Throughput** | Limited by Event Loop / GC | Limited by Network / Disk IO |
| **CPU Usage** | High (Buffer copies + GC) | Minimal (Kernel delegation) |
| **Memory usage** | Proportional to file size/concurrency | Constant (Zero-Copy) |
| **Latency** | Milliseconds (JS overhead) | Sub-millisecond (Native fulfillment) |

## Summary

XStatic represents a shift from "File Streaming" to "File Delegation". By offloading the heavy lifting of data transfer to a compiled native engine while maintaining the security and flexibility of TypeScript for validation, XyPriss provides an enterprise-grade solution for serving assets at scale.
