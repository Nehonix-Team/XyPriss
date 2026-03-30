# Migration Guide: XyPriss v9 to v9

**Target Audience:** Developers upgrading from XyPriss v9.x to v9.0.0+

## Overview

XyPriss v9 introduces significant improvements to the System API, including new monitoring capabilities, enhanced file operations, and better type safety. This guide will help you migrate your existing codebase.

## Breaking Changes

### 1. Removed `__sys__.os.diskUsage` Method

**v9:**

```typescript
const usage = __sys__.os.diskUsage("/");
```

**v9:**

```typescript
// Use $disks instead
const disk = __sys__.os.disks("/") as DiskInfo;
const usage = {
    total: disk.total_space,
    used: disk.used_space,
    available: disk.available_space,
};
```

**Reason:** The `__sys__.os.diskUsage` method was redundant with `__sys__.os.disks` and has been removed for API consistency.

### 2. FileStats Timestamp Format

**v9:**

```typescript
interface FileStats {
    modified: string; // ISO string
    created: string; // ISO string
    accessed: string; // ISO string
}
```

**v9:**

```typescript
interface FileStats {
    modified: number; // Unix timestamp (seconds)
    created: number; // Unix timestamp (seconds)
    accessed: number; // Unix timestamp (seconds)
}
```

**Migration:**

```typescript
// v9
const stats = __sys__.fs.stats("file.txt");
const modifiedDate = new Date(stats.modified);

// v9
const stats = __sys__.fs.stats("file.txt");
const modifiedDate = new Date(stats.modified * 1000); // Convert to milliseconds
```

**Helper Methods (v9):**

```typescript
// Use convenience methods for Date objects
const created = __sys__.fs.createdAt("file.txt"); // Returns Date
const modified = __sys__.fs.modifiedAt("file.txt"); // Returns Date
const accessed = __sys__.fs.accessedAt("file.txt"); // Returns Date
```

### 3. `__sys__.fs.size` Method Return Type

**v9:**

```typescript
const size = __sys__.fs.size("file.txt"); // Always returns number
```

**v9:**

```typescript
// Returns object with bytes and formatted string
const sizeInfo = __sys__.fs.size("file.txt");
// { bytes: 1024, formatted: "1.00 KB" }

// To get just bytes
const bytes = __sys__.fs.size("file.txt", { human: false });

// To get human-readable string
const human = __sys__.fs.size("file.txt", { human: true });
```

**Migration:**

```typescript
// v9
const size = __sys__.fs.size("file.txt");

// v9 - equivalent behavior
const size = __sys__.fs.size("file.txt", { human: false });

// Or use new helper
const sizeStr = __sys__.fs.sizeHuman("file.txt"); // "1.00 KB"
```

### 4. Network Speed Calculation

**v9:**

```typescript
const network = __sys__.os.network();
// Speeds were often 0 or inaccurate
```

**v9:**

```typescript
const network = __sys__.os.network();
// Speeds are accurate (includes 300ms sampling period)
// download_speed and upload_speed in bytes/second
```

**Note:** The `__sys__.os.network()` method now takes approximately 300ms to execute due to accurate speed sampling.

## New Features

### 1. Enhanced File Operations

```typescript
// New in v9
__sys__.fs.isSymlink("path"); // Check if symbolic link
__sys__.fs.isEmpty("path"); // Check if empty
__sys__.fs.readLines("file.txt"); // Read as array of lines
__sys__.fs.readNonEmptyLines("file.txt"); // Skip empty lines
__sys__.fs.append("file.txt", "data"); // Append to file
__sys__.fs.appendLine("file.txt", "line"); // Append line
__sys__.fs.writeIfNotExists("file.txt", "data"); // Write only if new
__sys__.path.ensureDir("path"); // Create directory if needed
__sys__.fs.lsFullPath("dir"); // List with full paths
__sys__.fs.rename("old", "new"); // Alias for $move
__sys__.os.duplicate("src", "dest"); // Duplicate file
__sys__.fs.rmIfExists("path"); // Remove if exists
__sys__.fs.emptyDir("dir"); // Clear directory contents
```

