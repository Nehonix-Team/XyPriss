# XyPriss Configuration API (**cfg**)

The `__cfg__` global API provides a centralized, singleton-based management system for the XyPriss Server Configuration (XPSC). It is designed to resolve initialization order conflicts and provide a consistent interface for accessing and updating server settings across modular architectures.

## Architecture Overview

The configuration system operates as a singleton instance within the `ConfigurationManager` class. It maintains the internal state of the server and ensures that all components—including plugins, middleware, and core services—reference the same data structure.

## Core Methods

### Retrieval

#### **cfg**.get(section)

Retrieves a specific configuration segment. This method is type-safe and returns the current state of the requested section.

```typescript
const serverPort = __cfg__.get("server").port;
```

#### **cfg**.getAll()

Returns a complete snapshot of the current configuration object.

```typescript
const fullConfig = __cfg__.getAll();
```

### Modification

#### **cfg**.update(section, partialValue)

Performs a deep merge of the provided partial object into the specified configuration section. This method is preferred for runtime updates before the server has fully started.

```typescript
__cfg__.update("server", {
    port: 8080,
    host: "0.0.0.0",
});
```

#### **cfg**.merge(partialConfig)

Merges a partial `ServerOptions` object into the global configuration. This is used during the initialization phase to apply user-defined settings over the defaults.

## Immutability Enforcement

A critical feature of the XyPriss configuration system is its transition to a read-only state.

1. **Initialization**: During the call to `createServer()`, the configuration is merged and validated.
2. **Locking**: Once the server instance is created, the configuration object is passed through the `__const__.$make()` engine.
3. **Runtime Protection**: After locking, any attempt to use `__cfg__.update()` or modify the object properties directly will throw a `XyPrissConst` error.

This mechanism prevents "configuration drift" where plugins or rogue modules attempt to alter server behavior after the boot sequence has completed.

## Best Practices

-   **Accessing Values**: Always use `__cfg__.get()` inside functions or methods rather than caching values in local variables during module load. This ensures you always have the most recent configuration.
-   **Plugin Configuration**: Plugins should use the `onRegister` hook to inspect or suggest configuration changes via `__cfg__` before the server locks the state.
-   **Environment Overrides**: Use `__sys__.__ENV__` in conjunction with `__cfg__.update()` to apply environment-specific settings during the bootstrap phase.

