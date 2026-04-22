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
xfpm add xypriss-swagger --verify
```

## Usage

### 1. Register the Plugin

In your main XyPriss application, import and register the `SwaggerPlugin`:

```typescript
import { SwaggerPlugin } from "xypriss-swagger";
import { createServer } from "xypriss";

const server = createServer({
    plugins: {
        register: [
            SwaggerPlugin({
                port: 7070, // Port for the documentation server
                path: "/docs", // Path to access the Swagger UI
                title: "My API", // Documentation title
                version: "1.0.0", // API Version
            }),
        ],
    },
});

server.start();
```

### 2. Configure Plugin Access

Ensure the plugin is authorized in your `xypriss.config.jsonc`:

```jsonc
{
    "$internal": {
        "xypriss-swagger": {
            "__meta__": {
                "path": "ROOT://",
            },
            "__xfs__": {
                "path": "CWD://",
            },
            "permissions": {
                "allowedHooks": [
                    "PLG.HTTP.ON_REQUEST",
                    "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
                    "PLG.LIFECYCLE.REGISTER",
                    "PLG.LIFECYCLE.SERVER_START",
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

In order to properly function and integrate safely into your Zero-Trust XyPriss environment, this plugin requires the following privileges to be strictly allowed in your `xypriss.config.jsonc`:

### Filesystem Context (`CWD://`)

**Why?** The plugin needs to resolve the active execution directory to dynamically scan your route files, interpret comments, and compile the OpenAPI JSON structure correctly.
**Is it safe?** Absolutely. The plugin performs exclusive read-only operations targeting your router files, safely ignoring sensitive `.env` or credentials.

### Lifecycle & Auxiliary Hooks

The Swagger plugin operates as an independent subsystem connected to the main server loop:

- `PLG.LIFECYCLE.REGISTER`: Required to negotiate initialization with the core engine.
- `PLG.LIFECYCLE.SERVER_START`: Allows the plugin to participate safely in the startup sequence.
- `PLG.OPS.AUXILIARY_SERVER`: **Crucial.** Permits the deployment of the isolated documentation HTTP server without exposing your main server loop.

### Security Access Hooks

- `PLG.HTTP.ON_REQUEST`: Used strictly on the isolated auxiliary server to mount the documentation UI and manage static assets.
- `PLG.SECURITY.ACCESS_SENSITIVE_DATA` & `PLG.SECURITY.ACCESS_CONFIGS`: Required for the plugin to introspect the router architecture and extract the internal metadata needed for documentation auto-generation.

By explicitly providing these permissions, you maintain complete Zero-Trust authority over what the plugin is allowed to do, preventing silent system overrides or unwanted network binding.

## License

Provided under the Nehonix Open Source License (NOSL) v1.0. Check the included LICENSE file for comprehensive terms.

---

**By [Nehonix](https://github.com/Nehonix-Team)**