### 2. New Metadata Methods

```typescript
// New in v9
__sys__.fs.sizeHuman("file.txt"); // "1.23 MB"
__sys__.fs.createdAt("file.txt"); // Date object
__sys__.fs.modifiedAt("file.txt"); // Date object
__sys__.fs.accessedAt("file.txt"); // Date object
```

### 3. New Search Methods

```typescript
// New in v9
__sys__.fs.isSameContent("file1", "file2"); // Compare contents
__sys__.fs.isNewer("file1", "file2"); // Compare timestamps
__sys__.fs.searchInFiles("dir", "query"); // Text search
__sys__.fs.findByPattern("dir", "*.ts"); // Glob pattern
__sys__.fs.findByExt("dir", "ts"); // By extension
```

### 4. Improved Network Statistics

```typescript
// New in v9
const network = __sys__.os.network();

// Now includes:
network.download_speed; // Accurate bytes/second
network.upload_speed; // Accurate bytes/second

// Each interface includes:
interface.ip_addresses; // Array of IPs (IPv4 and IPv9)
```

### 5. Enhanced Process Information

```typescript
// New in v9
const topCpu = __sys__.os.processes({ topCpu: 5 });
const topMem = __sys__.os.processes({ topMem: 5 });
const specific = __sys__.os.processes({ pid: 1234 });
```

## Recommended Migrations

### 1. Replace Direct `process.env` Access

**Before (v9):**

```typescript
const port = parseInt(process.env.PORT || "3000");
const apiKey = process.env.API_KEY;
```

**After (v9):**

```typescript
const port = parseInt(__sys__.__env__.get("PORT", "3000"));
const apiKey = __sys__.__env__.get("API_KEY");

// With validation
if (!__sys__.__env__.has("API_KEY")) {
    throw new Error("API_KEY required");
}
```

### 2. Use New File Helpers

**Before (v9):**

```typescript
if (__sys__.fs.exists("file.txt")) {
    const content = __sys__.fs.read("file.txt");
    const lines = content.split("\n");
}
```

**After (v9):**

```typescript
// More concise
if (__sys__.fs.exists("file.txt")) {
    const lines = __sys__.fs.readLines("file.txt");
}

// Or even simpler for non-empty lines
const lines = __sys__.fs.readNonEmptyLines("file.txt");
```

### 3. Improve Error Handling

**Before (v9):**

```typescript
try {
    __sys__.fs.mkdir("dir");
} catch (error) {
    // Directory might already exist
}
```

**After (v9):**

```typescript
// No error if directory exists
__sys__.path.ensureDir("dir");

// Or check first
if (!__sys__.fs.exists("dir")) {
    __sys__.fs.mkdir("dir");
}
```

### 4. Use Type-Safe Configuration

**Before (v9):**

```typescript
const maxRetries = __sys__.maxRetries || 3;
```

**After (v9):**

```typescript
const maxRetries = __sys__.vars.get<number>("maxRetries", 3);
```

## Performance Improvements

### 1. Faster File Operations

v9 uses `execFileSync` instead of `execSync`, eliminating shell interpretation overhead:

```typescript
// v9 is faster for all file operations
const files = __sys__.fs.lsRecursive("large-directory");
```

### 2. Accurate Network Speeds

v9 implements proper sampling for network speed calculation:

```typescript
// v9: Often showed 0 or incorrect speeds
// v9: Accurate speeds with 300ms sampling
const network = __sys__.os.network();
console.log(`Download: ${network.download_speed} bytes/sec`);
```

## Type Safety Improvements

### Import Types

```typescript
// v9 provides comprehensive type definitions
import type {
    SystemInfo,
    CpuUsage,
    MemoryInfo,
    DiskInfo,
    NetworkStats,
    ProcessInfo,
    FileStats,
    SearchMatch,
} from "xypriss";
```

