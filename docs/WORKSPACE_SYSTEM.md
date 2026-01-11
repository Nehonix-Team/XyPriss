# XyPriss Internal & Plugin Workspace System

## Overview

The XyPriss Workspace System provides a mechanism for developers and plugin contributors to define specialized system instances (like `$plug`) with restricted filesystem access and isolated logic execution. This is particularly useful for building plugins that need to manage their own workspace without interfering with the main project root.

## Configuration

Specialized systems are configured in the `xypriss.config.json` file under the `$internal` key.

### Example Configuration

```json
{
    "__sys__": {
        "__name__": "My-App"
    },
    "$internal": {
        "$plug": {
            "__xfs__": {
                "path": "#$/.private"
            },
            "__meta__": {
                "path": "#$/.private/.meta"
            }
        }
    }
}
```

### Configuration Parameters

| Parameter       | Type     | Description                                                                                      |
| :-------------- | :------- | :----------------------------------------------------------------------------------------------- |
| `__xfs__`       | `object` | Defines a specialized xypriss filesystem instance.                                               |
| `__xfs__.path`  | `string` | The root path for the specialized filesystem. Supports `#$` or `$#` for project root resolution. |
| `__meta__`      | `object` | Defines logic execution paths.                                                                   |
| `__meta__.path` | `string` | Path to a file or directory containing `+xypriss.meta.ts` logic.                                 |

## Usage in Code

Once configured, the specialized system is automatically added to the global `__sys__` object.

### Accessing the Workspace FileSystem

You can access the specialized filesystem using the name defined in the config (e.g., `$plug`).

```typescript
import { type XyPrissSys } from "xypriss";

export function myPlugin() {
    // Both properties point to the same specialized workspace
    const workspaceA = (__sys__ as XyPrissSys).$plug;
    const workspaceB = (__sys__ as XyPrissSys).$plg;

    // Using the short alias for file operations
    const files = workspaceB?.$lsDirs(".");
}
```

## Distributed Configuration & Auto-Discovery

XyPriss supports a distributed configuration model, allowing plugins and internal modules to provide their own `xypriss.config.json` files. The system automatically scans for these files in standard project directories:

-   Project Root
-   `/plugins/*`
-   `/mods/*`
-   `/simulations/*`
-   `/shared/*`

This enables plugin contributors to define their own workspaces and meta-logic without requiring manual configuration from the end-user.

## Path Resolution Placeholders

The path resolver supports two main types of resolution:

-   **Project Root Resolution**: Using `#$` or `$#` will resolve the path relative to the **Global Project Root** (the highest directory containing a `xypriss.config.json` or `package.json`).
-   **Local Resolution**: Any standard relative path (e.g., `./.private` or `workspace/data`) will be resolved relative to the **directory containing the specific configuration file** being processed.

### Format Flexibility

The resolver is whitespace-aware and robust against extra spaces around slashes or placeholders.

-   `"$ # / simulations"` resolves correctly to the project's simulations folder.
-   `"./ .meta"` (in a plugin folder) resolves correctly to that specific plugin's `.meta` directory.

## Error Reporting

The system provides detailed error logs if a configuration cannot be parsed or if a defined `__xfs__` or `__meta__` path is unresolvable, facilitating easier debugging for plugin developers.

## Meta Logic Execution

The system automatically scans defined `__meta__` paths for `+xypriss.meta.ts/js` files.

-   If the path is a file, it executes the exported `run()` function.
-   If the path is a directory, it searches for `+xypriss.meta.ts/js` within that directory (and specialized subfolders like `.meta`).

