# XyPriss Security - Advanced Features Documentation

This document describes the high-performance security features integrated into the XyPriss Security framework.

## 1. Large File Encryption (Chunked AEAD)

The framework supports stream-based encryption for files of any size. By using a chunked AES-256-GCM approach, it maintains a low memory footprint while providing authenticated encryption.

### API Reference

**Available via**: `Keys`, `Cipher.crypto`

#### .encryptFile

Encrypts a file from a source path to a destination path.

- **Parameters**:
  - `inputPath` (string): Absolute path to the source file.
  - `outputPath` (string): Absolute path where the encrypted file will be saved.
  - `key` (string): The secret key or password used for encryption.
  - `options` (any, optional): Strategy configuration (algorithm, iterations).

#### .decryptFile

Decrypts a previously encrypted file.

- **Parameters**:
  - `inputPath` (string): Absolute path to the encrypted source file.
  - `outputPath` (string): Absolute path where the decrypted file will be saved.
  - `key` (string): The secret key or password used for decryption.

### Usage Example

```typescript
import { Cipher } from "xypriss-security";

// Encrypting via Cipher API
await Cipher.crypto.encryptFile(
  "report.pdf",
  "report.pdf.enc",
  "secure-password",
);

// Decrypting via Cipher API
await Cipher.crypto.decryptFile(
  "report.pdf.enc",
  "report-restored.pdf",
  "secure-password",
);
```

---

## 2. Secure Random Selection

The `Random` class provides cryptographically secure selection from data sets.

### API Reference

**Available via**: `Random`, `Cipher.crypto`, `Cipher.random`

#### .pick<T>

Selects a random item from an array using the Go-backed secure random number generator.

- **Parameters**:
  - `arr` (T[]): An array of elements to choose from.
- **Returns**: A single element of type T.

### Usage Example

```typescript
import { Cipher } from "xypriss-security";

const servers = ["node-1", "node-2", "node-3"];
const selectedServer = Cipher.crypto.pick(servers);
```

---

## 3. Constant-Time Comparison

To prevent timing attacks during sensitive operations, a constant-time comparison utility is available.

### API Reference

**Available via**: `Hash`, `Cipher.hash`

#### .timingSafeEqual

Compares two Uint8Array buffers in constant time.

- **Parameters**:
  - `a` (Uint8Array): First buffer.
  - `b` (Uint8Array): Second buffer.
- **Returns**: `boolean` indicating if the buffers are identical.

### Usage Example

```typescript
import { Cipher } from "xypriss-security";

const isValid = Cipher.hash.timingSafeEqual(inputBuffer, storedBuffer);
```

---

## 4. Performance Metrics

Average performance measured on a 50MB binary file:

- **Encryption**: ~800ms
- **Decryption**: ~500ms
- **Memory Overhead**: Constant (< 10MB additional heap usage regardless of file size).
