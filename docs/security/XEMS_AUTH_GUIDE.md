# XEMS — Secure Session & Temporary Storage Guide

> **XEMS** (XyPriss Encrypted Memory Store) is XyPriss's mission-critical session security core. It provides AES-256-GCM encrypted in-memory storage, opaque session tokens, and automatic per-request token rotation — all powered by a dedicated Rust sidecar process.

---

## Table of Contents

1. [Why XEMS?](#1-why-xems)
2. [Setup & Configuration](#2-setup--configuration)
3. [Authentication Flow](#3-authentication-flow)
4. [Temporary Data Storage](#4-temporary-data-storage)
5. [Automatic Rotation & Grace Period](#5-automatic-rotation--grace-period)
6. [Sandboxes — Namespace Isolation](#6-sandboxes--namespace-isolation)
7. [Persistent Mode](#7-persistent-mode)
8. [Accessing Session Data](#8-accessing-session-data)
9. [Low-Level API](#9-low-level-api)
10. [Security Best Practices](#10-security-best-practices)
11. [Configuration Reference](#11-configuration-reference)

---

## 1. Why XEMS?

XEMS solves a core security problem: storing session data **securely, server-side, without Redis, a database, or the filesystem** for standard use cases.

### XEMS vs JWT

|                                | JWT                 | XEMS                      |
| ------------------------------ | ------------------- | ------------------------- |
| Instant revocation             | ❌                  | ✅                        |
| Payload hidden from client     | ❌ (base64 visible) | ✅ (opaque token)         |
| Replay attack protection       | ❌ (fixed lifetime) | ✅ (per-request rotation) |
| External infrastructure        | None                | None                      |
| Data encryption                | ❌                  | AES-256-GCM               |
| Session invalidation on logout | ❌ (must wait TTL)  | ✅ immediate              |

### How It Works

```
Browser
  │  Cookie (HttpOnly): xems_token=<hex_token>
  │
  ▼
XyPriss (Node.js)  ──── XEMS Built-in Middleware
  │                            │
  │     JSON-IPC (stdin/stdout)│
  │                            ▼
  │                    XEMS Rust Binary
  │                    ├── AES-256-GCM encryption
  │                    ├── Lock-free DashMap store
  │                    ├── Atomic token rotation
  │                    └── Background cleanup thread
  ▼
req.session = { userId, role, ... }  ← decrypted automatically
```

The token stored in the cookie is a **random opaque hex string** — it contains zero user data. The actual payload is encrypted inside the Rust process and never leaves the server.

---

## 2. Setup & Configuration

Add `server.xems` to your XyPriss configuration:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        port: 3000,
        xems: {
            // Enable XEMS middleware
            enable: true,

            // Sandbox (isolated namespace for this app's sessions)
            sandbox: "auth-session",

            // Session time-to-live  (s, m, h, d)
            ttl: "15m",

            // HttpOnly cookie name injected into every response
            cookieName: "xems_token",

            // Fallback header for non-browser clients (mobile, APIs)
            headerName: "x-xypriss-token",

            // Rotate the token on every authenticated request
            autoRotation: true,

            // How long the old token stays readable after rotation (ms)
            // Prevents failures on concurrent requests from the same client
            gracePeriod: 1000,

            // Which key on `req` receives the decrypted session data
            attachTo: "session",
        },
    },
    security: {
        cors: { origin: "http://localhost:5173", credentials: true },
    },
});
```

> **Note:** Without a `persistence` block, XEMS runs in **volatile mode** — sessions are lost on server restart. This is the recommended default for most applications.

---

## 3. Authentication Flow

### Step 1 — Login: create a session

After verifying credentials, call `res.xLink()` to create an XEMS session and inject the token into the response:

```typescript
import { createServer } from "xypriss";

app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;

    // 1. Verify credentials (your own logic)
    const user = await db.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2. Create the XEMS session.
    //    res.xLink() encrypts the payload, stores it in the Rust process,
    //    and injects the opaque token into:
    //      - Cookie: "xems_token" (HttpOnly, Secure, SameSite=Strict)
    //      - Header: "x-xypriss-token"
    await res.xLink({
        userId: user.id,
        email: user.email,
        role: user.role,
        loginAt: new Date().toISOString(),
    });

    // 3. Respond — the token is already in headers/cookies
    res.json({ success: true, user: { id: user.id, name: user.name } });
});
```

### Step 2 — Protected routes: read the session

On every subsequent request, XEMS automatically decrypts the token and populates `req.session`:

```typescript
app.get("/auth/profile", (req, res) => {
    // req.session is populated automatically by the XEMS middleware
    if (!req.session) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    res.json({
        user: req.session,
        // true if the token was rotated on this request
        tokenRotated: !!res.getHeader("x-xypriss-token"),
    });
});
```

### Step 3 — Logout: invalidate the session

```typescript
import { createServer, xems } from "xypriss";

app.post("/auth/logout", async (req, res) => {
    const token =
        req.cookies?.xems_token || (req.headers["x-xypriss-token"] as string);

    if (token) {
        // Immediate deletion from the Rust store — token is dead right now
        await xems.del("auth-session", token);
    }

    res.clearCookie("xems_token");
    res.json({ success: true });
});
```

### Reusable auth middleware

```typescript
import { createServer } from "xypriss";

// middleware/requireAuth.ts
export function requireAuth(req: any, res: any, next: any) {
    if (!req.session) {
        return res.status(401).json({ error: "Authentication required" });
    }
    next();
}

// Role guard
export function requireRole(role: string) {
    return (req: any, res: any, next: any) => {
        if (!req.session || req.session.role !== role) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
}

// Usage
app.get("/dashboard", requireAuth, (req, res) => {
    res.json({ welcome: req.session.email });
});

app.delete("/admin/users/:id", requireAuth, requireRole("admin"), handler);
```

---

## 4. Temporary Data Storage

XEMS can store any serialisable data, not just auth sessions. It excels at:

- **OTP / email verification codes**
- **Multi-step wizard state**
- **Custom rate-limiting counters**
- **Short-lived API caches**

### Using the low-level API

```typescript
import { xems } from "xypriss";

// Store an OTP code with a 5-minute TTL
async function storeOtpCode(email: string, code: string) {
    await xems.set(
        "otp-verification", // isolated sandbox
        `otp:${email}`, // key
        JSON.stringify({ code, createdAt: Date.now() }),
        "5m", // TTL
    );
}

// Verify and consume an OTP code (one-time use)
async function verifyOtpCode(email: string, input: string): Promise<boolean> {
    const raw = await xems.get("otp-verification", `otp:${email}`);
    if (!raw) return false; // expired or never existed

    const { code } = JSON.parse(raw);

    // Delete immediately after use
    await xems.del("otp-verification", `otp:${email}`);

    return code === input;
}
```

```typescript
import { createServer, xems } from "xypriss";

// Send OTP
app.post("/auth/send-otp", async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100_000 + Math.random() * 900_000).toString();

    await storeOtpCode(email, code);
    await emailService.send(email, `Your code: ${code}`);

    res.json({ sent: true });
});

// Verify OTP and create session
app.post("/auth/verify-otp", async (req, res) => {
    const { email, code } = req.body;
    const valid = await verifyOtpCode(email, code);

    if (!valid) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }

    await res.xLink({ email, verified: true });
    res.json({ success: true });
});
```

### Multi-step wizard state

```typescript
import { createServer, xems } from "xypriss";
import { randomUUID } from "crypto";

app.post("/onboarding/step-1", async (req, res) => {
    const wizardId = req.cookies.wizard_id || randomUUID();

    await xems.set(
        "wizard-state",
        wizardId,
        JSON.stringify({ step: 1, data: req.body }),
        "30m",
    );

    res.cookie("wizard_id", wizardId, { httpOnly: true });
    res.json({ nextStep: 2 });
});

app.post("/onboarding/step-2", async (req, res) => {
    const wizardId = req.cookies.wizard_id;
    const raw = await xems.get("wizard-state", wizardId);

    if (!raw)
        return res
            .status(400)
            .json({ error: "Session expired, please restart" });

    const state = JSON.parse(raw);
    state.step = 2;
    state.data = { ...state.data, ...req.body };

    await xems.set("wizard-state", wizardId, JSON.stringify(state), "30m");
    res.json({ nextStep: 3 });
});
```

---

## 5. Automatic Rotation & Grace Period

### Why token rotation?

Without rotation, a stolen token (via XSS, log leak, network sniff) remains valid until it expires. With XEMS, **every authenticated request consumes the old token and issues a fresh one** — a stolen token becomes useless after the first legitimate use.

```
Request 1 (token A) → Response + new token B
Request 2 (token A) → ❌ rejected (already consumed)
Request 2 (token B) → ✅ accepted, issues token C
```

### The grace period solves concurrent request failures

Without a grace period, a page that fires several parallel requests would break:

```
t=0ms : Req 1 (token A) → Rust rotates A → issues B
t=1ms : Req 2 (token A) → ❌ A is already gone
```

With `gracePeriod: 1000` (1 second), the old token stays **readable** for 1s after rotation:

```
t=0ms  : Req 1 (token A) → rotates A → issues B, A becomes zombie (1s TTL)
t=1ms  : Req 2 (token A) → A is a zombie but still valid → ✅
t=1001ms: A is purged by the background scavenger
```

### Recommended settings

```typescript
xems: {
  autoRotation: true,
  gracePeriod: 1500, // 1.5s — covers most browser waterfall request patterns
}
```

---

## 6. Sandboxes — Namespace Isolation

Sandboxes fully isolate different data types. A `get` call against sandbox `"auth"` can never read data from sandbox `"otp"`, even if the key is identical.

```typescript
import { createServer, xems } from "xypriss";

// Default sandbox (matches `server.xems.sandbox`)
await res.xLink(userData);

// Custom sandbox for a separate admin session
await res.xLink(adminData, "admin-session");

// Direct API with explicit sandbox
await xems.set("otp-codes", `otp:${email}`, code, "5m");
await xems.set("api-cache", cacheKey, payload, "1h");
```

```
STORE
├── sandbox: "auth-session"
│   ├── <token_1> → { userId: 1, role: "user" }
│   └── <token_2> → { userId: 2, role: "user" }
├── sandbox: "admin-session"
│   └── <token_3> → { adminId: 99, role: "admin" }
└── sandbox: "otp-codes"
    └── otp:alice@example.com → { code: "482910" }
```

**Rule:** Always use descriptive, stable sandbox names. Never generate them dynamically from user input.

---

## 7. Persistent Mode

In persistent mode, sessions survive server restarts. Data is saved to an encrypted `.xems` binary vault that is cryptographically bound to the host machine's hardware ID.

> ⚠️ **Warning:** A `.xems` file is tied to the machine that created it. Copying it to another server will make it permanently unreadable — by design.

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        xems: {
            enable: true,
            sandbox: "auth-session",
            ttl: "7d",
            persistence: {
                enabled: true,
                // Path to the vault file (directory or full path)
                path: "./data/xems-vault",
                // MANDATORY — exactly 32 UTF-8 bytes
                secret: process.env.XEMS_SECRET!,
                resources: {
                    cacheSize: 64, // MB allocated to in-memory cache
                },
            },
        },
    },
});
```

```bash
# Generate a cryptographically secure 32-byte secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"
```

```dotenv
# .env  (never commit this file)
XEMS_SECRET=a7f3d2e1b4c5f6a8d9e0f1a2b3c4d5e6
```

> **Security:** Never hardcode `XEMS_SECRET` in your source code. Use environment variables or a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, Doppler, etc.).

---

## 8. Accessing Session Data

`req.session` is populated automatically on every request once XEMS is enabled.

### TypeScript augmentation

Extend XyPriss request types for full autocompletion:

```typescript
// types/session.d.ts
declare module "xypriss" {
    interface XyPrissRequest {
        session?: {
            userId: string;
            email: string;
            role: "user" | "admin" | "moderator";
            loginAt: string;
        };
    }
}
```

```typescript
import { createServer } from "xypriss";

app.get("/me", (req, res) => {
    if (!req.session) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    // Fully typed
    const { userId, email, role } = req.session;
    res.json({ userId, email, role });
});
```

### Updating session data

XEMS does not mutate data in place. To update a session, recreate it with `res.xLink()`:

```typescript
import { createServer } from "xypriss";

app.put("/auth/role", requireAuth, requireRole("admin"), async (req, res) => {
    const { userId, newRole } = req.body;

    // Update your database
    await db.users.updateRole(userId, newRole);

    // Reissue the session with updated data
    await res.xLink({
        ...req.session,
        role: newRole,
        updatedAt: new Date().toISOString(),
    });

    res.json({ success: true });
});
```

---

## 9. Low-Level API

Import `xems` for direct access to the Rust store, bypassing the automatic middleware:

```typescript
import { xems } from "xypriss";

// Health check
await xems.ping(); // → "pong"

// Set a value with TTL
await xems.set("my-sandbox", "my-key", "my-value", "10m");

// Get a value (returns null if expired or missing)
const value = await xems.get("my-sandbox", "my-key");

// Delete immediately
await xems.del("my-sandbox", "my-key");

// Create a session manually (returns the opaque token)
const token = await xems.createSession(
    "auth", // sandbox
    { userId: 42 }, // data (any serialisable object)
    { ttl: "15m" }, // options
);

// Resolve a token (with optional rotation)
const result = await xems.resolveSession(token, {
    sandbox: "auth",
    rotate: true, // atomically rotate
    gracePeriod: 1000, // ms the old token stays valid
});
// result → { data: { userId: 42 }, newToken: "new_hex_token" } | null
```

### Immediate logout (forced invalidation)

```typescript
import { createServer, xems } from "xypriss";

app.post("/auth/logout", async (req, res) => {
    const token =
        req.cookies?.xems_token || (req.headers["x-xypriss-token"] as string);

    if (token) {
        // Token is dead the instant this call resolves
        await xems.del("auth-session", token);
    }

    res.clearCookie("xems_token");
    res.json({ success: true });
});
```

---

## 10. Security Best Practices

### ✅ Do

- Enable `autoRotation: true` in production
- Use short TTLs — `15m` for sensitive sessions, `7d` maximum for "remember me"
- Set a `gracePeriod` of at least `1000ms` if your frontend fires parallel requests
- Store `XEMS_SECRET` in environment variables or a secrets manager
- Always set `credentials: true` in CORS config when using cookies
- Use distinct, descriptive sandbox names per data type
- Call `xems.del()` on logout for immediate invalidation

### ❌ Don't

- Do not call `res.xLink()` on every request — only call it at login / session creation
- Do not use wildcard CORS origins (`*`) with `credentials: true`
- Do not store the token in `localStorage` — rely on the injected `HttpOnly` cookie
- Do not commit `XEMS_SECRET` to version control
- Do not share a sandbox name between unrelated data types
- Do not set `gracePeriod: 0` if your client sends concurrent requests

### Required CORS configuration

Cookies with `credentials: true` require an **exact origin** (no wildcards):

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        cors: {
            origin: "https://yourapp.com", // exact URL, never "*"
            credentials: true,
        },
    },
});
```

Client side (Axios):

```typescript
import axios from "axios";

