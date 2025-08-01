# XyPriss Architecture

This document describes the internal architecture and design patterns of XyPriss framework.

## Overview

XyPriss is built as a modular, high-performance framework that extends Express.js with enterprise-grade features. The architecture follows a component-based design with clear separation of concerns.

## Core Architecture

### Main Components

```
XyPriss Framework
├── Core Framework (src/)
│   ├── ServerFactory.ts          # Main entry point and server creation
│   ├── server/FastServer.ts      # XyPrissServer class implementation
│   ├── cache/                    # Caching system
│   ├── cluster/                  # Clustering and scaling
│   ├── security-middleware.ts    # Security layer
│   ├── performance-monitor.ts    # Performance monitoring
│   └── plugins/                  # Plugin system
└── Security Module (mods/security)
    ├── core/                     # Cryptographic core
    ├── components/               # Secure data structures
    └── utils/                    # Security utilities
```

## Core Framework Architecture

### 1. Server Factory (`src/ServerFactory.ts`)

The main entry point that provides the `createServer()` function:

```typescript
export function createServer(options: ServerOptions = {}): UltraFastApp {
    const server = new XyPrissServer(options);
    return server.getApp();
}
```

**Responsibilities:**

-   Server instance creation
-   Configuration merging
-   Express app initialization
-   Component orchestration

### 2. XyPrissServer Class (`src/server/FastServer.ts`)

The core server implementation with component-based architecture:

```typescript
export class XyPrissServer {
    private app: UltraFastApp;
    private cacheManager: CacheManager;
    private middlewareManager: MiddlewareManager;
    private requestProcessor: RequestProcessor;
    private routeManager: RouteManager;
    private performanceManager: PerformanceManager;
    // ... other components
}
```

**Key Components:**

-   **CacheManager**: Multi-tier caching (memory, Redis, hybrid)
-   **MiddlewareManager**: Middleware registration and execution
-   **RequestProcessor**: Request handling and optimization
-   **RouteManager**: Route registration and management
-   **PerformanceManager**: Performance monitoring and optimization
-   **ClusterManagerComponent**: Clustering and auto-scaling
-   **PluginManager**: Plugin system management

### 3. Component Architecture

Each major feature is implemented as a separate component:

#### Cache System (`src/cache/`)

```
cache/
├── CacheFactory.ts           # Cache creation and utilities
├── SecureCacheAdapter.ts     # Secure caching with encryption
├── index.ts                  # Cache exports
└── type.ts                   # Cache type definitions
```

**Features:**

-   Multiple cache strategies (memory, Redis, hybrid)
-   Secure caching with encryption
-   Automatic cache invalidation
-   Performance optimization

#### Cluster Management (`src/cluster/`)

```
cluster/
├── cluster-manager.ts        # Main cluster management
├── modules/                  # Cluster components
│   ├── AutoScaler.ts        # Automatic scaling
│   ├── HealthMonitor.ts     # Health monitoring
│   ├── LoadBalancer.ts      # Load balancing
│   ├── MetricsCollector.ts  # Metrics collection
│   └── WorkerManager.ts     # Worker process management
└── index.ts                 # Cluster exports
```

**Features:**

-   Automatic worker scaling based on CPU/memory
-   Health monitoring and recovery
-   Load balancing across workers
-   Metrics collection and reporting

#### Security Layer (`src/security-middleware.ts`)

```typescript
export class SecurityMiddleware {
    // Built-in security features
    // Integration with XyPriss Security module
    // Request validation and sanitization
}
```

**Features:**

-   Helmet integration for security headers
-   CORS configuration
-   Rate limiting
-   Input validation and sanitization
-   Integration with XyPriss Security module

#### Plugin System (`src/plugins/`)

```
plugins/
├── plugin-manager.ts              # Plugin lifecycle management
├── route-optimization-plugin.ts   # Route optimization
├── server-maintenance-plugin.ts   # Server maintenance
└── types/                         # Plugin type definitions
```

**Features:**

-   Plugin lifecycle management (load, initialize, execute, cleanup)
-   Hot-pluggable architecture
-   Built-in optimization plugins
-   Custom plugin development support

### 4. Server Components (`src/server/components/`)

The server uses a component-based architecture with specialized managers:

```
server/components/fastapi/
├── CacheManager.ts                    # Cache operations
├── MiddlewareManager.ts               # Middleware handling
├── RequestProcessor.ts                # Request processing
├── RouteManager.ts                    # Route management
├── PerformanceManager.ts              # Performance monitoring
├── MonitoringManager.ts               # System monitoring
├── ClusterManagerComponent.ts         # Cluster integration
├── UltraFastRequestProcessor.ts       # High-performance request processing
├── PluginManager.ts                   # Plugin management
├── FileWatcherManager.ts              # File system monitoring
├── RedirectManager.ts                 # URL redirection
└── console/ConsoleInterceptor.ts      # Console output management
```

