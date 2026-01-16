# File I/O Operations

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The File I/O API provides comprehensive methods for reading and writing files in various formats. All operations are synchronous and include automatic parent directory creation for write operations.

## Reading Operations

### `$read(path: string): string`

Reads a file as UTF-8 text.

**Parameters:**

-   `path` - File path to read

**Returns:** File contents as string

**Examples:**

```typescript
const content = __sys__.$read("config.txt");
console.log(content);

const html = __sys__.$read("template.html");
```

**Throws:** `XyPrissError` if file doesn't exist or cannot be read

---

### `$readBytes(path: string): Buffer`

Reads a file as raw bytes.

**Parameters:**

-   `path` - File path to read

**Returns:** Buffer containing file data

**Examples:**

```typescript
const buffer = __sys__.$readBytes("image.png");
console.log(`Size: ${buffer.length} bytes`);

const binary = __sys__.$readBytes("data.bin");
```

**Use Cases:**

-   Reading binary files
-   Image processing
-   Custom file formats

---

### `$readJson(path: string): any`

Reads and parses a JSON file.

**Parameters:**

-   `path` - JSON file path

**Returns:** Parsed JSON data

**Examples:**

```typescript
const config = __sys__.$readJson("config.json");
console.log(config.port);

interface AppConfig {
    port: number;
    host: string;
}
const typedConfig = __sys__.$readJson("config.json") as AppConfig;
```

**Throws:** `XyPrissError` if file doesn't exist or JSON is invalid

---

### `$readJsonSafe(path: string, defaultValue: any): any`

Reads JSON with a fallback value.

**Parameters:**

-   `path` - JSON file path
-   `defaultValue` - Value to return if read fails

**Returns:** Parsed JSON or default value

**Examples:**

```typescript
const config = __sys__.$readJsonSafe("config.json", {
    port: 3000,
    host: "localhost",
});

const settings = __sys__.$readJsonSafe("settings.json", {});
```

**Use Cases:**

-   Optional configuration files
-   Graceful degradation
-   Default settings

---

### `$readLines(path: string): string[]`

Reads a file as an array of lines.

**Parameters:**

-   `path` - File path

**Returns:** Array of lines (including empty lines)

**Examples:**

```typescript
const lines = __sys__.$readLines("log.txt");
console.log(`Total lines: ${lines.length}`);

lines.forEach((line, index) => {
    console.log(`${index + 1}: ${line}`);
});
```

**Note:** Preserves empty lines. Use `$readNonEmptyLines()` to skip them.

---

### `$readNonEmptyLines(path: string): string[]`

Reads non-empty lines from a file.

**Parameters:**

-   `path` - File path

**Returns:** Array of non-empty lines (trimmed)

**Examples:**

```typescript
const lines = __sys__.$readNonEmptyLines("data.txt");

// Process only meaningful lines
lines.forEach((line) => {
    if (line.startsWith("#")) return; // Skip comments
    processLine(line);
});
```

**Use Cases:**

-   Reading configuration files
-   Processing logs
-   Parsing data files

---

## Writing Operations

### `$write(path: string, data: string): void`

Writes text to a file.

**Parameters:**

-   `path` - File path
-   `data` - Text content to write

**Examples:**

```typescript
__sys__.$write("output.txt", "Hello World");

const html = "<html><body>Content</body></html>";
__sys__.$write("page.html", html);

// Multi-line content
const content = `
Line 1
Line 2
Line 3
`.trim();
__sys__.$write("multi.txt", content);
```

**Behavior:**

-   Creates parent directories automatically
-   Overwrites existing file
-   Creates new file if doesn't exist

---

### `$writeBytes(path: string, data: Buffer | Uint8Array): void`

Writes raw bytes to a file.

**Parameters:**

-   `path` - File path
-   `data` - Binary data to write

**Examples:**

```typescript
const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
__sys__.$writeBytes("data.bin", buffer);

const imageData = new Uint8Array([...]);
__sys__.$writeBytes("image.raw", imageData);
```

**Use Cases:**

-   Writing binary files
-   Image generation
-   Custom file formats

---

### `$writeJson(path: string, data: any): void`

