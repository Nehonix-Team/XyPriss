# XHSC: XyPriss Hybrid Server Core

**XHSC** is the high-performance cornerstone of the XyPriss framework. Written in **Rust**, it is designed to be a lean, ultra-fast, and secure networking engine that powers the underlying infrastructure of XyPriss applications.

## Key Responsibilities

### 1. High-Performance Routing

Unlike traditional middleware-based routers that iterate sequentially, XHSC uses a **Radix Tree (Trie)** for route matching.

-   **Latency**: Nanosecond-to-microsecond lookup times.
-   **Concurrency**: Lock-free read operations allow multiple requests to be routed in parallel without lock contention.
-   **Support**: Handles static paths, dynamic parameters (`:id`), and wildcards (`*`).

### 2. IPC Bridge Architecture

XHSC communicates with one or more Node.js worker processes via a specialized **IPC Bridge**.

-   **Efficiency**: Optimized binary communication over Unix Domain Sockets or Pipes.
-   **Isolation**: Crashes in the application layer (Node.js) do not affect the stability of the gateway (XHSC).
-   **Control**: Handles request timeouts and connection keep-alive at the native level.

### 3. Native Telemetry

XHSC provides high-precision system metrics without the overhead of spawner-based collectors.

-   **Real-time Stats**: Memory usage, CPU load, and network throughput.
-   **Hardware Info**: Built-in discovery of CPU cores, architecture, and disk topology.
-   **Cache-Optimized**: Intelligent caching of system calls to reduce kernel overhead.

### 4. Security Gateway

Embedded security features at the native level:

-   **Request Validation**: Early rejection of malformed or oversized requests before they hit the JS engine.
-   **Rate Limiting**: Native-level tracking of request rates for ultra-efficient blocking.
-   **TLS/SSL**: Capability to handle encryption natively for industry-standard performance.

## Unified Timeout Management

XHSC implements a multi-layer timeout strategy that synchronizes native enforcement with application-level callbacks.

-   **Native Enforcement**: Rust handles the gateway timeout, ensuring system resources are freed even if a worker process hangs.
-   **Node.js Synchronization**: The bridge automatically calculates the maximum timeout across all routes and applies it to the Rust gateway with a **+2 second buffer**.
-   **Callback Support**: The buffer ensures that JavaScript `onTimeout` handlers have the chance to execute and return custom responses before the native layer cuts the connection.
-   **Infinite Mode**: Setting `enabled: false` in the configuration instructs Rust to use an "unlimited" timeout (100 years), effectively disabling the enforcement layer while maintaining the structured IPC protocol.

## Ultra-Low Latency Concurrency Control

XHSC leverages Rust's async runtime to provide concurrency controls that are orders of magnitude faster than JavaScript-based middleware.

-   **Zero-Overhead Semaphores**: Uses `tokio::sync::Semaphore` to manage concurrent request limits with virtually zero CPU cost.
-   **Atomic Queue Tracking**: Queue depth is tracked using atomic integers, ensuring thread safety and extreme performance.
-   **Fail-Fast Queuing**: Requests waiting in the queue for longer than the configured `queueTimeout` are automatically rejected with a `503 Service Unavailable` error, preserving system stability under load.
-   **Per-IP Limits**: Native tracking of active requests per IP address prevents single-source DoS attacks from starving the system.

## Design Philosophy

-   **Zero-Cost Abstractions**: Leveraging Rust to ensure that the infrastructure doesnt become a bottleneck.
-   **Thread Safety**: Built on top of the `Tokio` runtime for scalable asynchronous I/O.
-   **Memory Safety**: Guaranteed memory safety without a garbage collector.

---

## Technical Specifications

-   **Language**: Rust
-   **Runtime**: Tokio (Multi-threaded)
-   **Router**: Matchit-based Radix Trie
-   **Communication**: Custom IPC Protocol
-   **Telemetry**: Pure native syscalls

---

[← Back to Core Architecture](./SERVER_CORE_ARCHITECTURE.md)

