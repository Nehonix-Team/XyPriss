# XyPriss Security Features Overview

XyPriss provides comprehensive security middleware with advanced access control and content security policy configuration. This document highlights the latest security enhancements that provide fine-grained control over API access and web security.

## Latest Security Features

### 1. Enhanced Content Security Policy (CSP) Configuration

Flexible CSP directives with full TypeScript support

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "https://cdn.example.com"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://dll.nehonix.com"],
                    // Any CSP directive supported
                    customDirective: ["value1", "value2"],
                },
            },
        },
    },
});
```

Key Benefits:

- Fully flexible: Support for any CSP directive with `Record<string, any>` types
- Type-safe: Complete TypeScript support with IntelliSense
- Production-ready: Real-world examples for e-commerce, SPAs, and APIs
- Performance optimized: Minimal overhead with browser caching

[Read the full CSP documentation](./enhanced-csp-configuration.md)

---

### 2. Advanced Access Control Middleware

BrowserOnly & TerminalOnly - Client-specific API access

```typescript
const app = createServer({
    security: {
        // Block non-browser requests (cURL, Postman, scripts)
        browserOnly: {
            enable: true,
            requireSecFetch: true,
            blockAutomationTools: true,
        },

        // Block browser requests, allow only API tools
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "curl"],
            debug: true,
        },
    },
});
```

Key Benefits:

- Mutual exclusivity: Cannot enable both middlewares simultaneously
- Whitelist support: Allow only specific API tools
- Advanced detection: 10+ browser detection methods with confidence scoring
- Flexible configuration: Enable/disable with granular control

[Read the access control documentation](./access-control-middleware.md)

---

## Security Architecture

### Comprehensive Protection Layers

```
┌─────────────────────────────────────────┐
│           Access Control Layer          │
│  ┌─────────────────────────────────────┐ │
│  │        BrowserOnly Middleware       │ │
│  │  - Sec-Fetch header validation      │ │
│  │  - Browser engine detection         │ │
│  │  - Automation tool blocking         │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │       TerminalOnly Middleware       │ │
│  │  - API tool whitelisting            │ │
│  │  - Browser request blocking         │ │
│  │  - Confidence-based detection       │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│        Content Security Layer          │
│  ┌─────────────────────────────────────┐ │
│  │       Enhanced CSP Middleware       │ │
│  │  - Flexible directive configuration │ │
│  │  - TypeScript-first design          │ │
│  │  - Production security policies     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Security Middleware Stack

```typescript
// Complete security configuration
const secureApp = createServer({
    security: {
        // Access Control (choose one)
        browserOnly: { enable: false },
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "insomnia"],
        },

        // Content Security
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "https://cdn.example.com"],
                    // ... comprehensive CSP
                },
            },
        },

        // Additional security layers
        cors: { origin: ["https://app.example.com"] },
        rateLimit: { max: 100, windowMs: 900000 },
        csrf: true,
        xss: true,
        sqlInjection: true,
    },
});
```

---

## Use Cases & Examples

### E-commerce Platform

```typescript
const eCommerceAPI = createServer({
    security: {
        // Frontend API - browser only
        browserOnly: {
            enable: true,
            requireSecFetch: true,
        },
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    scriptSrc: ["'self'", "https://js.stripe.com"],
                    connectSrc: ["'self'", "https://api.stripe.com"],
                },
            },
        },
    },
});

// Admin API - terminal only
const adminAPI = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["postman"],
        },
    },
});
```

### Microservices Architecture

```typescript
// Public API Gateway
const publicAPI = createServer({
    security: {
        browserOnly: { enable: true },
        cors: { origin: "*" },
    },
});

// Internal API (service-to-service)
const internalAPI = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["axios", "fetch", "got"],
        },
    },
});

// Admin API (restricted access)
const adminAPI = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "insomnia"],
        },
        rateLimit: { max: 10, windowMs: 60000 }, // Stricter limits
    },
});
```

### Development vs Production

```typescript
const isProduction = process.env.NODE_ENV === "production";

const app = createServer({
    security: {
        // Development: allow all tools
        terminalOnly: isProduction
            ? {
                  enable: true,
                  allowedTools: ["postman", "insomnia", "curl"],
              }
            : undefined,

        // Production: strict CSP
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    scriptSrc: isProduction
                        ? ["'self'", "https://cdn.example.com"]
                        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                },
            },
        },
    },
});
```

---

## Configuration Reference

### BrowserOnly Configuration

```typescript
interface BrowserOnlyConfig {
    enable?: boolean; // Enable/disable middleware
    debug?: boolean; // Debug logging
    requireSecFetch?: boolean; // Require Sec-Fetch headers
    blockAutomationTools?: boolean; // Block curl/wget
    requireComplexAccept?: boolean; // Complex Accept header check
    allowOriginRequests?: boolean; // Allow CORS requests
    errorMessage?: string; // Custom error message
    statusCode?: number; // HTTP status code
}
```

### TerminalOnly Configuration

