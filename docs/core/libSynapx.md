---
title: libSynapx Engine Architecture Specification
description: Technical specification of the high-throughput persistent Inter-Process Communication (IPC) and cluster dispatcher engine in XyPriss.
category: Core Architecture
---

# `libSynapx`: High-Throughput IPC & Dispatcher Engine

**`libSynapx`** is a low-latency, persistent Inter-Process Communication (IPC) and request dispatching engine engineered for the Nehonix platform ecosystem. It establishes a bidirectional, memory-pooled communication layer between the native compiled **XHSC** core (Go) and high-level language runtimes (TypeScript, Bun, Node.js).

Designed to eliminate subprocess spawning latency, prevent command-line argument leakage, and resolve multi-process port conflicts, `libSynapx` serves as the foundational substrate for XyPriss's multi-core clustering and high-concurrency request distribution.

---

## 1. Problem Statement and Architectural Motivation

Hybrid backend architectures combining compiled network listeners with interpreted worker runtimes encounter critical performance and security limitations when utilizing legacy IPC models:

1. **Subprocess Spawning Latency**: Executing discrete child processes on demand via OS-level `fork()` and `exec()` calls incurs significant kernel scheduling overhead, dynamic linker resolution, and runtime bootstrap penalties (15ms to 80ms per invocation).
2. **Command-Line Argument (`argv`) Exposure**: Passing payload metadata or authentication tokens as CLI arguments exposes sensitive values across host-level process inspection tables (`/proc/[pid]/cmdline`, `ps aux`, Windows Task Manager).
3. **Multi-Worker Port Collisions**: Traditional process clustering requires either running internal reverse proxies across separate TCP ports or relying on unmanaged OS socket sharing, resulting in uneven request balancing and port contention.
4. **Buffer Thrashing and Allocation Overhead**: Unstructured streaming and continuous JSON serialization across raw sockets create severe memory fragmentation and trigger frequent Garbage Collector (GC) stalls under high-concurrency traffic.

`libSynapx` addresses these limitations by maintaining a persistent, multiplexed binary communication channel backed by pre-allocated multi-tier buffer pools.

---

## 2. System Architecture

```text
+-------------------------------------------------------------------------+
|                           Native XHSC Core                              |
|          (Go Network Layer / Kernel Epoll & Kqueue Listener)            |
+-------------------------------------------------------------------------+
                                     |
                                     | [Persistent Multiplexed IPC]
                                     | - High-Performance Binary Wire Framing
                                     | - Adaptive Backpressure & Circuit Breaking
                                     v
+-------------------------------------------------------------------------+
|                          libSynapx Dispatcher                           |
|        (Intelligent Load Balancer / Dynamic Route Synchronizer)         |
+-------------------------------------------------------------------------+
        |                            |                            |
        v                            v                            v
+----------------+          +----------------+          +----------------+
| TypeScript     |          | TypeScript     |          | TypeScript     |
| Worker Pool #0 |          | Worker Pool #1 |          | Worker Pool #N |
| (libSynapx)    |          | (libSynapx)    |          | (libSynapx)    |
+----------------+          +----------------+          +----------------+
```

---

## 3. Core Architectural Pillars

### 3.1 Persistent Duplex IPC Bridge
Rather than creating and destroying subprocesses per request, `libSynapx` establishes long-lived bidirectional IPC channels at application startup. Transactions are multiplexed over a single transport stream with sub-millisecond execution turnaround.

### 3.2 Multi-Core Request Dispatching (`synapx-dispatcher`)
In cluster mode, the master XHSC process binds the host network interface and acts as the singular external HTTP listener. Incoming traffic is distributed across healthy worker processes via `libSynapx`. Child workers operate as pure application delegates without opening redundant TCP sockets, eliminating port conflicts entirely.

### 3.3 Multi-Tier Buffer Pooling
`libSynapx` utilizes tiered memory pools (Small, Medium, and Large buffers) to handle variable request and response payloads. Reusable byte slices eliminate heap fragmentation and prevent Garbage Collection spikes during sustained high-throughput bursts.

### 3.4 Dynamic Route Table Synchronization
Upon worker process initialization, routing tables are automatically published to the `libSynapx` dispatcher. XHSC synchronizes static and dynamic route trees, allowing static assets to be served directly from native memory while dynamic application handlers are routed immediately to available workers.

### 3.5 Integrated Circuit Breaking and Failover
The dispatcher incorporates an adaptive circuit breaker that tracks worker response times and error rates. If an individual worker fails or becomes unresponsive, the dispatcher immediately reroutes traffic to healthy peers while the supervisor initiates automatic process recovery.

---

## 4. Technical Specifications and Metrics

| Architectural Dimension | Traditional Multi-Process Models | XyPriss with `libSynapx` |
| :--- | :--- | :--- |
| **Transaction Turnaround** | 15ms – 80ms (subprocess spawn) | **< 0.5ms (persistent IPC)** |
| **Port Management** | Multiple internal ports / Proxy layers | **Single master port + zero-conflict IPC** |
| **Process Inspection Security** | Arguments visible in `/proc` and `ps` | **Zero CLI argument leakage** |
| **Memory Allocation Profile** | Continuous per-request heap allocation | **Pre-allocated multi-tier buffer pools** |
| **Failure Recovery** | Manual process restart / Proxy timeouts | **Autonomous circuit-breaker failover** |

---

## 5. Configuration and Implementation

Cluster orchestration via `libSynapx` is configured declaratively within `ServerOptions`:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        port: 3000,
    },
    cluster: {
        enabled: true,
        workers: "auto", // Automatically provisions 1 worker per logical CPU core
        mode: "synapx-dispatcher", // High-throughput libSynapx IPC pool
        strategy: "round-robin", // Distribution policy: round-robin | least-connections | ip-hash
        autoRespawn: true, // Autonomous worker recovery on abnormal exit
        resources: {
            maxMemory: "1GB",
            priority: "normal",
            intelligence: {
                enabled: true,
                preAllocate: true,
                rescueMode: true,
            },
        },
    },
});

app.get("/api/v1/metrics", (req, res) => {
    res.json({
        status: "ok",
        engine: "libSynapx",
        timestamp: Date.now(),
    });
});

app.start();
```

---

## 6. Security and Process Verification

- **Mutual Session Authorization**: `libSynapx` validates peer credentials during connection establishment, preventing unauthorized external processes from attaching to the internal dispatch socket.
- **Zero-Trust Confinement Interoperability**: Fully compatible with `libXESS` environment sandboxing, ensuring child worker processes execute within protected session boundaries without triggering security violations.
- **Strict Transport Boundaries**: Local transport endpoints are restricted with standard `0700` filesystem permissions and located within secure session-scoped directories.

---

## 7. References and Related Specifications

- **[`libXESS` Environment Security Shield](../security/libXESS.md)**: Zero-Trust process confinement and secret isolation specification.
- **[XHSC Core Architecture Specification](./XHSC_CORE.md)**: Native HTTP engine, Radix Trie router, and connection management.
- **[Cluster Configuration Guide](../cluster/cluster-configuration-guide.md)**: Comprehensive scaling and load balancing reference.
- **[Performance Tuning Manual](../cluster/cluster-performance-tuning-updated.md)**: Resource limits, nice prioritization, and GC optimization.
