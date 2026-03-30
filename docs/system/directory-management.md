# Directory Management

**Version Compatibility:** XyPriss v9.5.0 and above

## Overview

The Directory Management API provides comprehensive methods for creating, listing, and managing directories. All operations handle nested directories automatically and include safety checks.

## API Reference

### `__sys__.fs.mkdir(path: string): void`

Creates a directory and all parent directories.

**Parameters:**

-   `path` - Directory path to create

**Examples:**

```typescript
// Create single directory
__sys__.fs.mkdir("logs");

// Create nested directories
__sys__.fs.mkdir("src/components/ui");

// Absolute path
__sys__.fs.mkdir("/var/app/data");
```

**Behavior:**

-   Creates all parent directories automatically (recursive)
-   No error if directory already exists
-   Equivalent to `mkdir -p` on Unix

---

### `__sys__.path.ensureDir(path: string): void`

Alias for `__sys__.fs.mkdir`. Ensures directory exists.

**Parameters:**

-   `path` - Directory path

**Examples:**

```typescript
// Ensure directory exists before writing
__sys__.path.ensureDir("output");
__sys__.fs.write("output/file.txt", "data");

// Ensure nested structure
__sys__.path.ensureDir("cache/images/thumbnails");
```

**Use Cases:**

-   Preparing output directories
-   Ensuring cache directories exist
-   Safe directory creation

---

### `__sys__.fs.ls(path: string): string[]`

Lists directory contents (names only).

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of file/directory names

**Examples:**

```typescript
const files = __sys__.fs.ls("src");
console.log(files);
// ["index.ts", "utils.ts", "components"]

files.forEach((file) => {
    console.log(file);
});
```

**Note:** Returns names only, not full paths. Use `__sys__.fs.lsFullPath()` for full paths.

---

### `__sys__.fs.lsFullPath(path: string): string[]`

Lists directory contents with full paths.

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of full file/directory paths

**Examples:**

```typescript
const paths = __sys__.fs.lsFullPath("src");
console.log(paths);
// ["/project/src/index.ts", "/project/src/utils.ts", "/project/src/components"]

paths.forEach((path) => {
    if (__sys__.fs.isFile(path)) {
        console.log(`File: ${path}`);
    }
});
```

**Use Cases:**

-   Processing files with full paths
-   Recursive operations
-   Path-based filtering

---

### `__sys__.fs.lsDirs(path: string): string[]`

Lists only subdirectories.

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of directory names

**Examples:**

```typescript
const dirs = __sys__.fs.lsDirs("src");
console.log(dirs);
// ["components", "utils", "services"]

// Process each subdirectory
dirs.forEach((dir) => {
    const fullPath = __sys__.path.join("src", dir);
    console.log(`Directory: ${fullPath}`);
});
```

**Use Cases:**

-   Finding subdirectories
-   Directory tree navigation
-   Module discovery

---

### `__sys__.fs.lsFiles(path: string): string[]`

Lists only files (excludes directories).

**Parameters:**

-   `path` - Directory path to list

**Returns:** Array of file names

**Examples:**

```typescript
const files = __sys__.fs.lsFiles("src");
console.log(files);
// ["index.ts", "app.ts", "config.ts"]

// Process only files
files.forEach((file) => {
    const content = __sys__.fs.read(__sys__.path.join("src", file));
    processFile(content);
});
```

**Use Cases:**

-   File-only processing
-   Excluding subdirectories
-   File counting

---

### `__sys__.fs.lsRecursive(path: string): string[]`

Lists all files recursively (full paths).

**Parameters:**

-   `path` - Directory path to scan

**Returns:** Array of all file paths (recursive)

**Examples:**

```typescript
const allFiles = __sys__.fs.lsRecursive("src");
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

### `__sys__.fs.emptyDir(path: string): void`

Removes all contents of a directory.

**Parameters:**

-   `path` - Directory path to empty

**Examples:**

```typescript
// Clear cache directory
__sys__.fs.emptyDir("cache");

// Clear build output
__sys__.fs.emptyDir("dist");

