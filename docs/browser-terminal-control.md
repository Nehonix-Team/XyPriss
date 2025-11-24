---
title: Browser/Terminal Access Control
description: Control access based on request source - browser-only or terminal-only endpoints
---

# Browser/Terminal Access Control

XyPriss provides sophisticated access control middleware that can restrict endpoints to specific client types. This allows you to create browser-only APIs, terminal-only endpoints, or mixed configurations based on how requests are made.

## Overview

Two specialized middleware components allow you to control access based on the request source:

- **BrowserOnly**: Blocks requests from non-browser clients (cURL, Postman, scripts, etc.)
- **TerminalOnly**: Blocks requests from browsers, allowing only terminal-based clients

## Browser-Only Middleware

### Use Cases

- **Web Application APIs**: Ensure only your frontend can access certain endpoints
- **CSRF Protection**: Complement existing CSRF protection
- **User Session Validation**: Require browser session cookies
- **Analytics Endpoints**: Prevent automated access to analytics data

### Quick Start

```typescript
import { createServer } from 'xypriss';

const server = createServer({
  security: {
    browserOnly: true  // Enable globally
  }
});

// This endpoint only accepts browser requests
server.get('/api/user/profile', (req, res) => {
  res.json({
    message: 'Profile data for browser users only',
    userAgent: req.headers['user-agent']
  });
});

server.start();
```

### Configuration Options

```typescript
interface BrowserOnlyConfig {
  /** Enable browser-only access control */
  enabled?: boolean;

  /** Custom error message */
  message?: string;

  /** HTTP status code for blocked requests */
  statusCode?: number;

  /** Additional user agent patterns to allow */
  allowedUserAgents?: RegExp[];

  /** User agent patterns to block */
  blockedUserAgents?: RegExp[];

  /** Require specific headers that browsers typically send */
  requireHeaders?: string[];

  /** Allow requests missing typical browser headers */
  allowMissingHeaders?: boolean;

  /** Custom validation function */
  customValidator?: (req: Request) => boolean;
}
```

### Advanced Configuration

```typescript
const server = createServer({
  security: {
    browserOnly: {
      enabled: true,
      message: 'This endpoint requires a web browser',
      statusCode: 403,
      allowedUserAgents: [
        /CustomBrowser\/\d+\.\d+/  // Allow custom browser
      ],
      blockedUserAgents: [
        /Bot\/\d+\.\d+/,           // Block bots
        /Crawler\/\d+\.\d+/        // Block crawlers
      ],
      requireHeaders: [
        'accept',
        'accept-language',
        'cache-control'
      ],
      customValidator: (req) => {
        // Custom validation logic
        return req.headers['x-custom-header'] === 'expected-value';
      }
    }
  }
});
```

## Terminal-Only Middleware

### Use Cases

- **API Endpoints**: Expose APIs only for programmatic access
- **CLI Tools**: Create endpoints specifically for command-line tools
- **Internal APIs**: Restrict access to server-to-server communication
- **Admin Operations**: Allow only terminal-based admin access

### Quick Start

```typescript
const server = createServer({
  security: {
    terminalOnly: true  // Enable globally
  }
});

// This endpoint only accepts terminal requests (cURL, scripts, etc.)
server.post('/api/admin/reset-database', (req, res) => {
  // Dangerous operation - only allow from terminal
  res.json({ message: 'Database reset complete' });
});
```

### Configuration Options

```typescript
interface TerminalOnlyConfig {
  /** Enable terminal-only access control */
  enabled?: boolean;

  /** Custom error message */
  message?: string;

  /** HTTP status code for blocked requests */
  statusCode?: number;

  /** Allowed user agent patterns */
  allowedUserAgents?: RegExp[];

  /** Blocked user agent patterns */
  blockedUserAgents?: RegExp[];

  /** Require absence of browser-specific headers */
  blockBrowserHeaders?: string[];

  /** Allow requests with browser-like headers */
  allowBrowserHeaders?: boolean;

  /** Custom validation function */
  customValidator?: (req: Request) => boolean;
}
```

### Advanced Configuration

