# XyPriss Configuration Guide

This guide covers all configuration options available in XyPriss.

## Configuration Methods

XyPriss supports multiple configuration methods with the following priority order:

1. **Runtime Configuration** (highest priority)
2. **Environment Variables**
3. **Configuration File** (`xypriss.config.json`)
4. **Default Values** (lowest priority)

## Runtime Configuration

Pass configuration directly to `createServer()`:

```typescript
import { createServer } from "xypriss";

const server = createServer({
    env: "production",
    server: {
        port: 3000,
        host: "0.0.0.0"
    },
    cache: {
        strategy: "redis"
    }
});
```

## Configuration File

Create `xypriss.config.json` in your project root:

```json
{
    "env": "development",
    "server": {
        "port": 3000,
        "host": "localhost",
        "autoPortSwitch": {
            "enabled": true,
            "portRange": [3000, 3010],
            "strategy": "increment"
        }
    },
    "cache": {
        "strategy": "memory",
        "maxSize": 104857600,
        "ttl": 3600
    },
    "requestManagement": {
        "timeout": {
            "enabled": true,
            "defaultTimeout": 30000
        },
        "concurrency": {
            "maxConcurrentRequests": 1000,
            "maxPerIP": 50
        }
    },
    "cluster": {
        "enabled": false,
        "workers": "auto"
    },
    "logging": {
        "level": "info",
        "format": "combined"
    }
}
```

## Environment Variables

XyPriss recognizes these environment variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Cache Configuration
CACHE_STRATEGY=redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Cluster Configuration
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4

# Security Configuration
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## Complete Configuration Reference

### ServerOptions Interface

```typescript
interface ServerOptions {
    env?: "development" | "production" | "test";
    server?: ServerConfig;
    cache?: CacheConfig;
    requestManagement?: RequestManagementConfig;
    cluster?: ClusterConfig;
    logging?: LoggingConfig;
    plugins?: PluginConfig[];
}
```

## Server Configuration

### ServerConfig

```typescript
interface ServerConfig {
    port?: number;                    // Default: 3000
    host?: string;                    // Default: "localhost"
    enableMiddleware?: boolean;       // Default: true
    autoPortSwitch?: AutoPortSwitchConfig;
}
```

### Auto Port Switching

```typescript
interface AutoPortSwitchConfig {
    enabled?: boolean;                // Default: false
    maxAttempts?: number;            // Default: 10
    portRange?: [number, number];    // Default: [3000, 3100]
    strategy?: "increment" | "random" | "predefined";  // Default: "increment"
    predefinedPorts?: number[];      // Used with "predefined" strategy
}
```

**Example:**
```typescript
const server = createServer({
    server: {
        port: 8080,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 5,
            portRange: [8080, 8090],
            strategy: "increment"
        }
    }
});
```

## Cache Configuration

### CacheConfig

```typescript
interface CacheConfig {
    strategy?: "auto" | "memory" | "redis" | "hybrid";  // Default: "auto"
    maxSize?: number;                // Memory cache size in bytes
    ttl?: number;                    // Default TTL in seconds
    redis?: RedisConfig;
    memory?: MemoryConfig;
    hybrid?: HybridConfig;
}
```

### Redis Configuration

```typescript
interface RedisConfig {
    host?: string;                   // Default: "localhost"
    port?: number;                   // Default: 6379
    password?: string;
    db?: number;                     // Default: 0
    cluster?: boolean;               // Default: false
    nodes?: RedisNode[];            // For cluster mode
    options?: RedisOptions;
}

interface RedisNode {
    host: string;
    port: number;
}
```

**Example:**
```typescript
const server = createServer({
    cache: {
        strategy: "redis",
        ttl: 7200,
        redis: {
            host: "redis.example.com",
            port: 6379,
            password: "your-password",
            db: 1
        }
    }
});
```

### Redis Cluster Configuration

```typescript
const server = createServer({
    cache: {
        strategy: "redis",
        redis: {
            cluster: true,
            nodes: [
                { host: "redis-1.example.com", port: 6379 },
                { host: "redis-2.example.com", port: 6379 },
                { host: "redis-3.example.com", port: 6379 }
            ]
        }
    }
});
```

### Hybrid Cache Configuration

```typescript
interface HybridConfig {
    memoryFirst?: boolean;           // Default: true
    memoryMaxSize?: number;          // Memory tier size
    redisConfig?: RedisConfig;       // Redis tier config
}
```

## Request Management Configuration

### RequestManagementConfig

```typescript
interface RequestManagementConfig {
    timeout?: TimeoutConfig;
    concurrency?: ConcurrencyConfig;
    networkQuality?: NetworkQualityConfig;
}
```

### Timeout Configuration

```typescript
interface TimeoutConfig {
    enabled?: boolean;               // Default: true
    defaultTimeout?: number;         // Default: 30000ms
    routes?: Record<string, number>; // Route-specific timeouts
}
```

**Example:**
```typescript
const server = createServer({
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 30000,
            routes: {
                "/api/upload": 300000,      // 5 minutes
                "/api/quick": 5000,         // 5 seconds
                "/api/stream": 0            // No timeout
            }
        }
    }
});
```

