# Route-Based Security Configuration

## Overview

XyPriss now supports **route-based security configuration**, allowing developers to selectively apply security modules to specific routes. This feature addresses the issue where legitimate data (like URLs in template content) was being incorrectly flagged as security threats.
<<<<<<< HEAD
> Fixed version: ^2.3.2 
=======
> Fix version: ^2.3.2 
>>>>>>> 0a3c811 (feat: add route-based security configuration)
## Problem Statement

Previously, XyPriss security modules (like Path Traversal detection) were applied globally to all routes. This caused false positives where safe data containing URL patterns (e.g., `/signup`, `#demo`) in template or content routes were blocked as potential security threats.

## Solution

The new `routeConfig` option in `SecurityConfig` allows you to:
- **Exclude specific routes** from security modules (blacklist approach)
- **Include only specific routes** for security modules (whitelist approach)
- Apply different security rules to different parts of your application

## Configuration

### Basic Example

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        enabled: true,
        pathTraversal: true,
        sqlInjection: true,
        
        // Route-based configuration
        routeConfig: {
            pathTraversal: {
                // Exclude template and content routes from path traversal detection
                excludeRoutes: [
                    "/api/templates/*",
                    "/api/content/*",
                    "/api/security/*"
                ]
            },
            sqlInjection: {
                // Only apply SQL injection detection to database routes
                includeRoutes: [
                    "/api/db/*",
                    "/api/query/*"
                ]
            }
        }
    }
});
```

### Route Pattern Formats

You can specify routes in three formats:

#### 1. String with Wildcards
```typescript
excludeRoutes: [
    "/api/templates/*",      // Matches /api/templates/anything
    "/api/content/*",        // Matches /api/content/anything
    "/exact/path"            // Exact match only
]
```

#### 2. Regular Expressions
```typescript
excludeRoutes: [
    /^\/api\/templates\/.+$/,
    /^\/api\/content\/.+$/
]
```

#### 3. RoutePattern Objects (with HTTP method filtering)
```typescript
excludeRoutes: [
    {
        path: "/api/templates/*",
        methods: ["POST", "PUT"]  // Only exclude for POST and PUT requests
    },
    {
        path: "/api/content/*",
        methods: ["POST"]         // Only exclude for POST requests
    }
]
```

## Available Security Modules

You can configure route-based rules for the following security modules:

- `xss` - Cross-Site Scripting protection
- `sqlInjection` - SQL Injection detection
- `pathTraversal` - Path Traversal detection
- `commandInjection` - Command Injection detection
- `xxe` - XML External Entity protection
- `ldapInjection` - LDAP Injection detection

## Use Cases

### 1. Template/Content Routes

Exclude routes that handle template data or user content that may contain legitimate URLs:

```typescript
routeConfig: {
    pathTraversal: {
        excludeRoutes: [
            "/api/templates/*",
            "/api/pages/*",
            "/api/content/*"
        ]
    }
}
```

### 2. Database Routes Only

Apply SQL injection detection only to routes that interact with databases:

```typescript
routeConfig: {
    sqlInjection: {
        includeRoutes: [
            "/api/db/*",
            "/api/query/*",
            "/api/search/*"
        ]
    }
}
```

### 3. Mixed Approach

Combine different strategies for different security modules:

```typescript
routeConfig: {
    pathTraversal: {
        excludeRoutes: ["/api/templates/*", "/api/content/*"]
    },
    sqlInjection: {
        includeRoutes: ["/api/db/*"]
    },
    xss: {
        excludeRoutes: ["/api/trusted/*"]
    }
}
```

### 4. Method-Specific Rules

Apply security rules only for specific HTTP methods:

```typescript
routeConfig: {
    pathTraversal: {
        excludeRoutes: [
            {
                path: "/api/templates/*",
                methods: ["POST", "PUT", "PATCH"]  // Only exclude for write operations
            }
        ]
    }
}
```

## How It Works

### Exclude Routes (Blacklist)

When you specify `excludeRoutes`:
1. Security module applies to **all routes by default**
2. Routes matching the exclude patterns are **skipped**
3. All other routes are protected

```typescript
pathTraversal: {
    excludeRoutes: ["/api/templates/*"]
}
// Result: Path traversal detection applies everywhere EXCEPT /api/templates/*
```

### Include Routes (Whitelist)

When you specify `includeRoutes`:
1. Security module applies **only to matching routes**
2. All other routes are **skipped**
3. More restrictive than excludeRoutes

```typescript
sqlInjection: {
    includeRoutes: ["/api/db/*"]
}
// Result: SQL injection detection applies ONLY to /api/db/*
```

### Priority

If both `includeRoutes` and `excludeRoutes` are specified:
- `includeRoutes` takes priority
- `excludeRoutes` is ignored

## Migration Guide

### Before (Global Security)

```typescript
const app = createServer({
    security: {
        enabled: true,
        pathTraversal: true,
        sqlInjection: true
    }
});
// Problem: All routes protected, causing false positives
```

### After (Route-Based Security)

```typescript
const app = createServer({
    security: {
        enabled: true,
        pathTraversal: true,
        sqlInjection: true,
        
        routeConfig: {
            pathTraversal: {
                excludeRoutes: ["/api/templates/*", "/api/content/*"]
            }
        }
    }
});
// Solution: Template routes excluded from path traversal detection
```

## Best Practices

1. **Be Specific**: Use specific route patterns to minimize security gaps
   ```typescript
   // Good
   excludeRoutes: ["/api/templates/create", "/api/templates/update"]
   
   // Less secure
   excludeRoutes: ["/api/*"]
   ```

2. **Use Whitelist When Possible**: For sensitive modules like SQL injection, use `includeRoutes`
   ```typescript
   sqlInjection: {
       includeRoutes: ["/api/db/*", "/api/query/*"]
   }
   ```

3. **Document Your Exclusions**: Add comments explaining why routes are excluded
   ```typescript
   routeConfig: {
       pathTraversal: {
           // Template data contains legitimate URLs like /signup, #demo
           excludeRoutes: ["/api/templates/*"]
       }
   }
   ```

4. **Test Thoroughly**: Verify that excluded routes still handle malicious input safely through other means

5. **Regular Review**: Periodically review your route configurations to ensure they're still appropriate

## Performance Considerations

- Route matching is performed using optimized regex patterns
- Minimal performance impact (< 1ms per request)
- Patterns are compiled once during initialization

## Troubleshooting

### Issue: Security module still blocking excluded route

**Check:**
1. Route pattern matches the actual request path
2. HTTP method is included (if using RoutePattern objects)
3. Configuration is properly nested under `security.routeConfig`

**Debug:**
```typescript
// Add logging to verify route matching
console.log('Request path:', req.path);
console.log('Request method:', req.method);
```

### Issue: Security not applied to included routes

**Check:**
1. `includeRoutes` patterns are correct
2. No typos in route paths
3. Security module is enabled globally

## Example: Complete Configuration

```typescript
import { createServer } from "xypriss";

