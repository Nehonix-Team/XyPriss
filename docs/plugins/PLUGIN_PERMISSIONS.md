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
                    "PLG.LOGGING.CONSOLE_INTERCEPT",
                    "PLG.SECURITY.ACCESS_CONFIGS",
                ],
                "policy": "allow", // 'allowedHooks' acts as a whitelist
            },
        },
        "external-untrusted": {
            "permissions": {
                "allowedHooks": ["*"],
                "deniedHooks": ["PLG.LOGGING.CONSOLE_INTERCEPT"], // Sticky Denial
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

- `PLG.LIFECYCLE.REGISTER`: Hook into the registration phase.
- `PLG.LIFECYCLE.SERVER_START`: Execute code during server initialization.
- `PLG.LIFECYCLE.SERVER_READY`: Execute code once the server is listening.
- `PLG.LIFECYCLE.SERVER_STOP`: Execute cleanup code.

### 2. HTTP & Functional Permissions

- `PLG.HTTP.ON_REQUEST`: **Privileged**. Intercept every incoming request.
- `PLG.HTTP.ON_RESPONSE`: **Privileged**. Intercept every outgoing response.
- `PLG.HTTP.ON_ERROR`: Intercept route/middleware errors.
- `PLG.HTTP.MIDDLEWARE`: Permission to register custom XyPriss middleware.
- `PLG.ROUTING.REGISTER_ROUTES`: Permission to register new application routes.

### 3. Security & Logging (Privileged)

- `PLG.SECURITY.ACCESS_CONFIGS`: **Privileged**. Allows the plugin to read the full `configs` object.
- `PLG.SECURITY.ACCESS_SENSITIVE_DATA`: **Privileged**. Allows the plugin to read unmasked request body, query, headers, and cookies during execution hooks. If not granted, these fields are masked by default.
- `PLG.LOGGING.CONSOLE_INTERCEPT`: **Privileged**. Allows real-time interception of `console` output.
- `PLG.SECURITY.ATTACK_DETECTED`: Hook into security attack detection events.
- `PLG.SECURITY.RATE_LIMIT`: Hook into rate-limiting events.

### 4. Operations & Metrics

- `PLG.METRICS.RESPONSE_TIME`: Monitor per-request response times.
- `PLG.METRICS.ROUTE_ERROR`: Monitor 500-level route errors.
- `PLG.OPS.AUXILIARY_SERVER`: **Privileged**. Allows deploying independent auxiliary servers via `onAuxiliaryServerDeploy`.

## Sticky Denials

XyPriss supports "Sticky Denials" via the `deniedHooks` array.

- **Priority**: `deniedHooks` always override `allowedHooks`, including the `*` wildcard.
- **Static Enforcement**: Once a hook is denied in the configuration file, it cannot be overridden at runtime by any plugin management logic.

## Security Violations

Any unauthorized attempt to execute a restricted hook or access a protected property will:

1. Be blocked by the framework.
2. Log a `[XyPriss Security]` warning (or fatal error for app mutations).
3. Gracefully skip the execution without crashing the server.

