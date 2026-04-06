# Tutorial: How to Use and Secure XyPriss Plugins

This tutorial will guide you step-by-step through discovering, installing, configuring, and securing third-party or built-in XyPriss plugins.

XyPriss plugins are powerful, but thanks to the **Capability-Based Security Model**, they are also entirely under your control.

---

## Step 1: Finding and Installing a Plugin

The XyPriss ecosystem relies on standard npm packages, but we highly recommend using the XyPriss Fast Package Manager (**XFPM**) for installations, as it guarantees native optimization and secure caching.

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

## Step 2: Registering the Plugin

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

You control permissions via the `pluginPermissions` array in `createServer`.

Let's say our rate limiter needs to intercept requests (`ON_REQUEST`) and read the client's payload data (`ACCESS_SENSITIVE_DATA`), and we also install a monitoring plugin that needs to intercept the console (`CONSOLE_INTERCEPT`).

```typescript
const app = await createServer({
    server: { port: 3000 },

    // Security Configuration
    pluginPermissions: [
        {
            name: "rate-limiter",
            // Allow HTTP interception and request data access
            allowedHooks: [
                "PLG.HTTP.ON_REQUEST",
                "PLG.SECURITY.RATE_LIMIT",
                "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
            ],
            policy: "allow",
        },
        {
            name: "system-monitor",
            // Grant a privileged hook explicitly
            allowedHooks: ["PLG.LOGGING.CONSOLE_INTERCEPT"],
            policy: "allow",
        },
    ],
    plugins: {
        register: [
            // ... plugin initializations ...
        ],
    },
});
```

### What happens if I forget a permission?

If the `system-monitor` attempts to use the `onConsoleIntercept` hook _without_ you adding `PLG.LOGGING.CONSOLE_INTERCEPT` to its `allowedHooks`, **XyPriss blocks it automatically**.

The server will not crash, but you will see a `[XyPriss Security]` warning in your terminal indicating that a plugin attempted an unauthorized action.

---

## Step 4: The Wildcard `*` and "Sticky Denial" (Advanced Security)

In XyPriss, the wildcard `["*"]` only grants access to standard hooks. **It will never grant access to privileged tools** (like `ON_REQUEST`, `ON_RESPONSE`, `CONSOLE_INTERCEPT`, `ACCESS_CONFIGS`, or `ACCESS_SENSITIVE_DATA`). If a plugin needs these, they must be explicitly typed out.

What if you trust a plugin generally and explicitly grant it everything, but you want to absolutely ensure it **never** intercepts your server configurations?

Use `deniedHooks`. Denials always take precedence.

```typescript
pluginPermissions: [
    {
        name: "untrusted-analytics-plugin",
        allowedHooks: [
            "*",
            "PLG.HTTP.ON_REQUEST",
            "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
        ],
        deniedHooks: [
            "PLG.SECURITY.ACCESS_CONFIGS",
            "PLG.LOGGING.CONSOLE_INTERCEPT",
        ],
        policy: "allow",
    },
];
```

Even if the plugin attempts clever workarounds, XyPriss natively enforces this denial at the framework core.

---

## Summary

1. **Install** via `xfpm`.
2. **Register** passing any required options in `createServer({ plugins: { register: [...] } })`.
3. **Secure** it by explicitly allowing or denying hooks in `pluginPermissions`.

You now have a highly-performant, extended server where _you_ hold the keys to its security.

