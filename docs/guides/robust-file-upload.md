# Robust & Professional File Upload Configuration Guide

This guide outlines the industry-standard practices for configuring and deploying XyPriss's native Go-powered file upload system in production environments.

## 1. Strategic Infrastructure Planning

For a robust system, do not use relative paths for storage. Define a clear, dedicated directory structure that is outside the application source code.

### Recommended Directory Structure

```text
/opt/myapp/
├── app/ (Source code)
├── data/
│   ├── uploads/ (Temp storage for XHSC)
│   └── permanent/ (Verified uploads)
└── logs/
```

### Professional Configuration

```typescript
import { createServer } from "xypriss";
import path from "node:path";

const isProduction = __sys__.$isProduction()

const server = createServer({
    fileUpload: {
        enabled: true,
        // High limit for Go, but validate per-route in TS if needed
        maxFileSize: 1024 * 1024 * 500, // 500MB

        // Use absolute paths in production
        destination: isProduction
            ? "/var/lib/xypriss/uploads"
            : path.join(process.cwd(), "tmp/uploads"),

        allowedExtensions: [".pdf", ".docx", ".zip", ".jpg", ".png"],

        // Security: Enable sub-directory isolation
        // This prevents directory clutter and OS performance issues
        useSubDir: true,
    },
});
```

## 2. Advanced Security Layer

### Perimeter Checks

The XHSC Go engine performs low-level security checks:

- **Magic Number Validation**: Verifies that a `.jpg` is actually an image, not just a renamed executable.
- **Early Termination**: Immediately drops connections if `Content-Length` headers exceed limits, saving bandwidth.

### Application Level Authorization

Always use a guard middleware _before_ the upload middleware to ensure only authorized users can occupy disk space.

```typescript
// ✅ CORRECT: Auth before Disk I/O
app.post(
    "/upload",
    AuthGuard.isUser,
    app.upload.single("file"),
    Controller.handleUpload,
);

// ❌ WRONG: Upload before Auth (DDoS vector)
app.post(
    "/upload",
    app.upload.single("file"),
    AuthGuard.isUser,
    Controller.handleUpload,
);
```

## 3. High-Performance Multi-Field Management

In professional applications, use `.fields()` to group related assets (e.g., a Profile Picture and a CV) in a single transactional request.

```typescript
const jobApplicationUpload = app.upload.fields([
    { name: "cv", maxCount: 1, allowedExtensions: [".pdf"] },
    { name: "photo", maxCount: 1, allowedExtensions: [".jpg", ".png"] },
]);

app.post("/apply", jobApplicationUpload, (req, res) => {
    const { cv, photo } = (req as any).files;
    // Process securely...
});
```

## 4. Production Maintenance

### Monitoring Disk Usage

Since XyPriss writes directly to disk via Go, ensure you have active monitoring on the target partition.

### Automated Cleanup Policy

XyPriss saves files reliably, but "orphaned" files (aborted requests or application logic errors) can accumulate. Implement a `cron` job to clean up temporary files older than 24 hours.

```bash
# Example Cron task
find /var/lib/xypriss/uploads -type f -mmin +1440 -delete
```

## 5. Error Handling Architecture

Professional systems handle upload errors gracefully without exposing technical details to the client.

```typescript
app.use((err: any, req: any, res: any, next: any) => {
    if (err.name === "FileUploadError") {
        return res.status(400).json({
            error: "Upload failed",
            reason: err.message, // e.g., "Extension not allowed"
        });
    }
    next(err);
});
```

---

_By following this guide, you ensure that your XyPriss application is secure, performant, and ready for enterprise-grade file handling._

