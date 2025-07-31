# SecureObject Modular Architecture

This directory contains the refactored SecureObject implementation with a modular architecture for better maintainability, testability, and extensibility.

## 📁 Directory Structure

```
src/security/secure-object/
├── README.md                          # This file
├── index.ts                          # Main export file
├── types/
│   └── index.ts                      # Type definitions
├── core/
│   └── secure-object-core.ts         # Main SecureObject class
├── encryption/
│   ├── sensitive-keys.ts             # Sensitive keys management
│   └── crypto-handler.ts             # Encryption/decryption logic
├── metadata/
│   └── metadata-manager.ts           # Metadata tracking
├── events/
│   └── event-manager.ts              # Event system
├── serialization/
│   └── serialization-handler.ts      # Serialization logic
└── utils/
    ├── id-generator.ts               # ID generation utilities
    └── validation.ts                 # Validation utilities
```

## 🏗️ Architecture Overview

The modular architecture separates concerns into focused modules:

### Core Module (`core/`)

-   **SecureObject Core**: Main class that orchestrates all other modules
-   Provides the public API and integrates all functionality

### Encryption Module (`encryption/`)

-   **Sensitive Keys Manager**: Manages which keys should be treated as sensitive
-   **Crypto Handler**: Handles encryption/decryption of sensitive data

### Metadata Module (`metadata/`)

-   **Metadata Manager**: Tracks access patterns, types, and statistics for stored values

### Events Module (`events/`)

-   **Event Manager**: Provides event system for monitoring SecureObject operations

### Serialization Module (`serialization/`)

-   **Serialization Handler**: Converts SecureObject to various formats (JSON, binary, etc.)

### Utilities (`utils/`)

-   **ID Generator**: Generates unique IDs for SecureObject instances
-   **Validation Utils**: Common validation functions

## Usage

### Basic Usage

```typescript
import { SecureObject, createSecureObject } from "./secure-object";

// Create a new SecureObject
const obj = createSecureObject<{
    username: string;
    password: string;
    age: number;
}>();

// Set values
obj.set("username", "john_doe");
obj.set("password", "secret123");
obj.set("age", 30);

// Get values
const username = obj.get("username");
const age = obj.get("age");

// Serialize with encryption for sensitive data
const encrypted = obj.toObject({ encryptSensitive: true });
```

### Advanced Usage

```typescript
import {
    SecureObject,
    SensitiveKeysManager,
    EventManager,
} from "./secure-object";

// Create with custom sensitive keys
const obj = new SecureObject();
obj.addSensitiveKeys("customSecret", "apiToken");

// Add event listeners
obj.addEventListener("set", (event, key, value) => {
    console.log(`Value set: ${key} = ${value}`);
});

// Use individual modules
const keysManager = new SensitiveKeysManager(["password", "token"]);
const eventManager = new EventManager();
```

## 🔧 Factory Functions

The module provides convenient factory functions:

```typescript
// Create a basic SecureObject
const obj = createSecureObject(initialData, options);

// Create a read-only SecureObject
const readOnly = createReadOnlySecureObject(data);

// Create with custom sensitive keys
const custom = createSecureObjectWithSensitiveKeys(data, sensitiveKeys);

// Clone an existing SecureObject
const cloned = cloneSecureObject(sourceObject);
```

## 🧪 Testing

Run the test suite to verify the modular implementation:

```typescript
import { runAllTests } from "../../private/test-modular-secure-object";

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

### 5. **Type Safety**

-   Strong TypeScript typing throughout
-   Better IDE support and autocomplete
-   Compile-time error detection

## 🔄 Migration from Monolithic Version

The modular version maintains full backward compatibility:

```typescript
// Old way (still works)
import { SecureObject } from "../secureOb";

// New way (recommended)
import { SecureObject } from "./secure-object";
```

All existing APIs remain the same, but now benefit from the modular architecture.

## 🛠️ Development Guidelines

When extending the modular SecureObject:

1. **Single Responsibility**: Each module should have one clear purpose
2. **Loose Coupling**: Modules should depend on interfaces, not implementations
3. **High Cohesion**: Related functionality should be grouped together
4. **Testability**: Write unit tests for each module
5. **Documentation**: Document public APIs and complex logic

## 📈 Performance Considerations

The modular architecture provides several performance benefits:

-   **Memory Efficiency**: Only load modules when needed
-   **Faster Initialization**: Lazy loading of heavy components
-   **Better Caching**: Module-level caching strategies
-   **Optimized Serialization**: Specialized handlers for different formats

## 🔮 Future Enhancements

Planned improvements for the modular architecture:

1. **Plugin System**: Allow third-party modules
2. **Async Operations**: Better support for async encryption
3. **Streaming**: Support for large data serialization
4. **Compression**: Built-in compression for serialized data
5. **Backup/Restore**: Module for data persistence

## 📝 Version History

-   **v2.0.0-modular**: Initial modular architecture implementation
-   **v1.x**: Monolithic implementation (deprecated but supported)

