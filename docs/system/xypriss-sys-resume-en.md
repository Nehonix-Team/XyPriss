# XyPriss v9 — Documentation Summary

> **Compatibility:** XyPriss v9.5.0 and above  
> **Global access:** `__sys__` (available everywhere, no import needed)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Configuration & Metadata](#configuration--metadata)
3. [Environment Variables](#environment-variables)
4. [CPU Monitoring](#cpu-monitoring)
5. [Memory Management](#memory-management)
6. [Disk Information](#disk-information)
7. [Process Management](#process-management)
8. [File Operations (I/O)](#file-operations-io)
9. [Directory Management](#directory-management)
10. [Path Operations](#path-operations)
11. [Search & Filtering](#search--filtering)
12. [Watching & Streaming](#watching--streaming)
13. [Migration v9 → v9](#migration-v9--v9)

---

## Architecture

The system inherits from several stacked layers, all accessible via `__sys__`:

```
XyPrissSys (__sys__)
  └── XyPrissFS
      └── SysApi (monitoring)
          └── FSApi (filesystem)
              └── PathApi (paths)
                  └── BaseApi (foundation)
```

---

## Configuration & Metadata

### Native Properties

| Property                | Type   | Default                   | Description                 |
| ----------------------- | ------ | ------------------------- | --------------------------- |
| `__version__`           | string | `"0.0.0"`                 | Semantic version of the app |
| `__name__`              | string | `"xypriss-app"`           | Application name            |
| `__alias__`             | string | `"app"`                   | Short alias (CLI/logs)      |
| `__author__`            | string | `"unknown"`               | Author                      |
| `__description__`       | string | `"A XyPriss application"` | Description                 |
| `__port__` / `__PORT__` | number | `3000`                    | Server port (synchronized)  |
| `__env__`               | string | `"development"`           | Runtime environment         |
| `__root__`              | string | `process.cwd()`           | Project root                |
| `__app_urls__`          | Record | `{}`                      | Application URLs            |

### Configuration Methods

```typescript
__sys__.vars.update({ __version__: "2.0.0", __port__: 8080 }); // Partial merge
__sys__.vars.set("databaseUrl", "postgresql://..."); // Dynamic addition
__sys__.vars.get<number>("__port__", 3000); // Typed read with default
__sys__.vars.has("databaseUrl"); // Existence check
__sys__.vars.delete("temporaryFlag"); // Removal (not system keys)
__sys__.vars.keys(); // List keys
__sys__.toJSON(); // Serialization
__sys__.vars.reset(); // Reset to defaults
__sys__.vars.clone(); // Independent copy
```

### Environment Checks

```typescript
__sys__.__env__.isProduction(); // __env__ === "production"
__sys__.__env__.isDevelopment(); // __env__ === "development"
__sys__.__env__.isStaging(); // __env__ === "staging"
__sys__.__env__.isTest(); // __env__ === "test"
__sys__.__env__.isEnvironment("qa"); // custom environment
```

---

## Environment Variables

Type-safe interface around `process.env`, accessible via `__sys__.__env__`.

```typescript
__sys__.__env__.get("PORT", "3000"); // Read with default
__sys__.__env__.set("API_KEY", "abc"); // Write (affects current process only)
__sys__.__env__.has("DATABASE_URL"); // Check existence
__sys__.__env__.delete("TEMP_TOKEN"); // Delete
__sys__.__env__.all(); // All variables (caution: sensitive data)
```

**Best practices:**

- Validate required variables at startup (`has()`)
- Explicitly convert types (`parseInt`, `=== "true"`)
- Never log `all()` in production (risk of secret exposure)
- Load `.env` via `dotenv` in development

---

## CPU Monitoring

```typescript
// Global usage
const cpu = __sys__.os.cpu() as CpuUsage;
// { overall: number, per_core: number[], timestamp: number }

// Per-core info
const cores = __sys__.os.cpu(true) as CpuInfo[];
// [{ name, vendor_id, brand, frequency, usage, core_count }, ...]
```

**Common patterns:**

```typescript
// Throttling based on load
if (cpu.overall > 90) await delay(5000); // Defer the task

// Dynamic workers
const workers =
    cpu.overall < 50
        ? Math.floor(cores.length * 0.75)
        : Math.floor(cores.length * 0.25);

// Health check
const status =
    cpu.overall >= 90
        ? "unhealthy"
        : cpu.overall >= 75
          ? "degraded"
          : "healthy";
```

**Best practices:** Avoid polling more than once every 5 seconds. Implement hysteresis (N consecutive readings before acting).

---

## Memory Management

```typescript
const mem = __sys__.os.memory() as MemoryInfo;
// {
//   total, available, used, free, usage_percent,
//   swap_total, swap_used, swap_free, swap_percent
// }
```

**Difference between `free` and `available`:** `free` = completely unused memory; `available` includes reclaimable cache. Use `available` for capacity planning.

**Recommended thresholds:**

| Level     | RAM Threshold | Action                  |
| --------- | ------------- | ----------------------- |
| Warning   | 75%           | Monitor                 |
| Critical  | 85%           | Reduce caches           |
| Emergency | 95%           | Force GC + flush caches |

**Swap:** If `swap_used > 0`, performance is degraded. If `swap_percent > 50`, consider adding more RAM.

---

## Disk Information

```typescript
// All disks
const disks = __sys__.os.disks() as DiskInfo[];

// Specific disk
const root = __sys__.os.disks("/") as DiskInfo;
// {
//   name, mount_point, file_system,
//   total_space, available_space, used_space,
//   usage_percent, is_removable, disk_type
// }
```

**Common patterns:**

```typescript
// Monitoring with levels
if (disk.usage_percent >= 95) console.error("EMERGENCY");
else if (disk.usage_percent >= 90) console.error("CRITICAL");
else if (disk.usage_percent >= 80) console.warn("WARNING");

// Filter out removable disks
const fixed = disks.filter((d) => !d.is_removable);

// Format sizes
const gb = bytes / 1024 ** 3;
```

---

## Process Management

```typescript
// All processes
const all = __sys__.os.processes() as ProcessInfo[];

// Top N by CPU
const topCpu = __sys__.os.processes({ topCpu: 5 }) as ProcessInfo[];

// Top N by memory
const topMem = __sys__.os.processes({ topMem: 5 }) as ProcessInfo[];

// Specific process
const proc = __sys__.os.processes({ pid: 1234 }) as ProcessInfo;
// {
//   pid, name, exe, cmd[], cpu_usage, memory, virtual_memory,
//   status, start_time, run_time, parent_pid, user_id,
//   disk_read, disk_write
// }
```

**Common patterns:**

```typescript
// Find by name
const nodeProcs = all.filter((p) => p.name.includes("node"));

// Detect resource hogs
const hogs = all.filter((p) => p.cpu_usage > 75 || p.memory > 1024 ** 3);

// Long-running processes (> 48h)
const old = all.filter((p) => p.run_time > 48 * 3600);
```

---

## File Operations (I/O)

### Reading

```typescript
__sys__.fs.read("file.txt"); // UTF-8 text
__sys__.fs.readBytes("image.png"); // Binary buffer
__sys__.fs.readJson("config.json"); // Parsed JSON (error if invalid)
__sys__.fs.readJsonSafe("config.json", {}); // JSON with fallback
__sys__.fs.readLines("log.txt"); // Array of lines (includes empty lines)
__sys__.fs.readNonEmptyLines("data.txt"); // Non-empty lines (trimmed)
```

### Writing

```typescript
__sys__.fs.write("output.txt", "content"); // Auto-creates parent dirs, handles primitives natively
__sys__.fs.write("data.json", { a: 1 }); // Automatically stringifies Objects & Arrays to JSON
__sys__.fs.write("image.raw", buffer); // Safely writes Buffers natively
__sys__.fs.writeJson("config.json", data); // Explicit indented JSON alias
__sys__.fs.writeIfNotExists("init.json", "{}"); // Write only if absent → boolean
__sys__.fs.append("log.txt", "data"); // Append to end
__sys__.fs.appendLine("log.txt", "line"); // Append a line (auto \n)
```

**Behavior:** All write operations automatically create missing parent directories intelligently.

### Advanced Management (Ultra-Powerful Options)

```typescript
__sys__.fs.atomicWrite("file.txt", data); // Zero-corruption atomic renaming guaranteed
__sys__.fs.shred("secret.key", 3); // 3-pass cryptographic wipe & irreversible delete
__sys__.fs.tail("system.log", 50); // Fast backwards read of last 50 lines w/o RAM load
__sys__.fs.patch("file.txt", /TODO/g, "DONE"); // Inline sed/regex replacement heavily optimized
__sys__.fs.split("huge.sql", 1024 * 1024 * 50); // Fracture a massive file into 50MB chunks safely
__sys__.fs.merge(["f.001", "f.002"], "huge.sql"); // Binary-join chunks back together
__sys__.fs.lock("shared.db"); // OS-level process concurrency lock
__sys__.fs.unlock("shared.db"); // Release OS lock
```

---

## Directory Management

```typescript
__sys__.fs.mkdir("src/components/ui"); // Create recursively (equivalent to mkdir -p)
__sys__.path.ensureDir("output"); // Alias for $mkdir

__sys__.fs.ls("src"); // Names only
__sys__.fs.lsFullPath("src"); // Full paths
__sys__.fs.lsDirs("src"); // Subdirectories only
__sys__.fs.lsFiles("src"); // Files only
__sys__.fs.lsRecursive("src"); // All files (recursive, full paths)

__sys__.fs.emptyDir("cache"); // Empty a directory (IRREVERSIBLE)
```

**Useful checks:**

```typescript
__sys__.fs.exists("path"); // Exists?
__sys__.fs.isFile("path"); // Is a file?
__sys__.fs.isDir("path"); // Is a directory?
```

---

## Path Operations

```typescript
__sys__.path.resolve("./config.json"); // Absolute path
__sys__.path.join("src", "utils", "helper.ts"); // Join segments
__sys__.path.dirname("/path/to/file.txt"); // Parent directory → "/path/to"
__sys__.path.basename("/path/to/file.txt"); // File name → "file.txt"
__sys__.path.basename("/path/to/file.txt", ".txt"); // Without extension → "file"
__sys__.path.extname("script.min.js"); // Extension → ".js"
__sys__.path.normalize("./src/../lib/index.js"); // Normalize → "lib/index.js"
__sys__.path.relative("/from/path", "/to/path"); // Relative path between two paths
__sys__.path.isAbsolute("/home/user"); // Is absolute? → boolean
__sys__.path.isChild("/home/user", "/home/user/docs"); // Is within? → true
__sys__.path.secureJoin("/home/user", "../etc/passwd"); // Join with security → "/home/user/etc/passwd" (traversal prevented)
__sys__.fs.metadata("./file.ts"); // Structured info → { dir, base, ext, name, isAbsolute }
__sys__.path.toNamespacedPath("C:\\path"); // Windows long-path/UNC formatting
__sys__.path.normalizeSeparators("a/b\\c"); // Standardize for OS → "a/b/c" or "a\b\c"
__sys__.path.commonBase("/a/b/c", "/a/b/d"); // Shared parent → "/a/b"
```

**Pattern: changing the extension**

```typescript
function changeExtension(filePath: string, newExt: string): string {
    const dir = __sys__.path.dirname(filePath);
    const name = __sys__.path.basename(filePath, __sys__.path.extname(filePath));
    return __sys__.path.join(dir, name + newExt);
}
```

---

## Search & Filtering

### File Search

```typescript
__sys__.fs.find("src", ".*\\.ts$"); // Regex on file name
__sys__.fs.findByExt("src", "ts"); // By extension
__sys__.fs.findByPattern("src", "*.test.ts"); // By glob
```

### Content Search

```typescript
__sys__.fs.grep("src", "TODO"); // Regex in content
__sys__.fs.searchInFiles("src", "API_KEY"); // Literal text

// Result: SearchMatch[]
// { file: string, line: number, content: string }
```

**Pattern: codebase analysis**

```typescript
const todos = __sys__.fs.grep("src", "TODO");
const tsFiles = __sys__.fs.findByExt("src", "ts");
const totalLines = tsFiles.reduce(
    (sum, f) => sum + __sys__.fs.readLines(f).length,
    0,
);
```

---

## Watching & Streaming

> **Version:** XyPriss v9.1.0+ (feature/advanced-watching)  
> Native Rust engine (`xsys`) for maximum performance.

### File/Directory Watching

```typescript
// Watch one or more paths
__sys__.fs.watch(["src", "tests"], { duration: 60 }); // or $wp() alias

// Watch with post-cycle callback
__sys__.fs.watchAndProcess(".", () => console.log("Done"), { duration: 10 }); // or $wap()

// Watch file CONTENT (with optional diff)
__sys__.fs.watchContent(["server.ts", "config.json"], {
    duration: 30,
    diff: true,
});
// Aliases: $wc() (1 file), $wcp() (parallel)
```

### Large File Streaming

```typescript
// For multi-GB files (avoids Node.js memory overflows)
__sys__.fs.stream("large-file.log", { chunkSize: 8192, hex: false });
```

---

## Security & Encryption Vault

XyPriss natively features high-grade security tools directly in its Go engine, bypassing Node's memory limitations.

#### `__sys__.fs.writeSecure(p, data, mode)`

Atomically creates and writes a file with locked-down Unix permissions to prevent fractional-second visibility exploits.

```typescript
// Safely storing a JWT key with max restriction
__sys__.fs.writeSecure(".private/jwt.pem", keys, "0600");
```

#### `__sys__.fs.encryptFile(p, key)` / `__sys__.fs.decryptFile(p, key)`

Transforms a file into an impenetrable AES-256-GCM vault directly on disk.

```typescript
__sys__.fs.encryptFile("db_backup.sql", "SUP3R_S3CR3T");
// The file is now binary encrypted noise.
__sys__.fs.decryptFile("db_backup.sql", "SUP3R_S3CR3T"); // Restored
```

---

## Advanced System Analytics

#### `__sys__.fs.diffFiles(fileA, fileB)`

Asks the Go engine to concurrently compute a line-by-line mismatch analysis of two large files.

```typescript
const patch = __sys__.fs.diffFiles("old_conf.json", "new_conf.json");
console.log(patch);
// Output: [{ line: 14, file_a: "...", file_b: "..." }]
```

#### `__sys__.fs.topBigFiles(dir, limit)`

Instantly traverses a system tree and surfaces the most bloated files eating your server disk space.

```typescript
const heavyLoaders = __sys__.fs.topBigFiles("logs/", 5);
console.log(heavyLoaders[0].path); // E.g., "logs/access_2024.log"
console.log(heavyLoaders[0].size); // Returns bytes
```

---

## Migration v9 → v9

### Breaking Changes

| Feature         | v9                | v9                                                             |
| --------------- | ----------------- | -------------------------------------------------------------- |
| Disk usage      | `__sys__.os.diskUsage("/")` | `__sys__.os.disks("/")` → `DiskInfo`                                     |
| File timestamps | ISO string        | Unix timestamp (seconds) → `× 1000` for `new Date()`           |
| `__sys__.fs.size()`       | returns `number`  | returns `{ bytes, formatted }` or `__sys__.fs.size(f, { human: false })` |
| Network speed   | often `0`         | accurate (300ms sampling)                                      |

### New v9 Helpers

```typescript
// Files
__sys__.fs.sizeHuman("file.txt"); // "1.23 MB"
__sys__.fs.createdAt("file.txt"); // Date
__sys__.fs.modifiedAt("file.txt"); // Date
__sys__.fs.accessedAt("file.txt"); // Date
__sys__.fs.isSameContent("f1", "f2"); // Content comparison
__sys__.fs.isNewer("f1", "f2"); // Date comparison
__sys__.fs.rmIfExists("path"); // Remove if exists
__sys__.os.duplicate("src", "dest"); // Duplicate a file
__sys__.fs.rename("old", "new"); // Alias for $move
__sys__.fs.isSymlink("path"); // Is a symbolic link?
__sys__.fs.isEmpty("path"); // Is empty?

// Processes (native filters)
__sys__.os.processes({ topCpu: 5 });
__sys__.os.processes({ topMem: 5 });
__sys__.os.processes({ pid: 1234 });
```

### Recommended Migration Strategy

1. Update the package: `npm install xypriss@^6.0.0`
2. Fix **breaking changes** (timestamps, `__sys__.fs.size`, `__sys__.os.diskUsage`, `__sys__.write` -> `__sys__.fs.writeFile`)
3. Adopt **new features** (`__sys__.fs.readLines`, `__sys__.path.ensureDir`, `__sys__.fs.atomicWrite`, `__sys__.fs.tail`, etc.)
4. Optimize (remove redundant checks, use native filters)

---

## Quick Reference

```typescript
// System
__sys__.os.info()            // Full system info
__sys__.os.cpu()             // Global CPU usage
__sys__.os.memory()          // Memory usage
__sys__.os.disks()           // Disk info
__sys__.os.processes()       // Active processes

// Files
__sys__.fs.exists("f")       __sys__.fs.isFile("f")      __sys__.fs.isDir("f")
__sys__.fs.read("f")         __sys__.fs.write("f", data) __sys__.fs.rm("f")
__sys__.fs.copy("s", "d")    __sys__.fs.move("s", "d")   __sys__.fs.stats("f")

// Directories
__sys__.fs.ls("d")           __sys__.fs.lsRecursive("d") __sys__.fs.mkdir("d")

// Paths
__sys__.path.resolve("p")      __sys__.path.join("a","b")    __sys__.path.basename("p")

// Search
__sys__.fs.find("d","regex") __sys__.fs.grep("d","regex") __sys__.fs.findByExt("d","ts")

// Environment
__sys__.__env__.get("KEY", "default")
__sys__.__env__.isProduction()    __sys__.__env__.isDevelopment()
```

---

_Documentation covering XyPriss v9.5.0+ — Last updated: January 2026_

