# XMS (XyPriss Multi-Server)

XyPriss Multi-Server (XMS) is a high-performance orchestration mode that allows you to run multiple isolated server instances within a single Node.js process. Each instance can have its own port, security policies, caching strategies, and route scopes while sharing the same underlying system resources.

## Why XMS?

- **Isolation**: Run an Admin API, a Public API, and a Monitoring service in the same process but on different ports with different security levels.
- **Resource Efficiency**: Shared memory and process overhead compared to running multiple independent processes.
- **Unified Management**: Start, stop, and monitor all your services from a single entry point.
- **Micro-services in a Monolith**: Perfect for modular architectures that need physical separation at the network layer without the complexity of a service mesh.

## Configuration

XMS is configured programmatically via the `ServerOptions` passed to the `createServer` function.

```typescript
import { createServer } from "xypriss";

const app = createServer({
  multiServer: {
    enabled: true,
    servers: [
      {
        id: "public-api",
        port: 8080,
        routePrefix: "/api/v1",
      },
      {
        id: "admin-panel",
        port: 8081,
        routePrefix: "/admin",
      }
    ]
  }
});
```

### Server Configuration Options (`MultiServerConfig`)

Each entry in the `servers` array supports the following properties:

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | **Required**. A unique identifier for the server instance (used in logs). |
| `port` | `number` | **Required**. The port the instance will listen on. |
| `host` | `string` | The host address (default: `127.0.0.1`). |
| `routePrefix` | `string` | A prefix to filter or inject into routes handled by this instance. |
| `routePrefixStrategy` | `string` | How to handle the prefix: `auto-inject` (default), `strict-match`, or `both`. |
| `allowedRoutes` | `string[]` | Patterns of routes this instance is allowed to serve (e.g. `["/api/*", "/login"]`). |
| `responseControl` | `object` | Custom behavior for when a route is not found or matched on this instance. |
| `...ServerOptions` | `any` | Any other `ServerOptions` (security, cache, fileUpload, etc.) to override for this instance. |

## Global Configuration Merging

XyPriss implements a **Global Merge Rule** for XMS to reduce configuration redundancy. Options defined at the root of the `ServerOptions` object are treated as global defaults for all server instances.

### How it Works

1.  **Inheritance**: Any property defined at the same level as `multiServer` (e.g., `logger`, `security`, `fileUpload`) is automatically deeply merged into each individual server configuration.
2.  **Deep Merge**: The system uses a deep-merge strategy, meaning nested objects (like `security.helmet` or `logger.format`) are intelligently combined.
3.  **Precedence**: Configuration defined explicitly inside a server entry in the `servers` array always takes precedence over root-level global options.

### Example

```typescript
const app = createServer({
  // --- GLOBAL SETTINGS ---
  // All servers will use 'debug' level and have CSRF enabled
  logger: { level: 'debug' },
  security: { csrf: true },

  multiServer: {
    enabled: true,
    servers: [
      { 
        id: "public-api", 
        port: 8080 
        // Inherits: logger { level: 'debug' }, security { csrf: true }
      },
      { 
        id: "internal-api", 
        port: 8081,
        logger: { level: 'info' } // Overrides global level to 'info'
        // Inherits: security { csrf: true }
      }
    ]
  }
});
```

## Route Orchestration

XMS provides a powerful way to distribute routes across instances.

### Route Filtering

By default, if you define routes on your main `app`, XMS will attempt to register them on all instances. You can restrict this using `allowedRoutes` or `routePrefix`.

### Prefix Strategies (`routePrefixStrategy`)

1.  **`auto-inject`** (Default): If a route is registered as `/login` but the server has a prefix `/auth`, it will be served at `/auth/login` on that specific port.
2.  **`strict-match`**: Only routes explicitly registered with the prefix (e.g., `app.get("/auth/login", ...)`) will be served.
3.  **`both`**: The route will be served at both its original path and the prefixed path.

## Instance-Level Response Control

You can define what happens when a request hits a server port but doesn't match any allowed routes. This feature uses the global `responseControl` system.

See the [Response Control Guide](response-control.md) for more details.

```typescript
"responseControl": {
  "enabled": true,
  "statusCode": 403,
  "content": { "error": "Access Denied to this Server Instance" },
  "contentType": "application/json",
  "headers": { "X-XMS-Status": "Filtered" }
}
```

## Security & Isolation

Each XMS instance creates a virtual sandbox for its configuration:
- **Independent Security**: One port can have strict CSRF and Helmet, while another is open for public Webhooks.
- **Isolated XEMS**: If enabled, each instance can have its own Encrypted Memory Store.
- **Custom Logging**: Logs are prefixed with the server `id` for easy debugging.

## Programmatic Usage

```typescript
import { createServer } from "xypriss";

const app = createServer({
  multiServer: {
    enabled: true,
    servers: [
      { id: "web", port: 3000 },
      { id: "api", port: 4000, routePrefix: "/api" }
    ]
  }
});

// These routes will be distributed based on the XMS config
app.get("/", (req, res) => res.send("Web Home"));
app.get("/api/data", (req, res) => res.json({ data: [] }));

app.start();
```

> [!IMPORTANT]
> When `multiServer` is enabled, `app.start()` will boot all configured instances. Ensure your system has permissions to bind to the requested ports.
