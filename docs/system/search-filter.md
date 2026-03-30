# Search & Filter Operations

**Version Compatibility:** XyPriss v9.5.0 and above

## Overview

The Search & Filter API provides powerful methods for finding files by pattern, extension, or content. All search operations support recursive directory traversal and return full file paths.

## File Search Methods

### `__sys__.fs.find(path: string, pattern: string): string[]`

Finds files matching a regex pattern.

**Parameters:**

-   `path` - Directory to search
-   `pattern` - Regular expression pattern

**Returns:** Array of matching file paths

**Examples:**

```typescript
// Find all TypeScript files
const tsFiles = __sys__.fs.find("src", ".*\\.ts$");

// Find test files
const testFiles = __sys__.fs.find("src", ".*\\.test\\.(ts|js)$");

// Find files starting with "config"
const configs = __sys__.fs.find(".", "^config.*");

// Find files containing "component" in name
const components = __sys__.fs.find("src", ".*component.*");
```

**Pattern Syntax:**

-   `.` - Any character
-   `*` - Zero or more of previous
-   `+` - One or more of previous
-   `^` - Start of string
-   `__sys__.` - End of string
-   `[]` - Character class
-   `|` - Alternation

---

### `__sys__.fs.findByExt(path: string, extension: string): string[]`

Finds all files with a specific extension.

**Parameters:**

-   `path` - Directory to search
-   `extension` - File extension (with or without dot)

**Returns:** Array of matching file paths

**Examples:**

```typescript
// Find JavaScript files
const jsFiles = __sys__.fs.findByExt("src", "js");
// or
const jsFiles = __sys__.fs.findByExt("src", ".js");

// Find JSON files
const jsonFiles = __sys__.fs.findByExt("config", "json");

// Find image files
const images = __sys__.fs.findByExt("public", "png");

// Multiple extensions
const scripts = [
    ...__sys__.fs.findByExt("src", "js"),
    ...__sys__.fs.findByExt("src", "ts"),
];
```

**Use Cases:**

-   Finding files by type
-   Processing specific file formats
-   File type analysis

---

### `__sys__.fs.findByPattern(path: string, glob: string): string[]`

Finds files matching a glob pattern.

**Parameters:**

-   `path` - Directory to search
-   `glob` - Glob pattern

**Returns:** Array of matching file paths

**Examples:**

```typescript
// Find all TypeScript files
const tsFiles = __sys__.fs.findByPattern("src", "*.ts");

// Find test files
const tests = __sys__.fs.findByPattern("src", "*.test.ts");

// Find files in specific directory
const utils = __sys__.fs.findByPattern("src", "utils/*.ts");

// Find with multiple wildcards
const components = __sys__.fs.findByPattern("src", "**/*.component.ts");
```

**Glob Patterns:**

-   `*` - Matches any characters except `/`
-   `**` - Matches any characters including `/`
-   `?` - Matches single character
-   `[abc]` - Matches any character in brackets
-   `{a,b}` - Matches either pattern

---

## Content Search Methods

### `__sys__.fs.grep(path: string, pattern: string): SearchMatch[]`

Searches for pattern in file contents.

**Parameters:**

-   `path` - Directory to search
-   `pattern` - Regular expression pattern

**Returns:** Array of matches with file, line number, and content

**Examples:**

```typescript
// Find TODO comments
const todos = __sys__.fs.grep("src", "TODO");
todos.forEach((match) => {
    console.log(`__sys__.{match.file}:${match.line}: ${match.content}`);
});

// Find function definitions
const functions = __sys__.fs.grep("src", "function \\w+\\(");

// Find imports
const imports = __sys__.fs.grep("src", "^import .* from");

// Find error handling
const errors = __sys__.fs.grep("src", "catch\\s*\\(");
```

**SearchMatch Structure:**

```typescript
interface SearchMatch {
    file: string; // Full file path
    line: number; // Line number (1-indexed)
    content: string; // Line content
}
```

---

### `__sys__.fs.searchInFiles(path: string, query: string): SearchMatch[]`

Searches for literal text in files.

**Parameters:**

-   `path` - Directory to search
-   `query` - Text to search for (case-sensitive)

**Returns:** Array of matches

**Examples:**

