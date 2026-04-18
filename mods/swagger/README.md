# XyPriss Swagger Plugin

Auto-documentation execution plugin for XyPriss Router V2.

## Features

- Provides automated API documentation via Swagger UI.
- Securely sandboxed within the XyPriss ecosystem.
- Caller-aware dependency injection with strict route filtering.

## Security Identity & Verification

> [!IMPORTANT]
> This plugin is secured with the XyPriss G3 Zero-Trust protocol. You MUST manually verify this Public Key during installation.

**Developer ID (Public Key):**
`ed25519:a58b17a3e46302dd3ae5538bc9b8b991c57f4c5fe2e7d8ac41803de818d947f4`

## Usage

This module is designed to be loaded natively by the XyPriss plugin manager. Ensure that it is authorized in your `xypriss.config.jsonc` inside the `$internal` block, including the cryptographic signature.

```json
{
    "$internal": {
        "xypriss-swagger": {
            "type": "plugin",
            "__meta__": {
                "path": "ROOT://"
            },
            "__xfs__": {
                "path": "CWD://"
            },
            "permissions": {
                "allowedHooks": [
                    "PLG.OPS.AUXILIARY_SERVER",
                    "PLG.SECURITY.ACCESS_CONFIGS"
                ],
                "policy": "allow"
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

