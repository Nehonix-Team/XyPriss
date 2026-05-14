# XyPriss Security — Complete Reference

XyPriss Security is an enterprise-grade cryptographic framework for TypeScript and JavaScript environments. It uses a high-performance Go-based core engine compiled as a static, dependency-free CLI binary to deliver military-grade security with cross-platform reliability.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Modules](#modules)
   - [Core](#core-module)
   - [Encryption](#encryption-module)
   - [Cache (UFSIMC)](#cache-module)
   - [RSA and Byte Utilities](#rsa-and-byte-utilities)
   - [Utilities](#utilities-module)
5. [Type Reference](#type-reference)
6. [Performance Benchmarks](#performance-benchmarks)

---

## Core Principles

- **Performance**: Optimized execution via lightweight process spawning, bypassing JavaScript cryptographic overhead without CGO complexity.
- **Universal Portability**: Zero native compilation required. Statically linked pure Go binaries run on Linux, Windows, and macOS (amd64/arm64).
- **Modern Standards**: Native support for AES-256-GCM, Argon2id, PBKDF2, HKDF, RSA-OAEP, RSA-PSS, and Post-Quantum algorithms (Kyber-768).
- **Security by Default**: Automatic memory sanitization and secure key derivation patterns.
- **Zero-Config Installation**: Automatically downloads the correct pre-built binary for the current platform during installation.

---

## Installation

```bash
xfpm add xypriss-security
```

---

## Quick Start

### Random Generation and Hashing

```typescript
import { Cipher } from "xypriss-security";

// Generate 32 secure random bytes
const bytes = Cipher.random.getRandomBytes(32);
console.log(bytes.toString("hex"));

// Generate a secure integer in range [1000, 9999]
const pin = Cipher.random.Int(1000, 9999);

// Generate a structured API key
const apiKey = Cipher.XSec.generateAPIKey({ prefix: "sk_live" });

// SHA-256 hash
const digest = Cipher.hash.create("sensitive-payload");

// PKCE Code Challenge for OAuth2
const challenge = Cipher.hash.pkce("verifier-string-123");

// PBKDF2 key derivation
const derivedKey = await Cipher.hash.create("my-password", {
  algorithm: "pbkdf2",
  iterations: 200000,
  salt: "unique-salt-string",
});
```

### Password Hashing (Argon2id)

```typescript
import { pm } from "xypriss-security";

const passwords = new pm({
  memoryCost: 65536,
  parallelism: 4,
});

const hash = await passwords.hash("user-password-123");
const isValid = await passwords.verify("user-password-123", hash);
const alreadyHashed = passwords.isHashed(hash); // true
```

### RSA Asymmetric Cryptography

```typescript
import { generateRSAKeyPair, rsaSign, rsaVerify, rsaEncrypt, rsaDecrypt } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();

const signature = await rsaSign(privateKey, "critical-payload");
const isValid = await rsaVerify(publicKey, "critical-payload", signature);

const encrypted = await rsaEncrypt(publicKey, "short-secret");
const decrypted = await rsaDecrypt(privateKey, encrypted);
```

### Secure Caching

```typescript
import { Cache } from "xypriss-security";

await Cache.set("session:88", { role: "admin", permissions: ["*"] }, { ttl: 3600 });
const session = await Cache.get("session:88");
```

---

## Modules

---

## Core Module

The Core module provides foundational cryptographic primitives and binary handling, powered by the native Go engine.

### Cipher (Compatibility Entry Point)

A unified entry point aggregating all core modules for convenience and backward compatibility.

**Static Properties:**

- `hash` — Re-exports the `Hash` class.
- `random` — Re-exports the `Random` class.
- `crypto` — Alias for the `Random` class.
- `XSec` — Re-exports the `XyPrissSecurity` class.

```typescript
import { Cipher } from "xypriss-security";

const bytes = Cipher.random.getRandomBytes(32);
const digest = Cipher.hash.create("data");
const apiKey = Cipher.XSec.generateAPIKey();
```

---

### Hash

High-performance hashing, HMAC, and PBKDF2 operations.

#### `Hash.create(input, options?)`

Creates a secure hash or derived key.

**Parameters:**

- `input`: `string | Uint8Array`
- `options.algorithm`: `"sha256" | "sha512" | "pbkdf2" | "argon2id"` (Default: `"sha256"`)
- `options.iterations`: `number` — For PBKDF2 (Default: 100,000)
- `options.outputFormat`: `"hex" | "base64" | "buffer"` (Default: `"hex"`)

**Returns:** `string | SecureBuffer`

```typescript
import { Hash } from "xypriss-security";

const hexHash = Hash.create("message");

const key = Hash.create("password", {
  algorithm: "pbkdf2",
  iterations: 210000,
  outputFormat: "buffer",
});
```

#### `Hash.pkce(verifier, method?)`

Generates a PKCE code challenge.

**Parameters:**

- `verifier`: `string`
- `method`: `"S256" | "plain"` (Default: `"S256"`)

**Returns:** `string` (Base64Url encoded)

---

### Random

Cryptographically secure random generation.

#### `Random.Int(minOrMax, max?)`

Generates a secure random integer.

- `Random.Int(100)` — Range [0, 100)
- `Random.Int(50, 150)` — Range [50, 150)

#### `Random.generateToken(length?, options?)`

Generates a secure alphanumeric token. Supports character set constraints and similarity filtering.

---

### PasswordManager (`pm`)

Instance-based secure password management supporting hashing, verification, and generation. Exported as `PasswordManager` and aliased as `pm`.

#### Initialization

```typescript
import { pm } from "xypriss-security";

const passwords = new pm({
  algorithm: "argon2id",
  memoryCost: 65536,
  parallelism: 4,
  iterations: 3,
  pepper: "optional-secret-pepper",
});
```

#### `passwords.hash(password, overrides?)`

Hashes a password with memory-hard parameters.

**Returns:** `Promise<string>` (Argon2id PHC string)

#### `passwords.verify(password, hash)`

Verifies a plain-text password against a stored hash.

**Returns:** `Promise<boolean>`

#### `passwords.generate(options?)`

Generates a cryptographically secure random password.

**Options:**

- `length`: `number` (Default: 20)
- `uppercase`, `lowercase`, `numbers`, `symbols`: `boolean` (Default: `true`)
- `excludeSimilar`: `boolean` (Default: `false`)

#### `passwords.generatePassphrase(options?)`

Generates a memorable, high-entropy passphrase using the EFF wordlist.

**Options:**

- `wordCount`: `number` (Default: 5)
- `separator`: `string` (Default: `"-"`)

#### `passwords.strength(password)`

Evaluates password strength. Returns a score (0–100), label, and actionable suggestions.

#### `passwords.isHashed(hash, strict?)`

Checks whether a string is a valid XyPriss hash.

- `strict` (Default: `true`): When `true`, validates against the instance's configured algorithm. Set to `false` to accept any valid XyPriss hash.

**Returns:** `boolean`

```typescript
const passwords = new pm({ algorithm: "argon2id" });
const hash = await passwords.hash("user-password");

passwords.isHashed(hash);          // true (strict: argon2id)
passwords.isHashed("plaintext");   // false
passwords.isHashed(hash, false);   // true (any valid XyPriss hash)
```

---

### SecureBuffer

Enhanced `Uint8Array` with encoding methods optimized for security contexts.

#### `secureBuffer.toString(encoding?)`

Converts binary data to a string. Supported encodings: `hex`, `base64`, `utf8`, `binary`.

```typescript
import { Random } from "xypriss-security";

const data = Random.getRandomBytes(32);
console.log(data.toString("base64"));
console.log(data.toString("binary"));
```

---

### XyPrissSecurity (XSec)

General framework utilities for environment and key management.

#### `XyPrissSecurity.generateAPIKey(options?)`

Generates a structured API key.

**Options:**

- `prefix`: `string` (Default: `"xy"`)
- `includeTimestamp`: `boolean` (Default: `true`)
- `randomPartLength`: `number` (Default: 32)

#### `XyPrissSecurity.getByteLength(str)`

Returns the actual UTF-8 byte count of a string.

**Returns:** `number`

#### `XyPrissSecurity.isValidByteLength(str, expectedLength)`

Verifies that a string has exactly the specified number of UTF-8 bytes.

**Returns:** `boolean`

```typescript
import { XyPrissSecurity } from "xypriss-security";

XyPrissSecurity.getByteLength("caf\u00e9");                          // 5
XyPrissSecurity.isValidByteLength("32-byte-key-for-aes-256-exactly", 32); // true
```

---

## Encryption Module

High-level encryption services for persistent data protection.

### EncryptionService

A production-grade encryption utility with automated salt management and binary sanitization.

#### `EncryptionService.encrypt(data, key, options?)`

Encrypts serializable data into a versioned JSON package.

**Parameters:**

- `data`: `any`
- `key`: `string` — Master passphrase (minimum 8 characters)
- `options.algorithm`: `"aes-256-gcm" | "chacha20-poly1305"` (Default: `"aes-256-gcm"`)
- `options.keyDerivationIterations`: `number` (Default: 100,000)
- `options.quantumSafe`: `boolean` — If `true`, forces ChaCha20-Poly1305

**Returns:** `Promise<string>` (Stringified JSON package)

```typescript
import { EncryptionService } from "xypriss-security";

const secret = await EncryptionService.encrypt({ pin: 1234 }, "my-safe-key");
```

#### `EncryptionService.decrypt(encryptedData, key)`

Decrypts a package generated by `encrypt`.

**Parameters:**

- `encryptedData`: `string`
- `key`: `string`

**Returns:** `Promise<any>`

#### `EncryptionService.generateSessionKey()`

Generates a secure 256-bit session key in hexadecimal format.

**Returns:** `string`

#### `EncryptionService.verifyIntegrity(encryptedData)`

Validates the encrypted package format without decrypting.

**Returns:** `boolean`

#### `EncryptionService.getMetadata(encryptedData)`

Extracts version and algorithm info from a package.

**Returns:** `{ algorithm: string, timestamp: number, version: string }`

---

## Cache Module

The Ultra-Fast Secure In-Memory Cache (UFSIMC) provides high-performance encrypted caching with low-latency operations and memory efficiency.

### UFSIMC

#### Constructor

```typescript
new UFSIMC(maxEntries?: number, logger?: Logger)
```

**Parameters:**

- `maxEntries`: `number` (Default: 10,000)
- `logger`: `Logger` (Optional)

---

#### `Cache.set(key, value, options?)`

Stores a value in the cache with automatic encryption and optional compression.

**Parameters:**

- `key`: `string`
- `value`: `any`
- `options.ttl`: `number` — Time-to-live in milliseconds
- `options.priority`: `number` (1–10, Default: 5) — Higher priority entries are less likely to be evicted
- `options.tags`: `string[]` — Logical groups for mass invalidation
- `options.skipCompression`: `boolean`
- `options.skipEncryption`: `boolean`
- `options.metadata`: `Record<string, any>`

**Returns:** `Promise<boolean>`

```typescript
import { Cache } from "xypriss-security";

await Cache.set("user:123", { name: "John" }, {
  ttl: 3600000,
  priority: 8,
  tags: ["users"],
});
```

#### `Cache.get(key)`

Retrieves and decrypts data from the cache.

**Returns:** `Promise<any | null>`

#### `Cache.delete(key)`

Removes an entry from the cache.

**Returns:** `boolean`

#### `Cache.has(key)`

Checks if an entry exists and has not expired.

**Returns:** `boolean`

#### `Cache.clear()`

Removes all entries from the cache.

#### `Cache.invalidateByTags(tags)`

Invalidates all entries associated with the specified tags.

**Parameters:** `tags`: `string[]`

**Returns:** `number` (count of removed entries)

#### `Cache.getUltraStats`

Returns real-time performance metrics as a `CacheStats` object.

```typescript
const stats = Cache.getUltraStats;
console.log(stats.hitRate);
console.log(stats.memoryUsage.used);
```

---

## RSA and Byte Utilities

RSA asymmetric cryptography primitives and byte-length validation utilities. All operations are powered by the Go security core.

### RSA Key Management

#### `generateRSAKeyPair()`

Generates a 4096-bit RSA key pair using a cryptographically secure random source.

**Returns:** `Promise<{ publicKey: string; privateKey: string }>`

- Keys are PEM-encoded. `publicKey` uses `PUBLIC KEY` format; `privateKey` uses PKCS#1 `RSA PRIVATE KEY` format.
- Key size is fixed at 4096 bits, providing a minimum security level of 140 bits.
- This is a CPU-intensive operation. Generate keys once, persist them securely, and reuse across sessions.

```typescript
import { generateRSAKeyPair } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();
```

Also available via the `Keys` class:

```typescript
import { Keys } from "xypriss-security";

const keyPair = await Keys.generateRSAKeyPair();
```

---

### RSA Signatures (RSA-PSS)

XyPriss uses RSA-PSS with SHA-256. PSS is the modern, secure successor to the deterministic PKCS#1 v1.5 scheme and includes random salting, making each signature unique even for identical inputs.

#### `rsaSign(privateKey, data)`

Signs arbitrary data using the RSA private key.

**Parameters:**

- `privateKey`: PEM-encoded RSA private key
- `data`: `string`

**Returns:** `Promise<string>` (hex-encoded RSA-PSS signature)

#### `rsaVerify(publicKey, data, signature)`

Verifies a previously computed RSA-PSS signature.

**Parameters:**

- `publicKey`: PEM-encoded RSA public key
- `data`: `string` — The original signed data
- `signature`: `string` — Hex-encoded signature from `rsaSign`

**Returns:** `Promise<boolean>`

```typescript
import { generateRSAKeyPair, rsaSign, rsaVerify } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();
const data = "critical-system-payload";

const signature = await rsaSign(privateKey, data);
const isValid = await rsaVerify(publicKey, data, signature);
console.log(isValid); // true
```

---

### RSA Encryption (RSA-OAEP)

XyPriss uses RSA-OAEP with SHA-256. OAEP is the recommended, provably secure RSA encryption scheme.

> **Note:** RSA encryption is not designed for large payloads. For arbitrary-length data, use hybrid encryption: generate a symmetric AES key, encrypt the payload with it, then encrypt the AES key with RSA. See the Encryption module for the full hybrid API.

Maximum plaintext size for a 4096-bit key with SHA-256: 446 bytes.

#### `rsaEncrypt(publicKey, data)`

Encrypts a data string using the RSA public key.

**Parameters:**

- `publicKey`: PEM-encoded RSA public key
- `data`: `string`

**Returns:** `Promise<string>` (hex-encoded ciphertext)

#### `rsaDecrypt(privateKey, encryptedHex)`

Decrypts RSA-OAEP ciphertext using the RSA private key.

**Parameters:**

- `privateKey`: PEM-encoded RSA private key
- `encryptedHex`: `string` — Hex ciphertext from `rsaEncrypt`

**Returns:** `Promise<string>` (plaintext)

```typescript
import { generateRSAKeyPair, rsaEncrypt, rsaDecrypt } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();
const encrypted = await rsaEncrypt(publicKey, "secret-value");
const decrypted = await rsaDecrypt(privateKey, encrypted);
console.log(decrypted); // "secret-value"
```

---

### Byte Length Utilities

JavaScript's `.length` property returns the character count, not the byte count. For multi-byte Unicode characters (emoji, Arabic, CJK), these differ significantly. The following utilities return the actual UTF-8 byte count as computed by the Go runtime, which is critical for operations with strict byte-length requirements (e.g., AES-256-GCM requires exactly 32 bytes).

#### `getByteLength(str)`

Returns the UTF-8 byte length of a string.

**Returns:** `number`

```typescript
import { getByteLength } from "xypriss-security";

getByteLength("hello");      // 5   (ASCII: 1 byte per char)
getByteLength("caf\u00e9"); // 5   (é = 2 bytes in UTF-8)
getByteLength("你好");        // 6   (3 bytes per CJK character)
```

Also available via `XyPrissSecurity.getByteLength(str)`.

#### `isValidByteLength(str, expectedLength)`

Verifies whether a string has exactly the expected number of UTF-8 bytes.

**Returns:** `boolean`

```typescript
import { isValidByteLength } from "xypriss-security";

const keyCandidate = "my-passphrase-of-exactly-32byte";

if (!isValidByteLength(keyCandidate, 32)) {
  throw new Error("Key material does not meet the 32-byte requirement.");
}
```

Also available via `XyPrissSecurity.isValidByteLength(str, length)`.

---

### Key Derivation

#### `deriveKey(input, options?)`

Derives a cryptographically strong key from a secret using a configurable KDF.

**Parameters:**

- `input`: `string | Uint8Array`
- `options.algorithm`: `"argon2id" | "pbkdf2" | "hkdf" | "scrypt"` (Default: `"argon2id"`)
- `options.iterations`: `number`
- `options.keyLength`: `number` — Output length in bytes
- `options.salt`: `string | Uint8Array`
- `options.digest`: `"sha256" | "sha512"` — Hash function for PBKDF2
- `options.info`: `string` — Context info for HKDF

**Returns:** `Promise<string>` (hex-encoded derived key)

```typescript
import { deriveKey } from "xypriss-security";

const key = await deriveKey("user-supplied-passphrase", {
  algorithm: "pbkdf2",
  iterations: 310000,
  keyLength: 32,
  salt: "unique-per-user-salt",
});
```

---

## Utilities Module

Foundational helpers for encoding, decoding, and byte manipulation.

### Encoding Functions

| Function | Description |
|---|---|
| `bufferToHex(buffer, uppercase?, separator?)` | Converts `Uint8Array` to hex string |
| `hexToBuffer(hex)` | Converts hex string to `Uint8Array` |
| `bufferToBase64(buffer, urlSafe?)` | Converts `Uint8Array` to Base64 |
| `base64ToBuffer(base64, urlSafe?)` | Converts Base64 to `Uint8Array` |
| `stringToBuffer(str)` | Converts UTF-8 string to `Uint8Array` |
| `bufferToString(buffer)` | Converts `Uint8Array` to UTF-8 string |

### Unified Utils Interface

The `Utils` object provides a consolidated entry point for common operations.

| Method | Description |
|---|---|
| `Utils.hash(data, options?)` | Alias for `Hash.create` |
| `Utils.getRandomBytes(length)` | Alias for `Random.getRandomBytes` |
| `Utils.encrypt(data, key, algo?)` | Quick string-to-string encryption (AES/ChaCha20) |
| `Utils.decrypt(encrypted, key, algo?)` | Quick string-to-string decryption |

```typescript
import { Utils } from "xypriss-security";

const bytes = Utils.getRandomBytes(16);
const hex = Utils.hash("test");
```

---

## Type Reference

### HashOptions

Used in `Hash.create`.

| Field | Type | Description |
|---|---|---|
| `algorithm` | `string` | e.g., `"sha256"` |
| `outputFormat` | `"hex" \| "base64" \| "buffer" \| "uint8array"` | Output format |
| `iterations` | `number` | For KDF algorithms |
| `salt` | `string \| Uint8Array` | Salt value |

---

### SecureTokenOptions

Used in `Random.generateToken`.

| Field | Type | Description |
|---|---|---|
| `length` | `number` | Token length |
| `includeUppercase` | `boolean` | |
| `includeLowercase` | `boolean` | |
| `includeNumbers` | `boolean` | |
| `includeSymbols` | `boolean` | |
| `excludeSimilarCharacters` | `boolean` | |

---

### PasswordHashOptions

Used in `PasswordManager` configuration.

| Field | Type | Description |
|---|---|---|
| `algorithm` | `"argon2id" \| "scrypt" \| "pbkdf2"` | |
| `iterations` | `number` | |
| `memoryCost` | `number` | Argon2 only |
| `timeCost` | `number` | Argon2 only |

---

### UltraCacheOptions

Used in `Cache.set`.

| Field | Type | Description |
|---|---|---|
| `ttl` | `number` | Time-to-live in milliseconds |
| `priority` | `number` (1–10) | Eviction priority |
| `tags` | `string[]` | Group labels for invalidation |
| `skipCompression` | `boolean` | Disable compression |
| `skipEncryption` | `boolean` | Disable encryption |
| `metadata` | `Record<string, any>` | Custom metadata |

---

### EncryptionOptions

Used in `EncryptionService.encrypt`.

| Field | Type | Description |
|---|---|---|
| `algorithm` | `"aes-256-gcm" \| "chacha20-poly1305"` | |
| `keyDerivationIterations` | `number` | |
| `quantumSafe` | `boolean` | Forces ChaCha20-Poly1305 |

---

### EncryptedPackage

| Field | Type | Description |
|---|---|---|
| `algorithm` | `string` | |
| `iv` | `string` | Hex-encoded IV |
| `data` | `string` | Hex-encoded ciphertext |
| `authTag` | `string` | Hex-encoded authentication tag |
| `salt` | `string` | Hex-encoded salt |
| `timestamp` | `number` | Unix timestamp |
| `version` | `string` | Package format version |

---

### CacheStats

| Field | Type | Description |
|---|---|---|
| `hits` | `number` | |
| `misses` | `number` | |
| `hitRate` | `number` | |
| `entryCount` | `number` | |
| `memoryUsage` | `{ used: number, limit: number, percentage: number }` | |

---

## Performance Benchmarks

XyPriss Security leverages a multi-threaded Go core, consistently outperforming native JavaScript implementations:

| Operation | Standard JS | XyPriss (Go Core) | Improvement |
|---|---|---|---|
| Argon2id  | ~450ms      | ~85ms             | 5.3x        |
| AES-GCM   | ~12ms       | ~2ms              | 6x          |
| SHA-256   | ~5ms        | ~0.8ms            | 6.2x        |

---

## License

Copyright (c) 2025 NEHONIX. Licensed under the Nehonix Open Source License (NOSL). All rights reserved.
