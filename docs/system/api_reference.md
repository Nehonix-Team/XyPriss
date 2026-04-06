# XyPriss Hyper-System API (`__xhsc__`) - Full Reference

This document provides a consolidated, single-page summary of the entire XyPriss `__xhsc__` system API, encompassing environment variables, filesystem operations, path manipulation, operating system, and hardware telemetry. This API acts as the core logical aggregator for high-performance integrations directly to the native XHSC engine.

---

## 1. Environment (`__xhsc__.__env__`)

The sole authorized gateway for managing process environment variables safely (via the Environment Security Shield). Direct `process.env` access evaluates to an enumeration-hardened proxy.

### Methods

- **`get(key: string, defaultVal?: string): string | undefined`**: Reads a variable safely.
- **`getStrict(key: string, options?: EnvGetStrictOptions): string`**: Mandatory variable read. Fails natively upon startup if missing or empty.
- **`set(key: string, value: string): void`**: Safely sets an internal store variable without leaking characters like `\r` or `\n`.
- **`delete(key: string): void`**: Removes a variable.
- **`has(key: string): boolean`**: Verifies existence.
- **`all(options?: EnvAllOptions): EnvSnapshot`**: Frozen point-in-time dictionary of variables.
- **`user(): string`**: Synchronously retrieves the native OS username executing the instance.

### Mode Checkers

- `isProduction()`, `isDevelopment()`, `isStaging()`, `isTest()`, `is(envName: string)`

---

## 2. Dynamic Variables (`__xhsc__.vars`)

A general-purpose application configuration dictionary and temporal metadata store. Retains core fields formally out of the box.

### Built-In Properties

- `__version__`, `__author__`, `__description__`, `__app_urls__`, `__name__`, `__alias__`, `__port__`, `__root__`

### Methods

- **`get(key, default)`**, **`set(key, value)`**, **`has(key)`**, **`delete(key)`**
- **`update(Record<K,V>)`**: Iteratively applies object parameters avoiding direct collisions.
- **`keys()`**, **`all()`**, **`toJSON()`**, **`clone()`**, **`clear()`**

---

## 3. Path Management (`__xhsc__.path`)

Robust, cross-platform containment logic, standardizing boundary sequences effortlessly.

### Core Resolvers

- **`resolve(...paths)`**: Canonical absolute path.
- **`join(...paths)`**: Cross-platform reliable concatenation.
- **`dirname(p)`**, **`basename(p, suffix)`**, **`extname(p)`**: Isolation of file/folder attributes.

### Status and Containment Checkers

- **`isAbsolute(p)`**: Check for root anchors.
- **`isChild(parent, child)`**: Strict security boundaries check (no traversal limits bypassed).
- **`secureJoin(base, ...paths)`**: Bounds path merges enforcing implicit jails.
- **`exists(p)`**, **`isDir(p)`**, **`isFile(p)`**, **`isSymlink(p)`**, **`isEmpty(p)`**: Fast native filesystem structural integrity checks.
- **`tempDir()`**: Secure root of OS temporary directories.

---

## 4. Operating System (`__xhsc__.os`)

Direct interfacing with the host system's components minimizing compute overheads via native bridges.

### Information and Statistics

- **`info(): SystemInfo`**: Deep core hardware and boot telemetry object mapping to the Go engine definitions.
- **`hardware` (Getter)**: Realtime summary instance of machine architecture and load state.
- **`cpu(cores?: boolean)`**: Usage map and breakdown of logical cores.
- **`memory(watch?: boolean)`**: Ram and Swaps statistics.
- **`disks(mount?)`**: Capacity and availability across partitions.
- **`network(interface?)`**: Metrics over network links and associated IP layers.
- **`processes(options)`**: Identification mapping to top computationally dense running PID stacks.

### Signals and Actions

- **`kill(target: string | number)`**: Terminates application contexts.
- **`health()`**, **`ports()`**, **`temp()`**, **`battery()`**: Further hardware and interface querying.
- **`monitor(duration, interval)`** / **`monitorProcess(pid, duration)`**: Real-time terminal watcher outputs connected directly with system loads.

---

## 5. Filesystem (`__xhsc__.fs`)

An expansive multi-layered pipeline interface standardizing basic routines to cryptographic, high performance bounds.

### Interactivity & Write

- **`read(p)` (async) / `readSync(p)` (sync)**: Reads bounds completely.
- **`readBytes(p)` (async) / `readBytesSync(p)` (sync)**: Read raw byte `Buffer` mappings quickly from storage bounds.
- **`writeFile(p, data)` (async) / `writeFileSync(p, data)` (sync)**: Automated object casting or standard text writing natively creating parents.
- **`writeBytes(p, data: Buffer)` (async) / `writeBytesSync(p, data)` (sync)**: Direct binary buffers flushing safely.
- **`createReadStream(p)` (sync) / `createWriteStream(p)` (sync)**: Direct pipeline abstractions completely skipping unneeded layers.

### Mutation (Synchronous)

- **`copy(s, d)`**, **`move(s, d)`**, **`rm(p)`**, **`mkdir(p)`**, **`mkdirSafe(p)`**, **`touch(p)`**, **`link(s, d)`**

### Heavy Modifiers (Synchronous)

- **`searchInFiles(dir, regex)`**, **`findByPattern(dir, pattern)`**: Natively rapid string discovery arrays.
- **`batchRename(path, pattern, replacement)`**: Regex compliant recursive renaming.

### Compression & Watches

- **`tar(dir, out)` (sync)**, **`untar(tar, out)` (sync)**, **`compress()` (sync)**, **`decompress()` (sync)**
- **`watch(p)` (async)**, **`watchAndProcess(p, callback)` (async)**: Directory bounds modifications detection hooks.

### Advanced Ops

- **`atomicWrite(p, data)` (async)**: Flouts system crashes maintaining state completeness by building to temps natively before overwriting.
- **`shred(p, passes)` (async)**: Extreme wipe passes to restrict recovery potentials.
- **`encryptFile(p, key)` (async) / `decryptFile(p, key)` (async)**: Direct kernel level encryption bounds without caching file bounds into node memory entirely.
- **`lock(p)` (sync) / `unlock(p)` (sync)**: Disjoint state threading control blocks mapping across multiple applications instances concurrently.

