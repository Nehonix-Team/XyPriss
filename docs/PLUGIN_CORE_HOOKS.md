# XyPriss Core Developer Hooks

XyPriss provides a set of core hooks that allow developers to intercept and respond to critical server events. These hooks are integrated into the plugin system and can be implemented by any XyPriss plugin.

## Overview

The following core hooks are available:

| Hook Name            | Description                    | Triggered When                                                 |
| -------------------- | ------------------------------ | -------------------------------------------------------------- |
| `onSecurityAttack`   | Intercepts security threats    | A malicious pattern (XSS, SQLi, etc.) is detected and blocked. |
| `onResponseTime`     | Monitors request performance   | A request is completed and the response is sent.               |
| `onRouteError`       | Handles unhandled route errors | An error occurs during request processing or route handling.   |
| `onRateLimit`        | Monitors rate limiting events  | A client exceeds the configured rate limit.                    |
| `onConsoleIntercept` | Intercepts all console output  | Any `console.log`, `warn`, `error`, etc. is called.            |
| `managePlugins`      | Manages other plugins          | Initialization phase (requires special permission).            |

---

## `managePlugins`

This is a specialized hook for administrative plugins. For detailed documentation, see the **[Plugin Management API](./PLUGIN_MANAGEMENT_API.md)**.

---

## `onSecurityAttack`

Triggered when the security middleware detects and blocks a malicious request.

### Signature

```typescript
onSecurityAttack(attackData: SecurityAttackData, req: XyPrisRequest, res: XyPrisResponse): void | Promise<void>
```

### `SecurityAttackData` Properties

-   `type`: The primary type of attack (e.g., `"XSS"`, `"SQL Injection"`, `"Path Traversal"`, `"Command Injection"`).
-   `threats`: An array of detailed threat strings (e.g., `"query.q:SQL Injection (CRITICAL)"`).
-   `ip`: The IP address of the attacker.
-   `path`: The request path where the attack was detected.

### Example

```typescript
{
    name: "security-logger",
    onSecurityAttack(attack, req) {
        console.log(`[SECURITY] ${attack.type} detected from ${attack.ip} on ${attack.path}`);
        attack.threats.forEach(threat => console.log(`  - ${threat}`));
    }
}
```

---

## `onResponseTime`

Triggered after every request to provide performance metrics.

### Signature

```typescript
onResponseTime(responseTime: number, req: XyPrisRequest, res: XyPrisResponse): void | Promise<void>
```

### Parameters

-   `responseTime`: The time taken to process the request in milliseconds.
-   `req`: The request object.
-   `res`: The response object.

### Example

```typescript
{
    name: "perf-monitor",
    onResponseTime(ms, req) {
        if (ms > 500) {
            console.warn(`[PERF] Slow request: ${req.method} ${req.path} took ${ms}ms`);
        }
    }
}
```

---

## `onRouteError`

Triggered when an unhandled error occurs during the execution of a route or middleware.

### Signature

```typescript
onRouteError(error: Error, req: XyPrisRequest, res: XyPrisResponse): void | Promise<void>
```

### Parameters

-   `error`: The error object that was thrown.
-   `req`: The request object.
-   `res`: The response object.

### Example

```typescript
{
    name: "error-reporter",
    onRouteError(err, req) {
        sendToSentry(err, { url: req.url });
    }
}
```

---

## `onRateLimit`

Triggered when a request is blocked by the rate limiting middleware.

### Signature

```typescript
onRateLimit(limitData: RateLimitData, req: XyPrisRequest, res: XyPrisResponse): void | Promise<void>
```

### `RateLimitData` Properties

-   `limit`: The maximum number of requests allowed in the window.
-   `current`: The current number of requests made by the client.
-   `remaining`: The number of requests remaining in the window (usually 0 when triggered).
-   `resetTime`: The time when the rate limit window resets.

### Example

```typescript
{
    name: "rate-limit-logger",
    onRateLimit(data, req) {
        console.log(`[RATE-LIMIT] Client ${req.ip} exceeded limit of ${data.limit} requests`);
    }
}
```

---

## `onConsoleIntercept`

Triggered whenever a console method (`log`, `info`, `warn`, `error`, `debug`) is called anywhere in the application.

### Signature

```typescript
onConsoleIntercept(log: InterceptedConsoleCall): void | Promise<void>
```

### `InterceptedConsoleCall` Properties

-   `method`: The console method called (`"log"`, `"warn"`, `"error"`, etc.).
-   `args`: Array of arguments passed to the console call.
-   `timestamp`: Date object when the log was generated.
-   `category`: Classification of the log (`"userApp"`, `"system"`, `"unknown"`).
-   `level`: Severity level (`"info"`, `"warn"`, `"error"`, `"debug"`).
-   `source`: (Optional) Source information if tracing is enabled.

### Security & Permissions

This is a **Privileged Hook**. It is disabled by default for security reasons as console logs may contain sensitive information.

**Requirement:**

1.  **System Enablement:** Console interception must be enabled in server options.
2.  **Plugin Permission:** The plugin must be explicitly granted the `PLG.LOGGING.CONSOLE_INTERCEPT` hook permission.

### Example

```typescript
{
    name: "log-aggregator",
    version: "1.0.0",
    onConsoleIntercept(log) {
        // Send critical errors to external monitoring
        if (log.method === 'error') {
            externalService.report({
                message: log.args.join(' '),
                time: log.timestamp
            });
        }
    }
}
```

---

## Integration

These hooks are automatically dispatched by the `PluginManager`. To use them, simply include the method in your plugin definition:

```typescript
import { Plugin } from "xypriss";

Plugin.register({
    name: "my-plugin",
    onSecurityAttack(data) {
        // Handle attack
    },
    onResponseTime(ms) {
        // Handle performance
    },
});
```

