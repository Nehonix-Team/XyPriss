# XyPriss Core Developer Hooks

XyPriss provides a set of core hooks that allow developers to intercept and respond to critical server events.

## Overview

The following hooks and permissions are available for XyPriss plugins.

| Category    | Hook/Property             | ID                                   | Description                                                      |
| ----------- | ------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Lifecycle   | `onRegister`              | `PLG.LIFECYCLE.REGISTER`             | Executed when the plugin is first added to the server.           |
|             | `onServerStart`           | `PLG.LIFECYCLE.SERVER_START`         | Executed during the initial phase of server startup.             |
|             | `onServerReady`           | `PLG.LIFECYCLE.SERVER_READY`         | Executed once the server is listening for connections.           |
|             | `onServerStop`            | `PLG.LIFECYCLE.SERVER_STOP`          | Executed when the server is closing down.                        |
| HTTP        | `onRequest`               | `PLG.HTTP.ON_REQUEST`                | Executed for every incoming HTTP request.                        |
|             | `onResponse`              | `PLG.HTTP.ON_RESPONSE`               | Executed just before the response is sent to the client.         |
|             | `onError`                 | `PLG.HTTP.ON_ERROR`                  | Executed when an unhandled error occurs during a request.        |
| Routing     | `registerRoutes`          | `PLG.ROUTING.REGISTER_ROUTES`        | Allows the plugin to add new routes to the application.          |
|             | `middleware`              | `PLG.HTTP.MIDDLEWARE`                | Allows injecting global middleware.                              |
| Security    | `onSecurityAttack`        | `PLG.SECURITY.ATTACK_DETECTED`       | Triggered when a malicious pattern is detected.                  |
|             | `onRateLimit`             | `PLG.SECURITY.RATE_LIMIT`            | Triggered when a client exceeds rate limits.                     |
| Metrics     | `onResponseTime`          | `PLG.METRICS.RESPONSE_TIME`          | Provides performance data for every completed request.           |
|             | `onRouteError`            | `PLG.METRICS.ROUTE_ERROR`            | Triggered when a specific route execution fails.                 |
| Operations  | `onAuxiliaryServerDeploy` | `PLG.OPS.AUXILIARY_SERVER`           | **Privileged**: Deploy an isolated server (e.g., Swagger).       |
| Logging     | `onConsoleIntercept`      | `PLG.LOGGING.CONSOLE_INTERCEPT`      | **Privileged**: Capture all console activity.                    |
| Permissions | `configs`                 | `PLG.SECURITY.ACCESS_CONFIGS`        | **Privileged**: Read full server configuration.                  |
|             | `sensitiveData`           | `PLG.SECURITY.ACCESS_SENSITIVE_DATA` | **Privileged**: Read unmasked request data (body, cookies, etc). |

---

## Lifecycle Hooks

### `onRegister`

Executed when the plugin is initialized. Ideal for setting up internal states.

```typescript
onRegister(): void | Promise<void>
```

### `onServerStart`

Executed during the initial phase of server startup.

```typescript
onServerStart(): void | Promise<void>
```

### `onServerReady`

Executed when the server starts listening on its port.

```typescript
onServerReady(port: number): void | Promise<void>
```

---

## HTTP Hooks

### `onRequest`

Intercept and process every incoming request before its route handler.

```typescript
onRequest(req: XyPrisRequest, res: XyPrisResponse): void | Promise<void>
```

### `onResponse`

Intercept and process outgoing responses before they are sent to the client.

```typescript
onResponse(req: XyPrisRequest, res: XyPrisResponse, data: any): void | Promise<void>
```

---

## Operations (Privileged)

### `onAuxiliaryServerDeploy`

Allows the plugin to deploy an entirely independent child server instance. This is used by plugins like `xypriss-swagger`.

**ID:** `PLG.OPS.AUXILIARY_SERVER`

**Example:**

```typescript
{
    name: "admin-gateway",
    async onRegister() {
        const adminServer = await createServer({
            isAuxiliary: true,
            server: { port: 9000 }
        });
        // ... configure admin server
    }
}
```

---

## Security Permissions (Metadata only)

These are not executable hooks but represent permissions that can be granted to a plugin in `xypriss.config.jsonc`.

- `configs` (`PLG.SECURITY.ACCESS_CONFIGS`): Allows the plugin to read the entire server configuration via `Configs.all()`.
- `sensitiveData` (`PLG.SECURITY.ACCESS_SENSITIVE_DATA`): Allows the plugin to access unmasked PII and credentials in request bodies.

---

## Performance and Monitoring

(Existing documentation for `onResponseTime`, `onSecurityAttack`, `onRouteError`, `onRateLimit` follows simplified format...)

