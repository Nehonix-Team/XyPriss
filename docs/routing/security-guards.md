# Security Guards

Guards are the recommended mechanism for enforcing authorization rules in Router XyPriss. Unlike traditional middleware, guards use a **standardized return-type protocol** and are visible in the route inspection registry.

---

## Guard Signatures

### 1. Direct / Boolean Guard Signature (Inline or `authenticated: true`)

A guard receives `(req, res)` (or `(req, ctx)` where `ctx.res` is accessible) and returns a result:

```typescript
import { XyPrisRequest, XyPrisResponse } from "xypriss";

// Direct Guard (Inline or registered via XyGuard.define)
export const authGuard = async (req: XyPrisRequest, res: XyPrisResponse) => {
    if (!req.session?.userId) {
        return "Unauthorized: Bearer token or session missing";
    }
    // You can invoke response methods directly (e.g. res.xUnlink(), res.setHeader(), etc.)
    return true;
};
```

### 2. Guard with Options (e.g., `roles: ['admin']`, `permissions: ['write']`)

When options are passed, the signature is `(req, options, ctx)`:

```typescript
import { XyPrisRequest, XyGuardContext } from "xypriss";

export const rolesGuard = async (
    req: XyPrisRequest,
    requiredRoles: string[],
    ctx: XyGuardContext
) => {
    const userRole = req.user?.role;
    if (!userRole || !requiredRoles.includes(userRole)) {
        return "Forbidden: Insufficient roles";
    }
    return true;
};
```

### Return Protocol

| Return value | HTTP effect |
| ------------ | ----------- |
| `true` / `void` | Passes — the next guard or handler runs |
| `false` | Blocks — **401 Unauthorized** for `authenticated`, **403 Forbidden** for others |
| `string` | Blocks with **401** (or **403**) using the returned string as the JSON error message (`{ success: false, error: string }`) |

---

## Applying Guards

### Per Route

You can apply guards using the declarative object syntax or an array of inline functions. 

**Declarative Object Syntax (Recommended)**
By registering guards globally via `XyGuard.define()`, you can use a strictly-typed object syntax. The `guards` object provides auto-completion for built-ins while supporting arbitrary custom names seamlessly.

```typescript
// Define a custom guard globally
XyGuard.define("ipWhitelist", (req) => {
    return req.ip === "127.0.0.1" ? true : "Forbidden IP";
});

router.get(
    "/admin/settings",
    {
        guards: {
            authenticated: true,
            roles: ["admin"],
            ipWhitelist: true // Custom declarative guard
        },
    },
    (req, res) => {
        res.success("Welcome, Admin");
    },
);
```

> [!TIP]
> **Enabling TypeScript Auto-Completion for Custom Guards**
> To get native TypeScript auto-completion for your custom declarative guards alongside `authenticated` and `roles`, you can use **Declaration Merging**. 
> Add this to any `.d.ts` or `.ts` file in your project:
> ```typescript
> declare module "xypriss" {
>     interface CustomGuards {
>         ipWhitelist?: boolean;
>     }
> }
> ```

**Array Syntax (Inline)**
```typescript
router.get("/profile", { guards: [authGuard] }, (req, res) => {
    res.success("Protected profile");
});
```

### Per Group

Applied to every route within the group.

```typescript
router.group(
    { prefix: "/admin", guards: [authGuard, adminRoleGuard] },
    (admin) => {
        admin.get("/dashboard", (req, res) => res.success("Admin dashboard"));
    },
);
```

---

## Guard Inheritance

Guards cascade from the outermost scope inward. Every layer must pass independently.

```
Router-level guards → Group-level guards → Route-level guards
```

This means a route inherits the security of every parent scope. There is no way to bypass a group or router guard from within a child route.

---

## Guards vs. Middleware

|                           | Middleware             | Guards                        |
| ------------------------- | ---------------------- | ----------------------------- |
| Declaration               | Imperative (`app.use`) | Declarative (inline on route) |
| Visible in inspection     | No                     | Yes                           |
| Standard failure protocol | No                     | Yes (`true/false/string`)     |
| Execution timing          | During request chain   | Before handler initializes    |

> [!TIP]
> Prefer guards for authentication and authorization checks. Reserve middleware for cross-cutting concerns like logging, body parsing, or CORS.

