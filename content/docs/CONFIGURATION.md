# XyPriss Configuration Guide

Complete reference for all XyPriss configuration options.

## Basic Configuration

```typescript
import { createServer } from "xypriss";

const server = createServer({
    env: "production",
    server: { port: 3000 },
    security: { enabled: true },
});
```

## Configuration Interface

```typescript
interface ServerOptions {
    env?: "development" | "production" | "test";
    server?: ServerConfig;
    security?: SecurityConfig;
    cache?: CacheConfig;
    cluster?: ClusterConfig;
    fileUpload?: FileUploadConfig;
    multiServer?: MultiServerConfig;
    performance?: PerformanceConfig;
    logging?: LoggingConfig;
}
```

## Server Configuration

```typescript
server: {
    port?: number;                    // Default: 3000
    host?: string;                    // Default: "localhost"
    trustProxy?: boolean | string[];  // Default: false
    autoParseJson?: boolean;          // Default: true

    autoPortSwitch?: {
        enabled: boolean;
        portRange?: [number, number]; // e.g., [3000, 3100]
        strategy?: "increment" | "random";
        maxAttempts?: number;         // Default: 10
    };
}
```

### Example

```typescript
const server = createServer({
    server: {
        port: 8080,
        host: "0.0.0.0",
        trustProxy: true,
        autoPortSwitch: {
            enabled: true,
            portRange: [8080, 8090],
            strategy: "increment",
        },
    },
});
```

## Security Configuration

```typescript
security: {
    enabled?: boolean;
    level?: "basic" | "enhanced" | "maximum";

    csrf?: {
        enabled: boolean;
        ignoreMethods?: string[];
        cookieName?: string;
    };

    cors?: {
        origin: string | string[];
        credentials?: boolean;
        methods?: string[];
        allowedHeaders?: string[];
        exposedHeaders?: string[];
        maxAge?: number;
    };

    rateLimit?: {
        windowMs: number;
        max: number;
        message?: string;
        standardHeaders?: boolean;
        legacyHeaders?: boolean;
    };

    headers?: {
        contentSecurityPolicy?: object;
        hsts?: object;
        frameguard?: object;
    };
}
```

### Example

```typescript
const server = createServer({
    security: {
        enabled: true,
        level: "enhanced",
        csrf: { enabled: true },
        cors: {
            origin: ["localhost:*", "*.myapp.com"],
            credentials: true,
        },
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 100,
        },
    },
});
```

## Cache Configuration

```typescript
cache: {
    strategy?: "memory" | "redis" | "hybrid";
    maxSize?: number;              // in bytes
    ttl?: number;                  // in seconds

    redis?: {
        host: string;
        port: number;
        password?: string;
        db?: number;
        cluster?: boolean;
        clusterNodes?: Array<{
            host: string;
            port: number;
        }>;
    };
}
```

### Example

```typescript
const server = createServer({
    cache: {
        strategy: "redis",
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600, // 1 hour
        redis: {
            host: "localhost",
            port: 6379,
            password: "secret",
        },
    },
});
```

## Cluster Configuration

```typescript
cluster: {
    enabled: boolean;
    workers?: number | "auto";     // "auto" = CPU cores
    restartOnCrash?: boolean;
    maxRestarts?: number;
}
```

### Example

```typescript
const server = createServer({
    cluster: {
        enabled: true,
        workers: "auto",
        restartOnCrash: true,
        maxRestarts: 5,
    },
});
```

## File Upload Configuration

```typescript
fileUpload: {
    enabled: boolean;
    maxFileSize?: number;          // in bytes
    maxFiles?: number;
    storage?: "memory" | "disk";
    destination?: string;          // for disk storage

    allowedMimeTypes?: string[];
    allowedExtensions?: string[];

    limits?: {
        fieldNameSize?: number;
        fieldSize?: number;
        fields?: number;
        fileSize?: number;
        files?: number;
        parts?: number;
        headerPairs?: number;
    };
}
```

### Example

```typescript
const server = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "disk",
        destination: "./uploads",
        allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
        allowedExtensions: [".jpg", ".png", ".pdf"],
    },
});
```

## Performance Configuration

```typescript
performance: {
    clustering?: boolean;
    compression?: {
        enabled: boolean;
        level?: number;              // 0-9
        threshold?: number;          // min size to compress
    };

    requestPrecompilation?: {
        enabled: boolean;
        cacheSize?: number;
    };
}
```

### Example

```typescript
const server = createServer({
    performance: {
        clustering: true,
        compression: {
            enabled: true,
            level: 6,
            threshold: 1024,
        },
    },
});
```

