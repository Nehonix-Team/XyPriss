# XyPriss JSON (XJson) API - Extended JSON Response Handler

## Overview

The XJson API is an advanced JSON response handler designed to solve serialization issues and handle large data responses without limitations. It provides enhanced JSON serialization capabilities that overcome common problems with standard JSON responses, particularly for complex data structures and large payloads.

## Problem Solved

When making requests to XyPriss applications, developers often encounter serialization errors, especially with:

-   **BigInt values** that can't be directly serialized by `JSON.stringify()`
-   **Circular references** in object structures
-   **Very large data sets** that cause memory issues
-   **Complex nested objects** with mixed data types

The traditional `.json()` method fails with errors like:

```json
{
    "error": "Serialization failed",
    "message": "Unable to serialize response object",
    "originalError": "JSON Parse error: Unexpected identifier \"Serialization\""
}
```

## Solution: XJson API

The XJson API provides a robust alternative that:

✅ **Handles BigInt serialization** - Converts BigInt values to strings automatically  
✅ **Prevents circular reference errors** - Safely handles cyclic object structures  
✅ **Supports streaming for large data** - Streams responses in chunks to avoid memory issues  
✅ **Maintains backward compatibility** - Works alongside existing `.json()` methods  
✅ **Provides configurable options** - Customizable serialization behavior

## Quick Start

### Basic Usage

```typescript
import { createServer } from "@xypriss/core";

const app = createServer({});

// Use the new XJson endpoint
app.get("/api/data", (req, res) => {
    const data = {
        success: true,
        file: {
            id: "cmj17uh7f00002ef4otv5rqlj",
            size: 18n, // BigInt value
            filename: "document.pdf",
            metadata: {
                // Complex nested structure
                author: "John Doe",
                tags: ["important", "urgent"],
            },
        },
    };

    // Use res.xJson() instead of res.json()
    res.xJson(data);
});

// Traditional JSON endpoint (still works for simple data)
app.get("/api/simple", (req, res) => {
    res.json({ message: "Hello World" });
});

app.start();
```

### Response Examples

**Traditional JSON endpoint:**

```bash
$ curl http://localhost:8085/api/data
{"error":"Serialization failed","message":"Unable to serialize response object"}
```

**XJson endpoint:**

```bash
$ curl http://localhost:8085/api/data.xJson
{"success":true,"file":{"id":"cmj17uh7f00002ef4otv5rqlj","size":"18","filename":"document.pdf","metadata":{"author":"John Doe","tags":["important","urgent"]}}}
```

## API Reference

### res.xJson(data, options?)

The main method for sending XJson responses.

**Parameters:**

-   `data` (any): The data to serialize and send
-   `options` (XJsonOptions, optional): Configuration options

**Returns:** void

### XJsonOptions Interface

```typescript
interface XJsonOptions {
    /**
     * Maximum depth for object serialization
     * @default 20
     */
    maxDepth?: number;

    /**
     * Maximum string length before truncation
     * @default 10000
     */
    truncateStrings?: number;

    /**
     * Include non-enumerable properties
     * @default false
     */
    includeNonEnumerable?: boolean;

    /**
     * Enable streaming for very large responses
     * @default true
     */
    enableStreaming?: boolean;

    /**
     * Chunk size for streaming responses (in bytes)
     * @default 1024 * 64 (64KB)
     */
    chunkSize?: number;
}
```

## Advanced Usage

### Custom Configuration

```typescript
import { XJsonResponseHandler } from "@xypriss/core";

// Create a custom XJson handler with specific options
const customHandler = new XJsonResponseHandler({
    maxDepth: 50, // Allow deeper nesting
    truncateStrings: 50000, // Allow longer strings
    enableStreaming: true, // Enable streaming for large data
    chunkSize: 1024 * 128, // 128KB chunks
});

// Use in middleware
app.use(
    XJsonResponseHandler.createMiddleware({
        maxDepth: 30,
        truncateStrings: 20000,
    })
);

// Use directly in routes
app.get("/large-data", (req, res) => {
    const largeData = generateLargeDataset();
    res.xJson(largeData, {
        maxDepth: 40,
        enableStreaming: true,
    });
});
```

### Handling Complex Data Structures

```typescript
app.get("/complex-data", (req, res) => {
    const complexData = {
        // Circular reference handling
        user: {
            id: 1,
            name: "Alice",
            // This would normally cause serialization errors
            // bestFriend: null // (circular reference)
        },

        // BigInt values
        bigNumber: 12345678901234567890n,

        // Mixed data types
        metadata: {
            timestamp: new Date(),
            regex: /test/gi,
            bigIntArray: [1n, 2n, 3n],
            buffer: Buffer.from("test data"),
        },

        // Large nested objects
        deep: {
            level1: {
                level2: {
                    level3: {
                        data: "This is deeply nested",
                    },
                },
            },
        },
    };

    // XJson handles all of this automatically
    res.xJson(complexData);
});
```

### Streaming Large Responses

