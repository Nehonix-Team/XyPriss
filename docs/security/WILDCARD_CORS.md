# Wildcard CORS Support

XyPriss now supports wildcard patterns in CORS origin configurations, making it easier to handle multiple domains and ports during development and production.

## Overview

The wildcard CORS feature allows developers to specify flexible origin patterns instead of listing every possible URL. This is particularly useful for:

- **Development environments** with multiple ports
- **Microservices** running on different ports
- **Subdomain-based applications**
- **Dynamic port allocation** in containerized environments

## Supported Patterns

### Port Wildcards
- `localhost:*` - Matches any port on localhost
- `127.0.0.1:*` - Matches any port on 127.0.0.1
- `::1:*` - Matches any port on IPv6 localhost

### Subdomain Wildcards
- `*.example.com` - Matches any subdomain of example.com
- `*.api.myapp.com` - Matches any subdomain of api.myapp.com

## Usage Examples

### Basic Configuration

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        cors: {
            origin: [
                "localhost:*",        // Allow any localhost port
                "127.0.0.1:*",       // Allow any 127.0.0.1 port
                "*.myapp.com"        // Allow any subdomain
            ]
        }
    }
});
```

### Development vs Production

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const app = createServer({
    security: {
        cors: {
            origin: isDevelopment 
                ? [
                    "localhost:*",
                    "127.0.0.1:*",
                    "::1:*"
                  ]
                : [
                    "https://app.mycompany.com",
                    "https://admin.mycompany.com"
                  ]
        }
    }
});
```

### Mixed Patterns

```typescript
const app = createServer({
    security: {
        cors: {
            origin: [
                "localhost:*",              // Development
                "https://app.example.com",  // Exact production URL
                "*.staging.example.com"     // Staging subdomains
            ]
        }
    }
});
```

## Pattern Matching Rules

### URL Processing
- Full URLs are parsed to extract host:port
- Default ports are handled automatically (80 for HTTP, 443 for HTTPS)
- IPv6 addresses are properly processed (brackets removed for matching)

### Examples of Matches

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `localhost:*` | `http://localhost:3000`<br>`https://localhost:8080` | `http://example.com:3000` |
| `*.test.com` | `https://api.test.com`<br>`https://app.test.com` | `https://test.com`<br>`https://malicious.com` |
| `127.0.0.1:*` | `http://127.0.0.1:3000`<br>`https://127.0.0.1:8443` | `http://localhost:3000` |

## Advanced Configuration

### With Credentials and Methods

```typescript
const app = createServer({
    security: {
        cors: {
            origin: ["localhost:*", "*.myapp.com"],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE"],
            allowedHeaders: ["Content-Type", "Authorization"]
        }
    }
});
```

### Using Middleware API

```typescript
import { createServer } from "xypriss";

const app = createServer();

app.middleware({
    cors: {
        origin: ["localhost:*", "127.0.0.1:*"],
        credentials: true
    }
});
```

## Security Considerations

### Production Best Practices

1. **Be Specific**: Use exact domains in production when possible
2. **Avoid Overly Broad Patterns**: `*` allows all origins - use specific wildcards
3. **Validate Subdomains**: Ensure you control all subdomains when using `*.domain.com`

### Development vs Production

```typescript
// ✅ Good - Specific patterns
const corsConfig = {
    origin: process.env.NODE_ENV === 'production' 
        ? ["https://app.mycompany.com", "https://admin.mycompany.com"]
        : ["localhost:*", "127.0.0.1:*"]
};

// ❌ Avoid - Too permissive for production
const corsConfig = {
    origin: "*" // Allows ALL origins
};
```

## Implementation Details

### Automatic Detection
XyPriss automatically detects when wildcard patterns are used in the origin array and switches to custom pattern matching.

### Performance
- Pattern compilation is done once during server initialization
- Regex matching is optimized for common patterns
- No performance impact when wildcards aren't used

### Backward Compatibility
- Existing exact-match origins continue to work unchanged
- Mixed arrays (exact + wildcard) are fully supported
- Standard CORS options remain the same

## Testing

### Unit Tests
The wildcard functionality includes comprehensive tests covering:
- Port wildcard matching
- Subdomain wildcard matching  
- IPv6 address handling
- Default port handling
- Edge cases and error conditions

### Integration Testing

```typescript
// Test wildcard CORS in your application
describe('CORS Wildcard', () => {
    test('should allow localhost with any port', async () => {
        const response = await request(app)
            .options('/api/test')
            .set('Origin', 'http://localhost:3000')
            .expect(200);
            
        expect(response.headers['access-control-allow-origin'])
            .toBe('http://localhost:3000');
    });
});
```

## Migration Guide

### From Exact Origins

**Before:**
```typescript
cors: {
    origin: [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:8080"
    ]
}
```

**After:**
```typescript
cors: {
    origin: ["localhost:*"]
}
```

### From Permissive CORS

**Before:**
```typescript
cors: {
    origin: true  // Allows all origins
}
```

**After:**
```typescript
cors: {
    origin: [
        "localhost:*",
        "127.0.0.1:*", 
        "*.yourdomain.com"
    ]
}
```

## Troubleshooting

### Common Issues

1. **Pattern Not Matching**
   - Ensure the pattern syntax is correct
   - Check if the origin includes protocol (http/https)
   - Verify IPv6 addresses are properly formatted

2. **Still Getting CORS Errors**
   - Check browser developer tools for the exact origin being sent
   - Verify the pattern matches the origin format
   - Ensure credentials settings match your request

### Debug Mode

Enable debug logging to see CORS pattern matching:

```typescript
const app = createServer({
    logging: {
        level: 'debug'
    },
    security: {
        cors: {
            origin: ["localhost:*"]
        }
    }
});
```

## Changelog

### Version 2.3.4
- ✅ Added wildcard pattern support for CORS origins
- ✅ Support for port wildcards (`localhost:*`, `127.0.0.1:*`, `::1:*`)
- ✅ Support for subdomain wildcards (`*.example.com`)
- ✅ Automatic pattern detection and switching
- ✅ Comprehensive test coverage
- ✅ Full backward compatibility

## Related Documentation

- [Security Configuration](./SECURITY.md)
- [CORS Configuration](./CORS.md)
- [Development Setup](./DEVELOPMENT.md)
