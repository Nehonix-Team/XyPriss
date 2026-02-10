---
title: Request Signature Authentication
description: Secure API authentication using request signatures with XP-Request-Sig header
---

# Request Signature Authentication

XyPriss provides a powerful request signature authentication system that allows you to secure your APIs using cryptographic signatures. This method is commonly used for securing webhooks, API-to-API communications, and protecting against unauthorized access.

## Overview

Request Signature Authentication works by requiring clients to include a cryptographic signature in the `XP-Request-Sig` header. The signature is computed using a shared secret and the request data, ensuring that:

-   Only authorized clients can access your API
-   Requests cannot be tampered with in transit
-   Replay attacks are prevented (with proper timestamp validation)

## Quick Start

```typescript
import { createServer } from "xypriss";

const server = createServer({
    security: {
        requestSignature: {
            secret: "your-super-secret-api-key-12345",
            debug: true, // Enable debug logging in development
        },
    },
});

server.get("/api/protected", (req, res) => {
    res.json({ message: "Access granted!", user: req.user });
});

server.start();
```

## Client Usage

### JavaScript/Node.js Client

```javascript
const crypto = require("crypto");

function signRequest(url, method, body = "", secret, timestamp = Date.now()) {
    const data = `${method.toUpperCase()}${url}${body}${timestamp}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("hex");
    return { signature, timestamp };
}

// Usage
const { signature, timestamp } = signRequest(
    "/api/protected",
    "GET",
    "",
    "your-secret"
);
const response = await fetch("http://localhost:3000/api/protected", {
    headers: {
        "XP-Request-Sig": signature,
        "X-Timestamp": timestamp,
    },
});
```

### cURL Example

```bash
# Generate signature (simplified example)
TIMESTAMP=$(date +%s)
DATA="GET/api/protected${TIMESTAMP}"
SIGNATURE=$(echo -n "$DATA" | openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2)

curl -X GET "http://localhost:3000/api/protected" \
  -H "XP-Request-Sig: $SIGNATURE" \
  -H "X-Timestamp: $TIMESTAMP"
```

### Python Client

```python
import hmac
import hashlib
import time
import requests

