# XyPriss File Upload API - Best Practices Guide

## Overview

The XyPriss File Upload API provides a robust, multer-based file upload system. This guide covers best practices for uploading files to XyPriss servers, with special attention to runtime compatibility.

## ⚠️ Important: Runtime Compatibility

### Bun Runtime (RECOMMENDED APPROACHES)

When using **Bun**, you MUST use one of these approaches:

#### ✅ Option 1: Native FormData with Blob (RECOMMENDED)

```typescript
import fs from "fs";

const fileBuffer = fs.readFileSync(filePath);
const blob = new Blob([fileBuffer], { type: "image/jpeg" });

const form = new FormData();
form.append("file", blob, "filename.jpg");

const response = await fetch("http://localhost:8085/upload", {
    method: "POST",
    body: form,
});
```

**Why this works:** Bun's native `FormData` and `Blob` APIs properly handle the multipart/form-data encoding and streaming.

#### ✅ Option 2: File API (Browser-Compatible)

```typescript
import fs from "fs";

const fileBuffer = fs.readFileSync(filePath);
const file = new File([fileBuffer], "filename.jpg", {
    type: "image/jpeg",
});

const form = new FormData();
form.append("file", file);

const response = await fetch("http://localhost:8085/upload", {
    method: "POST",
    body: form,
});
```

**Why this works:** The `File` API is a web standard that Bun implements correctly.

#### ❌ AVOID: form-data npm package with Bun

```typescript
// ❌ DO NOT USE THIS WITH BUN
import FormData from "form-data";

const form = new FormData();
form.append("file", fs.createReadStream(filePath));

// This will fail with "Unexpected end of form" error
const response = await fetch(url, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
});
```

**Why this fails:** The `form-data` npm package creates Node.js streams that are incompatible with Bun's `fetch` implementation. The stream is not properly consumed, resulting in truncated data (typically only 17 bytes sent).

---

### Node.js Runtime

When using **Node.js**, you have more flexibility:

#### ✅ Option 1: form-data package with node-fetch

```typescript
import FormData from "form-data";
import fetch from "node-fetch";
import fs from "fs";

const form = new FormData();
form.append("file", fs.createReadStream(filePath), {
    filename: "file.jpg",
    contentType: "image/jpeg",
});

const response = await fetch("http://localhost:8085/upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
});
```

#### ✅ Option 2: Native FormData (Node.js 18+)

```typescript
import fs from "fs";
import { Blob } from "buffer";

const fileBuffer = fs.readFileSync(filePath);
const blob = new Blob([fileBuffer], { type: "image/jpeg" });

const form = new FormData();
form.append("file", blob, "filename.jpg");

const response = await fetch("http://localhost:8085/upload", {
    method: "POST",
    body: form,
});
```

---

## Server Configuration

XyPriss provides **two ways** to use the file upload API:

### ✅ Option 1: Using the `Uploader` Singleton (NEW - Recommended)

The `Uploader` is a pre-initialized singleton that automatically uses the `Configs` system. This is the **easiest and recommended** approach.

```typescript
import { createServer, Upload } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory", // or "disk"
        allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
        ],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".pdf"],
    },
});

// Use the Uploader singleton directly - no initialization needed!
app.post("/upload", upload.single("file"), (req, res) => {
    console.log("Uploaded file:", req.file);
    res.json({ success: true, file: req.file });
});

// Multiple files upload
app.post("/upload-multiple", upload.array("files", 5), (req, res) => {
    console.log("Uploaded files:", req.files);
    res.json({ success: true, files: req.files });
});

app.start();
```

**Why use `Uploader`?**

-   ✅ No manual initialization required
-   ✅ Automatically uses `Configs` system
-   ✅ Single source of truth for configuration
-   ✅ Less boilerplate code
-   ✅ Perfect for simple use cases

### ✅ Option 2: Using the `FileUploadAPI` Class (OLD - For Advanced Use Cases)

Use this approach when you need multiple upload instances with different configurations or more control.

```typescript
import { createServer, FileUploadAPI, Configs } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory", // or "disk"
        allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
        ],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".pdf"],
    },
});

// Create file upload instance
const upload = new FileUploadAPI();
await upload.initialize(Configs); // Pass Configs class for single source of truth

// Single file upload
app.post("/upload", upload.single("file"), (req, res) => {
    console.log("Uploaded file:", req.file);
    res.json({ success: true, file: req.file });
});

// Multiple files upload
app.post("/upload-multiple", upload.array("files", 5), (req, res) => {
    console.log("Uploaded files:", req.files);
    res.json({ success: true, files: req.files });
});

app.start();
```

**When to use `FileUploadAPI`?**

-   ✅ Need multiple upload instances with different configs
-   ✅ Need custom logger instance
-   ✅ Advanced use cases requiring more control
-   ✅ Testing scenarios

### Comparison

