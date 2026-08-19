# MIME Utilities (`getMime` & `getMimes`)

XyPriss provides high-performance, built-in MIME resolution utilities (`getMime` and `getMimes`) exported directly from the core package. These helpers eliminate the need for third-party packages (like `mime-types`) and simplify server configuration—especially when configuring allowed file formats for native file uploads.

---

## 1. Exported API Reference

```typescript
import { getMime, getMimes } from "xypriss";
```

### `getMime(ext: string): string`

Resolves a single MIME type string from a file extension.

* **Normalizing**: Handles leading dots automatically (e.g., `.png` and `png` yield the same result) and is case-insensitive.
* **Fallback**: Returns `'application/octet-stream'` if the extension is unknown or empty.

```typescript
import { getMime } from "xypriss";

console.log(getMime(".png"));  // Output: "image/png"
console.log(getMime("jpg"));   // Output: "image/jpeg"
console.log(getMime(".WEBP")); // Output: "image/webp"
console.log(getMime(".pdf"));  // Output: "application/pdf"
console.log(getMime(".unknown")); // Output: "application/octet-stream"
```

---

### `getMimes(extensions?: string | string[]): string[]`

Resolves multiple MIME types into a deduplicated array. It accepts a single extension string, an array of extensions, or no parameters.

#### Features
1. **Array or Single String**: Accepts `".png"` or `[".jpg", ".png", ".webp"]`.
2. **Deduplication**: Automatically removes duplicate MIME results (e.g., `.jpg` and `.jpeg` both resolve to `image/jpeg` once).
3. **Automatic Framework Fallback**: If called without arguments (`getMimes()`), it reads `fileUpload.allowedExtensions` from the global XyPriss configuration (`Configs`).

```typescript
import { getMimes } from "xypriss";

// 1. Array of extensions
const mimes = getMimes([".jpg", ".jpeg", ".png", ".svg"]);
// Result: ["image/jpeg", "image/png", "image/svg+xml"]

// 2. Single extension string
const pdfMime = getMimes(".pdf");
// Result: ["application/pdf"]

// 3. Fallback mode (reads global fileUpload.allowedExtensions)
const configMimes = getMimes();
```

---

## 2. Combining with File Upload Configurations

The primary use case for `getMimes` is configuring the native XHSC file upload engine (`fileUpload`). Developers can specify simple file extensions instead of maintaining manual MIME type strings.

### A. Single Server Configuration

Pass `getMimes` directly into your `fileUpload.allowedMimeTypes` server configuration:

```typescript
import { createServer, getMimes } from "xypriss";

const app = createServer({
    fileUpload: {
        enabled: true,
        destination: "./public/cdn",
        maxFileSize: 15 * 1024 * 1024, // 15MB
        // Explicitly map extensions to MIME types for XHSC native enforcement
        allowedMimeTypes: getMimes([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]),
        useTempFiles: true,
        tempFileDir: "/tmp/cdn_uploads",
    },
});
```

---

### B. Automatic Resolution with `allowedExtensions`

XyPriss natively bridges `allowedExtensions` to `allowedMimeTypes`. When you define `allowedExtensions` in your server or `MultiServerConfig`, XyPriss uses `getMimes` under the hood to resolve and pass `--upload-allowed-mimes` to the native Go core (XHSC):

```typescript
// cdn.server.ts (MultiServerConfig)
import { MultiServerConfig, __sys__ } from "xypriss";

export const cdnServer: MultiServerConfig = {
    port: 4001,
    id: "cdn-server",
    fileUpload: {
        enabled: true,
        destination: __sys__.path.resolve("public", "cdn"),
        // Declaring allowedExtensions automatically invokes getMimes() during XHSC startup
        allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"],
        useTempFiles: true,
        tempFileDir: __sys__.path.tmpUserDir + "/cdn/",
        maxFileSize: 15 * 1024 * 1024,
    },
    server: {},
};
```

---

### C. Dynamic Controller / Route Validation

You can also use `getMime` or `getMimes` inside custom route handlers or middleware to validate incoming uploaded file metadata:

```typescript
import { Router, Upload, getMimes } from "xypriss";

const router = Router();
const ALLOWED_MIMES = getMimes([".png", ".jpg", ".webp"]);

router.post("/api/avatar", Upload.single("file"), (req, res) => {
    const file = (req as any).file;
    
    if (!file || !ALLOWED_MIMES.includes(file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type uploaded" });
    }

    res.success({ filename: file.filename, size: file.size });
});
```

---

## 3. Supported Extensions & MIME Mapping

The built-in `MIME_MAP` supports all standard web extensions, including:
- **Images**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`, `.ico`, `.avif`, `.bmp`, `.tiff`
- **Documents**: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.csv`
- **Audio/Video**: `.mp3`, `.wav`, `.ogg`, `.mp4`, `.webm`, `.mkv`
- **Archives & Code**: `.zip`, `.tar`, `.gz`, `.json`, `.xml`, `.html`, `.css`, `.js`

---

[← Back to File Upload Documentation](./file-upload.md)
