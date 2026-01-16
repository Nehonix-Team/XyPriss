# Trust Proxy Configuration

XyPriss provides advanced trust proxy functionality that goes beyond standard Express.js capabilities, offering robust support for modern deployment scenarios including containers, load balancers, and cloud environments.

## Overview

Trust proxy configuration determines how XyPriss handles `X-Forwarded-*` headers from reverse proxies. This is crucial for:

- **Correct client IP detection** behind load balancers
- **Protocol detection** (HTTP vs HTTPS) through proxies  
- **Hostname resolution** in multi-domain setups
- **Security** by preventing IP spoofing

## Supported Configuration Types

### Boolean Values

```typescript
// Trust all proxies (⚠️ Use with caution in production)
trustProxy: true

// Don't trust any proxies (default)
trustProxy: false
```

### Predefined Network Ranges

XyPriss includes predefined ranges for common deployment scenarios:

```typescript
// Trust localhost and loopback addresses
trustProxy: 'loopback'        // 127.0.0.0/8, ::1/128

// Trust link-local addresses  
trustProxy: 'linklocal'       // 169.254.0.0/16, fe80::/10

// Trust private network ranges
trustProxy: 'uniquelocal'     // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7
```

### CIDR Notation

```typescript
// IPv4 CIDR ranges
trustProxy: '192.168.0.0/16'  // Trust entire 192.168.x.x network
trustProxy: '10.0.0.0/8'      // Trust entire 10.x.x.x network
trustProxy: '172.16.0.0/12'   // Trust 172.16-31.x.x range

// IPv6 CIDR ranges
trustProxy: 'fc00::/7'        // Trust IPv6 unique local addresses
trustProxy: 'fe80::/10'       // Trust IPv6 link-local addresses
```

### Exact IP Addresses

```typescript
// IPv4 addresses
trustProxy: '127.0.0.1'
trustProxy: '203.0.113.10'

// IPv6 addresses  
trustProxy: '::1'
trustProxy: '2001:db8::1'
```

### Array Configurations

Mix and match different configuration types:

```typescript
trustProxy: [
    'loopback',           // Predefined range
    'uniquelocal',        // Another predefined range
    '203.0.113.0/24',     // CIDR notation
    '198.51.100.42'       // Exact IP
]
```

### Numeric Values

Trust the first N hops in the proxy chain:

```typescript
trustProxy: 1  // Trust only the first proxy
trustProxy: 2  // Trust the first 2 proxies in chain
```

### Custom Functions

For advanced scenarios, provide a custom validation function:

```typescript
trustProxy: (ip: string, hopIndex: number) => {
    // Custom logic for determining trust
    if (hopIndex === 0 && ip.startsWith('10.')) {
        return true; // Trust first hop if it's from 10.x.x.x
    }
    return ip === '127.0.0.1'; // Always trust localhost
}
```

## Configuration Examples

### Development Environment

```typescript
const app = createServer({
    server: {
        trustProxy: ['loopback', 'uniquelocal']
    }
});
```

### Production with Load Balancer

```typescript
const app = createServer({
    server: {
        trustProxy: [
            '203.0.113.10',    // Load balancer IP
            '203.0.113.11',    // Backup load balancer
            'loopback'         // Allow local testing
        ]
    }
});
```

### Kubernetes/Container Environment

```typescript
const app = createServer({
    server: {
        trustProxy: [
            '10.244.0.0/16',   // Pod network
            '10.96.0.0/12',    // Service network
            'loopback'
        ]
    }
});
```

### Cloud Deployment (AWS/GCP/Azure)

```typescript
const app = createServer({
    server: {
        trustProxy: [
            '10.0.0.0/8',      // VPC private network
            '172.16.0.0/12',   // Additional private ranges
            'loopback'
        ]
    }
});
```

### Multi-Environment Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const app = createServer({
    server: {
        trustProxy: isDevelopment 
            ? ['loopback', 'uniquelocal']
            : isProduction
                ? ['203.0.113.0/24', 'loopback']
                : ['linklocal', 'uniquelocal']
    }
});
```

## Security Considerations

### ⚠️ Important Security Notes

1. **Only trust proxies you control** - Trusting untrusted proxies allows IP spoofing
2. **Be specific in production** - Avoid overly broad configurations like `trustProxy: true`
3. **Validate your configuration** - Test with your actual proxy setup
4. **Monitor for anomalies** - Watch for unexpected client IPs

### Best Practices

```typescript
// ✅ Good - Specific and secure
trustProxy: ['203.0.113.10', '203.0.113.11']

