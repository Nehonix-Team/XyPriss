# Environment Variables

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Environment Variables API (`__sys__.__ENV__`) provides a type-safe, intuitive interface for interacting with `process.env`. This API abstracts direct environment variable manipulation and provides consistent error handling and default value support.

## API Reference

### `__ENV__.get(key: string, defaultValue?: string): string | undefined`

Retrieves an environment variable with an optional default value.

**Parameters:**

-   `key` - The environment variable name
-   `defaultValue` - (Optional) Value to return if the variable is not set

**Returns:** The variable value, default value, or `undefined`

**Examples:**

```typescript
// Basic retrieval
const nodeEnv = __sys__.__ENV__.get("NODE_ENV");
console.log(nodeEnv); // "development" or undefined

// With default value
const port = __sys__.__ENV__.get("PORT", "3000");
console.log(port); // "3000" if PORT is not set

// Database configuration
const dbHost = __sys__.__ENV__.get("DB_HOST", "localhost");
const dbPort = __sys__.__ENV__.get("DB_PORT", "5432");
const dbName = __sys__.__ENV__.get("DB_NAME", "myapp");
```

**Type Safety:**

```typescript
// Convert to number
const port = parseInt(__sys__.__ENV__.get("PORT", "3000"));

// Convert to boolean
const debugMode = __sys__.__ENV__.get("DEBUG", "false") === "true";

// Parse JSON
const config = JSON.parse(__sys__.__ENV__.get("CONFIG", "{}"));
```

### `__ENV__.set(key: string, value: string): void`

Sets an environment variable.

**Parameters:**

-   `key` - The environment variable name
-   `value` - The value to set (must be a string)

**Examples:**

```typescript
// Set a variable
__sys__.__ENV__.set("API_KEY", "sk-1234567890");

// Set from configuration
__sys__.__ENV__.set("NODE_ENV", __sys__.__env__);

// Set computed value
const port = __sys__.__port__.toString();
__sys__.__ENV__.set("PORT", port);
```

**Important Notes:**

-   Changes affect only the current process
-   Child processes inherit the environment at spawn time
-   Changes do not persist across process restarts

### `__ENV__.has(key: string): boolean`

Checks if an environment variable is defined.

**Parameters:**

-   `key` - The environment variable name

**Returns:** `true` if the variable exists, `false` otherwise

**Examples:**

```typescript
// Check before use
if (__sys__.__ENV__.has("DATABASE_URL")) {
    const dbUrl = __sys__.__ENV__.get("DATABASE_URL");
    // Connect to database
}

// Validate required variables
const required = ["API_KEY", "SECRET_KEY", "DATABASE_URL"];
const missing = required.filter((key) => !__sys__.__ENV__.has(key));

if (missing.length > 0) {
    throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
    );
}
```

### `__ENV__.delete(key: string): void`

Removes an environment variable.

**Parameters:**

-   `key` - The environment variable name

**Examples:**

```typescript
// Remove a temporary variable
__sys__.__ENV__.delete("TEMP_TOKEN");

// Clear sensitive data
__sys__.__ENV__.delete("API_KEY");
__sys__.__ENV__.delete("SECRET_KEY");
```

**Warning:** Deleting environment variables can cause unexpected behavior in libraries that cache their values at initialization.

### `__ENV__.all(): NodeJS.ProcessEnv`

Returns all environment variables as an object.

**Returns:** Dictionary of all environment variables

**Examples:**

```typescript
// Get all variables
const env = __sys__.__ENV__.all();
console.log(env);

// Filter by prefix
const appVars = Object.entries(__sys__.__ENV__.all())
    .filter(([key]) => key.startsWith("APP_"))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

// Count variables
const count = Object.keys(__sys__.__ENV__.all()).length;
console.log(`Environment has ${count} variables`);
```

**Security Note:** Be cautious when logging or exposing all environment variables, as they may contain sensitive information.

## Common Patterns

### Configuration Loading

```typescript
interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
}

function loadDatabaseConfig(): DatabaseConfig {
    return {
        host: __sys__.__ENV__.get("DB_HOST", "localhost"),
        port: parseInt(__sys__.__ENV__.get("DB_PORT", "5432")),
        database: __sys__.__ENV__.get("DB_NAME", "myapp"),
        username: __sys__.__ENV__.get("DB_USER", "postgres"),
        password: __sys__.__ENV__.get("DB_PASSWORD", ""),
    };
}

const dbConfig = loadDatabaseConfig();
```

### Feature Flags

```typescript
const features = {
    enableCache: __sys__.__ENV__.get("FEATURE_CACHE", "true") === "true",
    enableMetrics: __sys__.__ENV__.get("FEATURE_METRICS", "false") === "true",
    maxRetries: parseInt(__sys__.__ENV__.get("FEATURE_MAX_RETRIES", "3")),
};

if (features.enableCache) {
    // Initialize cache
}
```

### Environment-Specific Configuration

```typescript
const config = {
    logLevel: __sys__.$isProduction()
        ? __sys__.__ENV__.get("LOG_LEVEL", "error")
        : __sys__.__ENV__.get("LOG_LEVEL", "debug"),

    apiUrl: __sys__.$isProduction()
        ? __sys__.__ENV__.get("API_URL", "https://api.production.com")
        : __sys__.__ENV__.get("API_URL", "http://localhost:3000"),
};
```

### Validation and Defaults

