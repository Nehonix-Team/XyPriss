# Watching & Streaming APIs

**Version:** XyPriss v9.1.0+  
**Branch:** feature/advanced-watching

## Overview

This document describes the high-performance file watching and streaming capabilities of the XyPriss System API. These features are powered by the native engine (`xsys`) for maximum efficiency and reliability.

## File Watching API

### `__sys__.fs.watch(path | path[], options)`

**Alias:** `__sys__.fs.wp(paths, options)` (Watch Parallel)

Monitors one or more files or directories for system-level events (Created, Modified, Deleted, Renamed).

**Parameters:**

- `path` (string | string[]): Single path or array of paths to monitor.
- `options` (object):
    - `duration` (number): Watch duration in seconds (default: 60).

**Parallel Example:**

```typescript
// Watch multiple project folders simultaneously
__sys__.fs.watch(["src", "tests", "docs"], { duration: 60 });
```

---

### `__sys__.fs.watchAndProcess(path, callback, options)`

**Alias:** `__sys__.fs.wap(path, callback, options)`

Convenience utility that monitors a path and executes a logic callback after the cycle.

**Example:**

```typescript
__sys__.fs.wap(
    ".",
    () => {
        console.log("Check complete.");
    },
    { duration: 10 },
);
```

---

### `__sys__.fs.watchContent(path | path[], options)`

**Alias:** `__sys__.fs.wc(path, options)`, `__sys__.fs.wcp(paths, options)`

**NEW:** Deep-monitoring sub-system that watches the actual **content** of one or more files in parallel.

**Parameters:**

- `path` (string | string[]): Target file path(s).
- `options` (object):
    - `duration` (number): Watch duration in seconds.
    - `diff` (boolean): If `true`, computes and displays granular additions/removals.

**Example:**

```typescript
// Parallel content monitoring with diffing
__sys__.fs.wcp(["server.ts", "config.json"], { duration: 30, diff: true });
```

## File Streaming API

### `__sys__.fs.createReadStream(path)`

Creates a high-performance native-backed `Readable` stream by piping raw bytes linearly from the engine. This replaces Node.js's native `fs.createReadStream` for optimized, zero-buffer read performance.

**Returns:** Node.js `Readable` stream

### `__sys__.fs.createWriteStream(path)`

Creates a high-performance native-backed `Writable` stream that bypasses Node.js memory buffers and writes directly via the core engine.

**Returns:** Node.js `Writable` stream

### `__sys__.fs.stream(path, options)`

Reads a file into specific programmatic chunks in Node.js memory.

**Parameters:**

- `path` (string): Target file path.
- `options` (object):
    - `chunkSize` (number): Size of each buffer in bytes (default: 8192).
    - `hex` (boolean): If true, returns hexadecimal representation.

---

## Implementation Background

The implementation bypasses Node.js `fs` constraints by delegating heavy processing entirely to the `xsys` native core binary:

1. **Watch**: Uses native FS monitoring features.
2. **Advanced Watcher**: Implemented for fast content diffing.
3. **Stream**: Uses process pipelines (`io.Copy`) for direct byte streaming.

