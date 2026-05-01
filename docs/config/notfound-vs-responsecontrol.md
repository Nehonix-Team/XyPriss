# NotFound vs Response Control

In XyPriss, there are two mechanisms for handling requests that don't match any registered route. While they might seem similar, they serve different purposes: **Visual presentation** vs. **Functional control**.

## Summary Comparison

| Feature | `notFound` (Visual) | `responseControl` (Functional) |
| :--- | :--- | :--- |
| **Primary Goal** | Render a pretty 404 page for humans. | Control HTTP behavior (JSON, Status, Logic). |
| **Default Status** | `404 Not Found` (Fixed). | Customizable (403, 410, 500, etc.). |
| **Content Type** | `text/html` (Fixed). | `application/json`, `text/plain`, etc. |
| **Mode Support** | XS-M (Global) | XS-M & XM-M (Per Instance). |
| **Priority** | Low (Last Resort). | High (Hijacks the response). |

---

## 1. `notFound` (Visual Template)

The `notFound` configuration is designed for web applications that need a branded error page. It uses a built-in template engine to inject titles, messages, and themes.

**Use this when:**
- You want a dark/light themed 404 page.
- You need to show a "Go back home" button with a countdown.
- You want to inject custom CSS into the error page.

```typescript
notFound: {
  enabled: true,
  title: "Oops! Lost in space",
  themeClass: "dark",
  redirectTo: "/home"
}
```

## 2. `responseControl` (Behavioral Control)

The `responseControl` system is a more powerful, low-level interceptor. It is designed for APIs or security-conscious applications that need to control the actual HTTP response payload and status.

**Use this when:**
- You are building a JSON API (return `{ "error": "not_found" }`).
- You want to return a `403 Forbidden` for any unknown route (security by obscurity).
- You need to execute a server-side function (`handler`) to log the event or block an IP.

```typescript
responseControl: {
  enabled: true,
  statusCode: 403,
  content: { status: "denied", message: "Unauthorized path access" }
}
```

---

## Priority & Conflict Resolution

If both systems are enabled:
1.  **`responseControl` takes precedence.** XyPriss first checks if a custom response is defined.
2.  If `responseControl` successfully handles the request (sends content or executes a handler), the process stops.
3.  If `responseControl` is disabled (default), XyPriss falls back to the `notFound` handler to render the visual page.

---

## Dynamic vs. Static Nature

- **`notFound` is largely static**: It is configured at startup and usually remains constant throughout the server's lifecycle.
- **`responseControl` is dynamic**: Using `app.setResponseControl()`, you can hot-swap your error handling logic in real-time (e.g., to trigger a maintenance mode or a security lockdown).

> [!TIP]
> In **XM-M (Multi-Server)** mode, each server instance should use `responseControl` for isolation, while `notFound` typically serves as the global system fallback.
