# Enhanced Content Security Policy (CSP) Configuration

XyPriss provides advanced Content Security Policy configuration with flexible directive support, allowing developers to create comprehensive security policies for their web applications.

## Overview

The Helmet middleware in XyPriss now supports fully customizable CSP directives using a flexible `Record<string, any>` type, enabling any CSP directive to be configured with any value type.

## Basic Configuration

### Simple CSP Setup

```typescript
import { createServer } from 'xypriss';

const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                }
            }
        }
    }
});
```

### Advanced CSP with Multiple Sources

```typescript
const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    // Multiple source types
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "'unsafe-eval'",
                        "https://cdn.example.com",
                        "https://api.stripe.com"
                        "https://api.nehonix.com"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://fonts.googleapis.com"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                        "data:"
                    ],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "https:",
                        "blob:"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.example.com",
                        "wss://websocket.example.com"
                    ],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"],
                    upgradeInsecureRequests: []
                }
            }
        }
    }
});
```

## Flexible Directive Types

### String Directives

```typescript
contentSecurityPolicy: {
    directives: {
        // Single string value
        baseUri: "'self'",
        // Multiple values as array
        scriptSrc: ["'self'", "https://cdn.example.com"],
        // Special CSP keywords
        frameSrc: "'none'",
        objectSrc: "'none'"
    }
}
```

### Array Directives

```typescript
contentSecurityPolicy: {
    directives: {
        // Multiple sources
        scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.example.com",
            "https://api.stripe.com"
        ],
        // Mixed protocols and domains
        connectSrc: [
            "'self'",
            "https://api.example.com",
            "wss://websocket.example.com"
        ]
    }
}
```

### Special Directives

```typescript
contentSecurityPolicy: {
    directives: {
        // Empty array for boolean directives
        upgradeInsecureRequests: [],
        // Block all
        frameAncestors: "'none'",
        // Allow all (not recommended)
        imgSrc: ["*"],
        // Data URLs
        imgSrc: ["data:"],
        // Blob URLs
        imgSrc: ["blob:"]
    }
}
```

## Real-World Examples

### E-commerce Application

```typescript
const eCommerceApp = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'", // For inline event handlers
                        "https://js.stripe.com",
                        "https://cdn.example.com"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://fonts.googleapis.com"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com"
                    ],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "https:",
                        "blob:"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.stripe.com",
                        "https://api.example.com"
                    ],
                    frameSrc: [
                        "https://js.stripe.com",
                        "https://www.youtube.com"
                    ],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"],
                    upgradeInsecureRequests: []
                }
            }
        }
    }
});
```

### Single Page Application (SPA)

```typescript
const spaApp = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-eval'", // For webpack dev server
                        "https://cdn.jsdelivr.net"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://fonts.googleapis.com"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                        "data:"
                    ],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "https:",
                        "blob:"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.example.com",
                        "wss://api.example.com"
                    ],
                    workerSrc: ["'self'", "blob:"],
                    childSrc: ["'self'", "blob:"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"]
                }
            }
        }
    }
});
```

### API-Only Server

```typescript
const apiServer = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'none'"],
                    scriptSrc: ["'none'"],
                    styleSrc: ["'none'"],
                    imgSrc: ["'none'"],
                    fontSrc: ["'none'"],
                    connectSrc: ["'none'"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'none'"],
                    formAction: ["'none'"],
                    frameAncestors: ["'none'"]
                }
            }
        }
    }
});
```

### Development vs Production

```typescript
const isProduction = process.env.NODE_ENV === 'production';

const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: isProduction
                        ? ["'self'", "https://cdn.example.com"]
                        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: isProduction
                        ? ["'self'", "https://fonts.googleapis.com"]
                        : ["'self'", "'unsafe-inline'"],
                    // ... other directives
                }
            }
        }
    }
});
```

## CSP Nonces and Hashes

### Nonce Support

```typescript
// Generate nonce for each request
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
});

const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    scriptSrc: [
                        "'self'",
                        (req, res) => `'nonce-${res.locals.nonce}'`
                    ]
                }
            }
        }
    }
});
```

### Hash Support

```typescript
const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    scriptSrc: [
                        "'self'",
                        "'sha256-abc123...'" // Inline script hash
                    ]
                }
            }
        }
    }
});
```

## Advanced CSP Features

### Report-Only Mode

```typescript
const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                reportOnly: true, // Don't enforce, just report
                directives: {
                    // Your directives here
                },
                reportUri: "/csp-report"
            }
        }
    }
});

// Handle CSP violation reports
app.post('/csp-report', (req, res) => {
    console.log('CSP Violation:', req.body);
    res.status(204).end();
});
```

### Custom Report URI

```typescript
const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    reportUri: "/api/security/csp-violation"
                }
            }
        }
    }
});
```

## CSP Testing and Debugging

### Browser Developer Tools

1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for CSP violation messages
4. Check Network tab for blocked resources

### Testing Tools

```bash
# Test CSP with curl
curl -H "User-Agent: Mozilla/5.0..." \
     -H "Sec-Fetch-Dest: script" \
     http://localhost:3000

# Check CSP headers
curl -I http://localhost:3000
```

### Common Issues

#### Inline Scripts Blocked

```typescript
// ❌ This will be blocked
<script>console.log('hello');</script>

// ✅ Add 'unsafe-inline' or use nonce/hash
contentSecurityPolicy: {
    directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"]
    }
}
```

#### External Resources Blocked

```typescript
// ❌ This will be blocked
<script src="https://cdn.example.com/script.js"></script>

// ✅ Add domain to CSP
contentSecurityPolicy: {
    directives: {
        scriptSrc: ["'self'", "https://cdn.example.com"]
    }
}
```

#### Inline Styles Blocked

```typescript
// ❌ This will be blocked
<style>body { color: red; }</style>

// ✅ Add 'unsafe-inline' for styles
contentSecurityPolicy: {
    directives: {
        styleSrc: ["'self'", "'unsafe-inline'"]
    }
}
```

## Performance Considerations

- **Minimal overhead**: CSP headers are static and cached
- **Browser optimization**: Modern browsers optimize CSP parsing
- **CDN friendly**: CSP works well with CDNs and edge networks
- **Incremental adoption**: Start with basic policies and expand gradually

## Security Best Practices

1. **Principle of least privilege**: Only allow necessary sources
2. **Avoid 'unsafe-inline'**: Use nonces or hashes instead
3. **Avoid 'unsafe-eval'**: Avoid eval() and similar functions
4. **Use HTTPS**: Always prefer HTTPS sources
5. **Regular audits**: Review and update CSP regularly
6. **Monitor violations**: Set up reporting and monitoring
7. **Test thoroughly**: Test in all browsers and scenarios

## Migration Guide

### From Basic Helmet

```typescript
// Before: Basic helmet
const app = createServer({
    security: {
        helmet: true
    }
});

// After: Custom CSP
const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'"]
                }
            }
        }
    }
});
```

### From Express CSP Middleware

```typescript
// Before: express-csp
app.use(csp({
    directives: {
        defaultSrc: "'self'",
        scriptSrc: ["'self'", "'unsafe-inline'"]
    }
}));

// After: XyPriss CSP
const app = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"]
                }
            }
        }
    }
});
```

This enhanced CSP configuration provides developers with complete control over their application's security policies while maintaining ease of use and flexibility.