```typescript
app.get("/stream-data", (req, res) => {
    const largeData = {
        type: "large_dataset",
        items: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            data: `Item ${i}`,
            bigValue: BigInt(i) * 1000000n,
        })),
    };

    // This will automatically stream the response
    res.xJson(largeData, {
        enableStreaming: true,
        chunkSize: 1024 * 64, // 64KB chunks
    });
});
```

## Content-Type Headers

XJson responses automatically set the appropriate Content-Type header:

```javascript
// XJson responses
Content-Type: application/json

// Streamed XJson responses (for large data)
Content-Type: application/json
Content-Length: [calculated size]
```

## Performance Considerations

### Memory Efficiency

-   **Streaming enabled by default** for responses larger than 64KB
-   **Chunk-based processing** prevents memory overflow
-   **Lazy serialization** only processes data when needed

### Speed Optimization

-   **Fast path** for simple data that can be serialized normally
-   **Safe path fallback** only when standard serialization fails
-   **Minimal overhead** for compatible data types

### When to Use XJson vs Regular JSON

**Use XJson (`res.xJson()`) when:**

-   Dealing with BigInt values
-   Handling large datasets (>64KB)
-   Complex nested objects
-   Potential circular references
-   Mixed data types (Dates, Buffers, RegExp, etc.)

**Use Regular JSON (`res.json()`) when:**

-   Simple data structures
-   Performance is critical
-   Data is known to be serialization-safe
-   Backward compatibility is required

## Error Handling

XJson provides detailed error information when serialization fails:

```typescript
app.get("/error-test", (req, res) => {
    try {
        const problematicData = /* ... */;
        res.xJson(problematicData);
    } catch (error) {
        // XJson handles errors gracefully
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to serialize response",
            details: error.message
        });
    }
});
```

## Integration with Middleware

XJson integrates seamlessly with XyPriss middleware:

```typescript
import { createServer } from "@xypriss/core";
import { securityMiddleware } from "@xypriss/security";

const app = createServer({});

// Security middleware works with XJson
app.use(
    securityMiddleware({
        enabled: true,
        level: "enhanced",
    })
);

// Cache middleware
app.get("/cached-data", cacheMiddleware(), (req, res) => {
    const data = getExpensiveData();
    res.xJson(data); // Cached properly
});
```

## Migration Guide

### From Regular JSON to XJson

**Before:**

```typescript
app.get("/data", (req, res) => {
    const data = { value: 123n }; // BigInt
    res.json(data); // ❌ Fails
});
```

**After:**

```typescript
app.get("/data", (req, res) => {
    const data = { value: 123n }; // BigInt
    res.xJson(data); // ✅ Works perfectly
});
```

### Gradual Migration

You can migrate endpoints one by one:

```typescript
// Keep existing endpoints
app.get("/simple", (req, res) => {
    res.json({ message: "Still works" });
});

// Migrate problematic endpoints
app.get("/complex", (req, res) => {
    res.xJson(getComplexData());
});
```

## Best Practices

1. **Use XJson for known problematic data**

    - BigInt values
    - Complex object graphs
    - Large datasets

2. **Configure streaming for very large responses**

    ```typescript
    res.xJson(largeData, {
        enableStreaming: true,
        chunkSize: 1024 * 256, // 256KB chunks
    });
    ```

3. **Set appropriate depth limits**

    ```typescript
    res.xJson(data, {
        maxDepth: 10, // Prevent excessive nesting
    });
    ```

4. **Monitor performance**
    - XJson adds minimal overhead for simple data
    - Significant benefits for complex serialization scenarios

## Troubleshooting

### Common Issues

**Issue:** "Cannot find module" error
**Solution:** Ensure you're importing from the correct package:

```typescript
import { XJsonResponseHandler } from "@xypriss/core";
```

**Issue:** Streaming not working for large data
**Solution:** Check if `enableStreaming` is set to `true` and data size exceeds chunk size

**Issue:** Performance degradation
**Solution:** Use regular `res.json()` for simple, compatible data types

### Debug Mode

Enable debug logging to see serialization details:

```typescript
const app = createServer({
    env: "development",
    logging: {
        level: "debug",
    },
});
```

## Examples

See the `/examples` directory for complete working examples:

-   Basic XJson usage
-   Large dataset streaming
-   Complex data structures
-   Middleware integration
-   Error handling

## API Comparison

| Feature                    | Regular JSON | XJson                  |
| -------------------------- | ------------ | ---------------------- |
| BigInt support             | ❌           | ✅                     |
| Circular references        | ❌           | ✅                     |
| Streaming                  | ❌           | ✅                     |
| Large data handling        | ❌           | ✅                     |
| Mixed data types           | ❌           | ✅                     |
| Performance (simple data)  | ✅           | ⚡️ (minimal overhead) |
| Performance (complex data) | ❌           | ✅                     |

## Conclusion

The XJson API provides a robust, flexible solution for JSON serialization challenges in XyPriss applications. By handling edge cases like BigInt values, circular references, and large datasets, it ensures reliable data transmission while maintaining excellent performance for typical use cases.

Use XJson when you need reliable serialization for complex data, and rely on regular JSON for simple, performance-critical scenarios.