## Security Module Architecture

### XyPriss Security (`mods/security`)

The security module is a separate, self-contained library:

```
mods/securitysrc/
├── core/                      # Cryptographic core
│   ├── crypto.ts             # Main cryptographic operations
│   ├── hash.ts               # Hashing functions
│   ├── random.ts             # Secure random generation
│   ├── keys.ts               # Key management
│   └── validators.ts         # Input validation
├── components/               # Secure data structures
│   ├── secure-array/         # Encrypted arrays
│   ├── secure-string/        # Protected strings
│   ├── secure-object/        # Encrypted objects
│   ├── secure-memory.ts      # Memory management
│   ├── fortified-function/   # Tamper-resistant functions
│   ├── post-quantum.ts       # Quantum-resistant crypto
│   └── tamper-evident-logging.ts # Audit logging
└── utils/                    # Security utilities
    ├── errorHandler.ts       # Secure error handling
    ├── performanceMonitor.ts # Security performance monitoring
    └── securityUtils.ts      # General security utilities
```

## Data Flow Architecture

### Request Processing Flow

```
1. HTTP Request
   ↓
2. Express.js Middleware Stack
   ↓
3. XyPriss Security Middleware
   ↓
4. Cache Check (CacheManager)
   ↓
5. Route Processing (RouteManager)
   ↓
6. Request Processing (RequestProcessor)
   ↓
7. Business Logic (User Code)
   ↓
8. Response Processing
   ↓
9. Cache Storage (if applicable)
   ↓
10. HTTP Response
```

### Component Interaction

```
ServerFactory
    ↓
XyPrissServer
    ├── CacheManager ←→ SecureCacheAdapter
    ├── MiddlewareManager ←→ SecurityMiddleware
    ├── RequestProcessor ←→ UltraFastRequestProcessor
    ├── RouteManager ←→ Smart Routes
    ├── PerformanceManager ←→ Monitoring
    ├── ClusterManager ←→ Worker Processes
    └── PluginManager ←→ Plugin Instances
```

## Configuration Architecture

### Configuration Hierarchy

1. **Default Configuration** (`src/server/const/default.ts`)
2. **File Configuration** (loaded by `ConfigLoader`)
3. **User Configuration** (passed to `createServer()`)

### Configuration Structure

```typescript
interface ServerOptions {
    env?: "development" | "production" | "test";
    server?: ServerConfig; // Server-specific settings
    cache?: CacheConfig; // Caching configuration
    requestManagement?: RequestManagementConfig;
    cluster?: ClusterConfig; // Clustering settings
    logging?: LoggingConfig; // Logging configuration
    plugins?: PluginConfig[]; // Plugin configurations
}
```

## Performance Architecture

### Optimization Strategies

1. **Zero-Async Initialization**: Server is ready immediately
2. **Component Lazy Loading**: Components initialize on first use
3. **Request Pooling**: Efficient request handling
4. **Cache Optimization**: Multi-tier caching strategy
5. **Cluster Scaling**: Automatic horizontal scaling

### Performance Monitoring

```
PerformanceManager
├── Request Metrics
├── Memory Usage
├── CPU Utilization
├── Cache Hit Rates
└── Response Times
```

## Extensibility Architecture

### Plugin System

```typescript
interface Plugin {
    name: string;
    version: string;
    initialize(context: PluginContext): Promise<void>;
    execute(context: PluginContext): Promise<any>;
    cleanup?(): Promise<void>;
}
```

### Custom Components

The architecture allows for custom component development:

1. Implement component interface
2. Register with appropriate manager
3. Integrate with lifecycle management

## Security Architecture

### Defense in Depth

1. **Network Layer**: Rate limiting, CORS, security headers
2. **Application Layer**: Input validation, sanitization
3. **Data Layer**: Encryption, secure storage
4. **Memory Layer**: Secure memory management
5. **Audit Layer**: Tamper-evident logging

### Integration Points

-   **Express Middleware**: Security middleware integration
-   **Request Processing**: Input validation and sanitization
-   **Data Storage**: Encrypted caching and storage
-   **Logging**: Secure audit trails

## Deployment Architecture

### Single Instance

```
Node.js Process
└── XyPriss Server
    ├── Express App
    ├── Cache Layer
    └── Security Layer
```

### Clustered Deployment

```
Master Process
├── Worker 1 (XyPriss Server)
├── Worker 2 (XyPriss Server)
├── Worker N (XyPriss Server)
└── Load Balancer
```

### External Dependencies

```
XyPriss Application
├── Redis (optional, for caching)
├── Database (user choice)
└── External APIs (user choice)
```

This architecture provides a solid foundation for building scalable, secure, and high-performance web applications while maintaining the familiar Express.js development experience.

