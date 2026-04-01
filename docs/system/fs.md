# System Module: Filesystem (`__sys__.fs`)

## Introduction

The `fs` (Filesystem API) module in XyPriss provides a high-level, unified, and ultra-performance abstraction for all file and directory I/O operations.

> [!IMPORTANT]
> **Under the Hood Architecture**
> All methods exposed on `__sys__.fs` delegate the actual heavy-lifting to the **native XyPriss Go Core** (`tools/xypriss-sys-go`). This bridge operates dynamically via the `XyPrissRunner` (using IPC or Spawning), guaranteeing near-native performance, out-of-event-loop multi-threading (won't block Node.js/Bun), and enhanced security through strictly isolated sandboxes.

---

## Core Operations

These methods descend directly from the `FSCore` instance and interact natively with the underlying Go engine.

### `ls`

Retrieves the contents of a directory.

**Signature:**
```typescript
ls(p: string, options?: { stats?: boolean; recursive?: boolean }): string[] | [string, FileStats][]
```

**Description:**
Lists files and directories present at the specified path `p`. If the `stats` option is passed, the function returns an array of tuples containing the file path and its native technical metadata (Size, permissions, GID/UID, etc.).

**Example:**
```typescript
// Simple array of file names
const files = __sys__.fs.ls("/var/log/app");
console.log(files); // ["error.log", "access.log"]

// Detailed list with native Go FileStats
const detailedFiles = __sys__.fs.ls("/var/log/app", { stats: true });
detailedFiles.forEach(([fileName, stats]) => {
    console.log(`${fileName} is ${stats.size} bytes.`);
});
```

### `read` and `readSync`

Reads the contents of a file asynchronously or synchronously.

**Signature:**
```typescript
read(p: string, options?: { bytes?: boolean }): Promise<string>
readSync(p: string, options?: { bytes?: boolean }): string
```

**Description:**
Delegates a read command to the Go process. Extremely performant for standard files. If `bytes` is set to `true`, the raw byte buffer can be retrieved.

**Example:**
```typescript
// Asynchronous (Non-blocking for the Event Loop)
const configData = await __sys__.fs.read("CWD://config.json");

// Synchronous (Blocking)
const template = __sys__.fs.readSync("ROOT://template.html");
```

### `createReadStream` / `createWriteStream`

Creates high-performance streams processed entirely by the Go engine.

**Signature:**
```typescript
createReadStream(p: string, options?: { start?: number; end?: number }): Readable
createWriteStream(p: string): Writable
```

**Description:**
Ideal for processing massive files (since Go natively handles the buffering). The standard Node API `Readable`/`Writable` instances are returned for seamless compatibility with HTTP requests (`req/res`).

**Example:**
```typescript
const stream = __sys__.fs.createReadStream("ROOT://big-data.csv");
stream.pipe(res); // Direct piping to the client via the router
```

### `writeFile` and `writeFileSync`

Writes data to a file.

**Signature:**
```typescript
writeFile(p: string, data: any, options?: { append?: boolean; ensureFile?: boolean }): Promise<void>
```

**Description:**
Writes data to the `p` path. Natively manages the creation of missing parent directories (`ensureFile: true` by default). If `data` is a JSON object, the secure XyPriss serialization (`XStringify`) triggers before the data is passed to Go.

**Example:**
```typescript
await __sys__.fs.writeFile("CWD://log.txt", "New log entry", { append: true });
```

### `rm` and `mkdir`

Destructive and structural management.

**Signature:**
```typescript
rm(p: string, options?: { force?: boolean }): void
mkdir(p: string, options?: { parents?: boolean }): void
```

**Description:**
- `rm`: Deletes the file or directory (use `force` to ignore errors and recursively delete).
- `mkdir`: Creates one or multiple directories. It acts as the native Go equivalent of `mkdir -p` when `parents` is set to `true`.

**Example:**
```typescript
__sys__.fs.mkdir("CWD://.cache/tmp", { parents: true });
__sys__.fs.rm("CWD://.cache", { force: true });
```

### Native Go Statistics and Utilities

- **`stats(p: string): FileStats`**: Returns exact file metadata.
- **`hash(p: string): string`**: Computes the checksum of the file entirely on the Go side (Zero heavy buffer transfer required back to Node).
- **`size(p: string, { human?: boolean }): number | string`**: Returns the size of the file (e.g., `1024` or `"1KB"`).
- **`check(p: string): PathCheck`**: Verifies the existence and status of a path.

---

## Helpers (Convenience Methods)

These methods supplement the core `FSCore` API by adding a practical application layer (`FSHelpers`).

### `lsRecursive`

Complete traversal of a directory tree.

**Signature:**
```typescript
lsRecursive(p: string, filter?: (path: string) => boolean): string[]
```

**Example:**
```typescript
const tsFiles = __sys__.fs.lsRecursive("ROOT://src", (file) => file.endsWith(".ts"));
```

### JSON Serialization (`readJson` / `writeJson`)

**Signature:**
```typescript
readJsonSync<T = any>(p: string): T
writeJsonSync(p: string, data: any, options?: { pretty?: boolean }): void
```

**Description:**
Intelligently combines native Go reading with secure parsing.

**Example:**
```typescript
const appConfig = __sys__.fs.readJsonSync<{ port: number }>("ROOT://xypriss.config.jsonc");
```

### Secure and Atomic Operations

- **`duplicate(p: string, newName: string)`**: Intelligently duplicates a file in the same directory.
- **`rmIfExists(p: string)`**: Gracefully skips deletion if the file does not exist without crashing.
- **`writeAtomic(p: string, data: string)`**: (*FSExtended*) Transactional writing (writes to a temporary file, then performs a native rename to prevent data corruption during power outages or crashes).
