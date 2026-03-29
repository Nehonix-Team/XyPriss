# Comparison: Algorithm Analysis (npm vs xyp)

## 📦 NPM Algorithm (v10+ with Arborist)

npm uses a **Physical-First, Arboreal** approach. Its lifecycle is managed by the `@npmcli/arborist` engine.

### 16 Steps of npm Install (Simplified)

1. **Load Actual Tree**: Scans `node_modules` to build a logical map of what's already there.
2. **Build Ideal Tree**: Resolves `package.json` and `package-lock.json` to determine what _should_ be there.
3. **Diffing**: Calculates the difference between Actual and Ideal (ADD, REMOVE, CHANGE).
4. **Retire Shallow Nodes**: Moves changed/removed folders to a temporary "retirement" area (for rollback safety).
5. **Create Sparse Tree**: Creates the skeleton directory structure in `node_modules`.
6. **Unpack/Extract**:
    - **Download**: Fetches `.tgz` from registry.
    - **Cache**: Stores the raw tarball in `~/.npm/_cacache`.
    - **Extraction**: Extracts the tarball **directly** into the final physical location in `node_modules/pkg`.
    - _Note: This involves heavy Disk IO for every project._
7. **Rebuild**: Rewrites shims and handles platform-specific binary links.
8. **Scripts**: Runs `preinstall`, `install`, `postinstall`.
9. **Trash Removal**: Deletes the "retired" folders.

---

## 🚀 XyPriss (xyp) Algorithm (Current)

xyp uses a **CAS-First, Virtualized** approach (pnpm-inspired but optimized for Rust).

### core Lifecycle

1. **Parallel Resolver**:
    - Uses a concurrent task pool (64+ threads) to fetch metadata.
    - Builds the dependency graph in memory using a fast lock-free approach.
2. **CAS Extraction (The "Brain")**:
    - **Streaming Download**: Fetches `.tgz` directly into memory or a stream.
    - **Streaming Extraction**: Decompresses GZip and iterates Tar entries.
    - **Content-Addressable Storage (CAS)**:
        - Each file is hashed (BLAKE3).
        - Unique files are stored in a global storage (`.xpm_storage/files`).
        - A JSON "index" is created for the package version.
3. **Virtual Store (The "Linking")**:
    - Creates a "Virtual Store" entry at `node_modules/.xpm/virtual_store/pkg@version/node_modules/pkg`.
    - **Hardlinks**: Files are hardlinked from the CAS to the virtual store.
    - **Dependency Linking**: Symlinks are created inside the virtual store's `node_modules` to point to the virtual store entries of its dependencies (strict isolation).
4. **Shameful Hoisting**:
    - Symlinks the virtual store entries to the **top-level** `node_modules`.
    - Currently hoists _everything_ to the root to fix "Phantom Dependencies" (bug fix for `multer`, `safe-buffer`, etc.).

---

## 🔍 Key Differences & Bottlenecks

| Feature        | NPM                              | XyPriss (Current)                             |
| :------------- | :------------------------------- | :-------------------------------------------- |
| **Storage**    | Physical (duplicated)            | CAS (Single Instance)                         |
| **Speed**      | Slow for large graphs            | Ultra-fast metadata, but slow IO on large bin |
| **Linking**    | None (standard copy)             | Hardlinks + Symlinks                          |
| **Complexity** | High (Arborist handles overlaps) | Medium (CAS overhead)                         |

### 🛑 The "Bun/SWC" Problem in xyp

While metadata resolution in `xyp` is 10x faster than `npm`, the **Depacking** is currently the bottleneck compared to npm.

**Why?**

- **npm** takes a tarball and dumps it on disk. It doesn't care about the content of files (no hashing).
- **xyp** takes a tarball, decompresses it, **hashes every single file**, and writes them to the global CAS before hardlinking them back.

**The Math for Bun (90MB Binary):**

- npm: Download (90MB) -> Write (90MB). Total: **180MB IO**.
- xyp: Download (90MB) -> Hash BLAKE3 (90MB CPU) -> Write CAS (90MB) -> Hardlink (Metadata IO). Total: **180MB IO + Heavy CPU Hash**.

**The Math for SWC (10,000 small files):**

- npm: Write 10,000 files.
- xyp: Hash 10,000 files -> Write 10,000 files in CAS -> Create 10,000 Hardlinks. **3x more syscalls!**

---

## 🛠️ Proposed Optimizations for xyp v2

1. **Lazy Hashing**: For files over X MB, store them in CAS using their `tarball-hash + path` instead of `file-content-hash` if it speeds up the first install.
2. **Buffer Merging**: Batch the creation of hardlinks. Currently, we might be doing 1 syscall per file.
3. **No-Hash Cache**: Detect if a package is a known "Binary Blob" and use a faster path.
4. **Parallel Hardlinking**: We already do this, but the overhead of `dashmap` and task spawning might be higher than the actual IO for small files.

