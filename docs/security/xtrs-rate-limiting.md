# XTRS (XyPriss Temporal Rate Shield)

**XTRS** (*XyPriss Temporal Rate Shield*) is an enterprise-grade security module integrated into the XyPriss web framework. It provides multi-window rate limiting executed directly at the native **XHSC** (Hyper-System Core) Go engine layer.

---

## Key Features

- **Temporal Expressions**: Configure rate limits using human-readable duration strings (`10/1s`, `300/1m`, `5000/1h`, `10000/1d`).
- **Multi-Window Evaluation**: Apply concurrent window constraints simultaneously (for example, combining short burst protection with long-term quota enforcement).
- **Configurable Lock Durations (`blockDuration` / `retryAfter`)**: Specify distinct penalty or cool-down windows when rate limits are exceeded (for instance, locking requests for `30s`, `5m`, or `1h`).
- **Granular Message Customization**: Define default global messages or per-rule custom response messages and HTTP status codes.
- **Native Engine Delegation**: Evaluated at the compiled Go core level to eliminate runtime overhead on the Node.js event loop.

---

## Technical Guide & Configuration

### 1. Basic Multi-Window Setup

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: { port: 8085 },
    security: {
        enabled: true,
        rateLimit: {
            xtrs: {
                rules: [
                    "5/10s",    // Maximum 5 requests per 10 seconds (burst limit)
                    "300/1m",   // Maximum 300 requests per minute
                    "5000/1h",  // Maximum 5,000 requests per hour
                ],
            },
        },
    },
});
```

---

### 2. Per-Rule Custom Messages & Lock Duration

```typescript
const app = createServer({
    server: { port: 8085 },
    security: {
        enabled: true,
        rateLimit: {    
            xtrs: {
                rules: [
                    // Standard rule with default message
                    "5/10s",

                    // Custom rule with specific message and lock duration
                    {
                        rule: "20/1m",
                        message: "Minute request quota exceeded. Access temporarily blocked.",
                        blockDuration: "30s", // Lock duration of 30 seconds
                        statusCode: 429,
                    },
                ],

                // Global error message
                message: "XTRS Alert: Rate limit exceeded. Please wait before retrying.",
            },
        },
    },
});
```

---

## API Reference

### `XtrsOptions`

| Property | Type | Description |
| :--- | :--- | :--- |
| `rules` | `XtrsRuleInput[]` | Array of XTRS rate limit expressions (`"10/1s"`) or configuration objects. |
| `limit` | `XtrsRuleInput \| XtrsRuleInput[]` | Single expression or array alias for XTRS rules. |
| `message` | `string \| Record<string, any>` | Global default error payload returned when limits are exceeded. |
| `statusCode` | `number` | Global default HTTP status code (Default: `429`). |

---

### `XtrsRuleConfig` (Per-Rule Configuration)

| Property | Type | Description |
| :--- | :--- | :--- |
| `rule` | `string \| { max: number, windowMs: number }` | Expression string (e.g. `"20/1m"`) or explicit window object. |
| `message` | `string \| Record<string, any>` | Response payload specific to this rule. |
| `statusCode` | `number` | HTTP status code specific to this rule. |
| `blockDuration` / `retryAfter` | `string \| number` | Lock or cool-down duration specific to this rule. |

---

## Supported Time Units

| Unit Category | Identifiers | Representation |
| :--- | :--- | :--- |
| **Milliseconds** | `ms`, `millisecond`, `milliseconds` | `"500ms"` |
| **Seconds** | `s`, `sec`, `second`, `seconds` | `"10s"` |
| **Minutes** | `m`, `min`, `minute`, `minutes` | `"1m"` |
| **Hours** | `h`, `hr`, `hour`, `hours` | `"1h"` |
| **Days** | `d`, `day`, `days` | `"1d"` |

---

## Parameter Resolution Hierarchy

When a rate limit evaluation triggers a violation, XTRS resolves parameters using the following priority:

1. **Rule Specific Configuration**: Properties defined directly on the `XtrsRuleConfig` item.
2. **Global XTRS Configuration**: Properties defined on `security.rateLimit.xtrs`.
3. **RateLimit Default Configuration**: Properties defined on `security.rateLimit`.
