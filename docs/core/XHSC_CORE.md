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

## Versioning and Generation Logic

XHSC follows a deterministic, 12-character versioning system designed for transparency and architectural clarity. Version identifiers provide immediate context regarding the build date, year, and engine generation.

### Formal Structure: `XHSC[MMDD][YY][GX]`

| Segment  | Meaning                                              |
| :------- | :--------------------------------------------------- |
| **XHSC** | **X**yPriss **H**yper-**S**ystem **C**ore Identifier |
| **MMDD** | Build Timestamp (Month and Day)                      |
| **YY**   | Year of Deployment (e.g., 2026 -> 26)                |
| **GX**   | Architectural Generation (e.g., G3, G4)              |

> [!NOTE]
> To optimize readability, leading zeros in the `MMDD` segment are suppressed in written representations. For example, `XHSC4626G3` decodes to **April 6, 2026 | Generation 3**.

### Architectural Generations

The generation index (**G**) tracks the structural evolution of the XyPriss engine:

- **G3 (Native-First)**: Full native core delegation using the **Go** implementation. Focuses on concurrency, security validation, and global scalability.
- **G4 (IPC-Symbiosis)**: Advanced dual-channel IPC bridging. Introduces granular regex-based control and sliding window safety engines.

### Precision Refinements (.R)

Continuous optimizations within a single release cycle utilize the **Refinement Index (`.R`)**. Suffixes like `.R1` or `.R2` signify architectural polishing for peak performance or maximum hardening, ensuring improvements are delivered without compromising the core identity of the build.

---

## Technical Specifications

- **Language**: Go (Native)
- **Concurrency**: Goroutines (CSP Model)
- **Router**: Native Radix Trie
- **Communication**: Custom JSON-IPC over Unix Sockets
- **I/O Engine**: High-performance XHSC `net/http` stack

---

[← Back to Core Architecture](./SERVER_CORE_ARCHITECTURE.md)

