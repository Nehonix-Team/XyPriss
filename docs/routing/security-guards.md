# Security Guards

Guards are the recommended mechanism for enforcing authorization rules in XyPriss Router V2. Unlike traditional middleware, guards use a **standardized return-type protocol** and are visible in the route inspection registry.

---

## Guard Signature

A guard is a function that receives `(req, res)` and returns:

| Return value | HTTP effect                                                           |
| ------------ | --------------------------------------------------------------------- |
| `true`       | Passes — the next guard or handler runs                               |
| `false`      | Blocks — **403 Forbidden**                                            |
| `string`     | Blocks — **401 Unauthorized** with the string as the response message |

```typescript
const authGuard = (req: any, _res: any): true | string => {
    if (req.headers.authorization?.startsWith("Bearer ")) return true;
    return "Unauthorized: Bearer token missing";
};
```

---

## Applying Guards

### Per Route

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

