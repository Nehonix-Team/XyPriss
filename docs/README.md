# XyPriss XHSC Subsystem Documentation

The **XyPriss Hyper-System Core (XHSC)** is the high-performance heart of XyPriss. It enables native networking, process management (clustering), and advanced traffic guardrails.

## Cluster Documentation

- **[Cluster Overview](./cluster-overview.md)**: High-level architecture and hybrid master/worker design.
- **[Configuration Guide](./cluster-configuration-guide.md)**: Details on scaling, strategies, and resource limits.
- **[Performance Tuning](./cluster-performance-tuning-updated.md)**: Optimization strategies for CPU and I/O bound workloads.

## Core Features

- **[XHSC Core Details](./XHSC_CORE.md)**: In-depth look at routing (Radix Trie), native telemetry, and native concurrency control.
- **[Network Quality Guardrails](./cluster-configuration-guide.md#network-quality--guardrails)**: Protecting your server from slow connections and traffic spikes.
- **[Real IP Resolution](./features/get-ip.md)**: Accurately identifying clients through multiple proxy layers.
- **[Environment Security Shield](./ENVIRONMENT_SHIELD.md)**: Strict project-based isolation and built-in .env loading.

## Configuration Quick-Start (Honest Implementation)

```typescript
import { createServer } from "xypriss";

const app = createServer({
    cluster: {
        enabled: true, // Enable XHSC clustering
        workers: "auto", // 1 per physical thread
        strategy: "least-connections",
    },
    requestManagement: {
        networkQuality: {
            enabled: true,
            rejectOnPoorConnection: true,
            maxLatency: 500,
        },
    },
});

await app.start(3000);
```

## Current Capabilities

- ✅ **Hybrid Clustering**: XHSC master + JS workers.
- ✅ **Advanced Load Balancing**: 6 different distribution strategies.
- ✅ **Native Concurrency**: Per-IP and server-wide limits managed in the native core.
- ✅ **Resource Guardrails**: Per-worker CPU and Memory limits.
- ✅ **Native Circuit Breakers**: Fail-fast protection.
- 🚧 **Auto-Scaling**: Planned for a future release (not currently available).
- 🚧 **Dynamic Health Endpoints**: Basic health checks are internal; custom endpoints are planned.

