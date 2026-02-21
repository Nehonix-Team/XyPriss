# XyPriss XHSC Performance Tuning Guide

Optimizing a high-performance cluster requires understanding the interaction between the Go engine and the Node.js/Bun workers. This guide focuses on real-world tuning for the current XyPriss implementation.

## 1. Finding the Worker Sweet Spot

The `workers` setting is the most critical lever.

| Workload Type | Recommended Workers            | Logic                                                              |
| :------------ | :----------------------------- | :----------------------------------------------------------------- |
| **I/O Heavy** | `Math.max(4, CPU_CORES * 1.5)` | Workers spend time waiting for DB/API; more workers fill the gaps. |
| **CPU Heavy** | `CPU_CORES - 1`                | Leave one core for the XHSC Go Engine to handle networking.      |
| **General**   | `"auto"`                       | XyPriss maps 1 worker to 1 physical thread.                        |

```typescript
cluster: {
  enabled: true,
  workers: "auto"
}
```

## 2. Choosing a Strategy

The `strategy` determines how XHSC distributes incoming requests.

-   **Use `least-connections` (Default Recommended)**: If your routes have varying processing times (e.g., some take 10ms, others 200ms). It prevents "clumping" on a single worker.
-   **Use `round-robin`**: If your requests are extremely uniform and the overhead of tracking active connections is a concern (rarely the case with Go).
-   **Use `ip-hash`**: For legacy applications that require session persistence on the local server.

## 3. Resource Guardrails

Setting limits prevents a single "poison pill" request from crashing the entire server.

```typescript
resources: {
  maxMemory: "512MB", // Enforced by Go core
  maxCpu: 90          // Throttles worker if they monopolize CPU
}
```

> **Note**: These limits are per-worker. Ensure your total system memory can handle `workers * maxMemory`.

## 4. Resilience vs. Latency

The `resilience` settings (Circuit Breaker and Retries) add safety but can increase worst-case latency.

-   **Retries**: If a worker crashes while processing, XHSC can retry the request on a different worker.
-   **Circuit Breaker**: If workers are failing consistently, XHSC will fail fast (returning 503) instead of making clients wait for timeouts.

```typescript
resilience: {
  retryEnabled: true,
  maxRetries: 2,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5
  }
}
```

## 5. Network Quality Rejection

High performance isn't just about speed; it's about stability. Use `networkQuality` to protect your workers from being overwhelmed by slow clients or "hanging" connections.

```typescript
networkQuality: {
  enabled: true,
  rejectOnPoorConnection: true,
  maxLatency: 500 // Cut off clients if the avg server response slows down
}
```

## Performance Truths

1. **Zero-Copy**: XyPriss uses efficient IPC, but large JSON payloads (>10MB) still incur serialization costs.
2. **Go Overhead**: The Go master process uses negligible CPU (<1%) and memory (<50MB) even under heavy load.
3. **Intelligence Engine**: While XyPriss does not dynamically scale the _number_ of workers (auto-scaling), it actively manages the _resources_ of existing workers via the Intelligence Engine, including pre-allocation and proactive GC signaling to maintain throughput stability.