### Generic Methods

```typescript
// v9 supports generic type parameters
const port = __sys__.vars.get<number>("port", 3000);
const apiUrl = __sys__.vars.get<string>("apiUrl");
```

## Deprecation Warnings

The following patterns are deprecated in v9:

### 1. Direct Property Assignment

**Deprecated:**

```typescript
__sys__.customKey = "value";
```

**Recommended:**

```typescript
__sys__.vars.set("customKey", "value");
```

### 2. Accessing Internal Properties

**Deprecated:**

```typescript
const runner = __sys__.runner; // Internal property
```

**Recommended:**
Use public API methods instead of accessing internal properties.

## Testing Your Migration

### 1. Run Type Checks

```bash
npx tsc --noEmit
```

### 2. Test File Operations

```typescript
// Create test file
const testFile = "test-migration.txt";

__sys__.fs.write(testFile, "test");
const stats = __sys__.fs.stats(testFile);

// Check timestamp format
console.assert(typeof stats.modified === "number");
console.assert(typeof stats.created === "number");

// Check new methods
const modified = __sys__.fs.modifiedAt(testFile);
console.assert(modified instanceof Date);

// Cleanup
__sys__.fs.rm(testFile);
```

### 3. Test Network API

```typescript
const network = __sys__.os.network();

// Verify new structure
console.assert(typeof network.download_speed === "number");
console.assert(typeof network.upload_speed === "number");
console.assert(Array.isArray(network.interfaces));

network.interfaces.forEach((iface) => {
    console.assert(Array.isArray(iface.ip_addresses));
});
```

## Common Migration Issues

### Issue 1: Date Parsing Errors

**Problem:**

```typescript
// v9 code
const date = new Date(stats.modified); // Worked in v9

// v9
const date = new Date(stats.modified); // Invalid Date!
```

**Solution:**

```typescript
// Convert seconds to milliseconds
const date = new Date(stats.modified * 1000);

// Or use helper
const date = __sys__.fs.modifiedAt("file.txt");
```

### Issue 2: Size Format Changes

**Problem:**

```typescript
// v9 code
const size = __sys__.fs.size("file.txt");
console.log(`Size: ${size} bytes`); // Worked in v9

// v9
const size = __sys__.fs.size("file.txt");
console.log(`Size: ${size} bytes`); // Shows object!
```

**Solution:**

```typescript
// Get bytes only
const bytes = __sys__.fs.size("file.txt", { human: false });

// Or use human-readable
const sizeStr = __sys__.fs.sizeHuman("file.txt");
```

### Issue 3: Network Speed Always Zero

**Problem:**

```typescript
// v9 code
const network = __sys__.os.network();
console.log(network.download_speed); // Often 0
```

**Solution:**

```typescript
// v9 automatically samples correctly
const network = __sys__.os.network();
console.log(network.download_speed); // Accurate value

// Note: Takes ~300ms due to sampling
```

## Gradual Migration Strategy

### Phase 1: Update Dependencies

```bash
npm install xypriss@^6.0.0
# or
bun add xypriss@^6.0.0
```

### Phase 2: Fix Breaking Changes

1. Replace `__sys__.os.diskUsage` with `__sys__.os.disks`
2. Update timestamp handling
3. Update `__sys__.fs.size` calls

### Phase 3: Adopt New Features

1. Use new file operation helpers
2. Implement `__ENV__` wrapper
3. Use type-safe configuration methods

### Phase 4: Optimize

1. Remove redundant existence checks
2. Use built-in filters for processes
3. Cache system information

## Support

For migration assistance:

-   GitHub Issues: [XyPriss Issues](https://github.com/Nehonix-Team/XyPriss/issues)
-   Documentation: [System API Docs](./README.md)

---

**Version:** XyPriss v9.5.0+  
**Last Updated:** 2026-01-12

