# Server Core Architecture

XyPriss features a unique **Hybrid Architecture** that combines the raw performance of **Go** with the high-level productivity of **TypeScript**. This dual-core approach ensures microsecond routing latency while maintaining the rich ecosystem of Node.js.

## The Hybrid Strategy

XyPriss is composed of two primary layers that work in tandem:

### 1. XHSC (XyPriss Hyper-System Core) - The Go engine

The "hot path" of the server is implemented in Go (codenamed `xsys`). This layer is responsible for:

- **Direct Network Handling**: Manages the low-level TCP/HTTP(S) stack for maximum throughput.
- **Nano-Routing**: Uses a high-performance **Radix Tree** implementation to match incoming requests to their handlers with microsecond precision.
- **System Intelligence**: Real-time hardware telemetry and system-level monitoring (CPU, RAM, Disk).
- **Native File Uploads**: Streams multipart data directly to disk, offloading heavy I/O from the Node.js event loop.

### 2. TypeScript/Node.js Layer - The Application core

The high-level logic where developers spend most of their time. This layer handles:

- **Business Logic**: Complex application rules and data processing.
- **Security Middlewares**: A stack of 12+ enterprise-grade security modules (CSRF, XSS, etc.).
- **Plugin Management**: Permission-based extensions that enhance server capabilities.
- **IPC Bridge**: Communicates with XHSC via a high-speed inter-process communication bridge to receive and respond to HTTP requests.

---

## Request Lifecycle

1.  **Ingress**: A request hits the **XHSC (Go)** engine.
2.  **Fast Match**: XHSC immediately performs a Radix Tree lookup to identify the route.
3.  **Preprocessing**: If it's a file upload, XHSC parses the `multipart/form-data` and saves files to `.private/uploads`.
4.  **Dispatch**: The request (and file metadata) is bridged to the **Node.js** layer via a high-performance IPC mechanism.
5.  **Enhancement**: Node.js decorates the raw message with `RequestEnhancer` and `ResponseEnhancer` for Express-compatible APIs.
6.  **Middleware Stack**: The request passes through the configured security and utility middlewares.
7.  **Handler**: The route handler or plugin logic executes and produces a response.
8.  **Egress**: The response is sent back through the bridge to XHSC, which delivers it to the client.

## Core Components

### XHSCBridge

The specialized component in Node.js that manages the lifecycle of the Go binary (`xsys`) and handles the binary-level communication.

### HttpServer (Virtual Server)

A virtualized server implementation in Node.js that mimics the native Node.js `http.Server` API while delegating actual network listening to XHSC.

### Request & Response Enhancers

Modules that transform low-level IPC messages into feature-rich objects supported by the XyPriss API, providing methods like `res.json()`, `res.send()`, and cookie management.

---

## Performance Benefits

- **Eliminated Node.js Event Loop Blockage**: Low-level networking and heavy file I/O don't compete with application JS for the event loop.
- **Parallel Routing**: XHSC matching happens in native Go goroutines, allowing high concurrency even under heavy load.
- **Reduced Memory Overhead**: Static assets and routing tables are handled in Go's efficient memory model.

---

[← Back to Features Overview](./FEATURES_OVERVIEW.md) • [Deep Dive into XHSC Intelligence](./XHSC_CORE.md)

