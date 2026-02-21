# XyPriss Configs API

A safe, singleton-based configuration manager for XyPriss that solves the "cannot access before initialization" error in modular structures.

## The Problem

When using XyPriss in a modular structure, accessing `app.configs` directly can cause initialization timing issues:

```typescript
import { createServer } from "xypriss";
import { FileUploadAPI } from "xypriss";

const app = createServer({
    /* ... */
});

// ❌ This might fail with "cannot access app before initialization"
const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);
```

## The Solution

The `Configs` API provides a global, singleton-based configuration store that's automatically populated when you create a server:

```typescript
import { createServer, Configs } from "xypriss";
import { FileUploadAPI } from "xypriss";

const app = createServer({
    /* ... */
});

// ✅ Pass the Configs class - it accesses config internally
// This enforces a single source of truth
const upload = new FileUploadAPI();
await upload.initialize(Configs);
```

**Why pass the Configs class?**

- ✅ Single source of truth - no config conflicts
- ✅ Modular - update config once, changes everywhere
- ✅ Easy to debug - all config in one place
- ✅ Type-safe - enforced by TypeScript

## Installation

The Configs API is built into XyPriss. Just import it:

```typescript
import { Configs }Uploadpriss";
```

## API Reference

### `Configs.set(config: ServerOptions)`

Set the entire configuration. This is automatically called by `createServer()`.

```typescript
Configs.set({
    server: { port: 3000 },
    fileUpload: { enabled: true },
});
```

### `Configs.get<K>(key: K): ServerOptions[K] | undefined`

Get a specific configuration section.

```typescript
const fileUploadConfig = Configs.get("fileUpload");
const securityConfig = Configs.get("security");
const serverConfig = Configs.get("server");
```

### `Configs.getAll(): ServerOptions`

Get the entire configuration object.

```typescript
const allConfigs = Configs.getAll();
console.log(allConfigs);
```

### `Configs.update<K>(key: K, value: ServerOptions[K])`

Update a specific configuration section.

```typescript
Configs.update("fileUpload", {
    enabled: true,
    maxFileSize: 20 * 1024 * 1024,
});
```

### `Configs.merge(config: Partial<ServerOptions>)`

Merge configuration with existing config (deep merge for nested objects).

```typescript
Configs.merge({
    fileUpload: {
        maxFileSize: 15 * 1024 * 1024,
        // Other properties are preserved
    },
    performance: {
        optimizationEnabled: true,
    },
});
```

### `Configs.has<K>(key: K): boolean`

Check if a specific configuration section exists.

```typescript
if (Configs.has("fileUpload")) {
    console.log("File upload is configured");
}
```

### `Configs.isInitialized(): boolean`

Check if configuration has been initialized.

```typescript
if (Configs.isInitialized()) {
    console.log("Configs are ready to use");
}
```

### `Configs.getOrDefault<K>(key: K, defaultValue: ServerOptions[K]): ServerOptions[K]`

Get configuration with a default value if not set.

```typescript
const monitoringConfig = Configs.getOrDefault("monitoring", {
    enabled: true,
    healthChecks: true,
});
```

### `Configs.delete<K>(key: K)`

Delete a specific configuration section.

```typescript
Configs.delete("fileUpload");
```

### `Configs.reset()`

Reset configuration to empty state (useful for testing).

```typescript
Configs.reset();
```

## Usage Examples

### BUploade

```typescript
import { createServer, Configs } from "xypriss";
import { FileUploadAPI } from "xypriss";
Upload
const app = createServer({
    server: { port: Upload
    fileUpload: {
        enabled: true,
        maxFileSize: 10 * 1024 * 1024,
    },
});

// Initialize services by passing Configs class
const upload = new FileUploadAPI();
await upload.initialize(Configs);

// Access configuration when needed
const fileUploadConfig = Configs.get("fileUpload");
console.log(fileUploadConfig);
```

### Modular Service Pattern

```typescript
import { Configs } from "xypriss";
import { FileUploadAPI, Upload } from "xypriss";

class FileService {
    private upload: FileUploadAPI;

    constructor() {
        this.upload = new FileUploadAPI(); // or use the Upload class directly "this.upload = Upload"
    }

    async initialize() {
        // Pass Configs class - it accesses config internally
        // Single source of truth - no config conflicts
        await this.upload.initialize(Configs);

        // Access config when needed for validation
        const config = Configs.get("fileUpload");
        if (!config?.enabled) {
            throw new Error("File upload is not enabled");
        }
    }
}
```

### Conditional Configuration

```typescript
import { Configs } from "xypriss";

function setupMiddleware(app: any) {
    const securityConfig = Configs.get("security");
    const performanceConfig = Configs.get("performance");

    if (securityConfig?.enabled) {
        app.middleware().security(securityConfig);
    }

    if (performanceConfig?.optimizationEnabled) {
        // Enable optimizations
    }
}
```

