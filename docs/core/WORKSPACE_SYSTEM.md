# XyPriss Plugin Workspace System

## Overview

The XyPriss Workspace System provides a mechanism for developers and server administrators to tightly control filesystem access and logic execution for plugins. This is critical for enterprise security, ensuring plugins only interact with the workspaces explicitly authorized to them.

## Authorization via Configuration

Plugin permissions are explicitly authorized in the `xypriss.config.jsonc` file at the project root, under the `$internal` key, mapped by the **Plugin ID**.

### Example Authorization

```jsonc
{
    "$internal": {
        "@my-org/my-plugin": {
            // Grants an isolated filesystem context
            "__xfs__": {
                "path": "ROOT://.private/plugin-data",
            },
            // Authorizes initialization execution path
            "__meta__": {
                "path": "ROOT://.private/plugin-data/.meta",
            },
        },
    },
}
```

## Path Resolution Anchors

The path resolver enforces explicit semantic anchors to map resources correctly and prevent unauthorized traversal.

### 1. Project Root Anchors

Resolves the path relative to the **Global Project Root** (`__sys__.__root__`). This is the system's absolute, immutable source of truth.

- **`ROOT://`**

_Example_: `"ROOT://.private"` resolves to the `.private` directory securely contained in the project root.

### 2. Current Working Directory (CWD) Anchors

Resolves the path relative to the active Node.js / Bun execution directory (`process.cwd()`).

- **`CWD://`**

_Example_: `"CWD://data"` resolves to the `data` folder inside wherever the system was started.

> [!CAUTION]  
> **Critical Security Warning**: Using `CWD://.` or resolving against the top-level CWD gives a plugin access to host process files, including environmental credentials (.env) and server logs.  
> **Usage at Your Own Risk**: Providing `CWD` context to a plugin essentially grants it the same privileges as the server itself. This should NEVER be used for third-party or untrusted plugins. Only use it for core, strictly audited internal components.

> [!NOTE]  
> **Strict Root Enforcement**: Legacy wildcard anchors (`$/`, `#$.`, `!!/`) and subdirectory recursive configuration scans have been completely removed for deterministic and secure behavior.

## Accessing Workspaces in Plugins

When a plugin is initialized, it can securely retrieve its assigned, authorized filesystem instance (`XyPrissFS`) from the global `__sys__` API API using its own ID.

```typescript
import { type __sys__ } from "xypriss";

export function initMyPlugin() {
    // 1. Retrieve the secure workspace assigned to this plugin by the administrator
    const workspaceFS = (__sys__ as __sys__).plugins.get(
        "@my-org/my-plugin",
    );

    if (!workspaceFS) {
        throw new Error(
            "Plugin is not authorized in xypriss.config.jsonc or xypriss.config.json",
        );
    }

    // 2. Perform operations safely trapped within the assigned sandbox
    const files = workspaceFS.fs.lsDirs(".");

    // The plugin CANNOT traverse upward out of its sandbox.
}
```

## Graceful Verification & Void Sandbox (Bac à sable Éphémère)

Enterprise security often involves explicit exclusions. If an administrator **intentionally removes** a plugin's authorization from `xypriss.config.jsonc`, the XyPriss plugin manager utilizes **Graceful Degradation** rather than causing the application or the plugin to crash.

If a plugin requests access via `__sys__.plugins.get("pluginId")` and is not explicitly authorized, XyPriss securely intercepts the request and instantly provisions a **Void Sandbox**:

1. An ephemeral, completely empty `/tmp/nehonix.xypriss.data/void/sandbox/pluginId` (on linux) or `C:\\tmp\\nehonix.xypriss.data\\void\\sandbox\\pluginId` (on windows) directory is created.
2. An isolated `XyPrissFS` instance tightly locked to this temporary directory is returned to the plugin.
3. A security warning is logged via the system logger alerting admins:
   `Plugin @my-org/my-plugin requested workspace but was not explicitly authorized in config. Assigned implicit Void Sandbox (...)`
4. The plugin continues running flawlessly, but any filesystem scans (like `.fs.lsDirs(".")`) natively return `[]`, preventing access to the real project data.

## Multi-Tenant Dynamic Sandboxing

The XyPriss Workspace System utilizes **Caller-Aware Root Resolution** to provide high-performance multi-tenant isolation with minimal configuration.

### Dynamic `ROOT://` Resolution

The behavior of the `ROOT://` anchor adapts automatically based on the active execution context:

1.  **Global Context**: When accessed from the main application entry point, `ROOT://` points to the global project root.
2.  **Plugin Context**: When accessed from within a plugin, `ROOT://` automatically shifts to the **Plugin Project Root**.

This allows for portable and secure configurations. For example, a plugin authorized with `"path": "ROOT://."` will safely resolve to its own directory when executing its logic, without needing to know the absolute path of the host system.

### Immutable Specialized Root

Every `XyPrissFS` instance retrieved via `__sys__.plugins.get()` carries a **locked** `__root__` property. This property is initialized once and enforced via native immutability primitives, ensuring that the sandbox boundary cannot be manipulated at runtime by the plugin or third-party proxies.

### Environment Variable Sandboxing

The system enforces strict environment isolation by default. The `EnvApi` (`__env__`) always prioritizes the **Caller's Project Context**:

- **Plugin reads**: Only environment variables defined in the plugin's own `.env` file are visible.
- **Leaks prevention**: Plugins cannot "see" the host application's `.env` variables (like secret keys or database URLs) unless they are explicitly authorized or shared.

> [!TIP]
> This "Sandbox-First" design ensures that plugins remain isolated and safe to execute even in complex multi-plugin environments.

