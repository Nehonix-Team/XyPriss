# Advanced Routing and Security Guards

XyPriss provides a high-performance, modular routing system that supports declarative guards, typed parameters, and advanced lifecycle hooks. This document details the architectural modularization of the HTTP server and the implementation of the XyGuard API for custom security logic.

## HTTP Server Modularity

To ensure maximum maintainability and performance, the XyPriss HTTP server core has been modularized into specialized components. This separation of concerns allows the framework to handle high-concurrency traffic with minimal overhead.

### Core Components

1. **RouteManager**: Responsible for high-speed route registration, parameter extraction, and radix-based route matching.
2. **BodyParser**: A high-efficiency utility for parsing JSON and URL-encoded request bodies.
3. **RequestForwarder**: Manages server-side request forwarding (`req.forward`), enabling seamless internal communication between services.
4. **HttpErrorHandler**: Centralizes 404 management and internal server error handling, ensuring consistent error responses across the framework.

## XyGuard API

The XyGuard API is a non-opinionated security layer that allows developers to define custom logic for built-in declarative guards. This architectural choice ensures that the framework remains flexible while providing a clean syntax for route protection.

### Declarative Guards

XyPriss supports three primary types of built-in guards that can be declared directly in route options:

- `authenticated`: Protects routes requiring an active session or valid credentials.
- `roles`: Restricts access based on user roles (e.g., `['admin', 'editor']`).
- `permissions`: Enforces fine-grained access control based on specific capabilities.

### Implementation and Resolvers

Because XyPriss does not speculate on your application's authentication algorithm, you must define "Guard Resolvers" globally. These resolvers are functions that return a boolean or a string (error message).

#### Registering Resolvers

```typescript
import { XyGuard } from "xypriss";

// Define authentication logic
XyGuard.define("authenticated", (req) => {
    return !!req.session?.get("user_id");
});

// Define role-based access control
XyGuard.define("roles", (req, requiredRoles) => {
    const userRole = req.locals.user?.role;
    return requiredRoles.includes(userRole);
});

// Define permission-based access control
XyGuard.define("permissions", (req, requiredPermissions) => {
    const userPermissions = req.locals.user?.permissions || [];
    return requiredPermissions.every((p) => userPermissions.includes(p));
});
```

### Type Safety

The `XyGuard.define` method is fully typesafe and only accepts supported guard names:

```typescript
type BuiltInGuardName = "authenticated" | "roles" | "permissions";
```

#### Usage in Routes

Once defined, these guards can be applied to any route or group using a simple declarative object:

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

### Execution Flow

1. **Built-in Resolvers**: XyGuard resolvers are executed first. If any resolver returns `false` or a string, the request is aborted with the appropriate HTTP status code (401 or 403).
2. **Custom Guards**: Standard middleware-style guard functions are executed after built-in resolvers.
3. **Route Handler**: The final handler is only executed if all guards pass.

## Best Practices

- **Global Definition**: Register your XyGuard resolvers during application initialization (e.g., in `main.ts` or a dedicated security plugin).
- **Error Messages**: Return a string from a resolver to provide a custom error message to the client.
- **Asynchronous Logic**: Resolvers support Promises, allowing for database lookups or external API calls during guard execution.

