# XyPriss Swagger Plugin

Auto-documentation execution plugin for XyPriss Router V2.

## Features

- Provides automated API documentation via Swagger UI.
- Securely sandboxed within the XyPriss ecosystem.
- Caller-aware dependency injection with strict route filtering.

## Usage

This module is designed to be loaded natively by the XyPriss plugin manager. Ensure that it is authorized in your `xypriss.config.json` inside the `$internal` block.

```json
{
    "$internal": {
        "xypriss-swagger": {
            "__meta__": {
                "path": "CWD://node_modules/xypriss-swagger"
            },
            "__xfs__": {
                "path": "CWD://."
            }
        }
    }
}
```

> [!NOTE]
> For a deep dive into how XyPriss manages plugin isolation and filesystem access, see the [Workspace System Guide](../core/WORKSPACE_SYSTEM.md).

## Security & Permissions

In order to properly analyze your project's codebase and generate accurate Swagger documentation, this plugin requires the `CWD://` (Current Working Directory) context permission.

**Why is `CWD://` required?**
The plugin needs to resolve the active execution directory to dynamically scan your route files, interpret comments, and compile the OpenAPI JSON structure correctly.

**Is it safe?**
Absolutely. While `CWD://` grants broad access to the project root, the XyPriss Swagger plugin is an official, strictly audited core module. It **exclusively** performs safe, read-only operations targeting your router files. It explicitly ignores sensitive system files (e.g., `.env`, credentials) and does not leak or alter your business logic. Your environment remains completely secure.

## License

Provided under the Nehonix Open Source License (NOSL) v1.0. Check the included LICENSE file for comprehensive terms.

