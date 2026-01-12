# Migration Guide: XyPriss v5 to v6

**Target Audience:** Developers upgrading from XyPriss v5.x to v6.0.0+

## Overview

XyPriss v6 introduces significant improvements to the System API, including new monitoring capabilities, enhanced file operations, and better type safety. This guide will help you migrate your existing codebase.

## Breaking Changes

### 1. Removed `$diskUsage` Method

**v5:**

```typescript
const usage = __sys__.$diskUsage("/");
```

**v6:**

```typescript
// Use $disks instead
const disk = __sys__.$disks("/") as DiskInfo;
const usage = {
    total: disk.total_space,
    used: disk.used_space,
    available: disk.available_space,
};
```

**Reason:** The `$diskUsage` method was redundant with `$disks` and has been removed for API consistency.

### 2. FileStats Timestamp Format

**v5:**

```typescript
interface FileStats {
    modified: string; // ISO string
    created: string; // ISO string
    accessed: string; // ISO string
}
```

**v6:**

```typescript
interface FileStats {
    modified: number; // Unix timestamp (seconds)
    created: number; // Unix timestamp (seconds)
    accessed: number; // Unix timestamp (seconds)
}
```

**Migration:**

```typescript
// v5
const stats = __sys__.$stats("file.txt");
const modifiedDate = new Date(stats.modified);

// v6
const stats = __sys__.$stats("file.txt");
const modifiedDate = new Date(stats.modified * 1000); // Convert to milliseconds
```

**Helper Methods (v6):**

```typescript
// Use convenience methods for Date objects
const created = __sys__.$createdAt("file.txt"); // Returns Date
const modified = __sys__.$modifiedAt("file.txt"); // Returns Date
const accessed = __sys__.$accessedAt("file.txt"); // Returns Date
```

### 3. `$size` Method Return Type

**v5:**

```typescript
const size = __sys__.$size("file.txt"); // Always returns number
```

**v6:**

```typescript
// Returns object with bytes and formatted string
const sizeInfo = __sys__.$size("file.txt");
// { bytes: 1024, formatted: "1.00 KB" }

// To get just bytes
const bytes = __sys__.$size("file.txt", { human: false });

// To get human-readable string
const human = __sys__.$size("file.txt", { human: true });
```

**Migration:**

```typescript
// v5
const size = __sys__.$size("file.txt");

// v6 - equivalent behavior
const size = __sys__.$size("file.txt", { human: false });

// Or use new helper
const sizeStr = __sys__.$sizeHuman("file.txt"); // "1.00 KB"
```

### 4. Network Speed Calculation

**v5:**

```typescript
const network = __sys__.$network();
// Speeds were often 0 or inaccurate
```

**v6:**

```typescript
const network = __sys__.$network();
// Speeds are accurate (includes 300ms sampling period)
// download_speed and upload_speed in bytes/second
```

**Note:** The `$network()` method now takes approximately 300ms to execute due to accurate speed sampling.

## New Features

### 1. Enhanced File Operations

```typescript
// New in v6
__sys__.$isSymlink("path"); // Check if symbolic link
__sys__.$isEmpty("path"); // Check if empty
__sys__.$readLines("file.txt"); // Read as array of lines
__sys__.$readNonEmptyLines("file.txt"); // Skip empty lines
__sys__.$append("file.txt", "data"); // Append to file
__sys__.$appendLine("file.txt", "line"); // Append line
__sys__.$writeIfNotExists("file.txt", "data"); // Write only if new
__sys__.$ensureDir("path"); // Create directory if needed
__sys__.$lsFullPath("dir"); // List with full paths
__sys__.$rename("old", "new"); // Alias for $move
__sys__.$duplicate("src", "dest"); // Duplicate file
__sys__.$rmIfExists("path"); // Remove if exists
__sys__.$emptyDir("dir"); // Clear directory contents
```

### 2. New Metadata Methods

```typescript
// New in v6
__sys__.$sizeHuman("file.txt"); // "1.23 MB"
__sys__.$createdAt("file.txt"); // Date object
__sys__.$modifiedAt("file.txt"); // Date object
__sys__.$accessedAt("file.txt"); // Date object
```

### 3. New Search Methods

```typescript
// New in v6
__sys__.$isSameContent("file1", "file2"); // Compare contents
__sys__.$isNewer("file1", "file2"); // Compare timestamps
__sys__.$searchInFiles("dir", "query"); // Text search
__sys__.$findByPattern("dir", "*.ts"); // Glob pattern
__sys__.$findByExt("dir", "ts"); // By extension
```

### 4. Improved Network Statistics