```typescript
const server = createServer({
  security: {
    terminalOnly: {
      enabled: true,
      message: 'This endpoint is for terminal access only',
      statusCode: 403,
      allowedUserAgents: [
        /curl\/\d+\.\d+/,          // Allow cURL
        /HTTPie\/\d+\.\d+/,        // Allow HTTPie
        /PostmanRuntime\/\d+\.\d+/, // Allow Postman
        /MyCLITool\/\d+\.\d+/     // Allow custom CLI tool
      ],
      blockedUserAgents: [
        /Mozilla\/\d+\.\d+/,       // Block browsers
        /Chrome\/\d+\.\d+/,        // Block Chrome
        /Safari\/\d+\.\d+/         // Block Safari
      ],
      blockBrowserHeaders: [
        'referer',
        'sec-fetch-mode',
        'sec-fetch-site'
      ],
      customValidator: (req) => {
        // Custom validation - check for API key
        return req.headers['x-api-key'] === process.env.API_KEY;
      }
    }
  }
});
```

## Detection Logic

### Browser Detection

The BrowserOnly middleware identifies browsers by:

1. **User Agent Analysis**
   ```typescript
   // Common browser patterns
   const browserPatterns = [
     /Mozilla\/\d+\.\d+/,
     /Chrome\/\d+\.\d+/,
     /Safari\/\d+\.\d+/,
     /Firefox\/\d+\.\d+/,
     /Edge\/\d+\.\d+/
   ];
   ```

2. **Browser-Specific Headers**
   ```typescript
   // Headers that browsers typically send
   const browserHeaders = [
     'accept',
     'accept-language',
     'accept-encoding',
     'cache-control',
     'pragma',
     'sec-fetch-mode',
     'sec-fetch-site',
     'sec-fetch-user',
     'sec-fetch-dest',
     'sec-ch-ua',
     'sec-ch-ua-mobile',
     'sec-ch-ua-platform'
   ];
   ```

3. **Request Characteristics**
   - Presence of cookies
   - Referer header
   - DNT (Do Not Track) header
   - Upgrade-Insecure-Requests header

### Terminal Detection

The TerminalOnly middleware identifies terminal clients by:

1. **User Agent Analysis**
   ```typescript
   // Common terminal tool patterns
   const terminalPatterns = [
     /curl\/\d+\.\d+/,
     /wget\/\d+\.\d+/,
     /HTTPie\/\d+\.\d+/,
     /PostmanRuntime\/\d+\.\d+/,
     /python-requests\/\d+\.\d+/,
     /axios\/\d+\.\d+/,
     /node-fetch\/\d+\.\d+/
   ];
   ```

2. **Absence of Browser Headers**
   - No `sec-fetch-*` headers
   - No `sec-ch-ua*` headers
   - No browser-specific user agent

3. **Request Characteristics**
   - Simple Accept header (`*/*` or `application/json`)
   - Presence of custom API headers
   - No cookies (typically)

## Route-Specific Configuration

Apply access control to specific routes:

```typescript
const server = createServer({
  security: {
    browserOnly: false,   // Disabled globally
    terminalOnly: false   // Disabled globally
  }
});

// Browser-only route
server.get('/app/dashboard', (req, res) => {
  // Only accessible from browsers
  res.json({ dashboard: 'data' });
});

// Terminal-only route
server.post('/api/admin/backup', (req, res) => {
  // Only accessible from terminals
  res.json({ backup: 'started' });
});

// Mixed access route
server.get('/api/public', (req, res) => {
  // Accessible from both browsers and terminals
  res.json({ public: 'data' });
});
```

## Integration with Other Security

### Combined with Request Signatures

```typescript
const server = createServer({
  security: {
    // Browser endpoints require session validation
    browserOnly: {
      enabled: true,
      requireHeaders: ['cookie', 'authorization']
    },

    // API endpoints require signature authentication
    terminalOnly: {
      enabled: true,
      customValidator: (req) => {
        return req.headers['x-api-signature'] !== undefined;
      }
    },

    // Request signature for additional security
    requestSignature: {
      secret: 'api-secret-key'
    }
  }
});
```

### Combined with CORS

