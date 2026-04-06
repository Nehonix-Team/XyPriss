# Plugin API Reference

This document provides a detailed reference for building XyPriss plugins, including the core `XyPrissPlugin` interface and hook signatures.

## `XyPrissPlugin` Interface

```typescript
export interface XyPrissPlugin {
    // Metadata
    name: string;
    version: string;
    description?: string;
    type?: PluginType; // performance categorization

    // Dependencies
    dependencies?: string[];

    // Lifecycle Hooks
    onRegister?(error?: Error | null): void | Promise<void>;
    onServerStart?(server: PluginServer): void | Promise<void>;
    onServerReady?(server: PluginServer): void | Promise<void>;
    onServerStop?(server: PluginServer): void | Promise<void>;

    // HTTP Monitoring & Interception
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

    // Security & Metrics Hooks
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

    // Specialized Logic
    onConsoleIntercept?(log: InterceptedConsoleCall): void | Promise<void>;
    registerRoutes?(app: XyPrissApp): void;
    onAuxiliaryServerDeploy?(
        ops: OpsServerManager,
        server: XyPrissServer,
    ): void | Promise<void>;

    // Middleware Mounting
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";
}
```

## Hook Details

### `onRegister`

- **When**: Called immediately after the plugin is added to the registry.
- **Context**: Used for pre-flight checks and early initialization.

### `onServerStart` / `onServerReady`

- **Context**: Receives a `PluginServer` instance.
- **Usage**: Initialize internal state, connect to external services.

### `onRequest` / `onResponse`

- **When**: Executed during the request/response lifecycle.
- **Usage**: High-performance monitoring and interception.
- **Performance Leak**: Keep these hooks under 1ms to maintain framework throughput.

### `onAuxiliaryServerDeploy`

- **Context**: Receives an `OpsServerManager` and the original `XyPrissServer`.
- **Feature**: Use `ops.createAuxiliaryServer(options)` to bind a new independent XyPriss application to a different port.

## Performance Categorization

Plugins can be tagged with a `PluginType` to help the engine optimize the execution pipeline:

- `SECURITY`: Authentication, authorization, validation.
- `NETWORK`: Routing, proxying, compression.
- `CACHE`: Result caching and hit detection.
- `PERFORMANCE`: Metrics and monitoring.
- `POST_RESPONSE`: Analytics and cleanup.

## Execution Priority

Plugins can define their `PluginPriority`:

1. `CRITICAL`: (0) Foundation plugins, execution < 0.1ms.
2. `HIGH`: (1) Major security/routing logic.
3. `NORMAL`: (2) Standard features (Default).
4. `LOW`: (3) Non-critical monitoring.
5. `BACKGROUND`: (4) Asynchronous tasks.

---

**Related Documentation**:

- [Plugin Development Guide](./PLUGIN_SYSTEM_GUIDE.md)
- [Plugin Permission System](./PLUGIN_PERMISSIONS.md)
- [Built-in Plugins Guide](./BUILTIN_PLUGINS.md)

