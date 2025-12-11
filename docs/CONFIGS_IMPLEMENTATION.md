# XyPriss Configs API - Implementation Summary

## Problem Solved

In modular structures, accessing `app.configs` before the app is fully initialized causes the error:

```
"cannot access app before initialization"
```

## Solution

Created a **type-safe, singleton-based configuration manager** (`Configs`) that:

1. ✅ Automatically populates when `createServer()` is called
2. ✅ Provides safe access to configurations anywhere in your code
3. ✅ Fully type-safe with TypeScript autocomplete
4. ✅ No initialization timing issues

## Implementation

### 1. Core Configuration Manager (`src/config.ts`)

```typescript
import { Configs, getConfig, setConfig } from "xypriss";
import type { ConfigKey } from "xypriss";
```

**Key Features:**

-   Singleton pattern ensures one global config instance
-   Automatically populated by `createServer()`
-   Type-safe with full TypeScript support
-   Deep merge support for nested configurations

### 2. Type-Safe File Upload Integration

**Before (with initialization issues):**

```typescript
import { createServer } from "xypriss";
import { FileUploadAPI } from "xypriss";

const app = createServer({
    /* ... */
});

// ❌ Might fail with "cannot access before initialization"
const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);
```

**After (type-safe and reliable):**

```typescript
import { createServer, Configs } from "xypriss";
import { FileUploadAPI } from "xypriss";
import type { FileUploadConfig } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024,
        storage: "memory",
    },
});

// ✅ Type-safe and always works
const upload = new FileUploadAPI();
await upload.initialize(Configs.get("fileUpload"));
```

## API Reference

### Configuration Access

```typescript
// Get specific configuration (type-safe)
const fileUploadConfig = Configs.get("fileUpload"); // FileUploadConfig | undefined
const securityConfig = Configs.get("security"); // SecurityConfig | undefined
const serverConfig = Configs.get("server"); // ServerConfig | undefined

// Get all configurations
const allConfigs = Configs.getAll(); // ServerOptions

// Check if config exists
if (Configs.has("fileUpload")) {
    // Config is available
}

// Get with default value
const monitoring = Configs.getOrDefault("monitoring", {
    enabled: true,
    healthChecks: true,
});
```

### Configuration Updates

```typescript
// Update specific section
Configs.update("fileUpload", {
    enabled: true,
    maxFileSize: 20 * 1024 * 1024,
});

// Merge configurations (deep merge)
Configs.merge({
    fileUpload: {
        maxFileSize: 15 * 1024 * 1024,
        // Other properties preserved
    },
    performance: {
        optimizationEnabled: true,
    },
});

// Set entire configuration
Configs.set({
    server: { port: 3000 },
    fileUpload: { enabled: true },
});
```

### Utility Methods

```typescript
// Check initialization status
if (Configs.isInitialized()) {
    console.log("Configs ready");
}

// Delete a configuration section
Configs.delete("fileUpload");

// Reset all configurations (useful for testing)
Configs.reset();
```

## Type Safety Features

### 1. FileUploadAPI with Type-Safe Initialize

```typescript
class FileUploadAPI {
    /**
     * Initialize with type-safe configuration
     * @param options - File upload configuration (optional)
     */
    async initialize(options?: FileUploadConfig): Promise<void> {
        const config: FileUploadConfig = options || { enabled: false };
        // ... initialization logic
    }
}
```

### 2. TypeScript Autocomplete

```typescript
// Full autocomplete support for all config keys
Configs.get("fileUpload"); // ✅ Autocomplete works
Configs.get("security"); // ✅ Autocomplete works
Configs.get("performance"); // ✅ Autocomplete works
Configs.get("invalidKey"); // ❌ TypeScript error
```

### 3. Type-Safe Configuration Keys

```typescript
import type { ConfigKey } from "xypriss";

const key: ConfigKey = "fileUpload"; // ✅ Type-safe
const config = Configs.get(key); // ✅ Properly typed
```

## Usage Patterns

### Pattern 1: Modular Service

