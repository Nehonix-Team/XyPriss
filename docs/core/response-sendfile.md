# Native Binary Streaming (sendFile)

The `res.sendFile(filePath)` method is the enterprise-standard utility for serving physical assets within the XyPriss framework. It leverages the **XHSC (Hyper-System Core)** native engine to stream binary data directly from the filesystem to the network socket, bypassing the Node.js/V8 heap to ensure minimal memory footprint and maximum throughput.

## Advanced Architecture

Unlike conventional web frameworks that buffer file content into the JavaScript heap—leading to significant latency and GC pressure—XyPriss implements a **Zero-Copy Ranged Streaming** architecture:

1.  **Native Resolution**: The path is rigorously validated using the native `__xhsc__.fs` subsystem, protecting against directory traversal attacks.
2.  **MIME-Type Intelligence**: Headers are automatically calculated based on the internal `MIME_MAP`, ensuring browser-compliant delivery of all major asset classes.
3.  **Ranged Delivery**: Full support for HTTP `Range` headers. The Go engine performs native `lseek(2)` and `copy_file_range(2)` operations to serve partial content efficiently, which is essential for video seek operations and large-scale asset delivery.
4.  **Low Memory Impact**: Even with massive files (multi-gigabyte), the Node.js process RSS (Resident Set Size) remains stable as the data flows through a dedicated native IPC bridge.

## Implementation Examples

### Standard Asset Delivery
Serve documents or images with automatic MIME-type resolution and caching headers.

```typescript
import { XyPrisRequest, XyPrisResponse } from "xypriss";

export const getReport = (req: XyPrisRequest, res: XyPrisResponse) => {
    // Determine the absolute path using the system variables
    const storageRoot = __xhsc__.vars.get("__root__");
    const reportPath = __xhsc__.path.join(storageRoot, "storage", "reports", "annual.pdf");

    // Serve with 'Content-Type: application/pdf'
    // Handles conditional requests (ETags/Last-Modified) automatically
    res.sendFile(reportPath);
};
```

### Media Streaming with Seek Support
Because `res.sendFile` supports Range requests natively, it is the ideal choice for streaming video content directly to modern browsers.

```typescript
app.get("/media/video/:id", (req, res) => {
    const videoPath = __xhsc__.path.resolve("./assets/media/demo.mp4");
    
    // Automatically handles byte-range requests (e.g., Range: bytes=1024-2048)
    // allowing users to seek through the video without downloading the whole file.
    res.sendFile(videoPath);
});
```

## Security & Reliability

- **Path Sanitization**: `res.sendFile` automatically normalizes paths to prevent `../` traversal exploitations.
- **Error Resilience**: If the file is inaccessible or significantly corrupted, the framework dispatches a 404 or 500 status before headers are flushed to ensure client-side consistency.
- **MIME Coverage**: Natively handles over 50+ extensions including Pro-grade formats: `.webp`, `.mp4`, `.zip`, `.svg`, `.jsonc`.

---

> [!IMPORTANT]
> Always provide an **absolute path** to `res.sendFile`. Use `__xhsc__.path.resolve` or `__xhsc__.path.join` to ensure platform-independent path construction.

