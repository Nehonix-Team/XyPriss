# ACPES UTF-8 Corruption Fixes

## Problem Description

The ACPES module was experiencing "Malformed UTF-8 data" errors when processing large datasets in the web application. The errors occurred in:

- `SecureStorageService.cleanCorruptedData`
- `SecureStorageService.getItem` 
- `EncryptedSessionManager.loadSession`
- `EncryptedSessionManager.initialize`

## Root Cause Analysis

The issue was in the encryption/decryption process where CryptoJS was attempting to convert corrupted or invalid encrypted data to UTF-8 strings without proper error handling. Specifically:

1. **Regular Encryption (`EncryptionUtils.doubleDecrypt`)**: Lines 77 and 82 called `.toString(CryptoJS.enc.Utf8)` without error handling
2. **Advanced Encryption (`AdvancedEncryptionUtils.decrypt`)**: Line 253 had the same issue
3. **Data Processing**: No graceful handling of corrupted data during retrieval

## Implemented Fixes

### 1. Enhanced Error Handling in `EncryptionUtils.doubleDecrypt`

**File**: `mods/ACPES/src/components/encryption.ts`

```typescript
// Before: Direct UTF-8 conversion without error handling
const firstDecryptedText = firstDecryption.toString(CryptoJS.enc.Utf8);

// After: Safe UTF-8 conversion with error handling
let firstDecryptedText: string;
try {
    firstDecryptedText = firstDecryption.toString(CryptoJS.enc.Utf8);
    if (!firstDecryptedText) {
        throw new Error("First decryption failed - empty result");
    }
} catch (utf8Error) {
    throw new Error(`First decryption failed - malformed UTF-8 data: ${utf8Error}`);
}
```

### 2. Enhanced Error Handling in `AdvancedEncryptionUtils.decrypt`

**File**: `mods/ACPES/src/components/advancedEncryption.ts`

```typescript
// Before: Direct UTF-8 conversion
const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);

// After: Safe UTF-8 conversion with error handling
let decryptedData: string;
try {
    decryptedData = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) {
        throw new Error("Decryption resulted in empty data");
    }
} catch (utf8Error) {
    throw new Error(`Decryption failed - malformed UTF-8 data: ${utf8Error}`);
}
```

### 3. Improved Data Processing in `CrossPlatformSecureStorage`

**File**: `mods/ACPES/src/core/storage.ts`

- Added specific error handling for malformed UTF-8 data during decryption
- Automatic removal of corrupted entries when detected
- Enhanced decompression error handling
- Comprehensive error categorization (corruption, utf8_corruption, decompression)

### 4. Enhanced Compression Error Handling

**File**: `mods/ACPES/src/components/compression.ts`

```typescript
// Before: Simple fallback
return LZString.decompressFromBase64(data) || compressedData;

// After: Proper error handling
const decompressed = LZString.decompressFromBase64(data);
if (decompressed === null || decompressed === undefined) {
    throw new Error("Decompression returned null - data may be corrupted");
}
```

### 5. Added Manual Cleanup Method

**File**: `mods/ACPES/src/core/storage.ts`

Added `cleanCorruptedData()` method that can be called manually to clean up corrupted entries:

```typescript
async cleanCorruptedData(): Promise<{
    cleaned: number;
    errors: number;
    details: string[];
}>
```

## Benefits of the Fixes

1. **Graceful Error Handling**: No more unhandled "Malformed UTF-8 data" exceptions
2. **Automatic Cleanup**: Corrupted entries are automatically detected and removed
3. **Better Logging**: Detailed error messages for debugging
4. **Data Integrity**: Maintains data integrity while handling corruption gracefully
5. **User Experience**: Application continues to work even with corrupted data

## Usage

### Automatic Handling
The fixes work automatically - corrupted data is detected and handled gracefully during normal operations.

### Manual Cleanup
You can manually clean corrupted data:

```typescript
import { Storage } from 'xypriss-acpes';

const result = await Storage.cleanCorruptedData();
console.log(`Cleaned: ${result.cleaned}, Errors: ${result.errors}`);
```

## Testing

A test script `test-acpes-utf8-fix.js` has been created to verify the fixes work correctly with both valid and corrupted data.

## Backward Compatibility

All fixes are backward compatible and don't change the public API. Existing code will continue to work without modifications.
