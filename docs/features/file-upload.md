# File Upload Guide

## Overview

XyPriss provides comprehensive file upload support with automatic error handling, configuration-based setup, and both class-based and functional APIs. This guide covers the file upload system, configuration options, and usage examples.

## Key Features

-   ✅ **Automatic Error Handling**: File upload errors are automatically converted to user-friendly JSON responses
-   ✅ **Class-Based API**: Modern `FileUploadAPI` class for better organization
-   ✅ **Legacy Compatibility**: Function-based API still available for backward compatibility
-   ✅ **Multipart Support**: Fixed multipart/form-data handling (no more "Unexpected end of form" errors)
-   ✅ **Flexible Configuration**: Extensive configuration options for security and performance
-   ✅ **Type Safety**: Full TypeScript support with proper type definitions

## Bug Fix: Multipart Form-Data Support

### Issue

Previously, XyPriss automatically consumed request body streams for all POST/PUT/PATCH requests before middleware execution. This prevented multer and other multipart parsers from reading the stream, causing "Unexpected end of form" errors.

### Solution

The `parseBody` method in `HttpServer` now skips body parsing for `multipart/form-data` content types, allowing middleware to access the raw request stream.

## Quick Start

### Class-Based API (Recommended)

```typescript
import { createServer } from "xypriss";
import { FileUploadAPI, Configs } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },
});

// Create file upload instance
const fileUpload = new FileUploadAPI();
await fileUpload.initialize(Configs.get("fileUpload"));

app.post("/upload", fileUpload.single("file"), (req, res) => {
    console.log(req.file); // File object available
    res.json({ success: true });
});
```

### Functional API (Legacy)

```typescript
import { createServer } from "xypriss";
import { uploadSingle } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },
});

app.post("/upload", uploadSingle("file"), (req, res) => {
    console.log(req.file); // File object available
    res.json({ success: true });
});
```

## Automatic Error Handling

XyPriss automatically handles file upload errors and converts them to user-friendly JSON responses. No manual error handling required!

### Error Response Examples

**File Too Large:**

```json
{
    "success": false,
    "error": "File too large",
    "message": "File size exceeds the maximum limit of 1.00MB",
    "details": {
        "maxSize": 1048576,
        "maxSizeMB": "1.00",
        "fileSize": "unknown"
    }
}
```

**File Type Not Allowed:**

```json
{
    "success": false,
    "error": "File type not allowed",
    "message": "File type 'application/exe' not allowed. Allowed types: image/jpeg, image/png"
}
```

**Configuration Error:**

```json
{
    "success": false,
    "error": "Configuration Error",
    "message": "File upload not enabled. Set fileUpload.enabled to true in server options."
}
```

### Configuration Options

#### Core Options

| Option        | Type                 | Default         | Description                          |
| ------------- | -------------------- | --------------- | ------------------------------------ |
| `enabled`     | `boolean`            | `false`         | Enable file upload functionality     |
| `maxFileSize` | `number`             | `1048576` (1MB) | Maximum file size in bytes           |
| `maxFiles`    | `number`             | `1`             | Maximum number of files per request  |
| `storage`     | `'memory' \| 'disk'` | `'memory'`      | Storage backend                      |
| `destination` | `string`             | `'./uploads'`   | Upload directory (disk storage only) |
| `filename`    | `function`           | Auto-generated  | Custom filename function             |

#### Type Filtering

| Option              | Type       | Default           | Description             |
| ------------------- | ---------- | ----------------- | ----------------------- |
| `allowedMimeTypes`  | `string[]` | Common types      | Allowed MIME types      |
| `allowedExtensions` | `string[]` | Common extensions | Allowed file extensions |

#### Advanced Options

| Option             | Type       | Description                  |
| ------------------ | ---------- | ---------------------------- |
| `limits`           | `object`   | Detailed multer limits       |
| `fileFilter`       | `function` | Custom file filter function  |
| `preservePath`     | `boolean`  | Preserve full file paths     |
| `createParentPath` | `boolean`  | Create destination directory |
| `multerOptions`    | `object`   | Raw multer configuration     |

### Default Configuration

```typescript
{
    enabled: false, // Disabled by default for security
    maxFileSize: 1024 * 1024, // 1MB
    maxFiles: 1,
    storage: 'memory',
    allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv'
    ],
    allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.pdf', '.txt', '.csv'
    ],
    createParentPath: true,
    preservePath: false,
    limits: {
        fieldNameSize: 100,
        fieldSize: 1024 * 1024,
        fields: 10,
        headerPairs: 20
    }
}
```

## Upload Methods

### Single File Upload

```typescript
app.post("/upload", app.uploadSingle("fieldname"), (req, res) => {
    // req.file contains the uploaded file
    const file = req.file;
    console.log(file.originalname, file.size, file.mimetype);
});
```

