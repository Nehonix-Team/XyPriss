# RSA Cryptography and Byte Utilities

This module documents the RSA asymmetric cryptography primitives and byte-length validation utilities introduced in version 2.1.2. All operations are powered by the Go security core and exposed through a clean TypeScript interface.

---

## RSA Key Management

### generateRSAKeyPair()

Generates a 4096-bit RSA key pair using a cryptographically secure random source.

**Signature:**

```typescript
function generateRSAKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}>;
```

**Returns:** A Promise resolving to an object containing:

- `publicKey`: PEM-encoded RSA public key (`PUBLIC KEY` type).
- `privateKey`: PEM-encoded RSA private key (`RSA PRIVATE KEY` type, PKCS#1 format).

**Notes:**

- Key size is fixed at 4096 bits, providing a minimum security level of 140 bits.
- Keys are encoded in standard PEM format and are compatible with OpenSSL and other standard tools.
- This is a CPU-intensive operation. Generate keys once, persist them securely, and reuse across sessions.

**Example:**

```typescript
import { generateRSAKeyPair } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();

console.log(publicKey);
// -----BEGIN PUBLIC KEY-----
// MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA...
// -----END PUBLIC KEY-----
```

Also available via the `Keys` class:

```typescript
import { Keys } from "xypriss-security";

const keyPair = await Keys.generateRSAKeyPair();
```

---

## RSA Signatures (RSA-PSS)

XyPriss uses **RSA-PSS** (Probabilistic Signature Scheme) with SHA-256, which is the modern, secure successor to the deterministic PKCS#1 v1.5 scheme.

### rsaSign(privateKey, data)

Signs arbitrary data using the RSA private key.

**Signature:**

```typescript
function rsaSign(privateKey: string, data: string): Promise<string>;
```

**Parameters:**

- `privateKey`: PEM-encoded RSA private key.
- `data`: The data string to be signed.

**Returns:** A Promise resolving to the hex-encoded RSA-PSS signature.

**Security properties:**

- Uses SHA-256 for the internal hash and mask generation function (MGF1-SHA256).
- The PSS construction includes random salting, making each signature unique even for identical inputs.

**Example:**

```typescript
import { rsaSign, generateRSAKeyPair } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();
const signature = await rsaSign(privateKey, "payload-to-sign");
```

---

### rsaVerify(publicKey, data, signature)

Verifies a previously computed RSA-PSS signature.

**Signature:**

```typescript
function rsaVerify(
  publicKey: string,
  data: string,
  signature: string,
): Promise<boolean>;
```

**Parameters:**

- `publicKey`: PEM-encoded RSA public key.
- `data`: The original data string that was signed.
- `signature`: The hex-encoded signature returned by `rsaSign`.

**Returns:** A Promise resolving to `true` if the signature is valid, `false` otherwise.

**Example:**

```typescript
import { rsaSign, rsaVerify, generateRSAKeyPair } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();
const data = "critical-system-payload";

const signature = await rsaSign(privateKey, data);
const isValid = await rsaVerify(publicKey, data, signature);

console.log(isValid); // true
```

---

## RSA Encryption (RSA-OAEP)

XyPriss uses **RSA-OAEP** (Optimal Asymmetric Encryption Padding) with SHA-256 for encryption. OAEP is the recommended, provably secure RSA encryption scheme.

> **Important:** RSA encryption is not designed for large payloads. For encrypting arbitrary-length data, use hybrid encryption: generate a symmetric AES key, encrypt the payload with it, then encrypt the AES key with RSA. See the [Encryption module](./encryption.md) for the full hybrid API.

### rsaEncrypt(publicKey, data)

Encrypts a data string using the RSA public key.

**Signature:**

```typescript
function rsaEncrypt(publicKey: string, data: string): Promise<string>;
```

**Parameters:**

- `publicKey`: PEM-encoded RSA public key.
- `data`: The plaintext data string to encrypt. Must fit within the OAEP padding limits (for a 4096-bit key with SHA-256, the maximum plaintext is 446 bytes).

**Returns:** A Promise resolving to the hex-encoded ciphertext.

**Example:**

```typescript
import { rsaEncrypt, generateRSAKeyPair } from "xypriss-security";

const { publicKey } = await generateRSAKeyPair();
const encrypted = await rsaEncrypt(publicKey, "secret-value");
```

---

### rsaDecrypt(privateKey, encryptedHex)

Decrypts RSA-OAEP ciphertext using the RSA private key.

**Signature:**

```typescript
function rsaDecrypt(privateKey: string, encryptedHex: string): Promise<string>;
```

**Parameters:**

- `privateKey`: PEM-encoded RSA private key.
- `encryptedHex`: The hex-encoded ciphertext returned by `rsaEncrypt`.

**Returns:** A Promise resolving to the decrypted plaintext string.

**Example:**

```typescript
import { rsaEncrypt, rsaDecrypt, generateRSAKeyPair } from "xypriss-security";

const { publicKey, privateKey } = await generateRSAKeyPair();
const encrypted = await rsaEncrypt(publicKey, "secret-value");
const decrypted = await rsaDecrypt(privateKey, encrypted);

console.log(decrypted); // "secret-value"
```

---

## Byte Length Utilities

Standard JavaScript's `.length` property on strings returns the **character count**, not the **byte count**. For multi-byte Unicode characters (e.g., emoji, Arabic, CJK characters), these two values differ significantly. These utilities provide the actual UTF-8 byte count as computed by Go's runtime.

This is critical for any security-sensitive operation where the Go binary has strict byte-length requirements (e.g., AES-256-GCM requires a key of exactly 32 bytes).

---

### getByteLength(str)

Returns the UTF-8 byte length of a string.

**Signature:**

```typescript
function getByteLength(str: string): number;
```

**Parameters:**

- `str`: The string to measure.

**Returns:** The number of bytes the string occupies when encoded as UTF-8.

**Example:**

```typescript
import { getByteLength } from "xypriss-security";

getByteLength("hello"); // 5   (ASCII: 1 byte per char)
getByteLength("cafe"); // 4
getByteLength("caf\u00e9"); // 5   (é = 2 bytes in UTF-8)
getByteLength("hello world"); // "hello world".length = 11, bytes = 11
getByteLength("你好"); // 2 chars, but 6 bytes in UTF-8
```

Also available via `XyPrissSecurity.getByteLength(str)`.

---

### isValidByteLength(str, expectedLength)

Verifies whether a string has exactly the expected number of UTF-8 bytes.

**Signature:**

```typescript
function isValidByteLength(str: string, expectedLength: number): boolean;
```

**Parameters:**

- `str`: The string to check.
- `expectedLength`: The exact byte count expected.

**Returns:** `true` if the byte size matches, `false` otherwise.

**Example:**

```typescript
import { isValidByteLength } from "xypriss-security";

// Validate an AES-256 key candidate (must be exactly 32 bytes)
const keyCandidate = "my-passphrase-of-exactly-32byte";

if (!isValidByteLength(keyCandidate, 32)) {
  throw new Error("Key material does not meet the 32-byte requirement.");
}
```

Also available via `XyPrissSecurity.isValidByteLength(str, length)`.

---

## Key Derivation

### deriveKey(input, options?)

Derives a cryptographically strong key from a secret using a configurable KDF.

**Signature:**

```typescript
function deriveKey(
  input: string | Uint8Array,
  options?: KeyDerivationOptions,
): Promise<string>;
```

**Parameters:**

- `input`: The input secret or password.
- `options.algorithm`: `"argon2id" | "pbkdf2" | "hkdf" | "scrypt"` (Default: `"argon2id"`)
- `options.iterations`: Number of iterations for PBKDF2.
- `options.keyLength`: Output key length in bytes.
- `options.salt`: Salt bytes or string.
- `options.digest`: Hash function for PBKDF2 (`"sha256"` or `"sha512"`).
- `options.info`: Context info for HKDF.

**Returns:** A Promise resolving to the derived key in hex format.

**Example:**

```typescript
import { deriveKey } from "xypriss-security";

// Derive a 32-byte AES key using PBKDF2-SHA256 with 310,000 iterations
const key = await deriveKey("user-supplied-passphrase", {
  algorithm: "pbkdf2",
  iterations: 310000,
  keyLength: 32,
  salt: "unique-per-user-salt",
});
```

---

## Full Workflow Example

```typescript
import {
  generateRSAKeyPair,
  rsaSign,
  rsaVerify,
  rsaEncrypt,
  rsaDecrypt,
  getByteLength,
  isValidByteLength,
} from "xypriss-security";

async function main() {
  // 1. Generate a key pair
  const { publicKey, privateKey } = await generateRSAKeyPair();

  // 2. Sign a payload
  const payload = "user-id:1234|role:admin|ts:1741958400";
  const signature = await rsaSign(privateKey, payload);

  // 3. Verify the signature on the receiver side
  const valid = await rsaVerify(publicKey, payload, signature);
  console.log("Signature valid:", valid); // true

  // 4. Encrypt a short secret
  const apiSecret = "sk_live_my-secret-key";
  const encrypted = await rsaEncrypt(publicKey, apiSecret);
  const decrypted = await rsaDecrypt(privateKey, encrypted);
  console.log("Decrypted:", decrypted); // "sk_live_my-secret-key"

  // 5. Validate key material byte length before use
  const aesKeyCandidate = "exactly-32-bytes-long-passphrase";
  console.log("Byte length:", getByteLength(aesKeyCandidate)); // 32
  console.log("Valid 32-byte key:", isValidByteLength(aesKeyCandidate, 32)); // true
}

main();
```
