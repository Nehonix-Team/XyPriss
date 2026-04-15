# XEMS Tutorial: Building High-Security Authentication

This tutorial details the implementation of advanced authentication systems using the **XyPriss Encrypted Memory Store (XEMS)**. XEMS is designed to surpass traditional sessions with its native isolation, atomic rotation, and hardware-bound encryption.

---

## 1. Fundamental Concepts

XEMS relies on a **Moving Target Defense** architecture:

- **Sandbox Isolation**: Data is isolated into waterproof namespaces (sandboxes).
- **Atomic Rotation**: Every access can generate a new token, invalidating the old one.
- **Hardware Binding**: Data is cryptographically bound to the server's physical identity.

> [!IMPORTANT]
> XEMS utilizes a native sidecar for storage. This ensures that a vulnerability in the Node.js application does not provide direct access to the raw session memory.

---

## 2. Session API (createSession / resolveSession)

Unlike simple key/value storage, the session layer manages opaque tokens and their lifecycle.

### Creating a Session

Use `createSession` to generate a secure token bound to a data object.

```typescript
const runner = xems.forApp(app);
const token = await runner.createSession(
    "auth-pending",
    {
        email: "user@example.com",
        mfa_verified: false,
    },
    { ttl: "15m" },
);
```

### Resolution and Rotation

`resolveSession` retrieves the data and can perform an atomic rotation to prevent replay attacks.

```typescript
const session = await runner.resolveSession(token, {
    sandbox: "auth-pending",
    rotate: true, // Generate a new token atomically
    gracePeriod: 2000, // Leave 2s to the old token for concurrent requests
});

if (session) {
    console.log("Data:", session.data);
    console.log("New Token:", session.newToken);
}
```

> [!WARNING]
> Atomic rotation is critical in Single Page Applications (SPA). Without a **Grace Period**, concurrent requests (e.g., loading multiple widgets) would cause disconnections if one of them invalidates the token before the others have finished.

---

## 3. Multi-Factor (MFA) Login Workflow

Here is the recommended flow for a secure portal:

1. **Step 1**: Email/password validation. Creation of a temporary session in `otp-pending`.
2. **Step 2**: OTP validation. Data migration to an active session via `xLink()`.

```typescript
// PortalRouter.ts (Simulation)
router.post("/mfa/verify", async (req, res) => {
    const runner = xems.forApp(req.app);
    const tempSession = await runner
        .from("otp-pending")
        .get(req.body.tempToken);

    if (otpValid) {
        // Migration to active session (High-level API)
        await res.xLink({ userId: tempSession.userId, role: "admin" });
        await runner.from("otp-pending").del(req.body.tempToken);
    }
});
```

---

## 4. Security and Best Practices

### Persistence Secret Management

If persistence is enabled, the secret must be rigorously protected.

> [!CAUTION]
> The persistence secret must be exactly **32 bytes**. A weak or predictable secret compromises the entire encrypted storage on disk. Use environment variables.

### Multi-Server Isolation

In a multi-server architecture, each XEMS instance is isolated.

> [!TIP]
> Always use `xems.forApp(req.app)` in your handlers to ensure you are communicating with the XEMS process bound to the server instance processing the request.

---

## 5. Frontend Integration

For XEMS sessions (`xLink`), the frontend must never manipulate the tokens directly.

- Use `withCredentials: true` with Axios or `fetch`.
- Let the browser and the XyPriss framework manage the rotation via `HttpOnly` cookies.

---

_Copyright © 2026 Nehonix Team. Professional Security Documentation._

