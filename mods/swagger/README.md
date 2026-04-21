# XyPriss Swagger Plugin

The **[XyPriss Swagger Plugin](https://github.com/Nehonix-Team/XyPriss/blob/master/mods/swagger)** is a high-performance auto-documentation tool for the XyPriss ecosystem. It automatically generates OpenAPI 3.0 specifications by introspecting the XyPriss route registry and serves a beautiful Swagger UI through an isolated auxiliary server.

## Features

- **Auto-Generation**: Automatically extracts routes, methods, path parameters, and guards from the XyPriss engine.
- **Isolated Serving**: Uses an auxiliary server to serve the documentation, keeping your main application logic clean and secure.
- **Zero-Trust Compatible**: Integrates with XyPriss security layers and handles route-level guards.
- **Micro-Services Ready**: Each instance can be configured with its own port and path.
- **High-Performance Streaming**: Swagger UI is served using Node.js Transform streams for zero-buffer, high-speed delivery.

## Installation

Install the plugin via XFPM:

```bash
xfpm add xypriss-swagger
```

## Usage

### 1. Register the Plugin

In your main XyPriss application, import and register the `SwaggerPlugin`:

```typescript
import { SwaggerPlugin } from "xypriss-swagger";
import { XyPrissServer } from "xypriss";

const server = new XyPrissServer();

server.use(
    SwaggerPlugin({
        port: 7070, // Port for the documentation server
        path: "/docs", // Path to access the Swagger UI
        title: "My API", // Documentation title
        version: "1.0.0", // API Version
    }),
);

server.start();
```

### 2. Configure Plugin Access

Ensure the plugin is authorized in your `xypriss.config.jsonc`:

```jsonc
{
    "$internal": {
        "xypriss-swagger": {
            "type": "plugin",
            "__meta__": {
                "path": "ROOT://",
            },
            "__xfs__": {
                "path": "CWD://",
            },
            "permissions": {
                "allowedHooks": [
                    "PLG.OPS.AUXILIARY_SERVER",
                    "PLG.SECURITY.ACCESS_CONFIGS",
                ],
                "policy": "allow",
            },
        },
    },
}
```

## Configuration Options

| Option        | Type     | Default               | Description                                                               |
| :------------ | :------- | :-------------------- | :------------------------------------------------------------------------ |
| `port`        | `number` | `7070`                | The port on which the auxiliary Swagger server will run.                  |
| `path`        | `string` | `"/docs"`             | The base path for the documentation (e.g., `http://localhost:7070/docs`). |
| `title`       | `string` | `"API Documentation"` | The title displayed in the Swagger UI.                                    |
| `version`     | `string` | `"1.0.0"`             | The version of the API documentation.                                     |
| `description` | `string` | plugin description    | Brief description of your API.                                            |

## Security & Trust

To use this plugin in a zero-trust environment, you must trust the developer ID.

> [!IMPORTANT]
> **Developer ID**: `ed25519:a58b17a3e46302dd3ae5538bc9b8b991c57f4c5fe2e7d8ac41803de818d947f4`

### Enrollment

When prompted by XFPM, paste the Developer ID above to authorize its execution.

## Documentation Access

Once the server is started, you can access:

- **Swagger UI**: `http://localhost:7070/docs`
- **OpenAPI JSON**: `http://localhost:7070/docs/swagger.json`

## Advanced: Route Metadata

You can customize the documentation for individual routes by adding metadata:

```typescript
server.get(
    "/users/:id",
    (req, res) => {
        // ...
    },
    {
        meta: {
            summary: "Get user by ID",
            tags: ["Users"],
            openapi: {
                responses: {
                    "200": {
                        description: "User found",
                    },
                },
            },
        },
    },
);
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

---

**By [Nehonix](https://github.com/Nehonix-Team)**

