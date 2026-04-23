# XyPriss Console Interceptor (XCI) Guide

## Overview

The XyPriss Console Interceptor (XCI) is a high-performance subsystem integrated into the native XHSC (XyPriss Hyper-System Core). It facilitates the systematic ingestion, processing, and redirection of all standard output and error streams (`console` methods) through a unified architectural bridge. This system provides critical capabilities for enterprise-grade logging, cryptographic security, and real-time monitoring.

## Core Capabilities

- **Unified Stream Management**: Consolidation of all console output into a single, manageable pipeline.
- **Native Processing**: High-efficiency filtering and categorization performed by XHSC.
- **Cryptographic Security**: Native AES-GCM encryption for sensitive log data.
- **Source Attribution**: Automatic metadata attachment for origin tracking and debugging.
- **Rate Limiting**: Protection against log-based DoS attacks through native-level throttling.

## Technical Architecture

The system operates via a bridge between the TypeScript application layer and the native XHSC core. When enabled, the native engine intercepts standard output at the process level, performs necessary transformations (filtering, encryption), and redistributes the processed logs to secondary sinks or plugin hooks.

### Execution Modes

| Mode          | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `original`    | Standard output formatting is maintained; metadata is attached in the background. |
| `intercepted` | Output is processed and formatted according to the unified logging schema.        |
| `both`        | Simultaneous delivery of both raw and processed log streams.                      |
| `none`        | Streams are captured and processed without local terminal output.                 |

## Configuration

The system is configured during the server initialization sequence via the `logging` configuration object.

### Comprehensive Configuration Schema

```ts
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            interceptMethods: ["log", "error", "warn", "info", "debug"],
            preserveOriginal: {
                enabled: true,
                mode: "intercepted",
                showPrefix: true,
                colorize: true,
            },
            performanceMode: true,
            maxInterceptionsPerSecond: 1000,
            sourceMapping: true,
            filters: {
                minLevel: "info",
                excludePatterns: ["node_modules", "internal"],
            },
        },
    },
});
```

## Formatting and Display Engine (`preserveOriginal`)

The `preserveOriginal` configuration block controls exactly how intercepted logs are rendered in your terminal. This operates natively within TypeScript on the results processed by the XHSC engine.

```typescript
preserveOriginal: {
    enabled: true,
    mode: "intercepted",
    showPrefix: true,
    colorize: true,
    separateStreams: true,
    allowDuplication: false,
    onlyUserApp: true,
    customPrefix: "[MyApp]"
}
```

### Configuration Options and Examples

- **`mode`**: Defines the display strategy for the standard console output.
    - `"intercepted"`: Displays the log with the native prefix, colors, and formatting computed by the Go engine.
    - `"original"`: Bypasses the Go engine output for local terminal rendering. Instead, it natively renders the javascript arguments using locally applied `customPrefix` and `colorize` options.
    - `"both"`: Displays both the intercepted and the original outputs side-by-side.
    - `"none"`: Completely silences the terminal output. The log remains successfully intercepted and transmitted to internal plugin hooks in the background silently.

```typescript
// Example with mode: "both" and customPrefix: "[MyApp]"
console.log("Database connected");

// Terminal Output:
// 20:30:15.000 [SYSTEM][W0] Database connected    <-- From "intercepted" (XHSC)
// [MyApp] Database connected                      <-- From "original" (TS)
```

- **`showPrefix`**: Prepends the prefix before the log text (e.g., the native `[SYSTEM][W0]`, or the `customPrefix`).

- **`customPrefix`**: Replaces the implicit prefix with a specific string. (Only applicable in `"original"` or `"both"` modes).

- **`colorize`**: Enables native ANSI syntax highlighting. In `"original"` mode, this colorizes the `customPrefix` in cyan and tints `error`/`warn` messages in red and yellow, respectively.

- **`separateStreams`**: Dynamically redirects process streams. If enabled, routes all `console.error` and `console.warn` outputs exclusively to `stderr`, while maintaining `log`, `info`, and `trace` on `stdout`. If disabled or unset, all outputs are unified onto `stdout`.

- **`allowDuplication`**: A robust deduplication engine protecting your console from repetitive floods and loops. When set to `false`, a **20-message sliding window block** activates. It instantly drops any sequential log statement whose exact body matches anything recently intercepted (ignoring variable XHSC timestamps).

    > **Example**: This is perfect for mitigating a rogue `console.log()` caught inside a rapid `setInterval()` loop. The log is intercepted and reported on the first iteration, and then completely blocked from spamming your terminal.

- **`onlyUserApp`**: Acts as a "Strict Mode" visual filter. When enabled, **only** logs natively categorized as `[USERAPP]` by the Go engine (matched via the `userAppPatterns` regex) will be rendered to the terminal. Other core classifications such as `[SYSTEM]` will still be fully intercepted and available to background Hooks, but they are visually hidden to keep your `stdout` focused purely on application-level events.

## Advanced Technical Features

### Cryptographic Log Protection

The system supports native-level encryption using the AES-GCM algorithm. This ensures that sensitive console data is secured prior to persistent storage or transmission over unsecured channels.

```ts
encryption: {
    enabled: true,
    key: process.env.CONSOLE_ENCRYPTION_KEY,
    algorithm: "aes-256-gcm",
    displayMode: "encrypted",
}
```

### Native Rate Limiting

To prevent system exhaustion, the XHSC core implements native rate limiting. Limits are enforced at the source, ensuring that application-level recursions or high-frequency logging do not degrade overall system performance.

## Runtime Management API

The `XyprissApp` instance provides several methods for runtime management of the interception system.

### Configuration Updates

```ts
const interceptor = app.getConsoleInterceptor();

await interceptor.updateConfig({
    filters: {
        minLevel: "error",
    },
});
```

### Performance Monitoring

Statistics and performance metrics can be retrieved to monitor the operational impact of the logging subsystem.

```typescript
const stats = await app.getConsoleStats();
/*
{
    totalInterceptions: 5000,
    interceptionsPerSecond: 120,
    averageOverhead: 0.15, // in milliseconds
    isActive: true
}
*/
```

## Implementation Best Practices

1.  **Production Environments**: Utilize `intercepted` mode to ensure logs are correctly categorized and metadata is preserved.
2.  **Security**: Always enable encryption when logging sensitive application state or transaction details.
3.  **Performance**: Set rational `maxInterceptionsPerSecond` limits to protect system resources.
4.  **Debugging**: Use `mode: 'both'` during integration phases to verify log integrity.

## Troubleshooting

### Indeterminate Output

Verify the `preserveOriginal.mode` setting. If set to `none`, logs are processed internally but not rendered to the local console.

### Performance Overhead

If overhead exceeds desired thresholds, consider disabling `sourceMapping` or increasing the rate-limiting thresholds within the XHSC configuration.

## Summary

The XyPriss Console Interceptor (XCI) is an essential component for robust application management. By leveraging the native efficiency of the XHSC engine, it provides a secure, performant, and highly configurable logging infrastructure suitable for large-scale production deployments.

