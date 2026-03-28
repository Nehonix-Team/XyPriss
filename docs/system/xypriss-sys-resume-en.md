# XyPriss v6 — Documentation Summary

> **Compatibility:** XyPriss v6.0.0 and above  
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
13. [Migration v5 → v6](#migration-v5--v6)

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
__sys__.$update({ __version__: "2.0.0", __port__: 8080 }); // Partial merge
__sys__.$add("databaseUrl", "postgresql://..."); // Dynamic addition
__sys__.$get<number>("__port__", 3000); // Typed read with default
__sys__.$has("databaseUrl"); // Existence check
__sys__.$remove("temporaryFlag"); // Removal (not system keys)
__sys__.$keys(); // List keys
__sys__.$toJSON(); // Serialization
__sys__.$reset(); // Reset to defaults
__sys__.$clone(); // Independent copy
```

### Environment Checks

```typescript
__sys__.$isProduction(); // __env__ === "production"
__sys__.$isDevelopment(); // __env__ === "development"
__sys__.$isStaging(); // __env__ === "staging"
__sys__.$isTest(); // __env__ === "test"
__sys__.$isEnvironment("qa"); // custom environment
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
const cpu = __sys__.$cpu() as CpuUsage;
// { overall: number, per_core: number[], timestamp: number }

// Per-core info
const cores = __sys__.$cpu(true) as CpuInfo[];
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
const mem = __sys__.$memory() as MemoryInfo;
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
const disks = __sys__.$disks() as DiskInfo[];

// Specific disk
const root = __sys__.$disks("/") as DiskInfo;
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
const all = __sys__.$processes() as ProcessInfo[];

// Top N by CPU
const topCpu = __sys__.$processes({ topCpu: 5 }) as ProcessInfo[];

// Top N by memory
const topMem = __sys__.$processes({ topMem: 5 }) as ProcessInfo[];

// Specific process
const proc = __sys__.$processes({ pid: 1234 }) as ProcessInfo;
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
__sys__.$read("file.txt"); // UTF-8 text
__sys__.$readBytes("image.png"); // Binary buffer
__sys__.$readJson("config.json"); // Parsed JSON (error if invalid)
__sys__.$readJsonSafe("config.json", {}); // JSON with fallback
__sys__.$readLines("log.txt"); // Array of lines (includes empty lines)
__sys__.$readNonEmptyLines("data.txt"); // Non-empty lines (trimmed)
```

### Writing

```typescript
__sys__.$writeFile("output.txt", "content"); // Auto-creates parent dirs, handles primitives natively
__sys__.$writeFile("data.json", { a: 1 }); // Automatically stringifies Objects & Arrays to JSON
__sys__.$writeFile("image.raw", buffer); // Safely writes Buffers natively
__sys__.$writeJson("config.json", data); // Explicit indented JSON alias
__sys__.$writeIfNotExists("init.json", "{}"); // Write only if absent → boolean
__sys__.$append("log.txt", "data"); // Append to end
__sys__.$appendLine("log.txt", "line"); // Append a line (auto \n)
```

**Behavior:** All write operations automatically create missing parent directories intelligently.

### Advanced Management (Ultra-Powerful Options)

```typescript
__sys__.$atomicWrite("file.txt", data); // Zero-corruption atomic renaming guaranteed
__sys__.$shred("secret.key", 3); // 3-pass cryptographic wipe & irreversible delete
__sys__.$tail("system.log", 50); // Fast backwards read of last 50 lines w/o RAM load
__sys__.$patch("file.txt", /TODO/g, "DONE"); // Inline sed/regex replacement heavily optimized
__sys__.$split("huge.sql", 1024 * 1024 * 50); // Fracture a massive file into 50MB chunks safely
__sys__.$merge(["f.001", "f.002"], "huge.sql"); // Binary-join chunks back together
__sys__.$lock("shared.db"); // OS-level process concurrency lock
__sys__.$unlock("shared.db"); // Release OS lock
```

---

## Directory Management

```typescript
__sys__.$mkdir("src/components/ui"); // Create recursively (equivalent to mkdir -p)
__sys__.$ensureDir("output"); // Alias for $mkdir

__sys__.$ls("src"); // Names only
__sys__.$lsFullPath("src"); // Full paths
__sys__.$lsDirs("src"); // Subdirectories only
__sys__.$lsFiles("src"); // Files only
__sys__.$lsRecursive("src"); // All files (recursive, full paths)

__sys__.$emptyDir("cache"); // Empty a directory (IRREVERSIBLE)
```

**Useful checks:**

```typescript
__sys__.$exists("path"); // Exists?
__sys__.$isFile("path"); // Is a file?
__sys__.$isDir("path"); // Is a directory?
```

---

## Path Operations

```typescript
__sys__.$resolve("./config.json"); // Absolute path
__sys__.$join("src", "utils", "helper.ts"); // Join segments
__sys__.$dirname("/path/to/file.txt"); // Parent directory → "/path/to"
__sys__.$basename("/path/to/file.txt"); // File name → "file.txt"
__sys__.$basename("/path/to/file.txt", ".txt"); // Without extension → "file"
__sys__.$extname("script.min.js"); // Extension → ".js"
__sys__.$normalize("./src/../lib/index.js"); // Normalize → "lib/index.js"
__sys__.$relative("/from/path", "/to/path"); // Relative path between two paths
__sys__.$isAbsolute("/home/user"); // Is absolute? → boolean
__sys__.$isChild("/home/user", "/home/user/docs"); // Is within? → true
__sys__.$secureJoin("/home/user", "../etc/passwd"); // Join with security → "/home/user/etc/passwd" (traversal prevented)
__sys__.$metadata("./file.ts"); // Structured info → { dir, base, ext, name, isAbsolute }
__sys__.$toNamespacedPath("C:\\path"); // Windows long-path/UNC formatting
__sys__.$normalizeSeparators("a/b\\c"); // Standardize for OS → "a/b/c" or "a\b\c"
__sys__.$commonBase("/a/b/c", "/a/b/d"); // Shared parent → "/a/b"
```

**Pattern: changing the extension**

```typescript
function changeExtension(filePath: string, newExt: string): string {
    const dir = __sys__.$dirname(filePath);
    const name = __sys__.$basename(filePath, __sys__.$extname(filePath));
    return __sys__.$join(dir, name + newExt);
}
```

---

## Search & Filtering

### File Search

```typescript
__sys__.$find("src", ".*\\.ts$"); // Regex on file name
__sys__.$findByExt("src", "ts"); // By extension
__sys__.$findByPattern("src", "*.test.ts"); // By glob
```

### Content Search

```typescript
__sys__.$grep("src", "TODO"); // Regex in content
__sys__.$searchInFiles("src", "API_KEY"); // Literal text

// Result: SearchMatch[]
// { file: string, line: number, content: string }
```

**Pattern: codebase analysis**

```typescript
const todos = __sys__.$grep("src", "TODO");
const tsFiles = __sys__.$findByExt("src", "ts");
const totalLines = tsFiles.reduce(
    (sum, f) => sum + __sys__.$readLines(f).length,
    0,
);
```

---

## Watching & Streaming

> **Version:** XyPriss v6.1.0+ (feature/advanced-watching)  
> Native Rust engine (`xsys`) for maximum performance.

### File/Directory Watching

```typescript
// Watch one or more paths
__sys__.$watch(["src", "tests"], { duration: 60 }); // or $wp() alias

// Watch with post-cycle callback
__sys__.$watchAndProcess(".", () => console.log("Done"), { duration: 10 }); // or $wap()

// Watch file CONTENT (with optional diff)
__sys__.$watchContent(["server.ts", "config.json"], {
    duration: 30,
    diff: true,
});
// Aliases: $wc() (1 file), $wcp() (parallel)
```

### Large File Streaming

```typescript
// For multi-GB files (avoids Node.js memory overflows)
__sys__.$stream("large-file.log", { chunkSize: 8192, hex: false });
```

---

## Security & Encryption Vault

XyPriss natively features high-grade security tools directly in its Go engine, bypassing Node's memory limitations.

#### `$writeSecure(p, data, mode)`

Atomically creates and writes a file with locked-down Unix permissions to prevent fractional-second visibility exploits.

```typescript
// Safely storing a JWT key with max restriction
__sys__.$writeSecure(".private/jwt.pem", keys, "0600");
```

#### `$encrypt(p, key)` / `$decrypt(p, key)`

Transforms a file into an impenetrable AES-256-GCM vault directly on disk.

```typescript
__sys__.$encrypt("db_backup.sql", "SUP3R_S3CR3T");
// The file is now binary encrypted noise.
__sys__.$decrypt("db_backup.sql", "SUP3R_S3CR3T"); // Restored
```

---

## Advanced System Analytics

#### `$diffFiles(fileA, fileB)`

Asks the Go engine to concurrently compute a line-by-line mismatch analysis of two large files.

```typescript
const patch = __sys__.$diffFiles("old_conf.json", "new_conf.json");
console.log(patch);
// Output: [{ line: 14, file_a: "...", file_b: "..." }]
```

#### `$topBigFiles(dir, limit)`

Instantly traverses a system tree and surfaces the most bloated files eating your server disk space.

```typescript
const heavyLoaders = __sys__.$topBigFiles("logs/", 5);
console.log(heavyLoaders[0].path); // E.g., "logs/access_2024.log"
console.log(heavyLoaders[0].size); // Returns bytes
```

---

## Migration v5 → v6

### Breaking Changes

| Feature         | v5                | v6                                                             |
| --------------- | ----------------- | -------------------------------------------------------------- |
| Disk usage      | `$diskUsage("/")` | `$disks("/")` → `DiskInfo`                                     |
| File timestamps | ISO string        | Unix timestamp (seconds) → `× 1000` for `new Date()`           |
| `$size()`       | returns `number`  | returns `{ bytes, formatted }` or `$size(f, { human: false })` |
| Network speed   | often `0`         | accurate (300ms sampling)                                      |

### New v6 Helpers

```typescript
// Files
__sys__.$sizeHuman("file.txt"); // "1.23 MB"
__sys__.$createdAt("file.txt"); // Date
__sys__.$modifiedAt("file.txt"); // Date
__sys__.$accessedAt("file.txt"); // Date
__sys__.$isSameContent("f1", "f2"); // Content comparison
__sys__.$isNewer("f1", "f2"); // Date comparison
__sys__.$rmIfExists("path"); // Remove if exists
__sys__.$duplicate("src", "dest"); // Duplicate a file
__sys__.$rename("old", "new"); // Alias for $move
__sys__.$isSymlink("path"); // Is a symbolic link?
__sys__.$isEmpty("path"); // Is empty?

// Processes (native filters)
__sys__.$processes({ topCpu: 5 });
__sys__.$processes({ topMem: 5 });
__sys__.$processes({ pid: 1234 });
```

### Recommended Migration Strategy

1. Update the package: `npm install xypriss@^6.0.0`
2. Fix **breaking changes** (timestamps, `$size`, `$diskUsage`, `$write` -> `$writeFile`)
3. Adopt **new features** (`$readLines`, `$ensureDir`, `$atomicWrite`, `$tail`, etc.)
4. Optimize (remove redundant checks, use native filters)

---

## Quick Reference

```typescript
// System
__sys__.$info()            // Full system info
__sys__.$cpu()             // Global CPU usage
__sys__.$memory()          // Memory usage
__sys__.$disks()           // Disk info
__sys__.$processes()       // Active processes

// Files
__sys__.$exists("f")       __sys__.$isFile("f")      __sys__.$isDir("f")
__sys__.$read("f")         __sys__.$writeFile("f", data) __sys__.$rm("f")
__sys__.$copy("s", "d")    __sys__.$move("s", "d")   __sys__.$stats("f")

// Directories
__sys__.$ls("d")           __sys__.$lsRecursive("d") __sys__.$mkdir("d")

// Paths
__sys__.$resolve("p")      __sys__.$join("a","b")    __sys__.$basename("p")

// Search
__sys__.$find("d","regex") __sys__.$grep("d","regex") __sys__.$findByExt("d","ts")

// Environment
__sys__.__env__.get("KEY", "default")
__sys__.$isProduction()    __sys__.$isDevelopment()
```

---

_Documentation covering XyPriss v6.0.0+ — Last updated: January 2026_

