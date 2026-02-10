# Console Intercept Hook - Plugin Integration Guide

## Overview

The `onConsoleIntercept` hook is a **privileged plugin hook** that allows plugins to intercept and process all console output from the XyPriss server and user applications. This powerful feature enables advanced logging, monitoring, and analytics capabilities.

## Why Use This Hook?

-   **Centralized Log Management**: Capture all console output in one place
-   **External Monitoring**: Send logs to external services (Sentry, DataDog, etc.)
-   **Custom Analytics**: Analyze log patterns and trends
-   **Security Auditing**: Track and audit system-level errors
-   **Real-time Alerts**: Trigger alerts based on specific log patterns

## Security & Permissions

⚠️ **This is a Privileged Hook** - It is disabled by default for security reasons.

### Why is it Privileged?

Console logs can contain:

-   Sensitive user data
-   API keys or credentials
-   Internal system information
-   Stack traces with code details

### Requirements

To use this hook, you must:

1. **Enable Console Interception** in server configuration
2. **Grant Explicit Permission** to your plugin

## Configuration

### Step 1: Enable Console Interception

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true, // Enable the interception system
        },
    },
});
```

### Step 2: Grant Plugin Permission

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
        },
    },
    pluginPermissions: [
        {
            name: "my-log-plugin", // Your plugin name
            allowedHooks: [
                "PLG.LOGGING.CONSOLE_INTERCEPT", // Grant permission
            ],
        },
    ],
});
```

### Step 3: Implement the Hook in Your Plugin

```typescript
import { Plugin } from "xypriss";

Plugin.register({
    name: "my-log-plugin",
    version: "1.0.0",

    onConsoleIntercept(log) {
        // Your custom logic here
        console.log(`Intercepted: ${log.method} - ${log.args.join(" ")}`);
    },
});
```

## Hook Signature

```typescript
onConsoleIntercept(log: InterceptedConsoleCall): void | Promise<void>
```

### InterceptedConsoleCall Interface

```typescript
interface InterceptedConsoleCall {
    method: "log" | "info" | "warn" | "error" | "debug" | "trace";
    args: any[];
    timestamp: Date;
    category: "userApp" | "system" | "unknown";
    level: "info" | "warn" | "error" | "debug";
    source?: {
        file?: string;
        line?: number;
        column?: number;
    };
}
```

### Properties Explained

-   **method**: The console method that was called
-   **args**: Array of arguments passed to the console call
-   **timestamp**: When the log was generated
-   **category**: Classification of the log source
    -   `userApp`: Logs from your application code
    -   `system`: Logs from XyPriss internals
    -   `unknown`: Unable to classify
-   **level**: Severity level of the log
-   **source**: (Optional) Source code location if tracing is enabled

## Usage Examples

### Example 1: Basic Log Capture

```typescript
{
    name: "basic-logger",
    onConsoleIntercept(log) {
        // Log all console calls to a file
        fs.appendFileSync('app.log',
            `[${log.timestamp.toISOString()}] ${log.method}: ${log.args.join(' ')}\n`
        );
    }
}
```

### Example 2: Error Monitoring

```typescript
{
    name: "error-monitor",
    onConsoleIntercept(log) {
        // Send errors to external monitoring service
        if (log.method === 'error' && log.category === 'system') {
            sendToSentry({
                message: log.args.join(' '),
                timestamp: log.timestamp,
                source: log.source,
            });
        }
    }
}
```

### Example 3: Performance Tracking

```typescript
{
    name: "perf-tracker",
    onConsoleIntercept(log) {
        // Track performance-related logs
        const message = log.args.join(' ');
        if (message.includes('ms') || message.includes('performance')) {
            metrics.track('performance_log', {
                message,
                timestamp: log.timestamp,
            });
        }
    }
}
```

### Example 4: Custom Filtering

```typescript
{
    name: "filtered-logger",
    onConsoleIntercept(log) {
        // Only process user application errors
        if (log.category === 'userApp' && log.level === 'error') {
            // Custom error handling
            notifyDevelopers({
                error: log.args[0],
                context: log.args.slice(1),
            });
        }
    }
}
```

### Example 5: Log Aggregation

```typescript
{
    name: "log-aggregator",

    // Store logs in memory
    logs: [] as InterceptedConsoleCall[],

    onConsoleIntercept(log) {
        this.logs.push(log);

        // Flush every 100 logs
        if (this.logs.length >= 100) {
            this.flushLogs();
        }
    },

    flushLogs() {
        // Send batch to external service
        externalService.sendBatch(this.logs);
        this.logs = [];
    }
}
```

### Example 6: Real-time Dashboard

```typescript
{
    name: "dashboard-feed",
    onConsoleIntercept(log) {
        // Send to WebSocket clients for real-time monitoring
        websocketServer.broadcast({
            type: 'console_log',
            data: {
                method: log.method,
                message: log.args.join(' '),
                timestamp: log.timestamp,
                category: log.category,
            }
        });
    }
}
```

## Best Practices

### 1. Performance Considerations

Console interception can be called very frequently. Keep your hook implementation fast:

```typescript
{
    name: "optimized-logger",
    onConsoleIntercept(log) {
        // ✅ Good: Quick synchronous operation
        logBuffer.push(log);

        // ❌ Bad: Slow synchronous operation
        // fs.writeFileSync('log.txt', JSON.stringify(log));

        // ✅ Better: Async operation (non-blocking)
        // this.asyncLogHandler(log);
    }
}
```

### 2. Avoid Infinite Loops

