# Configuration Management

**Version Compatibility:** XyPriss v9.5.0 and above

## Overview

The Configuration Management system in XyPriss provides a centralized, type-safe interface for managing application metadata, runtime settings, and custom configuration values. All configuration is accessible through the global `__sys__` instance.

## Core Configuration Properties

### Application Metadata

#### `__version__`

**Type:** `string`  
**Default:** `"0.0.0"`  
**Description:** The semantic version of your application.

```typescript
__sys__.vars.__version__ = "1.2.3";
console.log(`Running version: ${__sys__.vars.__version__}`);
```

#### `__name__`

**Type:** `string`  
**Default:** `"xypriss-app"`  
**Description:** The application name (kebab-case recommended).

```typescript
__sys__.vars.__name__ = "my-api-server";
```

#### `__alias__`

**Type:** `string`  
**Default:** `"app"`  
**Description:** Short alias for CLI or logging purposes.

```typescript
__sys__.vars.__alias__ = "api";
console.log(`[${__sys__.vars.__alias__}] Server started`);
```

#### `__author__`

**Type:** `string`  
**Default:** `"unknown"`  
**Description:** Application author or organization name.

```typescript
__sys__.vars.__author__ = "Nehonix Team";
```

#### `__description__`

**Type:** `string`  
**Default:** `"A XyPriss application"`  
**Description:** Brief description of the application.

```typescript
__sys__.vars.__description__ = "High-performance REST API server";
```

### Runtime Configuration

#### `__port__` / `__PORT__`

**Type:** `number`  
**Default:** `3000`  
**Description:** Primary server listening port. Both properties are synchronized.

```typescript
// Setting either property updates both
__sys__.vars.__port__ = 8080;
console.log(__sys__.vars.__PORT__); // 8080

__sys__.vars.__PORT__ = 9000;
console.log(__sys__.vars.__port__); // 9000
```

#### `__env__`

**Type:** `string`  
**Default:** `"development"`  
**Description:** Current execution environment.

**Common Values:**

-   `"development"` - Local development
-   `"production"` - Production deployment
-   `"staging"` - Staging environment
-   `"test"` - Testing environment

```typescript
// __sys__.__env__ cannot be reassigned; the mode ("production") is determined at boot.

// Use helper methods for checks
if (__sys__.__env__.isProduction()) {
    // Production-specific logic
}
```

#### `__root__`

**Type:** `string`  
**Default:** `process.cwd()`  
**Description:** Absolute path to the project root directory.

```typescript
console.log(`Project root: ${__sys__.vars.__root__}`);
```

#### `__app_urls__`

**Type:** `Record<string, string>`  
**Default:** `{}`  
**Description:** Map of application-specific URLs.

```typescript
__sys__.vars.__app_urls__ = {
    api: "https://api.example.com",
    docs: "https://docs.example.com",
    frontend: "https://app.example.com",
};

console.log(__sys__.vars.__app_urls__.api);
```

## Configuration Methods

### `__sys__.vars.update(data: Record<string, any>): void`

Merges a configuration object into the system state. Handles intelligent synchronization of related properties.

```typescript
__sys__.vars.update({
    __version__: "2.0.0",
    __port__: 8080,
    __env__: "production",
    customKey: "customValue",
});
```

**Behavior:**

-   Performs shallow merge of provided data
-   Automatically synchronizes `__port__` and `__PORT__`
-   Preserves existing properties not specified in the update

### `__sys__.vars.set(key: string, value: any): void`

Dynamically adds a custom property to the system configuration.

```typescript
__sys__.vars.set("databaseUrl", "postgresql://localhost:5432/mydb");
console.log(__sys__.databaseUrl); // "postgresql://localhost:5432/mydb"
```

**Use Cases:**

-   Runtime configuration injection
-   Plugin-specific settings
-   Dynamic feature flags

### `__sys__.vars.get<T>(key: string, defaultValue?: T): T`

Safely retrieves a configuration value with an optional fallback.

```typescript
const dbUrl = __sys__.vars.get(
    "databaseUrl",
    "postgresql://localhost:5432/default"
);
const timeout = __sys__.vars.get<number>("requestTimeout", 30000);
```

**Type Safety:**

```typescript
// Generic type parameter ensures type safety
const port: number = __sys__.vars.get<number>("__port__", 3000);
```

### `__sys__.vars.has(key: string): boolean`

Checks if a configuration key exists.

```typescript
if (__sys__.vars.has("databaseUrl")) {
    // Database configuration is available
}
```

### `__sys__.vars.delete(key: string): boolean`

Removes a custom property from the configuration.

```typescript
const removed = __sys__.vars.delete("temporaryFlag");
console.log(removed); // true if property existed, false otherwise
```

**Note:** Cannot remove core system properties (`__version__`, `__port__`, etc.).

### `__sys__.vars.keys(): string[]`

Returns an array of all configuration keys, excluding internal methods and API properties.