| Feature            | `Uploader` (Singleton)   | `FileUploadAPI` (Class)  |
| ------------------ | ------------------------ | ------------------------ |
| Initialization     | ✅ Automatic             | ⚠️ Manual required       |
| Boilerplate        | ✅ Minimal               | ⚠️ More code             |
| Multiple Instances | ❌ Single instance       | ✅ Multiple instances    |
| Custom Logger      | ❌ Uses default          | ✅ Custom logger support |
| Use Case           | Simple, standard uploads | Advanced, custom setups  |
| Recommended For    | Most applications        | Complex scenarios        |

### Configuration Options

```typescript
interface FileUploadConfig {
    enabled: boolean;
    maxFileSize?: number; // in bytes
    maxFiles?: number; // max number of files
    storage?: "memory" | "disk";
    destination?: string; // for disk storage
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
    limits?: {
        fieldNameSize?: number;
        fieldSize?: number;
        fields?: number;
        fileSize?: number;
        files?: number;
        parts?: number;
        headerPairs?: number;
    };
}
```

---

## Client-Side Examples

### Browser (Vanilla JavaScript)

```html
<input type="file" id="fileInput" />
<button onclick="uploadFile()">Upload</button>

<script>
    async function uploadFile() {
        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        const form = new FormData();
        form.append("file", file);

        const response = await fetch("http://localhost:8085/upload", {
            method: "POST",
            body: form,
        });

        const result = await response.json();
        console.log(result);
    }
</script>
```

### React

```typescript
import { useState } from "react";

function FileUpload() {
    const [file, setFile] = useState<File | null>(null);

    const handleUpload = async () => {
        if (!file) return;

        const form = new FormData();
        form.append("file", file);

        const response = await fetch("http://localhost:8085/upload", {
            method: "POST",
            body: form,
        });

        const result = await response.json();
        console.log(result);
    };

    return (
        <div>
            <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button onClick={handleUpload}>Upload</button>
        </div>
    );
}
```

### Bun/Node.js Script

```typescript
import fs from "fs";

async function uploadFile(filePath: string) {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });

    // Create form
    const form = new FormData();
    form.append("file", blob, "myfile.jpg");

    // Upload
    const response = await fetch("http://localhost:8085/upload", {
        method: "POST",
        body: form,
    });

    return response.json();
}

// Usage
const result = await uploadFile("./image.jpg");
console.log(result);
```

---

## Error Handling

### Common Errors

#### 1. "Unexpected end of form"

**Cause:** Using `form-data` package with Bun's fetch.

**Solution:** Use native FormData with Blob or File API.

#### 2. "File too large"

**Cause:** File exceeds `maxFileSize` limit.

**Solution:** Increase `maxFileSize` in server config or compress the file.

```typescript
{
    success: false,
    error: "File too large",
    message: "File size exceeds the maximum limit of 5.00MB"
}
```

#### 3. "File type not allowed"

**Cause:** File MIME type or extension not in allowed list.

**Solution:** Add the MIME type/extension to server config or convert the file.

```typescript
{
    success: false,
    error: "File type not allowed",
    message: "File type 'application/zip' not allowed. Allowed types: image/jpeg, image/png"
}
```

### Proper Error Handling

```typescript
async function uploadWithErrorHandling(file: File) {
    try {
        const form = new FormData();
        form.append("file", file);

        const response = await fetch("http://localhost:8085/upload", {
            method: "POST",
            body: form,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Upload failed");
        }

        return result;
    } catch (error) {
        console.error("Upload error:", error);
        throw error;
    }
}
```

---

## Testing

### Test Script Example

See `.private/test_upload_comprehensive.ts` for a complete test suite that validates:

1. Native FormData with Blob
2. File API
3. form-data package compatibility

Run tests:

```bash
bun .private/test_upload_comprehensive.ts
```

---

## Performance Tips

1. **Use memory storage for small files** (< 1MB) - faster processing
2. **Use disk storage for large files** - prevents memory issues
3. **Set appropriate file size limits** - prevents abuse
4. **Validate file types** - security best practice
5. **Use streaming for very large files** - better memory management

---

## Security Considerations

1. **Always validate file types** on the server
2. **Set reasonable file size limits**
3. **Sanitize file names** before saving to disk
4. **Scan uploaded files** for malware (if applicable)
5. **Use HTTPS** in production
6. **Implement rate limiting** to prevent abuse

---

## Troubleshooting

### Enable Debug Logging

The server logs detailed information about file uploads. Check the console for:

-   Content-Type headers
-   File size validation
-   MIME type checking
-   Extension validation

### Verify Server Configuration

```typescript
console.log("File upload enabled:", upload.isEnabled());
console.log("Max file size:", app.configs?.fileUpload?.maxFileSize);
```

### Test with curl

```bash
curl -X POST http://localhost:8085/upload \
  -F "file=@./test.jpg" \
  -v
```

---

## Summary

| Runtime | Recommended Approach                 | Avoid                          |
| ------- | ------------------------------------ | ------------------------------ |
| Bun     | Native FormData + Blob/File          | form-data package              |
| Node.js | form-data + node-fetch OR Native API | Mixing fetch implementations   |
| Browser | Native FormData + File               | Server-side streaming packages |

**Golden Rule:** When in doubt, use native `FormData` with `Blob` or `File` - it works everywhere! 🎯

