# Filesystem (`__sys__.fs`)

The `__sys__.fs` module provides a unified, high-performance interface for all filesystem operations. By extending multiple specialized layers ranging from core I/O to advanced security handling, it abstracts complex engine interactions into an intuitive API.

## Core Operations

### `ls(p: string, options?: { stats?: boolean; recursive?: boolean }): string[] | [string, FileStats][]`

Lists directory contents. Supports recursive listing and detailed stat generation.

```typescript
const files = __sys__.fs.ls("/var/log", { recursive: true });
```

### `read(p: string, options?: { bytes?: boolean }): Promise<string>` / `readSync(...)`

Reads file bounds either as a native UTF-8 string or hexadecimal bytes. Synchronous implementation is available for bootstrapping tasks.

### `writeFile(p: string, data: any, options?: { append?: boolean; ensureFile?: boolean }): Promise<void>` / `writeFileSync(...)`

Writes objects, buffers, or strings accurately. Recursively ensures directories by default.

### `createReadStream(p: string): Readable` / `createWriteStream(p: string): Writable`

High-performance direct streaming via the native engine, bypassing intermediate node memory buffers for enormous payloads.

### `copy(src: string, dest: string)` (sync) / `move(src: string, dest: string)` (sync) / `rm(p: string, options?: { force: boolean })` (sync) / `mkdir(p: string)` (sync) / `mkdirSafe(p: string)` (sync)

Native system manipulations to duplicate, relocate, forcefully unlink filesystem entries, or safely create directories without throwing "file exists" errors.

---

## Search & Pattern Matching

### `searchInFiles(dir: string, regex: string)` (sync): `SearchMatch[]`

Powerful regex-based grep utility acting directly on file contents inside a parent target.

### `findByPattern(dir: string, pattern: string)` (sync): `string[]` / `findByExt(dir: string, ext: string)` (sync)

Locate paths that strictly comply with semantic text configurations or file extensions.

### `batchRename(dir: string, search: string, replacement: string)` (sync), dryRun?: boolean)`

Massively transforms entity naming efficiently and deterministically. `dryRun` previews modifications.

---

## Archives & Compression

### `compress(src: string, dest: string)` (async) / `decompress(src: string, dest: string)` (async)

Creates or inflates proprietary compression targets.

### `tar(dir: string, output: string)` (async) / `untar(archive: string, dest: string)` (async)

Traditional Unix archives generation and logical unboxing into output trees.

---

## Real-Time Monitoring (Watchers)

### `watch(p: string | string[], options?: { duration?: number })` (async)

Initiates a high-performance interactive CLI tail observer on paths indefinitely or within time boxes.

### `watchAndProcess(p: string, callback: () => void, options?: { duration?: number })` (async)

Combines visual monitoring via CLI format and a programmatic event bus triggering the callback function.

---

## Advanced & Security Interfaces

### `atomicWrite(p: string, data: any)` (async) / `atomicWriteSync(...)` (sync)

Guarantees uninterrupted write sequences utilizing isolated temp files and rename instructions, preventing data corruption during crashes.

### `shred(p: string, passes?: number)` (async)

Securely overwrites sensitive disc blocks heavily to make forensic retrieval mathematically impossible.

### `encryptFile(p: string, key: string)` (async) / `decryptFile(p: string, key: string)` (async)

Imposes military-grade `AES-256-GCM` encryption protocols entirely processed at the core level for minimum memory exposure.

### `lock(p: string)` (sync) / `unlock(p: string)` (sync)

Applies rigid OS-level locks to manage intense multithreading contentions across disjoint system elements.

