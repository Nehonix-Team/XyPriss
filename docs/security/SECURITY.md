# XyPriss Security Guide

XyPriss includes comprehensive security features to protect your application from common vulnerabilities.

## Built-in Security Middleware

XyPriss includes 12+ built-in security middleware modules:

- **CSRF Protection**: Via the `csrf-csrf` library
- **Security Headers**: Powered by Helmet for secure HTTP headers
- **CORS**: Configurable cross-origin resource sharing with wildcard pattern support
- **Rate Limiting**: Prevents abuse by limiting requests per IP
- **Input Validation**: Sanitizes inputs to prevent XSS and injection attacks
- **Request Logging**: Monitors and logs incoming requests

## Basic Security Configuration

Enable security features:

```typescript
import { createServer } from "xypriss";

const server = createServer({
    security: {
        enabled: true,
        level: "enhanced", // or "basic", "maximum"
        csrf: { enabled: true },
        rateLimit: {
            max: 100,
            windowMs: 15 * 60 * 1000, // 100 requests per 15 minutes
        },
    },
});
```

## CORS with Wildcard Support

XyPriss supports flexible CORS configuration with wildcard patterns:

```typescript
const server = createServer({
    security: {
        cors: {
            origin: [
                "localhost:*", // Any localhost port
                "127.0.0.1:*", // Any 127.0.0.1 port
                "*.myapp.com", // Any subdomain
                "https://app.prod.com", // Exact production URL
            ],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE"],
            allowedHeaders: ["Content-Type", "Authorization"],
        },
    },
});
```

### Supported CORS Patterns

- `localhost:*` - Matches any port on localhost
- `*.domain.com` - Matches any subdomain
- Exact URLs for production environments

For detailed CORS configuration, see the [Wildcard CORS Guide](./WILDCARD_CORS.md).

## Rate Limiting

Protect against brute force and DDoS attacks:

```typescript
const server = createServer({
    security: {
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: "Too many requests from this IP",
            standardHeaders: true,
            legacyHeaders: false,
        },
    },
});
```

### Per-Route Rate Limiting

```typescript
import { rateLimit } from "xypriss";

app.post(
    "/api/login",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
    (req, res) => {
        // Login logic
    },
);
```

## CSRF Protection

Protect against Cross-Site Request Forgery:

```typescript
const server = createServer({
    security: {
        csrf: {
            enabled: true,
            ignoreMethods: ["GET", "HEAD", "OPTIONS"],
            cookieName: "csrf-token",
        },
    },
});
```

### Using CSRF Tokens

```typescript
app.get("/form", (req, res) => {
    const csrfToken = req.csrfToken();
    res.json({ csrfToken });
});

app.post("/submit", (req, res) => {
    // CSRF token is automatically validated
    res.json({ success: true });
});
```

## Input Validation & Sanitization

Prevent XSS and injection attacks:

```typescript
import { sanitize, validate } from "xypriss-security";

app.post("/api/user", (req, res) => {
    const cleanData = sanitize(req.body, {
        allowedTags: [],
        allowedAttributes: {},
    });

    const errors = validate(cleanData, {
        email: { type: "email", required: true },
        name: { type: "string", minLength: 2, maxLength: 50 },
    });

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    res.json({ success: true, data: cleanData });
});
```

## Security Headers

XyPriss automatically sets secure HTTP headers using Helmet:

```typescript
const server = createServer({
    security: {
        headers: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            },
        },
    },
});
```

For enhanced security features:

```bash
xyp install xypriss-security
```

Alternatively, using npm:

```bash
npm install xypriss-security
```

```typescript
import { createServer } from "xypriss";
import { fString, generateSecureToken, hashPassword } from "xypriss-security";

const server = createServer();

server.post("/api/register", async (req, res) => {
    // Secure string handling
    const secureEmail = fString(req.body.email, {
        enableEncryption: true,
    });

    // Secure password hashing
    const hashedPassword = await hashPassword(req.body.password);

    // Generate secure tokens
    const token = generateSecureToken({ length: 32 });

    res.json({ token });
});
```

## Security Best Practices

1. **Always enable HTTPS** in production
2. **Use environment variables** for sensitive data
3. **Implement rate limiting** on authentication endpoints
4. **Validate and sanitize** all user inputs
5. **Keep dependencies updated** regularly
6. **Use CSRF protection** for state-changing operations
7. **Implement proper authentication** and authorization
8. **Log security events** for monitoring
9. **Use secure session management**
10. **Regular security audits** of your code

## Security Levels

XyPriss offers three security levels:

### Basic

- Essential security headers
- Basic CORS protection
- Request logging

### Enhanced (Recommended)

- All basic features
- CSRF protection
- Rate limiting
- Input sanitization
- XSS protection

### Maximum

- All enhanced features
- Strict CSP policies
- Advanced rate limiting
- IP whitelisting/blacklisting
- Request signature validation

```typescript
const server = createServer({
    security: {
        enabled: true,
        level: "maximum", // "basic" | "enhanced" | "maximum"
    },
});
```

## Monitoring & Logging

Enable security event logging:

```typescript
const server = createServer({
    logging: {
        enabled: true,
        level: "info",
        components: {
            security: true,
        },
    },
    security: {
        enabled: true,
        logSecurityEvents: true,
    },
});
```

---

[← Back to Main Documentation](../README.md)