```typescript
function getRequiredEnv(key: string): string {
    const value = __sys__.__ENV__.get(key);
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

function getNumberEnv(key: string, defaultValue: number): number {
    const value = __sys__.__ENV__.get(key);
    if (!value) return defaultValue;

    const parsed = parseInt(value);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
}

// Usage
const apiKey = getRequiredEnv("API_KEY");
const port = getNumberEnv("PORT", 3000);
```

## Best Practices

### 1. Use Defaults Wisely

Always provide sensible defaults for non-critical configuration:

```typescript
// Good: Provides default
const timeout = parseInt(__sys__.__ENV__.get("REQUEST_TIMEOUT", "30000"));

// Avoid: No default for optional config
const timeout = parseInt(__sys__.__ENV__.get("REQUEST_TIMEOUT"));
```

### 2. Validate Early

Validate required environment variables at application startup:

```typescript
// At application entry point
const requiredVars = ["DATABASE_URL", "API_KEY", "SECRET_KEY"];

for (const varName of requiredVars) {
    if (!__sys__.__ENV__.has(varName)) {
        console.error(`Missing required environment variable: ${varName}`);
        process.exit(1);
    }
}
```

### 3. Type Conversion

Always convert environment variables to the appropriate type:

```typescript
// String to number
const port = parseInt(__sys__.__ENV__.get("PORT", "3000"));

// String to boolean
const debug = __sys__.__ENV__.get("DEBUG", "false") === "true";

// String to array
const allowedOrigins = __sys__.__ENV__.get("ALLOWED_ORIGINS", "").split(",");

// String to JSON
const config = JSON.parse(__sys__.__ENV__.get("CONFIG", "{}"));
```

### 4. Avoid Hardcoding Secrets

Never hardcode sensitive values. Always use environment variables:

```typescript
// Bad
const apiKey = "sk-1234567890";

// Good
const apiKey = __sys__.__ENV__.get("API_KEY");
if (!apiKey) {
    throw new Error("API_KEY environment variable is required");
}
```

### 5. Document Expected Variables

Maintain a list of expected environment variables:

```typescript
/**
 * Expected Environment Variables:
 *
 * Required:
 * - DATABASE_URL: PostgreSQL connection string
 * - API_KEY: External API authentication key
 * - SECRET_KEY: Application secret for JWT signing
 *
 * Optional:
 * - PORT: Server port (default: 3000)
 * - LOG_LEVEL: Logging level (default: info)
 * - CACHE_TTL: Cache time-to-live in seconds (default: 3600)
 */
```

### 6. Use .env Files in Development

For local development, use a `.env` file with a library like `dotenv`:

```typescript
// Load .env file in development
if (__sys__.$isDevelopment()) {
    require("dotenv").config();
}

// Now environment variables are available
const dbUrl = __sys__.__ENV__.get("DATABASE_URL");
```

## Security Considerations

### 1. Never Log Sensitive Variables

```typescript
// Bad: Logs all environment variables
console.log(__sys__.__ENV__.all());

// Good: Log only non-sensitive variables
const safeVars = {
    NODE_ENV: __sys__.__ENV__.get("NODE_ENV"),
    PORT: __sys__.__ENV__.get("PORT"),
};
console.log(safeVars);
```

### 2. Sanitize Before Exposure

```typescript
function getSafeEnvironment(): Record<string, string> {
    const sensitive = ["API_KEY", "SECRET_KEY", "PASSWORD", "TOKEN"];
    const env = __sys__.__ENV__.all();

    return Object.entries(env)
        .filter(([key]) => !sensitive.some((s) => key.includes(s)))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
}
```

### 3. Validate Input

```typescript
function getValidatedPort(): number {
    const portStr = __sys__.__ENV__.get("PORT", "3000");
    const port = parseInt(portStr);

    if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT value: ${portStr}`);
    }

    return port;
}
```

## Integration with **sys** Configuration

Environment variables can be synchronized with `__sys__` configuration:

```typescript
// Sync environment to system config
__sys__.$update({
    __env__: __sys__.__ENV__.get("NODE_ENV", "development"),
    __port__: parseInt(__sys__.__ENV__.get("PORT", "3000")),
});

// Sync system config to environment
__sys__.__ENV__.set("NODE_ENV", __sys__.__env__);
__sys__.__ENV__.set("PORT", __sys__.__port__.toString());
```

## Testing

### Mocking Environment Variables

```typescript
// Save original environment
const originalEnv = { ...process.env };

// Set test environment
__sys__.__ENV__.set("NODE_ENV", "test");
__sys__.__ENV__.set("DATABASE_URL", "postgresql://localhost/test");

// Run tests...

// Restore original environment
process.env = originalEnv;
```

### Isolated Test Environment

```typescript
describe("Environment Configuration", () => {
    beforeEach(() => {
        // Clear test-specific variables
        __sys__.__ENV__.delete("TEST_VAR");
    });

    it("should use default value when variable is not set", () => {
        const value = __sys__.__ENV__.get("TEST_VAR", "default");
        expect(value).toBe("default");
    });

    it("should return set value", () => {
        __sys__.__ENV__.set("TEST_VAR", "custom");
        const value = __sys__.__ENV__.get("TEST_VAR");
        expect(value).toBe("custom");
    });
});
```

## Related Documentation

-   [Configuration Management](./configuration.md)
-   [Metadata Properties](./metadata.md)
-   [System Health](./system-health.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12

