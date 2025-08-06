# ACPES - Advanced Cross-Platform Encrypted Storage

[![npm version](https://badge.fury.io/js/xypriss-acpes.svg)](https://badge.fury.io/js/xypriss-acpes)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ACPES is a secure, cross-platform storage solution that works seamlessly across Web, Mobile (React Native), and Node.js environments. It provides military-grade encryption, automatic platform detection, and comprehensive security features.

## Features

-   **Cross-Platform Compatibility**: Works on Web, Mobile (React Native), and Node.js
-   **Double AES-256 Encryption**: Enhanced security with PBKDF2 key derivation
-   **Integrity Verification**: HMAC-SHA256 checksums prevent data tampering
-   **Device Fingerprinting**: Unique encryption keys per device
-   **Automatic Lockout**: Protection against brute force attacks
-   **TTL Support**: Automatic data expiration
-   **Compression**: LZ-string compression for large data
-   **Modular Architecture**: Import only what you need
-   **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install xypriss-acpes
# or
yarn add xypriss-acpes
# or
pnpm add xypriss-acpes
```

## Quick Start

```typescript
import { Storage, STORAGE_KEYS } from "xypriss-acpes";

// Store sensitive data
await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "your-secure-token");

// Retrieve data
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);

// Store with TTL (expires in 1 hour)
await Storage.setItemWithTTL("temp-data", "value", 3600);

// Check platform capabilities
const info = Storage.getPlatformInfo();
console.log(`Platform: ${info.platform}, Has Keychain: ${info.hasKeychain}`);
```

## Platform Support

### Web

-   **localStorage**: Primary storage for small data
-   **IndexedDB**: Fallback for large data or when localStorage is unavailable
-   **Memory**: Final fallback for unsupported browsers

### Mobile (React Native)

-   **Keychain (iOS)**: Secure keychain storage with biometric support
-   **Keystore (Android)**: Android keystore integration
-   **Biometric Authentication**: Touch ID, Face ID, and fingerprint support

### Node.js

-   **File System**: Encrypted file storage with proper permissions
-   **Memory**: Fallback for restricted environments

## Security Features

### Encryption

-   **Double AES-256**: Two layers of AES-256 encryption
-   **PBKDF2 Key Derivation**: 10,000 iterations for key strengthening
-   **Device-Specific Keys**: Unique keys per device using fingerprinting

### Integrity Protection

-   **HMAC-SHA256**: Cryptographic checksums for data integrity
-   **Version Validation**: Automatic handling of format changes
-   **Corruption Detection**: Automatic cleanup of corrupted data

### Access Control

-   **Automatic Lockout**: Configurable failed attempt limits
-   **Security Metrics**: Detailed access attempt tracking
-   **Manual Unlock**: Administrative override capabilities

## Advanced Usage

### Custom Configuration

```typescript
import { ACPES } from "xypriss-acpes";

const customStorage = new ACPES({
    nodeStoragePath: "/custom/secure/path",
});
```

### Platform-Specific Options

```typescript
// Web with IndexedDB and compression
await Storage.setItem("data", largeJsonString, {
    useIndexedDB: true,
    compressionEnabled: true,
});

// Mobile with biometric authentication
await Storage.setItem("sensitive-data", value, {
    touchID: true,
    requireAuth: true,
    service: "MyApp",
});

// Node.js with custom file path
await Storage.setItem("server-config", config, {
    filePath: "/etc/myapp/secure.enc",
});
```

### Security Monitoring

```typescript
// Check security status
const metrics = Storage.getSecurityMetrics("sensitive-key");
if (metrics.isLocked) {
    console.log(`Service locked until: ${new Date(metrics.lockUntil)}`);
}

// Manual unlock if needed
await Storage.unlockService("sensitive-key");
```

## API Reference

### Core Methods

-   `setItem(key, value, options?)` - Store encrypted data
-   `getItem(key, options?)` - Retrieve and decrypt data
-   `removeItem(key, options?)` - Remove stored data
-   `clear()` - Remove all stored data
-   `hasItem(key, options?)` - Check if key exists

### Utility Methods

-   `setItemWithTTL(key, value, ttlSeconds, options?)` - Store with expiration
-   `updateItem(key, updater, options?)` - Atomic updates
-   `getPlatformInfo()` - Get platform capabilities
-   `getSecurityMetrics(key)` - Get security status
-   `unlockService(key)` - Manual unlock

## Documentation

-   **[Getting Started](./docs/getting-started.md)** - Quick start guide and basic usage
-   **[API Reference](./docs/api-reference.md)** - Complete API documentation
-   **[Architecture](./docs/architecture.md)** - Modular architecture overview
-   **[Platform Support](./docs/platform-support.md)** - Platform-specific features
-   **[Security](./docs/security.md)** - Security features and best practices
-   **[Examples](./docs/examples.md)** - Real-world usage examples
-   **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions

## Requirements

### Web

-   Modern browsers with localStorage support
-   IndexedDB support (optional, for enhanced features)

### Mobile

-   React Native 0.60+
-   react-native-keychain (for secure storage)

### Node.js

-   Node.js 14+
-   File system write permissions

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and development process.

## Security

For security issues, please email security@xypriss.com instead of using the issue tracker.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes.

> **Migration Notice**: The XyPriss library is the separated version of FortifyJS accessible via [the link](https://github.com/nehonix/FortifyJS) or using `npm install fortify2-js`. The FortifyJS library will be deprecated soon, so start moving from it to XyPriss for future improvements.

