# XHSC: XyPriss Hyper-System Core

**XHSC** (codenamed `xhsc`) is the high-performance cornerstone of the XyPriss framework. Written in **Go**, it is designed to be a lean, ultra-fast, and secure networking engine that powers the underlying infrastructure of XyPriss applications.

## Key Responsibilities

### 1. High-Performance Routing

Unlike traditional middleware-based routers that iterate sequentially in the JavaScript event loop, XHSC uses a specialized **Radix Tree (Trie)** implementation for route matching.

- **Latency**: Microsecond-level lookup times, regardless of the number of routes.
- **Concurrency**: Native XHSC concurrency allow thousands of requests to be routed in parallel without blocking.
- **Support**: Handles static paths, dynamic parameters (`:id`), and wildcards (`*`).

### 2. XHSC IPC Bridge

The bridge is the high-performance link between the native core and the Node.js application layer.

- **Zero-Copy Intent**: Optimized to minimize memory cloning during bridging.
- **Efficiency**: Offloads heavy I/O and multipart parsing to the XHSC core.
- **Isolation**: Crashes in the application layer (Node.js) do not affect the stability of the gateway (XHSC).
- **Control**: Handles request timeouts and connection pooling at the native level.

### 3. Native Traffic Guardrails

Embedded security features at the native XHSC level:

- **Rate Limiting**: Regex-based rate limiting performed at the networking level before reaching the app.
- **Native File Uploads**: High-performance `multipart/form-data` parsing directly in XHSC, saving files to disk before Node.js even receives the request.
- **Header Sanitization**: Automatic normalization of incoming headers to prevent injection and ensure compliance.

### 4. Gateway Enforcement

XHSC manages the absolute request lifecycle:

- **Native Enforcement**: XHSC handles the gateway timeout, ensuring system resources are freed even if a worker process hangs.
- **Isolation**: Crashes in the worker layer don't affect the master gateway.
- **Worker Sync**: Timeouts are synchronized with Node.js to allow custom `onTimeout` handlers to run before the connection is severed.

### 5. System Intelligence (XSI)

The **Intelligence Engine** is a proactive system stability manager embedded within the native core.

- **Telemetry**: Direct access to hardware metrics (CPU/Memory/Thermal).
- **Proactive Scaling**: Can trigger worker recycling based on health metrics.
- **Resource Guardian**: Releases reserved memory buffer during extreme system pressure (>90%) to prevent OOM crashes.
- **Proactive GC**: Sends signals to Node.js workers to trigger garbage collection when memory thresholds are approached.
- **Rescue Mode**: Serves fallback responses instantly if all Node.js workers crash, providing "High Availability" during failures.

---

## Technical Specifications

- **Language**: Go (Native)
- **Concurrency**: Goroutines (CSP Model)
- **Router**: Native Radix Trie
- **Communication**: Custom JSON-IPC over Unix Sockets
- **I/O Engine**: High-performance XHSC `net/http` stack

---

[← Back to Core Architecture](./SERVER_CORE_ARCHITECTURE.md)

