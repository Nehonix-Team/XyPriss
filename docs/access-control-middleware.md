# Access Control Middleware

XyPriss provides advanced access control middleware to restrict API access based on client type. Two complementary middlewares allow you to create secure, client-specific endpoints.

## Overview

- BrowserOnly: Blocks non-browser requests (cURL, Postman, scripts) while allowing legitimate browser access
- TerminalOnly: Blocks browser requests while allowing terminal/API tools with optional whitelisting

## BrowserOnly Middleware

### Purpose
Perfect for web applications that should only be accessed through browsers. Blocks automation tools, API clients, and scripts while allowing legitimate browser traffic.

### Configuration

```typescript
import { createServer } from 'xypriss';

const app = createServer({
    security: {
        browserOnly: {
            enable: true,           // Enable/disable the middleware
            debug: false,           // Enable debug logging
            requireSecFetch: true,  // Require Sec-Fetch headers
            blockAutomationTools: true, // Block curl/wget user agents
            requireComplexAccept: false, // Require complex Accept headers
            allowOriginRequests: true,   // Allow CORS requests
            errorMessage: "Browser access required",
            statusCode: 403
        }
    }
});
```

### Detection Methods

The middleware uses multiple detection techniques:

1. **Sec-Fetch Headers** (Most reliable) - Browsers send `sec-fetch-*` headers
2. **Browser Engine Detection** - Detects Gecko, WebKit, Blink engines
3. **Browser Name Detection** - Identifies Firefox, Chrome, Safari, etc.
4. **Complex Accept Headers** - Browsers send detailed MIME type preferences
5. **Navigation Headers** - Origin and Referer headers
6. **Browser Language Patterns** - Multiple languages with quality values
7. **Cache Control Patterns** - Browser-specific caching behavior
8. **Connection Patterns** - Keep-alive connections
9. **DNT Headers** - Do Not Track headers
10. **Upgrade-Insecure-Requests** - HTTPS upgrade requests

### Example Usage

```typescript
// Web app that should only be accessed via browser
const webApp = createServer({
    security: {
        browserOnly: {
            enable: true,
            requireSecFetch: true,
            blockAutomationTools: true
        }
    }
});

// API endpoint accessible from web app
webApp.get('/api/user/profile', (req, res) => {
    // This will only work from browser requests
    res.json({ user: req.user });
});
```

## TerminalOnly Middleware

### Purpose
Ideal for API-only endpoints or development tools. Blocks browser access while allowing terminal tools like cURL, Postman, and other API clients.

### Configuration

```typescript
const app = createServer({
    security: {
        terminalOnly: {
            enable: true,           // Enable/disable the middleware
            debug: true,            // Enable debug logging
            allowedTools: ["postman", "curl"], // Whitelist specific tools
            blockSecFetch: true,    // Block requests with Sec-Fetch headers
            blockBrowserIndicators: true, // Block browser-specific headers
            requireSimpleAccept: false,   // Require simple Accept headers
            errorMessage: "Terminal/API access required",
            statusCode: 403,
            strictness: "normal"    // "normal" | "high" | "paranoid"
        }
    }
});
```

### Whitelist Mode

When `allowedTools` is specified, only listed tools can access the endpoint:

```typescript
const devAPI = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "insomnia"], // Only these tools allowed
            debug: true
        }
    }
});

// Only accessible via Postman or Insomnia
devAPI.get('/api/admin/debug', (req, res) => {
    res.json({ debug: true, server: process.env });
});
```

### Supported Tools

The middleware recognizes these API tools by default:

- `curl` - Command line HTTP client
- `wget` - Command line download tool
- `postman` - Postman API client
- `insomnia` - Insomnia REST client
- `httpie` - HTTPie command line client
- `axios` - Axios HTTP library
- `fetch` - Node.js fetch API
- `got` - Got HTTP library
- Various programming language HTTP clients

### Strictness Levels

- **normal** (default): Standard detection with 70% confidence threshold
- **high**: More aggressive detection with 50% confidence threshold
- **paranoid**: Maximum security with 30% confidence threshold

