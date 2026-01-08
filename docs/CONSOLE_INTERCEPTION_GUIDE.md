# XyPriss Console Interception Guide

## Overview

The **Console Interception System** is a powerful feature in XyPriss that intercepts all `console.log`, `console.error`, `console.warn`, etc. calls and routes them through the unified logging system. This provides enhanced control, filtering, encryption, and monitoring of console output.

## Why Use Console Interception?

✅ **Unified Logging** - All console output goes through one logging system  
✅ **Encryption** - Encrypt sensitive console logs for security  
✅ **Filtering** - Filter out noise and focus on important logs  
✅ **Source Mapping** - Track where logs originated from  
✅ **Performance Monitoring** - Track console overhead  
✅ **Production Ready** - Different modes for dev vs production

## Quick Start

### Basic Usage

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
        },
    },
});

await app.waitForReady();

// Now all console.log calls are intercepted!
console.log("This is being intercepted");

// Check stats to verify
const stats = app.getConsoleStats();
console.log(stats); // { totalInterceptions: X, isActive: true, ... }
```

### Important: How It Works

**Console interception works transparently in the background.** When enabled:

1. ✅ All `console.log`, `console.error`, `console.warn`, etc. calls are intercepted
2. ✅ They're routed through the logging system for filtering, encryption, etc.
3. ✅ The output you see depends on the `preserveOriginal.mode` setting

**What you see vs what's happening:**

| Mode          | What You See              | What's Happening                                            |
| ------------- | ------------------------- | ----------------------------------------------------------- |
| `original`    | Normal console output     | Intercepted + routed through logger + displayed as original |
| `intercepted` | `[USERAPP]` prefixed logs | Intercepted + formatted by logger                           |
| `both`        | Both outputs              | Intercepted + shown twice (original + formatted)            |
| `none`        | Nothing                   | Intercepted + captured but not displayed                    |

**The key point:** Even in `'original'` mode, interception IS working - you just see the original-looking output. Check `app.getConsoleStats()` to verify!

## Configuration

### Full Configuration Example

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            // Enable/disable the system
            enabled: true,

            // Which console methods to intercept
            interceptMethods: ["log", "error", "warn", "info", "debug"],

            // How to handle original console output
            preserveOriginal: {
                enabled: true,
                mode: "original", // 'original' | 'intercepted' | 'both' | 'none'
                showPrefix: false,
                onlyUserApp: true,
                colorize: true,
            },

            // Performance settings
            performanceMode: true,
            maxInterceptionsPerSecond: 1000,

            // Source tracking
            sourceMapping: true,
            stackTrace: false,

            // Filtering
            filters: {
                minLevel: "debug", // 'debug' | 'info' | 'warn' | 'error'
                maxLength: 1000,
                excludePatterns: ["node_modules", "internal"],
                includePatterns: [],
            },

            // Error handling
            fallback: {
                onError: "console", // 'silent' | 'console' | 'throw'
                gracefulDegradation: true,
                maxErrors: 10,
            },
        },
    },
});
```

## Preserve Modes

The `preserveOriginal.mode` setting controls how console output is displayed:

### Mode: `'original'` (Development - Default)

Shows original console output only, no duplication.

```typescript
logging: {
    consoleInterception: {
        enabled: true,
        preserveOriginal: {
            enabled: true,
            mode: 'original' // Show original console output
        }
    }
}
```

**Output:**

```
Hello World  // Original console.log output
```

**Use Case:** Development - you want to see console output as normal

### Mode: `'intercepted'` (Production)

Routes through logging system with prefixes and formatting.

```typescript
logging: {
    consoleInterception: {
        enabled: true,
        preserveOriginal: {
            enabled: true,
            mode: 'intercepted', // Route through logging system
            showPrefix: true
        }
    }
}
```

**Output:**

```
[USERAPP] Hello World  // Formatted through logging system
```

**Use Case:** Production - structured logging with timestamps and prefixes

### Mode: `'both'` (Debugging)

Shows both original and intercepted output.

```typescript
logging: {
    consoleInterception: {
        enabled: true,
        preserveOriginal: {
            enabled: true,
            mode: 'both' // Show both
        }
    }
}
```

**Output:**

```
Hello World              // Original
[USERAPP] Hello World    // Intercepted
```

