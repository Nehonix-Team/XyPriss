# XEMS Usage Guide

XEMS provides two primary abstraction layers: high-level session management via `xLink` and low-level storage via the fluent `xems` API.

## High-Level Session Management

The `xLink` API is the recommended way to manage user authentication. It handles token generation, secure cookie injection, and automatic rotation.

### Linking a Session

```typescript
app.post("/login", async (req, res) => {
    // 1. Verify credentials
    // ... logic

    // 2. Link session data to the client
    await res.xLink({ userId: "123", role: "admin" });

    res.json({ success: true });
});
```

### Retrieving Session Data

```typescript
app.get("/profile", (req, res) => {
    if (!req.session) {
        return res.status(401).send("Unauthorized");
    }

    // req.session is automatically populated and decrypted
    const { userId, role } = req.session;
    res.json({ userId, role });
});
```

### Unlinking (Logout)

```typescript
app.post("/logout", async (req, res) => {
    await res.xUnlink();
    res.json({ success: true });
});
```

## Low-Level Storage (Fluent API)

The `xems` API provides direct access to the encrypted storage engine, allowing you to store temporary data in specific sandboxes.

### Core Operations

````typescript
import { xems } from "xypriss";

const xdb = await xems.from("cache")

// Set a value in a sandbox
await xdb.set("key1", "value1", "10m");

// Get a value
const val = await xdb.get("key1");

// Delete a value
await xdb.del("key1");

## Session Management Layer

The Session Layer (Opaque Tokens) provides advanced features like atomic rotation.

### createSession
Generates a random token and stores data in a sandbox.
```typescript
const token = await runner.createSession("sandbox", { userId: 1 }, { ttl: "1h" });
````

### resolveSession

Retrieves data and optionally rotates the token.

```typescript
const session = await runner.resolveSession(token, {
    sandbox: "sandbox",
    rotate: true,
    gracePeriod: 1000,
});
// session = { data, newToken? }
```

> [!WARNING]
> Use `.del()` instead of `.delete()` for key removal in the fluent API.

## Multi-Server Best Practices

In multi-server deployments, each app instance maintains its own XEMS connection. To ensure you are interacting with the correct store, use `xems.forApp(app)`.

### Request Context

Inside a route handler, use the `app` instance from the request:

```typescript
app.get("/data", async (req, res) => {
    const runner = xems.forApp(req.app);
    const result = await runner.from("system").get("metadata");
});
```

### Process Isolation

XEMS automatically handles process-level deduplication. If multiple server instances share the same persistence file path, they will internally share a single background sidecar process to prevent data corruption.

> [!IMPORTANT]
> Always use `withCredentials: true` (or `credentials: "include"`) on the frontend. Since XEMS sessions use `HttpOnly` cookies for security, the browser must be explicitly instructed to send them in cross-origin or API requests.

---

_Copyright © 2026 Nehonix Team. All rights reserved._

