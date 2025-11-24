---
title: Advanced CORS with RegExp Support
description: Powerful CORS configuration using regular expressions and mixed pattern arrays
---

# Advanced CORS with RegExp Support

XyPriss provides enterprise-grade CORS (Cross-Origin Resource Sharing) configuration with powerful pattern matching capabilities. Unlike traditional CORS implementations, XyPriss supports regular expressions, mixed arrays, and complex origin validation patterns.

## Overview

The advanced CORS system allows you to define origin patterns using:

- **Regular Expressions**: `/^https?:\/\/localhost:\d+$/` for localhost with any port
- **Wildcard Strings**: `"localhost:*"`, `"*.example.com"`
- **Exact Matches**: `"https://production.com"`
- **Mixed Arrays**: Combine all pattern types in a single configuration

## Quick Start

```typescript
import { createServer } from 'xypriss';

const server = createServer({
  security: {
    cors: {
      origin: [
        // RegExp patterns (powerful and flexible)
        /^localhost:\d+$/,           // localhost:3000, localhost:8080, etc.
        /^127\.0\.0\.1:\d+$/,        // 127.0.0.1:3000, etc.
        /^::1:\d+$/,                 // IPv6 localhost
        /\.test\.com$/,              // *.test.com

        // String patterns (backward compatibility)
        "localhost:*",               // Wildcard pattern
        "*.dev.example.com",         // Subdomain wildcard

        // Exact matches
        "https://production.com",
        "https://staging.example.com"
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
});

server.get('/api/data', (req, res) => {
  res.json({ message: 'CORS configured successfully!' });
});

server.start();
```

## Pattern Types

### Regular Expression Patterns

Use JavaScript RegExp objects for complex pattern matching:

```typescript
origin: [
  // Match localhost with any port
  /^https?:\/\/localhost:\d+$/,

  // Match any subdomain of example.com
  /^https?:\/\/.*\.example\.com$/,

  // Match specific IP ranges
  /^https?:\/\/192\.168\.1\.\d+:\d+$/,

  // Match development environments
  /^https?:\/\/.*\.(dev|staging|test)\.company\.com$/
]
```

### Wildcard String Patterns

Traditional wildcard patterns for simple matching:

```typescript
origin: [
  "localhost:*",           // Any port on localhost
  "*.example.com",         // Any subdomain
  "api.*.service.com",     // Complex wildcards
  "192.168.1.*:3000"       // IP ranges with ports
]
```

### Exact Match Patterns

For production environments where you want explicit control:

```typescript
origin: [
  "https://myapp.com",
  "https://api.myapp.com",
  "https://admin.myapp.com"
]
```

### Mixed Pattern Arrays

Combine all pattern types for maximum flexibility:

```typescript
origin: [
  // RegExp for development
  /^localhost:\d+$/,
  /^127\.0\.0\.1:\d+$/,

  // Wildcards for staging
  "*.staging.company.com",

  // Exact matches for production
  "https://production.company.com",
  "https://api.production.company.com"
]
```

## Configuration Options

```typescript
interface CORSConfig {
  /** Origin patterns (strings, RegExp, or mixed arrays) */
  origin?: string | string[] | RegExp | RegExp[];

  /** Allow credentials in CORS requests */
  credentials?: boolean;

  /** Allowed HTTP methods */
  methods?: string[];

  /** Allowed headers */
  allowedHeaders?: string[];

  /** Cache duration for preflight requests (in seconds) */
  maxAge?: number;

  /** Expose additional headers to client */
  exposedHeaders?: string[];

  /** Custom success status for OPTIONS requests */
  optionsSuccessStatus?: number;
}
```

## Advanced Examples

### Development Environment

```typescript
const server = createServer({
  security: {
    cors: {
      origin: [
        // Local development
        /^localhost:\d+$/,
        /^127\.0\.0\.1:\d+$/,
        /^0\.0\.0\.0:\d+$/,
        /^::1:\d+$/,  // IPv6

        // Development domains
        /\.dev\.company\.com$/,
        /\.staging\.company\.com$/,

        // Local testing tools
        /^https?:\/\/localhost:\d+$/,
        "http://localhost:3000",
        "http://localhost:8080"
      ],
      credentials: true
    }
  }
});
```

