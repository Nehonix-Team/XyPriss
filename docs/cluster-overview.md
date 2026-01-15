# XyPriss XHSC Clustering System

The XyPriss Hybrid Server Core (XHSC) introduces a modern approach to process management. Instead of standard Node.js clustering, we use a dedicated **Rust-based Master Core** to handle networking and worker lifecycle management.

## Core Architecture

-   **XHSC Engine (Master)**: A high-performance Rust process that listens on the network, filters requests, and handles load balancing.
-   **Workers**: Standard Node.js or Bun processes that receive requests from Rust via high-speed Unix Domain Sockets (IPC).
-   **Communication**: Binary-encoded messages ensure minimal overhead between the core and your logic.

## Key Benefits

1. **Isolation**: A crash in a JavaScript worker cannot crash the network listener.
2. **Speed**: Rust-based load balancing strategies (`least-connections`, `latency-aware`) are executed with sub-millisecond overhead.
3. **Safety**: Integrated Circuit Breakers and Network Quality guardrails protect your application from cascading failures.

## Honest Capabilities

While XyPriss is designed for enterprise scale, we believe in transparency regarding current implementation limits:

-   **Fixed Pool**: The number of workers is determined at startup. Dynamic auto-scaling (scaling up/down based on load) is currently under development.
-   **IPC Protocol**: The communication protocol between Rust and JS is internal and not currently intended for third-party client implementations.
-   **Resources**: CPU and Memory limits are enforced at the process level, meaning a worker will be restarted if limits are exceeded.

## Documentation

-   [**Cluster Configuration Guide**](cluster-configuration-guide.md): Learn about `workers`, `strategy`, and `resources`.
-   [**Performance Tuning**](cluster-performance-tuning-updated.md): Best practices for worker counts and guardrail thresholds.

---

_Note: Older documentation referring to `cluster.config` is legacy. XHSC uses the flat configuration structure described in the guides above._

