# Configs API - Quick Reference

## Import

```typescript
import { Configs }Uploadpriss";
import type { ConfigKey, FileUploadConfig } from "xypriss";
```

## Basic Usage

```typescript
// Get configuration (type-safe)
const config = Configs.get("fileUpload");

// Get with default
const config = Configs.getOrDefault("fileUpload", { enabled: false });

// Check existence
if (Configs.has("fileUpload")) {
    /* ... */
}

// Get all configs
const all = Configs.getAll();
```

## Type-Safe File Upload

```typescript
import { FileUploadAPI } from "xypriss";
import type { FileUploadConfig } from "xypriss";

const upload = new FileUploadAPI();
const config: FileUploadConfig | undefined = Configs.get("fileUpload");
await upload.initialize(config);
```

## Update Configuration

```typescript
// Update specific section
Configs.update("fileUpload", {
    enabled: true,
    maxFileSize: 20 * 1024 * 1024,
});

// Merge (deep merge for nested objects)
Configs.merge({
    fileUpload: { maxFileSize: 15 * 1024 * 1024 },
});

// Set entire config
Configs.set({ server: { port: 3000 } });
```

## Available Keys

-   `env` - Environment mode
-   `cache` - Cache configuration
-   `performance` - Performance settings
-   `monitoring` - Monitoring config
-   `server` - Server settings
-   `multiServer` - Multi-server config
-   `requestManagement` - Request management
-   `fileUpload` - File upload config ⭐
-   `security` - Security settings
-   `cluster` - Cluster config
-   `logging` - Logging config
-   `middleware` - Middleware config

## Common Patterns

### Pattern 1: Modular Service

```typescript
class MyService {
    async initialize() {
        const config = Configs.get("fileUpload");
        if (!config?.enabled) throw new Error("Not enabled");
        // Use config...
    }
}
```

### Pattern 2: Validation

```typescript
function validate() {
    const required: Array<keyof ServerOptions> = ["server", "security"];
    return required.every((key) => Configs.has(key));
}
```

### Pattern 3: Conditional Setup

```typescript
const security = Configs.get("security");
if (security?.enabled) {
    app.middleware().security(security);
}
```

## Migration

**Before:**

```typescript
await upload.initialize(app.configs?.fileUpload); // ❌ May fail
```

**After:**

```typescript
await upload.initialize(Configs.get("fileUpload")); // ✅ Type-safe
```

## See Also

-   `docs/CONFIGS_API.md` - Full documentation
-   `docs/CONFIGS_IMPLEMENTATION.md` - Implementation details
-   `.private/configs-example.ts` - Comprehensive examples
-   `.private/type-safe-configs.ts` - Type-safe examples

