# XyPriss Core Developer Hooks

XyPriss provides a robust ecosystem of core hooks that allow developers to intercept and respond to critical server events. These hooks are designed to provide high-performance integration points with minimal overhead.

## Unified Hook Registry

The following hooks and permissions are available for XyPriss plugins.

| Category    | Hook/Property             | ID                                   | Description                                                         |
| ----------- | ------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Lifecycle   | `onRegister`              | `XHS.HOOK.LIFECYCLE.REGISTER`             | Executed during initial plugin instantiation.                       |
|             | `onServerStart`           | `XHS.HOOK.LIFECYCLE.SERVER_START`         | **Restricted**: Executed during server bootstrap.                   |
|             | `onServerReady`           | `XHS.HOOK.LIFECYCLE.SERVER_READY`         | **Restricted**: Executed once the server is listening.              |
|             | `onServerStop`            | `XHS.HOOK.LIFECYCLE.SERVER_STOP`          | **Restricted**: Executed during the graceful shutdown sequence.      |
| HTTP        | `onRequest`               | `XHS.HOOK.HTTP.REQUEST`                | Executed for every incoming HTTP request.                           |
|             | `onResponse`              | `XHS.HOOK.HTTP.RESPONSE`               | Executed immediately prior to response transmission.                |
|             | `onError`                 | `XHS.HOOK.HTTP.ERROR`                  | Triggered during unhandled request-level exceptions.                |
|             | `onRouteError`            | `XHS.HOOK.METRICS.ROUTE_ERROR`            | Triggered when a specific route execution fails.                    |
| Routing     | `registerRoutes`          | `XHS.PERM.ROUTING.REGISTER_ROUTES`        | Allows programmatic registration of application routes.             |
|             | `bypassNamespace`         | `XHS.PERM.ROUTING.BYPASS_NAMESPACE`       | **Privileged**: Register routes outside the `/{id}/` prefix.        |
|             | `overwriteProtected`      | `XHS.PERM.ROUTING.OVERWRITE_PROTECTED`    | **Privileged**: Replace existing system or plugin routes.           |
|             | `middleware`              | `XHS.PERM.HTTP.MIDDLEWARE`                | Injection point for scoped/path-based middleware.                   |
|             | `globalMiddleware`        | `XHS.PERM.HTTP.GLOBAL_MIDDLEWARE`         | **Privileged**: Inject middleware affecting the entire server.      |
| Operations  | `onAuxiliaryServerDeploy` | `XHS.PERM.OPS.AUXILIARY_SERVER`           | **Privileged**: Authorized deployment of isolated server instances. |
| Logging     | `onConsoleIntercept`      | `XHS.PERM.LOGGING.CONSOLE_INTERCEPT`      | **Privileged**: Capture and process native console activity.        |
| Permissions | `configs`                 | `XHS.PERM.SECURITY.CONFIGS`        | **Privileged**: Access to full server configuration metadata.       |
|             | `sensitiveData`           | `XHS.PERM.SECURITY.SENSITIVE_DATA` | **Privileged**: Access to unmasked request payloads (PII/Enc).      |

---

## Lifecycle Security & Zero-Trust

XyPriss enforces a strict **Zero-Trust** policy for all lifecycle hooks. By default, hooks that can execute arbitrary logic during server bootstrap or shutdown are blocked unless explicitly authorized.

### Permission Enforcement

If a plugin defines a security policy (`allowedHooks`), it **must** explicitly include the lifecycle hook IDs to execute them.

- **`XHS.HOOK.LIFECYCLE.SERVER_START`**: Required to run logic during startup.
- **`XHS.HOOK.LIFECYCLE.SERVER_READY`**: Required to run logic after the server is listening.
- **`XHS.HOOK.LIFECYCLE.SERVER_STOP`**: Required to run logic during shutdown.

### Global Configuration (`allowLifecycleByDefault`)

