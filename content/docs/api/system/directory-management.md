# Directory Management

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Directory Management API provides comprehensive methods for creating, listing, and managing directories. All operations handle nested directories automatically and include safety checks.

## API Reference

### `$mkdir(path: string): void`

Creates a directory and all parent directories.

**Parameters:**

-   `path` - Directory path to create

**Examples:**

```typescript
// Create single directory
__sys__.$mkdir("logs");

// Create nested directories
__sys__.$mkdir("src/components/ui");

// Absolute path
__sys__.$mkdir("/var/app/data");
```

**Behavior:**

-   Creates all parent directories automatically (recursive)
-   No error if directory already exists
-   Equivalent to `mkdir -p` on Unix

---

### `$ensureDir(path: string): void`

Alias for `$mkdir`. Ensures directory exists.

**Parameters:**

-   `path` - Directory path

**Examples:**

```typescript
// Ensure directory exists before writing
__sys__.$ensureDir("output");
__sys__.$write("output/file.txt", "data");

// Ensure nested structure
__sys__.$ensureDir("cache/images/thumbnails");
```

**Use Cases:**

-   Preparing output directories
-   Ensuring cache directories exist
-   Safe directory creation

---

### `$ls(path: string): string[]`

Lists directory contents (names only).

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of file/directory names

**Examples:**

```typescript
const files = __sys__.$ls("src");
console.log(files);
// ["index.ts", "utils.ts", "components"]

files.forEach((file) => {
    console.log(file);
});
```

**Note:** Returns names only, not full paths. Use `$lsFullPath()` for full paths.

---

### `$lsFullPath(path: string): string[]`

Lists directory contents with full paths.

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of full file/directory paths

**Examples:**

```typescript
const paths = __sys__.$lsFullPath("src");
console.log(paths);
// ["/project/src/index.ts", "/project/src/utils.ts", "/project/src/components"]

paths.forEach((path) => {
    if (__sys__.$isFile(path)) {
        console.log(`File: ${path}`);
    }
});
```

**Use Cases:**

-   Processing files with full paths
-   Recursive operations
-   Path-based filtering

---

### `$lsDirs(path: string): string[]`

Lists only subdirectories.

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of directory names

**Examples:**

```typescript
const dirs = __sys__.$lsDirs("src");
console.log(dirs);
// ["components", "utils", "services"]

// Process each subdirectory
dirs.forEach((dir) => {
    const fullPath = __sys__.$join("src", dir);
    console.log(`Directory: ${fullPath}`);
});
```

**Use Cases:**

-   Finding subdirectories
-   Directory tree navigation
-   Module discovery

---

### `$lsFiles(path: string): string[]`

Lists only files (excludes directories).

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of file names

**Examples:**

```typescript
const files = __sys__.$lsFiles("src");
console.log(files);
// ["index.ts", "app.ts", "config.ts"]

// Process only files
files.forEach((file) => {
    const content = __sys__.$read(__sys__.$join("src", file));
    processFile(content);
});
```

**Use Cases:**

-   File-only processing
-   Excluding subdirectories
-   File counting

---

### `$lsRecursive(path: string): string[]`

Lists all files recursively (full paths).

**Parameters:**

-   `path` - Directory path to scan

**Returns:** Array of all file paths (recursive)

**Examples:**

```typescript
const allFiles = __sys__.$lsRecursive("src");
console.log(allFiles);
// [
//   "/project/src/index.ts",
//   "/project/src/components/Button.tsx",
//   "/project/src/components/Input.tsx",
//   "/project/src/utils/helpers.ts"
// ]

// Find all TypeScript files
const tsFiles = allFiles.filter((f) => f.endsWith(".ts"));
console.log(`Found ${tsFiles.length} TypeScript files`);
```

**Use Cases:**

-   Finding all files in a tree
-   Recursive processing
-   File discovery

---

### `$emptyDir(path: string): void`

Removes all contents of a directory.

**Parameters:**

-   `path` - Directory path to empty

**Examples:**

```typescript
// Clear cache directory
__sys__.$emptyDir("cache");

// Clear build output
__sys__.$emptyDir("dist");

// Clear temporary files
__sys__.$emptyDir("temp");
```

