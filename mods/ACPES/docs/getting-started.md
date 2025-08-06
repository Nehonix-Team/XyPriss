# Getting Started with ACPES

This guide will help you get started with ACPES (Advanced Cross-Platform Encrypted Storage) in your project.

## Installation

### NPM
```bash
npm install xypriss-acpes
```

### Yarn
```bash
yarn add xypriss-acpes
```

### PNPM
```bash
pnpm add xypriss-acpes
```

## Basic Setup

### Import the Module

```typescript
// Import the singleton instance (recommended for most use cases)
import { Storage, STORAGE_KEYS } from 'xypriss-acpes';

// Or import the class to create custom instances
import { ACPES } from 'xypriss-acpes';
```

### Platform Detection

ACPES automatically detects the current platform and uses the appropriate storage backend:

```typescript
const platformInfo = Storage.getPlatformInfo();
console.log(`Platform: ${platformInfo.platform}`);
console.log(`Has File System: ${platformInfo.hasFileSystem}`);
console.log(`Has Keychain: ${platformInfo.hasKeychain}`);
```

## Basic Operations

### Storing Data

```typescript
// Store a simple value
await Storage.setItem('user-id', '12345');

// Store using predefined keys
await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, 'abc123');

// Store with options
await Storage.setItem('large-data', jsonString, {
    compressionEnabled: true,
    useIndexedDB: true // Web only
});
```

### Retrieving Data

```typescript
// Get a value
const userId = await Storage.getItem('user-id');

// Check if a value exists
const hasToken = await Storage.hasItem(STORAGE_KEYS.SESSION_TOKEN);

// Get with error handling
try {
    const data = await Storage.getItem('sensitive-data');
    if (data) {
        console.log('Data retrieved successfully');
    }
} catch (error) {
    console.error('Failed to retrieve data:', error);
}
```

### Removing Data

```typescript
// Remove a single item
await Storage.removeItem('user-id');

// Clear all stored data
await Storage.clear();
```

## Advanced Features

### Time-To-Live (TTL)

```typescript
// Store data that expires in 1 hour (3600 seconds)
await Storage.setItemWithTTL('temp-token', 'xyz789', 3600);

// Data will automatically be removed after expiration
```

### Atomic Updates

```typescript
// Update data atomically
await Storage.updateItem('counter', (currentValue) => {
    const count = currentValue ? parseInt(currentValue) : 0;
    return (count + 1).toString();
});
```

### Security Monitoring

```typescript
// Check security metrics
const metrics = Storage.getSecurityMetrics('sensitive-key');
console.log(`Total attempts: ${metrics.totalAttempts}`);
console.log(`Failed attempts: ${metrics.failedAttempts}`);
console.log(`Is locked: ${metrics.isLocked}`);

// Unlock a service if needed
if (metrics.isLocked) {
    await Storage.unlockService('sensitive-key');
}
```

## Custom Configuration

### Creating Custom Instances

```typescript
// Create a custom instance with specific configuration
const customStorage = new ACPES({
    nodeStoragePath: '/custom/secure/path'
});
```

### Platform-Specific Options

```typescript
// Web-specific options
await Storage.setItem('data', value, {
    useIndexedDB: true,
    compressionEnabled: true
});

// Mobile-specific options (React Native)
await Storage.setItem('biometric-data', value, {
    touchID: true,
    requireAuth: true,
    service: 'MyApp'
});

// Node.js-specific options
await Storage.setItem('server-data', value, {
    filePath: '/custom/path/data.enc'
});
```

## Error Handling

```typescript
try {
    await Storage.setItem('key', 'value');
} catch (error) {
    if (error.message.includes('locked')) {
        console.log('Service is temporarily locked due to failed attempts');
    } else if (error.message.includes('storage space')) {
        console.log('Insufficient storage space');
    } else {
        console.error('Storage error:', error);
    }
}
```

## Next Steps

- Read the [API Reference](./api-reference.md) for complete method documentation
- Learn about [Security Features](./security.md) and best practices
- Explore [Platform Support](./platform-support.md) for platform-specific details
