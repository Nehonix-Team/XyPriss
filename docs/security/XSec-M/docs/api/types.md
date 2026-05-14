# Type Reference

Definition of core interfaces and configuration objects used throughout the XyPriss Security framework.

## Options

### HashOptions

Used in `Hash.create`.

- `algorithm`: `string` (e.g., `"sha256"`)
- `outputFormat`: `"hex" | "base64" | "buffer" | "uint8array"`
- `iterations`: `number` (Used if algorithm is a KDF)
- `salt`: `string | Uint8Array`

---

### SecureTokenOptions

Used in `Random.generateToken`.

- `length`: `number`
- `includeUppercase`: `boolean`
- `includeLowercase`: `boolean`
- `includeNumbers`: `boolean`
- `includeSymbols`: `boolean`
- `excludeSimilarCharacters`: `boolean`

---

### PasswordHashOptions

Used in `PasswordManager` configuration.

- `algorithm`: `"argon2id" | "scrypt" | "pbkdf2"`
- `iterations`: `number`
- `memoryCost`: `number` (Argon2 only)
- `timeCost`: `number` (Argon2 only)

---

### UltraCacheOptions

Used in `Cache.set`.

- `ttl`: `number` (Milliseconds)
- `priority`: `number` (1-10)
- `tags`: `string[]`
- `skipCompression`: `boolean`
- `skipEncryption`: `boolean`
- `metadata`: `Record<string, any>`

---

### EncryptionOptions

Used in `EncryptionService.encrypt`.

- `algorithm`: `"aes-256-gcm" | "chacha20-poly1305"`
- `keyDerivationIterations`: `number`
- `quantumSafe`: `boolean`

---

## Data Structures

### EncryptedPackage

- `algorithm`: `string`
- `iv`: `string` (Hex)
- `data`: `string` (Hex)
- `authTag`: `string` (Hex)
- `salt`: `string` (Hex)
- `timestamp`: `number`
- `version`: `string`

---

### CacheStats

- `hits`: `number`
- `misses`: `number`
- `hitRate`: `number`
- `entryCount`: `number`
- `memoryUsage`: `{ used: number, limit: number, percentage: number }`