const api = axios.create({
    baseURL: "https://api.yourapp.com",
    withCredentials: true,
});
```

---

## 11. Configuration Reference

```typescript
import { XemsTypes } from "xypriss";

const xemsConfig: XemsTypes = {
  /** Enable XEMS middleware (default: false) */
  enable?: boolean;

  /** Default sandbox for auto middleware (default: "xems.internal-session") */
  sandbox?: string;

  /** Session TTL. Format: "15m", "1h", "7d", "3600s" (default: "15m") */
  ttl?: string;

  /** HttpOnly cookie name (default: "xems_token") */
  cookieName?: string;

  /** Fallback response header (default: "x-xypriss-token") */
  headerName?: string;

  /** Rotate the token on every authenticated request (default: true) */
  autoRotation?: boolean;

  /** req property to attach decrypted data to (default: "session") */
  attachTo?: string;

  /**
   * Post-rotation grace period in ms (default: 1000).
   * The old token stays readable for this duration after rotation
   * to prevent failures on simultaneous requests.
   */
  gracePeriod?: number;

  /** Cookie options */
  cookieOptions?: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
  };

  /** Optional persistence to disk */
  persistence?: {
    enabled: boolean;
    /** Path to vault file or directory */
    path?: string;
    /** MANDATORY — exactly 32 UTF-8 bytes */
    secret: string;
    resources?: {
      /** In-memory cache size in MB (default: 64) */
      cacheSize?: number;
    };
  };
};
```

---

## Complete Example

```typescript
import { createServer, xems } from "xypriss";

