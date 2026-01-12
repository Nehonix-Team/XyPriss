# System Globals (**sys**)

XyPriss 4.4.0 introduces a new native global object `__sys__` that provides centralized access to system variables, configuration management, and environment utilities. This feature eliminates the need for manual imports of system configurations in your application files. 

> **Note**: This feature is available in XyPriss version **4.4.0** and above.

## Overview

The `__sys__` object is a globally available instance of the `XyPrissSys` class. It is automatically initialized when XyPriss is loaded and is synchronized with your server configuration.

## Native Variables

All native system variables use a double-underscore prefix and suffix for clarity and to avoid collisions with user-defined properties.

| Variable          | Description                                         | Default                   |
| ----------------- | --------------------------------------------------- | ------------------------- |
| `__version__`     | Application version string                          | `"0.0.0"`                 |
| `__author__`      | Application author name                             | `"unknown"`               |
| `__name__`        | Application name identifier                         | `"xypriss-app"`           |
| `__description__` | Application description                             | `"A XyPriss application"` |
| `__alias__`       | Application short name                              | `"app"`                   |
| `__port__`        | Server port number                                  | `3000`                    |
| `__PORT__`        | Alias for `__port__`                                | `3000`                    |
| `__env__`         | Current environment (development, production, etc.) | `"development"`           |
| `__app_urls__`    | Collection of application URLs                      | `{}`                      |

## Environment Management (**ENV**)

The `__sys__.__ENV__` object provides a clean API to manipulate `process.env` variables.

```typescript
// Set an environment variable
__sys__.__ENV__.set("API_KEY", "secret123");

// Get an environment variable with optional default
const apiKey = __sys__.__ENV__.get("API_KEY", "default-key");

// Check if a variable exists
if (__sys__.__ENV__.has("DATABASE_URL")) {
    // ...
}

// Delete a variable
__sys__.__ENV__.delete("TEMP_VAR");

// Get all environment variables
const allEnv = __sys__.__ENV__.all();
```

## Utility Methods

System methods are prefixed with a `$` sign.

### Environment Checks

```typescript
if (__sys__.$isProduction()) {
    // Production-only logic
}

if (__sys__.$isDevelopment()) {
    // Development-only logic
}

if (__sys__.$isTest()) {
    // Test-only logic
}

if (__sys__.$isEnvironment("staging")) {
    // Custom environment check
}
```

### Variable Management

```typescript
// Add or update a variable
__sys__.$add("myService", { status: "ok" });

// Get a variable with a default value (type-safe)
const status = __sys__.$get<string>("myService.status", "error");

// Check if a variable exists
if (__sys__.$has("myService")) {
    // ...
}

// Remove a variable
__sys__.$remove("myService");

// Update multiple variables at once
__sys__.$update({
    __version__: "1.1.0",
    customVar: "value",
});
```

### Serialization and Introspection

```typescript
// Get all variable keys (excluding methods and __ENV__)
const keys = __sys__.$keys();

// Export all variables as a plain object
const config = __sys__.$toJSON();

// Reset all variables to defaults
__sys__.$reset();

// Clone the current system state
const sysClone = __sys__.$clone();
```

## Best Practices

1. **Use `__sys__` for Configuration**: Instead of hardcoding values or importing local config files everywhere, use `__sys__` to access application-wide settings.
2. **Type Safety**: When using `$get`, always provide a generic type for better IDE support: `__sys__.$get<number>('__port__')`.
3. **Avoid Manual Imports**: In XyPriss 4.4+, you no longer need to import `_sys` from your project structure.

