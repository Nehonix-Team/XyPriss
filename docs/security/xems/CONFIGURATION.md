# XEMS Configuration Reference

XEMS (XyPriss Entry Management System) is configured directly via the `server.xems` property in `createServer` or your `xypriss.config.ts`.

---

## 1. Unified Configuration (`XemsTypes`)

XEMS operates exclusively as a hardware-bound, encrypted persistent vault (up to 7 days retention). All configuration properties are flattened directly under the `xems` object.

```typescript
import { createServer } from "xypriss";
import path from "path";

const app = createServer({
    server: {
        xems: {
            enable: true,
            path: path.resolve(process.cwd(), "vault.xems"), // Mandatory (.xems)
            secret: process.env.XEMS_SECRET!,               // Mandatory (min 32 bytes)
            ttl: "7d",                                      // Max 7 days retention
            autoRotation: "1m",                             // "1m", "5m", "10s", or false
            gracePeriod: 15000,                             // 15 seconds grace window
            cookieName: "xems_token",
            cookieOptions: {
                httpOnly: true,
                secure: true,
                sameSite: "Strict",
            },
        },
    },
});
```

---

## 2. Configuration Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `enable` | `boolean` | No | `true` | Enables or disables the native XEMS sidecar and session middleware. |
| `path` | `string` | **Yes** | — | Real path to the encrypted vault file (must have `.xems` extension). |
| `secret` | `string` | **Yes** | — | 32-byte (256-bit) master encryption secret. |
| `sandbox` | `string` | No | `"xypriss.internal.session.xems"` | Default namespace partition for isolated session storage. |
| `ttl` | `string` | No | `"7d"` | Default Time-To-Live duration (e.g., `"15m"`, `"1h"`, `"2d"`, `"7d"`). Max 7 days. |
| `autoRotation` | `boolean \| string` | No | `false` | Session rotation strategy (`false`, `"1m"`, `"5m"`, `"10s"`, `"sec"`, `"hour"`). |
| `gracePeriod` | `number` | No | `15000` | Milliseconds (ms) previous token remains valid for concurrent read access. Max `55000`. |
| `cookieName` | `string` | No | `"xems_token"` | Name of the `HttpOnly` cookie transmitted to the client. |
| `headerName` | `string` | No | `"x-xypriss-token"` | Name of the HTTP response/request header for API clients. |
| `attachTo` | `string` | No | `"session"` | Property on `req` where session data is decoded (accessible via `req.session`). |
| `cookieOptions`| `CookieOptions` | No | `{ httpOnly: true, secure: true, sameSite: "Strict" }` | RFC 6265 cookie attributes. |
| `resources` | `{ cacheSize?: number }` | No | `{ cacheSize: 64 }` | RAM buffer allocation in MB for fast in-memory indexing. |

---

## 3. Cryptographic Security Architecture

### A. Dual Hardware + Filesystem Path Binding
The native Go sidecar derives the master encryption key using:
$$\text{MasterKey} = \text{SHA-256}(\text{HWID} \parallel \text{Secret} \parallel \text{AbsoluteVaultPath})$$

> [!IMPORTANT]
> The vault is mathematically locked to **both** the physical machine (CPU/Motherboard UUID) and its **exact absolute file path**. If the `.xems` file is copied to another machine or moved to another directory on the same machine, decryption becomes mathematically impossible.

### B. High-Concurrency Rotation (SPA Protection)
In Single Page Applications (React, Vue, Vite), refreshing a page triggers 5 to 15 concurrent API requests with the same session cookie.

To prevent race conditions and accidental `401 Unauthorized` logouts:
1. Set `autoRotation: "1m"` or `"5m"` (Sliding time-window rotation).
2. XEMS automatically keeps the previous token active during the `gracePeriod` (15s) and links it directly to the `NextToken`.
3. All concurrent requests in flight receive a `200 OK` and are seamlessly resynchronized with the new active token.

---

_Copyright © 2026 Nehonix Team. All rights reserved._