```typescript
const keys = __sys__.vars.keys();
console.log(keys); // ["__version__", "__name__", "__port__", "customKey", ...]
```

**Filtering:**

-   Excludes properties starting with `__sys__.` (methods)
-   Excludes `__ENV__` manager
-   Excludes internal API references

### `__sys__.toJSON(): Record<string, any>`

Serializes the configuration to a plain JSON object.

```typescript
const config = __sys__.toJSON();
console.log(JSON.stringify(config, null, 2));
```

**Output Example:**

```json
{
    "__version__": "1.0.0",
    "__name__": "my-app",
    "__port__": 8080,
    "__env__": "production",
    "customKey": "value"
}
```

### `__sys__.vars.reset(): void`

Resets all configuration to default values.

```typescript
__sys__.vars.reset();
console.log(__sys__.vars.__version__); // "0.0.0"
console.log(__sys__.vars.__port__); // 3000
```

**Warning:** This operation is destructive and cannot be undone. Use with caution.

### `__sys__.vars.clone(): XyPrissSys`

Creates a deep independent copy of the current configuration.

```typescript
const backup = __sys__.vars.clone();

// Modify current config
__sys__.vars.__port__ = 9000;

// Backup remains unchanged
console.log(backup.__port__); // Original value
```

## Environment Helper Methods

### `__sys__.isProduction(): boolean`

Returns `true` if `__env__` is `"production"`.

```typescript
if (__sys__.__env__.isProduction()) {
    // Enable production optimizations
}
```

### `__sys__.isDevelopment(): boolean`

Returns `true` if `__env__` is `"development"`.

```typescript
if (__sys__.__env__.isDevelopment()) {
    // Enable debug logging
}
```

### `__sys__.isStaging(): boolean`

Returns `true` if `__env__` is `"staging"`.

```typescript
if (__sys__.__env__.isStaging()) {
    // Use staging database
}
```

### `__sys__.isTest(): boolean`

Returns `true` if `__env__` is `"test"`.

```typescript
if (__sys__.__env__.isTest()) {
    // Use test fixtures
}
```

### `__sys__.isEnvironment(envName: string): boolean`

Checks if `__env__` matches a custom environment name.

```typescript
if (__sys__.__env__.isEnvironment("qa")) {
    // QA-specific configuration
}
```

## Best Practices

### 1. Initialize Early

Set configuration values as early as possible in your application lifecycle:

```typescript
import { createServer } from "xypriss";

// Configure before server creation
__sys__.vars.update({
    __version__: "1.0.0",
    __name__: "my-api",
    __env__: process.env.NODE_ENV || "development",
});

const app = createServer({
    server: { port: __sys__.vars.__port__ },
});
```

### 2. Use Type-Safe Getters

Always use `__sys__.get<T>()` with explicit types for custom configuration:

```typescript
const maxConnections = __sys__.vars.get<number>("maxConnections", 100);
const apiKey = __sys__.vars.get<string>("apiKey");
```

### 3. Validate Critical Configuration

Check for required configuration at startup:

```typescript
const requiredKeys = ["databaseUrl", "apiKey", "secretKey"];

for (const key of requiredKeys) {
    if (!__sys__.vars.has(key)) {
        throw new Error(`Missing required configuration: ${key}`);
    }
}
```

### 4. Avoid Runtime Mutations in Production

Configuration should be set during initialization. Avoid modifying configuration at runtime in production:

```typescript
// Good: Set during initialization
__sys__.vars.update({ maxRetries: 3 });

// Avoid: Runtime modification
if (someCondition) {
    __sys__.vars.__port__ = 9000; // Risky in production
}
```

### 5. Document Custom Properties

When adding custom configuration, document the expected structure:

```typescript
interface CustomConfig {
    databaseUrl: string;
    redisHost: string;
    maxConnections: number;
}

__sys__.vars.update({
    databaseUrl: "postgresql://...",
    redisHost: "localhost",
    maxConnections: 100,
} as CustomConfig);
```

## Integration with `__cfg__`

The `__sys__` configuration is separate from the `__cfg__` server configuration manager. Use `__sys__` for application-level metadata and `__cfg__` for server-specific settings.

```typescript
// Application metadata (use __sys__)
__sys__.vars.__version__ = "1.0.0";

// Server configuration (use __cfg__)
__cfg__.update("server", { port: 8080 });
```

## Thread Safety

The configuration system is not thread-safe. Avoid concurrent modifications from multiple execution contexts.

## Serialization

Configuration can be serialized for logging or debugging:

```typescript
import fs from "fs";

// Export configuration
const config = __sys__.toJSON();
fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

// Import configuration
const savedConfig = JSON.parse(fs.readFileSync("config.json", "utf-8"));
__sys__.vars.update(savedConfig);
```

## Related Documentation

-   [Environment Variables](./environment.md)
-   [Metadata Properties](./metadata.md)
-   [Global APIs Overview](../GLOBAL_APIS.md)

---

**Version:** XyPriss v9.5.0+  
**Last Updated:** 2026-01-12

