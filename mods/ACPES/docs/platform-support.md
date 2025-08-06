# Platform Support

ACPES provides comprehensive cross-platform support with automatic platform detection and optimized storage backends for each environment.

## Supported Platforms

### Web Browsers

**Primary Storage**: localStorage
**Fallback Storage**: IndexedDB
**Final Fallback**: Memory storage

#### Browser Requirements
- Modern browsers with localStorage support
- ES2017+ support (async/await)
- Optional: IndexedDB for enhanced features

#### Browser-Specific Features
```typescript
// Use IndexedDB for large data
await Storage.setItem('large-dataset', data, {
    useIndexedDB: true,
    compressionEnabled: true
});

// Check browser capabilities
const info = Storage.getPlatformInfo();
console.log(`Has IndexedDB: ${info.hasIndexedDB}`);
```

#### Storage Limitations
- localStorage: ~5-10MB depending on browser
- IndexedDB: Much larger limits (typically 50% of available disk space)
- Memory: Limited by available RAM

#### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

### Mobile (React Native)

**Primary Storage**: React Native Keychain
**Fallback Storage**: Memory storage

#### Requirements
- React Native 0.60+
- react-native-keychain package
- iOS 9+ or Android API 23+

#### Installation
```bash
npm install react-native-keychain
# iOS additional setup
cd ios && pod install
```

#### Mobile-Specific Features
```typescript
// Biometric authentication
await Storage.setItem('sensitive-data', value, {
    touchID: true,
    requireAuth: true,
    service: 'MyApp'
});

// iOS Keychain options
await Storage.setItem('ios-data', value, {
    accessGroup: 'group.myapp.shared',
    service: 'MyAppService'
});
```

#### Platform Capabilities
- **iOS**: Keychain Services with Touch ID/Face ID support
- **Android**: Android Keystore with fingerprint support
- **Biometric Authentication**: Automatic fallback to device passcode
- **Background Access**: Data persists across app restarts

#### Security Features
- Hardware-backed key storage (when available)
- Biometric authentication integration
- Secure enclave utilization (iOS)
- Android Keystore integration

### Node.js

**Primary Storage**: Encrypted file system
**Fallback Storage**: Memory storage

#### Requirements
- Node.js 14+
- File system write permissions
- Optional: Custom storage directory

#### Node.js-Specific Features
```typescript
// Custom storage path
const customStorage = new CrossPlatformSecureStorage({
    nodeStoragePath: '/var/lib/myapp/secure'
});

// Custom file path per item
await Storage.setItem('config', data, {
    filePath: '/etc/myapp/secure.enc'
});
```

#### File System Structure
```
.secure-storage/          # Default directory
├── session_token.enc     # Encrypted data files
├── user_data.enc
└── ...
```

#### Security Considerations
- Files are encrypted with device-specific keys
- Proper file permissions (600) are set automatically
- Directory permissions (700) for storage folder
- Automatic cleanup of expired files

#### Performance Characteristics
- Fast read/write operations
- Efficient for small to medium data sizes
- Automatic file locking for concurrent access
- Background cleanup processes

## Platform Detection

ACPES automatically detects the current platform:

```typescript
const info = Storage.getPlatformInfo();

switch (info.platform) {
    case 'web':
        console.log('Running in browser');
        break;
    case 'mobile':
        console.log('Running in React Native');
        break;
    case 'node':
        console.log('Running in Node.js');
        break;
    default:
        console.log('Unknown platform, using fallback');
}
```

## Fallback Mechanisms

### Storage Fallback Chain

1. **Primary Storage**: Platform-specific secure storage
2. **Secondary Storage**: Alternative platform storage
3. **Memory Storage**: In-memory fallback (data lost on restart)

### Automatic Fallback Triggers
- Storage backend unavailable
- Insufficient permissions
- Storage quota exceeded
- Platform-specific errors

### Fallback Behavior
```typescript
// Automatic fallback is transparent
await Storage.setItem('key', 'value');
// Will use best available storage automatically

// Check which storage is being used
const info = Storage.getPlatformInfo();
console.log(`Using file system: ${info.hasFileSystem}`);
console.log(`Using keychain: ${info.hasKeychain}`);
```

## Cross-Platform Considerations

### Data Portability
- Data encrypted with device-specific keys
- Not portable between devices by design
- Each platform maintains separate storage

### API Consistency
- Same API across all platforms
- Platform-specific options available
- Consistent error handling

### Performance Differences
- **Web**: Fast for small data, slower for large data
- **Mobile**: Optimized for security, moderate performance
- **Node.js**: Fast file operations, good for all data sizes

### Security Variations
- **Web**: Browser security model limitations
- **Mobile**: Hardware-backed security (when available)
- **Node.js**: File system permissions and encryption

## Best Practices

### Platform-Agnostic Code
```typescript
// Write code that works everywhere
const storeUserData = async (userData) => {
    const options = {};
    
    // Add platform-specific optimizations
    const info = Storage.getPlatformInfo();
    if (info.isWeb && userData.length > 1000) {
        options.compressionEnabled = true;
        options.useIndexedDB = true;
    } else if (info.isMobile) {
        options.service = 'MyApp';
    }
    
    return await Storage.setItem('user-data', userData, options);
};
```

### Error Handling
```typescript
try {
    await Storage.setItem('key', 'value');
} catch (error) {
    if (error.message.includes('quota')) {
        // Handle storage quota exceeded
        console.log('Storage full, cleaning up...');
        await Storage.clear();
    } else if (error.message.includes('permissions')) {
        // Handle permission errors
        console.log('Storage permissions denied');
    }
}
```

### Testing Across Platforms
- Test on actual devices/browsers
- Verify fallback mechanisms
- Test storage limits and quotas
- Validate security features on each platform