```typescript
const server = createServer({
  security: {
    cors: {
      origin: [
        "https://myapp.com",     // Allow browser access
        /^localhost:\d+$/        // Allow development
      ],
      credentials: true
    },

    // Additional browser validation
    browserOnly: {
      enabled: true,
      requireHeaders: ['sec-fetch-site']
    }
  }
});
```

## Practical Examples

### Web Application with API

```typescript
const server = createServer({
  security: {
    // Web app routes - browser only
    browserOnly: {
      enabled: true,
      customValidator: (req) => {
        // Check for session cookie
        return req.headers.cookie?.includes('session_id');
      }
    }
  }
});

// Web app routes
server.get('/app/*', (req, res) => {
  res.sendFile('index.html'); // Serve SPA
});

server.get('/api/user/profile', (req, res) => {
  // Browser-only API
  res.json({ profile: getUserProfile(req) });
});

// Public API routes (override browser-only)
server.get('/api/public/stats', (req, res) => {
  // Allow both browser and terminal access
  res.json({ stats: getPublicStats() });
});
```

### CLI Tool API

```typescript
const server = createServer({
  security: {
    // CLI tool routes - terminal only
    terminalOnly: {
      enabled: true,
      allowedUserAgents: [
        /my-cli-tool\/\d+\.\d+/,
        /curl\/\d+\.\d+/
      ]
    }
  }
});

// CLI-only endpoints
server.post('/cli/deploy', (req, res) => {
  // Only accessible from CLI tool
  const result = deployApplication(req.body);
  res.json({ deployment: result });
});

server.get('/cli/status', (req, res) => {
  // Check deployment status
  res.json({ status: getDeploymentStatus() });
});
```

### Admin Panel

```typescript
const server = createServer({
  security: {
    browserOnly: {
      // Admin panel - browser only with additional checks
      enabled: true,
      customValidator: (req) => {
        const cookies = parseCookies(req.headers.cookie || '');
        return cookies.admin_session && cookies.authenticated === 'true';
      }
    },

    terminalOnly: {
      // Admin CLI - terminal only
      enabled: true,
      customValidator: (req) => {
        return req.headers['x-admin-token'] === process.env.ADMIN_TOKEN;
      }
    }
  }
});

// Admin web interface
server.get('/admin/*', (req, res) => {
  res.sendFile('admin.html');
});

// Admin API (browser)
server.get('/admin/api/users', (req, res) => {
  res.json({ users: getAllUsers() });
});

// Admin CLI commands (terminal)
server.post('/admin/cli/reset-passwords', (req, res) => {
  resetAllPasswords();
  res.json({ message: 'All passwords reset' });
});
```

## Security Considerations

### 1. User Agent Spoofing

```typescript
// User agents can be spoofed - don't rely solely on them
const server = createServer({
  security: {
    browserOnly: {
      enabled: true,
      // Use multiple validation methods
      requireHeaders: ['sec-fetch-site', 'sec-fetch-mode'],
      customValidator: (req) => {
        // Check for browser-specific behavior
        return hasBrowserCharacteristics(req);
      }
    }
  }
});
```

### 2. Header Manipulation

```typescript
// Headers can be forged - use multiple signals
const server = createServer({
  security: {
    terminalOnly: {
      enabled: true,
      // Combine multiple checks
      allowedUserAgents: [/curl\/\d+\.\d+/],
      blockBrowserHeaders: ['sec-fetch-mode'],
      customValidator: (req) => {
        // Additional validation
        return req.headers['x-cli-version'] !== undefined;
      }
    }
  }
});
```

### 3. False Positives

```typescript
// Some legitimate clients may be misidentified
const server = createServer({
  security: {
    browserOnly: {
      enabled: true,
      allowMissingHeaders: true, // Be more permissive
      blockedUserAgents: [
        /Bot\/\d+\.\d+/,     // Only block obvious bots
        /Crawler\/\d+\.\d+/
      ]
    }
  }
});
```

## Performance Impact

- **Minimal overhead**: Simple header and user agent checks
- **Fast validation**: Regex patterns are pre-compiled
- **Early termination**: Fails fast on invalid requests
- **Memory efficient**: No external dependencies