**Use Case:** Debugging - compare original vs intercepted output

### Mode: `'none'` (Silent)

No console output at all (logs are still captured internally).

```typescript
logging: {
    consoleInterception: {
        enabled: true,
        preserveOriginal: {
            enabled: true,
            mode: 'none' // Silent mode
        }
    }
}
```

**Output:**

```
(nothing displayed)
```

**Use Case:** Testing - suppress all console output

## Preset Configurations

XyPriss provides ready-to-use presets:

### Development Preset

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "original",
                showPrefix: false,
                colorize: true,
            },
        },
    },
});
```

### Production Preset

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "intercepted",
                showPrefix: true,
                customPrefix: "[APP]",
                colorize: false,
            },
            filters: {
                minLevel: "info", // Filter out debug logs
                excludePatterns: ["node_modules"],
            },
        },
    },
});
```

### Debug Preset

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "both", // Show both for comparison
                showPrefix: true,
                customPrefix: "[DEBUG]",
            },
            sourceMapping: true,
            stackTrace: true,
        },
    },
});
```

## Advanced Features

### 1. Console Encryption

Encrypt sensitive console logs for security:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            encryption: {
                enabled: true,
                key: process.env.CONSOLE_ENCRYPTION_KEY, // Set via environment
                algorithm: "aes-256-gcm",
                displayMode: "encrypted", // 'readable' | 'encrypted' | 'both'
                showEncryptionStatus: true,
            },
        },
    },
});

app.start();

// Access encryption features
app.enableConsoleEncryption("your-secret-key");
app.setConsoleEncryptionDisplayMode("both"); // Show both readable and encrypted
```

**Display Modes:**

-   `'readable'` - Show original logs (encryption happens in background)
-   `'encrypted'` - Show only encrypted hashes
-   `'both'` - Show both readable and encrypted versions

### 2. Source Mapping

Track where logs originated from:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            sourceMapping: true, // Enable source tracking
            stackTrace: false, // Full stack trace (optional)
        },
    },
});
```

**Output:**

```
[USERAPP] Hello World [at myFunction (file.ts:42)]
```

### 3. Filtering

Filter logs based on patterns and levels:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            filters: {
                minLevel: "warn", // Only warn and error
                maxLength: 500, // Truncate long messages
                excludePatterns: ["node_modules", "internal", "DEBUG:"],
                includePatterns: ["IMPORTANT:", "ERROR:"],
            },
        },
    },
});
```

### 4. Performance Monitoring

Track console interception overhead:

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            performanceMode: true, // Enable performance tracking
            maxInterceptionsPerSecond: 1000, // Rate limiting
        },
    },
});

app.start();

// Get statistics
const stats = app.getConsoleStats();
console.log(stats);
/*
{
    totalInterceptions: 1523,
    interceptionsPerSecond: 45,
    errorCount: 0,
    averageOverhead: 0.23, // ms
    isActive: true,
    methodCounts: {
        log: 1200,
        error: 23,
        warn: 300
    }
}
*/
```

## Runtime API

### Enable/Disable at Runtime

```typescript
const app = createServer({
    /* ... */
});

// Enable console interception
app.enableConsoleInterception();

// Disable console interception
app.disableConsoleInterception();

// Check status
const isActive = app.getConsoleInterceptor().isActive();
```

### Get Statistics

```typescript
const stats = app.getConsoleStats();
console.log("Total interceptions:", stats.totalInterceptions);
console.log("Average overhead:", stats.averageOverhead, "ms");
```

### Reset Statistics

```typescript
app.resetConsoleStats();
```

### Update Configuration

```typescript
// Get console interceptor
const interceptor = app.getConsoleInterceptor();

