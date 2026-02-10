# XyPriss System API Documentation

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The XyPriss System API (`__sys__`) represents a comprehensive, unified interface for interacting with the operating system, file system, and runtime environment. This API is designed to provide developers with a powerful, type-safe, and intuitive set of tools for building robust server applications.

## Architecture

The System API follows a hierarchical inheritance structure that consolidates multiple specialized APIs into a single, flat interface:

```
XyPrissSys (Global Instance: __sys__)
    └── XyPrissFS (System Aggregator)
        └── SysApi (System Monitoring & Intelligence)
            └── FSApi (Filesystem Operations)
                └── PathApi (Path Manipulation)
                    └── BaseApi (Foundation Layer)
```

This architecture ensures that all capabilities are accessible directly from the `__sys__` global instance without the need for nested property access.

## Core Capabilities

The System API provides five primary categories of functionality:

### 1. **System Configuration & Metadata**

Management of application-level configuration, version information, and runtime metadata.

-   [Configuration Management](./configuration.md)
-   [Environment Variables](./environment.md)
-   [Metadata Properties](./metadata.md)

### 2. **System Monitoring & Intelligence**

Real-time access to hardware metrics, process information, and system health data.

-   [CPU Monitoring](./cpu-monitoring.md)
-   [Memory Management](./memory-management.md)
-   [Disk Information](./disk-information.md)
-   [Network Statistics](./network-statistics.md)
-   [Process Management](./process-management.md)
-   [Battery Status](./battery-status.md)
-   [System Health](./system-health.md)

### 3. **Filesystem Operations**

Comprehensive file and directory manipulation with enhanced safety and convenience.

-   [Path Operations](./path-operations.md)
-   [File I/O](./file-io.md)
-   [Directory Management](./directory-management.md)
-   [File Metadata](./file-metadata.md)
-   [Search & Filter](./search-filter.md)
-   [Advanced Operations](./advanced-operations.md)

### 4. **Search & Discovery**

High-performance file and content search capabilities.

-   [File Search](./file-search.md)
-   [Content Grep](./content-grep.md)
-   [Pattern Matching](./pattern-matching.md)

### 5. **Port & Network Utilities**

Network interface inspection and port management.

-   [Port Scanning](./port-scanning.md)
-   [Network Interfaces](./network-interfaces.md)

## Global Access

The System API is available globally as `__sys__` throughout your XyPriss application:

```typescript
// No imports required - available globally
console.log(__sys__.__version__);
const cpuUsage = __sys__.$cpu();
const files = __sys__.$ls("./src");
```

## Initialization

The `__sys__` instance is automatically initialized when the XyPriss framework is loaded. For standalone scripts, ensure the framework is imported:

```typescript
import "xypriss"; // Initializes global APIs

// __sys__ is now available
```

## Type Safety

All System API methods are fully typed with TypeScript interfaces. Import types as needed:

```typescript
import type { SystemInfo, CpuUsage, MemoryInfo } from "xypriss";

const info: SystemInfo = __sys__.$info();
const cpu: CpuUsage = __sys__.$cpu() as CpuUsage;
```

## Error Handling

System API methods throw `XyPrissError` instances when operations fail. Always wrap potentially failing operations in try-catch blocks:

```typescript
try {
    const content = __sys__.$read("config.json");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Operation failed: ${error.message}`);
    }
}
```

## Performance Considerations

The System API is built on a high-performance Rust binary (`xsys`) that executes operations natively. However, be mindful of:

-   **Synchronous Operations**: Most methods are synchronous and block the event loop
-   **Large Directory Trees**: Recursive operations on large directories may take time
-   **Frequent Polling**: Avoid polling system metrics in tight loops

## Platform Support

The System API supports the following platforms:

-   **Linux**: Full support for all features
-   **macOS**: Full support for all features
-   **Windows**: Partial support (some Unix-specific features unavailable)

Platform-specific features are clearly marked in the documentation.

## Security Considerations

-   **Path Traversal**: All path operations are root-aware and prevent traversal outside the project directory
-   **Permissions**: File operations respect system-level permissions
-   **Environment Variables**: Use `__sys__.__ENV__` for safe environment variable access

## Migration from v5

If you are upgrading from XyPriss v5, please review the [Migration Guide](./migration-v5-to-v6.md) for breaking changes and new features.

## Quick Reference

### Most Common Operations

```typescript
// System Information
const info = __sys__.$info();
const cpu = __sys__.$cpu();
const memory = __sys__.$memory();

// File Operations
const exists = __sys__.$exists("file.txt");
const content = __sys__.$read("file.txt");
__sys__.$write("output.txt", "data");

// Directory Operations
const files = __sys__.$ls("./src");
const allFiles = __sys__.$lsRecursive("./src");
__sys__.$mkdir("new-directory");

// Path Operations
const absolute = __sys__.$resolve("relative/path");
const joined = __sys__.$join("dir", "file.txt");

// Search Operations
const matches = __sys__.$find("src", ".*\\.ts$");
const grep = __sys__.$grep("src", "TODO");

// Environment
const nodeEnv = __sys__.__ENV__.get("NODE_ENV", "development");
const isProduction = __sys__.$isProduction();
```

## API Reference Index

-   [Configuration Management](./configuration.md)
-   [Environment Variables](./environment.md)
-   [CPU Monitoring](./cpu-monitoring.md)
-   [Memory Management](./memory-management.md)
-   [Disk Information](./disk-information.md)
-   [Network Statistics](./network-statistics.md)
-   [Process Management](./process-management.md)
-   [Path Operations](./path-operations.md)
-   [File I/O](./file-io.md)
-   [Directory Management](./directory-management.md)
-   [Search & Filter](./search-filter.md)

## Support

For issues, questions, or feature requests, please refer to the [XyPriss GitHub repository](https://github.com/Nehonix-Team/XyPriss).

---

**Note:** This documentation covers features available in XyPriss v6.0.0 and above. Features may not be available in earlier versions.