```typescript
import { Configs } from "xypriss";
import { FileUploadAPI } from "xypriss";
import type { FileUploadConfig } from "xypriss";

class FileService {
    private upload: FileUploadAPI;

    constructor() {
        this.upload = new FileUploadAPI();
    }

    async initialize() {
        // Type-safe config access
        const config: FileUploadConfig | undefined = Configs.get("fileUpload");

        if (!config?.enabled) {
            throw new Error("File upload not enabled");
        }

        await this.upload.initialize(config);
    }
}
```

### Pattern 2: Conditional Middleware Setup

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

### Pattern 3: Environment-Specific Configuration

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

### Pattern 4: Configuration Validation

```typescript
import { Configs } from "xypriss";

function validateRequiredConfigs() {
    const required: Array<keyof ServerOptions> = ["server", "security"];

    for (const key of required) {
        if (!Configs.has(key)) {
            throw new Error(`Missing required configuration: ${key}`);
        }
    }
}
```

## Available Configuration Keys

All `ServerOptions` keys are supported with full type safety:

| Key                 | Type                                      | Description                |
| ------------------- | ----------------------------------------- | -------------------------- |
| `env`               | `'development' \| 'production' \| 'test'` | Environment mode           |
| `cache`             | `CacheConfig`                             | Cache configuration        |
| `performance`       | `PerformanceConfig`                       | Performance settings       |
| `monitoring`        | `MonitoringConfig`                        | Monitoring configuration   |
| `server`            | `ServerConfig`                            | Server settings            |
| `multiServer`       | `MultiServerConfig`                       | Multi-server configuration |
| `requestManagement` | `RequestManagementConfig`                 | Request management         |
| `fileUpload`        | `FileUploadConfig`                        | File upload configuration  |
| `security`          | `SecurityConfig`                          | Security settings          |
| `cluster`           | `ClusterConfig`                           | Cluster configuration      |
| `logging`           | `LogConfig`                               | Logging configuration      |
| `middleware`        | `MiddlewareConfig`                        | Middleware configuration   |

## Files Modified

1. **`src/config.ts`** (NEW)

    - Configuration manager implementation
    - Singleton pattern with type safety
    - Full API for get/set/update/merge operations

2. **`src/server/ServerFactory.ts`**

    - Auto-populate Configs on `createServer()`
    - Merge final options after worker mode handling

3. **`src/file-upload.ts`**

    - Updated `initialize()` to use `FileUploadConfig` type
    - Made `options` parameter optional with default
    - Exported `FileUploadConfig` type

4. **`src/index.ts`**
    - Exported `Configs`, `getConfig`, `setConfig`
    - Exported `ConfigKey` type

## Examples

See:

-   `.private/upload_serv.ts` - Basic usage example
-   `.private/configs-example.ts` - Comprehensive examples
-   `docs/CONFIGS_API.md` - Full documentation

## Benefits

✅ **Type Safety**: Full TypeScript support with autocomplete
✅ **No Initialization Issues**: Works in any modular structure
✅ **Clean API**: Simple, intuitive methods
✅ **Automatic**: Populated automatically by `createServer()`
✅ **Flexible**: Get, set, update, merge operations
✅ **Validated**: Optional parameter with sensible defaults

## Migration Guide

### Old Code (Problematic)

```typescript
const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload); // ❌ May fail
```

### New Code (Type-Safe)

```typescript
import { Configs } from "xypriss";
import type { FileUploadConfig } from "xypriss";

const upload = new FileUploadAPI();
const config: FileUploadConfig | undefined = Configs.get("fileUpload");
await upload.initialize(config); // ✅ Type-safe and reliable
```

## Testing

```typescript
import { Configs } from "xypriss";

// Reset before each test
beforeEach(() => {
    Configs.reset();
});

// Set test configuration
Configs.set({
    fileUpload: {
        enabled: true,
        maxFileSize: 1024 * 1024,
    },
});

// Run tests...
```

## Best Practices

1. ✅ Use `Configs.get()` in modular code
2. ✅ Check with `Configs.has()` before accessing optional configs
3. ✅ Use `Configs.getOrDefault()` for configs with defaults
4. ✅ Validate required configs at startup
5. ✅ Use `Configs.merge()` for partial updates
6. ✅ Import types for better type safety

## Conclusion

The Configs API provides a **type-safe, reliable solution** for accessing XyPriss configurations in modular structures, eliminating initialization timing issues while maintaining full TypeScript support.