## Configuration Validation

### Mutual Exclusivity

You cannot enable both `browserOnly` and `terminalOnly` simultaneously:

```typescript
// ❌ This will throw an error
const app = createServer({
    security: {
        browserOnly: { enable: true },
        terminalOnly: { enable: true } // Error: cannot enable both
    }
});
```

### Enable Property

Both middlewares support explicit enable/disable:

```typescript
const app = createServer({
    security: {
        // Explicitly disabled
        browserOnly: { enable: false },

        // Explicitly enabled
        terminalOnly: { enable: true, allowedTools: ["postman"] }
    }
});
```

## Advanced Examples

### Development vs Production

```typescript
const isProduction = process.env.NODE_ENV === 'production';

const app = createServer({
    security: {
        // In development, allow all tools
        terminalOnly: isProduction ? {
            enable: true,
            allowedTools: ["postman", "insomnia"]
        } : undefined,

        // In production, restrict to specific tools
        browserOnly: !isProduction ? {
            enable: true
        } : undefined
    }
});
```

### API Versioning

```typescript
// Public API - browser access
app.get('/api/v1/public', (req, res) => {
    res.json({ public: true });
});

// Admin API - terminal only
const adminApp = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["postman"]
        }
    }
});

adminApp.get('/api/admin/users', (req, res) => {
    res.json({ users: [] });
});
```

### Microservices Architecture

```typescript
// Service A - Browser only (frontend service)
const frontendService = createServer({
    security: { browserOnly: { enable: true } }
});

// Service B - Terminal only (API service)
const apiService = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["axios", "fetch"] // Only allow programmatic access
        }
    }
});

// Service C - Internal only (no external access)
const internalService = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: [] // Empty whitelist = no external access
        }
    }
});
```

## Error Responses

### BrowserOnly Blocked Request

```json
{
    "error": "Browser access required",
    "timestamp": "2025-11-24T10:00:00.000Z",
    "code": "NEHONIXYPBRW01"
}
```

### TerminalOnly Blocked Request

```json
{
    "error": "Terminal/API access required. Browser access blocked.",
    "timestamp": "2025-11-24T10:00:00.000Z",
    "code": "NEHONIXYPTERM01"
}
```

### Whitelist Violation

```json
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

## Debugging

Enable debug mode to see detailed detection information:

```typescript
const app = createServer({
    security: {
        terminalOnly: {
            enable: true,
            debug: true,
            allowedTools: ["postman"]
        }
    }
});
```

This will log:
- Request analysis details
- Detection confidence scores
- Reasons for allowing/blocking
- Tool identification results

## Performance Considerations

- **Minimal overhead**: Detection runs in O(1) time
- **Early blocking**: Requests are blocked before reaching route handlers
- **Configurable strictness**: Balance security vs. false positives
- **Whitelist optimization**: Pre-compiled regex patterns for tool matching

## Security Best Practices

1. **Use HTTPS**: Always combine with SSL/TLS
2. **Rate limiting**: Combine with rate limiting for additional protection
3. **Logging**: Enable debug logging in development
4. **Regular updates**: Keep allowed tools list current
5. **Testing**: Test with various clients before production deployment

## Migration Guide

### From Basic CORS

```typescript
// Before: Basic CORS
const app = createServer({
    security: {
        cors: { origin: "*" }
    }
});

// After: BrowserOnly for better security
const app = createServer({
    security: {
        browserOnly: { enable: true }
    }
});
```

### From IP Whitelisting

```typescript
// Before: IP-based restrictions
const app = createServer({
    middleware: [
        (req, res, next) => {
            if (!allowedIPs.includes(req.ip)) {
                return res.status(403).send('Forbidden');
            }
            next();
        }
    ]
});

// After: Tool-based restrictions
const app = createServer({
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "curl"]
        }
    }
});
```

This access control system provides fine-grained control over who can access your APIs, making it easy to create secure, client-specific endpoints.