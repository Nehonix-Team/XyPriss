# Plugin API Technical Reference

This document provides a comprehensive technical reference for the XyPriss Plugin Architecture, including interface specifications, execution protocols, and hook lifecycle details.

## `XyPrissPlugin` Interface Specification

The `XyPrissPlugin` interface defines the contract between the core engine and external modules. Plugins must adhere to this structure to ensure compatibility with the high-performance execution pipeline.

```typescript
export interface XyPrissPlugin {
    // Identity Metadata
    name: string;
    version: string;
    description?: string;
    type?: PluginType; // Analytical categorization

    // Dependency Management
    dependencies?: string[];

    // Native Lifecycle Hooks
    onRegister?(error?: Error | null): void | Promise<void>;
    onServerStart?(server: PluginServer): void | Promise<void>;
    onServerReady?(server: PluginServer): void | Promise<void>;
    onServerStop?(server: PluginServer): void | Promise<void>;

    // Transaction Interception
    onRequest?(
        req: Request,
        res: Response,
        next: NextFunction,
    ): void | Promise<void>;
    onResponse?(req: Request, res: Response): void | Promise<void>;
    onError?(
        error: Error,
        req: Request,
        res: Response,
        next?: NextFunction,
    ): void | Promise<void>;

    // Security and Performance Instrumentation
    onSecurityAttack?(
        attackData: any,
        req: Request,
        res: Response,
    ): void | Promise<void>;
    onResponseTime?(
        responseTime: number,
        req: Request,
        res: Response,
    ): void | Promise<void>;
    onRouteError?(
        error: Error,
        req: Request,
        res: Response,
    ): void | Promise<void>;
    onRateLimit?(
        limitData: any,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    // Optimized Subsystem Logic
    onConsoleIntercept?(log: InterceptedConsoleCall): void | Promise<void>;
    registerRoutes?(app: XyPrissApp): void;
    onAuxiliaryServerDeploy?(
        ops: OpsServerManager,
        server: XyPrissServer,
    ): void | Promise<void>;

    // Middleware Integration
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";
}
```

## Hook Protocol Specifications

### Initialization Phase (`onRegister`)

- **Execution Timing**: Invoked immediately upon plugin registration.
- **Operational Scope**: Synchronous preparation and early state allocation.

### Activation Phase (`onServerStart` / `onServerReady`)

- **Execution Timing**: `onServerStart` occurs during bootstrap; `onServerReady` occurs once TCP sockets are established.
- **Operational Scope**: Connection to external telemetry sinks, database initialization, and side-car management.

### Transaction Logic (`onRequest` / `onResponse`)

- **Performance Requirement**: Implementations must execute in sub-millisecond durations to maintain framework throughput.
- **Operational Scope**: Request validation, payload transformation, and response header injection.

### Native Interception (`onConsoleIntercept`)

- **Architecture**: Powered by the XHSC Go core via a secure IPC bridge.
- **Operational Scope**: Centralized auditing, multi-tenant log isolation, and real-time security telemetry.

## Performance Categorization (`PluginType`)

The engine utilizes the `PluginType` metadata to optimize the internal execution stack:

- `SECURITY`: Identity verification and access control logic.
- `NETWORK`: Protocol optimization and payload compression.
- `CACHE`: High-speed data retrieval and TTL management.
- `PERFORMANCE`: Low-level instrumentation and metrics ingestion.
- `POST_RESPONSE`: Asynchronous analysis and resource cleanup.

## Execution Priority Protocols

Priority levels dictate the relative execution order within the hook pipeline:

1.  **CRITICAL** (Level 0): Fundamental system logic (Execution < 0.1ms).
2.  **HIGH** (Level 1): Security and primary routing infrastructure.
3.  **NORMAL** (Level 2): Standard feature implementation (Default).
4.  **LOW** (Level 3): Non-critical instrumentation.
5.  **BACKGROUND** (Level 4): High-latency asynchronous tasks.

## Technical Resources

- [Plugin System Architecture](./PLUGIN_SYSTEM_GUIDE.md)
- [Security and Permission Specification](./PLUGIN_PERMISSIONS.md)
- [Integrated Standard Plugins](./BUILTIN_PLUGINS.md)