// Clear temporary files
__sys__.fs.emptyDir("temp");
```

**Warning:** This permanently deletes all files and subdirectories. Use with caution.

---

## Common Patterns

### Directory Tree Creation

```typescript
function createProjectStructure(projectName: string): void {
    const dirs = [
        `__sys__.{projectName}/src`,
        `__sys__.{projectName}/src/components`,
        `__sys__.{projectName}/src/utils`,
        `__sys__.{projectName}/tests`,
        `__sys__.{projectName}/docs`,
        `__sys__.{projectName}/public`,
    ];

    dirs.forEach((dir) => __sys__.fs.mkdir(dir));

    // Create initial files
    __sys__.fs.write(`__sys__.{projectName}/README.md`, `# ${projectName}`);
    __sys__.fs.write(`__sys__.{projectName}/src/index.ts`, "// Entry point");
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
    const allFiles = __sys__.fs.lsRecursive(path);
    const dirs = __sys__.fs.lsDirs(path);

    const totalSize = allFiles.reduce((sum, file) => {
        return sum + __sys__.fs.stats(file).size;
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
    const files = __sys__.fs.lsFiles(sourceDir);

    files.forEach((file) => {
        const ext = __sys__.path.extname(file).slice(1) || "no-extension";
        const targetFolder = __sys__.path.join(targetDir, ext);

        __sys__.path.ensureDir(targetFolder);

        const sourcePath = __sys__.path.join(sourceDir, file);
        const targetPath = __sys__.path.join(targetFolder, file);

        __sys__.fs.copy(sourcePath, targetPath);
    });
}

organizeByExtension("downloads", "organized");
```

### Clean Old Files

```typescript
function cleanOldFiles(dir: string, maxAgeDays: number): number {
    const files = __sys__.fs.lsRecursive(dir);
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let removed = 0;

    files.forEach((file) => {
        const stats = __sys__.fs.stats(file);
        const age = now - stats.modified * 1000;

        if (age > maxAgeMs) {
            __sys__.fs.rm(file);
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
    const files1 = new Set(__sys__.fs.ls(dir1));
    const files2 = new Set(__sys__.fs.ls(dir2));

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
    const dirs = __sys__.fs.lsDirs(sourceDir);

    dirs.forEach((dir) => {
        const sourcePath = __sys__.path.join(sourceDir, dir);
        const targetPath = __sys__.path.join(targetDir, dir);

        __sys__.fs.mkdir(targetPath);

        // Recursively mirror subdirectories
        if (__sys__.fs.isDir(sourcePath)) {
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
if (__sys__.fs.isDir("data")) {
    const files = __sys__.fs.ls("data");
}

// Or use ensureDir for safety
__sys__.path.ensureDir("data");
const files = __sys__.fs.ls("data");
```

### 2. Use Full Paths for Processing

```typescript
// Good: Use full paths
const files = __sys__.fs.lsFullPath("src");
files.forEach((file) => {
    if (__sys__.fs.isFile(file)) {
        processFile(file);
    }
});

// Avoid: Reconstructing paths
const names = __sys__.fs.ls("src");
names.forEach((name) => {
    const path = __sys__.path.join("src", name); // Extra work
    processFile(path);
});
```

### 3. Handle Empty Directories

```typescript
function processDirectory(dir: string): void {
    if (!__sys__.fs.isDir(dir)) {
        console.error(`Not a directory: ${dir}`);
        return;
    }

    const files = __sys__.fs.ls(dir);

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

    const files = __sys__.fs.lsFullPath(path);
    let result: string[] = [];

    files.forEach((file) => {
        if (__sys__.fs.isFile(file)) {
            result.push(file);
        } else if (__sys__.fs.isDir(file)) {
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
        __sys__.fs.mkdir(tempDir);
        return callback(tempDir);
    } finally {
        if (__sys__.fs.exists(tempDir)) {
            __sys__.fs.rm(tempDir);
        }
    }
}

const result = withTempDir((tempDir) => {
    __sys__.fs.write(`__sys__.{tempDir}/data.txt`, "temp data");
    return processData(`__sys__.{tempDir}/data.txt`);
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

    const files = __sys__.fs.ls(path);
    dirCache.set(key, files);

    setTimeout(() => dirCache.delete(key), ttl);

    return files;
}
```

## Error Handling

```typescript
import { XyPrissError } from "xypriss";

try {
    const files = __sys__.fs.ls("nonexistent");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Failed to list directory: ${error.message}`);
    }
}

// Safe directory listing
function safeLs(path: string): string[] {
    if (!__sys__.fs.exists(path)) {
        return [];
    }

    if (!__sys__.fs.isDir(path)) {
        console.warn(`Not a directory: ${path}`);
        return [];
    }

    return __sys__.fs.ls(path);
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
    const files = __sys__.fs.ls(dir);
    return files.filter((f) => !f.startsWith("."));
}

// Handle case sensitivity
function findFileIgnoreCase(dir: string, filename: string): string | null {
    const files = __sys__.fs.ls(dir);
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

**Version:** XyPriss v9.5.0+  
**Last Updated:** 2026-01-12

