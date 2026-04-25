# Tutorial: How to Use and Secure XyPriss Plugins

This tutorial will guide you step-by-step through discovering, installing, configuring, and securing third-party or built-in XyPriss plugins.

XyPriss plugins are powerful, but thanks to the **Capability-Based Security Model**, they are also entirely under your control.

---

## Step 1: Finding and Installing a Plugin

The XyPriss ecosystem mandates the use of the XyPriss Fast Package Manager (XFPM). It is the only package manager that guarantees native optimization, Zero-Trust signature verification, and secure caching.

Suppose we want to add a rate-limiting plugin. Ecosystem plugins follow the `xypriss-plugin-*` naming convention.

```bash
xfpm install xypriss-plugin-rate-limiter
```

---

## Step 2: Author Verification (Trust On First Use)

When installing a plugin for the first time via XFPM, the engine will detect the author's cryptographic signature. If the author is not yet in your trusted list, XFPM will activate the **Interactive Trust Flow**.

### The TOFU Prompt

You will see a prompt similar to this:

```text
[SECURITY] New plugin author detected: xypriss-plugin-rate-limiter
[SECURITY] Declared Author ID: ed25519:b2bd9a...cfd

⚠ ACTION REQUIRED:
To trust this author, you must manually verify their Developer ID.
Check the official project source (GitHub/Homepage) for the author's key.

Paste the Developer ID here to confirm trust, or press Enter to cancel:
```

### Action Required

1.  **Cross-Check**: Open the plugin's project homepage or GitHub repository.
2.  **Verify**: Locate the `Developer ID` (Public Key) published by the author.
3.  **Confirm**: Copy and paste the key directly into the XFPM prompt. XFPM will verify it against the plugin signature and pin it to the `$internal` block in your `xypriss.config.jsonc`.

---

## Step 3: Security & Permissions (Unified Configuration)

XyPriss uses a **Zero-Trust** security architecture. You must explicitly authorize plugins and their metadata in the `$internal` block of your `xypriss.config.jsonc`.

```jsonc
{
    "$internal": {
        "xypriss-plugin-rate-limiter": {
            // Cryptographic Trust (Pinned by XFPM)
            "signature": {
                "author_key": "ed25519:AuthorKeyFingerprint",
            },
            // Isolated filesystem context (Sandbox)
            "__xfs__": {
                "path": "ROOT://.private/plugin-data/rate-limiter",
            },
            // Explicit Permission Whitelist
            "permissions": {
                "allowedHooks": [
                    "XHS.HOOK.HTTP.REQUEST",
                    "XHS.PERM.SECURITY.SENSITIVE_DATA",
                ],
                "policy": "allow",
            },
        },
    },
}
```

---

## Step 4: Registering the Plugin

In your main server code (e.g., `src/index.ts`), import and register the plugin:

```typescript
import { createServer } from "xypriss";
import { rateLimiter } from "xypriss-plugin-rate-limiter";

const app = await createServer({
    server: { port: 3000 },
    plugins: {
        register: [rateLimiter({ maxRequests: 100 })],
    },
});

app.start();
```

---

## Step 5: XHSC Deep Audit (Startup Integrity)

XyPriss performs a mandatory **Deep Audit** every time the engine starts. The XHSC core engine:

1.  Identifies all registered plugins.
2.  Matches their signatures against the pinned `author_key` in the plugin's `$internal` entry.
3.  Re-verifies local file integrity to detect post-installation tampering.
4.  **Checks for Revocations**: Aborts startup if an author has revoked the version you are using.

## Summary

1.  **Install & Trust**: Use XFPM and verify the author's Public Key.
2.  **Authorize**: Configure the `$internal` block with the pinned signature and workspace.
3.  **Register**: Add the plugin to your `createServer` call.
4.  **Audit**: Monitor the terminal for Green/Fatal security markers during startup.

You now have a production-grade, cryptographically secured server.

