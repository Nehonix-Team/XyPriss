# Plugin Request Data Masking

XyPriss implements a proactive security measure to protect sensitive user data from being intercepted by plugins. This is achieved through **Request Data Masking**, which restricts access to specific request properties within plugin hooks.

## Overview

While plugins are powerful tools for extending server functionality, they often do not need access to the full content of a request (such as passwords in a body or session tokens in cookies) to perform their tasks (e.g., logging response times or detecting attacks).

To adhere to the **Principle of Least Privilege**, XyPriss automatically masks sensitive fields in the `Request` object before passing it to most plugin hooks.

## Masked Fields

The following properties of the `req` (Request) object are masked:

-   **req.body**: The parsed body of the request.
-   **req.query**: The URL query parameters.
-   **req.cookies**: The parsed cookies.
-   **req.params**: The route parameters.

When a plugin attempts to access these fields, it will receive a standard informational string instead of the actual data:

`Access to sensitive request data is restricted in this hook for security reasons.`

## Affected Hooks

Data masking is applied to the following hooks in the `XyPrissPlugin` interface:

-   `onRequest`
-   `onResponse`
-   `onError`
-   `onSecurityAttack`
-   `onResponseTime`
-   `onRouteError`
-   `onRateLimit`

## Why Masking?

1.  **Security**: Prevents malicious or poorly coded plugins from leaking sensitive user information (PII, credentials, etc.).
2.  **Privacy**: Ensures that user data is only handled by the core application logic unless explicitly necessary.
3.  **Compliance**: Helps in meeting regulatory requirements (like GDPR or PCI-DSS) by limiting data exposure.

## Impact on Application Logic

This masking **only affects plugins**. The main application logic (route handlers, controllers, and core middleware) continues to have full, unmasked access to all request data.

## Best Practices for Plugin Developers

If your plugin requires access to specific request data to function, consider the following:

-   **Headers**: Most metadata (like `User-Agent`, `Content-Type`, etc.) is still available via `req.headers`.
-   **URL**: The `req.path` and `req.method` remain accessible for routing-related logic.
-   **Core Integration**: If a feature absolutely requires raw data access, it should be implemented as part of the core application or via a trusted internal module rather than a generic plugin hook.

