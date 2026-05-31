# XInS (XyPriss INtelligent Scaling)

**XInS** (XyPriss Intelligent Scaling) is XyPriss's native dynamic scalability and overload protection engine. Designed to solve one of Node.js's major pain points — Event Loop saturation under extreme load — XInS uses TCP-inspired congestion control algorithms to guarantee 100% stability with 0 errors, even when facing spikes of over 5,000 concurrent connections.

## The Event Loop Problem

In a classic web server (such as Express or Fastify), when a very large number of requests arrive simultaneously, Node.js attempts to process all of them at once.
This causes:
1. Enormous pressure on the Garbage Collector (GC).
2. Event Loop starvation.
3. Skyrocketing latency, timeouts, and often silent crashes or `503` errors.

## How XInS Works ("auto" Mode)

XyPriss solves this problem at its root through its hybrid architecture. The native Go engine (**XHSC**) acts as a shield in front of the Node.js worker, functioning as an intelligent flow regulator.

When `workerPool.config.maxConcurrentTasks` is set to `"auto"`, XInS activates its **AIMD algorithm (Additive Increase / Multiplicative Decrease)**:

1. **Real-time monitoring**: XHSC measures the pure processing time of each request handled by the TypeScript worker.
2. **Additive Increase (Progressive ramp-up)**: If processing latency is excellent (e.g. < 50ms), XInS opens the floodgates by allowing more simultaneous requests (+50 concurrent requests per evaluation cycle).
3. **Multiplicative Decrease (Active protection)**: If Node.js starts to struggle and latency exceeds a safety threshold (e.g. > 500ms), XInS instantly reduces the allowed concurrency by 25% (multiplied by `0.75`).
4. **Kernel-side queuing**: Rather than rejecting excess requests, XHSC holds them in Go Goroutines (which are extremely lightweight and inexpensive) until Node.js has digested the previous wave.

The result? Optimized throughput (up to ~6,800 requests/second on a single CPU) and **absolute stability (0 timeouts)**, regardless of the intensity of the traffic spike or attack.

---

## Configuration

### Enabling Auto Mode (Recommended)

By default, XyPriss is pre-configured to use XInS transparently when the WorkerPool is enabled. You can enable it manually in your server options:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        workerPool: {
            enabled: true,
            config: {
                // Enables XInS (Intelligent Scaling)
                maxConcurrentTasks: "auto", 
                io: { min: "auto", max: "auto" },
                cpu: { min: "auto", max: "auto" }
            }
        }
    }
});

app.start();
```

### Manual Tuning (Static Mode)

If you have full control over your infrastructure resources and want to disable XInS in favor of a hard concurrency limit, replace `"auto"` with a strict numeric value.

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        workerPool: {
            enabled: true,
            config: {
                // XHSC will never send more than 1500 requests at a time to Node.js.
                // The AIMD algorithm is disabled.
                maxConcurrentTasks: 1500,
            }
        }
    }
});

app.start();
```

> [!WARNING]
> Disabling XInS (by setting a static value or setting it too high) can expose your server to timeouts or Event Loop crashes if the traffic spike exceeds your estimates. `"auto"` mode is strongly recommended in production.

## Monitoring & Telemetry

Dynamic adjustments made by XInS are transparent to the TS application. However, if `intelligence` mode is enabled, you can monitor cluster health through internal metrics (e.g. `/metrics` or via the monitoring plugin).