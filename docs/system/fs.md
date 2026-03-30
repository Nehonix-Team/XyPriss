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

### `copy(src: string, dest: string)` / `move(src: string, dest: string)` / `rm(p: string, options?: { force: boolean })` / `mkdir(p: string)` / `mkdirSafe(p: string)`

Native system manipulations to duplicate, relocate, forcefully unlink filesystem entries, or safely create directories without throwing "file exists" errors.

---

## Search & Pattern Matching

### `searchInFiles(dir: string, pattern: string): SearchMatch[]`

Powerful regex-based grep utility acting directly on file contents inside a parent target.

### `findByPattern(dir: string, pattern: string): string[]` / `findByExt(dir: string, ext: string)`

Locate paths that strictly comply with semantic text configurations or file extensions.

### `batchRename(path: string, pattern: string, replacement: string, dryRun?: boolean)`

Massively transforms entity naming efficiently and deterministically. `dryRun` previews modifications.

---

## Archives & Compression

### `compress(src: string, dest: string)` / `decompress(src: string, dest: string)`

Creates or inflates proprietary compression targets.

### `tar(dir: string, output: string)` / `untar(archive: string, dest: string)`

Traditional Unix archives generation and logical unboxing into output trees.

---

## Real-Time Monitoring (Watchers)

### `watch(p: string | string[], options?: { duration?: number })`

Initiates a high-performance interactive CLI tail observer on paths indefinitely or within time boxes.

### `watchAndProcess(p: string, callback: () => void, options?: { duration?: number })`

Combines visual monitoring via CLI format and a programmatic event bus triggering the callback function.

---

## Advanced & Security Interfaces

### `atomicWrite(p: string, data: any)` / `atomicWriteSync(...)`

Guarantees uninterrupted write sequences utilizing isolated temp files and rename instructions, preventing data corruption during crashes.

### `shred(p: string, passes?: number)`

Securely overwrites sensitive disc blocks heavily to make forensic retrieval mathematically impossible.

### `encryptFile(p: string, key: string)` / `decryptFile(p: string, key: string)`

Imposes military-grade `AES-256-GCM` encryption protocols entirely processed at the core level for minimum memory exposure.

### `lock(p: string): boolean` / `unlock(p: string)`

Applies rigid OS-level locks to manage intense multithreading contentions across disjoint system elements.

