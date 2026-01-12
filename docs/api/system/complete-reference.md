# System API Complete Reference

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

This document provides a complete reference of all methods available in the XyPriss System API (`__sys__`). The API is organized into logical categories for easy navigation.

## Quick Navigation

-   [Configuration & Metadata](#configuration--metadata)
-   [Environment Management](#environment-management)
-   [System Monitoring](#system-monitoring)
-   [Process Management](#process-management)
-   [Network & Connectivity](#network--connectivity)
-   [Disk & Storage](#disk--storage)
-   [Path Operations](#path-operations)
-   [File I/O](#file-io)
-   [Directory Management](#directory-management)
-   [File Metadata](#file-metadata)
-   [Search & Discovery](#search--discovery)
-   [Advanced Operations](#advanced-operations)

---

## Configuration & Metadata

### Properties

| Property                | Type                     | Description                  |
| ----------------------- | ------------------------ | ---------------------------- |
| `__version__`           | `string`                 | Application version (semver) |
| `__name__`              | `string`                 | Application name             |
| `__alias__`             | `string`                 | Short application alias      |
| `__author__`            | `string`                 | Application author           |
| `__description__`       | `string`                 | Application description      |
| `__app_urls__`          | `Record<string, string>` | Application URLs map         |
| `__port__` / `__PORT__` | `number`                 | Server port (synchronized)   |
| `__env__`               | `string`                 | Environment mode             |
| `__root__`              | `string`                 | Project root path            |

### Methods

| Method                   | Returns               | Description              |
| ------------------------ | --------------------- | ------------------------ |
| `$update(data)`          | `void`                | Merge configuration data |
| `$add(key, value)`       | `void`                | Add custom property      |
| `$get<T>(key, default?)` | `T`                   | Get configuration value  |
| `$has(key)`              | `boolean`             | Check if key exists      |
| `$remove(key)`           | `boolean`             | Remove custom property   |
| `$keys()`                | `string[]`            | List configuration keys  |
| `$toJSON()`              | `Record<string, any>` | Serialize to JSON        |
| `$reset()`               | `void`                | Reset to defaults        |
| `$clone()`               | `XyPrissSys`          | Create independent copy  |

### Environment Helpers

| Method                 | Returns   | Description              |
| ---------------------- | --------- | ------------------------ |
| `$isProduction()`      | `boolean` | Check if production env  |
| `$isDevelopment()`     | `boolean` | Check if development env |
| `$isStaging()`         | `boolean` | Check if staging env     |
| `$isTest()`            | `boolean` | Check if test env        |
| `$isEnvironment(name)` | `boolean` | Check custom environment |

**Documentation:** [Configuration Management](./configuration.md)

---

## Environment Management

### `__ENV__` Object

| Method                       | Returns               | Description                 |
| ---------------------------- | --------------------- | --------------------------- |
| `__ENV__.get(key, default?)` | `string \| undefined` | Get environment variable    |
| `__ENV__.set(key, value)`    | `void`                | Set environment variable    |
| `__ENV__.has(key)`           | `boolean`             | Check if variable exists    |
| `__ENV__.delete(key)`        | `void`                | Remove environment variable |
| `__ENV__.all()`              | `NodeJS.ProcessEnv`   | Get all variables           |

**Documentation:** [Environment Variables](./environment.md)

---

## System Monitoring

### System Information

| Method           | Returns                 | Description                 |
| ---------------- | ----------------------- | --------------------------- |
| `$info()`        | `SystemInfo`            | Complete system information |
| `$cpu(cores?)`   | `CpuUsage \| CpuInfo[]` | CPU usage statistics        |
| `$memory()`      | `MemoryInfo`            | Memory usage statistics     |
| `$uptime()`      | `number`                | System uptime in seconds    |
| `$bootTime()`    | `number`                | Boot time (Unix timestamp)  |
| `$loadAverage()` | `LoadAverage`           | System load averages        |

### SystemInfo Structure

```typescript
interface SystemInfo {
    hostname: string;
    os_name: string;
    os_version: string;
    os_edition: string;
    kernel_version: string;
    architecture: string;
    cpu_count: number;
    cpu_brand: string;
    cpu_vendor: string;
    cpu_frequency: number;
    total_memory: number;
    used_memory: number;
    available_memory: number;
    total_swap: number;
    used_swap: number;
    uptime: number;
    boot_time: number;
    load_average: LoadAverage;
}
```

**Documentation:**

-   [CPU Monitoring](./cpu-monitoring.md)
-   [Memory Management](./memory-management.md)

---

## Process Management

| Method                      | Returns                        | Description             |
| --------------------------- | ------------------------------ | ----------------------- |
| `$processes(options?)`      | `ProcessInfo[] \| ProcessInfo` | Get process information |
| `$processes({ pid })`       | `ProcessInfo`                  | Get specific process    |
| `$processes({ topCpu: N })` | `ProcessInfo[]`                | Top N CPU consumers     |
| `$processes({ topMem: N })` | `ProcessInfo[]`                | Top N memory consumers  |

### ProcessInfo Structure

```typescript
interface ProcessInfo {
    pid: number;
    name: string;
    exe?: string;
    cmd: string[];
    cpu_usage: number;
    memory: number;
    virtual_memory: number;
    status: string;
    start_time: number;
    run_time: number;
    parent_pid?: number;
    user_id?: string;
    disk_read: number;
    disk_write: number;
}
```

**Documentation:** [Process Management](./process-management.md)

---

## Network & Connectivity

| Method                 | Returns                            | Description        |
| ---------------------- | ---------------------------------- | ------------------ |
| `$network(interface?)` | `NetworkStats \| NetworkInterface` | Network statistics |
| `$ports(options?)`     | `PortInfo[]`                       | List open ports    |

### NetworkStats Structure

```typescript
interface NetworkStats {
    total_received: number;
    total_transmitted: number;
    download_speed: number;
    upload_speed: number;
    interfaces: NetworkInterface[];
}

interface NetworkInterface {
    name: string;
    received: number;
    transmitted: number;
    packets_received: number;
    packets_transmitted: number;
    errors_received: number;
    errors_transmitted: number;
    mac_address: string;
    ip_addresses: string[];
}
```

**Documentation:** [Network Statistics](./network-statistics.md)

---

## Disk & Storage

| Method                | Returns                  | Description                |
| --------------------- | ------------------------ | -------------------------- |
| `$disks(mountPoint?)` | `DiskInfo[] \| DiskInfo` | Disk information           |
| `$du(path)`           | `DirUsage`               | Directory usage statistics |

### DiskInfo Structure

```typescript
interface DiskInfo {
    name: string;
    mount_point: string;
    file_system: string;
    total_space: number;
    available_space: number;
    used_space: number;
    usage_percent: number;
    is_removable: boolean;
    disk_type: string;
}
```

**Documentation:** [Disk Information](./disk-information.md)

---

## Path Operations

| Method                | Returns   | Description              |
| --------------------- | --------- | ------------------------ |
| `$resolve(path)`      | `string`  | Resolve to absolute path |
| `$join(...paths)`     | `string`  | Join path segments       |
| `$dirname(path)`      | `string`  | Get directory name       |
| `$basename(path)`     | `string`  | Get file name            |
| `$extname(path)`      | `string`  | Get file extension       |
| `$normalize(path)`    | `string`  | Normalize path           |
| `$relative(from, to)` | `string`  | Get relative path        |
| `$isAbsolute(path)`   | `boolean` | Check if absolute        |

**Examples:**

```typescript
__sys__.$resolve("./config.json"); // "/project/config.json"
__sys__.$join("src", "utils", "file.ts"); // "src/utils/file.ts"
__sys__.$dirname("/path/to/file.txt"); // "/path/to"
__sys__.$basename("/path/to/file.txt"); // "file.txt"
__sys__.$extname("file.txt"); // ".txt"
```

---

## File I/O

### Reading

| Method                         | Returns    | Description             |
| ------------------------------ | ---------- | ----------------------- |
| `$read(path)`                  | `string`   | Read file as text       |
| `$readBytes(path)`             | `Buffer`   | Read file as bytes      |
| `$readJson(path)`              | `any`      | Read and parse JSON     |
| `$readJsonSafe(path, default)` | `any`      | Read JSON with fallback |
| `$readLines(path)`             | `string[]` | Read file as lines      |
| `$readNonEmptyLines(path)`     | `string[]` | Read non-empty lines    |

### Writing

| Method                          | Returns   | Description          |
| ------------------------------- | --------- | -------------------- |
| `$write(path, data)`            | `void`    | Write text to file   |
| `$writeBytes(path, data)`       | `void`    | Write bytes to file  |
| `$writeJson(path, data)`        | `void`    | Write JSON (pretty)  |
| `$writeJsonCompact(path, data)` | `void`    | Write JSON (compact) |
| `$writeIfNotExists(path, data)` | `boolean` | Write only if new    |
| `$append(path, data)`           | `void`    | Append to file       |
| `$appendLine(path, line)`       | `void`    | Append line to file  |

**Examples:**

```typescript
// Read operations
const text = __sys__.$read("config.txt");
const json = __sys__.$readJson("data.json");
const lines = __sys__.$readLines("log.txt");

// Write operations
__sys__.$write("output.txt", "Hello World");
__sys__.$writeJson("data.json", { key: "value" });
__sys__.$appendLine("log.txt", "New entry");
```

---

## Directory Management

| Method               | Returns    | Description                  |
| -------------------- | ---------- | ---------------------------- |
| `$mkdir(path)`       | `void`     | Create directory (recursive) |
| `$ensureDir(path)`   | `void`     | Ensure directory exists      |
| `$ls(path)`          | `string[]` | List directory contents      |
| `$lsFullPath(path)`  | `string[]` | List with full paths         |
| `$lsDirs(path)`      | `string[]` | List directories only        |
| `$lsFiles(path)`     | `string[]` | List files only              |
| `$lsRecursive(path)` | `string[]` | List recursively             |
| `$emptyDir(path)`    | `void`     | Remove all contents          |

**Examples:**

```typescript
__sys__.$mkdir("new/nested/directory");
const files = __sys__.$ls("src");
const dirs = __sys__.$lsDirs("src");
const allFiles = __sys__.$lsRecursive("src");
```

---

## File Metadata

### Existence & Type Checks

| Method             | Returns     | Description            |
| ------------------ | ----------- | ---------------------- |
| `$exists(path)`    | `boolean`   | Check if path exists   |
| `$isFile(path)`    | `boolean`   | Check if file          |
| `$isDir(path)`     | `boolean`   | Check if directory     |
| `$isSymlink(path)` | `boolean`   | Check if symbolic link |
| `$isEmpty(path)`   | `boolean`   | Check if empty         |
| `$check(path)`     | `PathCheck` | Comprehensive check    |

### File Information

| Method                  | Returns            | Description             |
| ----------------------- | ------------------ | ----------------------- |
| `$stats(path)`          | `FileStats`        | Get file statistics     |
| `$size(path, options?)` | `number \| string` | Get file size           |
| `$sizeHuman(path)`      | `string`           | Get human-readable size |
| `$createdAt(path)`      | `Date`             | Get creation time       |
| `$modifiedAt(path)`     | `Date`             | Get modification time   |
| `$accessedAt(path)`     | `Date`             | Get access time         |

### FileStats Structure

```typescript
interface FileStats {
    size: number;
    is_file: boolean;
    is_dir: boolean;
    is_symlink: boolean;
    modified: number;
    created: number;
    accessed: number;
    readonly: boolean;
    permissions: number;
}
```

**Examples:**

```typescript
if (__sys__.$exists("file.txt")) {
    const stats = __sys__.$stats("file.txt");
    const size = __sys__.$sizeHuman("file.txt");
    const modified = __sys__.$modifiedAt("file.txt");
}
```

---

## Search & Discovery

### File Search

| Method                       | Returns    | Description           |
| ---------------------------- | ---------- | --------------------- |
| `$find(path, pattern)`       | `string[]` | Find by regex pattern |
| `$findByExt(path, ext)`      | `string[]` | Find by extension     |
| `$findByPattern(path, glob)` | `string[]` | Find by glob pattern  |

### Content Search

| Method                        | Returns         | Description          |
| ----------------------------- | --------------- | -------------------- |
| `$grep(path, pattern)`        | `SearchMatch[]` | Search in files      |
| `$searchInFiles(path, query)` | `SearchMatch[]` | Text search in files |

### SearchMatch Structure

```typescript
interface SearchMatch {
    file: string;
    line: number;
    content: string;
}
```

**Examples:**

```typescript
// Find TypeScript files
const tsFiles = __sys__.$findByExt("src", "ts");

// Find files matching pattern
const configs = __sys__.$find(".", ".*\\.config\\..*");

// Search for text in files
const matches = __sys__.$grep("src", "TODO");
matches.forEach((m) => {
    console.log(`${m.file}:${m.line}: ${m.content}`);
});
```

---

## Advanced Operations

### File Operations

| Method                  | Returns | Description                |
| ----------------------- | ------- | -------------------------- |
| `$copy(src, dest)`      | `void`  | Copy file or directory     |
| `$move(src, dest)`      | `void`  | Move/rename file           |
| `$rename(src, dest)`    | `void`  | Alias for `$move`          |
| `$duplicate(src, dest)` | `void`  | Duplicate file             |
| `$rm(path)`             | `void`  | Remove file or directory   |
| `$rmIfExists(path)`     | `void`  | Remove if exists           |
| `$touch(path)`          | `void`  | Create or update timestamp |

### Comparison & Validation

| Method                         | Returns   | Description                |
| ------------------------------ | --------- | -------------------------- |
| `$hash(path)`                  | `string`  | Calculate SHA-256 hash     |
| `$verify(path, hash)`          | `boolean` | Verify file hash           |
| `$isSameContent(path1, path2)` | `boolean` | Compare file contents      |
| `$isNewer(path1, path2)`       | `boolean` | Compare modification times |

### Permissions (Unix)

| Method               | Returns | Description        |
| -------------------- | ------- | ------------------ |
| `$chmod(path, mode)` | `void`  | Change permissions |

**Examples:**

```typescript
// File operations
__sys__.$copy("source.txt", "backup.txt");
__sys__.$move("old.txt", "new.txt");
__sys__.$rm("temp.txt");

// Validation
const hash = __sys__.$hash("file.txt");
const valid = __sys__.$verify("file.txt", hash);

// Comparison
if (__sys__.$isNewer("file1.txt", "file2.txt")) {
    console.log("file1.txt is newer");
}

// Permissions (Unix only)
__sys__.$chmod("script.sh", "755");
```

---

## Type Definitions

All types are exported from the main package:

```typescript
import type {
    SystemInfo,
    CpuInfo,
    CpuUsage,
    MemoryInfo,
    DiskInfo,
    NetworkStats,
    NetworkInterface,
    ProcessInfo,
    ProcessStats,
    FileStats,
    SearchMatch,
    PathCheck,
} from "xypriss";
```

---

## Error Handling

All methods may throw `XyPrissError` on failure:

```typescript
import { XyPrissError } from "xypriss";

try {
    const content = __sys__.$read("file.txt");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Operation failed: ${error.message}`);
    }
}
```

---

## Performance Considerations

### Synchronous Operations

All System API methods are **synchronous** and will block the event loop:

```typescript
// This blocks until complete
const files = __sys__.$lsRecursive("large-directory");

// For large operations, consider running in worker threads
```

### Caching Recommendations

Cache results for frequently accessed data:

```typescript
// Cache system info (changes rarely)
const systemInfo = __sys__.$info();

// Cache file lists (update periodically)
const fileCache = new Map<string, string[]>();
```

---

## Platform Support

| Feature         | Linux | macOS | Windows |
| --------------- | ----- | ----- | ------- |
| System Info     | ✓     | ✓     | ✓       |
| CPU Monitoring  | ✓     | ✓     | ✓       |
| Memory Stats    | ✓     | ✓     | ✓       |
| Network Stats   | ✓     | ✓     | ✓       |
| Process Info    | ✓     | ✓     | ✓       |
| Disk Info       | ✓     | ✓     | ✓       |
| File Operations | ✓     | ✓     | ✓       |
| Permissions     | ✓     | ✓     | Partial |

---

## Related Documentation

-   [Configuration Management](./configuration.md)
-   [Environment Variables](./environment.md)
-   [CPU Monitoring](./cpu-monitoring.md)
-   [Memory Management](./memory-management.md)
-   [Network Statistics](./network-statistics.md)
-   [Process Management](./process-management.md)
-   [Disk Information](./disk-information.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12

