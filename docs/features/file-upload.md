# High-Performance File Uploads (Go-Native)

XyPriss features a high-performance file upload system powered by its Go engine (`XHSC`). By offloading `multipart/form-data` parsing and disk I/O to a native binary, XyPriss ensures your Node.js event loop remains unblocked, providing superior scalability and reduced memory overhead compared to traditional libraries.

## 1. Zero-Config Architecture

XyPriss 6.0 introduces a **Lazy Initialization** system. You no longer need to manually call `.initialize()` in most cases. The system will automatically configure itself using the global `Configs` singleton the first time a middleware is requested.

### Configuration

Customize the upload behavior in your server options. You can use the `getMimes` helper to automatically generate the list of authorized MIME types from simple file extensions.

```typescript
import { createServer, getMimes } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        destination: "./uploads/storage",
        // Automatically injects: ['image/jpeg', 'image/png', 'application/pdf']
        allowedMimeTypes: getMimes([".jpg", ".png", ".pdf"]),
        useSubDir: true,
    },
});
```

---

---

## 2. Universal Middleware API (Modular)

While `app.upload` is available after initialization, XyPriss encourages the use of the standalone `Upload` API or the `Router.upload` getter for better modularity, especially in **MultiServer** environments to avoid "app not initialized" errors.

### Using Standalone API (Recommended)

```typescript
import { Upload } from "xypriss";

// Direct middleware usage
router.post("/api/user/avatar", Upload.single("avatar"), (req, res) => {
    const file = (req as any).file;
    res.json({ url: `/cdn/${file.originalname}` });
});
```

### Using Router Instance

Modular routers now expose the upload API directly:

```typescript
import { Router } from "xypriss";
const router = Router();

// router.upload is an alias to the global Upload instance
router.post("/upload", router.upload.single("file"), (req, res) => {
    res.success("File received");
});
```

---

## 3. Upload Methods

The `FileUploadAPI` provides standard methods that integrate seamlessly into any route.

### Multi-Field Upload (Native Support)

Efficiently handle multiple fields with different constraints in a single request:

```typescript
app.post(
    "/api/product/create",
    app.upload.fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "gallery", maxCount: 10 },
    ]),
    (req, res) => {
        const files = (req as any).files;
        // files["thumbnail"] and files["gallery"] are available
        res.success("Product assets uploaded");
    },
);
```

### Array Upload (Same Field)

```typescript
app.post("/api/gallery", app.upload.array("images", 20), (req, res) => {
    const files = (req as any).files;
    res.json({ uploadedCount: files.length });
});
```

---

## 3. Secure Metadata Reference

Files uploaded via XHSC are mapped to the following structure:

| Property       | Description                                         |
| :------------- | :-------------------------------------------------- |
| `fieldname`    | The name of the HTML form field.                    |
| `originalname` | The original filename provided by the client.       |
| `mimetype`     | The MIME type (verified by the engine).             |
| `size`         | The size of the file in bytes.                      |
| `path`         | The absolute path where the file is securely saved. |

---

## 4. Security & Robustness

- **Stream Interception**: The Go engine terminates connections immediately if a file exceeds the `maxFileSize` before reading the entire stream.
- **Traversal Protection**: Filenames are sanitized and paths are strictly validated against the target `destination`.
- **Atomic Writes**: Files are written using atomic operations to prevent corruption during high concurrency.

---

[← Back to API Reference](../core/api-reference.md)