```typescript
// Find specific text
const matches = __sys__.fs.searchInFiles("src", "DatabaseConnection");

// Find configuration keys
const configs = __sys__.fs.searchInFiles("src", "API_KEY");

// Find error messages
const errors = __sys__.fs.searchInFiles("logs", "ERROR:");

// Display results
matches.forEach((match) => {
    console.log(`Found in ${match.file} at line ${match.line}`);
    console.log(`  ${match.content.trim()}`);
});
```

**Difference from `__sys__.fs.grep`:**

-   `__sys__.fs.searchInFiles` - Literal text search
-   `__sys__.fs.grep` - Regular expression search

---

## Common Patterns

### Find and Process Files

```typescript
function processTypeScriptFiles(): void {
    const tsFiles = __sys__.fs.findByExt("src", "ts");

    tsFiles.forEach((file) => {
        const content = __sys__.fs.read(file);

        // Process file
        const processed = content.replace(/var /g, "let ");
        __sys__.fs.write(file, processed);
    });
}
```

### Code Analysis

```typescript
interface CodeStats {
    totalFiles: number;
    totalLines: number;
    todoCount: number;
    functionCount: number;
}

function analyzeCodebase(path: string): CodeStats {
    const files = __sys__.fs.findByExt(path, "ts");

    let totalLines = 0;

    files.forEach((file) => {
        const lines = __sys__.fs.readLines(file);
        totalLines += lines.length;
    });

    const todos = __sys__.fs.grep(path, "TODO");
    const functions = __sys__.fs.grep(path, "function \\w+\\(");

    return {
        totalFiles: files.length,
        totalLines,
        todoCount: todos.length,
        functionCount: functions.length,
    };
}

const stats = analyzeCodebase("src");
console.log(`Files: ${stats.totalFiles}`);
console.log(`Lines: ${stats.totalLines}`);
console.log(`TODOs: ${stats.todoCount}`);
console.log(`Functions: ${stats.functionCount}`);
```

### Find Unused Files

```typescript
function findUnusedFiles(srcDir: string): string[] {
    const allFiles = __sys__.fs.findByExt(srcDir, "ts");
    const unused: string[] = [];

    allFiles.forEach((file) => {
        const basename = __sys__.path.basename(file);
        const nameWithoutExt = basename.replace(/\.ts$/, "");

        // Search for imports of this file
        const imports = __sys__.fs.grep(srcDir, `from.*${nameWithoutExt}`);

        if (imports.length === 0) {
            unused.push(file);
        }
    });

    return unused;
}

const unused = findUnusedFiles("src");
console.log(`Found ${unused.length} potentially unused files`);
```

### Find Duplicate Code

```typescript
function findDuplicateLines(
    path: string,
    minLength: number = 50
): Map<string, string[]> {
    const files = __sys__.fs.findByExt(path, "ts");
    const lineMap = new Map<string, string[]>();

    files.forEach((file) => {
        const lines = __sys__.fs.readNonEmptyLines(file);

        lines.forEach((line) => {
            if (line.length >= minLength) {
                const trimmed = line.trim();

                if (!lineMap.has(trimmed)) {
                    lineMap.set(trimmed, []);
                }

                lineMap.get(trimmed)!.push(file);
            }
        });
    });

    // Filter to only duplicates
    const duplicates = new Map<string, string[]>();
    lineMap.forEach((files, line) => {
        if (files.length > 1) {
            duplicates.set(line, files);
        }
    });

    return duplicates;
}
```

### Search and Replace

```typescript
function searchAndReplace(
    path: string,
    searchPattern: string,
    replacement: string
): number {
    const matches = __sys__.fs.grep(path, searchPattern);
    const filesModified = new Set<string>();

    matches.forEach((match) => {
        const content = __sys__.fs.read(match.file);
        const regex = new RegExp(searchPattern, "g");
        const newContent = content.replace(regex, replacement);

        if (content !== newContent) {
            __sys__.fs.write(match.file, newContent);
            filesModified.add(match.file);
        }
    });

    return filesModified.size;
}

const modified = searchAndReplace("src", "var ", "let ");
console.log(`Modified ${modified} files`);
```

### Generate File Index