### Environment-Specific Configuration

```typescript
import { Configs } from "xypriss";

const env = process.env.NODE_ENV || "development";

if (env === "production") {
    Configs.merge({
        security: {
            enabled: true,
            level: "maximum",
        },
        performance: {
            optimizationEnabled: true,
            aggressiveCaching: true,
        },
    });
}
```

### Dynamic Updates

```typescript
import { Configs } from "xypriss";

function updateMaxFileSize(newSize: number) {
    const currentConfig = Configs.get("fileUpload");

    if (currentConfig) {
        Configs.update("fileUpload", {
            ...currentConfig,
            maxFileSize: newSize,
        });
    }
}
```

### Configuration Validation

```typescript
import { Configs } from "xypriss";

function validateConfigs() {
    const required = ["server", "security"] as const;

    for (const key of required) {
        if (!Configs.has(key)) {
            throw new Error(`Missing required configuration: ${key}`);
        }
    }
}
```

### Using in Route Handlers

```typescript
import { createServer, Configs } from "xypriss";

const app = createServer({
    /* ... */
});

app.get("/config/status", (req, res) => {
    res.json({
        initialized: Configs.isInitialized(),
        fileUploadEnabled: Configs.get("fileUpload")?.enabled ?? false,
        securityLevel: Configs.get("security")?.level ?? "none",
    });
});

app.get("/config/all", (req, res) => {
    res.json(Configs.getAll());
});
```

## Available Configuration Keys

The `Configs` API supports all `ServerOptions` keys:

- `env` - Environment mode
- `cache` - Cache configuration
- `performance` - Performance optimization settings
- `monitoring` - Monitoring configuration
- `server` - Server settings (port, host, etc.)
- `multiServer` - Multi-server configuration
- `requestManagement` - Request management settings
- `fileUpload` - File upload configuration
- `security` - Security settings
- `cluster` - Cluster configuration
- `logging` - Logging configuration
- `middleware` - Middleware configuration

## TypeScript Support

The Configs API is fully typed with TypeScript:

```typescript
import { Configs, ConfigKey } from "xypriss";

// Type-safe key access
const key: ConfigKey = "fileUpload";
const config = Configs.get(key);

// Autocomplete support
Configs.get("fileUpload"); // ✅ Autocomplete works
Configs.get("invalid"); // ❌ TypeScript error
```

## Best Practices

1. **Use `Configs.get()` in modular code** to avoid initialization timing issues
2. **Check existence with `Configs.has()`** before accessing optional configurations
3. **Use `Configs.getOrDefault()`** for configurations with sensible defaults
4. **Validate configurations** at startup using `Configs.has()` or custom validation
5. **Use `Configs.merge()`** instead of `Configs.set()` when updating partial configurations
6. **Access `app.configs` directly** only when you're certain the app is initialized

## Migration Guide

### Before (with initialization issues)

```typescript
import { createServer } from 'xypriss';
import { FileUploadAPI } from 'xypriss';

const app = createServer({ /* ... */ });

// ❌ Might fail - initialization timing issues
const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);

// ❌ Also bad - potential config conflicts
await upload.initialize({ enabled: true, maxFileSize: 5MB });
```

### After (with Configs API)

```typescript
import { createServer, Configs } from "xypriss";
import { FileUploadAPI } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024,
    },
});

// ✅ Single source of truth - pass Configs class
const upload = new FileUploadAPI();
await upload.initialize(Configs);

// ✅ Update config in one place, changes everywhere
Configs.update("fileUpload", { maxFileSize: 10 * 1024 * 1024 });
```

## FAQ

### Q: When should I use `Configs.get()` vs `app.configs`?

**A:** Use `Configs.get()` in modular code where initialization timing might be an issue. Use `app.configs` when you're certain the app is initialized (e.g., in route handlers).

### Q: Is the configuration reactive?

**A:** No, the configuration is not reactive. If you update the configuration with `Configs.update()` or `Configs.merge()`, existing code won't automatically pick up the changes. You'll need to re-read the configuration.

### Q: Can I use Configs before calling createServer()?

**A:** Yes, but the configuration will be empty until `createServer()` is called. You can manually populate it with `Configs.set()` if needed.

### Q: Is Configs thread-safe?

**A:** The Configs singleton is designed for single-threaded Node.js environments. For multi-process setups (e.g., cluster mode), each process will have its own Configs instance.

### Q: Can I reset the configuration?

**A:** Yes, use `Configs.reset()` to clear all configurations. This is mainly useful for testing.

## License

Nehonix OSL (NOSL)- Part of the XyPriss framework

