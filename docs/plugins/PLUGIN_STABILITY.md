# Plugin Stability and Error Handling

XyPriss implements advanced mechanisms to ensure that the server remains stable and responsive even when plugins exhibit faulty logic or throw unexpected errors. This documentation outlines the stability features and how they protect the core system.

## Overview

The plugin system is designed with a "fail-safe" philosophy. Errors in plugin hooks are isolated, logged, and prevented from crashing the main server process. Additionally, the system detects and reports common logical errors that could lead to unstable behavior.

## Graceful Error Isolation

Every plugin hook execution (e.g., `onRequest`, `onResponse`, `onSecurityAttack`) is wrapped in a robust error handling layer.

### Hook Execution Protection

If a plugin hook throws a synchronous or asynchronous error:

1.  The error is caught by the `PluginManager`.
2.  A detailed error message is logged via the system logger, including the plugin name and the hook ID.
3.  The server continues processing the request or the next plugin in the chain.
4.  The main application remains unaffected.

### Middleware Error Handling

In the `onRequest` hook, if an error occurs:

-   If the response has not been sent yet, the system calls `next(error)` to trigger the standard error handling flow.
-   If the response has already been sent, the error is simply logged to avoid "write after end" issues.

## Logic Error Detection

XyPriss proactively detects invalid plugin behaviors that often lead to difficult-to-debug server issues.

### Response Finalization Conflict

A common error in plugin development is sending a response and then calling `next()`. This is invalid because `next()` attempts to pass control to the next handler, which might also try to send a response, causing a server crash.

**Detection Mechanism:**
The `PluginManager` wraps the `next` function passed to plugins. It monitors the state of the response (`res.writableEnded`) before and after the plugin's execution.

**Warning Message:**
If a plugin sends a response but still calls `next()`, XyPriss logs a critical error:
`Logic Error in [PluginName].onRequest: Plugin sent a response but also called next(). This is invalid and will cause subsequent route handlers to be skipped.`

### "Write After End" Prevention

The enhanced response object (`res.send`, `res.json`, `res.end`) includes built-in checks to prevent attempts to write data after the response has been finalized.

**Action:**
Instead of allowing the Node.js core to throw a fatal error, XyPriss intercepts these calls, logs a descriptive error message with the request path and method, and gracefully ignores the invalid write attempt.

## Skipped Handler Notifications

If a plugin or middleware finalizes a response (e.g., by sending a 403 Forbidden), subsequent route handlers are automatically skipped to prevent logic conflicts.

**Logging:**
XyPriss logs a warning when a route handler is skipped for this reason:
`Response already finalized by middleware or plugin for [METHOD] [PATH]. Skipping further processing.`

This provides developers with clear visibility into why a specific route handler was not executed.

## Best Practices for Stability

1.  **Stop the Chain**: If your plugin sends a response in `onRequest`, do **not** call `next()`.
2.  **Async Safety**: Always use `try...catch` blocks inside your hooks if you perform complex operations, although XyPriss will catch unhandled errors as a last resort.
3.  **Check State**: If you are unsure if a previous plugin has already sent a response, check `res.writableEnded` before attempting to send data.