### Multi-Environment Configuration

```typescript
const corsOrigins = process.env.NODE_ENV === 'production'
  ? [
      "https://myapp.com",
      "https://api.myapp.com"
    ]
  : [
      /^localhost:\d+$/,
      /^127\.0\.0\.1:\d+$/,
      /\.dev\.myapp\.com$/,
      "https://staging.myapp.com"
    ];

const server = createServer({
  security: {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  }
});
```

### API Gateway Pattern

```typescript
const server = createServer({
  security: {
    cors: {
      origin: [
        // Allow all subdomains of trusted domains
        /^https?:\/\/.*\.trusted-domain\.com$/,

        // Specific API clients
        "https://client1.com",
        "https://client2.com",

        // Development environments
        /^localhost:\d+$/,

        // IP ranges for internal services
        /^https?:\/\/10\.0\.\d+\.\d+:\d+$/,
        /^https?:\/\/192\.168\.\d+\.\d+:\d+$/
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Request-ID'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ]
    }
  }
});
```

### Mobile App Support

```typescript
const server = createServer({
  security: {
    cors: {
      origin: [
        // Web origins
        /^https?:\/\/localhost:\d+$/,
        "https://myapp.com",

        // Mobile app origins (custom schemes)
        /^myapp:\/\//,
        /^com\.company\.myapp:\/\//,

        // Capacitor/Cordova origins
        /^http:\/\/localhost:\d+$/,  // iOS simulator
        /^https?:\/\/192\.168\.1\.\d+:\d+$/, // Android emulator
        /^https?:\/\/10\.0\.2\.2:\d+$/ // Android emulator alternative
      ],
      credentials: false, // Usually false for mobile apps
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
});
```

## Route-Specific CORS

Apply different CORS policies to different routes:

```typescript
const server = createServer({
  security: {
    cors: {
      // Default CORS for all routes
      origin: "https://myapp.com",
      credentials: true
    },
    routeConfig: {
      cors: {
        // Stricter CORS for admin routes
        includeRoutes: ['/admin/*'],
        config: {
          origin: [
            "https://admin.myapp.com",
            /^localhost:\d+$/  // Allow localhost for development
          ],
          credentials: true
        }
      }
    }
  }
});

// Public API with relaxed CORS
server.get('/api/public', (req, res) => {
  res.json({ message: 'Public API' });
});

// Admin API with strict CORS
server.get('/admin/users', (req, res) => {
  res.json({ users: [] });
});
```

## Security Considerations

### 1. RegExp Safety

```typescript
// ✅ Safe: Specific patterns
origin: [
  /^https?:\/\/localhost:\d+$/,      // Specific to localhost
  /^https?:\/\/.*\.trusted\.com$/    // Specific domain
]

// ❌ Dangerous: Overly permissive
origin: [
  /.*/,                              // Matches everything!
  /^https?:\/\/.*$/                  // Any HTTPS site
]
```

### 2. Credential Handling

```typescript
// ✅ Secure: Credentials only for specific origins
cors: {
  origin: [
    "https://myapp.com",     // Specific trusted origin
    /^localhost:\d+$/        // Development only
  ],
  credentials: true
}

// ❌ Insecure: Credentials for any origin
cors: {
  origin: "*",              // Any origin
  credentials: true         // Allows credentials to any site!
}
```

### 3. Header Validation

```typescript
// ✅ Restrictive headers
cors: {
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key'
  ]
}

// ❌ Permissive headers (security risk)
cors: {
  allowedHeaders: ['*']     // Allows any headers
}
```

## Performance Optimization

### Pattern Pre-compilation

RegExp patterns are pre-compiled for optimal performance:

```typescript
// Patterns are compiled once at startup
const patterns = [
  /^localhost:\d+$/,        // Compiled RegExp
  "*.example.com",          // Converted to RegExp internally
  "exact.com"              // Exact string match
];
```

### Early Termination

The validation stops at the first matching pattern:

