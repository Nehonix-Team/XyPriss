# Plugin API Implementation

## Overview

This implementation adds the missing Plugin API as documented in `PLUGIN_SYSTEM_GUIDE.md` (lines 642-665).

## Implementation Details

### Files Created/Modified

1. **`src/plugins/api/PluginAPI.ts`** (NEW)

    - Implements the global `Plugin` API object
    - Provides methods: `register()`, `get()`, `create()`, `factory()`
    - Uses a pending queue to support plugin registration before server creation

2. **`src/server/ServerFactory.ts`** (MODIFIED)

    - Imports and calls `setGlobalPluginManager()` to initialize the global plugin manager
    - Transfers pending plugins to the real manager when server is created

3. **`src/index.ts`** (MODIFIED)
    - Exports the `Plugin` API for public use

### API Methods

#### `Plugin.register(plugin, config?)`

Register a plugin imperatively. Works both before and after server creation.

```typescript
Plugin.register({
    name: "my-plugin",
    version: "1.0.0",
    onServerStart: () => console.log("Started!"),
});
```

#### `Plugin.get(name)`

Retrieve a registered plugin by name.

```typescript
const plugin = Plugin.get("my-plugin");
if (plugin) {
    console.log(`Found: ${plugin.name}@${plugin.version}`);
}
```

#### `Plugin.create(plugin)`

Type-safe helper for creating plugins.

```typescript
const myPlugin = Plugin.create({
    name: "my-plugin",
    version: "1.0.0",
});
```

#### `Plugin.factory(creator)`

Create reusable plugin factories with configuration.

```typescript
const createAuthPlugin = Plugin.factory((config: { secret: string }) => ({
    name: "auth",
    version: "1.0.0",
    onServerStart: (server) => {
        server.auth = new AuthService(config.secret);
    },
}));

// Use it
const plugin = createAuthPlugin({ secret: "my-secret" });
Plugin.register(plugin);
```

## Key Features

### 1. Pending Queue System

Plugins can be registered **before** the server is created. They are stored in a pending queue and automatically registered when the server initializes.

```typescript
// This works even before createServer() is called
Plugin.register(myPlugin);

const app = createServer({
    /* ... */
});
// Pending plugins are now registered
```

### 2. Dual Registration Support

Supports both imperative (Plugin API) and declarative (config-based) registration:

```typescript
// Imperative
Plugin.register(myPlugin);

// Declarative
const app = createServer({
    plugins: {
        register: [myPlugin],
    },
});
```

### 3. Dependency Resolution

The underlying `PluginManager` handles dependency resolution automatically:

```typescript
Plugin.register({
    name: "plugin-b",
    dependencies: ["plugin-a"], // Will be loaded after plugin-a
    // ...
});
```

## Testing

Run the comprehensive test:

```bash
bun .private/test_plugin_api.ts
```

This test demonstrates all four API methods and verifies:

-   Plugin creation with `create()` and `factory()`
-   Registration before and after server creation
-   Plugin retrieval with `get()`
-   Dependency resolution
-   Config-based registration compatibility

## Compatibility

✅ Fully compatible with existing plugin system
✅ Works with both Bun and Node.js
✅ TypeScript type-safe
✅ Matches documentation in `PLUGIN_SYSTEM_GUIDE.md`

## Example Usage

See `.private/test_plugin_api.ts` for a complete example demonstrating all features.

Also see `.private/upload_serv.ts` lines 62-98 for real-world usage with `Plugin.create()` and `Plugin.register()`.

