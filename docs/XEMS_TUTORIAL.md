# 🔐 Building Secure Sessions with XEMS (A-Z)

This tutorial explains how to leverage the **XyPriss Encrypted Memory Store (XEMS)** to build high-security authentication systems. XEMS is designed to outperform traditional DB/Redis sessions by offering hardware-bound encryption and automatic token rotation.

## 1. Why XEMS?

Traditional sessions rely on a static Token (Session ID). If stolen, the session is compromised until it expires. XEMS introduces **Moving Target Defense**:

- **Atomic Rotation**: Every request results in a new token.
- **Hardware Binding**: Sessions are tied to the physical server's identity.
- **Sidecar Isolation**: Data is stored in a isolated, high-speed Go process.
- **5-Day Global Retention**: XEMS is a **temporary database**. By design, any record older than 5 days is automatically purged, ensuring no long-term traces.

### 🛡️ XEMS vs. Traditional Sessions

| Feature              | LocalStorage / Cookies   | Redis / Database Sessions    | XEMS (XyPriss)                |
| :------------------- | :----------------------- | :--------------------------- | :---------------------------- |
| **Data Location**    | Client-side (Vulnerable) | Server-side (Shared/Network) | Isolated Sidecar (Native)     |
| **Token Security**   | Persistent (Static)      | Persistent (Static)          | **Atomic (Rotated per req)**  |
| **Hijacking Window** | Days/Weeks               | Hours/Days                   | **Single Request (< 1s)**     |
| **Retention**        | Indefinite               | Manual Cleanup               | **Automatic (Max 5 days)**    |
| **Performance**      | Fast                     | Network Overhead             | **Direct IPC (Zero-latency)** |

---

## 2. API Architectures

XyPriss provides two ways to interact with XEMS depending on your needs.

### A. The `xLink` API (High-Level / Web Auth)

**Best for: Sessions, multi-step forms, and automated cookie management.**
`xLink` handles token generation, rotation, and HTTP transport (Cookies/Headers) automatically.

### B. The `xems` Public API (Programmatic / Fluent)

**Best for: Secure caching, stable user lookups, and internal security logic.**
Exported from `xypriss`, cette API utilise une approche **fluente** pour isoler les opérations :
`xems.from(sandbox).set(key, value, ttl?)`
`xems.from(sandbox).get(key)`

---

## 3. Real-World Implementation (Authentication)

Referencing the professional implementation in `.private/server.ts`, here is how to build a complete auth flow.

### Server Configuration

```typescript
import { createServer } from "xypriss";

const SESSION_SANDBOX = "auth-active";
const USERS_SANDBOX = "users-registry";

const app = createServer({
    server: {
        xems: {
            enable: true,
            sandbox: SESSION_SANDBOX, // Default sandbox for sessions
            ttl: "1h", // Session duration
            autoRotation: true,
            persistence: {
                enabled: true,
                secret: "8f2d6c1b9a5e4f0d3c7b2a1e6d9f8c0b", // Mandatory 32-byte secret
                path: "./.private/vault",
            },
        },
    },
});
```

### Registration & Stable Storage

You can use the `xems` programmatic API to store user records securely without needing an external database for temporary users.

```typescript
import { xems } from "xypriss";

app.post("/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    const userKey = `user:${hash(email)}`; // Stable key for lookup

    // 1. Store permanent-ish user data in a dedicated sandbox
    await xems
        .from(USERS_SANDBOX)
        .set(userKey, JSON.stringify({ name, email, pass: hash(password) }));

    // 2. Create the rotating session via xLink
    await res.xLink({ email, role: "user" }, SESSION_SANDBOX);

    res.json({ success: true });
});
```

### Login & Logout (Token Management)

When logging out, it is critical to call `xUnlink()` to ensure the session is destroyed both in the secure sidecar and on the client.

```typescript
app.post("/auth/logout", async (req, res) => {
    // Complete invalidation:
    // 1. Removes the entry from the Go memory store
    // 2. Clears HttpOnly cookies
    // 3. Removes security headers
    await res.xUnlink();

    res.json({ success: true, message: "Logged out securely" });
});
```

---

## 4. Frontend Integration

For a secure experience, your frontend must treat the token as a "hot handle".

1. **Credentials**: Always use `withCredentials: true` in Axios/Fetch.
2. **Persistence**: **Never** store the XEMS token in `localStorage`.
3. **Automatic Handling**: Since XyPriss uses `HttpOnly` cookies, your frontend code doesn't even need to touch the token — the browser and XyPriss handle the rotation transparently.

```typescript
// Example: Frontend api.ts
const api = axios.create({
    baseURL: "/api",
    withCredentials: true, // XyPriss rotates cookies automatically in the background
});
```

---

## 5. XEMS as a Temporary Database

XEMS is perfect for **Temporary Power-users**:

- **Usage**: Multi-step registrations, one-time-passwords (OTP), or transient "guest" profiles.
- **Security**: Data is ephemeral. If a user doesn't interact for 1 hour (TTL), the session dies. If the server is untouched for 5 days, the **entire record is purged** by the Go sidecar.
- **Method**: Use `xems.from(sandbox).set(key, data, "24h")` for internal storage.

---

## 6. Best Practices

1. **Sandboxing**: Keep `auth` sessions and `data` cache in separate sandboxes.
2. **Manual Invalidation**: On sensitive changes (password reset), always clear cookies via `res.clearCookie()`.
3. **32-Byte Secret**: Ensure your persistence secret is truly random and exactly 32 bytes.

**XEMS makes security invisible for developers but impenetrable for attackers.**
**Build fast. Build secure. Build with XyPriss.**