**Warning:** This permanently deletes all files and subdirectories. Use with caution.

---

## Common Patterns

### Directory Tree Creation

```typescript
function createProjectStructure(projectName: string): void {
    const dirs = [
        `${projectName}/src`,
        `${projectName}/src/components`,
        `${projectName}/src/utils`,
        `${projectName}/tests`,
        `${projectName}/docs`,
        `${projectName}/public`,
    ];

    dirs.forEach((dir) => __sys__.$mkdir(dir));

    // Create initial files
    __sys__.$write(`${projectName}/README.md`, `# ${projectName}`);
    __sys__.$write(`${projectName}/src/index.ts`, "// Entry point");
}

createProjectStructure("my-app");
```

### Directory Scanning

```typescript
function scanDirectory(path: string): {
    files: number;
    dirs: number;
    totalSize: number;
} {
    const allFiles = __sys__.$lsRecursive(path);
    const dirs = __sys__.$lsDirs(path);

    const totalSize = allFiles.reduce((sum, file) => {
        return sum + __sys__.$stats(file).size;
    }, 0);

    return {
        files: allFiles.length,
        dirs: dirs.length,
        totalSize,
    };
}

const info = scanDirectory("src");
console.log(
    `Files: ${info.files}, Dirs: ${info.dirs}, Size: ${info.totalSize} bytes`
);
```

### Organize Files by Extension

```typescript
function organizeByExtension(sourceDir: string, targetDir: string): void {
    const files = __sys__.$lsFiles(sourceDir);

    files.forEach((file) => {
        const ext = __sys__.$extname(file).slice(1) || "no-extension";
        const targetFolder = __sys__.$join(targetDir, ext);

        __sys__.$ensureDir(targetFolder);

        const sourcePath = __sys__.$join(sourceDir, file);
        const targetPath = __sys__.$join(targetFolder, file);

        __sys__.$copy(sourcePath, targetPath);
    });
}

organizeByExtension("downloads", "organized");
```

### Clean Old Files

```typescript
function cleanOldFiles(dir: string, maxAgeDays: number): number {
    const files = __sys__.$lsRecursive(dir);
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let removed = 0;

    files.forEach((file) => {
        const stats = __sys__.$stats(file);
        const age = now - stats.modified * 1000;

        if (age > maxAgeMs) {
            __sys__.$rm(file);
            removed++;
        }
    });

    return removed;
}

const cleaned = cleanOldFiles("logs", 30);
console.log(`Removed ${cleaned} old files`);
```

### Directory Comparison

```typescript
function compareDirectories(
    dir1: string,
    dir2: string
): {
    onlyInDir1: string[];
    onlyInDir2: string[];
    common: string[];
} {
    const files1 = new Set(__sys__.$ls(dir1));
    const files2 = new Set(__sys__.$ls(dir2));

    const onlyInDir1 = [...files1].filter((f) => !files2.has(f));
    const onlyInDir2 = [...files2].filter((f) => !files1.has(f));
    const common = [...files1].filter((f) => files2.has(f));

    return { onlyInDir1, onlyInDir2, common };
}

const diff = compareDirectories("src", "backup/src");
console.log("Only in src:", diff.onlyInDir1);
console.log("Only in backup:", diff.onlyInDir2);
console.log("Common:", diff.common);
```

### Mirror Directory Structure

```typescript
function mirrorStructure(sourceDir: string, targetDir: string): void {
    const dirs = __sys__.$lsDirs(sourceDir);

    dirs.forEach((dir) => {
        const sourcePath = __sys__.$join(sourceDir, dir);
        const targetPath = __sys__.$join(targetDir, dir);

        __sys__.$mkdir(targetPath);

        // Recursively mirror subdirectories
        if (__sys__.$isDir(sourcePath)) {
            mirrorStructure(sourcePath, targetPath);
        }
    });
}

mirrorStructure("src", "backup/src");
```

## Best Practices

### 1. Check Before Operations

```typescript
// Good: Check if directory exists
if (__sys__.$isDir("data")) {
    const files = __sys__.$ls("data");
}

// Or use ensureDir for safety
__sys__.$ensureDir("data");
const files = __sys__.$ls("data");
```

### 2. Use Full Paths for Processing

```typescript
// Good: Use full paths
const files = __sys__.$lsFullPath("src");
files.forEach((file) => {
    if (__sys__.$isFile(file)) {
        processFile(file);
    }
});