const app = createServer({
    server: {
        port: 3000,
        xems: {
            enable: true,
            sandbox: "auth",
            ttl: "15m",
            autoRotation: true,
            gracePeriod: 1500,
        },
    },
    security: {
        cors: { origin: "http://localhost:5173", credentials: true },
        helmet: true,
        rateLimit: { windowMs: 60_000, max: 100 },
    },
});

// POST /auth/register
app.post("/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    const user = await db.users.create({
        name,
        email,
        passwordHash: await hash(password),
    });
    await res.xLink({ userId: user.id, email, role: "user" });
    res.status(201).json({ success: true });
});

// POST /auth/login
app.post("/auth/login", async (req, res) => {
    const user = await db.users.authenticate(req.body.email, req.body.password);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    await res.xLink({ userId: user.id, email: user.email, role: user.role });
    res.json({ success: true });
});

// GET /auth/profile  (protected)
app.get("/auth/profile", (req, res) => {
    if (!req.session) return res.status(401).json({ error: "Unauthorized" });
    res.json({
        user: req.session,
        tokenRotated: !!res.getHeader("x-xypriss-token"),
    });
});

// POST /auth/logout
app.post("/auth/logout", async (req, res) => {
    const token =
        req.cookies?.xems_token || (req.headers["x-xypriss-token"] as string);
    if (token) await xems.del("auth", token);
    res.clearCookie("xems_token");
    res.json({ success: true });
});

app.start();
```

---

_Documentation for XyPriss v4.5.x · [Official Docs](https://xypriss.nehonix.com/docs/xems)_

