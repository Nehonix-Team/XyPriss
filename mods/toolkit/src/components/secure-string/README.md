# SecureString Modular Architecture

This directory contains the refactored SecureString implementation with a modular architecture for better maintainability, testability, and extensibility.

## 📁 Directory Structure

```
src/security/secure-string/
├── README.md                          # This file
├── index.ts                          # Main export file
├── types/
│   └── index.ts                      # Type definitions
├── core/
│   └── secure-string-core.ts         # Main SecureString class
├── buffer/
│   └── buffer-manager.ts             # Buffer management
├── operations/
│   ├── string-operations.ts          # String manipulation
│   └── comparison-operations.ts      # String comparison
├── crypto/
│   └── crypto-operations.ts          # Cryptographic operations
└── validation/
    └── string-validator.ts           # String validation
```

## 🏗️ Architecture Overview

The modular architecture separates concerns into focused modules:

### Core Module (`core/`)

-   **SecureString Core**: Main class that orchestrates all other modules
-   Provides the public API and integrates all functionality

### Buffer Module (`buffer/`)

-   **Buffer Manager**: Manages secure buffer operations with different protection levels

### Operations Module (`operations/`)

-   **String Operations**: Handles string manipulation (append, prepend, split, etc.)
-   **Comparison Operations**: Provides secure string comparison including constant-time operations

### Crypto Module (`crypto/`)

-   **Crypto Operations**: Handles hashing, HMAC, key derivation, and other cryptographic operations

### Validation Module (`validation/`)

-   **String Validator**: Provides validation for passwords, emails, URLs, and other formats

## Usage

### Basic Usage

```typescript
import { SecureString, createSecureString } from "./secure-string";

// Create a new SecureString
const str = createSecureString("sensitive data");

// String operations
str.append(" more data");
str.prepend("prefix: ");
const upper = str.toUpperCase();

// Secure comparison
const isEqual = str.equals("other string", true); // constant-time

// Cryptographic operations
const hash = await str.hash("SHA-256", "hex");
const hmac = await str.hmac({ key: "secret", algorithm: "HMAC-SHA-256" });

// Validation
const validation = str.validatePassword();

// Clean up
str.destroy();
```

### Protection Levels

```typescript
import {
    createSecureString,
    createEnhancedSecureString,
    createMaximumSecureString,
} from "./secure-string";

// Basic protection
const basic = createSecureString("data");

// Enhanced protection with encryption and canaries
const enhanced = createEnhancedSecureString("sensitive data");

// Maximum protection with all security features
const maximum = createMaximumSecureString("top secret data");
```

### Advanced Usage

```typescript
import {
    SecureString,
    BufferManager,
    StringOperations,
    ComparisonOperations,
    CryptoOperations,
    StringValidator,
} from "./secure-string";

// Use individual modules
const similarity = ComparisonOperations.calculateSimilarity("hello", "hallo");
const hash = await CryptoOperations.hash("data", "SHA-256", "hex");
const validation = StringValidator.validateEmail("user@example.com");

// Custom buffer management
const buffer = new BufferManager("data", { enableEncryption: true });
```

## 🔧 Factory Functions

The module provides convenient factory functions:

```typescript
// Basic creation
const str = createSecureString("data", options);

// Enhanced security
const enhanced = createEnhancedSecureString("data");

// Maximum security
const maximum = createMaximumSecureString("data");

// From buffer
const fromBuffer = createSecureStringFromBuffer(uint8Array);

// Clone existing
const cloned = cloneSecureString(existingString);

// Temporary (auto-destroys)
const temp = createTemporarySecureString("data");
```

## 🧪 Testing

Run the test suite to verify the modular implementation:

```typescript
import { runAllTests } from "../../private/test-modular-secure-string";

await runAllTests();
```

## 📊 Benefits of Modular Architecture

### 1. **Maintainability**

-   Each module has a single responsibility
-   Easier to locate and fix bugs
-   Cleaner code organization

### 2. **Testability**

-   Individual modules can be tested in isolation
-   Better test coverage
-   Easier to mock dependencies

### 3. **Extensibility**

-   New features can be added as separate modules
-   Existing modules can be enhanced without affecting others
-   Plugin-like architecture for future extensions

### 4. **Performance**

-   Lazy loading of modules when needed
-   Better memory management
-   Optimized for specific use cases

### 5. **Security**

-   Multiple protection levels
-   Constant-time operations
-   Advanced cryptographic features

## 🔄 Migration from Monolithic Version

The modular version maintains full backward compatibility:

```typescript
// Old way (still works)
import { SecureString } from "../secureString";

// New way (recommended)
import { SecureString } from "./secure-string";
```

All existing APIs remain the same, but now benefit from the modular architecture.

## 🛡️ Protection Levels

### Basic Protection

-   Secure buffer storage
-   Memory clearing on destruction
-   Basic obfuscation

### Enhanced Protection

-   Encryption of buffer content
-   Canary values for tampering detection
-   Advanced obfuscation techniques

### Maximum Protection

-   Quantum-safe encryption
-   Buffer fragmentation
-   Auto-locking mechanisms
-   All security features enabled

## 🔐 Security Features

### Constant-Time Operations

-   Prevents timing attacks
-   Secure string comparison
-   Hash verification

### Cryptographic Operations

-   Multiple hash algorithms (SHA-1, SHA-256, SHA-384, SHA-512)
-   HMAC support
-   PBKDF2 key derivation
-   Scrypt support (Node.js)

### Validation

-   Password strength analysis
-   Email format validation
-   URL validation
-   Credit card validation (Luhn algorithm)
-   Custom validation rules

### Memory Protection

-   Secure buffer management
-   Automatic memory clearing
-   Protection against memory dumps
-   Fragmentation for sensitive data

## 📈 Performance Considerations

The modular architecture provides several performance benefits:

-   **Memory Efficiency**: Only load modules when needed
-   **Faster Operations**: Optimized algorithms for each operation type
-   **Better Caching**: Module-level caching strategies
-   **Reduced Overhead**: Minimal memory footprint for basic operations

## 🔮 Future Enhancements

Planned improvements for the modular architecture:

1. **Hardware Security**: Integration with hardware security modules
2. **Async Operations**: Better support for async string operations
3. **Streaming**: Support for large string processing
4. **Compression**: Built-in compression for large strings
5. **Backup/Restore**: Module for secure string persistence

## 📝 Version History

-   **v2.0.0-modular**: Initial modular architecture implementation
-   **v1.x**: Monolithic implementation (deprecated but supported)

