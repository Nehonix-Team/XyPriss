# Cluster Configuration Guide (XHSC Edition)

> **Honest Notice**: This guide covers the features currently implemented in the **XHSC (XyPriss Hybrid Server Core)**. Features not listed here are either internal-only or planned for future releases. We avoid listing "aspirational" features to ensure your production configuration is predictable.

## Configuration Overview

XyPriss clustering is managed by a high-performance Rust core. All cluster settings reside under the `cluster` key in your server options.

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

| Option        | Type               | Default           | Description                                    |
| :------------ | :----------------- | :---------------- | :--------------------------------------------- |
| `enabled`     | `boolean`          | `false`           | Enables Rust-managed process clustering.       |
| `workers`     | `number \| "auto"` | `"auto"`          | Number of worker processes to spawn.           |
| `autoRespawn` | `boolean`          | `true`            | Automatically restarts workers if they crash.  |
| `strategy`    | `string`           | `"round-robin"`   | Load balancing strategy (see below).           |
| `entryPoint`  | `string`           | `process.argv[1]` | Path to the Node.js script workers should run. |
| `resources`   | `object`           | `undefined`       | Per-worker resource constraints.               |

### Resource Limits

XHSC strictly enforces limits at the process level:

-   **`maxMemory`**: Can be a number (MB) or string (e.g., `"512MB"`, `"2GB"`). If exceeded, Rust recycles the worker gracefully.
-   **`maxCpu`**: A percentage (0-100) representing the maximum CPU share a worker can consume.

---

## Load Balancing Strategies

Distribution of requests is handled by the Rust engine using one of these strategies:

1. **`round-robin`** (Default): Sequential distribution.
2. **`least-connections`**: Routes to the worker with the fewest active requests. Highly recommended for variable execution times.
3. **`least-response-time`**: Uses historical data to favor faster workers.
4. **`ip-hash`**: Ensures requests from the same IP consistently go to the same worker (Sticky Sessions).
5. **`weighted-round-robin`**: Distribution relative to worker capacity (Internal/Advanced).

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

-   **`maxLatency`**: Maximum allowed average response time before the server begins load shedding.
-   **`rejectOnPoorConnection`**: If `true`, the server returns `503 Service Unavailable` when thresholds are violated.
-   **`minBandwidth`**: Minimum estimated bandwidth to allow the request.

---

## Frequently Asked Questions

**Is Auto-Scaling supported?**  
Currently, XyPriss supports a fixed number of workers (or a fixed count based on CPU cores). Dynamic scaling (adding/removing workers based on real-time load) is on the roadmap but not yet implemented.

**How is IPC handled?**  
Communication uses binary-encoded messages over Unix Domain Sockets. IPC settings (like buffer sizes) are managed internally by Rust for optimal performance and are not currently exposed for manual tuning.

**Can I use Bun workers?**  
Yes. If you run your master process with Bun, XyPriss will automatically use Bun to spawn workers. XHSC remains agnostic to the worker runtime.