const app = createServer({
    server: {
        port: 3000,
        host: "localhost"
    },
    
    security: {
        enabled: true,
        level: "enhanced",
        
        // Enable security modules
        xss: true,
        sqlInjection: true,
        pathTraversal: true,
        commandInjection: true,
        
        // Configure route-based security
        routeConfig: {
            // Exclude template routes from path traversal
            pathTraversal: {
                excludeRoutes: [
                    "/api/templates/*",
                    "/api/content/*",
                    "/api/pages/*"
                ]
            },
            
            // Only check SQL injection on database routes
            sqlInjection: {
                includeRoutes: [
                    "/api/db/*",
                    "/api/query/*",
                    "/api/search/*"
                ]
            },
            
            // Exclude trusted content from XSS
            xss: {
                excludeRoutes: [
                    {
                        path: "/api/admin/content/*",
                        methods: ["POST", "PUT"]
                    }
                ]
            }
        }
    }
});

app.start();
```

## Changelog

### Version 4.5.12+
- Added `routeConfig` option to `SecurityConfig`
- Added `SecurityModuleRouteConfig` interface
- Added `RoutePattern` interface for method-specific rules
- Implemented route matching logic in `SecurityMiddleware`
- Added support for wildcards, regex, and exact path matching

## Support

For issues or questions about route-based security configuration:
- GitHub Issues: [XyPriss Issues](https://github.com/Nehonix-Team/XyPriss/issues)
- Documentation: [XyPriss Docs](https://xypriss.dev/docs)
