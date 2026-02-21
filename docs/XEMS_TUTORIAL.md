# Building Secure Sessions with XEMS

This tutorial walks through how to use the **XyPriss Encrypted Memory Store (XEMS)** to build high-security authentication systems from the ground up. XEMS is designed to outperform traditional database and Redis-backed sessions by offering hardware-bound encryption, automatic token rotation, and zero-network-overhead storage.

---

## 1. Why XEMS?

Traditional session management relies on a static token (Session ID). If that token is intercepted, the session is fully compromised until it expires — which could be hours or days later.

XEMS addresses this with a **Moving Target Defense** architecture:

- **Atomic Rotation** — Every request produces a new token. Stolen tokens expire after a single use.
- **Hardware Binding** — Sessions are cryptographically tied to the physical server's identity. Data cannot be decrypted on another machine.
- **Sidecar Isolation** — All data lives in a dedicated, high-speed Go subprocess, completely isolated from your application's memory space.
- **Automatic Retention** — Records are purged after a maximum of 5 days, ensuring no long-term traces accumulate on the server.

### XEMS vs. Traditional Session Strategies

| Feature              | LocalStorage / Cookies   | Redis / Database             | XEMS (XyPriss)                 |
| :------------------- | :----------------------- | :--------------------------- | :----------------------------- |
| **Data Location**    | Client-side (vulnerable) | Server-side (shared/network) | Isolated sidecar (native)      |
| **Token Security**   | Static, persistent       | Static, persistent           | Rotated per request            |
| **Hijacking Window** | Days or weeks            | Hours or days                | Single request (< 1s)          |
| **Retention Policy** | Indefinite               | Manual cleanup required      | Automatic (max 5 days)         |
| **Performance**      | Fast                     | Network overhead             | Direct IPC (near zero latency) |

---

## 2. API Architectures

XyPriss exposes two interfaces for interacting with XEMS, each suited to different use cases.

### A. The `xLink` API — High-Level Web Authentication

Best suited for: user sessions, multi-step forms, and automated cookie management.

`xLink` handles token generation, rotation, and HTTP transport (cookies and headers) automatically. You create or consume a session in a single call and let the framework manage the rest.

### B. The `xems` Fluent API — Programmatic Storage

Best suited for: secure caching, stable user record lookups, and internal security logic.

Exported directly from `xypriss`, this API uses a fluent, sandbox-scoped approach to keep operations explicit and isolated:

```ts
xems.from(sandbox).set(key, value, ttl?)
xems.from(sandbox).get(key)
```

---

## 3. Real-World Implementation

The following examples demonstrate a complete authentication flow using both APIs.

### Server Configuration

```typescript
import { createServer } from "xypriss";

const SESSION_SANDBOX = "auth-active";
const USERS_SANDBOX = "users-registry";

const app = createServer({
    server: {
        xems: {
            enable: true,
            sandbox: SESSION_SANDBOX, // Default sandbox for xLink sessions
            ttl: "1h", // Session lifetime
            autoRotation: true,
            persistence: {
                enabled: true,
                secret: "8f2d6c1b9a5e4f0d3c7b2a1e6d9f8c0b", // Must be exactly 32 bytes
                path: "./.private/vault",
            },
        },
    },
});
```

### Registration — Stable Storage and Session Creation

The `xems` programmatic API lets you store user records securely without an external database for ephemeral or temporary users.

```typescript
import { xems } from "xypriss";

app.post("/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    const userKey = `user:${hash(email)}`; // Deterministic, stable lookup key

    // Store user data in a dedicated, long-lived sandbox
    await xems
        .from(USERS_SANDBOX)
        .set(userKey, JSON.stringify({ name, email, pass: hash(password) }));

    // Create a rotating session and inject the token via xLink
    await res.xLink({ email, role: "user" }, SESSION_SANDBOX);

    res.json({ success: true });
});
```

### Logout — Complete Session Invalidation

When a user logs out, `xUnlink()` must be called explicitly. It performs a three-step teardown: removing the entry from the Go memory store, clearing the `HttpOnly` cookie, and stripping any session-related response headers.

```typescript
app.post("/auth/logout", async (req, res) => {
    await res.xUnlink();
    res.json({ success: true });
});
```

Failing to call `xUnlink()` on logout leaves a valid (though short-lived) token in circulation until the next rotation cycle.

---

## 4. Frontend Integration

Because XyPriss uses `HttpOnly` cookies, the frontend never has direct access to the session token — rotation happens transparently between the browser and the server. This eliminates an entire category of client-side token theft.

The only requirement on the frontend is ensuring credentials are included with every request:

```typescript
// api.ts
const api = axios.create({
    baseURL: "/api",
    withCredentials: true, // Required for HttpOnly cookie transport
});
```

Two rules to enforce across your frontend codebase:

- Always set `withCredentials: true` (or `credentials: "include"` for native `fetch`).
- Never store an XEMS token in `localStorage` or `sessionStorage`. The browser and XyPriss handle all token management — your code should never touch it.

---

## 5. XEMS as a Temporary Data Store

Beyond session management, XEMS is well suited as a secure, ephemeral data layer for short-lived workflows.

Practical applications include multi-step registration flows, one-time passwords (OTP), email verification states, and transient guest profiles. Any data that is inherently temporary and security-sensitive is a strong candidate.

```typescript
// Store a pending OTP with a 15-minute TTL
await xems.from("otp-pending").set(`otp:${hash(email)}`, otpCode, "15m");
```

Data stored this way is automatically purged when the TTL expires, or at the latest after the 5-day global retention ceiling — no manual cleanup required.

---

## 6. Best Practices

**Sandbox isolation.** Keep authentication sessions, user records, and application caches in separate sandboxes. Isolation is enforced cryptographically, not just logically.

**Explicit invalidation on sensitive events.** Token rotation protects against passive hijacking, but for high-impact actions (password reset, privilege escalation, suspicious activity detection), always call `res.xUnlink()` and force re-authentication.

**Secret hygiene.** The persistence secret must be exactly 32 bytes and generated with a cryptographically secure random source. Do not derive it from user input, application names, or any guessable value. Treat it with the same care as a private key.

---

_Copyright © 2026 Nehonix Team. All rights reserved._

