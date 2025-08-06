# API Reference

Complete API documentation for ACPES (Advanced Cross-Platform Encrypted Storage).

## Storage Class

### Constructor

```typescript
new Storage(options?: StorageConstructorOptions)
```

#### Parameters
- `options` (optional): Configuration options for the storage instance

#### StorageConstructorOptions
```typescript
interface StorageConstructorOptions {
    nodeStoragePath?: string; // Custom storage path for Node.js
}
```

### Core Methods

#### setItem()
```typescript
setItem(key: string, value: string, options?: SecureStorageOptions & { expiresIn?: number }): Promise<boolean>
```
Stores a value securely with optional expiration.

**Parameters:**
- `key`: Storage key identifier
- `value`: Data to store
- `options`: Storage configuration options

**Returns:** Promise resolving to `true` if successful, `false` otherwise

#### getItem()
```typescript
getItem(key: string, options?: SecureStorageOptions): Promise<string | null>
```
Retrieves a stored value.

**Parameters:**
- `key`: Storage key identifier
- `options`: Storage configuration options

**Returns:** Promise resolving to the stored value or `null` if not found

#### removeItem()
```typescript
removeItem(key: string, options?: SecureStorageOptions): Promise<boolean>
```
Removes a stored value.

**Parameters:**
- `key`: Storage key identifier
- `options`: Storage configuration options

**Returns:** Promise resolving to `true` if successful

#### clear()
```typescript
clear(): Promise<boolean>
```
Removes all stored data.

**Returns:** Promise resolving to `true` if successful

### Utility Methods

#### hasItem()
```typescript
hasItem(key: string, options?: SecureStorageOptions): Promise<boolean>
```
Checks if a key exists in storage.

#### setItemWithTTL()
```typescript
setItemWithTTL(key: string, value: string, ttlSeconds: number, options?: SecureStorageOptions): Promise<boolean>
```
Stores a value with automatic expiration.

**Parameters:**
- `ttlSeconds`: Time to live in seconds

#### updateItem()
```typescript
updateItem(key: string, updater: (currentValue: string | null) => string, options?: SecureStorageOptions): Promise<boolean>
```
Atomically updates a stored value.

**Parameters:**
- `updater`: Function that receives current value and returns new value

### Security Methods

#### getSecurityMetrics()
```typescript
getSecurityMetrics(key: string): SecurityMetrics
```
Returns security metrics for a specific key.

#### unlockService()
```typescript
unlockService(key: string): Promise<boolean>
```
Manually unlocks a service that was locked due to failed attempts.

### Platform Methods

#### getPlatformInfo()
```typescript
getPlatformInfo(): PlatformInfo
```
Returns information about the current platform and available features.

## Type Definitions

### SecureStorageOptions
```typescript
interface SecureStorageOptions {
    service?: string;           // Service identifier for keychain operations
    accessGroup?: string;       // Access group for iOS keychain
    touchID?: boolean;          // Enable Touch ID/Face ID authentication
    showModal?: boolean;        // Show authentication modal
    requireAuth?: boolean;      // Require authentication for access
    compressionEnabled?: boolean; // Enable compression for large data
    useIndexedDB?: boolean;     // Use IndexedDB instead of localStorage on web
    filePath?: string;          // Custom file path for Node.js storage
}
```

### SecurityMetrics
```typescript
interface SecurityMetrics {
    totalAttempts: number;      // Total number of access attempts
    failedAttempts: number;     // Number of failed attempts
    lastFailedAttempt?: number; // Timestamp of last failed attempt
    isLocked: boolean;          // Whether the service is currently locked
    lockUntil?: number;         // Timestamp when the lock will be released
}
```

### PlatformInfo
```typescript
interface PlatformInfo {
    platform: PlatformType;     // Current platform type
    isWeb: boolean;             // Whether running on web
    isMobile: boolean;          // Whether running on mobile
    isNode: boolean;            // Whether running on Node.js
    hasKeychain: boolean;       // Whether keychain is available
    hasIndexedDB: boolean;      // Whether IndexedDB is available
    hasFileSystem: boolean;     // Whether file system is available
}
```

### StoredData
```typescript
interface StoredData {
    value: string;              // The actual stored value
    timestamp: number;          // Timestamp when the data was stored
    expiresAt?: number;         // Optional expiration timestamp
    checksum: string;           // Integrity checksum for the data
    version: string;            // Version of the storage format
    attempts?: number;          // Number of access attempts
    lastAccess?: number;        // Last access timestamp
}
```

## Constants

### STORAGE_KEYS
Predefined storage keys for common use cases:

```typescript
const STORAGE_KEYS = {
    SESSION_TOKEN: "session_token",
    REFRESH_TOKEN: "refresh_token",
    ACCESS_TOKEN: "access_token",
    USER_DATA: "user_data",
    USER_PREFERENCES: "user_preferences",
    SESSION_ID: "session_id",
    DEVICE_ID: "device_id",
    DEVICE_FINGERPRINT: "device_fingerprint",
    LAST_ACTIVITY: "last_activity",
    LOGIN_ATTEMPTS: "login_attempts",
    BIOMETRIC_ENABLED: "biometric_enabled",
    SECURITY_QUESTIONS: "security_questions",
    ENCRYPTED_CACHE: "encrypted_cache",
    OFFLINE_DATA: "offline_data"
} as const;
``` 

## Singleton Instance

### Storage
Pre-configured singleton instance ready for immediate use:

```typescript
import { Storage } from 'xypriss-acpes';

// Use directly without instantiation
await Storage.setItem('key', 'value');
```

## Error Handling

All methods may throw errors in the following scenarios:
- Invalid parameters
- Platform-specific storage failures
- Security lockout conditions
- Insufficient storage space
- Data corruption or integrity failures

Always wrap storage operations in try-catch blocks for production use.
