# Advanced Encryption Layer

ACPES includes an advanced encryption layer that provides military-grade security with user-specified keys and binary obfuscation. This second encryption layer makes stored data virtually unreadable and provides maximum security for sensitive information.

## Overview

The advanced encryption layer adds a third level of security on top of ACPES's existing double encryption:

1. **Base Layer**: Device fingerprint encryption
2. **Double Layer**: AES-256 with integrity verification
3. **Advanced Layer**: User-specified keys + binary obfuscation (NEW)

## Key Features

### Triple-Layer Security Architecture
- **User-Controlled Keys**: Specify your own encryption keys
- **Device Binding**: Keys are tied to specific devices
- **Binary Obfuscation**: Data is converted to binary for maximum unreadability
- **Key Fingerprinting**: Tamper detection through key validation
- **PBKDF2 Strengthening**: 50,000 iterations for brute-force resistance

### Automatic Fallback
- If no user key is provided, secure keys are generated from device fingerprints
- Maintains backward compatibility with existing ACPES installations
- Graceful degradation if advanced encryption is disabled

## Configuration Options

### SecureStorageOptions

```typescript
interface SecureStorageOptions {
    // Advanced encryption options
    userEncryptionKey?: string;      // User-specified encryption key
    enableBinaryEncoding?: boolean;  // Enable binary obfuscation (default: true)
    advancedEncryption?: boolean;    // Enable advanced layer (default: true)
}
```

### Default Behavior
- **advancedEncryption**: `true` (enabled by default)
- **enableBinaryEncoding**: `true` (enabled by default)
- **keyDerivationRounds**: 50,000 for user keys, 25,000 for device keys

## Usage Examples

### Basic Advanced Encryption
```typescript
import { Storage, STORAGE_KEYS } from 'xypriss-acpes';

// Maximum security with default settings
await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, 'sensitive-data', {
    advancedEncryption: true,        // Default: true
    enableBinaryEncoding: true       // Default: true
});

// Retrieve with same settings
const data = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN, {
    advancedEncryption: true,
    enableBinaryEncoding: true
});
```

### User-Specified Encryption Keys
```typescript
// Store with custom user key
const userKey = 'MySecretMasterKey2024!@#';
await Storage.setItem('top-secret-data', 'classified-information', {
    userEncryptionKey: userKey,
    advancedEncryption: true,
    enableBinaryEncoding: true
});

// Retrieve with same user key
const secretData = await Storage.getItem('top-secret-data', {
    userEncryptionKey: userKey
});
```

### Advanced Encryption without Binary Encoding
```typescript
// High security without binary obfuscation
await Storage.setItem('secure-data', 'important-info', {
    userEncryptionKey: 'CustomKey123',
    advancedEncryption: true,
    enableBinaryEncoding: false
});
```

### Disable Advanced Encryption
```typescript
// Use only base + double encryption
await Storage.setItem('regular-data', 'normal-info', {
    advancedEncryption: false
});
```

### Large Data with Compression
```typescript
const largeData = JSON.stringify(bigObject);
await Storage.setItem('large-dataset', largeData, {
    userEncryptionKey: 'DataKey2024',
    compressionEnabled: true,        // Compress before encryption
    advancedEncryption: true,
    enableBinaryEncoding: true
});
```

## Security Specifications

### Encryption Algorithms
- **Primary**: AES-256-CBC with random IV
- **Key Derivation**: PBKDF2-SHA512
- **Integrity**: HMAC-SHA256 checksums
- **Obfuscation**: Base64 + Binary conversion

### Key Generation Process

#### With User-Specified Key
1. Combine user key with device fingerprint
2. Apply PBKDF2-SHA512 with 50,000 iterations
3. Generate 256-bit encryption key
4. Create key fingerprint for validation

#### Without User Key (Device-Only)
1. Use device fingerprint as seed
2. Apply PBKDF2-SHA512 with 25,000 iterations
3. Generate 256-bit encryption key
4. Create key fingerprint for validation

### Binary Obfuscation Process
1. Convert encrypted data to Base64
2. Convert Base64 to binary representation
3. Store binary data (completely unreadable)
4. Reverse process during decryption

## Security Benefits

### Maximum Unreadability
- Stored data appears as binary strings
- No recognizable patterns or structures
- Impossible to identify data type or content

### Tamper Detection
- Key fingerprints detect any modification
- Integrity verification at multiple layers
- Automatic cleanup of corrupted data

### Brute Force Resistance
- 50,000 PBKDF2 iterations make attacks impractical
- Device-specific salts prevent rainbow table attacks
- Multiple encryption layers increase attack complexity

### User Control
- Users can specify their own master keys
- Keys can be rotated by changing user key
- Independent of device-generated keys

## Performance Considerations

### Encryption Overhead
- Advanced encryption adds ~10-20ms per operation
- Binary encoding adds minimal overhead
- PBKDF2 iterations add ~50-100ms (one-time per key)

### Storage Overhead
- Binary encoding increases size by ~33%
- Metadata adds ~200 bytes per entry
- Compression can offset size increases for large data

### Memory Usage
- Keys are cached to avoid recalculation
- Binary conversion uses temporary buffers
- Automatic cleanup prevents memory leaks

## Best Practices

### Key Management
```typescript
// Use strong, unique keys
const userKey = generateSecureKey(); // Your key generation function
await Storage.setItem('data', value, { userEncryptionKey: userKey });

// Store keys securely (not in code)
const userKey = process.env.ACPES_USER_KEY;
```

### Error Handling
```typescript
try {
    await Storage.setItem('data', value, { userEncryptionKey: 'key' });
} catch (error) {
    if (error.message.includes('Key verification failed')) {
        // Wrong key or tampered data
        console.log('Security violation detected');
    }
}
```

### Migration Strategy
```typescript
// Gradual migration to advanced encryption
const useAdvanced = process.env.NODE_ENV === 'production';
await Storage.setItem('data', value, {
    advancedEncryption: useAdvanced,
    userEncryptionKey: useAdvanced ? userKey : undefined
});
```

## Troubleshooting

### Common Issues

**Key Fingerprint Mismatch**
- Ensure same user key is used for storage and retrieval
- Check that device fingerprint hasn't changed
- Verify data hasn't been tampered with

**Binary Decoding Errors**
- Ensure enableBinaryEncoding setting matches
- Check for data corruption in storage backend
- Verify Base64 encoding is intact

**Performance Issues**
- Consider disabling binary encoding for large datasets
- Use compression for better performance with large data
- Cache user keys to avoid repeated PBKDF2 calculations

### Debug Mode
```typescript
// Enable debug logging
const storage = new CrossPlatformSecureStorage();
// Check logs for detailed encryption/decryption information
```

## Migration Guide

### From Regular to Advanced Encryption
1. Enable advanced encryption with default settings
2. Gradually migrate existing data
3. Add user-specified keys for maximum security
4. Enable binary encoding for complete obfuscation

### Backward Compatibility
- Advanced encryption is enabled by default
- Existing data continues to work
- Mixed encryption levels are supported
- Graceful fallback for unsupported environments
