# Response Control

Response Control is a global feature in XyPriss that allows you to hijack the default "404 Not Found" behavior and replace it with custom logic, status codes, or content. It works in both **XS-M** (Single-Mode) and **XM-M** (Multi-Mode / XMS).

> [!NOTE]
> Response Control is **disabled by default**. When disabled, XyPriss falls back to the `notFound` template handler.

## Configuration

You can enable Response Control via `ServerOptions` when creating your application.

### Basic Usage

```typescript
import { createServer } from "xypriss";

const app = createServer({
  responseControl: {
    enabled: true,
    statusCode: 404,
    content: "Oops! This page doesn't exist.",
    contentType: "text/plain"
  }
});

app.start();
```

### JSON Responses

If `content` is an object, XyPriss will automatically send it as JSON with the correct content type.

```typescript
responseControl: {
  enabled: true,
  statusCode: 404,
  content: {
    error: "Resource Not Found",
    code: "NOT_FOUND_001",
    timestamp: new Date().toISOString()
  }
}
```

### Custom Handlers

For complete control, you can provide a custom handler function.

```typescript
responseControl: {
  enabled: true,
  handler: (req, res) => {
    logger.warn(`404 detected at ${req.path}`);
    res.status(404).render("errors/404", { path: req.path });
  }
}
```

### Custom Headers

You can inject custom headers into the response.

```typescript
responseControl: {
  enabled: true,
  headers: {
    "X-XyPriss-Status": "Handled",
    "Cache-Control": "no-store"
  }
}
```

## How it works

When no route is matched for an incoming request:
1.  XyPriss checks if `responseControl` is enabled.
2.  If enabled, it executes your configuration (handler, content, etc.).
3.  If disabled (default), it falls back to the standard `NotFoundHandler`.

## Dynamic Hot-Swapping

One of the most powerful aspects of Response Control is that it can be updated **on-the-fly** without restarting the server. This is useful for scenarios like:

- **Emergency Maintenance**: Instantly point all unknown routes to a maintenance JSON/HTML.
- **Security Lockdown**: If an attack is detected, you can dynamically switch unknown routes from `404` to `403` or a honeypot handler.
- **A/B Testing Error Pages**: Change your error handling logic based on time of day or system load.

```typescript
// Switch to maintenance mode for all unknown routes
app.setResponseControl({
  enabled: true,
  statusCode: 503,
  content: { 
    status: "maintenance", 
    message: "System is undergoing scheduled updates." 
  }
});
```