### Concurrency Configuration

```typescript
interface ConcurrencyConfig {
    maxConcurrentRequests?: number;  // Default: 1000
    maxPerIP?: number;              // Default: 100
    queueTimeout?: number;          // Default: 5000ms
}
```

### Network Quality Configuration

```typescript
interface NetworkQualityConfig {
    enabled?: boolean;               // Default: false
    adaptiveTimeout?: boolean;       // Default: true
    qualityThresholds?: {
        excellent?: number;          // Default: 100ms
        good?: number;              // Default: 500ms
        poor?: number;              // Default: 2000ms
    };
}
```

## Cluster Configuration

### ClusterConfig

```typescript
interface ClusterConfig {
    enabled?: boolean;               // Default: false
    workers?: number | "auto";       // Default: "auto"
    autoScale?: AutoScaleConfig;
    gracefulShutdown?: GracefulShutdownConfig;
}
```

### Auto Scaling Configuration

```typescript
interface AutoScaleConfig {
    enabled?: boolean;               // Default: false
    minWorkers?: number;            // Default: 1
    maxWorkers?: number;            // Default: CPU cores * 2
    cpuThreshold?: number;          // Default: 80 (percent)
    memoryThreshold?: number;       // Default: 85 (percent)
    scaleInterval?: number;         // Default: 30000ms
    scaleUpCooldown?: number;       // Default: 60000ms
    scaleDownCooldown?: number;     // Default: 300000ms
}
```

**Example:**
```typescript
const server = createServer({
    cluster: {
        enabled: true,
        workers: 4,
        autoScale: {
            enabled: true,
            minWorkers: 2,
            maxWorkers: 8,
            cpuThreshold: 75,
            memoryThreshold: 80,
            scaleInterval: 30000
        }
    }
});
```

## Logging Configuration

### LoggingConfig

```typescript
interface LoggingConfig {
    level?: "debug" | "info" | "warn" | "error";  // Default: "info"
    format?: "simple" | "json" | "combined";      // Default: "combined"
    file?: string;                                 // Log file path
    console?: boolean;                             // Default: true
    timestamp?: boolean;                           // Default: true
}
```

**Example:**
```typescript
const server = createServer({
    logging: {
        level: "debug",
        format: "json",
        file: "./logs/xypriss.log",
        console: true,
        timestamp: true
    }
});
```

## Plugin Configuration

### PluginConfig

```typescript
interface PluginConfig {
    name: string;
    enabled?: boolean;               // Default: true
    options?: Record<string, any>;
}
```

**Example:**
```typescript
const server = createServer({
    plugins: [
        {
            name: "route-optimization",
            enabled: true,
            options: {
                cacheRoutes: true,
                optimizeStatic: true
            }
        },
        {
            name: "server-maintenance",
            enabled: process.env.NODE_ENV === "production",
            options: {
                healthCheck: true,
                gracefulShutdown: true
            }
        }
    ]
});
```

## Environment-Specific Configuration

### Development Configuration

```typescript
const developmentConfig = {
    env: "development",
    server: {
        port: 3000,
        host: "localhost"
    },
    cache: {
        strategy: "memory",
        maxSize: 50 * 1024 * 1024  // 50MB
    },
    logging: {
        level: "debug",
        format: "simple"
    },
    cluster: {
        enabled: false
    }
};
```

### Production Configuration

```typescript
const productionConfig = {
    env: "production",
    server: {
        port: process.env.PORT || 8080,
        host: "0.0.0.0",
        autoPortSwitch: {
            enabled: false  // Use fixed port in production
        }
    },
    cache: {
        strategy: "redis",
        ttl: 3600,
        redis: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD
        }
    },
    cluster: {
        enabled: true,
        workers: "auto",
        autoScale: {
            enabled: true,
            minWorkers: 2,
            maxWorkers: 16
        }
    },
    logging: {
        level: "warn",
        format: "json",
        file: "/var/log/xypriss/app.log"
    }
};
```

## Configuration Validation

XyPriss validates configuration at startup and provides helpful error messages:

```typescript
// Invalid configuration will throw an error
const server = createServer({
    server: {
        port: "invalid"  // Error: port must be a number
    },
    cache: {
        strategy: "invalid"  // Error: invalid cache strategy
    }
});
```

## Dynamic Configuration

Some configuration options can be changed at runtime:

```typescript
const server = createServer();

// Update cache TTL
server.getCache().setDefaultTTL(7200);

// Update logging level
server.setLogLevel("debug");

// Get current configuration
const config = server.getConfig();
console.log(config);
```

## Best Practices

1. **Use environment variables** for sensitive data (passwords, API keys)
2. **Use configuration files** for complex, environment-specific settings
3. **Validate configuration** in your application startup
4. **Document custom configuration** for your team
5. **Use different configurations** for different environments
6. **Monitor configuration changes** in production

This comprehensive configuration system allows you to fine-tune XyPriss for your specific needs while maintaining simplicity for basic use cases.
