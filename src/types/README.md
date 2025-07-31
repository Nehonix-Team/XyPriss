# XyPrissJS Express Types - Modular Architecture

This directory contains the modular type architecture for XyPrissJS Express integration, providing comprehensive TypeScript definitions organized by functionality.

## Architecture Overview

The types have been reorganized from a single large file into modular components for better maintainability, discoverability, and development experience.

### Module Structure

```
types/
├── index.ts              # Main export file with all types
├── types.ts              # Legacy compatibility and main interfaces
├── README.md             # This documentation
└── mod/                  # Modular type definitions
    ├── core.ts           # Core utilities and base types
    ├── cache.ts          # Cache-related types
    ├── security.ts       # Security and authentication types
    ├── middleware.ts     # Middleware management types
    ├── performance.ts    # Performance monitoring types
    ├── server.ts         # Server configuration types
    ├── routing.ts        # Routing and route management types
    └── monitoring.ts     # Health checks and observability types
```

## Module Descriptions

### Core (`mod/core.ts`)

Fundamental types and utilities used throughout the system:

-   `DeepPartial<T>` - Recursive partial type utility
-   `EnhancedRequest` - Extended Express request with utilities
-   `EnhancedResponse` - Extended Express response with utilities
-   `ValidationResult` - Request validation results
-   `UserContext` - User authentication context
-   `SessionData` - Session management data
-   `PaginationInfo` - API pagination information

### Cache (`mod/cache.ts`)

Comprehensive caching system types:

-   `CacheConfig` - Main cache configuration
-   `CacheBackendStrategy` - Cache backend selection
-   `RedisConfig` - Redis-specific configuration
-   `MemoryConfig` - Memory cache configuration
-   `CacheMetrics` - Real-time cache metrics
-   `CacheStrategy` - Conditional caching strategies

### Security (`mod/security.ts`)

Security and authentication types:

-   `SecurityConfig` - Main security configuration
-   `AuthenticationConfig` - Authentication methods
-   `JWTConfig` - JWT token configuration
-   `SessionConfig` - Session management
-   `SSLConfig` - SSL/TLS configuration
-   `CORSConfig` - Cross-origin resource sharing
-   `RouteSecurityConfig` - Route-level security

### Middleware (`mod/middleware.ts`)

Middleware management and configuration:

-   `MiddlewareConfiguration` - Main middleware config
-   `MiddlewareInfo` - Runtime middleware information
-   `MiddlewareStats` - Performance statistics
-   `CustomMiddleware` - Custom middleware definition
-   `MiddlewareAPIInterface` - Fluent middleware API
-   Security, compression, rate limiting, and CORS middleware options

### Performance (`mod/performance.ts`)

Performance monitoring and optimization:

-   `PerformanceConfig` - Performance monitoring setup
-   `PerformanceMetrics` - Real-time performance data
-   `PerformanceOptimizationConfig` - Optimization settings
-   `PerformanceBenchmark` - Benchmark results
-   `AlertConfig` - Performance alerting

### Server (`mod/server.ts`)

Server configuration and management:

-   `ServerConfig` - Main server configuration
-   `AutoPortSwitchConfig` - Automatic port switching
-   `FileWatcherConfig` - Development file watching
-   `TypeScriptTypeCheckConfig` - TypeScript integration
-   `LoggingConfig` - Application logging

### Routing (`mod/routing.ts`)

Route management and configuration:

-   `RouteConfig` - Individual route configuration
-   `RouteCacheConfig` - Route-specific caching
-   `RouteOptions` - Enhanced route options
-   `RouterConfig` - High-performance router
-   `RouteStats` - Route performance metrics

### Monitoring (`mod/monitoring.ts`)

Health checks and observability:

-   `MonitoringConfig` - System monitoring setup
-   `HealthCheckConfig` - Health check configuration
-   `SystemMetrics` - Comprehensive system metrics
-   `AlertConfig` - System alerting
-   `ObservabilityConfig` - Tracing and metrics export