def sign_request(url, method, body='', secret='', timestamp=None):
    if timestamp is None:
        timestamp = int(time.time() * 1000)

    data = f"{method.upper()}{url}{body}{timestamp}"
    signature = hmac.new(
        secret.encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()

    return signature, timestamp

# Usage
signature, timestamp = sign_request('/api/protected', 'GET', '', 'your-secret')
response = requests.get('http://localhost:3000/api/protected', headers={
    'XP-Request-Sig': signature,
    'X-Timestamp': str(timestamp)
})
```

## Configuration Options

```typescript
interface RequestSignatureConfig {
    /** Secret key for signing requests */
    secret: string;

    /** Enable debug logging */
    debug?: boolean;

    /** Algorithm to use for signing (default: sha256) */
    algorithm?: "sha256" | "sha512";

    /** Maximum age of signature in milliseconds (default: 300000 = 5 minutes) */
    maxAge?: number;

    /** Custom header name for signature (default: XP-Request-Sig) */
    headerName?: string;

    /** Custom header name for timestamp (default: X-Timestamp) */
    timestampHeaderName?: string;

    /** Whether to include body in signature (default: true) */
    includeBody?: boolean;

    /** Whether to include query parameters in signature (default: true) */
    includeQuery?: boolean;

    /** Clock skew tolerance in milliseconds (default: 30000 = 30 seconds) */
    clockSkew?: number;
}
```

## Advanced Configuration

### Custom Headers and Algorithms

```typescript
const server = createServer({
    security: {
        requestSignature: {
            secret: "my-secret-key",
            algorithm: "sha512", // Use SHA-512 instead of SHA-256
            headerName: "X-API-Signature", // Custom header name
            timestampHeaderName: "X-API-Timestamp", // Custom timestamp header
            maxAge: 600000, // 10 minutes validity
            clockSkew: 60000, // 1 minute clock skew tolerance
        },
    },
});
```

### Selective Body Inclusion

```typescript
const server = createServer({
    security: {
        requestSignature: {
            secret: "my-secret",
            includeBody: false, // Don't include body in signature (useful for file uploads)
            includeQuery: true, // Include query parameters
        },
    },
});
```

## Route-Specific Configuration

You can apply request signature authentication to specific routes:

```typescript
const server = createServer({
    security: {
        requestSignature: {
            secret: "global-secret",
        },
        routeConfig: {
            requestSignature: {
                includeRoutes: ["/api/webhooks/*", "/api/admin/*"],
                excludeRoutes: ["/api/public/*"],
            },
        },
    },
});

// Or disable for specific routes
server.get("/api/public/status", (req, res) => {
    // This route doesn't require signature
    res.json({ status: "ok" });
});
```

## Security Best Practices

### 1. Use Strong Secrets

```typescript
// ✅ Good: Generate cryptographically secure secrets
const crypto = require("crypto");
const secret = crypto.randomBytes(32).toString("hex");

// ❌ Bad: Weak or predictable secrets
const secret = "password123";
const secret = "my-api-key";
```

### 2. Implement Timestamp Validation

```typescript
// Server-side timestamp validation is automatic
// But you can customize the maximum age
requestSignature: {
  maxAge: 300000, // 5 minutes
  clockSkew: 30000 // 30 seconds tolerance
}
```

### 3. Use HTTPS in Production

```typescript
// Always use HTTPS to prevent signature interception
const server = createServer({
    server: {
        https: {
            key: fs.readFileSync("server.key"),
            cert: fs.readFileSync("server.crt"),
        },
    },
    security: {
        requestSignature: { secret: "your-secret" },
    },
});
```

### 4. Rotate Secrets Regularly

```typescript
// Implement secret rotation
const secrets = {
    current: "current-secret",
    previous: "previous-secret", // Allow old signatures during transition
};

// Validate against multiple secrets
function validateSignature(signature, data) {
    return secrets.current === signature || secrets.previous === signature; // Grace period
}
```

## Error Handling

The middleware provides clear error messages:

```typescript
server.get('/api/protected', (req, res) => {
  res.json({ message: 'Success!' });
});

// Error responses:
{
  "error": "Missing signature header",
  "message": "XP-Request-Sig header is required"
}

{
  "error": "Invalid signature",
  "message": "Request signature verification failed"
}

{
  "error": "Signature expired",
  "message": "Request signature has expired"
}
```

## Integration Examples

### Webhook Endpoint Protection

```typescript
const server = createServer({
    security: {
        requestSignature: {
            secret: process.env.WEBHOOK_SECRET,
        },
    },
});

server.post("/webhooks/stripe", (req, res) => {
    // Only Stripe can call this endpoint
    const event = req.body;
    // Process webhook...
    res.json({ received: true });
});
```

### API-to-API Communication

```typescript
// Service A (Client)
const client = {
    async callServiceB(endpoint, data) {
        const { signature, timestamp } = signRequest(
            endpoint,
            "POST",
            JSON.stringify(data),
            SHARED_SECRET
        );

        return fetch(`http://service-b${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "XP-Request-Sig": signature,
                "X-Timestamp": timestamp,
            },
            body: JSON.stringify(data),
        });
    },
};

// Service B (Server)
const server = createServer({
    security: {
        requestSignature: {
            secret: SHARED_SECRET,
        },
    },
});

server.post("/api/data", (req, res) => {
    // Trust that this request came from Service A
    res.json({ processed: req.body });
});
```

### Mobile App API Protection

```typescript
// Mobile apps can include the signature in requests
const mobileClient = {
    async apiCall(endpoint, data) {
        const { signature, timestamp } = signRequest(
            endpoint,
            "POST",
            JSON.stringify(data),
            APP_SECRET
        );

        return fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "XP-Request-Sig": signature,
                "X-Timestamp": timestamp,
                Authorization: `Bearer ${userToken}`, // Additional auth if needed
            },
            body: JSON.stringify(data),
        });
    },
};
```

## Troubleshooting

### Common Issues

1. **"Missing signature header"**

    - Ensure client includes `XP-Request-Sig` header
    - Check header name if using custom configuration

2. **"Invalid signature"**

    - Verify secret key matches between client and server
    - Check that request data is signed in the correct order: `METHOD + URL + BODY + TIMESTAMP`

3. **"Signature expired"**
    - Check system clock synchronization
    - Increase `maxAge` if needed
    - Adjust `clockSkew` for clock differences

### Debug Mode

Enable debug logging to troubleshoot signature validation:

```typescript
const server = createServer({
    security: {
        requestSignature: {
            secret: "your-secret",
            debug: true, // Enable detailed logging
        },
    },
});
```

This will log signature validation steps, making it easier to identify issues.

## Performance Considerations

-   Signature validation is computationally lightweight (HMAC-SHA256)
-   No external service calls required
-   Minimal impact on response times
-   Scales well with high request volumes

## Migration Guide

### From API Keys

```typescript
// Old approach
server.use("/api/*", (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== "expected-key") {
        return res.status(401).json({ error: "Invalid API key" });
    }
    next();
});

// New approach
const server = createServer({
    security: {
        requestSignature: {
            secret: "your-secret",
        },
    },
});
```

### From JWT

```typescript
// Request signatures can complement JWT
const server = createServer({
    security: {
        requestSignature: {
            secret: "signature-secret",
        },
        // JWT validation can be added separately
    },
});
```

Request Signature Authentication provides a robust, secure method for API authentication that prevents tampering and ensures request integrity. It's particularly well-suited for server-to-server communication, webhooks, and scenarios where you need cryptographic assurance of request authenticity.
