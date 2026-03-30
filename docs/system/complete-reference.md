# System API Complete Reference

**Version Compatibility:** XyPriss v9.5.0 and above

## Overview

This document provides a complete reference of all methods available in the XyPriss System API (`__sys__`). The API is organized into logical categories for easy navigation.

## Quick Navigation

- [Configuration & Metadata](#configuration--metadata)
- [Environment Management](#environment-management)
- [System Monitoring](#system-monitoring)
- [Process Management](#process-management)
- [Network & Connectivity](#network--connectivity)
- [Disk & Storage](#disk--storage)
- [Path Operations](#path-operations)
- [File I/O](#file-io)
- [Directory Management](#directory-management)
- [File Metadata](#file-metadata)
- [Search & Discovery](#search--discovery)
- [Advanced Operations](#advanced-operations)

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
| `__sys__.vars.update(data)`          | `void`                | Merge configuration data |
| `__sys__.vars.set(key, value)`       | `void`                | Add custom property      |
| `__sys__.get<T>(key, default?)` | `T`                   | Get configuration value  |
| `__sys__.vars.has(key)`              | `boolean`             | Check if key exists      |
| `__sys__.vars.delete(key)`           | `boolean`             | Remove custom property   |
| `__sys__.vars.keys()`                | `string[]`            | List configuration keys  |
| `__sys__.toJSON()`              | `Record<string, any>` | Serialize to JSON        |
| `__sys__.vars.reset()`               | `void`                | Reset to defaults        |
| `__sys__.vars.clone()`               | `XyPrissSys`          | Create independent copy  |

### Environment Helpers

| Method                 | Returns   | Description              |
| ---------------------- | --------- | ------------------------ |
| `__sys__.isProduction()`      | `boolean` | Check if production env  |
| `__sys__.isDevelopment()`     | `boolean` | Check if development env |
| `__sys__.isStaging()`         | `boolean` | Check if staging env     |
| `__sys__.isTest()`            | `boolean` | Check if test env        |
| `__sys__.isEnvironment(name)` | `boolean` | Check custom environment |

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
| `__sys__.os.info()`        | `SystemInfo`            | Complete system information |
| `__sys__.os.cpu(cores?)`   | `CpuUsage \| CpuInfo[]` | CPU usage statistics        |
| `__sys__.os.memory()`      | `MemoryInfo`            | Memory usage statistics     |
| `__sys__.os.uptime()`      | `number`                | System uptime in seconds    |
| `__sys__.os.bootTime()`    | `number`                | Boot time (Unix timestamp)  |
| `__sys__.os.loadAverage()` | `LoadAverage`           | System load averages        |

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

- [CPU Monitoring](./cpu-monitoring.md)
- [Memory Management](./memory-management.md)

---

## Process Management

| Method                      | Returns                        | Description             |
| --------------------------- | ------------------------------ | ----------------------- |
| `__sys__.os.processes(options?)`      | `ProcessInfo[] \| ProcessInfo` | Get process information |
| `__sys__.os.processes({ pid })`       | `ProcessInfo`                  | Get specific process    |
| `__sys__.os.processes({ topCpu: N })` | `ProcessInfo[]`                | Top N CPU consumers     |
| `__sys__.os.processes({ topMem: N })` | `ProcessInfo[]`                | Top N memory consumers  |

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
| `__sys__.os.network(interface?)` | `NetworkStats \| NetworkInterface` | Network statistics |
| `__sys__.os.ports(options?)`     | `PortInfo[]`                       | List open ports    |

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
| `__sys__.os.disks(mountPoint?)` | `DiskInfo[] \| DiskInfo` | Disk information           |
| `__sys__.os.du(path)`           | `DirUsage`               | Directory usage statistics |

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
| `__sys__.path.resolve(path)`      | `string`  | Resolve to absolute path |
| `__sys__.path.join(...paths)`     | `string`  | Join path segments       |
| `__sys__.path.dirname(path)`      | `string`  | Get directory name       |
| `__sys__.path.basename(path)`     | `string`  | Get file name            |
| `__sys__.path.extname(path)`      | `string`  | Get file extension       |
| `__sys__.path.normalize(path)`    | `string`  | Normalize path           |
| `__sys__.path.relative(from, to)` | `string`  | Get relative path        |
| `__sys__.path.isAbsolute(path)`   | `boolean` | Check if absolute        |

**Examples:**

```typescript
__sys__.path.resolve("./config.json"); // "/project/config.json"
__sys__.path.join("src", "utils", "file.ts"); // "src/utils/file.ts"
__sys__.path.dirname("/path/to/file.txt"); // "/path/to"
__sys__.path.basename("/path/to/file.txt"); // "file.txt"
__sys__.path.extname("file.txt"); // ".txt"
```

---

## File I/O

> **Note**: Core File I/O operations are **asynchronous** by default, returning `Promise<T>`. Synchronous equivalents are available via the `Sync` suffix (e.g., `__sys__.fs.readSync`). Streaming is also supported via `__sys__.fs.createReadStream` and `__sys__.fs.createWriteStream`.

### Reading

| Method                         | Returns             | Description               |
| ------------------------------ | ------------------- | ------------------------- |
| `__sys__.fs.read(path)`                  | `Promise<string>`   | Read file as text         |
| `__sys__.fs.readBytes(path)`             | `Promise<Buffer>`   | Read file as bytes        |
| `__sys__.fs.readJson(path)`              | `Promise<any>`      | Read and parse JSON       |
| `__sys__.fs.readJsonSafe(path, default)` | `Promise<any>`      | Read JSON with fallback   |
| `__sys__.fs.readLines(path)`             | `Promise<string[]>` | Read file as lines        |
| `__sys__.fs.readNonEmptyLines(path)`     | `Promise<string[]>` | Read non-empty lines      |
| `__sys__.fs.createReadStream(path)`      | `Readable`          | Native engine read stream |

### Writing

| Method                          | Returns            | Description                |
| ------------------------------- | ------------------ | -------------------------- |
| `__sys__.fs.writeFile(path, data)`        | `Promise<void>`    | Write text or data to file |
| `__sys__.fs.writeBytes(path, data)`       | `Promise<void>`    | Write bytes to file        |
| `__sys__.fs.writeJson(path, data)`        | `Promise<void>`    | Write JSON (pretty)        |
| `__sys__.fs.writeJsonCompact(path, data)` | `Promise<void>`    | Write JSON (compact)       |
| `__sys__.fs.writeIfNotExists(path, data)` | `Promise<boolean>` | Write only if new          |
| `__sys__.fs.append(path, data)`           | `Promise<void>`    | Append to file             |
| `__sys__.fs.appendLine(path, line)`       | `Promise<void>`    | Append line to file        |
| `__sys__.fs.createWriteStream(path)`      | `Writable`         | Native engine write stream |

**Examples:**

```typescript
// Read operations (Async)
const text = await __sys__.fs.read("config.txt");
const json = await __sys__.fs.readJson("data.json");
const lines = await __sys__.fs.readLines("log.txt");

// Read operations (Sync)
const syncText = __sys__.fs.readSync("config.txt");

// Write operations (Async)
await __sys__.fs.write("output.txt", "Hello World");
await __sys__.fs.writeJson("data.json", { key: "value" });
await __sys__.fs.appendLine("log.txt", "New entry");
```

---

## Directory Management

| Method               | Returns    | Description                  |
| -------------------- | ---------- | ---------------------------- |
| `__sys__.fs.mkdir(path)`       | `void`     | Create directory (recursive) |
| `__sys__.path.ensureDir(path)`   | `void`     | Ensure directory exists      |
| `__sys__.fs.ls(path)`          | `string[]` | List directory contents      |
| `__sys__.fs.lsFullPath(path)`  | `string[]` | List with full paths         |
| `__sys__.fs.lsDirs(path)`      | `string[]` | List directories only        |
| `__sys__.fs.lsFiles(path)`     | `string[]` | List files only              |
| `__sys__.fs.lsRecursive(path)` | `string[]` | List recursively             |
| `__sys__.fs.emptyDir(path)`    | `void`     | Remove all contents          |

**Examples:**

```typescript
__sys__.fs.mkdir("new/nested/directory");
const files = __sys__.fs.ls("src");
const dirs = __sys__.fs.lsDirs("src");
const allFiles = __sys__.fs.lsRecursive("src");
```

---

## File Metadata

### Existence & Type Checks

| Method             | Returns     | Description            |
| ------------------ | ----------- | ---------------------- |
| `__sys__.fs.exists(path)`    | `boolean`   | Check if path exists   |
| `__sys__.fs.isFile(path)`    | `boolean`   | Check if file          |
| `__sys__.fs.isDir(path)`     | `boolean`   | Check if directory     |
| `__sys__.fs.isSymlink(path)` | `boolean`   | Check if symbolic link |
| `__sys__.fs.isEmpty(path)`   | `boolean`   | Check if empty         |
| `__sys__.fs.check(path)`     | `PathCheck` | Comprehensive check    |

### File Information

| Method                  | Returns            | Description             |
| ----------------------- | ------------------ | ----------------------- |
| `__sys__.fs.stats(path)`          | `FileStats`        | Get file statistics     |
| `__sys__.fs.size(path, options?)` | `number \| string` | Get file size           |
| `__sys__.fs.sizeHuman(path)`      | `string`           | Get human-readable size |
| `__sys__.fs.createdAt(path)`      | `Date`             | Get creation time       |
| `__sys__.fs.modifiedAt(path)`     | `Date`             | Get modification time   |
| `__sys__.fs.accessedAt(path)`     | `Date`             | Get access time         |

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
if (__sys__.fs.exists("file.txt")) {
    const stats = __sys__.fs.stats("file.txt");
    const size = __sys__.fs.sizeHuman("file.txt");
    const modified = __sys__.fs.modifiedAt("file.txt");
}
```

---

## Search & Discovery

### File Search

| Method                       | Returns    | Description           |
| ---------------------------- | ---------- | --------------------- |
| `__sys__.fs.find(path, pattern)`       | `string[]` | Find by regex pattern |
| `__sys__.fs.findByExt(path, ext)`      | `string[]` | Find by extension     |
| `__sys__.fs.findByPattern(path, glob)` | `string[]` | Find by glob pattern  |

### Content Search

| Method                        | Returns         | Description          |
| ----------------------------- | --------------- | -------------------- |
| `__sys__.fs.grep(path, pattern)`        | `SearchMatch[]` | Search in files      |
| `__sys__.fs.searchInFiles(path, query)` | `SearchMatch[]` | Text search in files |

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
const tsFiles = __sys__.fs.findByExt("src", "ts");

// Find files matching pattern
const configs = __sys__.fs.find(".", ".*\\.config\\..*");

// Search for text in files
const matches = __sys__.fs.grep("src", "TODO");
matches.forEach((m) => {
    console.log(`__sys__.{m.file}:${m.line}: ${m.content}`);
});
```

---

## Advanced Operations

### File Operations

| Method                  | Returns | Description                |
| ----------------------- | ------- | -------------------------- |
| `__sys__.fs.copy(src, dest)`      | `void`  | Copy file or directory     |
| `__sys__.fs.move(src, dest)`      | `void`  | Move/rename file           |
| `__sys__.fs.rename(src, dest)`    | `void`  | Alias for `__sys__.fs.move`          |
| `__sys__.fs.duplicate(src, dest)` | `void`  | Duplicate file             |
| `__sys__.fs.rm(path)`             | `void`  | Remove file or directory   |
| `__sys__.fs.rmIfExists(path)`     | `void`  | Remove if exists           |
| `__sys__.fs.touch(path)`          | `void`  | Create or update timestamp |

### Comparison & Validation

| Method                         | Returns   | Description                |
| ------------------------------ | --------- | -------------------------- |
| `__sys__.fs.hash(path)`                  | `string`  | Calculate SHA-256 hash     |
| `__sys__.fs.verify(path, hash)`          | `boolean` | Verify file hash           |
| `__sys__.fs.isSameContent(path1, path2)` | `boolean` | Compare file contents      |
| `__sys__.fs.isNewer(path1, path2)`       | `boolean` | Compare modification times |

### Permissions (Unix)

| Method               | Returns | Description        |
| -------------------- | ------- | ------------------ |
| `__sys__.fs.chmod(path, mode)` | `void`  | Change permissions |

**Examples:**

```typescript
// File operations
__sys__.fs.copy("source.txt", "backup.txt");
__sys__.fs.move("old.txt", "new.txt");
__sys__.fs.rm("temp.txt");

// Validation
const hash = __sys__.vars.hash("file.txt");
const valid = __sys__.fs.verify("file.txt", hash);

// Comparison
if (__sys__.fs.isNewer("file1.txt", "file2.txt")) {
    console.log("file1.txt is newer");
}

// Permissions (Unix only)
__sys__.fs.chmod("script.sh", "755");
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
    const content = __sys__.fs.read("file.txt");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Operation failed: ${error.message}`);
    }
}
```

---

## Performance Considerations

### Asynchronous I/O by Default

All core File I/O operations are now **asynchronous** and non-blocking, ensuring they do not block the Node.js event loop:

```typescript
// Non-blocking file operations
const content = await __sys__.fs.read("config.txt");
await __sys__.fs.write("output.txt", content);
```

### Synchronous Operations

While File I/O is asynchronous, other metadata methods (`__sys__.fs.ls`, `__sys__.fs.stats`, etc.) and `*Sync` equivalents remain **synchronous** and will block the event loop:

```typescript
// This blocks until complete
const files = __sys__.fs.lsRecursive("large-directory");
// Synchronous I/O
const data = __sys__.fs.readSync("config.txt");
```

### Caching Recommendations

Cache results for frequently accessed data:

```typescript
// Cache system info (changes rarely)
const systemInfo = __sys__.os.info();

// Cache file lists (update periodically)
const fileCache = new Map<string, string[]>();
```

---

## Platform Support

| Feature         | Linux | macOS | Windows |
| --------------- | ----- | ----- | ------- |
| System Info     |      |      |        |
| CPU Monitoring  |      |      |        |
| Memory Stats    |      |      |        |
| Network Stats   |      |      |        |
| Process Info    |      |      |        |
| Disk Info       |      |      |        |
| File Operations |      |      |        |
| Permissions     |      |      | Partial |

---

## Related Documentation

- [Configuration Management](./configuration.md)
- [Environment Variables](./environment.md)
- [CPU Monitoring](./cpu-monitoring.md)
- [Memory Management](./memory-management.md)
- [Network Statistics](./network-statistics.md)
- [Process Management](./process-management.md)
- [Disk Information](./disk-information.md)

---

**Version:** XyPriss v9.5.0+  
**Last Updated:** 2026-01-12