```typescript
interface FileIndex {
    path: string;
    extension: string;
    size: number;
    lines: number;
}

function generateFileIndex(path: string): FileIndex[] {
    const files = __sys__.fs.lsRecursive(path);

    return files.map((file) => {
        const stats = __sys__.fs.stats(file);
        const lines = __sys__.fs.readLines(file).length;

        return {
            path: file,
            extension: __sys__.path.extname(file),
            size: stats.size,
            lines,
        };
    });
}

const index = generateFileIndex("src");

// Find largest files
const largest = index.sort((a, b) => b.size - a.size).slice(0, 10);
console.log("Largest files:");
largest.forEach((f) => {
    console.log(`__sys__.{f.path}: ${f.size} bytes, ${f.lines} lines`);
});
```

## Best Practices

### 1. Use Specific Patterns

```typescript
// Good: Specific pattern
const configs = __sys__.fs.find(".", "^config\\..*\\.json$");

// Avoid: Too broad
const files = __sys__.fs.find(".", ".*"); // Matches everything
```

### 2. Limit Search Scope

```typescript
// Good: Search specific directory
const tests = __sys__.fs.findByExt("src/tests", "test.ts");

// Avoid: Searching from root
const tests = __sys__.fs.findByExt(".", "test.ts"); // Searches everything
```

### 3. Cache Search Results

```typescript
const searchCache = new Map<string, string[]>();

function cachedFind(path: string, pattern: string): string[] {
    const key = `__sys__.{path}:${pattern}`;

    if (!searchCache.has(key)) {
        searchCache.set(key, __sys__.fs.find(path, pattern));
    }

    return searchCache.get(key)!;
}
```

### 4. Handle Large Result Sets

```typescript
function findWithLimit(path: string, pattern: string, limit: number): string[] {
    const results = __sys__.fs.find(path, pattern);

    if (results.length > limit) {
        console.warn(`Found ${results.length} files, limiting to ${limit}`);
        return results.slice(0, limit);
    }

    return results;
}
```

### 5. Validate Patterns

```typescript
function safeGrep(path: string, pattern: string): SearchMatch[] {
    try {
        // Test if pattern is valid regex
        new RegExp(pattern);
        return __sys__.fs.grep(path, pattern);
    } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`);
        return [];
    }
}
```

## Performance Considerations

### Search Performance

-   **Small directories (<100 files)**: <50ms
-   **Medium directories (100-1000 files)**: 50-500ms
-   **Large directories (>1000 files)**: 500ms-5s
-   **Content search**: Slower than file search

### Optimization Tips

```typescript
// Use extension search when possible (faster)
const jsFiles = __sys__.fs.findByExt("src", "js");
// Instead of regex
const jsFiles = __sys__.fs.find("src", ".*\\.js$");

// Limit search depth
function findInDepth(
    path: string,
    pattern: string,
    maxDepth: number
): string[] {
    // Implement depth-limited search
    // ...
}

// Process results in batches
function processInBatches(files: string[], batchSize: number): void {
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        processBatch(batch);
    }
}
```

## Error Handling

```typescript
import { XyPrissError } from "xypriss";

try {
    const files = __sys__.fs.find("nonexistent", ".*");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Search failed: ${error.message}`);
    }
}

// Safe search with fallback
function safeFind(path: string, pattern: string): string[] {
    if (!__sys__.fs.exists(path)) {
        console.warn(`Path does not exist: ${path}`);
        return [];
    }

    if (!__sys__.fs.isDir(path)) {
        console.warn(`Not a directory: ${path}`);
        return [];
    }

    return __sys__.fs.find(path, pattern);
}
```

## Platform Considerations

### Case Sensitivity

```typescript
// Unix/Linux/macOS: Case-sensitive
const files = __sys__.fs.find("src", ".*Test.*"); // Matches "Test" only

// Windows: Case-insensitive
const files = __sys__.fs.find("src", ".*Test.*"); // Matches "test", "Test", "TEST"

// Cross-platform case-insensitive search
const files = __sys__.fs.find("src", ".*[Tt][Ee][Ss][Tt].*");
```

### Path Separators

```typescript
// Use platform-independent patterns
const files = __sys__.fs.find("src", ".*utils.*"); // Works everywhere

// Avoid hardcoded separators
const files = __sys__.fs.find("src", ".*/utils/.*"); // May fail on Windows
```

## Related Documentation

-   [File I/O](./file-io.md)
-   [Directory Management](./directory-management.md)
-   [Path Operations](./path-operations.md)
-   [Complete Reference](./complete-reference.md)

---

**Version:** XyPriss v9.5.0+  
**Last Updated:** 2026-01-12

