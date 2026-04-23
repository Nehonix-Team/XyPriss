# Console Intercept Hook - Plugin Integration Guide

## Overview

The `onConsoleIntercept` hook is a privileged plugin hook designed for high-performance interception and processing of console output from the XyPriss server and hosted applications. This system is powered by the XyPriss Console Interceptor (XCI) and the native XHSC (XyPriss Hyper-System Core) engine, ensuring minimal overhead and systematic log management.

## Technical Objectives

- **Native Execution**: Leveraging the Go core for regex-based filtering and categorization.
- **Centralized Processing**: Unified log stream management across clustered environments.
- **Encryption Support**: Direct integration with the native AES-GCM encryption pipeline.
- **Security Auditing**: Systematic tracking of internal and application-level events.

## Security and Permissions

This is a privileged operation. Access is strictly controlled to prevent unauthorized exposure of sensitive system data.

### Security Rationale

Console streams may contain sensitive information, including:

- Internal system state and performance metrics.
- Cryptographic tokens or credential fragments.
- Detailed execution traces and source mappings.

### Authorization Requirements

Utilization of this hook requires:

1.  **System Activation**: Explicit enablement of console interception in the server configuration.
2.  **Plugin Privilege**: Explicit granting of the `PLG.LOGGING.CONSOLE_INTERCEPT` permission in the security bootstrap.

## Implementation Workflow

### 1. System Configuration

Enable the native interception core in the server initialization options.

```typescript
import { createServer } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
        },
    },
});
```

### 2. Privilege Granting

Define the plugin permissions within the security policy.

```json
{
    "$internal": {
        "my-log-plugin": {
            "allowedHooks": ["PLG.LOGGING.CONSOLE_INTERCEPT"]
        }
    }
}
```

### 3. Hook Implementation

```typescript
import { Plugin } from "xypriss";

Plugin.register({
    name: "log-audit-plugin",
    version: "1.0.0",

    async onConsoleIntercept(log) {
        // Logic execution within the native stream pipeline
    },
});
```

## Protocol Specifications

### Signature

```typescript
onConsoleIntercept(log: InterceptedConsoleCall): void | Promise<void>
```

### Data Structures

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

### Context Definitions

- **method**: The specific console member invoked.
- **category**: Classification assigned by the XHSC engine:
    - `userApp`: Originating from application-level logic.
    - `system`: Originating from XyPriss core components.
    - `unknown`: Indeterminate origin.
- **source**: Metadata provided when native tracing is active.

## Architectural Best Practices

### Performance Optimization

The interception pipeline operates asynchronously. To maintain system throughput:

- Avoid blocking operations within the hook.
- Utilize internal buffering for external reporting.
- Implement efficient filtering prior to processing.

### Recursive Logic Prevention

Standard `console` methods should not be utilized within the hook implementation. This prevents infinite recursive loops. Use direct stream writes or internal logger bypasses for debugging the hook itself.

## Troubleshooting

### hook_not_triggered

1.  **Engine State**: Verify the XHSC core is active and the `consoleInterception.enabled` flag is set.
2.  **Security Policy**: Confirm the `PLG.LOGGING.CONSOLE_INTERCEPT` identifier is correctly specified in the `pluginPermissions` array.
3.  **Registry Verification**: Ensure the plugin is correctly registered and its identifier matches the security policy.

### Performance Degradation

1.  **Overhead Analysis**: Analyze the overhead of the hook implementation using the native instrumentation tools.
2.  **Concurrency Control**: Ensure async operations are managed correctly to prevent event loop exhaustion.

## Summary

The `onConsoleIntercept` hook facilitates robust log management by integrating directly with the XCI system and the native XHSC engine. Adherence to security protocols and performance best practices is mandatory for all implementations.

