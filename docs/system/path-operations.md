# Path Operations

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Path Operations API provides a comprehensive set of utilities for manipulating file paths, resolving paths, and extracting path components. All operations are cross-platform compatible and handle both Unix and Windows path formats.

## API Reference

### `$resolve(...paths: string[]): string`

Resolves a sequence of paths to an absolute path.

**Parameters:**

-   `paths` - One or more path segments to resolve

**Returns:** Absolute path string

**Examples:**

```typescript
// Resolve relative path
const absolute = __sys__.$resolve("./config.json");
// "/home/user/project/config.json"

// Resolve multiple segments
const path = __sys__.$resolve("src", "utils", "helper.ts");
// "/home/user/project/src/utils/helper.ts"

// Resolve from root
const rootPath = __sys__.$resolve("/etc", "config");
// "/etc/config"
```

**Behavior:**

-   Converts relative paths to absolute
-   Resolves `.` and `..` segments
-   Normalizes path separators
-   Uses `__root__` as base for relative paths

---

### `$join(...paths: string[]): string`

Joins path segments using the platform-specific separator.

**Parameters:**

-   `paths` - Path segments to join

**Returns:** Joined path string

**Examples:**

```typescript
// Join path segments
const path = __sys__.$join("src", "components", "Button.tsx");
// "src/components/Button.tsx"

// Join with leading slash
const absolute = __sys__.$join("/", "home", "user", "file.txt");
// "/home/user/file.txt"

// Join with mixed separators (normalized)
const normalized = __sys__.$join("src/utils", "helpers/index.ts");
// "src/utils/helpers/index.ts"
```

**Note:** Does not resolve to absolute path. Use `$resolve()` for that.

---

### `$dirname(path: string): string`

Extracts the directory name from a path.

**Parameters:**

-   `path` - File or directory path

**Returns:** Directory path

**Examples:**

```typescript
const dir = __sys__.$dirname("/path/to/file.txt");
// "/path/to"

const parentDir = __sys__.$dirname("/path/to/directory");
// "/path/to"

const root = __sys__.$dirname("/file.txt");
// "/"
```

**Use Cases:**

-   Get parent directory
-   Navigate up directory tree
-   Extract containing folder

---

### `$basename(path: string, ext?: string): string`

Extracts the file name from a path.

**Parameters:**

-   `path` - File path
-   `ext` - (Optional) Extension to remove

**Returns:** File name

**Examples:**

```typescript
// Get file name
const name = __sys__.$basename("/path/to/file.txt");
// "file.txt"

// Remove extension
const nameNoExt = __sys__.$basename("/path/to/file.txt", ".txt");
// "file"

// Directory name
const dirName = __sys__.$basename("/path/to/directory");
// "directory"
```

---

### `$extname(path: string): string`

Extracts the file extension from a path.

**Parameters:**

-   `path` - File path

**Returns:** Extension including the dot (e.g., ".txt")

**Examples:**

```typescript
const ext = __sys__.$extname("file.txt");
// ".txt"

const jsExt = __sys__.$extname("script.min.js");
// ".js"

const noExt = __sys__.$extname("README");
// ""

const hidden = __sys__.$extname(".gitignore");
// ""
```

**Note:** Returns empty string if no extension found.

---

### `$normalize(path: string): string`

Normalizes a path by resolving `.` and `..` segments.

**Parameters:**

-   `path` - Path to normalize

**Returns:** Normalized path

**Examples:**

```typescript
const normalized = __sys__.$normalize("./src/../lib/index.js");
// "lib/index.js"

const clean = __sys__.$normalize("src/./utils/./helper.ts");
// "src/utils/helper.ts"

const up = __sys__.$normalize("../../parent/file.txt");
// "../../parent/file.txt"
```

**Use Cases:**

-   Clean up path strings
-   Resolve relative references
-   Standardize path format

---

### `$relative(from: string, to: string): string`

Calculates the relative path from one location to another.

**Parameters:**

-   `from` - Source path
-   `to` - Target path

**Returns:** Relative path from `from` to `to`

**Examples:**

```typescript
const rel = __sys__.$relative(
    "/data/orandea/test/aaa",
    "/data/orandea/impl/bbb"
);
// "../../impl/bbb"

const sameDir = __sys__.$relative("/path/to/dir", "/path/to/dir/file.txt");
// "file.txt"

const parent = __sys__.$relative("/path/to/dir/sub", "/path/to/dir");
// ".."
```

**Use Cases:**

-   Generate relative imports
-   Create portable path references
-   Calculate path differences

---

### `$isAbsolute(path: string): boolean`

Checks if a path is absolute.

**Parameters:**

-   `path` - Path to check

**Returns:** `true` if absolute, `false` otherwise

**Examples:**

```typescript
__sys__.$isAbsolute("/home/user/file.txt"); // true
__sys__.$isAbsolute("./relative/path"); // false
__sys__.$isAbsolute("file.txt"); // false

// Windows
__sys__.$isAbsolute("C:\\Users\\file.txt"); // true
__sys__.$isAbsolute("\\\\server\\share"); // true
```

**Platform Behavior:**

-   **Unix:** Starts with `/`
-   **Windows:** Starts with drive letter or UNC path

---

## Common Patterns

### Build File Paths

```typescript
function getConfigPath(env: string): string {
    return __sys__.$join(__sys__.$resolve("config"), `${env}.json`);
}

const prodConfig = getConfigPath("production");
// "/project/config/production.json"
```