```typescript
// New in v6
const network = __sys__.$network();

// Now includes:
network.download_speed; // Accurate bytes/second
network.upload_speed; // Accurate bytes/second

// Each interface includes:
interface.ip_addresses; // Array of IPs (IPv4 and IPv6)
```

### 5. Enhanced Process Information

```typescript
// New in v6
const topCpu = __sys__.$processes({ topCpu: 5 });
const topMem = __sys__.$processes({ topMem: 5 });
const specific = __sys__.$processes({ pid: 1234 });
```

## Recommended Migrations

### 1. Replace Direct `process.env` Access

**Before (v5):**

```typescript
const port = parseInt(process.env.PORT || "3000");
const apiKey = process.env.API_KEY;
```

**After (v6):**

```typescript
const port = parseInt(__sys__.__ENV__.get("PORT", "3000"));
const apiKey = __sys__.__ENV__.get("API_KEY");

// With validation
if (!__sys__.__ENV__.has("API_KEY")) {
    throw new Error("API_KEY required");
}
```

### 2. Use New File Helpers

**Before (v5):**

```typescript
if (__sys__.$exists("file.txt")) {
    const content = __sys__.$read("file.txt");
    const lines = content.split("\n");
}
```

**After (v6):**

```typescript
// More concise
if (__sys__.$exists("file.txt")) {
    const lines = __sys__.$readLines("file.txt");
}

// Or even simpler for non-empty lines
const lines = __sys__.$readNonEmptyLines("file.txt");
```

### 3. Improve Error Handling

**Before (v5):**

```typescript
try {
    __sys__.$mkdir("dir");
} catch (error) {
    // Directory might already exist
}
```

**After (v6):**

```typescript
// No error if directory exists
__sys__.$ensureDir("dir");

// Or check first
if (!__sys__.$exists("dir")) {
    __sys__.$mkdir("dir");
}
```

### 4. Use Type-Safe Configuration

**Before (v5):**

```typescript
const maxRetries = __sys__.maxRetries || 3;
```

**After (v6):**

```typescript
const maxRetries = __sys__.$get<number>("maxRetries", 3);
```

## Performance Improvements

### 1. Faster File Operations

v6 uses `execFileSync` instead of `execSync`, eliminating shell interpretation overhead:

```typescript
// v6 is faster for all file operations
const files = __sys__.$lsRecursive("large-directory");
```

### 2. Accurate Network Speeds

v6 implements proper sampling for network speed calculation:

```typescript
// v5: Often showed 0 or incorrect speeds
// v6: Accurate speeds with 300ms sampling
const network = __sys__.$network();
console.log(`Download: ${network.download_speed} bytes/sec`);
```

## Type Safety Improvements

### Import Types

```typescript
// v6 provides comprehensive type definitions
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
// v6 supports generic type parameters
const port = __sys__.$get<number>("port", 3000);
const apiUrl = __sys__.$get<string>("apiUrl");
```

## Deprecation Warnings

The following patterns are deprecated in v6:

### 1. Direct Property Assignment

**Deprecated:**

```typescript
__sys__.customKey = "value";
```

**Recommended:**

```typescript
__sys__.$add("customKey", "value");
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

__sys__.$write(testFile, "test");
const stats = __sys__.$stats(testFile);

// Check timestamp format
console.assert(typeof stats.modified === "number");
console.assert(typeof stats.created === "number");

// Check new methods
const modified = __sys__.$modifiedAt(testFile);
console.assert(modified instanceof Date);

// Cleanup
__sys__.$rm(testFile);
```

### 3. Test Network API

```typescript
const network = __sys__.$network();

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
// v5 code
const date = new Date(stats.modified); // Worked in v5

// v6
const date = new Date(stats.modified); // Invalid Date!
```

**Solution:**

```typescript
// Convert seconds to milliseconds
const date = new Date(stats.modified * 1000);

// Or use helper
const date = __sys__.$modifiedAt("file.txt");
```

### Issue 2: Size Format Changes

**Problem:**

```typescript
// v5 code
const size = __sys__.$size("file.txt");
console.log(`Size: ${size} bytes`); // Worked in v5

// v6
const size = __sys__.$size("file.txt");
console.log(`Size: ${size} bytes`); // Shows object!
```

**Solution:**

```typescript
// Get bytes only
const bytes = __sys__.$size("file.txt", { human: false });

// Or use human-readable
const sizeStr = __sys__.$sizeHuman("file.txt");
```

### Issue 3: Network Speed Always Zero

**Problem:**

```typescript
// v5 code
const network = __sys__.$network();
console.log(network.download_speed); // Often 0
```

**Solution:**

```typescript
// v6 automatically samples correctly
const network = __sys__.$network();
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

1. Replace `$diskUsage` with `$disks`
2. Update timestamp handling
3. Update `$size` calls

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

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12

