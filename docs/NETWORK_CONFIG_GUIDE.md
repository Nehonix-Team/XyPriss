# Network Configuration Guide

## Overview

The `network` configuration in XyPriss provides a comprehensive plugin-based system for advanced networking capabilities. It includes four main plugins: **Connection Management**, **Compression**, **Rate Limiting**, and **Reverse Proxy**.

## Table of Contents

1. [Connection Plugin](#connection-plugin)
2. [Compression Plugin](#compression-plugin)
3. [Rate Limiting Plugin](#rate-limiting-plugin)
4. [Proxy Plugin](#proxy-plugin)
5. [Complete Configuration Example](#complete-configuration-example)

---

## Connection Plugin

The Connection Plugin handles HTTP/2 server push, keep-alive connections, and connection pooling with intelligent resource detection and proper cache control.

### Configuration Options

```typescript
network: {
  connection: {
    enabled: boolean;           // Enable/disable the connection plugin

    http2: {
      enabled: boolean;         // Enable HTTP/2 support
      maxConcurrentStreams: number;  // Max concurrent streams per connection (default: 100)
      initialWindowSize: number;     // Initial window size for flow control (default: 65536)
      serverPush: boolean;           // Enable HTTP/2 server push (default: true)
    },

    keepAlive: {
      enabled: boolean;         // Enable keep-alive connections (default: true)
      timeout: number;          // Keep-alive timeout in ms (default: 30000)
      maxRequests: number;      // Max requests per connection (default: 100)
    },

    connectionPool: {
      maxConnections: number;   // Maximum number of connections (default: 1000)
      timeout: number;          // Connection timeout in ms (default: 5000)
      idleTimeout: number;      // Idle timeout in ms (default: 60000)
    }
  }
}
```

### Example

```typescript
import { createServer } from "xypriss";

const app = createServer({
    network: {
        connection: {
            enabled: true,
            http2: {
                enabled: true,
                maxConcurrentStreams: 200,
                serverPush: true,
            },
            keepAlive: {
                enabled: true,
                timeout: 60000, // 60 seconds
                maxRequests: 200,
            },
            connectionPool: {
                maxConnections: 2000,
                timeout: 10000,
                idleTimeout: 120000,
            },
        },
    },
});
```

### Use Cases

- **High-traffic applications**: Optimize connection reuse with keep-alive
- **Modern web apps**: Enable HTTP/2 for better performance
- **API servers**: Manage connection pools efficiently

---

## Compression Plugin

The Compression Plugin provides intelligent response compression with multiple algorithms, threshold detection, and content-type filtering.

### Configuration Options

```typescript
network: {
  compression: {
    enabled: boolean;                    // Enable/disable compression
    algorithms: ("gzip" | "deflate" | "br")[];  // Supported algorithms
    level: number;                       // Compression level 1-9 (higher = better compression, slower)
    threshold: number;                   // Min response size to compress (bytes)
    contentTypes: string[];              // Content types to compress
    memLevel: number;                    // Memory level for compression (1-9)
    windowBits: number;                  // Window size for compression
  }
}
```

### Example

```typescript
const app = createServer({
    network: {
        compression: {
            enabled: true,
            algorithms: ["br", "gzip", "deflate"], // Brotli preferred
            level: 6, // Balanced compression
            threshold: 1024, // Only compress responses > 1KB
            contentTypes: [
                "text/html",
                "text/css",
                "text/javascript",
                "application/json",
                "application/xml",
            ],
            memLevel: 8,
            windowBits: 15,
        },
    },
});
```

### Use Cases

- **Bandwidth optimization**: Reduce data transfer for text-based responses
- **Mobile applications**: Improve performance on slow connections
- **API responses**: Compress JSON/XML payloads

---

## Rate Limiting Plugin

The Rate Limiting Plugin uses XyPriss cache system for distributed rate limiting with secure key hashing and multiple limiting strategies.

### Configuration Options

```typescript
network: {
  rateLimit: {
    enabled: boolean;                    // Enable/disable rate limiting
    strategy: "fixed-window" | "sliding-window" | "token-bucket";

    global: {
      requests: number;                  // Max requests per window
      window: string;                    // Time window (e.g., "1m", "1h", "1d")
    },

}
```

### Example

```typescript
const app = createServer({
    network: {
        rateLimit: {
            enabled: true,
            strategy: "sliding-window",

            global: {
                requests: 10000,
                window: "1h",
            },
        },
    },
});
```

### Use Cases

- **API protection**: Prevent abuse and DDoS attacks
- **Fair resource allocation**: Ensure equal access for all users
- **Tiered access**: Different limits for different user tiers

---

## Proxy Plugin

The Proxy Plugin provides reverse proxy functionality with load balancing, health checks, and failover capabilities.

### Configuration Options

```typescript
network: {
  proxy: {
    enabled: boolean;                    // Enable/disable proxy plugin

    upstreams: Array<{
      host: string;                      // Upstream server hostname
      port: number;                      // Upstream server port
      weight: number;                    // Server weight for load balancing
      maxConnections: number;            // Max connections to this upstream
      healthCheckPath: string;           // Health check path
    }>;

    loadBalancing: "round-robin" | "weighted-round-robin" | "ip-hash" | "least-connections";

    healthCheck: {
      enabled: boolean;                  // Enable health checks
      interval: number;                  // Health check interval in ms
      timeout: number;                   // Health check timeout in ms
      path: string;                      // Health check path
      unhealthyThreshold: number;        // Failed checks before marking unhealthy
      healthyThreshold: number;          // Successful checks before marking healthy
    },

    timeout: number;                     // Proxy timeout in ms
    logging: boolean;                    // Enable request/response logging
    onError: (error, req, res) => void;  // Custom error handling
  }
}
```

### Example

```typescript
const app = createServer({
    network: {
        proxy: {
            enabled: true,

            upstreams: [
                {
                    host: "backend1.example.com",
                    port: 8080,
                    weight: 2,
                    maxConnections: 100,
                    healthCheckPath: "/health",
                },
                {
                    host: "backend2.example.com",
                    port: 8080,
                    weight: 1,
                    maxConnections: 100,
                    healthCheckPath: "/health",
                },
            ],

            loadBalancing: "weighted-round-robin",

            healthCheck: {
                enabled: true,
                interval: 30000, // Check every 30 seconds
                timeout: 5000, // 5 second timeout
                path: "/health",
                unhealthyThreshold: 3,
                healthyThreshold: 2,
            },

            timeout: 30000,
            logging: true,

            onError: (error, req, res) => {
                console.error("Proxy error:", error);
                res.status(502).json({ error: "Bad Gateway" });
            },
        },
    },
});
```

### Use Cases

- **Load balancing**: Distribute traffic across multiple backend servers
- **High availability**: Automatic failover when backends are down
- **Microservices**: Route requests to different services
- **A/B testing**: Weight-based traffic distribution

---

## Complete Configuration Example

Here's a comprehensive example combining all network plugins:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    network: {
        // Connection Management
        connection: {
            enabled: true,
            http2: {
                enabled: true,
                maxConcurrentStreams: 200,
                initialWindowSize: 65536,
                serverPush: true,
            },
            keepAlive: {
                enabled: true,
                timeout: 60000,
                maxRequests: 200,
            },
            connectionPool: {
                maxConnections: 2000,
                timeout: 10000,
                idleTimeout: 120000,
            },
        },

        // Compression
        compression: {
            enabled: true,
            algorithms: ["br", "gzip", "deflate"],
            level: 6,
            threshold: 1024,
            contentTypes: [
                "text/html",
                "text/css",
                "text/javascript",
                "application/json",
            ],
        },

        // Rate Limiting
        rateLimit: {
            enabled: true,
            strategy: "sliding-window",
            perIP: {
                requests: 100,
                window: "1m",
            },
            headers: {
                enabled: true,
                prefix: "X-RateLimit",
            },
        },

        // Reverse Proxy
        proxy: {
            enabled: true,
            upstreams: [
                {
                    host: "backend1.example.com",
                    port: 8080,
                    weight: 2,
                },
                {
                    host: "backend2.example.com",
                    port: 8080,
                    weight: 1,
                },
            ],
            loadBalancing: "weighted-round-robin",
            healthCheck: {
                enabled: true,
                interval: 30000,
                timeout: 5000,
                path: "/health",
            },
        },
    },
});

app.start();
```

---

## Best Practices

### 1. **Connection Management**

- Enable HTTP/2 for modern browsers
- Use keep-alive for API servers
- Adjust connection pool size based on expected traffic

### 2. **Compression**

- Only compress responses larger than 1KB
- Use Brotli for best compression (when supported)
- Don't compress already-compressed content (images, videos)

### 3. **Rate Limiting**

- Use sliding-window for more accurate limiting
- Set different limits for different endpoints
- Use Redis for distributed rate limiting in multi-server setups

### 4. **Proxy**

- Always enable health checks in production
- Use weighted load balancing for gradual rollouts
- Set appropriate timeouts to prevent hanging requests

---

## Performance Tips

1. **Enable all plugins selectively**: Only enable plugins you need
2. **Monitor metrics**: Track plugin performance and adjust settings
3. **Use Redis**: For distributed setups, use Redis for rate limiting
4. **Tune compression**: Balance compression level vs CPU usage
5. **Health check intervals**: Don't check too frequently (30s is good)

---

## Troubleshooting

### Connection Issues

- Check `maxConnections` if seeing connection refused errors
- Increase `timeout` for slow backends
- Verify HTTP/2 compatibility with clients

### Compression Not Working

- Verify `threshold` is not too high
- Check `contentTypes` includes your response types
- Ensure client supports compression (Accept-Encoding header)

### Rate Limiting False Positives

- Use `sliding-window` instead of `fixed-window`
- Check if behind proxy (use proper IP detection)
- Verify Redis connection for distributed limiting

### Proxy Errors

- Enable `logging` to debug requests
- Check upstream server health
- Verify `healthCheckPath` returns 200 OK
- Increase `timeout` for slow upstreams

---

## Support

For issues or questions:

- GitHub Issues: [XyPriss Issues](https://github.com/Nehonix-Team/XyPriss/issues)
- Documentation: [XyPriss Docs](https://docs.xypriss.nehonix.com)

