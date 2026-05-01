# XyPriss Metrics Subsystem Guide

The XyPriss Metrics Subsystem provides high-resolution telemetry and analytical data regarding server performance, security events, and request lifecycles. This guide documents the available hooks and data schemas for monitoring your application.

## Core Metrics Hooks

Plugins can hook into the following metrics-related events to capture real-time data.

### 1. `onResponseTime`

Triggered immediately after a response is sent to the client. This provides the total duration of the request-response cycle in milliseconds.

**Signature:**
```typescript
onResponseTime(
    responseTime: number,
    req: Request,
    res: Response
): void | Promise<void>
```

**Data Schema:**
| Field | Type | Description |
| :--- | :--- | :--- |
| `responseTime` | `number` | The time elapsed from request receipt to response completion, in milliseconds. |
| `req` | `Request` | The native request object. |
| `res` | `Response` | The native response object. |

---

### 2. `onSecurityAttack`

Triggered when the XyPriss security engine (or a security plugin) detects a potential threat or violation.

**Signature:**
```typescript
onSecurityAttack(
    attackData: any,
    req: Request,
    res: Response
): void | Promise<void>
```

**Data Schema (`attackData`):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `type` | `string` | The category of attack (e.g., `SQL_INJECTION`, `XSS`, `BRUTE_FORCE`, `HONEYPOT_HIT`). |
| `severity` | `"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"` | The assessed risk level of the event. |
| `source` | `string` | The IP address or identifier of the suspected attacker. |
| `details` | `object` | Context-specific information regarding the violation. |

---

### 3. `onRouteError`

Triggered when a route handler throws an unhandled exception or returns a 500-level error.

**Signature:**
```typescript
onRouteError(
    error: Error,
    req: Request,
    res: Response
): void | Promise<void>
```

---

### 4. `onRateLimit`

Triggered when a client exceeds the configured rate limits.

**Signature:**
```typescript
onRateLimit(
    limitData: any,
    req: Request,
    res: Response
): void | Promise<void>
```

**Data Schema (`limitData`):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `window` | `number` | The duration of the rate limit window in milliseconds. |
| `limit` | `number` | The maximum number of requests allowed in the window. |
| `current` | `number` | The number of requests made by the client in the current window. |
| `reset` | `Date` | The timestamp when the rate limit will reset. |

## Performance Considerations

Metrics hooks are executed as part of the request lifecycle. To maintain XyPriss's ultra-high throughput:

1. **Avoid Blocking**: Never perform synchronous I/O or heavy computation inside these hooks.
2. **Asynchronous Sinks**: Offload data to external telemetry systems (Prometheus, InfluxDB, etc.) using non-blocking asynchronous calls.
3. **Sampling**: For extremely high-traffic servers, consider implementing sampling logic within your plugin to only capture a percentage of metrics.
