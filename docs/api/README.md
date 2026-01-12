# XyPriss API Documentation

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

Welcome to the comprehensive XyPriss API documentation. This documentation covers all APIs available in the XyPriss framework, organized by functional area.

## Documentation Structure

### System API (`__sys__`)

The System API provides comprehensive access to system resources, file operations, and runtime configuration.

**Main Documentation:**

-   [System API Overview](./system/README.md) - Introduction and architecture
-   [Complete Reference](./system/complete-reference.md) - All methods at a glance

**Configuration & Environment:**

-   [Configuration Management](./system/configuration.md) - Application metadata and settings
-   [Environment Variables](./system/environment.md) - Environment variable management

**System Monitoring:**

-   [CPU Monitoring](./system/cpu-monitoring.md) - CPU usage and core information
-   [Memory Management](./system/memory-management.md) - RAM and swap statistics
-   [Network Statistics](./system/network-statistics.md) - Network interfaces and bandwidth
-   [Process Management](./system/process-management.md) - Process information and monitoring
-   [Disk Information](./system/disk-information.md) - Storage and filesystem details

**Migration:**

-   [Migration Guide v5→v6](./system/migration-v5-to-v6.md) - Upgrading from XyPriss v5

### Global APIs

Additional global APIs available in XyPriss:

-   **`__cfg__`** - Server configuration management
-   **`__const__`** - Immutability engine and constants registry

See [Global APIs Documentation](../GLOBAL_APIS.md) for details.

## Quick Start

### Installation

```bash
npm install xypriss@^6.0.0
# or
bun add xypriss@^6.0.0
```

### Basic Usage

```typescript
import { createServer } from "xypriss";

// System API is available globally as __sys__
console.log(__sys__.__version__);

// Get system information
const info = __sys__.$info();
const cpu = __sys__.$cpu();
const memory = __sys__.$memory();

// File operations
const files = __sys__.$ls("./src");
const content = __sys__.$read("config.json");

// Create server
const app = createServer({
    server: { port: __sys__.__port__ },
});
```

## API Categories

### 1. Configuration & Metadata

Manage application configuration, version information, and runtime metadata.

**Key Methods:**

-   `$update()` - Merge configuration
-   `$get()` - Retrieve values
-   `$isProduction()` - Environment checks

**Documentation:** [Configuration Management](./system/configuration.md)

### 2. System Monitoring

Real-time access to hardware metrics and system health.

**Key Methods:**

-   `$info()` - System information
-   `$cpu()` - CPU statistics
-   `$memory()` - Memory usage
-   `$network()` - Network statistics

**Documentation:**

-   [CPU Monitoring](./system/cpu-monitoring.md)
-   [Memory Management](./system/memory-management.md)
-   [Network Statistics](./system/network-statistics.md)

### 3. Process Management

Monitor and analyze running processes.

**Key Methods:**

-   `$processes()` - List processes
-   `$processes({ topCpu: N })` - Top CPU consumers
-   `$processes({ topMem: N })` - Top memory consumers

**Documentation:** [Process Management](./system/process-management.md)

### 4. File System Operations

Comprehensive file and directory manipulation.

**Key Methods:**

-   `$read()`, `$write()` - File I/O
-   `$ls()`, `$mkdir()` - Directory operations
-   `$find()`, `$grep()` - Search operations

**Documentation:** [Complete Reference](./system/complete-reference.md)

### 5. Storage & Disk

Monitor disk usage and storage capacity.

**Key Methods:**

-   `$disks()` - Disk information
-   `$du()` - Directory usage

**Documentation:** [Disk Information](./system/disk-information.md)

## Type Definitions

All types are fully documented and exported:

```typescript
import type {
    SystemInfo,
    CpuUsage,
    CpuInfo,
    MemoryInfo,
    DiskInfo,
    NetworkStats,
    NetworkInterface,
    ProcessInfo,
    FileStats,
    SearchMatch,
} from "xypriss";
```

## Common Use Cases

### 1. Health Monitoring

```typescript
function checkSystemHealth() {
    const cpu = __sys__.$cpu();
    const memory = __sys__.$memory();
    const disks = __sys__.$disks();

    return {
        cpu: cpu.overall < 80,
        memory: memory.usage_percent < 85,
        disk: disks.every((d) => d.usage_percent < 90),
    };
}
```

### 2. Resource Management

```typescript
function optimizeResources() {
    const memory = __sys__.$memory();

    if (memory.usage_percent > 85) {
        // Trigger garbage collection
        global.gc?.();

        // Clear caches
        cache.clear();
    }
}
```

### 3. Configuration Loading

```typescript
function loadConfig() {
    return {
        port: parseInt(__sys__.__ENV__.get("PORT", "3000")),
        env: __sys__.__env__,
        dbUrl: __sys__.__ENV__.get("DATABASE_URL"),
        apiKey: __sys__.__ENV__.get("API_KEY"),
    };
}
```

### 4. File Processing

```typescript
function processLogs() {
    const logFiles = __sys__.$findByExt("logs", "log");

    logFiles.forEach((file) => {
        const lines = __sys__.$readNonEmptyLines(file);
        const errors = lines.filter((l) => l.includes("ERROR"));

        if (errors.length > 0) {
            console.log(`${file}: ${errors.length} errors`);
        }
    });
}
```

## Performance Guidelines

### 1. Synchronous Operations

All System API methods are synchronous and block the event loop:

```typescript
// This blocks until complete
const files = __sys__.$lsRecursive("large-directory");

// For large operations, consider worker threads
```

### 2. Caching

Cache frequently accessed data:

```typescript
// Cache system info (rarely changes)
const systemInfo = __sys__.$info();

// Cache file lists (update periodically)
let fileCache: string[] = [];
setInterval(() => {
    fileCache = __sys__.$ls("src");
}, 60000);
```

### 3. Polling Frequency

Avoid excessive polling:

```typescript
// Good: Poll every 5-10 seconds
setInterval(() => {
    const cpu = __sys__.$cpu();
    if (cpu.overall > 80) console.warn("High CPU");
}, 5000);

// Avoid: Polling too frequently
setInterval(() => __sys__.$cpu(), 100); // Too frequent!
```

## Error Handling

All methods may throw `XyPrissError`:

```typescript
import { XyPrissError } from "xypriss";

try {
    const content = __sys__.$read("config.json");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Failed: ${error.message}`);
    }
}
```

## Platform Support

| Feature     | Linux | macOS | Windows |
| ----------- | ----- | ----- | ------- |
| System Info | ✓     | ✓     | ✓       |
| CPU/Memory  | ✓     | ✓     | ✓       |
| Network     | ✓     | ✓     | ✓       |
| Processes   | ✓     | ✓     | ✓       |
| File Ops    | ✓     | ✓     | ✓       |
| Permissions | ✓     | ✓     | Partial |

## Migration

Upgrading from XyPriss v5? See the [Migration Guide](./system/migration-v5-to-v6.md).

## Additional Resources

-   [GitHub Repository](https://github.com/Nehonix-Team/XyPriss)
-   [Issue Tracker](https://github.com/Nehonix-Team/XyPriss/issues)
-   [Global APIs](../GLOBAL_APIS.md)

## Contributing

Documentation improvements are welcome! Please submit pull requests to the [GitHub repository](https://github.com/Nehonix-Team/XyPriss).

---

**Documentation Version:** 1.0.0  
**XyPriss Version:** v6.0.0+  
**Last Updated:** 2026-01-12

