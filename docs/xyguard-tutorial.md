# XyGuard — Complete Guide

`XyGuard` is the global declarative guard registry of the XyPriss framework. It lets you secure routes and route groups in a centralized way, without imposing any specific underlying implementation (JWT, sessions, RBAC, etc.).

---

## Table of Contents

1. [Architecture and Core Concepts](#1-architecture-and-core-concepts)
2. [XyGuard.define() — Registering a Resolver](#2-xyguarddefine--registering-a-resolver)
3. [Built-in Guards — authenticated, roles, permissions](#3-built-in-guards--authenticated-roles-permissions)
4. [Custom Guards](#4-custom-guards)
5. [Usage on a Route — Declarative Guards](#5-usage-on-a-route--declarative-guards)
6. [Usage as an Inline Function Array](#6-usage-as-an-inline-function-array)
7. [Guards on a Route Group](#7-guards-on-a-route-group)
8. [Resolver Return Value Behavior](#8-resolver-return-value-behavior)
9. [TypeScript Auto-completion via Declaration Merging](#9-typescript-auto-completion-via-declaration-merging)
10. [Advanced Combinations](#10-advanced-combinations)
11. [Migrating from v1](#11-migrating-from-v1)
12. [API Reference](#12-api-reference)

---

## 1. Architecture and Core Concepts

```
XyGuard (static registry)
    └── resolvers: Map<string, GuardResolver>
             |
             v
createGuardMiddleware()        <- helpers.ts
    |
    |-- guards is an array  -> executes each inline function
    |-- guards is an object -> calls XyGuard.get(key) for each active key
             |
             v
addRichRoute() / handleGroup() <- registry.ts / groups.ts
    -> injects the guard middleware BEFORE all other route middlewares
```

**How it works:**

1. At application startup, you register your resolvers via `XyGuard.define(name, resolver)`.
2. On each route (or group), you declare the required guards via the `guards` property.
3. The framework compiles a guard middleware that runs before the route handler.
4. If any guard fails, the request is immediately rejected with the appropriate HTTP status code (401 or 403). The main handler is never called.

---

## 2. XyGuard.define() — Registering a Resolver

`XyGuard.define()` is an overloaded static method. It accepts three forms depending on the guard type.

### Signature for `authenticated`

```typescript
XyGuard.define(
    name: "authenticated",
    resolver: (req: XyPrisRequest) => boolean | string | Promise<boolean | string>
): void
```

### Signature for `roles` and `permissions`

```typescript
XyGuard.define(
    name: "roles" | "permissions",
    resolver: (
        req: XyPrisRequest,
        required: string[]
    ) => boolean | string | Promise<boolean | string>
): void
```

### Signature for a custom guard

```typescript
XyGuard.define(
    name: string,
    resolver: GuardResolver
): void
```

### Where to register guards in your project

The best place to register guards is the server entry point, before any routes are mounted:

```typescript
// src/server/guards.ts  (dedicated file, imported in server.ts)
import { XyGuard } from "xypriss";

XyGuard.define("authenticated", (req) => {
    return !!(req as any).user;
});

XyGuard.define("roles", (req, required) => {
    const user = (req as any).user;
    if (!user) return "Not authenticated";
    return required.includes(user.role);
});

XyGuard.define("permissions", (req, required) => {
    const user = (req as any).user;
    if (!user) return false;
    return required.every((perm) => user.permissions?.includes(perm));
});
```

```typescript
// src/server/server.ts
import "./guards"; // register before routes
import { router } from "./routes";
```

---

## 3. Built-in Guards — authenticated, roles, permissions

XyPriss provides three reserved keys that the framework recognizes natively.

### `authenticated: true`

Indicates that the route requires authentication. The value must be `true` to enable the guard, or `false` / absent to skip it.

```typescript
// The resolver is called with (req) only
XyGuard.define("authenticated", (req) => {
    // Return true  -> access granted
    // Return false -> 401 Unauthorized: Authentication required
    // Return a string -> 401 with that message
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return "Missing token";

    try {
        (req as any).user = verifyToken(token); // attach the user to the request
        return true;
    } catch {
        return "Invalid or expired token";
    }
});
```

### `roles: string[]`

Restricts access to users holding one of the listed roles.

```typescript
// The resolver is called with (req, required) where required = ["admin", "editor"]
XyGuard.define("roles", (req, required) => {
    const user = (req as any).user;
    if (!user) return false; // 403 Forbidden: Insufficient roles

    if (!required.includes(user.role)) {
        return `Role '${user.role}' is insufficient. Required: ${required.join(", ")}`;
    }

    return true;
});
```

### `permissions: string[]`

Restricts access to users holding all of the listed permissions.

```typescript
// The resolver is called with (req, required) where required = ["users:read", "users:write"]
XyGuard.define("permissions", (req, required) => {
    const user = (req as any).user;
    if (!user) return false;

    const missing = required.filter((p) => !user.permissions?.includes(p));
    if (missing.length > 0) {
        return `Missing permissions: ${missing.join(", ")}`;
    }

    return true;
});
```

---

## 4. Custom Guards

In addition to the three built-in guards, you can define any business guard using an arbitrary name.

### Example: IP whitelist

```typescript
// Registration
XyGuard.define("ipWhitelist", (req) => {
    const allowedIps = ["127.0.0.1", "::1", "192.168.1.100"];
    return allowedIps.includes(req.ip ?? "")
        ? true
        : `IP ${req.ip} is not allowed`;
});

// Usage
router.get(
    "/internal/metrics",
    {
        guards: { ipWhitelist: true },
    },
    handler,
);
```

### Example: subscription plan check

```typescript
// Registration — the value declared in guards is passed as the second argument
XyGuard.define("plan", (req, requiredPlan) => {
    const user = (req as any).user;
    if (!user) return false;

    const hierarchy = ["free", "starter", "premium", "enterprise"];
    const userLevel = hierarchy.indexOf(user.plan);
    const requiredLevel = hierarchy.indexOf(requiredPlan);

    if (userLevel < requiredLevel) {
        return `Plan '${user.plan}' is insufficient. Plan '${requiredPlan}' is required.`;
    }
    return true;
});

// Usage — "premium" is passed as the second argument to the resolver
router.get(
    "/api/reports/advanced",
    {
        guards: {
            authenticated: true,
            plan: "premium",
        },
    },
    handler,
);
```

### Example: API key

```typescript
XyGuard.define("apiKey", async (req) => {
    const key = req.headers["x-api-key"] as string;
    if (!key) return "Missing API key";

    const valid = await db.apiKeys.findOne({ key, active: true });
    if (!valid) return "Invalid or revoked API key";

    (req as any).apiClient = valid.client;
    return true;
});

router.get(
    "/webhooks/data",
    {
        guards: { apiKey: true },
    },
    handler,
);
```

### Behavior when a resolver is not registered

If a key declared in `guards` has no corresponding resolver in `XyGuard`, it is **silently ignored**. This prevents crashes but can lead to security gaps if a guard name is misspelled. Always verify your registrations at startup.

---

## 5. Usage on a Route — Declarative Guards

The `guards` property is part of `RichRouteOptions`, passed as the second argument (before the handler) on any HTTP method of the router.

### Object declarative form

```typescript
import { router } from "./router";

// Simple route — authentication only
router.get(
    "/profile",
    {
        guards: { authenticated: true },
    },
    async (req, res) => {
        const user = (req as any).user;
        res.json({ user });
    },
);

// Route with roles
router.post(
    "/admin/users",
    {
        guards: {
            authenticated: true,
            roles: ["admin", "super-admin"],
        },
    },
    async (req, res) => {
        // Only admins reach this point
        res.status(201).json({ message: "User created" });
    },
);

// Route with granular permissions
router.delete(
    "/posts/:id",
    {
        guards: {
            authenticated: true,
            permissions: ["posts:delete"],
        },
    },
    async (req, res) => {
        res.json({ deleted: true });
    },
);

// Combining multiple guards
router.put(
    "/admin/settings",
    {
        guards: {
            authenticated: true,
            roles: ["admin"],
            permissions: ["settings:write"],
            ipWhitelist: true, // custom guard
        },
    },
    handler,
);
```

### Evaluation order

Declarative guards (object form) are evaluated in the iteration order of `Object.entries()`. The first guard that fails immediately short-circuits the chain and sends the error response. Subsequent guards are not evaluated.

---

## 6. Usage as an Inline Function Array

When a guard does not need to be reused, you can pass a direct array of `RouteGuard` functions.

```typescript
import { XyPrisRequest, XyPrisResponse } from "xypriss";

const isOwner = async (req: XyPrisRequest, res: XyPrisResponse) => {
    const user = (req as any).user;
    const resourceId = req.params.id;

    if (!user) return "Not authenticated";

    const resource = await db.resources.findById(resourceId);
    if (!resource) return false;

    return resource.ownerId === user.id
        ? true
        : "Access denied: you are not the owner";
};

router.put(
    "/resources/:id",
    {
        guards: [isOwner],
    },
    async (req, res) => {
        res.json({ updated: true });
    },
);
```

### Combining multiple inline functions

```typescript
const requireHttps = (req: XyPrisRequest) => {
    return req.protocol === "https" ? true : "HTTPS is required";
};

const requireUserAgent = (req: XyPrisRequest) => {
    return req.headers["user-agent"] ? true : false;
};

router.post(
    "/sensitive/action",
    {
        guards: [requireHttps, requireUserAgent, isOwner],
    },
    handler,
);
```

> **Important:** The array form (`guards: [fn1, fn2]`) and the object form (`guards: { authenticated: true }`) are mutually exclusive. You cannot combine them directly. If you need to mix an inline function with named guards, register the inline function via `XyGuard.define()`.

---

## 7. Guards on a Route Group

`router.group()` also accepts the `guards` property. The guard is injected before every route in the group.

```typescript
router.group(
    {
        prefix: "/admin",
        guards: {
            authenticated: true,
            roles: ["admin"],
        },
    },
    (adminRouter) => {
        adminRouter.get("/dashboard", dashboardHandler);
        adminRouter.get("/users", listUsersHandler);
        adminRouter.post("/users", createUserHandler);
        adminRouter.delete("/users/:id", deleteUserHandler);
    },
);
```

### Overriding guards at the route level

An individual route within the group can define its own additional guards. Both sets of guards are applied: group guards run first (injected higher in the middleware chain), then route-level guards.

```typescript
router.group(
    {
        prefix: "/admin",
        guards: { authenticated: true, roles: ["admin"] },
    },
    (adminRouter) => {
        // This route additionally requires the "reports:export" permission
        adminRouter.get(
            "/reports/export",
            {
                guards: { permissions: ["reports:export"] },
            },
            exportHandler,
        );
    },
);
```

### Guards on a versioned group

```typescript
router.group(
    {
        prefix: "/api",
        version: "2", // prefixes /api/v2
        guards: { apiKey: true },
    },
    (v2Router) => {
        v2Router.get("/data", dataHandler);
    },
);
// -> GET /api/v2/data with apiKey guard active
```

---

## 8. Resolver Return Value Behavior

The table below summarizes how each return value is interpreted by `createGuardMiddleware`.

| Returned value   | Guard type                     | HTTP status                 | Response body                                                           |
| ---------------- | ------------------------------ | --------------------------- | ----------------------------------------------------------------------- |
| `true`           | All                            | None — access granted       | —                                                                       |
| `false`          | Inline array                   | `403 Forbidden`             | `{ success: false, error: "Forbidden: Guard rejection" }`               |
| `false`          | `authenticated`                | `401 Unauthorized`          | `{ success: false, error: "Unauthorized: Authentication required" }`    |
| `false`          | `roles`                        | `403 Forbidden`             | `{ success: false, error: "Forbidden: Insufficient roles" }`            |
| `false`          | `permissions`                  | `403 Forbidden`             | `{ success: false, error: "Forbidden: Insufficient permissions" }`      |
| `false`          | Custom named                   | `403 Forbidden`             | `{ success: false, error: "Forbidden: Access denied" }`                 |
| `"message"`      | Inline array                   | `401 Unauthorized`          | `{ success: false, error: "message" }`                                  |
| `"message"`      | `roles` / `permissions`        | `403 Forbidden`             | `{ success: false, error: "message" }`                                  |
| `"message"`      | Others (custom, authenticated) | `401 Unauthorized`          | `{ success: false, error: "message" }`                                  |
| Thrown exception | All                            | `500 Internal Server Error` | `{ success: false, error: "Internal Server Error during guard check" }` |

**Recommendation:** For precise, user-facing error messages, prefer returning a string over `false`.

---

## 9. TypeScript Auto-completion via Declaration Merging

XyPriss exposes the `CustomGuards` interface that you can augment in your project to get auto-completion for your custom guards.

```typescript
// src/types/xypriss.d.ts  (or any .d.ts file included in tsconfig)
declare module "xypriss" {
    interface CustomGuards {
        ipWhitelist?: boolean;
        plan?: "free" | "starter" | "premium" | "enterprise";
        apiKey?: boolean;
    }
}
```

Once declared, TypeScript validates keys and values at usage sites:

```typescript
router.get(
    "/premium-feature",
    {
        guards: {
            authenticated: true,
            plan: "premium", // auto-completed and typed
            // plan: "invalid"  // TypeScript error
        },
    },
    handler,
);
```

---

## 10. Advanced Combinations

### Async guard with database access

```typescript
XyGuard.define("subscriptionActive", async (req) => {
    const user = (req as any).user;
    if (!user) return false;

    const subscription = await db.subscriptions.findOne({
        userId: user.id,
        status: "active",
        expiresAt: { $gt: new Date() },
    });

    if (!subscription) return "Subscription expired or not found";

    // Inject the subscription into the request for the handler
    (req as any).subscription = subscription;
    return true;
});
```

### Per-user daily quota guard (complement to rateLimit)

```typescript
XyGuard.define("dailyExportLimit", async (req) => {
    const user = (req as any).user;
    const today = new Date().toISOString().slice(0, 10);
    const key = `export:${user.id}:${today}`;

    const count = await cache.incr(key);
    if (count === 1) await cache.expire(key, 86400); // 24h TTL

    const MAX = user.plan === "premium" ? 100 : 10;
    if (count > MAX) {
        return `Daily limit reached (${MAX} exports/day)`;
    }

    return true;
});

router.post(
    "/reports/export",
    {
        guards: {
            authenticated: true,
            subscriptionActive: true,
            dailyExportLimit: true,
        },
    },
    exportHandler,
);
```

### Conditional guard (feature flag)

```typescript
XyGuard.define("betaFeature", (req) => {
    const user = (req as any).user;
    if (user?.betaTester) return true;
    return "This feature is only available to beta testers";
});

router.get(
    "/new-dashboard",
    {
        guards: { authenticated: true, betaFeature: true },
        active: { env: ["development", "staging"] }, // also conditioned by environment
    },
    handler,
);
```

### Request body validation in a guard

Guards run before the handler, making them well-suited for early validation.

```typescript
XyGuard.define("requireJsonBody", (req) => {
    const ct = req.headers["content-type"] ?? "";
    if (!ct.includes("application/json")) {
        return "Content-Type: application/json is required";
    }
    if (!req.body || typeof req.body !== "object") {
        return "Invalid or empty JSON body";
    }
    return true;
});

router.post(
    "/api/webhook",
    {
        guards: { requireJsonBody: true },
    },
    webhookHandler,
);
```

---

## 11. Migrating from v1

The `custom` property inside the `guards` object was removed in v2.

```typescript
// Before (v1) — NO LONGER WORKS
router.get(
    "/route",
    {
        guards: {
            authenticated: true,
            custom: [myInlineGuard],
        },
    },
    handler,
);

// After (v2) — Option 1: direct array (inline functions only)
router.get(
    "/route",
    {
        guards: [myInlineGuard],
    },
    handler,
);

// After (v2) — Option 2: registration + declarative object (recommended)
XyGuard.define("myGuard", myInlineGuard);
router.get(
    "/route",
    {
        guards: {
            authenticated: true,
            myGuard: true,
        },
    },
    handler,
);
```

> **Note:** The `custom` key is typed as `never` in `BuiltInGuards`, triggering an immediate TypeScript error if still used. It is also silently ignored at runtime.

---

## 12. API Reference

### `XyGuard`

```typescript
class XyGuard {
    // Registers a resolver for a named guard
    static define(name: "authenticated", resolver: (req) => boolean | string | Promise<...>): void;
    static define(name: "roles" | "permissions", resolver: (req, required: string[]) => ...): void;
    static define(name: string, resolver: GuardResolver): void;

    // Retrieves a resolver by name (internal use)
    static get(name: string): GuardResolver | undefined;
}
```

### `GuardResolver`

```typescript
type GuardResolver = (
    req: XyPrisRequest,
    options?: any, // value declared in guards: { key: options }
) => boolean | string | Promise<boolean | string>;
```

### `BuiltInGuards`

```typescript
type BuiltInGuards = {
    authenticated?: boolean;
    roles?: string[];
    permissions?: string[];
    custom?: never; // removed in v2, TypeScript error if used
} & CustomGuards &
    Record<string, any>;
```

### `RouteGuard` (inline form)

```typescript
type RouteGuard = (
    req: XyPrisRequest,
    res: XyPrisResponse,
) => boolean | string | Promise<boolean | string>;
```

### `guards` in `RichRouteOptions`

```typescript
interface RichRouteOptions {
    guards?: BuiltInGuards | RouteGuard[];
    // ... other options: lifecycle, rateLimit, cache, meta, priority, active
}
```

### `guards` in `RouteGroupOptions`

```typescript
interface RouteGroupOptions {
    prefix?: string;
    guards?: BuiltInGuards | RouteGuard[];
    // ...
}
```