For environments where strict whitelisting of lifecycle hooks is not desired (e.g., development or trusted internal plugins), you can enable the `allowLifecycleByDefault` option in the server configuration.

```jsonc
// xypriss.config.jsonc
{
    "plugins": {
        "allowLifecycleByDefault": true // Restores legacy behavior (default: false)
    }
}
```

> [!IMPORTANT]
> In production environments, it is strongly recommended to keep `allowLifecycleByDefault` set to `false` to maintain maximum security and prevent unauthorized plugins from intercepting sensitive startup events.

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

**ID:** `XHS.PERM.LOGGING.CONSOLE_INTERCEPT`

**Specification:** Refer to the [Console Intercept Hook Guide](../features/CONSOLE_INTERCEPT_HOOK.md) for detailed implementation details and data structures.

### `onAuxiliaryServerDeploy`

Enables the deployment of independent, isolated child server instances. This is the designated method for creating auxiliary services such as documentation engines (Swagger) or administrative interfaces.

**ID:** `XHS.PERM.OPS.AUXILIARY_SERVER`

**Signature:**

```typescript
onAuxiliaryServerDeploy(ops: OpsServerManager, server: XyPrissServer): void | Promise<void>
```

**`OpsServerManager` Methods:**

- `createAuxiliaryServer(options)`: Deploys a new isolated XyPriss server on a specified port.
- `getRouteRegistry()`: Returns the full registry of routes from the primary application.

---

---

## Routing and Namespace Sandboxing

XyPriss G3 enforces a strict **Zero-Trust Routing** policy. Plugins are restricted via the `PluginServer` proxy to ensure they cannot interfere with the global application state without explicit authorization.

### Namespace Enforcement

By default, all routes registered via `server.app.get()`, `post()`, etc., are automatically checked for namespace compliance.

- **Allowed**: `/{pluginId}/*` (e.g., `/xyphra/logs`)
- **Restricted**: Any path not starting with the plugin's unique ID.
- **Bypass**: Requires `XHS.PERM.ROUTING.BYPASS_NAMESPACE`.

### Route Overwrite Protection

To prevent malicious or accidental disruption of core services (like `/` or `/admin`), plugins cannot overwrite already registered routes.

- **Enforcement**: If a path/method combination already exists in the `XyprissApp` registry, the registration is blocked.
- **Bypass**: Requires `XHS.PERM.ROUTING.OVERWRITE_PROTECTED`.

### Middleware Isolation

Middlewares injected via `server.app.use()` are categorized by scope:

- **Scoped**: `server.app.use("/path", mw)` is allowed with standard `XHS.PERM.HTTP.MIDDLEWARE`.
- **Global**: `server.app.use(mw)` or `server.app.use("/", mw)` is **Privileged** and requires `XHS.PERM.HTTP.GLOBAL_MIDDLEWARE`.

---

## Security Permissions

These represent static permissions that must be explicitly granted within the `xypriss.config.jsonc` security policy to enable access to sensitive core systems.

- `configs` (`XHS.PERM.SECURITY.CONFIGS`): Authorization to read the complete server configuration telemetry.
- `sensitiveData` (`XHS.PERM.SECURITY.SENSITIVE_DATA`): Authorization to access unmasked request data, bypassing standard redaction policies.
- `bypassNamespace` (`XHS.PERM.ROUTING.BYPASS_NAMESPACE`): **High Privilege**. Authorization to register routes on any path.
- `overwriteProtected` (`XHS.PERM.ROUTING.OVERWRITE_PROTECTED`): **High Privilege**. Authorization to replace existing routes.
- `globalMiddleware` (`XHS.PERM.HTTP.GLOBAL_MIDDLEWARE`): **High Privilege**. Authorization to inject middleware affecting all routes.

---

## Performance Monitoring Hooks

The metrics subsystem provides high-resolution data regarding server health and transaction performance. Detailed schemas for `onResponseTime` and `onSecurityAttack` are documented in the [Metrics Subsystem Guide](../features/METRICS_GUIDE.md).
