# System Module: Path Manipulation (`__sys__.path`)

## Introduction

The `path` module inside XyPriss provides a comprehensive suite of robust, platform-independent utilities for working with file and directory paths.

> [!IMPORTANT]
> **Under the Hood Architecture**
> By bridging operations directly to the [**XHSC (XyPriss Hyper-System Core)**](docs/core/XHSC_CORE.md) via `XyPrissRunner`, the `__sys__.path` utilities guarantee rigorous adherence to filesystem capabilities across Windows, macOS, and Linux, eliminating all `\` versus `/` cross-platform issues. It provides extreme security against directory traversal attacks through strict normalization built directly into the core.

---

## Core Path Assembly & Slicing

### `resolve`

Resolves a sequence of path segments into an absolute path.

**Signature:**

```typescript
resolve(...paths: string[]): string
```

**Description:**
Takes segments and inherently figures out the absolute destination path from the executing context's root. The resulting path is normalized, natively resolving all `..` (parent) and `.` (current) references.

**Example:**

```typescript
// Resolving a configuration file relative to the project root
const configPath = __sys__.path.resolve("config", "settings.json");
console.log(configPath);
// Output (Linux): "/home/user/project/config/settings.json"
// Output (Windows): "C:\Users\user\project\config\settings.json"
```

### `join`

Safely joins multiple path segments together.

**Signature:**

```typescript
join(...paths: string[]): string
```

**Description:**
Joins all given path segments together using the exact platform-specific separator as a delimiter, then normalizes the resulting path. This avoids manual string concatenation errors.

**Example:**

```typescript
const logPath = __sys__.path.join("var", "logs", "app.log");
// Output (Linux): "var/logs/app.log"
```

### `dirname` / `basename` / `extname`

Standard slicing functions modeled after UNIX capabilities.

**Signatures:**

```typescript
dirname(p: string): string
basename(p: string, suffix?: string): string
extname(p: string): string
```

**Description:**

- `dirname`: Returns the directory portion encompassing the file (the parent folder).
- `basename`: Returns the filename from a full path. Provide an optional `suffix` to cleanly strip extensions (e.g., removing `.ts`).
- `extname`: Exact file extension including the dot.

**Examples:**

```typescript
const p = "/src/models/user.ts";

__sys__.path.dirname(p); // -> "/src/models"
__sys__.path.basename(p); // -> "user.ts"
__sys__.path.basename(p, ".ts"); // -> "user"
__sys__.path.extname(p); // -> ".ts"
```

---

## Operations & Security Enforcement

### `normalize`

Cleans a messy path.

**Signature:**

```typescript
normalize(p: string): string
```

**Description:**
Collapses multiple sequential separators (e.g., `//` -> `/`) and aggressively resolves `.` and `..` to yield the simplest standard form.

**Example:**

```typescript
const clean = __sys__.path.normalize("/users//john/./docs/../images");
console.log(clean); // -> "/users/john/images"
```

### `relative`

Calculates path differences natively.

**Signature:**

```typescript
relative(from: string, to: string): string
```

**Description:**
Solves the relative trajectory from `from` to `to`. Extremely useful when generating structural file imports during auto-generation tools or code compiling.

**Example:**

```typescript
const relative = __sys__.path.relative(
    "/project/src/views",
    "/project/src/components",
);
console.log(relative); // -> "../components"
```

### `isChild` and `secureJoin`

Enterprise defense mechanisms against traversal attacks.

**Signatures:**

```typescript
isChild(parent: string, child: string): boolean
secureJoin(base: string, ...segments: string[]): string
```

**Description:**

- `isChild`: Verifies that a given `child` path is strictly contained within a `parent` boundary.
- `secureJoin`: Like `join`, but explicitly throws a security error or clamps the outcome if the target tries to escape the `base` directory using `../`.

**Example:**

```typescript
const userInputPath = "../../../etc/passwd";
const safePath = __sys__.path.secureJoin("/var/www/uploads", userInputPath);
// Native Go Core rejects the traversal instantly rather than parsing it!
```

### `metadata`

Fetches structural analytics on a path incredibly fast.

**Signature:**

```typescript
metadata(p: string): { dir: string; base: string; ext: string; name: string; isAbsolute: boolean }
```

**Description:**
Single high-speed IPC/Go call that returns a full breakdown of the path anatomy instead of forcing Node.js to fire multiple methods (`dirname`, `extname`, `basename`) sequentially.

---

## Path Status Checkers

These utilities perform fast structural queries against the filesystem. They are defined on `PathApi` rather than `FSCore` because they relate to path inspection rather than file content.

### `isAbsolute`

Returns `true` if the path is absolute (handles both Unix `/` and Windows drive letters `C:\`).

**Signature:**

```typescript
isAbsolute(p: string): boolean
```

**Example:**

```typescript
__sys__.path.isAbsolute("/usr/local/bin"); // true
__sys__.path.isAbsolute("./relative/path"); // false
```

### `exists`

Checks whether a path exists on the filesystem.

**Signature:**

```typescript
exists(p: string): boolean
```

**Example:**

```typescript
if (__sys__.path.exists("CWD://.env")) {
    const env = __sys__.fs.readSync("CWD://.env");
}
```

### `isDir` / `isFile` / `isSymlink`

Precise type checks for filesystem entries.

**Signatures:**

```typescript
isDir(p: string): boolean
isFile(p: string): boolean
isSymlink(p: string): boolean
```

**Example:**

```typescript
const src = "ROOT://dist";
if (__sys__.path.isDir(src)) {
    console.log("dist is a directory");
}
```

### `isEmpty`

Returns `true` if the file has zero bytes, or if the directory contains zero entries.

**Signature:**

```typescript
isEmpty(p: string): boolean
```

**Example:**

```typescript
if (!__sys__.path.isEmpty("CWD://uploads")) {
    processUploads();
}
```

### `tempDir`

Returns the OS-level temporary directory path.

**Signature:**

```typescript
tempDir(): string
```

**Example:**

```typescript
const tmp = __sys__.path.tempDir();
// Linux: "/tmp"    Windows: "C:\Users\...\AppData\Local\Temp"
```

---

## Advanced Utilities

### `toNamespacedPath`

Converts a path to its platform-native namespaced form. On Windows, this enables handling of UNC paths and paths exceeding the `MAX_PATH` limit. On Unix, the path is returned unchanged.

**Signature:**

```typescript
toNamespacedPath(p: string): string
```

### `normalizeSeparators`

Standardizes all separators (`/` and `\`) to the OS-native separator, ensuring consistent path formatting across platforms.

**Signature:**

```typescript
normalizeSeparators(p: string): string
```

**Example:**

```typescript
// On Linux, ensures no backslashes remain
const clean = __sys__.path.normalizeSeparators("uploads\\2024\\file.pdf");
// -> "uploads/2024/file.pdf"
```

### `commonBase`

Finds the deepest shared parent directory across a set of paths.

**Signature:**

```typescript
commonBase(...paths: string[]): string
```

**Example:**

```typescript
const base = __sys__.path.commonBase(
    "/project/src/routes/user.ts",
    "/project/src/models/user.ts",
    "/project/src/middlewares/auth.ts",
);
console.log(base); // -> "/project/src"
```