### Navigate Directory Tree

```typescript
function getParentDirectory(path: string, levels: number = 1): string {
    let current = path;
    for (let i = 0; i < levels; i++) {
        current = __sys__.$dirname(current);
    }
    return current;
}

const grandparent = getParentDirectory("/a/b/c/d", 2);
// "/a/b"
```

### Change File Extension

```typescript
function changeExtension(filePath: string, newExt: string): string {
    const dir = __sys__.$dirname(filePath);
    const name = __sys__.$basename(filePath, __sys__.$extname(filePath));
    return __sys__.$join(dir, name + newExt);
}

const tsFile = changeExtension("src/index.js", ".ts");
// "src/index.ts"
```

### Resolve Module Path

```typescript
function resolveModule(moduleName: string): string {
    return __sys__.$resolve("node_modules", moduleName, "index.js");
}

const lodashPath = resolveModule("lodash");
// "/project/node_modules/lodash/index.js"
```

### Get Relative Import

```typescript
function getRelativeImport(from: string, to: string): string {
    const rel = __sys__.$relative(__sys__.$dirname(from), to);

    // Remove extension for imports
    const withoutExt = __sys__.$basename(rel, __sys__.$extname(rel));
    const dir = __sys__.$dirname(rel);

    return __sys__.$join(dir, withoutExt);
}

const importPath = getRelativeImport(
    "src/components/Button.tsx",
    "src/utils/helpers.ts"
);
// "../utils/helpers"
```

### Validate Path Structure

```typescript
function isInDirectory(filePath: string, directory: string): boolean {
    const relative = __sys__.$relative(directory, filePath);
    return !relative.startsWith("..") && !__sys__.$isAbsolute(relative);
}

const inSrc = isInDirectory("/project/src/file.ts", "/project/src");
// true

const outside = isInDirectory("/project/lib/file.ts", "/project/src");
// false
```

## Best Practices

### 1. Use Platform-Independent Paths

```typescript
// Good: Use $join for cross-platform compatibility
const path = __sys__.$join("src", "utils", "file.ts");

// Avoid: Hardcoded separators
const badPath = "src/utils/file.ts"; // Fails on Windows
```

### 2. Resolve Paths Early

```typescript
// Good: Resolve to absolute path early
const configPath = __sys__.$resolve("config.json");
const config = __sys__.$readJson(configPath);

// Avoid: Using relative paths throughout
const config = __sys__.$readJson("./config.json");
```

### 3. Validate Paths

```typescript
function safeResolve(path: string): string {
    const resolved = __sys__.$resolve(path);

    // Ensure path is within project
    if (!resolved.startsWith(__sys__.__root__)) {
        throw new Error("Path outside project root");
    }

    return resolved;
}
```

### 4. Handle Edge Cases

```typescript
function safeDirname(path: string): string {
    const dir = __sys__.$dirname(path);

    // Handle root directory
    if (dir === path) {
        return "/";
    }

    return dir;
}
```

### 5. Cache Resolved Paths

```typescript
const pathCache = new Map<string, string>();

function cachedResolve(path: string): string {
    if (!pathCache.has(path)) {
        pathCache.set(path, __sys__.$resolve(path));
    }
    return pathCache.get(path)!;
}
```

## Platform Considerations

### Unix/Linux/macOS

```typescript
// Path separator: /
__sys__.$join("home", "user", "file.txt");
// "home/user/file.txt"

// Absolute paths start with /
__sys__.$isAbsolute("/home/user"); // true
```

### Windows

```typescript
// Path separator: \
__sys__.$join("C:", "Users", "file.txt");
// "C:\\Users\\file.txt"

// Absolute paths
__sys__.$isAbsolute("C:\\Users"); // true
__sys__.$isAbsolute("\\\\server"); // true (UNC)
```

### Cross-Platform Code

```typescript
// Always works
const path = __sys__.$join(__sys__.__root__, "config", "app.json");

// Platform-specific separator
const sep = process.platform === "win32" ? "\\" : "/";
```

## Performance

Path operations are extremely fast:

-   **$resolve**: <1ms
-   **$join**: <1ms
-   **$dirname**: <1ms
-   **$basename**: <1ms
-   **$extname**: <1ms
-   **$normalize**: <1ms
-   **$relative**: <1ms

## Troubleshooting

### Unexpected Absolute Paths

```typescript
// Issue: $join creates absolute path
const path = __sys__.$join("/", "relative", "path");
// "/relative/path" (absolute!)

// Solution: Don't start with /
const relative = __sys__.$join("relative", "path");
// "relative/path"
```

### Windows Path Issues

```typescript
// Issue: Backslashes in strings
const path = "C:Users\file.txt"; // Escape sequences!

// Solution: Use forward slashes or raw strings
const path1 = "C:/Users/file.txt";
const path2 = String.raw`C:\Users\file.txt`;
```

### Relative Path Confusion

```typescript
// Issue: Relative to what?
const rel = __sys__.$relative("src", "lib");

// Solution: Use absolute paths
const rel = __sys__.$relative(__sys__.$resolve("src"), __sys__.$resolve("lib"));
```

## Related Documentation

-   [File I/O](./file-io.md)
-   [Directory Management](./directory-management.md)
-   [Complete Reference](./complete-reference.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12

