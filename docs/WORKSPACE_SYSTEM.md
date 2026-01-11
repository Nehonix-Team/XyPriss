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
| `__xfs__`       | `object` | Defines a specialized xypriss filesystem instance.                                                 |
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
    // Accessing the specialized plugin workspace
    const pluginFiles = (__sys__ as XyPrissSys).$plug?.$lsDirs(".");

    // Standard access still points to the project root
    const rootFiles = (__sys__ as XyPrissSys).$lsDirs(".");
}
```

## Path Resolution Placeholders

-   `#$` or `$#`: Resolves to the absolute path of the project root.
    -   Example: `"#$/plugins/my-plugin"` resolution depends on where the `xypriss.config.json` is located.

## Meta Logic Execution

The system automatically scans defined `__meta__` paths for `+xypriss.meta.ts/js` files.

-   If the path is a file, it executes the exported `run()` function.
-   If the path is a directory, it searches for `+xypriss.meta.ts/js` within that directory (and specialized subfolders like `.meta`).

