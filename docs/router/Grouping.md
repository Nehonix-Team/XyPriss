# XyPriss Router V2 - Grouping and Versioning

Organize your application logic using hierarchical routing, prefixes, and versioning.

## Basic Grouping

Groups allow you to apply a common prefix or middleware to multiple routes.

```typescript
router.group({ prefix: "/users" }, (group) => {
    group.get("/", (req, res) => res.success("User list"));
    group.get("/:id", (req, res) => res.success("User detail"));
});
```

- Resulting paths: `/users/`, `/users/:id`

## Nested Groups

Groups can be nested to create complex API structures.

```typescript
router.group({ prefix: "/api" }, (api) => {
    api.group({ prefix: "/v1" }, (v1) => {
        v1.get("/status", (req, res) => res.success("V1 OK"));
    });
});
```

- Resulting path: `/api/v1/status`

## API Versioning

Versioning can be declared as a property in the group options.

```typescript
router.group({ version: "v2" }, (v2) => {
    v2.get("/data", (req, res) => res.success("V2 Data"));
});
```

If a version is specified, it is automatically applied to all child routes unless overridden.

## Group Middleware and Guards

You can apply security guards or middleware to an entire group.

```typescript
router.group(
    {
        prefix: "/admin",
        guards: [adminGuard],
    },
    (admin) => {
        admin.get("/dashboard", (req, res) => res.success("Admin area"));
    },
);
```