Don't use `console.log` inside your hook (it will trigger the hook again):

```typescript
{
    name: "safe-logger",
    onConsoleIntercept(log) {
        // ❌ Bad: Creates infinite loop
        // console.log('Received log:', log);

        // ✅ Good: Use process.stdout directly
        process.stdout.write(`Received: ${log.method}\n`);

        // ✅ Good: Use a different logging mechanism
        this.externalLogger.write(log);
    }
}
```

### 3. Handle Errors Gracefully

```typescript
{
    name: "robust-logger",
    onConsoleIntercept(log) {
        try {
            // Your logic here
            this.processLog(log);
        } catch (error) {
            // Don't let errors break the logging system
            process.stderr.write(`Log processing error: ${error}\n`);
        }
    }
}
```

### 4. Filter Appropriately

Don't process every log if you don't need to:

```typescript
{
    name: "filtered-logger",
    onConsoleIntercept(log) {
        // Early return for logs you don't care about
        if (log.category === 'system' && log.level === 'debug') {
            return;
        }

        // Process only relevant logs
        this.processLog(log);
    }
}
```

## Permission Denied Handling

If your plugin attempts to use this hook without permission, you'll see:

```
[PLUGINS] Security Error: Plugin 'my-plugin' attempted to use hook 'PLG.LOGGING.CONSOLE_INTERCEPT'
but permission was denied (privileged hook requires explicit allowance).
```

**Solution**: Add the permission to your server configuration:

```typescript
pluginPermissions: [
    {
        name: "my-plugin",
        allowedHooks: ["PLG.LOGGING.CONSOLE_INTERCEPT"],
    },
];
```

## Complete Example

Here's a complete example of a log monitoring plugin:

```typescript
import { createServer, Plugin } from "xypriss";

// Define the plugin
Plugin.register({
    name: "log-monitor",
    version: "1.0.0",
    description: "Monitors and analyzes console logs",

    // Statistics
    stats: {
        totalLogs: 0,
        errorCount: 0,
        warnCount: 0,
    },

    onServerStart() {
        console.log("[LogMonitor] Started monitoring console logs");
    },

    onConsoleIntercept(log) {
        // Update statistics
        this.stats.totalLogs++;

        if (log.method === "error") {
            this.stats.errorCount++;
            this.handleError(log);
        } else if (log.method === "warn") {
            this.stats.warnCount++;
        }

        // Log to external service
        if (log.category === "userApp") {
            this.sendToExternalService(log);
        }
    },

    handleError(log) {
        // Send critical errors to monitoring service
        if (log.category === "system") {
            // Alert the team
            this.sendAlert({
                severity: "critical",
                message: log.args.join(" "),
                timestamp: log.timestamp,
            });
        }
    },

    sendToExternalService(log) {
        // Implementation here
    },

    sendAlert(alert) {
        // Implementation here
    },
});

// Create server with plugin enabled
const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
        },
    },
    pluginPermissions: [
        {
            name: "log-monitor",
            allowedHooks: [
                "PLG.LOGGING.CONSOLE_INTERCEPT",
                "PLG.LIFECYCLE.SERVER_START",
            ],
        },
    ],
});

await app.start();
```

## Related Documentation

-   [Plugin Core Hooks](./PLUGIN_CORE_HOOKS.md) - All available plugin hooks
-   [Console Interception Guide](./CONSOLE_INTERCEPTION_GUIDE.md) - Console interception system details
-   [Plugin Permissions](./PLUGIN_PERMISSIONS.md) - Plugin permission system
-   [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) - Complete plugin development guide

## Troubleshooting

### Hook Not Being Called

1. **Check if console interception is enabled**:

    ```typescript
    logging: {
        consoleInterception: {
            enabled: true;
        }
    }
    ```

2. **Verify plugin has permission**:

    ```typescript
    pluginPermissions: [
        {
            name: "your-plugin",
            allowedHooks: ["PLG.LOGGING.CONSOLE_INTERCEPT"],
        },
    ];
    ```

3. **Check plugin is registered**:
    ```typescript
    Plugin.register({ name: "your-plugin", onConsoleIntercept(log) { ... } })
    ```

### Performance Issues

If you notice performance degradation:

1. **Reduce processing in the hook** - Keep it lightweight
2. **Use async operations** - Don't block the event loop
3. **Add filtering** - Only process logs you need
4. **Batch operations** - Collect logs and process in batches

### Memory Leaks

If storing logs in memory:

1. **Implement a buffer limit**
2. **Flush regularly**
3. **Use a circular buffer**

```typescript
{
    name: "buffered-logger",
    buffer: [] as InterceptedConsoleCall[],
    maxBufferSize: 1000,

    onConsoleIntercept(log) {
        this.buffer.push(log);

        if (this.buffer.length >= this.maxBufferSize) {
            this.flush();
        }
    },

    flush() {
        // Process and clear buffer
        this.processLogs(this.buffer);
        this.buffer = [];
    }
}
```

## Summary

The `onConsoleIntercept` hook provides powerful capabilities for:

-   ✅ Centralized log management
-   ✅ External monitoring integration
-   ✅ Custom analytics and reporting
-   ✅ Security auditing
-   ✅ Real-time alerting

Remember to:

-   Enable console interception in server config
-   Grant explicit permission to your plugin
-   Keep your implementation performant
-   Avoid infinite loops with console.log
-   Handle errors gracefully

For more information, see the [Plugin Core Hooks documentation](./PLUGIN_CORE_HOOKS.md).