## Usage Examples

### Basic Import Patterns

```typescript
// Import all types (recommended for most use cases)
import { ServerOptions, CacheConfig, SecurityConfig } from "./types";

// Import from specific modules
import { PerformanceMetrics } from "./types/mod/performance";
import { RouteConfig } from "./types/mod/routing";

// Import entire modules
import * as CacheTypes from "./types/mod/cache";
import * as SecurityTypes from "./types/mod/security";
```

### Configuration Examples

```typescript
import { ServerOptions } from "./types";

const serverConfig: ServerOptions = {
    env: "production",
    cache: {
        strategy: "hybrid",
        maxSize: 1024 * 1024 * 100, // 100MB
        ttl: 3600,
        redis: {
            host: "localhost",
            port: 6379,
            cluster: true,
        },
    },
    security: {
        encryption: true,
        cors: true,
        helmet: true,
    },
    performance: {
        optimizationEnabled: true,
        aggressiveCaching: true,
        parallelProcessing: true,
    },
};
```

### Route Configuration

```typescript
import { RouteConfig, RouteOptions } from "./types";

const userRoute: RouteConfig = {
    path: "/api/users/:id",
    method: "GET",
    handler: async (req, res, next) => {
        const user = await getUserById(req.params.id);
        res.success(user);
    },
    cache: {
        enabled: true,
        ttl: 300,
        tags: ["users"],
    },
    security: {
        auth: true,
        roles: ["user", "admin"],
    },
};
```

### Middleware Configuration

```typescript
import { MiddlewareConfiguration } from "./types";

const middlewareConfig: MiddlewareConfiguration = {
    rateLimit: {
        enabled: true,
        windowMs: 900000, // 15 minutes
        max: 100,
    },
    cors: {
        enabled: true,
        origin: ["https://example.com"],
        credentials: true,
    },
    compression: {
        enabled: true,
        level: 6,
        threshold: 1024,
    },
};
```

## Migration Guide

### From Legacy Types

If you were previously importing from the main `types.ts` file, your imports will continue to work due to backward compatibility:

```typescript
// This still works
import { ServerOptions, CacheConfig } from "./types";

// But you can now also use modular imports
import { CacheConfig } from "./types/mod/cache";
import { SecurityConfig } from "./types/mod/security";
```

### Benefits of Modular Architecture

1. **Better Organization**: Types are grouped by functionality
2. **Improved Discoverability**: Easier to find relevant types
3. **Reduced Bundle Size**: Import only what you need
4. **Better Documentation**: Each module has focused documentation
5. **Easier Maintenance**: Changes are isolated to relevant modules
6. **Type Safety**: Comprehensive JSDoc documentation for all types

## Development Guidelines

### Adding New Types

1. Determine the appropriate module for your new type
2. Add comprehensive JSDoc documentation
3. Include practical examples in the documentation
4. Export the type from the module
5. Add to the main index.ts if it's commonly used
6. Update this README if adding new modules

### Documentation Standards

All types should include:

-   Comprehensive JSDoc comments
-   Parameter descriptions with types
-   Practical usage examples
-   Version and author information
-   Related type references

### Backward Compatibility

The modular architecture maintains full backward compatibility with existing code. All types remain available through the main `types.ts` file while providing new modular import options.

## Performance Considerations

The modular architecture provides several performance benefits:

1. **Tree Shaking**: Bundlers can eliminate unused types
2. **Faster Compilation**: TypeScript can process smaller modules faster
3. **Better IDE Performance**: Smaller files load faster in IDEs
4. **Reduced Memory Usage**: Only load types you actually use

## Future Enhancements

Planned improvements to the type system:

1. **Generic Type Helpers**: Additional utility types for common patterns
2. **Plugin Type System**: Extensible types for custom plugins
3. **Runtime Type Validation**: Integration with runtime validation libraries
4. **Auto-Generated Documentation**: Automated API documentation from types
5. **Type Testing**: Automated tests for type correctness

