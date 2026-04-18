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

During installation, XFPM will automatically verify the plugin's cryptographic signature. If the plugin's author is not yet trusted, you will be prompted to verify and authorize the Developer ID via an interactive trust flow.

**Using npm**:

```bash
npm install xypriss-plugin-rate-limiter
```

---

## Step 2: Mandatory Authorization (The Security Contract)

XyPriss uses a **Zero-Trust** security architecture. Simply installing and registering a plugin in your TypeScript code is not enough. You must explicitly authorize it in your project's `xypriss.config.jsonc` (or `.json`) file under the `$internal` block.

This Step is mandatory for all non-core plugins. It allows you to:

1.  **Authorize** the plugin to run.
2.  **Sandbox** the plugin by assigning it a specific filesystem workspace.
3.  **Define** initialization metadata paths.

Open your `xypriss.config.jsonc` at the root and add your plugin:

```jsonc
{
    "$internal": {
        "xypriss-plugin-rate-limiter": {
            // Grants an isolated filesystem context (Sandbox)
            "__xfs__": {
                "path": "ROOT://.private/plugin-data/rate-limiter",
            },
            // (Optional) Authorizes a metadata execution path
            "__meta__": {
                "path": "ROOT://.configs/rate-limiter",
            },
        },
    },
}
```

> [!IMPORTANT]
> **Workspace Sandboxing**: By providing `__xfs__`, you Trap the plugin inside that directory. It cannot see or touch files outside its assigned path. For more details on how this works, see the [Workspace System Guide](../core/WORKSPACE_SYSTEM.md).

---

## Step 3: Registering the Plugin

Open your main server configuration file (e.g., `src/index.ts` or wherever `createServer` is called).

You import the plugin and add it to the `plugins.register` array. Most professional plugins provide a factory or setup function.

```typescript
import { createServer } from "xypriss";
import { rateLimiter } from "xypriss-plugin-rate-limiter";

const app = await createServer({
    server: { port: 3000 },
    plugins: {
        register: [rateLimiter({ maxRequests: 100, windowMs: 60000 })],
    },
});

app.start();
```

---

## Step 3: Managing Permissions (The "Why" and "How")

### Why do we need permissions?

When you add a plugin, you are injecting external code into your server's lifecycle. In typical Node.js frameworks (like Express), middleware runs with full privileges and can alter anything—potentially exposing database credentials or hijacking requests silently.

In XyPriss, **Plugins are sandboxed by default in a Zero-Trust environment**. They cannot access your sensitive `configs` or mutate the `app`. More importantly, they **cannot read sensitive request data (like body, cookies, query, or headers)** unless you explicitly grant them `ACCESS_SENSITIVE_DATA`. In addition, intercepting requests or responses (`ON_REQUEST`, `ON_RESPONSE`) requires explicit whitelisting.

### How to Grant Permissions

You control permissions via the `xypriss.config.jsonc` file inside the `$internal` block.

Let's say our rate limiter needs to intercept requests (`ON_REQUEST`) and read the client's payload data (`ACCESS_SENSITIVE_DATA`), and we also install a monitoring plugin that needs to intercept the console (`CONSOLE_INTERCEPT`).

Open your `xypriss.config.jsonc`:

```jsonc
{
    "$internal": {
        "rate-limiter": {
            "permissions": {
                "allowedHooks": [
                    "PLG.HTTP.ON_REQUEST",
                    "PLG.SECURITY.RATE_LIMIT",
                    "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
                ],
                "policy": "allow",
            },
        },
        "system-monitor": {
            "permissions": {
                "allowedHooks": ["PLG.LOGGING.CONSOLE_INTERCEPT"],
                "policy": "allow",
            },
        },
    },
}
```

### What happens if I forget a permission?

If the `system-monitor` attempts to use the `onConsoleIntercept` hook _without_ you adding `PLG.LOGGING.CONSOLE_INTERCEPT` to its `allowedHooks`, **XyPriss blocks it automatically**.

The server will not crash, but you will see a `[XyPriss Security]` warning in your terminal indicating that a plugin attempted an unauthorized action.

---

## Step 4: The Wildcard `*` and "Sticky Denial" (Advanced Security)

In XyPriss, the wildcard `["*"]` only grants access to standard hooks. **It will never grant access to privileged tools** (like `ON_REQUEST`, `ON_RESPONSE`, `CONSOLE_INTERCEPT`, `ACCESS_CONFIGS`, or `ACCESS_SENSITIVE_DATA`). If a plugin needs these, they must be explicitly typed out.

What if you trust a plugin generally and explicitly grant it everything, but you want to absolutely ensure it **never** intercepts your server configurations?

Use `deniedHooks` in the configuration. Denials always take precedence.

```jsonc
{
    "$internal": {
        "untrusted-analytics-plugin": {
            "permissions": {
                "allowedHooks": [
                    "*",
                    "PLG.HTTP.ON_REQUEST",
                    "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
                ],
                "deniedHooks": [
                    "PLG.SECURITY.ACCESS_CONFIGS",
                    "PLG.LOGGING.CONSOLE_INTERCEPT",
                ],
                "policy": "allow",
            },
        },
    },
}
```

Even if the plugin attempts clever workarounds, XyPriss natively enforces this denial at the framework core.

---

## Step 5: XHSC Deep Audit (Startup Integrity)

In addition to installation-time verification, XyPriss performs a mandatory **Deep Audit** every time the engine starts.

The XHSC core engine:

1. Identifies all registered plugins.
2. Verifies their local filesystem integrity.
3. Matches their signatures against your project's pinned `trusted_plugins` list.
4. Aborts engine startup if a signature mismatch or unauthorized developer is detected.

This continuous verification ensures that your production environment remains resistant to local tampering or malicious file modifications.

## Summary

1. **Install and Verify** via XFPM (Interactive Trust Flow).
2. **Authorize and Secure** by configuring hooks in `xypriss.config.jsonc` under `$internal`.
3. **Register** in `createServer({ plugins: { register: [...] } })`.
4. **Monitor Deep Audit** logs during engine initialization.

You now have a highly-performant, extended server where you hold the keys to its security.

