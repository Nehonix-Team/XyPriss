# XHSC: XyPriss Hyper-System Core

**XHSC** (codenamed `xhsc`) is the high-performance cornerstone of the XyPriss framework. Written in **Go**, it is designed to be a lean, ultra-fast, and secure networking engine that powers the underlying infrastructure of XyPriss applications.

## Key Responsibilities

### 1. High-Performance Routing

Unlike traditional middleware-based routers that iterate sequentially in the JavaScript event loop, XHSC uses a specialized **Radix Tree (Trie)** implementation in Go for route matching.

- **Latency**: Microsecond-level lookup times, regardless of the number of routes.
- **Concurrency**: Native Go goroutines allow thousands of requests to be routed in parallel without blocking.
- **Support**: Handles static paths, dynamic parameters (`:id`), and wildcards (`*`).

### 2. Go-Node IPC Bridge

XHSC communicates with one or more Node.js worker processes via a high-speed **IPC Protocol** over Unix Domain Sockets (or Named Pipes on Windows).

- **Efficiency**: Offloads heavy I/O and multipart parsing to the Go engine.
- **Isolation**: Crashes in the application layer (Node.js) do not affect the stability of the gateway (XHSC).
- **Control**: Handles request timeouts and connection pooling at the native level.

### 3. Native Telemetry & Analytics

XHSC provides high-precision system metrics directly from the kernel, bypassing the overhead of Node.js `os` module calls.

- **Real-time Stats**: CPU per-core usage, Memory (available vs free), and Disk topology.
- **Process Tracking**: Detailed metrics for system processes with resource consumption filtering.
- **Hardware Inventory**: Built-in discovery of CPU brand, vendor, and core counts.

### 4. Security Gateway

Embedded security features at the native Go level:

- **Request Validation**: Early rejection of malformed or oversized requests.
- **Native File Uploads**: High-performance `multipart/form-data` parsing directly in Go, saving files to disk before Node.js even receives the request.
- **Concurrency Control**: Native-level tracking of active requests per IP to prevent starvation and DoS.

---

## Unified Timeout Management

XHSC implements a multi-layer timeout strategy:

- **Native Enforcement**: Go handles the gateway timeout, ensuring system resources are freed even if a worker process hangs.
- **Intelligent Queuing**: Requests waiting in the queue for too long are automatically rejected with `503 Service Unavailable`.
- **Worker Sync**: Timeouts are synchronized with Node.js to allow custom `onTimeout` handlers to run before the connection is severed.

## Intelligence Engine

The **Intelligence Engine** is a proactive system stability manager embedded within the Go core.

- **Resource Guardian**: Releases reserved memory buffer during extreme system pressure (>90%) to prevent OOM crashes.
- **Proactive GC**: Sends signals to Node.js workers to trigger garbage collection when memory thresholds are approached.
- **Rescue Mode**: Serves fallback responses instantly if all Node.js workers crash, providing "High Availability" during failures.

---

## Technical Specifications

- **Language**: Go
- **Concurrency**: Goroutines (CSP Model)
- **Router**: Native Radix Trie
- **Communication**: Custom JSON-IPC over Unix Sockets
- **I/O Engine**: High-performance Go `net/http` stack

---

[← Back to Core Architecture](./SERVER_CORE_ARCHITECTURE.md)