Writes data as formatted JSON.

**Parameters:**

-   `path` - File path
-   `data` - Data to serialize

**Examples:**

```typescript
const config = {
    port: 3000,
    host: "localhost",
    ssl: true,
};
__sys__.$writeJson("config.json", config);

// Arrays
const users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
];
__sys__.$writeJson("users.json", users);
```

**Format:** Pretty-printed with 2-space indentation

---

### `$writeJsonCompact(path: string, data: any): void`

Writes data as compact JSON.

**Parameters:**

-   `path` - File path
-   `data` - Data to serialize

**Examples:**

```typescript
const data = { key: "value", nested: { a: 1 } };
__sys__.$writeJsonCompact("data.json", data);
// {"key":"value","nested":{"a":1}}
```

**Use Cases:**

-   Minimizing file size
-   API responses
-   Data transfer

---

### `$writeIfNotExists(path: string, data: string): boolean`

Writes file only if it doesn't exist.

**Parameters:**

-   `path` - File path
-   `data` - Content to write

**Returns:** `true` if file was created, `false` if already exists

**Examples:**

```typescript
const created = __sys__.$writeIfNotExists("config.json", "{}");
if (created) {
    console.log("Config file created");
} else {
    console.log("Config file already exists");
}

// Initialize default files
const defaults = {
    "settings.json": "{}",
    "cache.json": "[]",
    "state.json": "{}",
};

Object.entries(defaults).forEach(([file, content]) => {
    __sys__.$writeIfNotExists(file, content);
});
```

**Use Cases:**

-   Creating default files
-   Preventing overwrites
-   Safe initialization

---

### `$append(path: string, data: string): void`

Appends text to a file.

**Parameters:**

-   `path` - File path
-   `data` - Text to append

**Examples:**

```typescript
__sys__.$append("log.txt", "New log entry\n");

// Append with timestamp
const timestamp = new Date().toISOString();
__sys__.$append("events.log", `[${timestamp}] Event occurred\n`);
```

**Behavior:**

-   Creates file if doesn't exist
-   Appends to end of file
-   Does not add newline automatically

---

### `$appendLine(path: string, line: string): void`

Appends a line to a file (with newline).

**Parameters:**

-   `path` - File path
-   `line` - Line to append

**Examples:**

```typescript
__sys__.$appendLine("log.txt", "Error: Something went wrong");
__sys__.$appendLine("log.txt", "Warning: Low memory");

// Logging function
function log(message: string): void {
    const timestamp = new Date().toISOString();
    __sys__.$appendLine("app.log", `[${timestamp}] ${message}`);
}

log("Application started");
log("User logged in");
```

**Note:** Automatically adds newline character

---

## Common Patterns

### Configuration Management

```typescript
interface Config {
    port: number;
    host: string;
    debug: boolean;
}

function loadConfig(): Config {
    return __sys__.$readJsonSafe("config.json", {
        port: 3000,
        host: "localhost",
        debug: false,
    });
}

function saveConfig(config: Config): void {
    __sys__.$writeJson("config.json", config);
}

const config = loadConfig();
config.port = 8080;
saveConfig(config);
```

### Log File Management

```typescript
class Logger {
    private logFile: string;

    constructor(logFile: string) {
        this.logFile = logFile;
    }

    log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] [${level}] ${message}`;
        __sys__.$appendLine(this.logFile, entry);
    }

    info(message: string): void {
        this.log("INFO", message);
    }

    error(message: string): void {
        this.log("ERROR", message);
    }

    getLogs(): string[] {
        if (!__sys__.$exists(this.logFile)) {
            return [];
        }
        return __sys__.$readLines(this.logFile);
    }
}

const logger = new Logger("app.log");
logger.info("Application started");
logger.error("Failed to connect");
```

### Data Processing

```typescript
function processDataFile(inputPath: string, outputPath: string): void {
    const lines = __sys__.$readNonEmptyLines(inputPath);

    const processed = lines
        .filter((line) => !line.startsWith("#")) // Remove comments
        .map((line) => line.trim())
        .map((line) => line.toUpperCase());

    __sys__.$write(outputPath, processed.join("\n"));
}