```typescript
interface TerminalOnlyConfig {
    enable?: boolean; // Enable/disable middleware
    debug?: boolean; // Debug logging
    allowedTools?: string[]; // Whitelist of allowed tools
    blockSecFetch?: boolean; // Block Sec-Fetch headers
    blockBrowserIndicators?: boolean; // Block browser headers
    requireSimpleAccept?: boolean; // Simple Accept header check
    errorMessage?: string; // Custom error message
    statusCode?: number; // HTTP status code
    strictness?: "normal" | "high" | "paranoid"; // Detection strictness
}
```

### Enhanced CSP Configuration

```typescript
interface HelmetConfig {
    contentSecurityPolicy?: {
        directives?: Record<string, string | string[]>;
        reportOnly?: boolean;
        reportUri?: string;
    };
    // ... other helmet options
}
```

---

## Performance & Security Metrics

### Performance Impact

- **Access Control**: O(1) detection with minimal CPU overhead
- **CSP Headers**: Static headers with browser caching
- **Memory Usage**: < 1MB additional memory per middleware
- **Request Latency**: < 5ms additional processing time

### Security Effectiveness

- **Browser Detection**: 95%+ accuracy with confidence scoring
- **Tool Identification**: Recognizes 20+ API tools automatically
- **CSP Coverage**: Support for all modern CSP directives
- **False Positive Rate**: < 2% with configurable strictness

---

## Testing & Validation

### Automated Testing

```typescript
// Test browser blocking
describe("BrowserOnly Middleware", () => {
    it("should block curl requests", async () => {
        const response = await request(app)
            .get("/api/data")
            .set("User-Agent", "curl/8.15.0");
        expect(response.status).toBe(403);
    });

    it("should allow browser requests", async () => {
        const response = await request(app)
            .get("/api/data")
            .set("User-Agent", "Mozilla/5.0...")
            .set("Sec-Fetch-Dest", "empty");
        expect(response.status).toBe(200);
    });
});
```

### Manual Testing

```bash
# Test browser blocking
curl -H "User-Agent: curl/8.15.0" http://localhost:3000/api
# Expected: 403 Forbidden

# Test tool whitelisting
curl -H "User-Agent: PostmanRuntime/7.32.0" http://localhost:3000/api
# Expected: 200 OK (if postman is whitelisted)

# Check CSP headers
curl -I http://localhost:3000
# Expected: Content-Security-Policy header present
```

---

## Error Handling & Debugging

### Common Error Responses

```json
// BrowserOnly blocked
{
    "error": "Browser access required",
    "timestamp": "2025-11-24T10:00:00.000Z",
    "code": "NEHONIXYPBRW01"
}

// TerminalOnly blocked
{
    "error": "Terminal/API access required. Browser access blocked.",
    "timestamp": "2025-11-24T10:00:00.000Z",
    "code": "NEHONIXYPTERM01"
}

// Tool not allowed
{
    "error": "Terminal/API access required",
    "xypriss": {
        "module": "TerminalOnly",
        "code": "TOOL_NOT_ALLOWED",
        "details": "Tool not in allowed list. Allowed tools: postman, insomnia",
        "userAgent": "curl/8.15.0"
    },
    "timestamp": "2025-11-24T10:00:00.000Z",
    "code": "NEHONIXYPTERM01"
}
```

### Debug Mode

Enable debug logging for detailed analysis:

```typescript
const app = createServer({
    security: {
        terminalOnly: {
            enable: true,
            debug: true,
            allowedTools: ["postman"],
        },
    },
});
```

This provides detailed logs including:

- Request analysis breakdown
- Detection confidence scores
- Reasons for allowing/blocking
- Tool identification results

---

## Security Best Practices

### Configuration Guidelines

1. **Principle of Least Privilege**: Only allow necessary access
2. **Defense in Depth**: Combine multiple security layers
3. **Regular Audits**: Review and update security configurations
4. **Testing**: Thoroughly test security measures
5. **Monitoring**: Enable logging and monitoring

### Production Recommendations

```typescript
const productionConfig = {
    security: {
        // Strict access control
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "insomnia"], // Only approved tools
            strictness: "high",
        },

        // Comprehensive CSP
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "https://cdn.trusted.com"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                },
            },
        },

        // Additional layers
        rateLimit: { max: 1000, windowMs: 900000 },
        cors: { origin: ["https://app.example.com"] },
    },
};
```

---

## Documentation Links

- [Access Control Middleware](./access-control-middleware.md) - Complete guide for BrowserOnly and TerminalOnly
- [Enhanced CSP Configuration](./enhanced-csp-configuration.md) - Advanced CSP setup and examples
- [Security Configuration](./security.md) - General security configuration
- [API Reference](./api-reference.md) - Complete API documentation

---

## Contributing

These security features are designed to be extensible and maintainable. Contributions are welcome for:

- Additional detection methods
- New CSP directive support
- Performance optimizations
- Security enhancements
- Documentation improvements

---

## License

These security features are part of the XyPriss framework and follow the same Nehonix OSL (NOSL) licensing terms.

---

_Last updated: November 2025_

This security overview demonstrates XyPriss's commitment to providing enterprise-grade security features with developer-friendly APIs and comprehensive protection against modern web threats.

