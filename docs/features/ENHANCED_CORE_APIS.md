# Enhanced Core APIs & Utilities (Update 2026-03-04)

This update introduces several key enhancements to the XyPriss HTTP Server, Security Module, and System APIs to improve Developer Experience (DX), robustness, and flexibility.

## 1. HTTP Server Enhancements

### `res.html(htmlString)`

A convenience method for sending HTML responses. It automatically sets the `Content-Type` header to `text/html; charset=utf-8`.

```typescript
app.get("/welcome", (req, res) => {
    res.html("<h1>Welcome to XyPriss</h1>");
});
```

### Route-Level Redirection: `app.redirect()`

You can now register dedicated redirect routes directly on the application instance. This is more efficient than manual route handlers.

```typescript
// Permanent redirect (301)
app.redirect("/old-path", "/new-path");

// Temporary redirect (302)
app.redirect("/promo", "https://external.com", 302);
```

### Request-Level Redirection: `req.redirect()`

An alias for `res.redirect()` available on the request object. Useful for semantic consistency or when passing the `req` object to utility functions.

**Note:** Always use `return` to stop handler execution.

```typescript
app.get("/secure", (req, res) => {
    if (!req.session.user) return req.redirect("/login");
    // ... logic
});
```

### Server-Side Forwarding: `req.forward()`

Asynchronously forwards the current request to another endpoint (internal or external).

- **Inheritance**: Uses the same method, body, and headers by default.
- **Internal Resolution**: Automatically resolves relative paths (e.g., `/test`) to the current server's port.
- **Auto-Parsing**: Automatically parses JSON responses.

```typescript
app.post("/submit", async (req, res) => {
    // Delegate validation to another service
    const validation = await req.forward("/internal/validate");

    if (!validation.valid) return res.status(400).json(validation);
    res.success({ message: "Data accepted" });
});
```

---

## 2. Security Module Updates

### Deterministic `hash()` Function

A simple, standalone `hash()` function is now exported from `xypriss-security` for non-password use cases like integrity checks or cache keys.

```typescript
import { hash } from "xypriss-security";

const key = hash("data-to-fingerprint");
// Always returns consistent SHA-256 hex string
```

---

## 3. System & File Operations

### Robust `$write` Operations

The `__sys__.$write` method (and the underlying `FSApi`) now ensures that parent directories exist before writing.

```typescript
// Will automatically create "deep/nested/folders" if they don't exist
__sys__.$write("deep/nested/folders/config.json", JSON.stringify(data));
```

### XEMS Persistence Safety

When XEMS persistence is enabled, XyPriss now verifies and creates the directory path for the vault file automatically, preventing initialization crashes.

---

## 4. CLI Tools (XFPM)

### Visual Feedback

The `xfpm` package manager now uses professional colored logging:

- **Red**: Errors and critical failures.
- **Yellow**: Warnings and deprecations.
- **Green**: Success messages.
- **Blue**: Informational updates.