// Update configuration at runtime
interceptor.updateConfig({
    preserveOriginal: {
        enabled: true,
        mode: "both",
    },
    filters: {
        minLevel: "error",
    },
});
```

## Use Cases

### Use Case 1: Development Mode

Show original console output for easy debugging:

```typescript
const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                mode: "original",
            },
        },
    },
});
```

### Use Case 2: Production Logging

Structured logs with timestamps and prefixes:

```typescript
const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                mode: "intercepted",
                showPrefix: true,
            },
            filters: {
                minLevel: "info",
            },
        },
    },
});
```

### Use Case 3: Secure Production

Encrypt sensitive logs:

```typescript
const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                mode: "intercepted",
            },
            encryption: {
                enabled: true,
                key: process.env.CONSOLE_ENCRYPTION_KEY,
                displayMode: "encrypted",
            },
        },
    },
});
```

### Use Case 4: Testing (Silent Mode)

Suppress all console output during tests:

```typescript
const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                mode: "none", // Silent
            },
        },
    },
});
```

### Use Case 5: Debugging

See both original and intercepted output:

```typescript
const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                mode: "both",
            },
            sourceMapping: true,
            stackTrace: true,
        },
    },
});
```

## Configuration Reference

### ConsoleInterceptionConfig

```typescript
interface ConsoleInterceptionConfig {
    enabled: boolean;
    interceptMethods: ("log" | "error" | "warn" | "info" | "debug" | "trace")[];
    preserveOriginal: boolean | PreserveOption;
    filterUserCode: boolean;
    performanceMode: boolean;
    sourceMapping: boolean;
    stackTrace: boolean;
    maxInterceptionsPerSecond: number;
    encryption?: ConsoleEncryptionConfig;
    filters: FilterConfig;
    fallback: FallbackConfig;
}
```

### PreserveOption

```typescript
interface PreserveOption {
    enabled: boolean;
    mode: "original" | "intercepted" | "both" | "none";
    showPrefix: boolean;
    allowDuplication: boolean;
    customPrefix?: string;
    separateStreams: boolean;
    onlyUserApp: boolean;
    colorize: boolean;
}
```

### ConsoleEncryptionConfig

```typescript
interface ConsoleEncryptionConfig {
    enabled?: boolean;
    algorithm?: "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm";
    key?: string;
    displayMode?: "readable" | "encrypted" | "both";
    showEncryptionStatus?: boolean;
}
```

## Best Practices

1. **Development:** Use `mode: 'original'` for normal console output
2. **Production:** Use `mode: 'intercepted'` with filtering
3. **Sensitive Data:** Enable encryption in production
4. **Performance:** Set `maxInterceptionsPerSecond` to prevent overhead
5. **Debugging:** Use `mode: 'both'` with source mapping
6. **Testing:** Use `mode: 'none'` to suppress output

## Troubleshooting

### Console output not showing

**Solution:** Check `preserveOriginal.mode` - set to `'original'` or `'both'`

### Too much console output

**Solution:** Use filters to reduce noise:

```typescript
filters: {
    minLevel: 'warn',
    excludePatterns: ['DEBUG:', 'node_modules']
}
```

### Performance issues

**Solution:** Reduce `maxInterceptionsPerSecond` or disable `sourceMapping`

### Encryption not working

**Solution:** Set encryption key via environment variable:

```bash
export CONSOLE_ENCRYPTION_KEY="your-secret-key"
```

## Examples

See `.private/console-interception-examples.ts` for comprehensive examples.

app.getConsoleInterceptor().updateConfig({
/_ ... _/
});

````

## Plugin Integration

Plugins can tap into the console interception system using the `onConsoleIntercept` hook. This allows for custom log analysis, external reporting, or advanced filtering.

### 1. Implement the Hook

```typescript
// Any XyPriss Plugin
{
    name: "my-log-plugin",
    version: "1.0.0",
    onConsoleIntercept(log) {
        if (log.category === 'system' && log.level === 'error') {
            // Handle system errors
        }
    }
}
````

### 2. Grant Permissions

Because console logs can contain sensitive data, the `onConsoleIntercept` hook is **privileged** and requires explicit permission in the server configuration.

```typescript
const app = createServer({
    pluginPermissions: [
        {
            name: "my-log-plugin",
            allowedHooks: ["PLG.LOGGING.CONSOLE_INTERCEPT"],
        },
    ],
});
```

For more details on plugin hooks, see the [Plugin Core Hooks Guide](./PLUGIN_CORE_HOOKS.md).

## Summary

The Console Interception System provides powerful control over console output with:

-   ✅ Multiple display modes (original, intercepted, both, none)
-   ✅ Encryption for sensitive logs
-   ✅ Filtering and source mapping
-   ✅ Performance monitoring
-   ✅ Runtime configuration
-   ✅ Production-ready presets

Choose the right mode for your use case and enjoy enhanced logging! 🚀