processDataFile("input.txt", "output.txt");
```

### Template Rendering

```typescript
function renderTemplate(
    templatePath: string,
    data: Record<string, any>
): string {
    let template = __sys__.$read(templatePath);

    Object.entries(data).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        template = template.replace(
            new RegExp(placeholder, "g"),
            String(value)
        );
    });

    return template;
}

const html = renderTemplate("template.html", {
    title: "My Page",
    content: "Hello World",
});

__sys__.$write("output.html", html);
```

### Backup and Restore

```typescript
function backup(filePath: string): string {
    const timestamp = Date.now();
    const backupPath = `${filePath}.${timestamp}.bak`;

    if (__sys__.$exists(filePath)) {
        const content = __sys__.$read(filePath);
        __sys__.$write(backupPath, content);
    }

    return backupPath;
}

function restore(backupPath: string, targetPath: string): void {
    const content = __sys__.$read(backupPath);
    __sys__.$write(targetPath, content);
}

// Usage
const backupPath = backup("important.json");
// ... make changes ...
restore(backupPath, "important.json");
```

## Best Practices

### 1. Use Safe Read Methods

```typescript
// Good: Use safe methods for optional files
const config = __sys__.$readJsonSafe("config.json", {});

// Avoid: Catching errors manually
try {
    const config = __sys__.$readJson("config.json");
} catch {
    const config = {};
}
```

### 2. Validate File Content

```typescript
function readConfigSafely(path: string): Config {
    const data = __sys__.$readJsonSafe(path, {});

    // Validate structure
    if (typeof data.port !== "number") {
        throw new Error("Invalid config: port must be a number");
    }

    return data as Config;
}
```

### 3. Handle Large Files

```typescript
// For large files, process line by line
function processLargeFile(path: string): void {
    const lines = __sys__.$readLines(path);

    // Process in chunks
    const chunkSize = 1000;
    for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize);
        processChunk(chunk);
    }
}
```

### 4. Use Atomic Writes

```typescript
function atomicWrite(path: string, data: string): void {
    const tempPath = `${path}.tmp`;

    // Write to temporary file
    __sys__.$write(tempPath, data);

    // Move to final location
    __sys__.$move(tempPath, path);
}
```

### 5. Clean Up Resources

```typescript
function processWithCleanup(inputPath: string): void {
    const tempFile = `temp_${Date.now()}.txt`;

    try {
        // Process file
        const content = __sys__.$read(inputPath);
        __sys__.$write(tempFile, content.toUpperCase());

        // Use temp file
        processFile(tempFile);
    } finally {
        // Always clean up
        if (__sys__.$exists(tempFile)) {
            __sys__.$rm(tempFile);
        }
    }
}
```

## Performance Considerations

### File Size Impact

-   **Small files (<1MB)**: Negligible performance impact
-   **Medium files (1-10MB)**: ~10-100ms read/write time
-   **Large files (>10MB)**: Consider streaming or chunking

### Optimization Tips

```typescript
// Cache file content if reading multiple times
const contentCache = new Map<string, string>();

function cachedRead(path: string): string {
    if (!contentCache.has(path)) {
        contentCache.set(path, __sys__.$read(path));
    }
    return contentCache.get(path)!;
}

// Batch writes
const writes: Array<[string, string]> = [];

function queueWrite(path: string, data: string): void {
    writes.push([path, data]);
}

function flushWrites(): void {
    writes.forEach(([path, data]) => {
        __sys__.$write(path, data);
    });
    writes.length = 0;
}
```

## Error Handling

```typescript
import { XyPrissError } from "xypriss";

try {
    const content = __sys__.$read("file.txt");
} catch (error) {
    if (error instanceof XyPrissError) {
        console.error(`Failed to read file: ${error.message}`);
    }
}

// Check existence before reading
if (__sys__.$exists("file.txt")) {
    const content = __sys__.$read("file.txt");
} else {
    console.log("File not found");
}
```

## Related Documentation

-   [Path Operations](./path-operations.md)
-   [Directory Management](./directory-management.md)
-   [File Metadata](./file-metadata.md)
-   [Complete Reference](./complete-reference.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12

