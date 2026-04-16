# Honeypot Tarpit Architecture

The **Honeypot Tarpit** is a built-in security layer designed to instantly neutralize connections from malicious botnets, reconnaissance scanners, and automated exploit frameworks. This module operates at the earliest phase of the request handling lifecycle, dropping malicious probes with an instant `HTTP 403 Forbidden` response before expensive operations like routing, session management, and Regex matching occur.

## Enable / Disable via ServerOptions

By default, the Honeypot Tarpit is **enabled**. Under the hood, this saves significant CPU and event-loop cycles normally wasted on illegitimate traffic.

If you absolutely need to disable it (e.g., if you are running a standalone honeypot application with XyPriss and want to capture these requests in the application layer), you can configure this explicitly in `ServerOptions`:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        // ...other security configs
        honeypotTarpit: false, // Setting to false disables the tarpit bypass
    },
});
```

## How It Works

The Tarpit applies a zero-false-positive strategy structured in a 6-stage pipeline:

1. **Input Sanitization**: Rejects malformed or oversized paths, stopping buffer-probing payloads.
2. **URI Normalization**: Translates percent-encoding, removes duplicate slashes, and resolves path traversal combinations (`../`) dynamically, effectively defeating evasion vectors.
3. **Exact Trap Match**: A hardcoded deterministic list (O(1) logic via `Set`) intercepts probes bound for common sensitive targets (e.g. `/.env`, `/.git`, `/.aws/credentials`).
4. **Directory Prefix Match**: Ensures all resources extending from a trapped base path are blocked (e.g. `/.ssh/known_hosts`).
5. **Extension Watcher**: Sniffs for file extensions strongly linked exclusively to security probing scenarios (e.g. `.tfstate`, `.pem`, `.DS_Store`). General extensions like `.php` or `.config` are skipped intentionally to reduce the possibility of false positives.
6. **Isolated Path Segment Checks**: Looks for specific folder or endpoint markers (e.g. `wp-admin`, `phpmyadmin`, `heapdump`).

Any matching condition triggers a fast-path drop (`res.writeHead(403)` and `res.end()`). No HTTP Body payload and no framework-level HTTP headers will append to this response.

## Why 403 over Socket Destroy?

Historically, security modules often relied on tearing down the underlying TCP connection (via `socket.destroy()`) to prevent resource exhaustion. While effective in bare-metal architectures, XyPriss operates frequently behind reverse proxies (like Nginx) or through the high-performance XHSC bridge.

Tearing down a shared Keep-Alive socket indiscriminately can penalize other incoming legitimate requests multiplexed over the same pool connection. Responding immediately with a lightweight `403 Forbidden` avoids collateral connection damage while satisfying the goal of instant neutralization.

