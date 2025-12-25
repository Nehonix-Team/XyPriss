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

### Routing

-   `PluginHookIds.REGISTER_ROUTES` (`PLG.ROUTING.REGISTER_ROUTES`): Permission to register new routes.

## Enforcement Behavior

When a plugin attempts to use a hook:

1.  **Check**: The system checks if the plugin has permission for that specific hook ID.
2.  **Allowed**: If allowed, the hook executes normally.
3.  **Denied**:
    -   An error is logged to the system console: `[SYSTEM] Plugin 'X' requires permission for hook 'Y'`.
    -   The hook execution is **blocked** (skipped) for that plugin.
    -   The server **continues to run**. It does not crash, ensuring stability for other plugins and the application.

### Special Case: Registration

If the `ON_REGISTER` permission is denied, the plugin will **not be registered at all**. It will be completely ignored by the system.

