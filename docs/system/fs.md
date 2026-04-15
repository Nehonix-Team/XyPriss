# System Module: Filesystem (`__sys__.fs`)

## Introduction

The `fs` (Filesystem API) module in XyPriss provides a high-level, unified, and ultra-performance abstraction for all file and directory I/O operations.

> [!IMPORTANT]
> **Under the Hood Architecture**
> All methods exposed on `__sys__.fs` delegate the actual heavy lifting to the [**XHSC (XyPriss Hyper-System Core)**](../core/XHSC_CORE.md). This bridge operates dynamically via the `XyPrissRunner` (using IPC or Spawning), guaranteeing near-native performance, off-event-loop multithreading (won't block Node.js).

---

## Core Operations

These methods descend directly from the `FSCore` instance and interact natively with the underlying XHSC engine.

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

// Detailed list with native XHSC FileStats
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
Delegates a read command to the XHSC core. Extremely performant for standard files. If `bytes` is set to `true`, the raw byte buffer can be retrieved.

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
Ideal for processing massive files (since XHSC natively handles the buffering). The standard Node API `Readable`/`Writable` instances are returned for seamless compatibility with HTTP requests (`req/res`).

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
Writes data to the `p` path. Natively manages the creation of missing parent directories (`ensureFile: true` by default). If `data` is a JSON object, the secure XyPriss serialization (`XStringify`) triggers before the data is passed to XHSC.

**Example:**

```typescript
await __sys__.fs.writeFile("CWD://log.txt", "New log entry", { append: true });
```

### `copy` / `move`

File and directory relocation.

**Signature:**

```typescript
copy(src: string, dest: string, options?: { progress?: boolean }): void
move(src: string, dest: string): void
```

**Example:**

```typescript
__sys__.fs.copy("CWD://config.json", "CWD://config.backup.json");
__sys__.fs.move("CWD://old-name.ts", "CWD://new-name.ts");
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
- `mkdir`: Creates one or multiple directories. It acts as the native XHSC equivalent of `mkdir -p` when `parents` is set to `true`.

**Example:**

```typescript
__sys__.fs.mkdir("CWD://.cache/tmp", { parents: true });
__sys__.fs.rm("CWD://.cache", { force: true });
```

### `open` and `close`

High-performance, stateful file handle management with an integrated **Hyper-Powerful Toolbox**.

**Signatures:**

```typescript
open(path: string, flags?: number | string, callback?: (file: FileHandle) => Promise<void> | void): Promise<number | void>
close(handle: number): Promise<void>
```

**Description:**

- `open`: Opens a file and returns a native numeric handle. If a **callback** is provided, it receives a `FileHandle` toolbox and the handle is automatically closed after execution.
- `close`: Native closure of the handle, ensuring all buffers are flushed to disk.

#### Supported Open Flags (`OpenFlag`)

The `open` method supports standard Node.js-style string flags, which are natively mapped to XHSC `os` constants:

| Flag    | Mode   | Description                                                | Native Go Mapping                  |
| ------- | ------ | ---------------------------------------------------------- | ---------------------------------- |
| `'r'`   | Read   | Open for reading (default). Fails if missing.              | `O_RDONLY`                         |
| `'r+'`  | R/W    | Open for reading and writing. Fails if missing.            | `O_RDWR`                           |
| `'rs+'` | R/W    | Open for reading and writing in synchronous mode.          | `O_RDWR \| O_SYNC`                 |
| `'w'`   | Write  | Open for writing. Created if missing, truncated if exists. | `O_WRONLY \| O_CREATE \| O_TRUNC`  |
| `'wx'`  | Write  | Like `'w'` but fails if the file already exists.           | `O_WRONLY \| O_CREATE \| O_EXCL`   |
| `'w+'`  | R/W    | Open for reading/writing. Created or truncated.            | `O_RDWR \| O_CREATE \| O_TRUNC`    |
| `'wx+'` | R/W    | Like `'w+'` but fails if the file already exists.          | `O_RDWR \| O_CREATE \| O_EXCL`     |
| `'a'`   | Append | Open for appending. Created if missing.                    | `O_WRONLY \| O_APPEND \| O_CREATE` |
| `'ax'`  | Append | Like `'a'` but fails if the file already exists.           | `O_WRONLY \| O_APPEND \| O_EXCL`   |
| `'a+'`  | R/W    | Open for reading and appending. Created if missing.        | `O_RDWR \| O_APPEND \| O_CREATE`   |
| `'ax+'` | R/W    | Like `'a+'` but fails if the file already exists.          | `O_RDWR \| O_APPEND \| O_EXCL`     |

#### The `FileHandle` Toolbox

When using the callback pattern, you get access to a stateful toolbox that allows performing multiple operations on the same open handle with extreme efficiency.

| Method                   | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `file.read(len)`         | Reads up to `len` bytes from the current position.     |
| `file.write(data)`       | Writes `Buffer` or `string` at the current position.   |
| `file.seek(off, whence)` | Moves the file pointer (0: Start, 1: Current, 2: End). |
| `file.stat()`            | Retrieves native metadata for the open handle.         |
| `file.nativeId`          | Returns the underlying numeric handle ID.              |

**Performance & IPC Optimization**:
These APIs utilize **Direct IPC Overrides**. If a XyPriss server is active, the toolbox communicates directly via Unix Sockets using an optimized **Base64 binary protocol**, bypassing the overhead of process spawning for every operation. This makes the toolbox "Hyper Powerful" and suitable for intensive I/O tasks.

**Example:**

```typescript
await __sys__.fs.open("data.bin", "r+", async (file) => {
    console.log("Opened handle:", file.nativeId);

    // Read first 10 bytes
    const header = await file.read(10);

    // Jump to the end and append data
    await file.seek(0, 2);
    await file.write(" [EOF SIGNATURE]");

    // Check final size
    const stats = await file.stat();
    console.log("Final size:", stats.size);
}); // Handle is automatically closed here
```

### `rmMany`

Bulk deletion from an array of paths.

**Signature:**

```typescript
rmMany(paths: string[], options?: { force?: boolean }): void
```

**Description:**
Applies `rm` sequentially to each path in the provided array. Particularly useful for post-processing cleanup (e.g., removing file chunks after merging).

**Example:**

```typescript
const chunks = __sys__.fs.split("large-video.mp4", 10_000_000);
__sys__.fs.merge(chunks, "large-video.restored.mp4");

// Clean up all chunks at once
__sys__.fs.rmMany(chunks, { force: true });
```

### `touch`

Creates an empty file at the specified path, or updates its modification timestamp if it already exists.

**Signature:**

```typescript
touch(p: string): void
```

**Example:**

```typescript
__sys__.fs.touch("CWD://logs/.gitkeep");
```

### `link`

Creates a symbolic link pointing from `dest` to `src`.

**Signature:**

```typescript
link(src: string, dest: string): void
```

**Example:**

```typescript
__sys__.fs.link("CWD://dist/index.js", "CWD://bin/app");
```

### `chmod`

Changes the permissions of a file or directory using a Unix-style mode string.

**Signature:**

```typescript
chmod(p: string, mode: string): void
```

**Example:**

```typescript
__sys__.fs.chmod("CWD://scripts/start.sh", "755"); // rwxr-xr-x
__sys__.fs.chmod("CWD://secrets/.env", "600"); // rw-------
```

### Native XHSC Statistics and Utilities

- **`stats(p: string): FileStats`** — Returns exact file metadata (size, permissions, timestamps, GID/UID).
- **`hash(p: string): string`** — Computes the file checksum entirely in XHSC (no buffer transfer to Node).
- **`verify(p: string, hash: string): boolean`** — Verifies a file against a known checksum.
- **`size(p: string, { human?: boolean }): number | string`** — Returns size in bytes or human-readable form (e.g., `"1.2 MB"`).
- **`check(p: string): PathCheck`** — Verifies existence and status of a path.
- **`du(p: string): DirUsage`** — Returns full disk usage of a directory tree.
- **`sync(src: string, dest: string): void`** — Synchronizes two directories (one-way mirror).
- **`dedupe(p: string): DedupeGroup[]`** — Finds duplicate files within a directory by content hash.

---

## Helpers (Convenience Methods)

These methods supplement `FSCore` with higher-level, practical utilities (`FSHelpers`). All operations are backed by the native XHSC engine.

### Filtered Listing

```typescript
lsDirs(p: string): string[]
lsFiles(p: string): string[]
lsFullPath(p: string): string[]
lsRecursive(p: string, filter?: (path: string) => boolean): string[]
```

- `lsDirs` — Returns only subdirectory names (filters by `FileStats.is_dir`).
- `lsFiles` — Returns only file names (filters by `FileStats.is_file`).
- `lsFullPath` — Returns fully resolved absolute paths instead of names.
- `lsRecursive` — Deep traversal with optional filter callback.

```typescript
const dirs = __sys__.fs.lsDirs("ROOT://src");
const tsFiles = __sys__.fs.lsRecursive("ROOT://src", (f) => f.endsWith(".ts"));
```

### Binary I/O (`readBytes` / `writeBytes`)

Read and write raw binary `Buffer` objects, bypassing all text encoding.

```typescript
readBytes(p: string): Promise<Buffer>
readBytesSync(p: string): Buffer
writeBytes(p: string, data: Buffer): Promise<void>
writeBytesSync(p: string, data: Buffer): void
```

```typescript
const imageBuffer = await __sys__.fs.readBytes("CWD://avatar.png");
await __sys__.fs.writeBytes("CWD://avatar-copy.png", imageBuffer);
```

### Line-by-Line Reading

```typescript
readLines(p: string): Promise<string[]>
readLinesSync(p: string): string[]
readNonEmptyLines(p: string): Promise<string[]>
readNonEmptyLinesSync(p: string): string[]
```

```typescript
const lines = __sys__.fs.readLinesSync("CWD://data.csv");
const nonEmpty = __sys__.fs.readNonEmptyLinesSync("CWD://config.ini");
```

### Append Operations

```typescript
append(p: string, data: any): Promise<void>
appendSync(p: string, data: any): void
appendLine(p: string, line: any): Promise<void>
appendLineSync(p: string, line: any): void
```

```typescript
await __sys__.fs.appendLine("CWD://logs/access.log", `${Date.now()} GET /api`);
```

### Conditional Writes

```typescript
writeIfNotExists(p: string, data: any): Promise<boolean>
writeIfNotExistsSync(p: string, data: any): boolean
```

Returns `true` if the file was created, `false` if it already existed.

```typescript
await __sys__.fs.writeIfNotExists("CWD://.env", "PORT=8080");
```

### JSON Serialization

```typescript
readJson<T = any>(p: string): Promise<T>
readJsonSync<T = any>(p: string): T
readJsonSafe<T>(p: string, defaultValue: T): Promise<T>
readJsonSafeSync<T>(p: string, defaultValue: T): T
writeJson(p: string, data: any): Promise<void>
writeJsonSync(p: string, data: any): void
```

- `readJsonSafe` / `readJsonSafeSync` — Return `defaultValue` instead of throwing if the file is missing or malformed.

```typescript
const config = __sys__.fs.readJsonSync<{ port: number }>(
    "ROOT://xypriss.config.jsonc",
);
const opts = await __sys__.fs.readJsonSafe("CWD://options.json", {
    debug: false,
});
```

### Directory Utilities

```typescript
ensureDir(p: string): void
mkdirSafe(p: string): boolean
```

- `ensureDir` — Creates the directory (with parents) if it does not already exist. Never throws.
- `mkdirSafe` — Returns `true` if created, `false` if it already existed.

```typescript
__sys__.fs.ensureDir("CWD://uploads/2026");
const created = __sys__.fs.mkdirSafe("CWD://cache");
```

### Miscellaneous Aliases

- **`rename(oldPath, newPath)`** — Alias for `move`.
- **`readFile(p)` / `readFileSync(p)`** — Aliases for `read` / `readSync`.
- **`duplicate(p, newName)`** — Copies a file to the same directory under a new name.
- **`rmIfExists(p)`** — Deletes without throwing if the file does not exist.

---

## Search and Pattern Matching (`FSSearch`)

These methods query the filesystem by content or name pattern using the native Go search engine.

### `searchInFiles`

Full-text search across a directory tree.

**Signature:**

```typescript
searchInFiles(dir: string, pattern: string): SearchMatch[]
```

**Example:**

```typescript
const todos = __sys__.fs.searchInFiles("./src", "TODO");
todos.forEach((match) =>
    console.log(`${match.file}:${match.line} — ${match.content}`),
);
```

### `findByPattern` / `findByExt`

Glob and extension-based file discovery.

**Signature:**

```typescript
findByPattern(dir: string, pattern: string): string[]
findByExt(dir: string, ext: string): string[]
```

**Example:**

```typescript
const tsFiles = __sys__.fs.findByPattern("./src", "*.ts");
const images = __sys__.fs.findByExt("./assets", "png");
```

### `batchRename`

Mass rename files matching a regex pattern.

**Signature:**

```typescript
batchRename(path: string, pattern: string, replacement: string, dryRun?: boolean): number | BatchRenameChange[]
```

**Description:**
Pass `dryRun: true` to preview changes without committing them.

**Example:**

```typescript
// Preview renames
const preview = __sys__.fs.batchRename("./dist", "\\.js$", ".mjs", true);

// Apply
__sys__.fs.batchRename("./dist", "\\.js$", ".mjs");
```

### `findModifiedSince`

Finds files changed within the last N hours.

**Signature:**

```typescript
findModifiedSince(dir: string, hours: number): string[]
```

**Example:**

```typescript
const recentChanges = __sys__.fs.findModifiedSince("./src", 24);
```

---

## Archive and Compression (`FSArchive`)

All compression and archiving operations execute inside the XHSC core — no Node.js buffer overhead.

### `compress` / `decompress`

Lossless file compression.

**Signature:**

```typescript
compress(src: string, dest: string): void
decompress(src: string, dest: string): void
```

**Example:**

```typescript
__sys__.fs.compress("data.json", "data.json.gz");
__sys__.fs.decompress("data.json.gz", "data.restored.json");
```

### `tar` / `untar`

TAR archiving and extraction.

**Signature:**

```typescript
tar(dir: string, output: string): void
untar(archive: string, dest: string): void
```

**Example:**

```typescript
__sys__.fs.tar("./src", "src_backup.tar");
__sys__.fs.untar("src_backup.tar", "./restore");
```

---

## File Watching (`FSWatch`)

Reactive filesystem monitoring powered by the XHSC event system.

### `watch`

Monitors one or multiple paths for any change event.

**Signature:**

```typescript
watch(p: string | string[], options?: { duration?: number }): void
```

**Example:**

```typescript
__sys__.fs.watch(["./src", "./config"], { duration: 300 });
```

### `watchContent`

Monitors file content changes with optional diff output.

**Signature:**

```typescript
watchContent(p: string | string[], options?: { duration?: number; diff?: boolean }): void
```

**Example:**

```typescript
__sys__.fs.watchContent("./logs/app.log", { diff: true });
```

### `watchAndProcess` (alias: `wap`)

Watches a path and triggers a callback on every detected change.

**Signature:**

```typescript
watchAndProcess(p: string, callback: () => void, options?: { duration?: number }): void
```

**Example:**

```typescript
__sys__.fs.watchAndProcess("./src", () => {
    console.log("Source changed — re-running build...");
});
```

### Method Aliases

| Alias | Full Method            |
| ----- | ---------------------- |
| `wap` | `watchAndProcess`      |
| `wc`  | `watchContent`         |
| `wp`  | `watchParallel`        |
| `wcp` | `watchContentParallel` |

---

## Security and Advanced Operations (`FSExtended`)

### File Encryption / Decryption

Encrypts and decrypts files in-place using the `xypriss-security` `Cipher` engine (AES-256-GCM).

**Signature:**

```typescript
encryptFile(p: string, key: string): Promise<void>
decryptFile(p: string, key: string): Promise<void>
```

**Description:**
Both operations are performed in-place — the source file is overwritten with the encrypted/decrypted output. Use atomic writes upstream if you need recovery guarantees.

**Example:**

```typescript
await __sys__.fs.encryptFile("CWD://secrets.json", process.env.MASTER_KEY!);
await __sys__.fs.decryptFile("CWD://secrets.json", process.env.MASTER_KEY!);
```

> [!CAUTION]
> Losing the encryption key renders the file permanently unrecoverable. Always store keys in a dedicated secrets manager.

### `shred`

Secure deletion — overwrites file content with random data N times before removing it.

**Signature:**

```typescript
shred(p: string, passes?: number): void
```

**Example:**

```typescript
__sys__.fs.shred("CWD://private-key.pem", 7);
```

### `writeSecure` / `writeSecureSync`

Writes data with a specific filesystem permission mode applied atomically.

**Signature:**

```typescript
writeSecure(p: string, data: any, mode: string): Promise<void>
writeSecureSync(p: string, data: any, mode: string): void
```

**Example:**

```typescript
await __sys__.fs.writeSecure("CWD://config/secrets.env", envContent, "600");
```

### `lock` / `unlock`

Advisory file locking to prevent concurrent write conflicts.

**Signature:**

```typescript
lock(p: string): boolean
unlock(p: string): void
```

**Example:**

```typescript
if (__sys__.fs.lock("CWD://db.lock")) {
    // Safe to proceed with exclusive write
    await writeDb();
    __sys__.fs.unlock("CWD://db.lock");
}
```

### `patch`

In-place content replacement within a file.

**Signature:**

```typescript
patch(p: string, searchValue: string | RegExp, replaceValue: string): boolean
```

**Example:**

```typescript
const changed = __sys__.fs.patch(
    "CWD://config.ts",
    "OLD_API_URL",
    "https://api.nehonix.com",
);
```

### `tail`

Reads the last N lines of a file — ideal for log streaming.

**Signature:**

```typescript
tail(p: string, lines?: number): string[]
```

**Example:**

```typescript
const lastLines = __sys__.fs.tail("CWD://logs/app.log", 50);
```

### `diffFiles`

Compares two files line by line and returns the differences.

**Signature:**

```typescript
diffFiles(fileA: string, fileB: string): Array<{ line: number; file_a: string; file_b: string }>
```

**Example:**

```typescript
const diff = __sys__.fs.diffFiles("config.v1.json", "config.v2.json");
diff.forEach((d) => console.log(`Line ${d.line}: ${d.file_a} → ${d.file_b}`));
```

### `split` / `merge`

Binary file chunking and reassembly.

**Signature:**

```typescript
split(p: string, bytesPerChunk: number, outDir?: string): string[]
merge(sourceFiles: string[], destFile: string): void
```

**Example:**

```typescript
const chunks = __sys__.fs.split("large-video.mp4", 10_000_000); // 10MB chunks
__sys__.fs.merge(chunks, "large-video.restored.mp4");
```

### `topBigFiles`

Finds the largest files in a directory tree.

**Signature:**

```typescript
topBigFiles(dir: string, limit?: number): Array<{ path: string; size: number }>
```

**Example:**

```typescript
const heaviest = __sys__.fs.topBigFiles("./", 10);
heaviest.forEach((f) => console.log(`${f.path}: ${f.size} bytes`));
```

