# Disposable Temporary Files (`__sys__.fs.writeTempFile` / `writeTmpFile`)

## Overview

XyPriss provides a built-in, native disposable temporary file system integrated into the `__sys__.fs` module. It allows developers to create short-lived scratch files (PDF exports, image conversions, temporary session tokens, upload buffers) with **zero-config automatic cleanup**.

All temporary files created via this API are stored within the isolated user directory (`__sys__.fs.tmpUserDir`) and are automatically cleaned up when:
1. **TTL Timeout Expires**: An optional TTL (Time-To-Live) duration (e.g. `"5m"`, `"1h"`, `"30s"`) automatically triggers background deletion on disk.
2. **Server Reload / Process Exit**: All tracked temporary files are automatically unlinked on process exit (`exit`, `SIGINT`, `SIGTERM`) or server refresh.
3. **Manual On-Demand Cleanup**: Developers can trigger `.cleanup()` or `.remove()` on the returned file handle to delete the file immediately when done.

> [!NOTE]
> **Zero Node.js Dependency**
> Under the hood, the temporary file manager relies 100% on the native XyPriss system API (`getSysApi() via XHSC`). Path resolution, directory creation, file writing, statistics, and deletion are handled directly by the XHSC native binary without relying on Node.js `node:fs` or `node:path`.

---

## API Reference

Developers can use the dedicated sub-namespace **`__sys__.fs.tmp`** or the direct shorthand methods on `__sys__.fs`.

### 1. Sub-API Namespace (`__sys__.fs.tmp`)

- `__sys__.fs.tmp.write(content, options?): Promise<TempFileResult>` — Write temporary file (async).
- `__sys__.fs.tmp.writeSync(content, options?): TempFileResult` — Write temporary file (sync).
- `__sys__.fs.tmp.read(path): Promise<string>` — Read temporary file (async).
- `__sys__.fs.tmp.readSync(path): string` — Read temporary file (sync).
- `__sys__.fs.tmp.remove(path): boolean` — Remove a specific temporary file on disk.
- `__sys__.fs.tmp.dir: string` — Access the isolated user temporary directory (`tmpUserDir`).
- `__sys__.fs.tmp.cleanup(): number` / `purge(): number` — Purge all active temporary files in current session.

### 2. Direct Shorthand Methods (`__sys__.fs`)

- `__sys__.fs.writeTempFile(content, options?): Promise<TempFileResult>`
- `__sys__.fs.writeTempFileSync(content, options?): TempFileResult`
- **Aliases**: `createTempFile`, `createTempFileSync`, `writeTmpFile`, `writeTmpFileSync`
- `__sys__.fs.cleanupTempFiles(): number`

---

## Configuration Options (`TempFileOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `prefix` | `string` | `"tmp_"` | Optional filename prefix. |
| `extension` | `string` | `".xtmp"` | File extension or suffix (e.g., `".json"`, `".pdf"`, `".txt"`). |
| `suffix` | `string` | — | Alias for `extension`. |
| `filename` | `string` | — | Custom exact filename. Overrides automatic prefix/suffix generation. |
| `ttl` | `number \| string` | `0` | Expiration time before automatic background deletion. Accepts ms (e.g. `60000`) or human-readable strings (`"30s"`, `"5m"`, `"1h"`, `"1d"`). |
| `autoCleanupOnExit` | `boolean` | `true` | If `true`, automatically unlinks the file when the process exits or restarts. |

---

## Return Handle (`TempFileResult`)

The method returns an object containing file metadata and cleanup functions:

```typescript
interface TempFileResult {
    /** Absolute path to the created temporary file inside tmpUserDir */
    path: string;
    /** Filename of the temporary file */
    filename: string;
    /** Size of the temporary file in bytes */
    size: number;
    /** Timestamp when the file was created (in ms) */
    createdAt: number;
    /** Expiration timestamp in ms (or null if no TTL) */
    expiresAt: number | null;
    /** Manually deletes the temporary file immediately. Returns true if deleted. */
    remove: () => boolean;
    /** Alias for remove() */
    cleanup: () => boolean;
}
```

---

## Code Examples

### 1. Temporary PDF Export with 5-Minute TTL

```typescript
import { __sys__ } from "xypriss";

// Create a disposable PDF report expiring in 5 minutes
const report = await __sys__.fs.writeTempFile(pdfBuffer, {
    prefix: "financial_report_",
    extension: ".pdf",
    ttl: "5m",
});

console.log(`Temporary PDF generated at: ${report.path}`);
// Deliver to client or pipeline...
// Will be automatically unlinked after 5 minutes or on server restart.
```

### 2. Immediate On-Demand Cleanup

```typescript
import { __sys__ } from "xypriss";

const tmp = __sys__.fs.writeTmpFileSync(JSON.stringify(payload), {
    prefix: "cache_",
    extension: ".json",
});

try {
    // Process payload...
} finally {
    // Ensure immediate deletion as soon as processing completes
    tmp.cleanup();
}
```

### 3. Session Scratch Space with Shorthand Alias

```typescript
import { __sys__ } from "xypriss";

const scratch = await __sys__.fs.createTempFile("temporary log data", {
    prefix: "user_session_",
    extension: ".log",
    ttl: "1h",
});
```

---

## Best Practices

- **Use Human-Readable TTLs**: Use intuitive strings like `"30s"`, `"10m"`, `"2h"` for easy maintenance.
- **Rely on Exit Cleanup**: For short-lived request buffers, leave `autoCleanupOnExit: true` (default) so that crash or server reload sweeps away orphan files automatically.
- **Call `cleanup()` in `finally` Blocks**: For immediate cleanup of large files (e.g. video rendering or image processing), invoke `tmp.cleanup()` in a `try...finally` block to free disk space immediately.
