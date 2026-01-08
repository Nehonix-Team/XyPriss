# Plugin Permission System

The XyPriss Plugin System now includes a robust permission model that allows developers to strictly control which actions (hooks) a plugin is allowed to execute. This enhances security by ensuring that plugins only have access to the lifecycle events and features they explicitly require.

## Overview

By default, plugins may be allowed to execute any hook. However, you can configure `pluginPermissions` in your server options to enforce a whitelist of allowed hooks for specific plugins. If a plugin attempts to execute a hook that is not in its allowed list, the action is blocked, and an error is logged.

## Configuration

To configure permissions, add the `pluginPermissions` array to your `ServerOptions` when initializing the server.

### Example Configuration

```typescript
import { createServer, PluginHookIds } from "xypriss";

const app = await createServer({
    // ... other options
    pluginPermissions: [
        {
            name: "my-secure-plugin",
            allowedHooks: [
                PluginHookIds.ON_SERVER_START,
                PluginHookIds.ON_REQUEST,
                // Add other allowed hooks here
            ],
            // Optional: 'allow' (default) or 'deny'
            policy: "allow",
        },
        {
            name: "untrusted-plugin",
            allowedHooks: [], // No hooks allowed
        },
    ],
});
```

### Options

-   **name**: The name of the plugin as defined in its `name` property.
-   **allowedHooks**: An array of `PluginHookIds` strings, or `"*"` to allow all hooks.
-   **policy**: (Optional) `"allow"` or `"deny"`. Defaults to `"allow"`.
    -   If `policy` is `"deny"`, the `allowedHooks` list acts as a whitelist (only these are allowed).
    -   If `policy` is `"allow"`, the `allowedHooks` list acts as a whitelist if specified.

## Available Hook IDs

We provide standardized constants for all plugin hooks to avoid typos and ensure consistency. These are available via `PluginHookIds`.

### Lifecycle Hooks

-   `PluginHookIds.ON_REGISTER` (`PLG.LIFECYCLE.REGISTER`): Called when the plugin is registered.
-   `PluginHookIds.ON_SERVER_START` (`PLG.LIFECYCLE.SERVER_START`): Called when the server starts.
-   `PluginHookIds.ON_SERVER_READY` (`PLG.LIFECYCLE.SERVER_READY`): Called when the server is fully ready (listening).
-   `PluginHookIds.ON_SERVER_STOP` (`PLG.LIFECYCLE.SERVER_STOP`): Called when the server stops.

### HTTP Request/Response Hooks

-   `PluginHookIds.ON_REQUEST` (`PLG.HTTP.ON_REQUEST`): Executed on every incoming request.
-   `PluginHookIds.ON_RESPONSE` (`PLG.HTTP.ON_RESPONSE`): Executed when a response is finished.
-   `PluginHookIds.ON_ERROR` (`PLG.HTTP.ON_ERROR`): Executed when an error occurs in a route.
-   `PluginHookIds.MIDDLEWARE` (`PLG.HTTP.MIDDLEWARE`): Permission to register custom middleware.

### Security Hooks

-   `PluginHookIds.ON_SECURITY_ATTACK` (`PLG.SECURITY.ATTACK_DETECTED`): Triggered when a security threat is detected.
-   `PluginHookIds.ON_RATE_LIMIT` (`PLG.SECURITY.RATE_LIMIT`): Triggered when a rate limit is exceeded.

### Metrics & Monitoring Hooks

-   `PluginHookIds.ON_RESPONSE_TIME` (`PLG.METRICS.RESPONSE_TIME`): Receives response time metrics.
-   `PluginHookIds.ON_ROUTE_ERROR` (`PLG.METRICS.ROUTE_ERROR`): Receives route error metrics.

### Logging Hooks

-   `PluginHookIds.ON_CONSOLE_INTERCEPT` (`PLG.LOGGING.CONSOLE_INTERCEPT`): **Privileged Hook**. Allows interception of all server and application console output. Disabled by default.

### Routing

-   `PluginHookIds.REGISTER_ROUTES` (`PLG.ROUTING.REGISTER_ROUTES`): Permission to register new routes.

## Advanced Permission Features

### Sticky Denied Hooks

In addition to `allowedHooks`, XyPriss supports `deniedHooks`. These are "sticky" permissions that explicitly block a hook, regardless of any other allow rules (including the `*` wildcard).

-   **Priority**: `deniedHooks` always take precedence over `allowedHooks`.
-   **Persistence**: Once a hook is added to `deniedHooks` in the static configuration, it explicitly overrides any attempts to execute that hook.

## Enforcement and Stability

The permission system is integrated directly into the `PluginManager` execution pipeline.

1.  **Pre-execution Check**: Before any hook is executed, the system verifies the plugin's effective permissions.
2.  **Denial Handling**: If a hook is denied: - The execution is skipped for that specific plugin. - A `logger.error` is issued with details about the blocked attempt. - The server **does not crash**. The rest of the hook chain and the request lifecycle continue normally.
<!--

## Auditing Plugin Permissions

You can retrieve the current permission state and statistics for all plugins using the management API:

```typescript
const allStats = Plugin.getStats();
const myPluginStats = allStats.find((s) => s.name === "my-plugin");

if (myPluginStats) {
    console.log(myPluginStats.permissions.allowedHooks);
    console.log(myPluginStats.permissions.deniedHooks);
}
```

The stats include:

-   **allowedHooks**: The list of hooks currently permitted.
-   **deniedHooks**: The list of hooks explicitly blocked.
-   **effectivePermissions**: The final resolved permission set. -->

## Configuration-Driven Permissions

Permissions in XyPriss are primarily driven by the static configuration provided during server initialization. This ensures a predictable and secure environment where plugin capabilities are defined at startup.