## Troubleshooting

### Common Issues

1. **"Access denied" for legitimate browsers**
   ```typescript
   // Check your validation logic
   browserOnly: {
     enabled: true,
     allowMissingHeaders: true, // More permissive
     blockedUserAgents: []      // Don't block any user agents
   }
   ```

2. **CLI tools blocked unexpectedly**
   ```typescript
   // Add your CLI tool to allowed list
   terminalOnly: {
     enabled: true,
     allowedUserAgents: [
       /MyCLITool\/\d+\.\d+/,
       /curl\/\d+\.\d+/
     ]
   }
   ```

3. **Mobile browsers misidentified**
   ```typescript
   // Mobile browsers have different characteristics
   browserOnly: {
     enabled: true,
     requireHeaders: [], // Don't require desktop-specific headers
     customValidator: (req) => {
       const ua = req.headers['user-agent'] || '';
       return /Mobile|Android|iPhone|iPad/.test(ua) ||
              req.headers['sec-ch-ua-mobile'] === '?1';
     }
   }
   ```

### Debug Mode

Enable detailed logging:

```typescript
const server = createServer({
  logging: {
    level: 'debug',
    components: {
      security: true
    }
  },
  security: {
    browserOnly: {
      enabled: true,
      debug: true  // Enable debug logging
    }
  }
});
```

This will log:
```
[BROWSER_CHECK] User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
[BROWSER_CHECK] Headers present: accept, accept-language, sec-fetch-mode
[BROWSER_CHECK] Validation passed: true
```

## Migration Guide

### From Custom Middleware

```typescript
// Old approach
server.use('/api/web', (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (!ua.includes('Mozilla')) {
    return res.status(403).json({ error: 'Browser required' });
  }
  next();
});

// New approach
const server = createServer({
  security: {
    browserOnly: true
  }
});
```

### From IP-Based Restrictions

```typescript
// Old approach (less reliable)
server.use('/admin', (req, res, next) => {
  const clientIP = req.ip;
  if (!adminIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

// New approach (more reliable)
const server = createServer({
  security: {
    browserOnly: {
      enabled: true,
      customValidator: (req) => {
        // Combine IP check with browser validation
        const clientIP = req.ip;
        return adminIPs.includes(clientIP) && isBrowser(req);
      }
    }
  }
});
```

## Browser Compatibility

### Supported Browsers
- ✅ Chrome 77+ (sends `sec-fetch-*` headers)
- ✅ Firefox 68+ (sends `sec-fetch-*` headers)
- ✅ Safari 12.1+ (sends `sec-fetch-*` headers)
- ✅ Edge 79+ (Chromium-based)

### Legacy Browser Support

```typescript
// Fallback for older browsers
const server = createServer({
  security: {
    browserOnly: {
      enabled: true,
      requireHeaders: [], // Don't require modern headers
      customValidator: (req) => {
        const ua = req.headers['user-agent'] || '';
        // Fallback to user agent checking
        return /Mozilla|Chrome|Safari|Firefox|Edge/.test(ua);
      }
    }
  }
});
```

## Integration Examples

### SPA with API Separation

```typescript
// Frontend routes - browser only
server.get('/app/*', (req, res) => {
  res.sendFile('index.html');
});

// API routes - mixed access
server.get('/api/public', (req, res) => {
  // Allow both browsers and terminals
  res.json({ data: 'public' });
});

// Admin routes - browser only with session validation
server.get('/admin/*', (req, res) => {
  // Additional session validation
  res.sendFile('admin.html');
});
```

### Microservices Communication

```typescript
// Service A (web app) - browser only
const webApp = createServer({
  security: { browserOnly: true }
});

// Service B (API) - terminal only (server-to-server)
const apiService = createServer({
  security: { terminalOnly: true }
});

// Service C (CLI) - terminal only
const cliService = createServer({
  security: { terminalOnly: true }
});
```

Browser/Terminal access control provides fine-grained control over who can access your endpoints. By distinguishing between browser-based users and programmatic clients, you can create more secure and appropriate APIs for different use cases.