// ✅ Good - Using predefined ranges appropriately  
trustProxy: ['loopback', 'uniquelocal'] // For development

// ⚠️ Caution - Very permissive
trustProxy: true

// ❌ Avoid - Trusting unknown networks
trustProxy: '0.0.0.0/0' // Trusts everyone!
```

## How It Works

### Request Processing Flow

1. **Direct Connection**: If no `X-Forwarded-For` header, use socket remote address
2. **Proxy Chain Analysis**: Parse comma-separated IPs from right to left
3. **Trust Validation**: Check each hop against trust configuration
4. **Client IP Extraction**: Return the leftmost trusted IP

### Example Proxy Chain

```
Client (192.0.2.100) → Proxy1 (203.0.113.10) → Proxy2 (10.0.0.5) → Your App

X-Forwarded-For: 192.0.2.100, 203.0.113.10
```

With `trustProxy: ['loopback', '10.0.0.0/8', '203.0.113.10']`:
- Trust 10.0.0.5 (matches 10.0.0.0/8) ✅
- Trust 203.0.113.10 (exact match) ✅  
- Client IP detected: 192.0.2.100 ✅

## Advanced Features

### IPv6 Support

Full IPv6 support with proper address expansion and CIDR matching:

```typescript
trustProxy: [
    '::1',              // IPv6 loopback
    'fe80::/10',        // Link-local
    '2001:db8::/32'     // Custom IPv6 range
]
```

### Error Handling

Robust error handling with safe fallbacks:

- Invalid IP addresses are ignored
- Malformed CIDR ranges default to no match
- Function errors default to untrusted

### Performance Optimizations

- CIDR calculations cached for repeated patterns
- IPv6 address expansion optimized
- Minimal overhead for simple configurations

## Troubleshooting

### Common Issues

1. **Still getting wrong client IP**
   - Check if your proxy is sending `X-Forwarded-For` headers
   - Verify proxy IP is in your trust configuration
   - Use debug logging to see what headers are received

2. **HTTPS not detected**
   - Ensure proxy sends `X-Forwarded-Proto: https`
   - Verify proxy IP is trusted
   - Check if proxy is configured correctly

3. **Configuration not working**
   - Validate CIDR notation syntax
   - Check for typos in IP addresses
   - Test with simple boolean first

### Debug Configuration

Enable debug logging to troubleshoot:

```typescript
const app = createServer({
    logging: {
        level: 'debug'
    },
    server: {
        trustProxy: ['your-config-here']
    }
});
```

### Testing Your Configuration

Use the included test utilities:

```bash
# Test basic functionality
node .private/test-proxy.cjs

# Test predefined ranges
node .private/test-trust-proxy-ranges.cjs

# Diagnose production issues
node .private/diagnose-proxy.cjs
```

## Migration from Express

XyPriss trust proxy is fully compatible with Express.js configurations:

```typescript
// Express configuration
app.set('trust proxy', ['loopback', 'linklocal']);

// XyPriss equivalent
const app = createServer({
    server: {
        trustProxy: ['loopback', 'linklocal']
    }
});

// Or using the method
app.setTrustProxy(['loopback', 'linklocal']);
```

## API Reference

### Configuration Methods

```typescript
// Via server options
createServer({
    server: { trustProxy: config }
});

// Via app method
app.setTrustProxy(config);

// Via app settings (Express compatibility)
app.set('trust proxy', config);
```

### Request Properties

When trust proxy is configured, these properties are available:

```typescript
app.get('/info', (req, res) => {
    res.json({
        ip: req.ip,           // Client IP address
        ips: req.ips,         // Full proxy chain
        protocol: req.protocol, // 'http' or 'https'
        secure: req.secure,   // true if HTTPS
        hostname: req.hostname // Request hostname
    });
});
```

## Version History

- **v2.3.4**: Added advanced trust proxy with predefined ranges and IPv6 support
- **v2.3.3**: Basic trust proxy functionality
- **v2.3.0**: Initial release
