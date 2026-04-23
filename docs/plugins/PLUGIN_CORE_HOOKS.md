# XyPriss Core Developer Hooks

XyPriss provides a robust ecosystem of core hooks that allow developers to intercept and respond to critical server events. These hooks are designed to provide high-performance integration points with minimal overhead.

## Unified Hook Registry

The following hooks and permissions are available for XyPriss plugins.

| Category    | Hook/Property             | ID                                   | Description                                                         |
| ----------- | ------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Lifecycle   | `onRegister`              | `PLG.LIFECYCLE.REGISTER`             | Executed during initial plugin instantiation.                       |
|             | `onServerStart`           | `PLG.LIFECYCLE.SERVER_START`         | Executed during the initial phase of server bootstrap.              |
|             | `onServerReady`           | `PLG.LIFECYCLE.SERVER_READY`         | Executed once the server is successfully listening on its port.     |
|             | `onServerStop`            | `PLG.LIFECYCLE.SERVER_STOP`          | Executed during the graceful shutdown sequence.                     |
| HTTP        | `onRequest`               | `PLG.HTTP.ON_REQUEST`                | Executed for every incoming HTTP request.                           |
|             | `onResponse`              | `PLG.HTTP.ON_RESPONSE`               | Executed immediately prior to response transmission.                |
|             | `onError`                 | `PLG.HTTP.ON_ERROR`                  | Triggered during unhandled request-level exceptions.                |
| Routing     | `registerRoutes`          | `PLG.ROUTING.REGISTER_ROUTES`        | Allows programmatic registration of new application routes.         |
|             | `middleware`              | `PLG.HTTP.MIDDLEWARE`                | Injection point for global middleware components.                   |
| Security    | `onSecurityAttack`        | `PLG.SECURITY.ATTACK_DETECTED`       | Triggered when a malicious pattern is identified by the core.       |
|             | `onRateLimit`             | `PLG.SECURITY.RATE_LIMIT`            | Triggered when a client exceeds configured rate thresholds.         |
| Metrics     | `onResponseTime`          | `PLG.METRICS.RESPONSE_TIME`          | Provides performance metrics for completed HTTP transactions.       |
|             | `onRouteError`            | `PLG.METRICS.ROUTE_ERROR`            | Triggered when a specific route execution fails.                    |
| Operations  | `onAuxiliaryServerDeploy` | `PLG.OPS.AUXILIARY_SERVER`           | **Privileged**: Authorized deployment of isolated server instances. |
| Logging     | `onConsoleIntercept`      | `PLG.LOGGING.CONSOLE_INTERCEPT`      | **Privileged**: Capture and process native console activity.        |
| Permissions | `configs`                 | `PLG.SECURITY.ACCESS_CONFIGS`        | **Privileged**: Access to full server configuration metadata.       |
|             | `sensitiveData`           | `PLG.SECURITY.ACCESS_SENSITIVE_DATA` | **Privileged**: Access to unmasked request payloads (PII/Enc).      |

---

## Lifecycle Hooks

### `onRegister`

Executed during plugin initialization. This hook should be used for internal state preparation and non-asynchronous configurations.

```typescript
onRegister(): void | Promise<void>
```

### `onServerStart`

Executed during the initial phase of server startup, prior to engine activation. Useful for preparing global resources or side-car processes.

```typescript
onServerStart(): void | Promise<void>
```

### `onServerReady`

Executed when the server starts listening on its primary port.

```typescript
onServerReady(port: number): void | Promise<void>
```

---

## HTTP Hooks

### `onRequest`

Intercepts incoming requests before routing logic is applied.

```typescript
onRequest(req: XyPrisRequest, res: XyPrisResponse): void | Promise<void>
```

### `onResponse`

Intercepts outgoing responses. This hook allows for final data transformation or logging before the stream is closed.

```typescript
onResponse(req: XyPrisRequest, res: XyPrisResponse, data: any): void | Promise<void>
```

---

## Logging and Operations (Privileged)

### `onConsoleIntercept`

Powered by the native XHSC engine, this hook provides a performance-optimized stream of all console activity. It allows for advanced auditing, centralized logging, and secondary data sinks.

**ID:** `PLG.LOGGING.CONSOLE_INTERCEPT`

**Specification:** Refer to the [Console Intercept Hook Guide](../features/CONSOLE_INTERCEPT_HOOK.md) for detailed implementation details and data structures.

### `onAuxiliaryServerDeploy`

Enables the deployment of independent, isolated child server instances. This is the designated method for creating auxiliary services such as documentation engines (Swagger) or administrative interfaces.

**ID:** `PLG.OPS.AUXILIARY_SERVER`

**Signature:**

```typescript
onAuxiliaryServerDeploy(ops: OpsServerManager, server: XyPrissServer): void | Promise<void>
```

**`OpsServerManager` Methods:**

- `createAuxiliaryServer(options)`: Deploys a new isolated XyPriss server on a specified port.
- `getRouteRegistry()`: Returns the full registry of routes from the primary application.

---

## Security Permissions

These represent static permissions that must be explicitly granted within the `xypriss.config.jsonc` security policy to enable access to sensitive core systems.

- `configs` (`PLG.SECURITY.ACCESS_CONFIGS`): Authorization to read the complete server configuration telemetry.
- `sensitiveData` (`PLG.SECURITY.ACCESS_SENSITIVE_DATA`): Authorization to access unmasked request data, bypassing standard redaction policies.

---

## Performance Monitoring Hooks

The metrics subsystem provides high-resolution data regarding server health and transaction performance. Detailed schemas for `onResponseTime` and `onSecurityAttack` are documented in the [Metrics Subsystem Guide](../features/METRICS_GUIDE.md).