// Avoid: Reconstructing paths
const names = __sys__.$ls("src");
names.forEach((name) => {
    const path = __sys__.$join("src", name); // Extra work
    processFile(path);
});
```

### 3. Handle Empty Directories

```typescript
function processDirectory(dir: string): void {
    if (!__sys__.$isDir(dir)) {
        console.error(`Not a directory: ${dir}`);
        return;
    }

    const files = __sys__.$ls(dir);

    if (files.length === 0) {
        console.log(`Directory is empty: ${dir}`);
        return;
    }

    // Process files
    files.forEach((file) => {
        // ...
    });
}
```

### 4. Use Recursive Operations Carefully

```typescript
// For large directories, consider limiting depth
function lsRecursiveWithLimit(
    path: string,
    maxDepth: number,
    currentDepth: number = 0
): string[] {
    if (currentDepth >= maxDepth) {
        return [];
    }

    const files = __sys__.$lsFullPath(path);
    let result: string[] = [];

    files.forEach((file) => {
        if (__sys__.$isFile(file)) {
            result.push(file);
        } else if (__sys__.$isDir(file)) {
            result = result.concat(
                lsRecursiveWithLimit(file, maxDepth, currentDepth + 1)
            );
        }
    });

    return result;
}
```

### 5. Clean Up Temporary Directories

```typescript
function withTempDir<T>(callback: (tempDir: string) => T): T {
    const tempDir = `temp_${Date.now()}`;

    try {
        __sys__.$mkdir(tempDir);
        return callback(tempDir);
    } finally {
        if (__sys__.$exists(tempDir)) {
            __sys__.$rm(tempDir);
        }
    }
}

const result = withTempDir((tempDir) => {
    __sys__.$write(`${tempDir}/data.txt`, "temp data");
    return processData(`${tempDir}/data.txt`);
});
```

## Performance Considerations

### Directory Listing Performance

-   **Small directories (<100 files)**: <5ms
-   **Medium directories (100-1000 files)**: 5-20ms
-   **Large directories (>1000 files)**: 20-100ms
-   **Recursive operations**: Depends on tree size

### Optimization Tips

```typescript
// Cache directory listings
const dirCache = new Map<string, string[]>();

function cachedLs(path: string, ttl: number = 60000): string[] {
    const key = path;
    const cached = dirCache.get(key);

    if (cached) {
        return cached;
    }

    const files = __sys__.$ls(path);
    dirCache.set(key, files);

    setTimeout(() => dirCache.delete(key), ttl);

    return files;
}
```

## Error Handling

```typescript
import { XyPrissError } from "xypriss";

try {
    const files = __sys__.$ls("nonexistent");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Failed to list directory: ${error.message}`);
    }
}

// Safe directory listing
function safeLs(path: string): string[] {
    if (!__sys__.$exists(path)) {
        return [];
    }

    if (!__sys__.$isDir(path)) {
        console.warn(`Not a directory: ${path}`);
        return [];
    }

    return __sys__.$ls(path);
}
```

## Platform Considerations

### Unix/Linux/macOS

-   Case-sensitive file names
-   Hidden files start with `.`
-   No restrictions on special characters (except `/`)

### Windows

-   Case-insensitive file names
-   Hidden files use file attributes
-   Reserved names: `CON`, `PRN`, `AUX`, `NUL`, etc.

### Cross-Platform Code

```typescript
// Filter hidden files (cross-platform)
function getVisibleFiles(dir: string): string[] {
    const files = __sys__.$ls(dir);
    return files.filter((f) => !f.startsWith("."));
}

// Handle case sensitivity
function findFileIgnoreCase(dir: string, filename: string): string | null {
    const files = __sys__.$ls(dir);
    const found = files.find((f) => f.toLowerCase() === filename.toLowerCase());
    return found || null;
}
```

## Related Documentation

-   [File I/O](./file-io.md)
-   [Path Operations](./path-operations.md)
-   [File Metadata](./file-metadata.md)
-   [Search & Filter](./search-filter.md)
-   [Complete Reference](./complete-reference.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12

