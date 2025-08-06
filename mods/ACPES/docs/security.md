# Security Features

ACPES implements comprehensive security measures to protect stored data across all supported platforms.

## Encryption

### Double AES-256 Encryption

ACPES uses a two-layer encryption approach for enhanced security:

1. **First Layer**: AES-256 encryption with primary key
2. **Second Layer**: AES-256 encryption with derived key

```typescript
// Encryption is automatic and transparent
await Storage.setItem("sensitive-data", "confidential-value");
// Data is double-encrypted before storage
```

### Key Derivation

-   **Algorithm**: PBKDF2 with SHA-256
-   **Iterations**: 10,000 for encryption keys, 1,000 for second layer
-   **Salt**: Platform-specific and time-based salts
-   **Key Size**: 256-bit keys for maximum security

### Device Fingerprinting

Each device generates a unique fingerprint used for key derivation:

**Web Browser Fingerprint**:

-   User agent string
-   Screen resolution
-   Timezone
-   Language settings

**Mobile Device Fingerprint**:

-   Platform identifier
-   Timezone
-   Language settings
-   Device-specific characteristics

**Node.js Fingerprint**:

-   Hostname
-   System architecture
-   Timezone
-   Platform identifier

## Data Integrity

### HMAC-SHA256 Checksums

Every stored value includes an integrity checksum:

```typescript
// Integrity verification is automatic
const data = await Storage.getItem("important-data");
// Returns null if integrity check fails
```

### Corruption Detection

-   Automatic detection of corrupted data
-   Automatic cleanup of invalid entries
-   Graceful handling of integrity failures

### Version Compatibility

-   Storage format versioning
-   Automatic migration between versions
-   Backward compatibility checks

## Access Control

### Automatic Lockout System

Protection against brute force attacks:

```typescript
// Configure lockout parameters (defaults shown)
const DEFAULT_CONFIG = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
};

// Check if service is locked
const metrics = Storage.getSecurityMetrics("sensitive-key");
if (metrics.isLocked) {
    console.log(`Locked until: ${new Date(metrics.lockUntil)}`);
}
```

### Security Metrics Tracking

Monitor access patterns and security events:

```typescript
const metrics = Storage.getSecurityMetrics("key");
console.log(`Total attempts: ${metrics.totalAttempts}`);
console.log(`Failed attempts: ${metrics.failedAttempts}`);
console.log(`Last failed: ${new Date(metrics.lastFailedAttempt)}`);
```

### Manual Service Management

```typescript
// Unlock a locked service
await Storage.unlockService("locked-key");

// Check lock status
const isLocked = await SecurityUtils.isServiceLocked("key");
```

## Platform-Specific Security

### Web Browser Security

-   **Same-Origin Policy**: Data isolated per origin
-   **Storage Quotas**: Prevents storage exhaustion attacks
-   **HTTPS Requirement**: Recommended for production use

```typescript
// Web-specific security options
await Storage.setItem("web-data", value, {
    useIndexedDB: true, // More secure than localStorage
});
```

### Mobile Security

-   **Hardware Security**: Utilizes secure enclave when available
-   **Biometric Authentication**: Touch ID, Face ID, fingerprint
-   **App Sandbox**: Data isolated per application

```typescript
// Mobile biometric authentication
await Storage.setItem("biometric-data", value, {
    touchID: true,
    requireAuth: true,
    authenticatePrompt: "Access secure data",
});
```

### Node.js Security

-   **File Permissions**: Automatic secure file permissions (600)
-   **Directory Security**: Secure directory permissions (700)
-   **Process Isolation**: Data isolated per process/user

```typescript
// Node.js with custom secure path
const secureStorage = new Storage({
    nodeStoragePath: "/var/lib/myapp/secure", // Secure directory
});
```

## Security Best Practices

### Key Management

-   Keys are never stored in plain text
-   Device-specific key derivation
-   Automatic key rotation considerations
-   Secure key disposal

### Data Handling

```typescript
// Secure data lifecycle
try {
    // Store sensitive data
    await Storage.setItem("secret", sensitiveData);

    // Use data
    const data = await Storage.getItem("secret");

    // Clear sensitive variables
    sensitiveData = null;
} finally {
    // Ensure cleanup
    await Storage.removeItem("secret");
}
```

### Time-Based Security

```typescript
// Use TTL for temporary sensitive data
await Storage.setItemWithTTL("session-token", token, 3600); // 1 hour

// Automatic cleanup of expired data
// Runs automatically on startup and periodically
```

### Error Handling

```typescript
try {
    await Storage.setItem("key", "value");
} catch (error) {
    if (error.message.includes("locked")) {
        // Service is locked due to failed attempts
        console.log("Service temporarily unavailable");
    } else if (error.message.includes("integrity")) {
        // Data integrity compromised
        console.log("Security violation detected");
    }
}
```

## Security Monitoring

### Audit Trail

ACPES maintains security metrics for monitoring:

```typescript
// Get comprehensive security status
const auditData = {
    platform: Storage.getPlatformInfo(),
    metrics: Storage.getSecurityMetrics("key"),
    timestamp: Date.now(),
};

// Log security events
console.log("Security Audit:", JSON.stringify(auditData, null, 2));
```

### Threat Detection

-   Failed attempt pattern analysis
-   Unusual access pattern detection
-   Automatic lockout triggers
-   Security event logging

### Compliance Features

-   Data encryption at rest
-   Integrity verification
-   Access logging
-   Secure key management
-   Automatic data expiration

## Security Limitations

### Known Limitations

-   **Web**: Limited by browser security model
-   **Mobile**: Requires device security features
-   **Node.js**: Depends on file system security

### Mitigation Strategies

-   Multiple security layers
-   Graceful degradation
-   Comprehensive error handling
-   Regular security updates

### Recommendations

-   Use HTTPS in production
-   Enable device security features
-   Regular security audits
-   Monitor access patterns
-   Implement proper error handling

## Cryptographic Details

### Algorithms Used

-   **Symmetric Encryption**: AES-256-CBC
-   **Key Derivation**: PBKDF2-SHA256
-   **Integrity**: HMAC-SHA256
-   **Compression**: LZ-string (before encryption)

### Implementation Notes

-   Uses crypto-js library for cryptographic operations
-   Constant-time comparison for integrity checks
-   Secure random number generation
-   Proper initialization vector handling

### Security Assumptions

-   Device security is maintained
-   Platform cryptographic libraries are secure
-   Storage backends are not compromised
-   Network communications are secured (HTTPS)

