# XyPriss Router V2 - Security and Guards

Implement hierarchical security using declarative guards.

## Route Guards

Guards are functions that run before the route handler. They must return `true` to proceed, or a `string` (error message) / `false` to block.

```typescript
const authGuard = (req, res) => {
    if (req.headers.authorization) return true;
    return "Unauthorized: Token missing";
};

router.get("/profile", { guards: [authGuard] }, (req, res) => {
    res.success("Protected profile");
});
```

## Security Hierarchy

Guards applied at the Router or Group level are inherited by all child routes.

1. **Router Guards**: Applied to every route in the router.
2. **Group Guards**: Applied to every route in the specific group.
3. **Route Guards**: Applied only to the specific route.

Inheritance order: Router -> Group -> Route. All must pass for the handler to execute.

## Response Status on Failure

By default:

- Returning `false` triggers a **403 Forbidden**.
- Returning a `string` triggers a **401 Unauthorized** with the string as the message.

## Standard Middleware vs Guards

While middleware can also block requests, **Guards** are preferred for security checks because:

- They are declarative and visible in route inspection.
- They have a standard return-type protocol for common HTTP security failures.
- They execute before the main handler logic is even initialized.