## Request Management Configuration

```typescript
requestManagement: {
    timeout?: {
        enabled?: boolean;           // Default: true
        defaultTimeout?: number;     // Default: 30000 (ms)
        routes?: Record<string, number>; // Per-route timeouts
        errorMessage?: string;       // Custom timeout message
        onTimeout?: (req, res) => void; // Custom handler
    };
    payload?: {
        maxBodySize?: number;        // Default: 10485760 (10MB)
    };
    concurrency?: {
        maxConcurrentRequests?: number; // Global limit (Rust enforced)
        maxPerIP?: number;             // Per-IP limit (Rust enforced)
        maxQueueSize?: number;         // Queue depth (Rust enforced)
        queueTimeout?: number;         // Queue wait timeout (ms)
        onQueueOverflow?: (req, res) => void; // JS Handler (Fallback)
    };
}
```

### Example

```typescript
const server = createServer({
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 10000,
            routes: {
                "/api/slow-process": 60000,
            },
            onTimeout(req, res) {
                res.status(408).json({ error: "Custom Timeout" });
            },
        },
            maxBodySize: 20 * 1024 * 1024, // 20MB
        },
        concurrency: {
            maxConcurrentRequests: 1000,
            maxPerIP: 100,
            maxQueueSize: 500,
            queueTimeout: 5000,
            onQueueOverflow(req, res) {
                 res.status(429).json({ error: "System Overloaded" });
            }
        }
    },
});
```

## Logging Configuration

```typescript
logging: {
    enabled?: boolean;
    level?: "debug" | "info" | "warn" | "error";

    components?: {
        server?: boolean;
        security?: boolean;
        cache?: boolean;
        routing?: boolean;
    };

    types?: {
        debug?: boolean;
        startup?: boolean;
        portSwitching?: boolean;
    };

    consoleInterception?: {
        enabled: boolean;
        captureConsoleLog?: boolean;
    };
}
```

### Example

```typescript
const server = createServer({
    logging: {
        enabled: true,
        level: "info",
        components: {
            server: true,
            security: true,
        },
    },
});
```

## Multi-Server Configuration

See [Multi-Server Guide](./MULTI_SERVER.md) for detailed configuration.

```typescript
multiServer: {
    enabled: boolean;
    servers: Array<{
        id: string;
        port: number;
        host?: string;
        routePrefix?: string;
        allowedRoutes?: string[];
        // ... server-specific overrides
    }>;
}
```

## Environment-Based Configuration

### Using Environment Variables

```typescript
const server = createServer({
    env: process.env.NODE_ENV as "development" | "production",
    server: {
        port: parseInt(process.env.PORT || "3000"),
        host: process.env.HOST || "localhost",
    },
    cache: {
        strategy: process.env.CACHE_STRATEGY as "memory" | "redis",
        redis: {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
        },
    },
});
```

### Configuration Files

Create `xypriss.config.js`:

```javascript
module.exports = {
    development: {
        server: { port: 3000 },
        security: { level: "basic" },
        logging: { level: "debug" },
    },
    production: {
        server: { port: 8080, host: "0.0.0.0" },
        security: { level: "maximum" },
        logging: { level: "error" },
        cluster: { enabled: true },
    },
};
```

Load configuration:

```typescript
import config from "./xypriss.config.js";

const env = process.env.NODE_ENV || "development";
const server = createServer(config[env]);
```

## Meta Configuration

XyPriss supports a programmatic initialization mechanism called **Meta Configuration**. This allows you to execute code before the standard configuration is loaded.

For detailed information on how to use this feature, see the **[Meta Configuration Guide](./META_CONFIG.md)**.

## Best Practices

1. **Use environment variables** for sensitive data
2. **Enable clustering** in production
3. **Set appropriate security level** based on environment
4. **Configure logging** for debugging and monitoring
5. **Use Redis cache** for distributed systems
6. **Enable compression** for better performance
7. **Set file upload limits** to prevent abuse
8. **Configure CORS** properly for your domains

## Configuration Validation

XyPriss validates configuration on startup:

```typescript
try {
    const server = createServer({
        server: { port: -1 }, // Invalid port
    });
} catch (error) {
    console.error("Configuration error:", error.message);
}
```

## Default Values

If not specified, XyPriss uses these defaults:

-   **Port**: 3000
-   **Host**: "localhost"
-   **Environment**: "development"
-   **Security**: disabled
-   **Clustering**: disabled
-   **Cache**: memory strategy
-   **Logging**: enabled with "info" level

---

[← Back to Main Documentation](../README.md)

