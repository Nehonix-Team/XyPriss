# Groups and API Versioning

Route groups allow you to apply a shared configuration (prefix, guards, middleware) to a logical set of routes. This significantly reduces boilerplate and enforces consistency across related endpoints.

---

## Basic Groups

```typescript
router.group({ prefix: "/users" }, (group) => {
    group.get("/", (req, res) => res.success("User list"));
    group.post("/", (req, res) => res.success("User created"));
    group.get("/:id", (req, res) => res.success(`User ${req.params.id}`));
});
// Resulting paths: GET /users/, POST /users/, GET /users/:id
```

---

## Nested Groups

Groups can be arbitrarily nested to produce complex hierarchical APIs.

```typescript
router.group({ prefix: "/api" }, (api) => {
    api.group({ prefix: "/v1" }, (v1) => {
        v1.get("/status", (req, res) => res.success("V1 OK"));
    });

    api.group({ prefix: "/v2" }, (v2) => {
        v2.get("/status", (req, res) => res.success("V2 OK"));
        v2.get("/users", (req, res) =>
            res.json({ users: [], meta: { page: 1 } }),
        );
    });
});
// Resulting paths: /api/v1/status, /api/v2/status, /api/v2/users
```

---

## API Versioning

The `version` property in a group configuration automatically prefixes all child routes with the version string.

```typescript
router.group({ version: "v2" }, (v2) => {
    v2.get("/data", (req, res) => res.success("V2 Data"));
});
// Resulting path: /v2/data
```

> [!NOTE]
> When both `prefix` and `version` are provided, the version is prepended to the prefix: `/{version}/{prefix}`.

---

## Group Guards and Security

Security guards applied at the group level are automatically inherited by every route within that group. This is the recommended approach for protecting entire API namespaces.

```typescript
const adminGuard = (req: any, _res: any) => {
    if (req.user?.role === "admin") return true;
    return "Admin access required";
};

router.group(
    {
        prefix: "/admin",
        guards: [adminGuard],
    },
    (admin) => {
        admin.get("/dashboard", (req, res) => res.success("Admin dashboard"));
        admin.get("/users", (req, res) => res.json({ users: [] }));
        // adminGuard runs before BOTH routes
    },
);
```

See [Security Guards](./security-guards.md) for the complete guard specification and inheritance rules.

