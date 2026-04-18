# Tutorial: How to Use and Secure XyPriss Plugins

This tutorial will guide you step-by-step through discovering, installing, configuring, and securing third-party or built-in XyPriss plugins.

XyPriss plugins are powerful, but thanks to the **Capability-Based Security Model**, they are also entirely under your control.

---

## Step 1: Finding and Installing a Plugin

The XyPriss ecosystem relies on standard npm packages, but we highly recommend using the XyPriss Fast Package Manager (XFPM) for installations, as it guarantees native optimization and secure caching.

Suppose we want to add a rate-limiting plugin. Ecosystem plugins usually follow the `xypriss-plugin-*` naming convention.

**Using XFPM (Recommended)**:

```bash
xfpm install xypriss-plugin-rate-limiter
```

**Using npm**:

```bash
npm install xypriss-plugin-rate-limiter
```

---

## Step 2: Author Verification (Trust On First Use)

When installing a plugin for the first time via XFPM, the engine will detect the author's cryptographic signature. If the author is not yet in your trusted list, XFPM will activate the **Interactive Trust Flow**.

### The TOFU Prompt
You will see a prompt similar to this:
```text
[SECURITY] New plugin detected: xypriss-plugin-rate-limiter
[SECURITY] Author: Peter <peter@example.com>
[SECURITY] Public Key: ed25519:b2bd9a...cfd

Note: Verify this fingerprint in the plugin's official README:
  https://npmjs.com/package/xypriss-plugin-rate-limiter

Do you trust this author? (y/N): 
```

### Action Required
1.  **Cross-Check**: Open the plugin's README on npm/GitHub.
2.  **Verify**: Ensure the `Public Key` displayed matches the one published by the author.
3.  **Confirm**: Type `y` to pin the author. XFPM will write the key to your `xypriss.config.jsonc`.

---

## Step 3: Mandatory Authorization (Security Contract)

XyPriss uses a **Zero-Trust** security architecture. Simply installing a plugin is not enough; you must explicitly authorize it in your project's `xypriss.config.jsonc` file under the `$internal` block.

This step allows you to:
1.  **Authorize** the plugin to run.
2.  **Sandbox** the plugin by assigning it a specific filesystem workspace.

Add the following to your `xypriss.config.jsonc`:

```jsonc
{
    "$internal": {
        "xypriss-plugin-rate-limiter": {
            // Grants an isolated filesystem context (Sandbox)
            "__xfs__": {
                "path": "ROOT://.private/plugin-data/rate-limiter"
            }
        }
    }
}
```

---

## Step 4: Registering and Providing Permissions

In your main server code (e.g., `src/index.ts`), import and register the plugin. 

### Implementation
```typescript
import { createServer } from "xypriss";
import { rateLimiter } from "xypriss-plugin-rate-limiter";

const app = await createServer({
    server: { port: 3000 },
    plugins: {
        register: [rateLimiter({ maxRequests: 100 })]
    }
});

app.start();
```

### Granting Component Permissions
Most plugins need access to specific server hooks. You must grant these explicitly in your config:

```jsonc
{
    "$internal": {
        "xypriss-plugin-rate-limiter": {
            "permissions": {
                "allowedHooks": [
                    "PLG.HTTP.ON_REQUEST",
                    "PLG.SECURITY.ACCESS_SENSITIVE_DATA"
                ],
                "policy": "allow"
            }
        }
    }
}
```

---

## Step 5: XHSC Deep Audit (Startup Integrity)

XyPriss performs a mandatory **Deep Audit** every time the engine starts. The XHSC core engine:

1.  Identifies all registered plugins.
2.  Matches their signatures against your pinned `trusted_plugins` list.
3.  Re-verifies local file integrity to detect post-installation tampering.
4.  **Checks for Revocations**: Aborts startup if an author has revoked the version you are using due to security concerns.

## Summary

1.  **Install & Trust**: Use XFPM and verify the author's Public Key.
2.  **Authorize**: Configure the `$internal` block and sandbox workspace.
3.  **Register**: Add the plugin to your `createServer` call.
4.  **Audit**: Monitor the terminal for Green/Fatal security markers during startup.

You now have a production-grade, cryptographically secured server.