### Multiple Files (Array)

```typescript
app.post("/upload", app.uploadArray("files", 5), (req, res) => {
    // req.files contains array of uploaded files
    console.log(`Uploaded ${req.files.length} files`);
});
```

### Multiple Fields

```typescript
app.post(
    "/upload",
    app.uploadFields([
        { name: "avatar", maxCount: 1 },
        { name: "documents", maxCount: 3 },
    ]),
    (req, res) => {
        // req.files contains files organized by field name
        console.log(req.files);
    }
);
```

### Accept Any Files

```typescript
app.post("/upload", app.uploadAny(), (req, res) => {
    // req.files contains all uploaded files
    console.log(req.files);
});
```

## Manual Multer Integration

For advanced use cases, you can still use multer directly:

```typescript
import multer from "multer";

const manualUpload = multer({
    storage: multer.diskStorage({
        destination: "./uploads",
        filename: (req, file, cb) => {
            cb(null, Date.now() + "-" + file.originalname);
        },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.post("/upload-manual", manualUpload.single("file"), (req, res) => {
    // Traditional multer usage
    console.log(req.file);
});
```

## File Object Structure

### Memory Storage

```typescript
{
    fieldname: 'file',
    originalname: 'example.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: <Buffer>, // File data
    size: 12345
}
```

### Disk Storage

```typescript
{
    fieldname: 'file',
    originalname: 'example.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    destination: './uploads',
    filename: '123456789-example.jpg',
    path: './uploads/123456789-example.jpg',
    size: 12345
}
```

## Error Handling

### Automatic Error Handling (Recommended)

With the new FileUploadAPI, errors are automatically handled and converted to JSON responses. No manual error handling needed!

```typescript
import { FileUploadAPI } from "xypriss";

const fileUpload = new FileUploadAPI();
await fileUpload.initialize({ enabled: true, maxFileSize: 1024 * 1024 });

app.post("/upload", fileUpload.single("file"), (req, res) => {
    // Errors are automatically handled - this code only runs on success
    res.json({
        success: true,
        file: {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
        },
    });
});
```

### Manual Error Handling (Legacy)

For the legacy functional API, you can still handle errors manually:

```typescript
import { uploadSingle } from "xypriss";

app.post(
    "/upload",
    (req, res, next) => {
        const uploadMiddleware = uploadSingle("file");

        uploadMiddleware(req, res, (err) => {
            if (err) {
                // Manual error handling
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        error: "File too large",
                        message: `Maximum size: ${err.field || "1MB"}`,
                    });
                }
                return res.status(400).json({ error: err.message });
            }

            // Success - continue to handler
            next();
        });
    },
    (req, res) => {
        res.json({ success: true, file: req.file });
    }
);
```

### Custom File Filters

```typescript
const fileUploadConfig = {
    enabled: true,
    fileFilter: (req, file, cb) => {
        // Custom validation logic
        if (file.originalname.includes("virus")) {
            return cb(new Error("Suspicious filename detected"), false);
        }
        if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
            return cb(new Error("Only JPEG and PNG files allowed"), false);
        }
        cb(null, true);
    },
};
```

## Security Considerations

### File Upload Security

1. **Validate File Types**: Always check MIME types and file extensions
2. **Limit File Sizes**: Set reasonable size limits to prevent DoS attacks
3. **Use Memory Storage**: For untrusted uploads, use memory storage to avoid disk I/O
4. **Sanitize Filenames**: Avoid user-provided filenames for security
5. **Scan for Malware**: Consider integrating virus scanning for uploaded files

### Example Security Configuration

```typescript
const secureConfig = {
    fileUpload: {
        enabled: true,
        maxFileSize: 2 * 1024 * 1024, // 2MB
        maxFiles: 1,
        storage: "memory", // Safer than disk
        allowedMimeTypes: ["image/jpeg", "image/png"],
        allowedExtensions: [".jpg", ".jpeg", ".png"],
        fileFilter: (req, file, cb) => {
            // Additional security checks
            if (file.originalname.includes("..")) {
                return cb(new Error("Invalid filename"), false);
            }
            cb(null, true);
        },
    },
};
```

## API Comparison

### Class-Based API (Recommended)

```typescript
import { FileUploadAPI } from "xypriss";

const fileUpload = new FileUploadAPI();
await fileUpload.initialize({
    enabled: true,
    maxFileSize: 5 * 1024 * 1024,
    storage: "memory",
});

// Automatic error handling
app.post("/upload", fileUpload.single("file"), (req, res) => {
    res.json({ success: true, file: req.file });
});
```

### Functional API (Legacy)

