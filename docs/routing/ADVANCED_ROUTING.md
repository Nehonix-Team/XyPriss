# Advanced Routing and Security Guards

XyPriss provides a high-performance, modular routing system that supports declarative guards, typed parameters, and advanced lifecycle hooks. This document details the architectural modularization of the HTTP server and the full implementation of the XyGuard API for custom security logic.

---

## HTTP Server Modularity

To ensure maximum maintainability and performance, the XyPriss HTTP server core has been modularized into specialized components. This separation of concerns allows the framework to handle high-concurrency traffic with minimal overhead.

### Core Components

| Component            | Responsibility                                                                 |
| -------------------- | ------------------------------------------------------------------------------ |
| **RouteManager**     | High-speed route registration, parameter extraction, and radix-based matching  |
| **BodyParser**       | High-efficiency parsing of JSON and URL-encoded request bodies                 |
| **RequestForwarder** | Server-side request forwarding (`req.forward`) for internal service communication |
| **HttpErrorHandler** | Centralized 404 and 500 error handling with consistent response format         |

These components are composed internally by the framework. You interact with them through the public `Router` and `createServer` APIs.

---

## XyGuard API

The XyGuard API is a non-opinionated security layer that allows developers to define custom logic for built-in declarative guards. This architectural choice keeps the framework flexible while providing a clean, auditable syntax for route protection.

### Built-in Guard Types

XyPriss supports three primary guard types that can be declared directly in route or group options:

| Guard             | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `authenticated`   | Verifies an active session or valid credentials                |
| `roles`           | Restricts access based on user roles (e.g. `["admin"]`)        |
| `permissions`     | Enforces fine-grained capability checks                        |

### Registering Guard Resolvers

Because XyPriss does not assume your authentication algorithm, you define **Guard Resolvers** globally during application initialization. A resolver returns:

- `true` — request is allowed
- `false` — request is rejected with **403 Forbidden**
- `string` — request is rejected with **401 Unauthorized** and the string as the error message

```typescript
import { XyGuard } from "xypriss";

XyGuard.define("authenticated", (req) => {
    if (req.session?.get("user_id")) return true;
    return "Unauthorized: no active session";
});

XyGuard.define("roles", (req, requiredRoles) => {
    const userRole = req.locals.user?.role;
    return requiredRoles.includes(userRole);
});

XyGuard.define("permissions", (req, requiredPermissions) => {
    const userPermissions = req.locals.user?.permissions ?? [];
    return requiredPermissions.every((p) => userPermissions.includes(p));
});
```

> **Best practice:** Register all resolvers in a dedicated file (e.g. `src/guards.ts`) and import it at the top of `main.ts` before any route is declared.

### Type Safety

The `XyGuard.define` method is fully typed and only accepts supported guard names:

```typescript
type BuiltInGuardName = "authenticated" | "roles" | "permissions";
```

Passing an unknown name results in a TypeScript compile-time error.

### Asynchronous Resolvers

Resolvers support `async`/`await`, allowing database lookups or external API calls:

```typescript
XyGuard.define("authenticated", async (req) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return "Unauthorized: token missing";

    const payload = await verifyJwt(token);
    if (!payload) return "Unauthorized: invalid token";

    req.locals.user = payload;
    return true;
});
```

---

## Applying Guards to Routes

Once resolvers are registered, apply guards declaratively in route or group options:

```typescript
app.get(
    "/admin/settings",
    {
        guards: {
            authenticated: true,
            roles: ["admin"],
        },
    },
    (req, res) => {
        res.success("Welcome to the admin panel");
    },
);
```

### Guard Execution Flow

```
1. Built-in resolvers (authenticated → roles → permissions)
   └─ Any resolver fails → 401 or 403, handler is never called
2. Custom guard functions (if any)
   └─ Any guard fails → 403
3. Route handler executes
```

---

## Guard Inheritance

Guards cascade through the routing hierarchy. A guard defined at the router level automatically applies to every route under it:

```typescript
const adminRouter = Router();

// All routes on adminRouter require authentication
adminRouter.use({ guards: { authenticated: true } });

adminRouter.get("/dashboard", handler);   // protected
adminRouter.delete("/users/:id", handler); // protected
```

Groups narrow the scope further:

```typescript
const api = Router();

api.group("/v1/admin", { guards: { roles: ["admin"] } }, (group) => {
    group.get("/stats", statsHandler);     // requires admin role
    group.delete("/users/:id", deleteHandler); // requires admin role
});
```

Child routes cannot bypass parent guards.

---

## Custom Guard Functions

In addition to built-in resolvers, you can pass arbitrary guard functions directly to a route. These run **after** built-in resolvers:

```typescript
const ipWhitelist = (req: Request, res: Response): boolean => {
    const allowed = ["192.168.1.0/24"];
    return isIpInRange(req.ip, allowed);
};

router.get(
    "/internal/metrics",
    { guards: [ipWhitelist] },
    (req, res) => {
        res.json(getMetrics());
    },
);
```

---

## Lifecycle Hooks

Router V2 exposes three lifecycle hooks per route for precise request interception:

| Hook          | When it runs                          | Use cases                              |
| ------------- | ------------------------------------- | -------------------------------------- |
| `beforeEnter` | After guards pass, before the handler | Logging, enriching `req.locals`        |
| `afterLeave`  | After the handler sends a response    | Audit logging, cleanup                 |
| `onError`     | When the handler throws               | Route-level error formatting           |

```typescript
router.get(
    "/api/orders",
    {
        guards: { authenticated: true },
        beforeEnter: async (req) => {
            req.locals.startTime = Date.now();
        },
        afterLeave: async (req, res) => {
            const duration = Date.now() - req.locals.startTime;
            logger.info(`GET /api/orders completed in ${duration}ms`);
        },
        onError: (err, req, res) => {
            res.status(500).json({ error: err.message });
        },
    },
    ordersHandler,
);
```

---

## Request Forwarding

The `RequestForwarder` component allows a route handler to internally forward a request to another route or service without a network round-trip:

```typescript
router.get("/legacy/user/:id", async (req, res) => {
    await req.forward(`/api/v2/users/${req.params.id}`);
});
```

This is useful for gradual API migrations or internal service composition.

---

## Best Practices

- **Define resolvers globally** — register `XyGuard` resolvers once at startup, not inside route handlers.
- **Return strings for client messages** — a string return gives the client a descriptive rejection reason; `false` returns a generic 403.
- **Use `beforeEnter` for enrichment** — populate `req.locals` with user data so handlers stay clean and focused on business logic.
- **Keep guards pure** — avoid side effects inside guard resolvers; side effects belong in `beforeEnter` hooks.
- **Layer guards from broad to narrow** — apply authentication at the router level, role/permission checks at the group or route level.
