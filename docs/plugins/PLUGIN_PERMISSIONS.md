# Plugin Permission System

XyPriss uses a **Capability-Based Security Model** to strictly control plugin actions. By default, plugins operate in a zero-trust environment with restricted access to the global server state.

## Default Policy

- **Restricted Server**: Plugins receive a proxy of the server and app instances.
- **No Config Access**: `server.app.configs` returns `undefined` by default.
- **Immutable App**: Any attempt to modify the `app` instance (adding/deleting properties) triggers a security fatal error.

## Configuring Permissions

Permissions are configured via the `xypriss.config.jsonc` file inside the `$internal` block. Each plugin entry can contain a `permissions` object.

### Example (`xypriss.config.jsonc`)

```jsonc
{
    "$internal": {
        "monitoring-plugin": {
            "permissions": {
                "allowedHooks": [
                    "XHS.PERM.LOGGING.CONSOLE_INTERCEPT",
                    "XHS.PERM.SECURITY.CONFIGS",
                ],
                "policy": "allow", // 'allowedHooks' acts as a whitelist
            },
        },
        "external-untrusted": {
            "permissions": {
                "allowedHooks": ["*"],
                "deniedHooks": ["XHS.PERM.LOGGING.CONSOLE_INTERCEPT"], // Sticky Denial
                "policy": "allow",
            },
        },
    },
}
```

## Authorization & Sandboxing

Permissions control _logic_ execution, but **Authorization** controls _access_ and _filesystem sandboxing_.

Every non-core plugin must be explicitly authorized in the `xypriss.config.jsonc` file inside the `$internal` block to be granted a secure workspace and initialization metadata. For a complete guide on how to manage these workspaces, see the [Workspace System Guide](../core/WORKSPACE_SYSTEM.md).

---

## Available Permission Constants

We recommend using the constants provided in the framework for consistency.

### 1. Lifecycle Permissions

- `XHS.HOOK.LIFECYCLE.REGISTER`: Hook into the registration phase.
- `XHS.HOOK.LIFECYCLE.SERVER_START`: Execute code during server initialization.
- `XHS.HOOK.LIFECYCLE.SERVER_READY`: Execute code once the server is listening.
- `XHS.HOOK.LIFECYCLE.SERVER_STOP`: Execute cleanup code.

### 2. HTTP & Functional Permissions

- `XHS.HOOK.HTTP.REQUEST`: **Privileged**. Intercept every incoming request.
- `XHS.HOOK.HTTP.RESPONSE`: **Privileged**. Intercept every outgoing response.
- `XHS.HOOK.HTTP.ERROR`: Intercept route/middleware errors.
- `XHS.PERM.HTTP.MIDDLEWARE`: Permission to register scoped (path-based) middleware.
- `XHS.PERM.ROUTING.REGISTER_ROUTES`: Permission to register new routes within the plugin namespace.
- `XHS.PERM.ROUTING.BYPASS_NAMESPACE`: **High Privilege**. Allows registering routes outside the default `/{id}/` prefix.
- `XHS.PERM.ROUTING.OVERWRITE_PROTECTED`: **High Privilege**. Allows replacing existing system or plugin routes.
- `XHS.PERM.HTTP.GLOBAL_MIDDLEWARE`: **High Privilege**. Allows injecting middleware affecting all routes.

### 3. Security & Logging (Privileged)

- `XHS.PERM.SECURITY.CONFIGS`: **Privileged**. Allows the plugin to read the full `configs` object.
- `XHS.PERM.SECURITY.SENSITIVE_DATA`: **Privileged**. Allows the plugin to read unmasked request body, query, headers, and cookies during execution hooks. If not granted, these fields are masked by default.
- `XHS.PERM.LOGGING.CONSOLE_INTERCEPT`: **Privileged**. Allows real-time interception of `console` output.
- `XHS.HOOK.SECURITY.ATTACK`: Hook into security attack detection events.
- `XHS.HOOK.SECURITY.RATE_LIMIT`: Hook into rate-limiting events.

### 4. Operations & Metrics

- `XHS.HOOK.METRICS.RESPONSE_TIME`: Monitor per-request response times.
- `XHS.HOOK.METRICS.ROUTE_ERROR`: Monitor 500-level route errors.
- `XHS.PERM.OPS.AUXILIARY_SERVER`: **Privileged**. Allows deploying independent auxiliary servers via `onAuxiliaryServerDeploy`.

## Sticky Denials

XyPriss supports "Sticky Denials" via the `deniedHooks` array.

- **Priority**: `deniedHooks` always override `allowedHooks`, including the `*` wildcard.
- **Static Enforcement**: Once a hook is denied in the configuration file, it cannot be overridden at runtime by any plugin management logic.

## High-Privilege Restriction

For maximum security, certain hooks are classified as **High-Privilege**. These hooks are **NEVER** granted via the `*` wildcard. They must be explicitly declared as strings in the `allowedHooks` array.

- `XHS.PERM.SECURITY.CONFIGS`
- `XHS.PERM.SECURITY.SENSITIVE_DATA`
- `XHS.PERM.OPS.AUXILIARY_SERVER`
- `XHS.PERM.ROUTING.BYPASS_NAMESPACE`
- `XHS.PERM.ROUTING.OVERWRITE_PROTECTED`
- `XHS.PERM.HTTP.GLOBAL_MIDDLEWARE`

## Security Violations

Any unauthorized attempt to execute a restricted hook or access a protected property will:

1. Be blocked by the framework.
2. Log a `[XyPriss Security]` warning (or fatal error for app mutations).
3. Gracefully skip the execution without crashing the server.

