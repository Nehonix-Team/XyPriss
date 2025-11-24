<div align="center">
  <img src="https://dll.nehonix.com/assets/xypriss/mode/global/logo.png" alt="XyPriss Logo" width="200"/>
</div>

# XyPriss Security

[![npm version](https://badge.fury.io/js/xypriss-security.svg)](https://badge.fury.io/js/xypriss-security)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

XyPriss Security is an advanced JavaScript security library designed for enterprise applications. It provides military-grade encryption, secure data structures, quantum-resistant cryptography, and comprehensive security utilities for modern web applications.

> **Migration Notice**: This library is the separated version of FortifyJS accessible via [the link](https://github.com/nehonix/FortifyJS) or using `npm install fortify2-js`. The FortifyJS library will be deprecated soon, so start moving from it to XyPriss for future improvements.

## Key Features

### Secure Data Structures

-   SecureArray: Military-grade encrypted arrays with AES-256-CTR-HMAC
-   SecureString: Protected string handling with automatic memory cleanup
-   SecureObject: Encrypted object storage with metadata management
-   SecureBuffer: Protected memory allocation with secure wiping

### Cryptographic Operations

-   Token Generation: Secure random tokens with configurable entropy
-   Password Management: Argon2ID hashing with pepper support
-   Hash Functions: SHA-256/512, BLAKE3, with timing-safe operations
-   Key Derivation: PBKDF2, Argon2, scrypt implementations

### Advanced Security Features

-   Quantum-Resistant Cryptography: Post-quantum algorithms (Kyber, Dilithium)
-   Tamper-Evident Logging: Immutable audit trails with cryptographic verification
-   Fortified Functions: Tamper-resistant function execution with integrity checks
-   Side-Channel Protection: Timing-safe operations and memory protection

### Enterprise Features

-   Zero Dependencies: Self-contained with no external dependencies
-   Browser & Node.js: Universal compatibility across environments
-   TypeScript Native: Full type safety and IntelliSense support
-   Performance Optimized: Benchmarked for high-throughput applications

## Installation

```bash
npm install xypriss-security
```

For use with XyPriss framework:

```bash
npm install xypriss xypriss-security
```

## Quick Start

### Basic Usage

```typescript
import {
    XyPrissSecurity,
    fString,
    fArray,
    Hash,
    generateSecureToken,
} from "xypriss-security";

// Create secure strings
const securePassword = fString("my-secret-password", {
    protectionLevel: "maximum",
    enableEncryption: true,
});

// Generate secure random tokens
const token = generateSecureToken({
    length: 32,
    entropy: "maximum",
});
console.log(token); // 64-character hex string

// Hash operations
const hash = Hash.create("sensitive-data", {
    algorithm: "sha256",
    outputFormat: "hex",
});
```

### Secure Data Handling

```typescript
import { fArray, fObject } from "xypriss-security";

// Secure array operations
const secureData = fArray([1, 2, 3, 4, 5]);
secureData.setEncryptionKey("your-encryption-key-2025");
secureData.encryptAll();

// Secure object storage
const secureObj = fObject({
    apiKey: "secret-api-key",
    credentials: { username: "admin", password: "secure123" },
});

// Access with automatic decryption
const apiKey = secureObj.get("apiKey");
```

### Password Management

```typescript
import { Password } from "xypriss-security";

// Hash passwords with Argon2ID
const hashedPassword = await Password.hash("user-password", {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
});

// Verify passwords
const isValid = await Password.verify("user-password", hashedPassword);
```

### Cryptographic Operations

```typescript
import { XyPrissSecurity as security, KeyDerivation } from "xypriss-security";

// Generate encryption keys
const key = await KeyDerivation.deriveKey("master-password", {
    salt: "unique-salt",
    iterations: 100000,
    keyLength: 32,
    algorithm: "pbkdf2",
});

// Encrypt/decrypt data
const encrypted = await security.encrypt("sensitive-data", key);
const decrypted = await security.decrypt(encrypted, key);
```

## Architecture

### Core Modules

#### Security Core (`/core`)

-   crypto.ts: Main cryptographic operations and algorithms
-   hash.ts: Secure hashing functions with timing-safe operations
-   random.ts: Cryptographically secure random number generation
-   validators.ts: Input validation and sanitization utilities

#### Secure Components (`/components`)

-   secure-array: Encrypted array implementation
-   secure-string: Protected string handling
-   secure-object: Encrypted object storage
-   secure-memory: Memory management and protection
-   fortified-function: Tamper-resistant function execution

#### Advanced Features (`/components`)

-   post-quantum: Quantum-resistant cryptographic algorithms
-   tamper-evident-logging: Immutable audit trail system
-   side-channel: Protection against timing and cache attacks
-   attestation: Code and data integrity verification

#### Utilities (`/utils`)

-   errorHandler: Secure error handling and logging
-   performanceMonitor: Security-aware performance monitoring
-   securityUtils: General security utility functions
-   patterns: Security pattern matching and detection

## API Reference

### XyPrissSecurity Class

The main entry point for the security library.

```typescript
class XyPrissSecurity {
    constructor(config?: SecurityConfig);

    // Core methods
    encrypt(data: any, options?: EncryptionOptions): Promise<string>;
    decrypt(encryptedData: string, options?: DecryptionOptions): Promise<any>;
    hash(data: string, options?: HashOptions): string;
    generateToken(length?: number): string;

    // Validation methods
    validateInput(input: any, rules: ValidationRules): ValidationResult;
    sanitize(input: string, options?: SanitizeOptions): string;
}
```

### Secure Data Structures

#### fString (SecureString)

```typescript
const secureStr = fString("sensitive-data", {
    protectionLevel: "maximum",
    enableEncryption: true,
});
```

#### fArray (SecureArray)

```typescript
const secureArr = fArray(["item1", "item2"], {
    encryptionKey: "your-key",
});
```

#### fObject (SecureObject)

```typescript
const secureObj = fObject(
    {
        key: "value",
    },
    {
        enableEncryption: true,
    }
);
```

### Utility Functions

#### generateSecureToken

```typescript
const token = generateSecureToken(32, "base64url");
```

#### Hash Operations

```typescript
const hash = Hash.create("data", {
    algorithm: "sha256",
    outputFormat: "hex",
});
```

## Configuration

### Security Configuration

```typescript
interface SecurityConfig {
    encryption?: {
        algorithm?: "aes-256-gcm" | "chacha20-poly1305";
        keyDerivation?: "pbkdf2" | "argon2" | "scrypt";
        iterations?: number;
    };

    memory?: {
        secureWipe?: boolean;
        protectedAllocation?: boolean;
        maxBufferSize?: number;
    };

    logging?: {
        auditTrail?: boolean;
        tamperEvident?: boolean;
        logLevel?: "debug" | "info" | "warn" | "error";
    };

    validation?: {
        strictMode?: boolean;
        sanitizeInputs?: boolean;
        maxInputLength?: number;
    };
}
```

## Performance

XyPriss Security is optimized for high-performance applications:

-   Encryption: 10,000+ operations/second (AES-256-GCM)
-   Hashing: 50,000+ operations/second (SHA-256)
-   Memory: Zero-copy operations where possible
-   CPU: Optimized algorithms with SIMD support

## Security Guarantees

-   Memory Safety: Automatic secure memory wiping
-   Timing Safety: Constant-time operations for sensitive data
-   Quantum Resistance: Post-quantum cryptographic algorithms
-   Side-Channel Protection: Resistance to timing and cache attacks
-   Tamper Evidence: Cryptographic integrity verification

## Contributing

Contributions are welcome. Please see our [Contributing Guide](./CONTRIBUTING.md).

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

-   [Documentation](./docs/)
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
-   [Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)

