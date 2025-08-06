# Architecture Overview

ACPES follows a modular architecture that separates concerns and enables maintainable, extensible code.

## Directory Structure

```
src/
├── core/                    # Core functionality
│   ├── index.ts            # Core exports
│   ├── platform.ts         # Platform detection & module loading
│   └── storage.ts          # Main CrossPlatformSecureStorage class
├── components/             # Utility components
│   ├── index.ts           # Component exports
│   ├── encryption.ts      # Encryption/decryption utilities
│   ├── compression.ts     # Compression utilities
│   ├── security.ts        # Security metrics & validation
│   └── fingerprint.ts     # Device fingerprinting
├── platforms/             # Platform-specific implementations
│   ├── index.ts          # Platform exports
│   ├── web.ts            # Web storage (localStorage/IndexedDB)
│   ├── mobile.ts         # Mobile storage (React Native Keychain)
│   ├── node.ts           # Node.js storage (file system)
│   └── fallback.ts       # Fallback memory storage
├── types/                # Type definitions
│   ├── index.ts         # Type exports
│   ├── options.ts       # Configuration options
│   ├── storage.ts       # Storage-related types
│   ├── security.ts      # Security-related types
│   └── platform.ts      # Platform-related types
├── utils/               # Utilities
│   ├── index.ts        # Utility exports
│   ├── constants.ts    # Constants and defaults
│   ├── validation.ts   # Input validation
│   └── helpers.ts      # General helper functions
└── index.ts            # Main entry point
```

## Core Components

### Platform Detection (`core/platform.ts`)
- Automatically detects the runtime environment (Web, Node.js, Mobile)
- Dynamically loads platform-specific modules
- Provides fallback mechanisms for unsupported environments

### Storage Orchestrator (`core/storage.ts`)
- Main `CrossPlatformSecureStorage` class
- Coordinates between different platform implementations
- Handles encryption, compression, and security features
- Manages the storage lifecycle

### Platform Implementations (`platforms/`)
Each platform has its own storage implementation:

#### Web Storage (`platforms/web.ts`)
- Uses localStorage for small data
- Falls back to IndexedDB for larger data or when localStorage is unavailable
- Handles storage quota limitations

#### Mobile Storage (`platforms/mobile.ts`)
- Uses React Native Keychain for secure storage
- Supports biometric authentication
- Handles iOS/Android specific features

#### Node.js Storage (`platforms/node.ts`)
- Uses encrypted file system storage
- Creates secure storage directories
- Handles file permissions and access

#### Fallback Storage (`platforms/fallback.ts`)
- In-memory storage for unsupported environments
- Provides basic functionality when other options fail
- Data is lost when the application closes

## Security Layer

### Encryption (`components/encryption.ts`)
- Double AES-256 encryption with different keys
- PBKDF2 key derivation from device fingerprints
- HMAC-SHA256 integrity verification

### Device Fingerprinting (`components/fingerprint.ts`)
- Generates unique device identifiers
- Uses platform-specific characteristics
- Creates encryption keys tied to specific devices

### Security Monitoring (`components/security.ts`)
- Tracks access attempts and failures
- Implements automatic lockout mechanisms
- Provides security metrics and monitoring

### Compression (`components/compression.ts`)
- LZ-string compression for large data
- Base64 encoding for safe transport
- Automatic compression threshold detection

## Data Flow

### Storage Operation Flow
1. **Input Validation**: Validate parameters and check service locks
2. **Data Processing**: Apply compression if needed
3. **Encryption**: Double-encrypt data with device-specific keys
4. **Integrity**: Generate HMAC checksum
5. **Platform Storage**: Store using appropriate platform implementation
6. **Security Tracking**: Record attempt metrics

### Retrieval Operation Flow
1. **Platform Retrieval**: Get encrypted data from platform storage
2. **Decryption**: Double-decrypt using device-specific keys
3. **Integrity Check**: Verify HMAC checksum
4. **Version Check**: Ensure data format compatibility
5. **Expiration Check**: Validate TTL if set
6. **Decompression**: Decompress if needed
7. **Security Tracking**: Record successful access

## Modular Benefits

### Separation of Concerns
- Each module has a single responsibility
- Platform-specific code is isolated
- Security features are centralized
- Types are clearly defined

### Maintainability
- Easy to modify individual components
- Clear dependency relationships
- Comprehensive type safety
- Consistent error handling

### Extensibility
- New platforms can be added easily
- Security features can be enhanced
- Storage backends can be swapped
- Custom implementations can be plugged in

### Tree Shaking
- Import only needed components
- Reduce bundle size in web applications
- Platform-specific code is excluded automatically

## Design Patterns

### Strategy Pattern
Platform-specific storage implementations follow the strategy pattern, allowing runtime selection of storage backends.

### Singleton Pattern
The default `crossPlatformStorage` instance provides a convenient singleton for most use cases.

### Factory Pattern
Platform detection and module loading use factory patterns to create appropriate implementations.

### Observer Pattern
Security monitoring uses observer-like patterns to track and respond to access attempts.

## Error Handling Strategy

### Graceful Degradation
- Falls back to less secure storage if preferred options fail
- Continues operation with reduced functionality
- Provides clear error messages and recovery suggestions

### Security-First Approach
- Fails securely when integrity is compromised
- Locks services after repeated failures
- Provides audit trails for security events

### Platform Resilience
- Handles platform-specific limitations gracefully
- Provides consistent API across all platforms
- Adapts to available platform features

## Performance Considerations

### Lazy Loading
- Platform-specific modules are loaded only when needed
- Reduces initial bundle size and startup time
 
### Caching
- Device fingerprints are cached to avoid recalculation
- Platform detection results are cached

### Async Operations
- All storage operations are asynchronous
- Non-blocking security checks and cleanup operations

### Memory Management
- Automatic cleanup of expired data
- Efficient memory usage in fallback storage
- Proper resource disposal in Node.js file operations
