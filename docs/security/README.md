# Security Documentation

Welcome to the XyPriss Security Documentation. This directory contains detailed information on the various security layers provided by the XyPriss engine.

## Core Security Features

| Feature                   | Documentation                                                  | Description                                                          |
| :------------------------ | :------------------------------------------------------------- | :------------------------------------------------------------------- |
| **Request Signature**     | [Request Signature Protection](./request-signature.md)         | HMAC-based request validation and integrity checks.                  |
| **Response Manipulation** | [Response Manipulation Middleware](./response-manipulation.md) | Dynamic response masking and data transformation.                    |
| **Protectors**            | (Reserved)                                                     | Specialized protectors against common web attacks (SQLi, XSS, etc.). |

## Getting Started

To enable these security features, update your `xypriss.config.ts` or the options passed to `createServer()`.

```typescript
import { createServer, __xhsc__ } from "xypriss";

const app = createServer({
    security: {
        requestSignature: {
            enabled: true,
            secret: __xhsc__.$env("SIG_SECRET") || "your-32-character-minimum-secret-here", // or __xhsc__.__env__.get("SIG_SECRET", "your-32-character-minimum-secret-here");
        },
        responseManipulation: {
            enabled: true,
            rules: [{ field: "password", replacement: "[MASKED]" }],
        },
    },
});
```

