# XyPriss Security - API Reference

Complete API documentation for XyPriss Security library.

## Table of Contents

- [XyPrissSecurity Class](#xyprissecurity-class)
- [Secure Data Structures](#secure-data-structures)
- [Cryptographic Functions](#cryptographic-functions)
- [Password Management](#password-management)
- [Random Generation](#random-generation)
- [Validation Utilities](#validation-utilities)
- [Post-Quantum Cryptography](#post-quantum-cryptography)
- [Security Utilities](#security-utilities)

## XyPrissSecurity Class

The main entry point for the security library.

### Constructor

```typescript
new XyPrissSecurity(config?: SecurityConfig)
```

**Parameters:**
- `config` (optional): Security configuration object

### Methods

#### `encrypt(data: any, options?: EncryptionOptions): Promise<string>`

Encrypts data using the configured encryption algorithm.

**Parameters:**
- `data`: Data to encrypt (string, object, array, etc.)
- `options`: Encryption options

**Returns:** Promise resolving to encrypted string

**Example:**
```typescript
const encrypted = await security.encrypt('sensitive-data', {
  password: 'master-password',
  algorithm: 'aes-256-gcm'
});
```

#### `decrypt(encryptedData: string, options?: DecryptionOptions): Promise<any>`

Decrypts previously encrypted data.

**Parameters:**
- `encryptedData`: Encrypted string to decrypt
- `options`: Decryption options

**Returns:** Promise resolving to original data

#### `hash(data: string, options?: HashOptions): string`

Creates a cryptographic hash of the input data.

**Parameters:**
- `data`: Data to hash
- `options`: Hashing options

**Returns:** Hash string in specified format

#### `generateToken(length?: number): string`

Generates a cryptographically secure random token.

**Parameters:**
- `length` (optional): Token length in bytes (default: 32)

**Returns:** Hex-encoded token string

## Secure Data Structures

### SecureString

Protected string handling with automatic memory cleanup.

#### Constructor

```typescript
new SecureString(value: string, options?: SecureStringOptions)
```

#### Properties

- `length: number` - Length of the string
- `encrypted: boolean` - Whether the string is currently encrypted

#### Methods

##### `toString(): string`

Returns the decrypted string value.

##### `valueOf(): string`

Returns the decrypted string value (for implicit conversion).

##### `substring(start: number, end?: number): SecureString`

Returns a new SecureString containing the specified substring.

##### `indexOf(searchString: string): number`

Returns the index of the first occurrence of the search string.

##### `replace(searchValue: string, replaceValue: string): SecureString`

Returns a new SecureString with replaced values.

##### `clear(): void`

Securely wipes the string from memory.

### SecureArray

Military-grade encrypted arrays with comprehensive operations.

#### Constructor

```typescript
new SecureArray<T>(initialData?: T[], options?: SecureArrayOptions)
```

#### Properties

- `length: number` - Number of elements in the array
- `encrypted: boolean` - Whether the array is currently encrypted

#### Methods

##### `push(...items: T[]): number`

Adds elements to the end of the array.

##### `pop(): T | undefined`

Removes and returns the last element.

##### `shift(): T | undefined`

Removes and returns the first element.

##### `unshift(...items: T[]): number`

Adds elements to the beginning of the array.

##### `map<U>(callback: (value: T, index: number) => U): SecureArray<U>`

Creates a new SecureArray with transformed elements.

##### `filter(callback: (value: T, index: number) => boolean): SecureArray<T>`

Creates a new SecureArray with filtered elements.

##### `reduce<U>(callback: (acc: U, value: T, index: number) => U, initial: U): U`

Reduces the array to a single value.

##### `clear(): void`

Securely wipes all elements from memory.

### SecureObject

Encrypted object storage with metadata management.

#### Constructor

```typescript
new SecureObject(initialData?: Record<string, any>, options?: SecureObjectOptions)
```

#### Methods

##### `get(key: string): any`

Retrieves a value by key with automatic decryption.

##### `set(key: string, value: any): void`

Sets a value with automatic encryption.

##### `has(key: string): boolean`

Checks if a key exists in the object.

##### `delete(key: string): boolean`

Removes a key-value pair from the object.

##### `keys(): string[]`

Returns an array of all keys.

##### `values(): any[]`

Returns an array of all decrypted values.

##### `entries(): [string, any][]`

Returns an array of key-value pairs.

##### `clear(): void`

Securely wipes all data from memory.

## Cryptographic Functions

### Hash Class

Secure hashing functions with multiple algorithms.

#### Static Methods

##### `Hash.create(data: string, options?: HashOptions): string`

Creates a cryptographic hash.

**Options:**
```typescript
interface HashOptions {
  algorithm?: 'sha256' | 'sha512' | 'blake3' | 'argon2';
  outputFormat?: 'hex' | 'base64' | 'buffer';
  salt?: string;
  iterations?: number;
}
```

##### `Hash.verify(data: string, hash: string, options?: HashOptions): boolean`

Verifies data against a hash using timing-safe comparison.

##### `Hash.hmac(data: string, key: string, options?: HmacOptions): string`

Creates an HMAC (Hash-based Message Authentication Code).

### Crypto Class

Advanced cryptographic operations.

#### Static Methods

##### `Crypto.encrypt(data: any, key: string | Buffer, options?: CryptoOptions): Promise<string>`

Encrypts data using authenticated encryption.

##### `Crypto.decrypt(encryptedData: string, key: string | Buffer, options?: CryptoOptions): Promise<any>`

Decrypts authenticated encrypted data.

##### `Crypto.generateKey(options?: KeyGenerationOptions): Promise<Buffer>`

Generates a cryptographically secure key.

## Password Management

### Password Class

Secure password hashing and validation.

#### Static Methods

##### `Password.hash(password: string, options?: PasswordHashOptions): Promise<string>`

Hashes a password using the specified algorithm.

**Options:**
```typescript
interface PasswordHashOptions {
  algorithm?: 'argon2id' | 'argon2i' | 'argon2d' | 'bcrypt' | 'scrypt';
  memoryCost?: number;    // Argon2 memory cost
  timeCost?: number;      // Argon2 time cost
  parallelism?: number;   // Argon2 parallelism
  saltLength?: number;    // Salt length in bytes
  hashLength?: number;    // Output hash length
  pepper?: string;        // Additional secret
}
```

##### `Password.verify(password: string, hash: string): Promise<boolean>`

Verifies a password against its hash.

##### `Password.checkStrength(password: string): PasswordStrength`

Analyzes password strength and provides feedback.

**Returns:**
```typescript
interface PasswordStrength {
  score: number;          // 0-4 strength score
  feedback: string[];     // Improvement suggestions
  entropy: number;        // Estimated entropy in bits
  crackTime: string;      // Estimated crack time
}
```

##### `Password.generate(options?: PasswordGenerationOptions): string`

Generates a secure password.

**Options:**
```typescript
interface PasswordGenerationOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeSimilar?: boolean;
  excludeAmbiguous?: boolean;
}
```

## Random Generation

### SecureRandom Class

Cryptographically secure random number generation.

#### Static Methods

##### `SecureRandom.generateToken(length: number): string`

Generates a random token as a hex string.

##### `SecureRandom.generateBytes(length: number): Uint8Array`

Generates random bytes.

##### `SecureRandom.generateInt(min: number, max: number): number`

Generates a random integer within the specified range.

##### `SecureRandom.generateUUID(): string`

Generates a cryptographically secure UUID v4.

##### `SecureRandom.generateSalt(length?: number): string`

Generates a random salt for password hashing.

##### `SecureRandom.addEntropy(source: string): void`

Adds additional entropy to the random number generator.

##### `SecureRandom.getEntropyLevel(): number`

Returns the current entropy level (0-100).

## Validation Utilities

### Validators Class

Input validation and sanitization utilities.

#### Static Methods

##### `Validators.validate(input: any, rules: ValidationRules): ValidationResult`

Validates input against specified rules.

**Rules:**
```typescript
interface ValidationRules {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  sanitize?: boolean;
}
```

**Result:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}
```

##### `Validators.sanitize(input: string, options?: SanitizeOptions): string`

Sanitizes input to prevent injection attacks.

##### `Validators.isEmail(email: string): boolean`

Validates email address format.

##### `Validators.isURL(url: string): boolean`

Validates URL format.

##### `Validators.isIPAddress(ip: string): boolean`

Validates IP address format (IPv4 and IPv6).

## Post-Quantum Cryptography

### PostQuantum Namespace

Quantum-resistant cryptographic algorithms.

#### Kyber Class

Key encapsulation mechanism.

##### `generateKeyPair(): Promise<KyberKeyPair>`

Generates a Kyber key pair.

##### `encapsulate(publicKey: Uint8Array): Promise<KyberEncapsulation>`

Encapsulates a shared secret.

##### `decapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>`

Decapsulates the shared secret.

#### Dilithium Class

Digital signature algorithm.

##### `generateKeyPair(): Promise<DilithiumKeyPair>`

Generates a Dilithium signing key pair.

##### `sign(message: string | Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>`

Signs a message.

##### `verify(message: string | Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>`

Verifies a signature.

## Security Utilities

### SecurityUtils Class

General security utility functions.

#### Static Methods

##### `SecurityUtils.constantTimeEquals(a: string, b: string): boolean`

Performs constant-time string comparison.

##### `SecurityUtils.secureWipe(buffer: Buffer | Uint8Array): void`

Securely wipes a buffer from memory.

##### `SecurityUtils.generateNonce(length?: number): string`

Generates a cryptographic nonce.

##### `SecurityUtils.deriveKey(password: string, salt: string, options?: KeyDerivationOptions): Promise<Buffer>`

Derives a key from a password using PBKDF2, Argon2, or scrypt.

---

**Next**: [Examples](./examples.md)
**Previous**: [Security Guide](./security-guide.md)
