# XyPriss Configs API

A safe, singleton-based configuration manager for XyPriss that solves initialization timing issues in modular structures.

## The Problem

In modular applications, accessing `app.configs` directly can lead to "cannot access before initialization" errors if a service is instantiated before the server is fully started.

```typescript
import { createServer, FileUploadAPI } from "xypriss";

const app = createServer({
    /* ... */
});

// ❌ This might fail if app initialization isn't finished
const upload = new FileUploadAPI();
await upload.initialize(app.configs?.fileUpload);
```

## The Solution: The `Configs` Singleton

The `Configs` API provides a global, thread-local configuration store that is automatically populated by `createServer()`. It ensures a single source of truth across all modules.

```typescript
import { createServer, Configs, FileUploadAPI } from "xypriss";

const app = createServer({
    /* ... */
});

// ✅ Use the Configs singleton - safe and modular
const upload = new FileUploadAPI();
await upload.initialize(Configs);
```

---

## API Reference

### `Configs.get<K>(key: K)`

Retrieves a specific configuration section (e.g., `server`, `fileUpload`, `security`).

```typescript
const fileUpload = Configs.get("fileUpload");
if (fileUpload?.enabled) {
    // Handling logic...
}
```

### `Configs.set(config: ServerOptions)`

Overwrites the entire configuration. Handled automatically by the system.

### `Configs.merge(partial: Partial<ServerOptions>)`

Deep-merges new settings into the existing configuration. Useful for dynamic plugin settings.

### `Configs.has(key: string)`

Returns `true` if the specified configuration section is active.

---

## Advanced Usage

### Monitoring Configuration Changes

While the configuration is not inherently reactive, you can use the `Configs` API to synchronize settings between different layers of your application.

```typescript
import { Configs } from "xypriss";

function adjustLimits() {
    const current = Configs.get("fileUpload");
    Configs.update("fileUpload", {
        ...current,
        maxFileSize: 50 * 1024 * 1024, // Increase to 50MB
    });
}
```

### Multi-Server Scoping

In multi-server environments, `Configs` maintains the context for the current process, ensuring that worker nodes only receive relevant infrastructure settings.

---

## Technical Specifications

- **Thread Safety**: Isolated per process (important for Cluster mode).
- **Validation**: Enforces `ServerOptions` type safety.
- **Persistence**: Temporary (held in memory for the process lifecycle).

---

[← Back to Configuration Overview](./configuration.md)

