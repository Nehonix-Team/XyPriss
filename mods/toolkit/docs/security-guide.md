# XyPriss Security Guide

This guide covers security features and best practices for using XyPriss Security in production applications.

> **Migration Notice**: This library is the separated version of FortifyJS accessible via [the link](https://github.com/nehonix/FortifyJS) or using `npm install fortify2-js`. The FortifyJS library will be deprecated soon, so start moving from it to XyPriss for future improvements.

## Table of Contents

- [Security Architecture](#security-architecture)
- [Secure Data Structures](#secure-data-structures)
- [Cryptographic Operations](#cryptographic-operations)
- [Password Management](#password-management)
- [Quantum-Resistant Cryptography](#quantum-resistant-cryptography)
- [Tamper-Evident Logging](#tamper-evident-logging)
- [Security Best Practices](#security-best-practices)
- [Threat Mitigation](#threat-mitigation)

## Security Architecture

XyPriss Security follows a defense-in-depth approach with multiple layers of protection:

### Layer 1: Memory Protection
- Secure memory allocation and automatic wiping
- Protection against memory dumps and cold boot attacks
- Constant-time operations to prevent timing attacks

### Layer 2: Cryptographic Security
- Military-grade encryption (AES-256, ChaCha20-Poly1305)
- Quantum-resistant algorithms (Kyber, Dilithium)
- Secure key derivation and management

### Layer 3: Data Integrity
- Tamper-evident logging with cryptographic verification
- Code attestation and runtime verification
- Secure serialization with integrity checks

### Layer 4: Application Security
- Input validation and sanitization
- Side-channel attack protection
- Secure error handling and logging

## Secure Data Structures

### fString (SecureString)

Protected string handling with automatic memory cleanup:

```typescript
import { fString } from 'xypriss-security';

// Create secure string
const password = fString('my-secret-password', {
  protectionLevel: 'maximum',
  enableEncryption: true
});

// Safe operations
console.log(password.length); // 18
console.log(password.substring(0, 3)); // SecureString containing 'my-'

// Automatic cleanup
password.clear(); // Securely wipes memory
```

**Security Features:**
- Encrypted storage in memory
- Automatic secure wiping on garbage collection
- Constant-time string operations
- Protection against memory dumps

### fArray (SecureArray)

Military-grade encrypted arrays:

```typescript
import { fArray } from 'xypriss-security';

// Create secure array
const sensitiveData = fArray([
  { id: 1, secret: 'api-key-1' },
  { id: 2, secret: 'api-key-2' }
]);

// Set encryption
sensitiveData.setEncryptionKey('your-encryption-key-2025');
sensitiveData.encryptAll();

// Safe operations
const filtered = sensitiveData.filter(item => item.id > 1);
const mapped = sensitiveData.map(item => ({ ...item, processed: true }));

// Secure cleanup
sensitiveData.clear();
```

**Security Features:**
- AES-256-CTR-HMAC encryption
- Authenticated encryption with integrity verification
- Secure iteration and transformation methods
- Memory-safe operations

### fObject (SecureObject)

Encrypted object storage with metadata management:

```typescript
import { fObject } from 'xypriss-security';

// Create secure object
const credentials = fObject({
  apiKey: 'secret-api-key',
  database: {
    host: 'db.example.com',
    password: 'db-password'
  }
}, {
  enableEncryption: true
});

// Access with automatic decryption
const apiKey = credentials.get('apiKey');
const dbConfig = credentials.get('database');

// Secure updates
credentials.set('apiKey', 'new-api-key');
credentials.delete('database.password');
```

**Security Features:**
- Hierarchical encryption with key derivation
- Metadata protection and access control
- Secure serialization and deserialization
- Audit trail for all operations

## Cryptographic Operations

### Hash Functions

Secure hashing with multiple algorithms:

```typescript
import { Hash } from 'xypriss-security';

// SHA-256 hashing
const hash256 = Hash.create('sensitive-data', {
  algorithm: 'sha256',
  outputFormat: 'hex'
});

// BLAKE3 hashing (faster and more secure)
const hashBlake3 = Hash.create('sensitive-data', {
  algorithm: 'blake3',
  outputFormat: 'base64'
});

// HMAC for message authentication
const hmac = Hash.hmac('message', 'secret-key', {
  algorithm: 'sha256'
});

// Timing-safe verification
const isValid = Hash.verify('sensitive-data', hash256, {
  algorithm: 'sha256'
});
```

### Encryption and Decryption

Military-grade encryption operations:

```typescript
import { XyPrissSecurity } from 'xypriss-security';

const security = new XyPrissSecurity({
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'argon2'
  }
});

// Encrypt sensitive data
const encrypted = await security.encrypt('sensitive-data', {
  password: 'master-password',
  additionalData: 'context-info'
});

// Decrypt data
const decrypted = await security.decrypt(encrypted, {
  password: 'master-password',
  additionalData: 'context-info'
});
```

### Key Derivation

Secure key derivation functions:

```typescript
import { KeyDerivation } from 'xypriss-security';

// PBKDF2 key derivation
const key1 = await KeyDerivation.deriveKey('password', {
  salt: 'unique-salt',
  iterations: 100000,
  keyLength: 32,
  algorithm: 'pbkdf2'
});

// Argon2ID (recommended for new applications)
const key2 = await KeyDerivation.deriveKey('password', {
  salt: 'unique-salt',
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  algorithm: 'argon2id'
});

// scrypt (alternative option)
const key3 = await KeyDerivation.deriveKey('password', {
  salt: 'unique-salt',
  N: 16384,
  r: 8,
  p: 1,
  algorithm: 'scrypt'
});
```

## Password Management

### Secure Password Hashing

```typescript
import { Password } from 'xypriss-security';

// Hash password with Argon2ID (recommended)
const hashedPassword = await Password.hash('user-password', {
  algorithm: 'argon2id',
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
  hashLength: 32        // 32 bytes output
});

// Verify password
const isValid = await Password.verify('user-password', hashedPassword);

// Add pepper for additional security
const pepperedHash = await Password.hash('user-password', {
  algorithm: 'argon2id',
  pepper: process.env.PASSWORD_PEPPER,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4
});
```

### Password Strength Validation

```typescript
import { Password } from 'xypriss-security';

// Check password strength
const strength = Password.checkStrength('MyP@ssw0rd123');
console.log(strength);
// {
//   score: 4,
//   feedback: ['Strong password'],
//   entropy: 65.2,
//   crackTime: '3 centuries'
// }

// Generate secure passwords
const securePassword = Password.generate({
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeSimilar: true
});
```

## Security Best Practices

### 1. Key Management

```typescript
// Use environment variables for secrets
const config = {
  encryptionKey: process.env.ENCRYPTION_KEY,
  signingKey: process.env.SIGNING_KEY,
  pepper: process.env.PASSWORD_PEPPER
};

// Rotate keys regularly
const keyRotation = new KeyRotationManager({
  rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
  keyDerivation: 'argon2id'
});
```

### 2. Input Validation

```typescript
import { Validators } from 'xypriss-security';

// Validate and sanitize inputs
const userInput = req.body.data;

const validationResult = Validators.validate(userInput, {
  type: 'string',
  maxLength: 1000,
  pattern: /^[a-zA-Z0-9\s\-_]+$/,
  sanitize: true
});

if (!validationResult.isValid) {
  throw new Error('Invalid input: ' + validationResult.errors.join(', '));
}
```

### 3. Secure Error Handling

```typescript
import { SecurityErrorHandler } from 'xypriss-security';

const errorHandler = new SecurityErrorHandler({
  logErrors: true,
  sanitizeStackTraces: true,
  auditTrail: true
});

try {
  // Sensitive operation
  const result = await performSensitiveOperation();
} catch (error) {
  // Secure error handling
  const sanitizedError = errorHandler.handle(error);
  res.status(500).json({ error: sanitizedError.message });
}
```

## Threat Mitigation

### Side-Channel Attacks

```typescript
import { SideChannelProtection } from 'xypriss-security';

// Constant-time string comparison
const isEqual = SideChannelProtection.constantTimeEquals(
  'user-provided-hash',
  'stored-hash'
);

// Timing-safe operations
const result = await SideChannelProtection.timingSafeOperation(async () => {
  return await performCryptographicOperation();
});
```

### Memory Attacks

```typescript
import { SecureMemory } from 'xypriss-security';

// Secure memory allocation
const secureBuffer = SecureMemory.allocate(1024);

// Use the buffer
secureBuffer.write('sensitive-data', 0);

// Automatic secure wiping
secureBuffer.clear(); // Overwrites with random data
```

### Injection Attacks

```typescript
import { InjectionProtection } from 'xypriss-security';

// SQL injection protection
const safeQuery = InjectionProtection.sanitizeSQL(userInput);

// XSS protection
const safeHTML = InjectionProtection.sanitizeHTML(userContent);

// Command injection protection
const safeCommand = InjectionProtection.sanitizeCommand(userCommand);
```

---

**Next**: [API Reference](./api-reference.md)
**Previous**: [Getting Started](../README.md)
