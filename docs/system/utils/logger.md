# System Logger (`__sys__.utils.log`)

The `LoggerUtils` provides a structured, colorful, and high-performance console logger natively built into the XyPriss system. It is accessible globally via `__sys__.utils.log` and allows for named namespaces, timed blocks, nested child loggers, and plain text modes.

## Quick Start

You can use the default global logger to emit messages anywhere in your application:

```typescript
// Basic logging
__sys__.utils.log.info("Application ready");
__sys__.utils.log.success("Database connected");
__sys__.utils.log.warn("High memory usage", { memory: "1.2GB" });
__sys__.utils.log.error("Failed to parse request", new Error("Invalid JSON"));
```

## Creating a Scoped Logger

For larger applications, it's highly recommended to use namespaced loggers. This prepends a unique tag to all logs, making it easier to filter console output by module.

```typescript
const log = __sys__.utils.createLogger({ 
  namespace: "Auth", 
  minLevel: "debug" 
});

log.debug("Authenticating user...");
log.success("User logged in successfully");
```

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `namespace` | `string` | `""` | A prefix shown in every log line (e.g., `[Auth]`). |
| `minLevel` | `LogLevel` | `"debug"` | Minimum level to display. Supported levels: `debug`, `info`, `success`, `warn`, `error`, `fatal`. |
| `timestamps` | `boolean` | `true` | Include an ISO timestamp in every line. |
| `plain` | `boolean` | `false` | Emit plain text with no ANSI color codes (ideal for CI/CD environments or writing to files). |

## Advanced Features

### Timers

The `.time()` method returns a stop function. Calling the stop function automatically logs the elapsed time.

```typescript
const stopTimer = __sys__.utils.log.time("Database query");

// Execute operations...
await fetchUsersFromDatabase();

// Outputs: ✅ [MyApp] Database query — 42.15 ms
stopTimer();
```

### Grouping

Groups allow you to visually separate sequential logs under a header block.

```typescript
__sys__.utils.log.group("Bootstrap Sequence", () => {
  __sys__.utils.log.info("Loading environment variables...");
  __sys__.utils.log.info("Initializing cache...");
  __sys__.utils.log.success("Bootstrap complete");
});
```

### Child Loggers

You can inherit the configuration of an existing logger and append to its namespace by calling `.child()`.

```typescript
const baseLog = __sys__.utils.createLogger({ namespace: "Core" });
const networkLog = baseLog.child("Network"); // Namespace becomes "Core:Network"

networkLog.warn("Connection timeout");
```

### Formatting Extra Arguments

Extra arguments (objects, arrays, errors) passed to log methods are automatically formatted for readability.

```typescript
__sys__.utils.log.warn("Rate limit approaching", { 
    userId: "u_123",
    remaining: 5,
    resetIn: "2m" 
});
// The object will be nicely stringified and indented below the message.
```
