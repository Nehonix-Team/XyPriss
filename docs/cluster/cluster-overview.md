# XyPriss XHSC Clustering System

The XyPriss Hyper-System Core (XHSC) introduces a modern approach to process management. Instead of standard Node.js clustering, we use a dedicated **XHSC Master Core** to handle networking and worker lifecycle management.

---

### Core Components

1.  **XHSC Engine (Master)**: A high-performance native process that listens on the network, filters requests, and handles load balancing.
2.  **Workers**: Standard Node.js or Bun processes that receive requests from XHSC via high-speed Unix Domain Sockets (IPC).

---

### Performance Advantages

- **Concurrency**: XHSC manages thousands of persistent connections effortlessly.
- **Speed**: XHSC-based load balancing strategies (`least-connections`, `latency-aware`) are executed with sub-millisecond overhead.
- **Stability**: Worker crashes are isolated and handled by the master process.

---

### Security Policy

- **Isolation**: Each worker operates in its own memory space.
- **IPC Protocol**: The communication protocol between XHSC and JS is internal and not currently intended for third-party client implementations.
  limits:

- **Fixed Pool**: The number of workers is determined at startup. Dynamic auto-scaling (scaling up/down based on load) is currently under development.
- **IPC Protocol**: The communication protocol between XHSC and JS is internal and not currently intended for third-party client implementations.
- **Resources**: CPU and Memory limits are enforced at the process level, meaning a worker will be restarted if limits are exceeded.

- [**Cluster Configuration Guide**](cluster-configuration-guide.md): Learn about `workers`, `strategy`, and `resources`.
- [**Performance Tuning**](cluster-performance-tuning-updated.md): Best practices for worker counts and guardrail thresholds.

---

_Note: Older documentation referring to `cluster.config` is legacy. XHSC uses the flat configuration structure described in the guides above._

