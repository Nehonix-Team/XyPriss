# ACPES Documentation

This directory contains comprehensive guides and API documentation for the Advanced Cross-Platform Encrypted Storage (ACPES) module.

## Documentation Structure

-   **[Getting Started](./getting-started.md)** - Quick start guide and basic usage
-   **[API Reference](./api-reference.md)** - Complete API documentation
-   **[Architecture](./architecture.md)** - Modular architecture overview
-   **[Platform Support](./platform-support.md)** - Platform-specific features and limitations
-   **[Security](./security.md)** - Security features and best practices

## Quick Links

-   [Installation](#installation)
-   [Basic Usage](#basic-usage)
-   [Advanced Features](#advanced-features)
-   [Contributing](#contributing)

## Installation

```bash
npm install xypriss-acpes
# or
yarn add xypriss-acpes
```

## Basic Usage

```typescript
import { Storage, STORAGE_KEYS } from "xypriss-acpes";

// Store sensitive data
await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "your-token");

// Retrieve data
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);

// Check if data exists
const hasToken = await Storage.hasItem(STORAGE_KEYS.SESSION_TOKEN);
```

## Advanced Features

-   **Cross-Platform**: Works on Web, Mobile (React Native), and Node.js
-   **Security**: Double AES-256 encryption with PBKDF2 key derivation
-   **Integrity Verification**: HMAC-SHA256 checksums for data integrity
-   **Device Fingerprinting**: Unique encryption keys per device
-   **Automatic Lockout**: Protection against brute force attacks
-   **TTL Support**: Automatic data expiration
-   **Compression**: LZ-string compression for large data
-   **Modular Architecture**: Import only what you need

## Contributing

Please read our [Contributing Guide](../../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