```typescript
import { uploadSingle } from "xypriss";

// Automatic error handling
app.post("/upload", uploadSingle("file"), (req, res) => {
    res.json({ success: true, file: req.file });
});
```

### Manual Multer (Advanced)

```typescript
import multer from "multer";

const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Manual error handling required
app.post(
    "/upload",
    (req, res, next) => {
        upload.single("file")(req, res, (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    },
    (req, res) => {
        res.json({ success: true, file: req.file });
    }
);
```

## Migration Guide

### From Manual Multer

**Before:**

```typescript
import multer from "multer";
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
    // Manual error handling
    if (!req.file) {
        return res.status(400).json({ error: "Upload failed" });
    }
    res.json({ success: true });
});
```

**After (Class-Based - Recommended):**

```typescript
import { FileUploadAPI } from "xypriss";

const fileUpload = new FileUploadAPI();
await fileUpload.initialize({
    enabled: true,
    storage: "disk",
    destination: "uploads/",
});

app.post("/upload", fileUpload.single("file"), (req, res) => {
    // Automatic error handling - only success code here
    res.json({ success: true, file: req.file });
});
```

**After (Functional - Simple):**

```typescript
import { uploadSingle } from "xypriss";

app.post("/upload", uploadSingle("file"), (req, res) => {
    // Automatic error handling - only success code here
    res.json({ success: true, file: req.file });
});
```

**After (Keep Manual - Advanced):**

```typescript
// Manual multer still works exactly the same
import multer from "multer";
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
    // Still need manual error handling
    res.json({ success: true, file: req.file });
});
```

## Performance Tips

1. **Use Memory Storage** for small files and trusted uploads
2. **Use Disk Storage** for large files to avoid memory pressure
3. **Set Appropriate Limits** to prevent resource exhaustion
4. **Enable Compression** for large file transfers
5. **Use Streaming** for very large files when possible

## Troubleshooting

### Common Issues

**"File too large" error:**

-   Check `maxFileSize` configuration
-   Ensure client is not sending files larger than the limit

**"Unexpected end of form" error:**

-   This was the original bug - ensure you're using XyPriss with file upload support
-   Check that `multipart/form-data` content type is being used

**Files not uploading:**

-   Verify `fileUpload.enabled` is `true`
-   Check that the correct field name is used in `uploadSingle()`

**Type errors:**

-   Ensure you're using the correct field names
-   Check that multer types are properly imported

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const app = createServer({
    fileUpload: {
        enabled: true,
        debug: true, // Enable debug logging
        // ... other options
    },
});
```

## API Reference

### FileUploadConfig Interface

```typescript
interface FileUploadConfig {
    enabled?: boolean;
    maxFileSize?: number;
    maxFiles?: number;
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
    destination?: string;
    filename?: (req: any, file: any, callback: Function) => void;
    limits?: {
        fieldNameSize?: number;
        fieldSize?: number;
        fields?: number;
        fileSize?: number;
        files?: number;
        headerPairs?: number;
    };
    fileFilter?: (req: any, file: any, callback: Function) => void;
    storage?: "memory" | "disk" | "custom";
    preservePath?: boolean;
    createParentPath?: boolean;
    multerOptions?: any;
}
```

### App Methods

```typescript
interface UltraFastApp {
    uploadSingle(fieldname: string): RequestHandler;
    uploadArray(fieldname: string, maxCount?: number): RequestHandler;
    uploadFields(fields: any[]): RequestHandler;
    uploadAny(): RequestHandler;
}
```

## Examples

### Image Upload with Validation

```typescript
const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
        storage: "disk",
        destination: "./uploads/images",
    },
});

app.post("/upload-image", app.uploadSingle("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
    }

    // Process the uploaded image
    const imagePath = req.file.path;
    // ... image processing logic ...

    res.json({
        success: true,
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype,
    });
});
```

### Multiple File Upload

```typescript
const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB per file
        maxFiles: 5,
        storage: "memory",
    },
});

app.post("/upload-documents", app.uploadArray("documents", 5), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No documents uploaded" });
    }

    const uploadedFiles = req.files.map((file) => ({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
    }));

    res.json({
        success: true,
        count: req.files.length,
        files: uploadedFiles,
    });
});
```

### Form Data with Files

```typescript
app.post(
    "/submit-form",
    app.uploadFields([
        { name: "avatar", maxCount: 1 },
        { name: "resume", maxCount: 1 },
    ]),
    (req, res) => {
        const formData = req.body; // Other form fields
        const avatar = req.files.avatar?.[0];
        const resume = req.files.resume?.[0];

        // Process form data and files
        res.json({
            formData,
            avatar: avatar
                ? { name: avatar.originalname, size: avatar.size }
                : null,
            resume: resume
                ? { name: resume.originalname, size: resume.size }
                : null,
        });
    }
);
```