```typescript
// Fast: Checks patterns in order until match found
for (const pattern of patterns) {
  if (matches(pattern, origin)) {
    return true;  // Exit early on first match
  }
}
```

## Troubleshooting

### Common Issues

1. **"Origin not allowed" errors**
   ```typescript
   // Check your pattern syntax
   origin: [
     /^https?:\/\/localhost:\d+$/,  // Missing ^ or $ anchors
     "localhost:*"                  // Correct wildcard syntax
   ]
   ```

2. **RegExp not matching**
   ```typescript
   // Debug with console.log
   const server = createServer({
     security: {
       cors: {
         origin: [
           (origin) => {
             console.log('Checking origin:', origin);
             return /^localhost:\d+$/.test(origin);
           }
         ]
       }
     }
   });
   ```

3. **Preflight request failures**
   ```typescript
   // Ensure OPTIONS method is allowed
   cors: {
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Include OPTIONS
     maxAge: 86400  // Cache preflight for 24 hours
   }
   ```

### Debug Mode

Enable detailed CORS logging:

```typescript
const server = createServer({
  logging: {
    level: 'debug',
    components: {
      security: true
    }
  },
  security: {
    cors: {
      origin: [
        /^localhost:\d+$/,
        "*.example.com"
      ]
    }
  }
});
```

This will log:
```
[CORS] Checking origin: http://localhost:3000
[CORS] Pattern /^localhost:\d+$/ matched
[CORS] Access granted
```

## Migration Guide

### From Express CORS

```typescript
// Express cors
const cors = require('cors');
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['http://localhost:3000', 'https://example.com'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// XyPriss equivalent
const server = createServer({
  security: {
    cors: {
      origin: [
        /^localhost:\d+$/,      // More flexible than exact matches
        "https://example.com"
      ]
    }
  }
});
```

### From String Arrays

```typescript
// Old approach
cors: {
  origin: ['http://localhost:3000', 'http://localhost:8080', '*.example.com']
}

// New approach with RegExp
cors: {
  origin: [
    /^localhost:\d+$/,        // Cleaner than listing every port
    /\.example\.com$/         // More precise than wildcards
  ]
}
```

## Browser Compatibility

### Modern Browsers (✅ Full Support)
- Chrome 98+
- Firefox 97+
- Safari 15.2+
- Edge 98+

### Legacy Browser Considerations

```typescript
// Fallback for older browsers
const server = createServer({
  security: {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? "https://myapp.com"    // Exact match for older browsers
        : /^localhost:\d+$/,     // RegExp for modern browsers
      credentials: true
    }
  }
});
```

## Integration Examples

### SPA with API

```typescript
// Frontend (React/Vue/Angular)
const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.myapp.com'
  : 'http://localhost:3001';

fetch(`${API_BASE}/api/data`, {
  credentials: 'include'  // Required for CORS with credentials
});

// Backend
const server = createServer({
  security: {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? "https://myapp.com"
        : /^localhost:\d+$/,
      credentials: true
    }
  }
});
```

### Microservices Architecture

```typescript
// API Gateway
const gateway = createServer({
  security: {
    cors: {
      origin: [
        "https://webapp.com",
        /^https?:\/\/.*\.internal\.company\.com$/
      ],
      credentials: true
    }
  }
});

// Individual services (trust API Gateway)
const userService = createServer({
  security: {
    cors: {
      origin: "https://api-gateway.company.com",
      credentials: true
    }
  }
});
```

### Third-Party Integration

```typescript
const server = createServer({
  security: {
    cors: {
      origin: [
        // Your own domains
        "https://myapp.com",
        /^localhost:\d+$/,

        // Third-party services
        "https://api.stripe.com",
        "https://www.paypal.com",

        // Webhook endpoints (if needed)
        /^https?:\/\/.*\.webhook\.service\.com$/
      ],
      credentials: false  // Usually false for third-party
    }
  }
});
```

Advanced CORS with RegExp support provides enterprise-grade origin validation while maintaining developer-friendly configuration. The mixed pattern approach allows you to use the right tool for each use case, from simple wildcards to complex regular expressions.