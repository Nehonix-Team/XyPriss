# XyPriss Security

[![npm version](https://badge.fury.io/js/xypriss-security.svg)](https://badge.fury.io/js/xypriss-security)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**XyPriss Security** is an advanced JavaScript security library designed for enterprise-grade applications. It provides military-grade encryption, secure data structures, quantum-resistant cryptography, and comprehensive security utilities for modern web applications.

## 🔒 Key Features

### Secure Data Structures

-   **SecureArray**: Military-grade encrypted arrays with AES-256-CTR-HMAC
-   **SecureString**: Protected string handling with automatic memory cleanup
-   **SecureObject**: Encrypted object storage with metadata management
-   **SecureBuffer**: Protected memory allocation with secure wiping

### Cryptographic Operations

-   **Token Generation**: Secure random tokens with configurable entropy
-   **Password Management**: Argon2ID hashing with pepper support
-   **Hash Functions**: SHA-256/512, BLAKE3, with timing-safe operations
-   **Key Derivation**: PBKDF2, Argon2, scrypt implementations

### Advanced Security Features

-   **Quantum-Resistant Cryptography**: Post-quantum algorithms (Kyber, Dilithium)
-   **Tamper-Evident Logging**: Immutable audit trails with cryptographic verification
-   **Fortified Functions**: Tamper-resistant function execution with integrity checks
-   **Side-Channel Protection**: Timing-safe operations and memory protection

### Enterprise Features

-   **Zero Dependencies**: Self-contained with no external dependencies
-   **Browser & Node.js**: Universal compatibility across environments
-   **TypeScript Native**: Full type safety and IntelliSense support
-   **Performance Optimized**: Benchmarked for high-throughput applications

## 📦 Installation

```bash
npm install xypriss-security
```

For use with XyPriss framework:

```bash
npm install xypriss xypriss-security
```

## 🚀 Quick Start

### Basic Usage

```typescript
import {
    XyPrissSecurity,
    SecureString,
    SecureArray,
    Hash,
    SecureRandom,
} from "xypriss-security";

// Initialize the security library
const security = new XyPrissSecurity();

// Create secure strings
const securePassword = new SecureString("my-secret-password");
console.log(securePassword.length); // 18
console.log(securePassword.toString()); // Returns encrypted representation

// Generate secure random tokens
const token = SecureRandom.generateToken(32);
console.log(token); // 64-character hex string

// Hash operations
const hash = Hash.create("sensitive-data", {
    algorithm: "sha256",
    outputFormat: "hex",
});
console.log(hash); // SHA-256 hash in hex format
```

### Secure Data Handling

```typescript
import { SecureArray, SecureObject } from "xypriss-security";

// Secure array operations
const secureData = new SecureArray([1, 2, 3, 4, 5]);
secureData.push(6);
console.log(secureData.length); // 6

// Secure object storage
const secureObj = new SecureObject({
    apiKey: "secret-api-key",
    credentials: { username: "admin", password: "secure123" },
});

// Access with automatic decryption
const apiKey = secureObj.get("apiKey");
console.log(apiKey); // 'secret-api-key'
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
console.log(isValid); // true
```

### Cryptographic Operations

```typescript
import { Crypto, KeyDerivation } from "xypriss-security";

// Generate encryption keys
const key = await KeyDerivation.deriveKey("master-password", {
    salt: "unique-salt",
    iterations: 100000,
    keyLength: 32,
    algorithm: "pbkdf2",
});

// Encrypt/decrypt data
const encrypted = await Crypto.encrypt("sensitive-data", key);
const decrypted = await Crypto.decrypt(encrypted, key);
console.log(decrypted); // 'sensitive-data'
```

## 🏗️ Architecture

### Core Modules

#### Security Core (`/core`)

-   **crypto.ts**: Main cryptographic operations and algorithms
-   **hash.ts**: Secure hashing functions with timing-safe operations
-   **random.ts**: Cryptographically secure random number generation
-   **validators.ts**: Input validation and sanitization utilities

#### Secure Components (`/components`)

-   **secure-array**: Encrypted array implementation
-   **secure-string**: Protected string handling
-   **secure-object**: Encrypted object storage
-   **secure-memory**: Memory management and protection
-   **fortified-function**: Tamper-resistant function execution

#### Advanced Features (`/components`)

-   **post-quantum**: Quantum-resistant cryptographic algorithms
-   **tamper-evident-logging**: Immutable audit trail system
-   **side-channel**: Protection against timing and cache attacks
-   **attestation**: Code and data integrity verification

#### Utilities (`/utils`)

-   **errorHandler**: Secure error handling and logging
-   **performanceMonitor**: Security-aware performance monitoring
-   **securityUtils**: General security utility functions
-   **patterns**: Security pattern matching and detection

## 📚 API Reference

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

### SecureString

Protected string handling with automatic memory cleanup.

```typescript
class SecureString {
    constructor(value: string, options?: SecureStringOptions);

    get length(): number;
    toString(): string;
    valueOf(): string;
    clear(): void;

    // String operations
    substring(start: number, end?: number): SecureString;
    indexOf(searchString: string): number;
    replace(searchValue: string, replaceValue: string): SecureString;
}
```

### SecureArray

Military-grade encrypted arrays with comprehensive operations.

```typescript
class SecureArray<T> {
    constructor(initialData?: T[], options?: SecureArrayOptions);

    get length(): number;
    push(...items: T[]): number;
    pop(): T | undefined;
    shift(): T | undefined;
    unshift(...items: T[]): number;

    // Array operations
    map<U>(callback: (value: T, index: number) => U): SecureArray<U>;
    filter(callback: (value: T, index: number) => boolean): SecureArray<T>;
    reduce<U>(callback: (acc: U, value: T, index: number) => U, initial: U): U;
}
```

### Hash Utilities

Secure hashing with multiple algorithms and timing-safe operations.

```typescript
class Hash {
    static create(data: string, options?: HashOptions): string;
    static verify(data: string, hash: string, options?: HashOptions): boolean;
    static hmac(data: string, key: string, options?: HmacOptions): string;

    // Supported algorithms: sha256, sha512, blake3, argon2
    static algorithms: string[];
}
```

### SecureRandom

Cryptographically secure random number generation.

```typescript
class SecureRandom {
    static generateToken(length: number): string;
    static generateBytes(length: number): Uint8Array;
    static generateInt(min: number, max: number): number;
    static generateUUID(): string;

    // Entropy management
    static addEntropy(source: string): void;
    static getEntropyLevel(): number;
}
```

## 🔧 Configuration

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

## 🚀 Performance

XyPriss Security is optimized for high-performance applications:

-   **Encryption**: 10,000+ operations/second (AES-256-GCM)
-   **Hashing**: 50,000+ operations/second (SHA-256)
-   **Memory**: Zero-copy operations where possible
-   **CPU**: Optimized algorithms with SIMD support

## 🔒 Security Guarantees

-   **Memory Safety**: Automatic secure memory wiping
-   **Timing Safety**: Constant-time operations for sensitive data
-   **Quantum Resistance**: Post-quantum cryptographic algorithms
-   **Side-Channel Protection**: Resistance to timing and cache attacks
-   **Tamper Evidence**: Cryptographic integrity verification

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

-   [Documentation](./docs/)
-   [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)
-   [Security Advisories](https://github.com/Nehonix-Team/XyPriss/security)

---

**XyPriss Security** - Military-grade security for modern JavaScript applications.

