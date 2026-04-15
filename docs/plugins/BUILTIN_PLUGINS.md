# Built-in Official Plugins

XyPriss comes with a set of powerful, production-grade built-in plugins that are optimized for high-performance execution.

## 1. XEMS (XyPriss Encrypted Memory Store)

XEMS is the foundational security plugin for session management. It replaces traditional cookie-based JWTs with a server-side encrypted store.

### Key Features

- **AES-256-GCM Encryption**: All session data is encrypted at rest in a native XHSC sidecar process.
- **Opaque Tokens**: Clients only hold a random token, never the session data itself.
- **Sandboxed Namespaces**: Separate sessions for different applications (e.g., Admin vs User).
- **Atomic Rotation**: Tokens are automatically rotated on every request to prevent replay attacks.

### Configuration

```typescript
server: {
    xems: {
        enable: true,
        ttl: "30m",
        autoRotation: true,
    }
}
```

## 2. Route Optimization Plugin

This plugin analyzes real-time traffic patterns and optimizes the framework's internal radix routing for maximum throughput.

### Key Features

- **Hot-Route Analysis**: Automatically identifies the most frequently accessed endpoints.
- **Radix Tuning**: Reorganizes the internal routing tree to reduce the number of traversal operations for hot routes.
- **Optimization Thresholds**: Configure how often the optimization occurs to balance CPU overhead.

### Configuration

```typescript
plugins: {
    routeOptimization: {
        enabled: true,
        analysisInterval: 60000, // 1 minute
        optimizationThreshold: 50, // Hits
    }
}
```

## 3. Server Maintenance Plugin

Ensures the health and stability of the server through automated monitoring and graceful recovery.

### Key Features

- **Health Checks**: Monitors CPU, memory, and response time metrics.
- **Resource Thresholds**: Automatically triggers alerts or restarts if memory usage exceeds configured limits.
- **Graceful Shutdown**: Coordinates with the framework to finish in-flight requests before stopping the process.
- **Log Management**: Handles log rotation and cleanup.

### Configuration

```typescript
plugins: {
    serverMaintenance: {
        enabled: true,
        memoryThreshold: 512, // MB
        autoRestart: true,
    }
}
```

---

**Related Documentation**:

- [Plugin System Guide](./PLUGIN_SYSTEM_GUIDE.md)
- [Plugin Permission System](./PLUGIN_PERMISSIONS.md)
- [Plugin API Reference](./plugins.md)
