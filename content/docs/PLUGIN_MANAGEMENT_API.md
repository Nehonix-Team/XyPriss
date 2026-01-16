# Plugin Management Hook (`managePlugins`)

The `managePlugins` hook is a powerful administrative feature that allows a plugin to audit, configure, and control other plugins within the XyPriss ecosystem. This hook is designed for creating management dashboards, security monitors, or dynamic configuration managers.

## Overview

Unlike standard lifecycle hooks, `managePlugins` provides access to a `PluginManagement` object. This object allows the plugin to inspect the state of all registered plugins and modify their permissions or status at runtime.

### Security Note

Due to its power, the `managePlugins` hook is restricted. A plugin **must** be explicitly granted the `PLG.MANAGEMENT.MANAGE_PLUGINS` permission in the server configuration to use this hook.

## Signature

```typescript
managePlugins(manager: PluginManagement): void | Promise<void>
```

### `PluginManagement` Interface

The `manager` object provides the following methods:

-   **`getStats()`**: Returns an array of `PluginStats` for all registered plugins.
-   **`setPermission(pluginName, hookId, allowed)`**: Dynamically updates a plugin's permission for a specific hook.
-   **`toggle(pluginName, enabled)`**: Enables or disables a plugin at runtime.

## `PluginStats` Properties

Each object returned by `getStats()` contains:

-   `name`: The unique name of the plugin.
-   `version`: The plugin version.
-   `enabled`: Current operational status.
-   `permissions`:
    -   `allowedHooks`: List of hooks the plugin is permitted to execute.
    -   `deniedHooks`: List of hooks explicitly blocked (sticky permissions).
    -   `policy`: The active permission policy (`allow` or `deny`).

## Usage Example

### 1. Granting Permission

First, the management plugin must be authorized in the server options:

```typescript
import { createServer, PluginHookIds } from "xypriss";

const app = createServer({
    pluginPermissions: [
        {
            name: "admin-plugin",
            allowedHooks: [PluginHookIds.MANAGE_PLUGINS],
        },
    ],
});
```

### 2. Implementing the Hook

The plugin can then use the `manager` to audit or control the system:

```typescript
export const AdminPlugin = {
    name: "admin-plugin",
    version: "1.0.0",

    async managePlugins(manager) {
        console.log("--- Plugin Audit ---");

        const stats = manager.getStats();
        stats.forEach((plugin) => {
            console.log(`Plugin: ${plugin.name} v${plugin.version}`);
            console.log(`- Status: ${plugin.enabled ? "Active" : "Disabled"}`);
            console.log(`- Allowed Hooks: ${plugin.permissions.allowedHooks}`);
        });

        // Example: Dynamically disable a suspicious plugin
        if (stats.some((p) => p.name === "untrusted-plugin")) {
            manager.toggle("untrusted-plugin", false);
            console.log("Blocked untrusted-plugin for security reasons.");
        }

        // Example: Restrict permissions for a specific plugin
        manager.setPermission("test-plugin", "PLG.HTTP.ON_REQUEST", false);
    },
};
```

## Execution Timing

The `managePlugins` hook is executed during the server initialization sequence, after all plugins have been registered but before the server starts listening for requests. This allows management plugins to set the final security and operational state of the system.

