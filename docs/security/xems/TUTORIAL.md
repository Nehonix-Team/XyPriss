# XEMS Tutorial: High-Security Session Management

This tutorial covers the implementation of enterprise-grade, hardware-bound authentication and session management in **XyPriss** using **XEMS (XyPriss Entry Management System)**.

---

## 1. Quick Overview: Native Session Helpers

XyPriss abstracts the underlying Go sidecar and cryptographic vault behind three elegant, built-in helpers:

- **`res.xLink(data, options?)`**: Initiates an authenticated session, encrypts the payload in the hardware-bound `.xems` vault, and issues the `HttpOnly` cookie and tracking header.
- **`req.session`**: Automatically resolves, decrypts, and attaches the active session data for incoming requests.
- **`res.xUnlink(options?)`**: Instantly purges the session from the encrypted vault and expires the client cookie.

---

## 2. Server Configuration

Declare your XEMS configuration in your server options or `xypriss.config.ts`:

```typescript
import { createServer } from "xypriss";
import path from "path";

export const app = createServer({
    server: {
        xems: {
            enable: true,
            path: path.resolve(process.cwd(), "vault.xems"), // Real vault path (.xems)
            secret: process.env.XEMS_SECRET!,               // Min 32-byte master key
            ttl: "7d",                                      // Session expiration (max 7 days)
            autoRotation: "1m",                             // Sliding window rotation (SPA-safe)
            gracePeriod: 15000,                             // 15 seconds grace overlap
            cookieName: "xems_token",
            cookieOptions: {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
            },
        },
    },
});
```

---

## 3. Real-World Authentication Flow

### A. Login: Creating a Session (`res.xLink`)

When credentials are verified, call `await res.xLink(sessionData)`. XEMS generates an opaque 48-character cryptographic token and transparently sends the `Set-Cookie` header:

```typescript
import { Router } from "xypriss";

const authRouter = new Router();

authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await authenticateUser(email, password);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // 🔐 Initiate secure XEMS session
    await res.xLink({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
    });

    return res.status(200).json({
        success: true,
        message: "Login successful",
        user: { id: user.id, email: user.email, role: user.role },
    });
});
```

---

### B. Route Protection & Guards (`req.session`)

Incoming requests with the session cookie or header automatically have their decrypted payload available on `req.session`:

```typescript
// authGuard.ts
export const authGuard = (req: any, res: any) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    return true; // Authorized
};

// Protected routes
const apiRouter = new Router();

apiRouter.get("/profile", { guards: [authGuard] }, async (req, res) => {
    // req.session is strictly typed and ready
    return res.json({
        userId: req.session.userId,
        role: req.session.role,
    });
});
```

---

### C. Logout: Destroying the Session (`res.xUnlink`)

To terminate a session, call `await res.xUnlink()`. It purges the key from the Go encrypted memory store and deletes the cookie from the browser:

```typescript
authRouter.post("/logout", async (req, res) => {
    // 🗑️ Terminate session in Go vault and expire cookie
    await res.xUnlink();

    return res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
});
```

---

## 4. Multi-Tenant & Custom Sandboxes

You can partition sessions into separate isolated namespaces (sandboxes) at runtime:

```typescript
// Link to a specific organization or admin sandbox
await res.xLink(adminData, {
    sandbox: `org.${user.tenantId}`,
    ttl: "12h",
});

// Destroy session in a specific sandbox
await res.xUnlink({ sandbox: `org.${user.tenantId}` });
```

---

## 5. Security Best Practices

1. **SPAs & Concurrent Requests**: Always configure `autoRotation` with a time window (e.g. `"1m"` or `"5m"`) and a generous `gracePeriod` (15 seconds) so parallel API requests do not trigger race conditions.
2. **Key Security**: Keep `XEMS_SECRET` (at least 32 characters) strictly in environment variables.
3. **Hardware Locking**: The generated `.xems` vault is cryptographically bound to the server's HWID and file path, making stolen database files useless to attackers.

---

_Copyright © 2026 Nehonix Team. All rights reserved._


