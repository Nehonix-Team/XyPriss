# Cluster Configuration Guide (XHSC Edition)

> **Honest Notice**: This guide covers the features currently implemented in the **XHSC (XyPriss Hyper-System Core)**. Features not listed here are either internal-only or planned for future releases. We avoid listing "aspirational" features to ensure your production configuration is predictable.

## Configuration Overview

XyPriss clustering is managed by a high-performance Go core. All cluster settings reside under the `cluster` key in your server options.

```typescript
import { createServer } from "xypriss";

const app = createServer({
    cluster: {
        enabled: true,
        workers: "auto", // Spawns 1 worker per physical CPU core
        strategy: "least-connections",
        resources: {
            maxMemory: "1GB",
            maxCpu: 80,
        },
    },
});
```

## Supported Cluster Options

### Core Configuration

| Property   | Type                 | Default               | Description                              |
| :--------- | :------------------- | :-------------------- | :--------------------------------------- |
| `enabled`  | `boolean`            | `false`               | Enables XHSC-managed process clustering. |
| `workers`  | `number` \| `"auto"` | `"auto"`              | Number of worker nodes to provision.     |
| `strategy` | `ClusterStrategy`    | `"least-connections"` | Distribution algorithm to use.           |

---

### Worker Management

- **`maxMemory`**: Can be a number (MB) or string (e.g., `"512MB"`, `"2GB"`). If exceeded, XHSC recycles the worker gracefully.
- **`maxRequests`**: Total requests a worker handles before being recycled to prevent memory leaks.

---

## Distribution Strategies

Distribution of requests is handled by the XHSC engine using one of these strategies:

1.  **`round-robin`**: Sequential distribution.
2.  **`least-connections`**: Sends traffic to the worker with the fewest active requests (Best for variable workloads).
3.  **`weighted`**: Considers worker weight (useful for heterogeneous hardware).
4.  **`ip-hash`**: Ensures a client (by IP) always hits the same worker (Sticky Sessions).
5.  **`random`**: Balanced random distribution.
6.  **`latency`**: Favors workers with the lowest historical response times.

---

## Network Quality & Guardrails

These settings are part of `requestManagement` but directly impact cluster health.

```typescript
const app = createServer({
    requestManagement: {
        networkQuality: {
            enabled: true,
            rejectOnPoorConnection: true,
            maxLatency: 500, // Requests are rejected if avg latency > 500ms
            minBandwidth: 1024, // Bytes/s minimum requirement
        },
    },
});
```

### Supported Guardrail Options

- **`maxLatency`**: Maximum allowed average response time before the server begins load shedding.
- **`rejectOnPoorConnection`**: If `true`, the server returns `503 Service Unavailable` when thresholds are violated.
- **`minBandwidth`**: Minimum estimated bandwidth to allow the request.

---

## Frequently Asked Questions

**Is Auto-Scaling supported?**  
Currently, XyPriss supports a fixed number of workers (or a fixed count based on CPU cores). Dynamic scaling (adding/removing workers based on real-time load) is on the roadmap but not yet implemented.

**How is IPC handled?**  
Communication uses binary-encoded messages over Unix Domain Sockets. IPC settings (like buffer sizes) are managed internally by Go for optimal performance and are not currently exposed for manual tuning.

**Can I use Bun workers?**  
Yes. If you run your master process with Bun, XyPriss will automatically use Bun to spawn workers. XHSC remains agnostic to the worker runtime.

