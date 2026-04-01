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
> Using `CWD://.` or resolving against the top-level CWD gives a plugin access to sensitive process files, such as `.env` files. Ensure you only provide `CWD` context to highly trusted internal plugins.

> [!NOTE]  
> **Strict Root Enforcement**: Legacy wildcard anchors (`$/`, `#$.`, `!!/`) and subdirectory recursive configuration scans have been completely removed for deterministic and secure behavior.

## Accessing Workspaces in Plugins

When a plugin is initialized, it can securely retrieve its assigned, authorized filesystem instance (`XyPrissFS`) from the global `__sys__` API API using its own ID.

```typescript
import { type XyPrissSys } from "xypriss";

export function initMyPlugin() {
    // 1. Retrieve the secure workspace assigned to this plugin by the administrator
    const workspaceFS = (__sys__ as XyPrissSys).plugins.get(
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

1. An ephemeral, completely empty `/tmp/xypriss-void-sandbox/pluginId` (on linux) or `C:\\tmp\\xypriss-void-sandbox\\pluginId` (on windows) directory is created.
2. An isolated `XyPrissFS` instance tightly locked to this temporary directory is returned to the plugin.
3. A security warning is logged via the system logger alerting admins:
   `Plugin @my-org/my-plugin requested workspace but was not explicitly authorized in config. Assigned implicit Void Sandbox (...)`
4. The plugin continues running flawlessly, but any filesystem scans (like `.fs.lsDirs(".")`) natively return `[]`, preventing access to the real project data.

## Meta Logic Execution

If `__meta__` is defined for a plugin, the system automatically scans the assigned path for `+xypriss.meta.ts/js` files during system boot.

- If the path is a file, it executes the exported `run()` function.
- If the path is a directory, it searches for the meta file within that directory.

